// 지도(maps/) GLB 최적화 파이프라인 (텍스처 + 머티리얼 + 지오메트리).
//
// 사용법:
//   pnpm optimize:map                    # 전체 지도
//   pnpm optimize:map phillyshipyard.glb # 특정 파일만
//   KEEP_DOUBLE_SIDED=1 pnpm optimize:map ...  # 양면 렌더링 유지(뒷면 구멍 발생 시)
//
// optimize-glb.mjs(모델용)와 분리한 이유 — 지도는 정책이 3가지 다르다:
//   - 텍스처 상한 1024px (모델은 2048): 200~500 유닛 거리의 배경 지형이라 충분.
//   - 노멀/ORM도 손실 압축 (모델은 무손실): 원거리에서 셰이딩 얼룩이 비가시.
//   - 머티리얼/지오메트리 수술 스테이지 존재: transmission 제거, 단면화,
//     weld+simplify 데시메이션. 지도 씬 항목은 meshOverrides/valueMapper 를
//     쓰지 않으므로 (scene-map-catalog.ts 참고) 토폴로지 변경이 안전하다.
//     단 join/prune 금지는 레포 정책 그대로 준수한다.
//
// 배경: phillyshipyard.glb 교체(de85396)로 지도가 1.7MB→53.6MB(정점 27배,
// KHR_materials_transmission 포함)가 되며 전 3D 화면이 저하됐다. transmission
// 머티리얼은 three.js 가 매 프레임 씬 전체를 별도 렌더 타겟에 한 번 더
// 그리게 만들어 프레임 비용을 사실상 2배로 만든다 — 여기서 제거한다.
//
// 백업 관례는 optimize-glb.mjs 와 동일: assets-src/maps/ 의 백업본이 항상
// "진짜 원본"이고, 매 실행마다 원본에서 다시 최적화하므로 멱등이다.
// 새 지도를 반입할 때는 assets-src/maps/<파일> 에 넣고 실행할 것.
//
// 파이프라인 (순서가 중요하다):
//   ① resize    텍스처 최대 1024px
//   ② webp      전 슬롯 손실 압축(q80) — 노멀/ORM 포함
//   ③ surgery   (in-process) transmission 제거 → 단면화 → weld → simplify
//               → meshopt 압축  ← meshopt 는 반드시 마지막 (텍스처 커맨드가
//               EXT_meshopt_compression 을 제거하므로, optimize-glb.mjs 참고)
//
// simplify 튜닝 노브:
//   - SIMPLIFY_RATIO 0.4: 삼각형 60% 감소 목표. 더 공격적으로 줄이려면 낮춘다.
//   - SIMPLIFY_ERROR 0.0002: bbox 대각 기준 상대 오차 — philly 기준(~2.9km)
//     최대 편차 약 0.6m 가 안전 레일. 감소가 부족하면 0.001 까지 올려본다.
//   simplify 는 정점을 기존 표면 위로 붕괴시키므로(양자화식 스냅과 다름)
//   드롭 레이캐스트 착지 높이가 오차 한도 안에서 보존된다.
//
// meshopt 양자화는 CLI 가 아니라 in-process 로 돌리고 포지션을 16bit 로
// 고정한다(QUANTIZE_POSITION_BITS). CLI meshopt 는 기본 14bit 인데, philly
// 지도 폭 ~2.4km 에서 14bit 는 그리드 14.6cm — 지면(3.682m)과 도로(3.782m)의
// 의도적 10cm 높이 차가 같은 셀로 붕괴해 도로 전체가 z-fighting 으로
// 깜빡였다(실측). 16bit 는 그리드 3.65cm 로, 이 지도의 의도적 높이 차
// 최소값 8.8cm(Material.008 층)까지 전부 2셀 이상으로 보존된다. 정확히
// 동일 평면인 쌍(Asphalt↔Road Lines, Dock_Floor↔Dock_Line)은 같은 입력값이
// 같은 셀로 가므로 비트 수와 무관하게 유지된다.
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

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAPS_DIR = join(repoRoot, 'apps/shell/public/maps');
const BACKUP_DIR = join(repoRoot, 'assets-src/maps');
const CLI = join(repoRoot, 'node_modules/@gltf-transform/cli/bin/cli.js');

const MAX_TEXTURE_SIZE = 1024;
const LOSSY_QUALITY = 80;
const SIMPLIFY_RATIO = 0.4;
const SIMPLIFY_ERROR = 0.0002;
/** 헤더 주석 참고 — 14bit(기본값)는 도로-지면 10cm 오프셋을 붕괴시킨다. */
const QUANTIZE_POSITION_BITS = 16;
const TRANSMISSION_EXT = 'KHR_materials_transmission';
const keepDoubleSided = process.env.KEEP_DOUBLE_SIDED === '1';

/**
 * ③ surgery: CLI 커맨드로는 불가능한 머티리얼/지오메트리 수술.
 *
 * - transmission 제거: 굴절 유리를 일반 알파 블렌딩 반투명으로 바꾼다.
 *   유리 삼각형은 소수라 알파 정렬 비용은 미미하다.
 * - 단면화: doubleSided 해제로 래스터/레이캐스트 삼각형 테스트가 절반이 된다.
 *   뒤집힌 면이 구멍으로 보이면 KEEP_DOUBLE_SIDED=1 로 재실행해 복구.
 * - weld: 무손실 인덱스 dedup — simplify 가 프리미티브 경계를 넘어 동작하는 전제.
 */
async function surgery(inputPath, outputPath) {
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
  // EXT_meshopt_compression 인코딩은 io.write 시점에 등록된 의존성으로 수행된다.
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(inputPath);
  const root = doc.getRoot();

  for (const material of root.listMaterials()) {
    if (material.getExtension(TRANSMISSION_EXT)) {
      material.setExtension(TRANSMISSION_EXT, null);
      material.setAlphaMode('BLEND');
      const [r, g, b] = material.getBaseColorFactor();
      material.setBaseColorFactor([r, g, b, 0.5]);
      material.setRoughnessFactor(0.1);
      material.setMetallicFactor(0);
    }
    if (!keepDoubleSided) {
      material.setDoubleSided(false);
    }
  }
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === TRANSMISSION_EXT) ext.dispose();
  }

  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY_RATIO, error: SIMPLIFY_ERROR }),
    meshopt({ encoder: MeshoptEncoder, quantizePosition: QUANTIZE_POSITION_BITS }),
  );

  await io.write(outputPath, doc);
}

const only = process.argv.slice(2);

const files = readdirSync(MAPS_DIR)
  .filter((f) => f.endsWith('.glb'))
  .filter((f) => only.length === 0 || only.includes(f))
  .sort();

if (files.length === 0) {
  console.error('대상 .glb 파일이 없습니다:', only.join(', '));
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });
const workDir = mkdtempSync(join(tmpdir(), 'map-optimize-'));

const fmtMB = (bytes) => (bytes / 1024 / 1024).toFixed(2).padStart(7);
let totalBefore = 0;
let totalAfter = 0;
const failures = [];

try {
  for (const file of files) {
    const publicPath = join(MAPS_DIR, file);
    const backupPath = join(BACKUP_DIR, file);

    // 백업이 없을 때만 백업한다. 있으면 그 백업본이 원본이다.
    if (!existsSync(backupPath)) {
      copyFileSync(publicPath, backupPath);
    }

    const before = statSync(backupPath).size;

    try {
      const resized = join(workDir, `${file}.1.glb`);
      const webped = join(workDir, `${file}.2.glb`);
      const cliStages = [
        ['resize', backupPath, resized, '--width', String(MAX_TEXTURE_SIZE), '--height', String(MAX_TEXTURE_SIZE)],
        ['webp', resized, webped, '--quality', String(LOSSY_QUALITY)],
      ];
      for (const [cmd, input, output, ...args] of cliStages) {
        execFileSync(process.execPath, [CLI, cmd, input, output, ...args], { stdio: 'pipe' });
      }
      await surgery(webped, publicPath);
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
