// GLB 최적화 파이프라인 (텍스처 + 지오메트리).
//
// 사용법:
//   pnpm optimize:glb           # 전체 모델
//   pnpm optimize:glb car.glb   # 특정 파일만
//
// 동작:
//   1. apps/shell/public/models/*.glb 원본을 assets-src/models/ 에 백업한다
//      (이미 백업이 있으면 건너뜀 — 백업본이 항상 "진짜 원본").
//   2. 백업본을 입력으로 아래 4단계를 돌려 public 쪽을 덮어쓴다.
//      항상 원본에서 다시 최적화하므로 몇 번을 재실행해도 이중 압축이 없다.
//
// ⚠️ 기존 모델을 새 버전으로 교체할 때: public 에 덮어쓰면 안 된다 — 백업이
//    있으면 백업본이 원본으로 취급되어 옛 파일이 새 파일을 도로 덮어쓴다.
//    새 원본을 assets-src/models/<파일> 에 넣은 뒤 이 스크립트를 실행할 것.
//
// 파이프라인 (순서가 중요하다 — STAGES 주석 참고):
//   ① resize   텍스처 최대 2048px
//   ② webp     baseColor/emissive 를 손실 압축(q85)
//   ③ webp     normal/ORM 을 무손실 압축
//   ④ meshopt  지오메트리 압축  ← 반드시 마지막
//
// 정책 (docs/GLB-압축-파이프라인-작업보고.md 참고):
//   - `optimize` 만능 커맨드는 절대 쓰지 않는다. join/prune 이 노드 계층을
//     병합하는데, 이 프로젝트는 meshOverrides 의 [index]name 메쉬 경로와
//     valueMapper 노드 바인딩이 계층에 의존하므로 씬이 조용히 깨진다.
//   - maps/ (지형) 은 대상이 아니다. 절감 효과가 미미하고(합계 ~2MB),
//     드롭 레이캐스트 대상이자 z-fighting 여유가 빠듯한 지오메트리라 제외.
//   - 신규 모델 반입 시 1회 실행하면 된다 (빌드 파이프라인 아님).
//
// 디코더: drei useGLTF 는 meshopt 디코더를 기본 등록한다. 수동 GLTFLoader
// 2곳(model-bottom-offset-cache.ts, preview-gltf-cache.ts)도 배선되어 있다.
// webp 텍스처는 three.js 가 별도 설정 없이 로드한다(브라우저 네이티브 디코드).
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = join(repoRoot, 'apps/shell/public/models');
const BACKUP_DIR = join(repoRoot, 'assets-src/models');
const CLI = join(repoRoot, 'node_modules/.bin/gltf-transform');

/**
 * 텍스처 한 변의 상한(px).
 *
 * 파일 크기보다 GPU 메모리 때문이다. 텍스처는 압축 형식과 무관하게 GPU 에는
 * 디코드된 RGBA 로 올라간다: 4096² ≈ 89MB/장, 2048² ≈ 22MB/장(밉맵 포함).
 * 골리앗 계열 3개 파일이 4096² 를 각각 품고 있어 파트 조립 화면에서만
 * 178MB 를 쓰고 있었다.
 */
const MAX_TEXTURE_SIZE = 2048;

/** baseColor/emissive 손실 압축 품질. 85 는 육안 차이가 거의 없는 통상값. */
const LOSSY_QUALITY = 85;

/**
 * ⚠️ meshopt 는 반드시 마지막이어야 한다.
 *
 * gltf-transform 의 텍스처 커맨드(resize/webp)는 파일을 다시 쓰면서
 * EXT_meshopt_compression 확장을 **제거한다**. meshopt 를 먼저 걸면 뒤따르는
 * 텍스처 패스가 지오메트리 압축을 조용히 해제해 버린다(실측: TTC-28.glb 가
 * 1.64MB → 5.83MB 로 되돌아갔고 전체 32개 파일이 26MB 증가).
 *
 * 노멀/ORM 을 무손실로 따로 처리하는 이유: 노멀맵의 손실 압축 아티팩트는
 * 색이 아니라 표면 셰이딩 얼룩으로 나타나 눈에 잘 띈다.
 */
const STAGES = [
  ['resize', ['--width', String(MAX_TEXTURE_SIZE), '--height', String(MAX_TEXTURE_SIZE)]],
  ['webp', ['--slots', '{baseColorTexture,emissiveTexture}', '--quality', String(LOSSY_QUALITY)]],
  ['webp', ['--slots', '{normalTexture,occlusionTexture,metallicRoughnessTexture}', '--lossless']],
  ['meshopt', []],
];

const only = process.argv.slice(2); // 파일명 인자로 부분 실행 가능

/** models/ 를 재귀 탐색한다(gc-04/ 등 하위 디렉토리 포함). MODELS_DIR 기준 상대 경로 반환. */
function listGlbFiles(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...listGlbFiles(join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.glb')) {
      out.push(rel);
    }
  }
  return out;
}

const files = listGlbFiles(MODELS_DIR)
  .filter((f) => only.length === 0 || only.some((o) => f === o || f.endsWith(`/${o}`)))
  .sort();

if (files.length === 0) {
  console.error('대상 .glb 파일이 없습니다:', only.join(', '));
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });
const workDir = mkdtempSync(join(tmpdir(), 'glb-optimize-'));

const fmtMB = (bytes) => (bytes / 1024 / 1024).toFixed(2).padStart(7);
let totalBefore = 0;
let totalAfter = 0;
const failures = [];

try {
  for (const file of files) {
    const publicPath = join(MODELS_DIR, file);
    const backupPath = join(BACKUP_DIR, file);
    mkdirSync(dirname(backupPath), { recursive: true });

    // 백업이 없을 때만 백업한다. 있으면 그 백업본이 원본이다.
    if (!existsSync(backupPath)) {
      copyFileSync(publicPath, backupPath);
    }

    const before = statSync(backupPath).size;
    const stem = file.replace(/[/\\]/g, '_');

    try {
      let input = backupPath;
      STAGES.forEach(([cmd, args], i) => {
        const isLast = i === STAGES.length - 1;
        const output = isLast ? publicPath : join(workDir, `${stem}.${i}.glb`);
        execFileSync(CLI, [cmd, input, output, ...args], { stdio: 'pipe' });
        input = output;
      });
    } catch (error) {
      failures.push(file);
      console.error(`FAIL  ${file}: ${error.stderr?.toString().trim() ?? error.message}`);
      // 실패 시 public 쪽을 원본으로 복원해 깨진 파일이 남지 않게 한다.
      copyFileSync(backupPath, publicPath);
      continue;
    }

    const after = statSync(publicPath).size;
    totalBefore += before;
    totalAfter += after;
    const ratio = ((1 - after / before) * 100).toFixed(1).padStart(5);
    console.log(`OK    ${fmtMB(before)}MB -> ${fmtMB(after)}MB  (-${ratio}%)  ${file}`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log('---');
if (totalBefore > 0) {
  const pct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log(
    `합계  ${fmtMB(totalBefore)}MB -> ${fmtMB(totalAfter)}MB  (-${pct}%)  성공 ${files.length - failures.length}/${files.length}`,
  );
}
if (failures.length > 0) {
  console.error('실패(원본 유지됨):', failures.join(', '));
  process.exit(1);
}
