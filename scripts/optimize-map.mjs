// 지도(maps/) GLB 최적화 파이프라인 (텍스처 + 머티리얼 + 지오메트리).
//
// 운영 절차·튜닝·문제 해결: docs/지도-GLB-최적화-파이프라인.md
//
// 사용법:
//   pnpm optimize:map                    # 전체 지도
//   pnpm optimize:map phillyshipyard.glb # 특정 파일만
//   KEEP_DOUBLE_SIDED=1 pnpm optimize:map ...  # 양면 렌더링 유지(뒷면 구멍 발생 시)
//   FORCE_MESHOPT=1 pnpm optimize:map ...      # 양자화 안전 가드 무시(아래 참고)
//
// optimize-glb.mjs(모델용)와 분리한 이유 — 지도는 정책이 3가지 다르다:
//   - 텍스처 상한 2048px (모델과 동일): 도입 당시 1024 였으나 2026-09-04
//     phillyshipyard 재반입본이 지면 전체를 4096px 베이크 1장(unlit, 타일링
//     없음)으로 바꿔 와서 1024 로는 2.4km/1024 ≈ 2.3m/px 로 흐려져 올렸다.
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
//   ① resize    텍스처 최대 2048px
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
// meshopt 양자화는 CLI 가 아니라 in-process 로 돌리고, 적용 여부를 지도별
// 실측으로 자동 판단한다(quantizationSafety 참고). 양자화 그리드는
// "지도 최대 폭 / 65535"(16bit)라 지도가 클수록 거칠어지는데, 그리드가
// 레이어 간 의도적 높이 차(예: 지면 위 10cm 띄운 도로)보다 거칠면 두 층이
// 같은 셀로 붕괴해 z-fighting 이 난다. 실제 사고: CLI 기본 14bit(그리드
// 14.6cm)가 philly 의 지면(3.682m)-도로(3.782m) 10cm 차를 붕괴시켜 도로
// 전체가 깜빡였다. 그래서 매 실행마다 프리미티브 Y bounds 로 최소 층간
// 높이 차(minGap)를 재고, 그리드×2 ≤ minGap 일 때만 meshopt 를 적용한다
// (philly 실측: 그리드 3.65cm, minGap 8.8cm → 적용). 조건을 못 넘으면
// meshopt 를 생략하고 f32 로 남긴다 — simplify 까지만으로도 대부분 절감되고
// 나머지는 HTTP 압축이 흡수한다. FORCE_MESHOPT=1 로 가드를 무시할 수 있다
// (작은 오프셋이 의도가 아님을 사람이 확인한 경우).
//
// 가드가 신경 쓰지 않아도 되는 것들:
//   - 정확히 동일 평면인 쌍(Asphalt↔Road Lines, Dock_Floor↔Dock_Line)은
//     같은 입력값이 같은 셀로 가므로 비트 수와 무관하게 유지된다(5mm 이내
//     레벨은 같은 층으로 병합해 갭 계산에서 제외).
//   - simplify 는 정점을 제거만 하고 이동시키지 않아 평면이 평면으로
//     유지된다 — 층간 갭에 영향이 없다.
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

const MAX_TEXTURE_SIZE = 2048;
const LOSSY_QUALITY = 80;
const SIMPLIFY_RATIO = 0.4;
const SIMPLIFY_ERROR = 0.0002;
/** 헤더 주석 참고 — 14bit(CLI 기본값)는 도로-지면 10cm 오프셋을 붕괴시킨다. */
const QUANTIZE_POSITION_BITS = 16;
/** 이보다 가까운 Y 레벨은 "의도적 동일 평면"으로 보고 같은 층으로 병합한다. */
const LAYER_MERGE_EPS = 0.005;
const TRANSMISSION_EXT = 'KHR_materials_transmission';
const keepDoubleSided = process.env.KEEP_DOUBLE_SIDED === '1';
const forceMeshopt = process.env.FORCE_MESHOPT === '1';

/**
 * 양자화 안전성 실측 (헤더 주석 참고).
 *
 * grid   : 16bit 양자화 그리드 한 변(m). quantizationVolume 'mesh' 기준이라
 *          메시가 여럿이면 가장 거친(=가장 큰 bbox) 메시의 값.
 * minGap : "지배적 평면 레벨" 간 최소 높이 차(m). 레벨은 프리미티브 정점의
 *          Y 히스토그램(1mm 단위)에서 그 프리미티브 정점의 20% 이상 + 32개
 *          이상이 몰린 값 — 즉 넓은 수평 평면만 층으로 센다. z-fighting 은
 *          넓은 평면끼리 겹칠 때만 문제라, 벽·나무 같은 입체 지오메트리의
 *          bbox 경계가 우연히 가깝다고 가드가 오발되지 않게 하기 위함이다.
 *          5mm 이내 레벨은 의도적 동일 평면으로 보고 병합. 층이 하나뿐이면
 *          Infinity.
 */
function quantizationSafety(doc) {
  const levels = [];
  let grid = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const pMin = position.getMin([]);
      const pMax = position.getMax([]);
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], pMin[i]);
        max[i] = Math.max(max[i], pMax[i]);
      }

      // 프리미티브별 Y 히스토그램에서 지배적 평면 레벨 추출.
      const array = position.getArray();
      const count = position.getCount();
      const byMm = new Map();
      for (let v = 0; v < count; v++) {
        const key = Math.round(array[v * 3 + 1] * 1000);
        byMm.set(key, (byMm.get(key) ?? 0) + 1);
      }
      const threshold = Math.max(32, count * 0.2);
      for (const [key, n] of byMm) {
        if (n >= threshold) levels.push(key / 1000);
      }
    }
    const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    if (Number.isFinite(extent)) {
      grid = Math.max(grid, extent / (2 ** QUANTIZE_POSITION_BITS - 1));
    }
  }

  levels.sort((a, b) => a - b);
  const merged = [];
  for (const level of levels) {
    if (merged.length === 0 || level - merged[merged.length - 1] > LAYER_MERGE_EPS) {
      merged.push(level);
    }
  }
  let minGap = Infinity;
  for (let i = 1; i < merged.length; i++) {
    minGap = Math.min(minGap, merged[i] - merged[i - 1]);
  }
  return { grid, minGap };
}

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
  );

  // 양자화 자동 가드: 그리드×2 ≤ 최소 층간 높이 차일 때만 meshopt 를 적용한다.
  const { grid, minGap } = quantizationSafety(doc);
  const meshoptSafe = grid * 2 <= minGap;
  if (meshoptSafe || forceMeshopt) {
    await doc.transform(
      meshopt({ encoder: MeshoptEncoder, quantizePosition: QUANTIZE_POSITION_BITS }),
    );
  }

  await io.write(outputPath, doc);
  return { grid, minGap, meshoptApplied: meshoptSafe || forceMeshopt };
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
    let quantInfo = '';

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
      const { grid, minGap, meshoptApplied } = await surgery(webped, publicPath);
      const fmtCm = (m) => (Number.isFinite(m) ? `${(m * 100).toFixed(1)}cm` : '없음');
      quantInfo = `  [그리드 ${fmtCm(grid)} / 층간 ${fmtCm(minGap)} → meshopt ${meshoptApplied ? '적용' : '생략'}]`;
      if (!meshoptApplied) {
        console.warn(
          `      meshopt 생략: 그리드 ${fmtCm(grid)} × 2 > 최소 층간 높이 차 ${fmtCm(minGap)} — ` +
            '양자화 시 z-fighting 위험. simplify 까지만 적용(f32, HTTP 압축이 일부 흡수). ' +
            '갭이 의도가 아니라고 확인했다면 FORCE_MESHOPT=1 로 재실행.',
        );
      }
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
    console.log(`OK    ${fmtMB(before)}MB -> ${fmtMB(after)}MB  (-${ratio}%)  ${file}${quantInfo}`);
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
