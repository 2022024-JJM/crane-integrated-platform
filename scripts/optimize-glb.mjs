// 모델 GLB 최적화 파이프라인 (텍스처 + 지오메트리).
//
// 사용법:
//   node scripts/optimize-glb.mjs --single <입력.glb> <출력.glb> [--report <json>]
//
// 파일 하나를 받아 하나를 낸다. 입력은 건드리지 않는다. 자산 라이브러리의 등록·
// 새 버전 올리기가 "최적화" 를 켰을 때 dev 미들웨어가 이 명령을 돌린다
// (apps/shell/vite.config.ts devAssetLibraryPlugin). 올린 원본은 미들웨어가
// assets-src/asset-library/ 에 남긴다.
//
// 배포 파일을 제자리에서 덮어쓰는 모드는 없다 — 모델을 바꾸면 항상 자산
// 라이브러리의 새 버전이 되고, 씬은 에디터에서 갱신해야 그 버전을 쓴다.
// 덮어쓰면 씬이 모르는 사이 모델이 바뀐다.
//
// 올리기 전에 원본에 손이 가야 하는 경우(Blender 가 구운 월드 좌표 복원,
// 거리별 LOD, 정적 모델 병합)는 그 스크립트로 파일을 먼저 가공한 뒤 올린다
// (unbake-root-transform · add-model-lod · join-static-glb).
//
// 파이프라인 (순서가 중요하다 — STAGES 주석 참고):
//   ① resize   텍스처 최대 2048px
//   ② webp     baseColor/emissive 를 손실 압축(q85)
//   ③ webp     normal/ORM 을 무손실 압축
//   ④ transmission 제거 (in-process) — KHR_materials_transmission 을 알파
//              블렌딩 반투명으로 치환. 확장이 없는 파일은 그대로 통과.
//   ⑤ meshopt  지오메트리 압축  ← 반드시 마지막
//
// 정책 (docs/GLB-압축-파이프라인-작업보고.md 참고):
//   - `optimize` 만능 커맨드는 절대 쓰지 않는다. join/prune 이 노드 계층을
//     병합하는데, 이 프로젝트는 meshOverrides 의 [index]name 메쉬 경로와
//     valueMapper 노드 바인딩이 계층에 의존하므로 씬이 조용히 깨진다.
//   - 지도는 이 스크립트 대상이 아니다 — 전용 파이프라인
//     scripts/optimize-map.mjs 를 쓴다. 지도는 텍스처 상한/손실 정책이 다르고
//     transmission 제거·데시메이션·타일 스테이지가 있다.
//
// 디코더: drei useGLTF 는 meshopt 디코더를 기본 등록한다. 수동 GLTFLoader
// 2곳(model-bottom-offset-cache.ts, preview-gltf-cache.ts)도 배선되어 있다.
// webp 텍스처는 three.js 가 별도 설정 없이 로드한다(브라우저 네이티브 디코드).
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// .bin 셸 심(확장자 없음)은 Windows execFileSync 에서 ENOENT — JS 엔트리를 node 로 직접 실행한다.
const CLI = join(repoRoot, 'node_modules/@gltf-transform/cli/bin/cli.js');

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
  [stripTransmission],
  ['meshopt', []],
];

const TRANSMISSION_EXT = 'KHR_materials_transmission';

/**
 * ④ transmission 제거 (in-process, optimize-map.mjs 의 surgery 와 같은 치환).
 *
 * KHR_materials_transmission 머티리얼이 씬에 하나라도 있으면 three.js 가 매
 * 프레임 씬 전체를 별도 렌더 타겟에 한 번 더 그려 프레임 비용이 사실상 2배가
 * 된다. 크레인 캐빈 유리(옥포 OC·TC 의 `Window Glass`)가 이 확장을 달고 오므로
 * 일반 알파 블렌딩 반투명으로 바꾼다. 확장이 없는 파일은 그대로 복사한다.
 * meshopt 앞에서 돌아야 한다 — NodeIO 재기록이 meshopt 인코딩을 해제한다.
 */
/** 파이프라인이 한 일 — --report 로 화면에 전해진다. */
const reportLines = [];

async function stripTransmission(inputPath, outputPath) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(inputPath);
  const root = doc.getRoot();
  let count = 0;
  for (const material of root.listMaterials()) {
    if (!material.getExtension(TRANSMISSION_EXT)) continue;
    material.setExtension(TRANSMISSION_EXT, null);
    material.setAlphaMode('BLEND');
    const [r, g, b] = material.getBaseColorFactor();
    material.setBaseColorFactor([r, g, b, 0.5]);
    material.setRoughnessFactor(0.1);
    material.setMetallicFactor(0);
    count += 1;
  }
  if (count === 0) {
    copyFileSync(inputPath, outputPath);
    return;
  }
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === TRANSMISSION_EXT) ext.dispose();
  }
  await io.write(outputPath, doc);
  console.log(`      transmission 제거: 머티리얼 ${count}개`);
  reportLines.push(`굴절 유리 머티리얼 ${count}개를 반투명으로 바꿈`);
}

/** 한 파일에 STAGES 를 차례로 돌린다. 중간 산출물은 workDir 에 둔다. */
async function runPipeline(inputPath, outputPath, workDir, stem) {
  let input = inputPath;
  for (const [i, [cmd, args]] of STAGES.entries()) {
    const isLast = i === STAGES.length - 1;
    const output = isLast ? outputPath : join(workDir, `${stem}.${i}.glb`);
    if (typeof cmd === 'function') {
      await cmd(input, output);
    } else {
      execFileSync(process.execPath, [CLI, cmd, input, output, ...args], { stdio: 'pipe' });
    }
    input = output;
  }
}

const USAGE =
  '사용법: node scripts/optimize-glb.mjs --single <입력.glb> <출력.glb> [--report <json>]';

const argv = process.argv.slice(2);
if (argv[0] !== '--single') {
  console.error(USAGE);
  console.error(
    '배포 파일을 제자리에서 덮어쓰는 모드는 없다 — 모델은 자산 라이브러리에서 ' +
      '새 버전으로 올린다(최적화를 켜면 이 스크립트가 돈다).',
  );
  process.exit(1);
}
const [, inputArg, outputArg, ...rest] = argv;
const reportFlag = rest.indexOf('--report');
const reportPath = reportFlag >= 0 ? rest[reportFlag + 1] : null;
if (!inputArg || !outputArg || (reportFlag >= 0 && !reportPath)) {
  console.error(USAGE);
  process.exit(1);
}

/** 화면이 읽는 보고 — `{ lines }`. 실패해도 이유를 남긴다. */
function writeReport(lines) {
  if (reportPath) writeFileSync(resolve(reportPath), JSON.stringify({ lines }));
}

const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;
const workDir = mkdtempSync(join(tmpdir(), 'glb-optimize-'));
try {
  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  await runPipeline(inputPath, outputPath, workDir, 'single');
  writeReport(reportLines);
  console.log(
    `OK    ${fmtMB(statSync(inputPath).size)} -> ${fmtMB(statSync(outputPath).size)}`,
  );
} catch (error) {
  const message = error.stderr?.toString().trim() || error.message;
  writeReport([`최적화 실패: ${message.split('\n').pop()}`]);
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
