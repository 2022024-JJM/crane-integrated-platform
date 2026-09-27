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
//     2026-09-07 V4 부터 지면은 lit PBR 3장(base/MR/normal, 각 4096)이라
//     노멀/ORM 도 같은 상한·손실 압축을 그대로 탄다.
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
//   ③ surgery   (in-process) transmission 제거 → 단면화 → 미사용 UV 제거
//               → weld → 평면 레이어 보호(아래) → simplify
//               → meshopt 압축  ← meshopt 는 반드시 마지막 (텍스처 커맨드가
//               EXT_meshopt_compression 을 제거하므로, optimize-glb.mjs 참고)
//               → 출력 검증(동일 평면 겹침)
//
// 평면 레이어 보호 — 전부 수평면인 프리미티브(아스팔트·차선·횡단보도)는 이
// 파이프라인의 세 스테이지가 각각 망가뜨린다. okpo.glb 의 횡단보도가 깜빡이고
// 중앙선이 사라지고 줄무늬가 쐐기로 찌그러진 원인이 이 셋이었다:
//   - simplify: 평면 안의 붕괴는 오차가 0 으로 계산돼, 허용 오차(지도 폭의
//     0.02% ≈ 수십 cm)보다 좁은 줄무늬를 삼각형 하나로 접거나 지운다. 또
//     아스팔트가 차선 자리만큼 도려져 맞물린 경계(같은 높이지만 겹치지 않음)를
//     서로 다르게 깎아 겹치게 만든다. → 평면 레이어는 simplify 에서 뺀다.
//   - 단면화: 원본은 양면이라 뒤집힌 면도 보이는데 단면화하면 위에서 사라진다.
//     → 다른 레이어의 윗면 위 OVERLAY_REACH 안쪽에 놓인 아래 향한 높이는 위로
//     뒤집는다. 받치는 면이 없는 것(philly 지도에 딸려 온 Sea 평면)은 그대로
//     가려 둔다 — 런타임 바다(OceanWater)가 그 자리를 그린다.
//   - 양자화: 바닥에서 수 mm 띄워 얹은 표시는 그리드(수 cm)에 삼켜져 바닥과
//     완전히 같은 높이가 된다. 간격 0 은 로그 깊이로도 못 가른다. → 다른 레이어
//     위에 COPLANAR_EPS 안쪽으로 놓인 높이는 OVERLAY_LIFT 이상 띄운다.
// 판정은 머티리얼 이름이 아니라 지오메트리 실측이다(audit-map-layers.mjs).
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
// (작은 오프셋이 의도가 아님을 사람이 확인한 경우, 또는 그 평면층이 화면에
// 안 보이는 경우 — philly-terrain.glb(폭 18.9km, 그리드 28.8cm)는 도로·숲
// 평면이 지형 overlay 아래 묻혀 있어 우회했다. assets-src/README.md 참고).
//
// 가드가 보지 않는 것 — 5mm 이내 레벨은 같은 층으로 병합해 갭 계산에서
// 뺀다. 같은 높이의 쌍은 두 경우뿐이고 둘 다 평면 레이어 보호가 맡는다:
//   - 맞물린 쌍(philly 의 Asphalt↔Road Lines): XZ 로 겹치지 않아 안전하다.
//     simplify 에서 빼 두면 양자화 뒤에도 맞물림이 유지된다.
//   - 얹힌 쌍(okpo 의 횡단보도, 아스팔트 5mm 위): 띄우기 스테이지가 그리드
//     정수 배만큼 올려 가드의 시야(5mm 밖)로 옮긴다.
// 가드와 보호 스테이지가 놓친 겹침은 출력 검증이 잡는다 — 양자화된 결과에서
// 얹힌 표시가 남아 있으면 그 파일은 실패한다(FORCE_MESHOPT=1 이면 경고).
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

import { NodeIO, Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  listTextureInfoByMaterial,
  meshopt,
  simplifyPrimitive,
  weld,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

import {
  LEVEL_EPS,
  collectLayers,
  formatOverlap,
  isOverlayOverlap,
  measureCoplanarOverlaps,
  measureHiddenOverlays,
} from './audit-map-layers.mjs';

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
/**
 * 얹힌 표시를 바닥에서 띄우는 최소 높이(m). 디자이너 지도의 층간 관례(지면
 * 위 도로 10cm)와 같다. 실제로는 양자화 그리드의 정수 배로 올림해, 바닥과
 * 표시가 양자화 뒤에도 정확히 그 칸 수만큼 떨어지게 한다.
 */
const OVERLAY_LIFT = 0.1;
/**
 * 아래 향한 면을 뒤집힌 표시로 볼 높이 범위(m) — 받치는 윗면에서 이 안쪽에
 * 떠 있어야 한다. 디자이너가 띄워 둔 표시(OVERLAY_LIFT)를 여유 있게 덮는다.
 */
const OVERLAY_REACH = OVERLAY_LIFT * 2;
/** [0,1] 밖 UV 가 전부 이 안이면 export 부동소수 노이즈로 보고 클램프한다. */
const UV_CLAMP_EPS = 1e-4;
const TRANSMISSION_EXT = 'KHR_materials_transmission';
const keepDoubleSided = process.env.KEEP_DOUBLE_SIDED === '1';
const forceMeshopt = process.env.FORCE_MESHOPT === '1';

/**
 * 16bit 양자화 그리드 한 변(m). quantizationVolume 'mesh' 기준이라 메시가
 * 여럿이면 가장 거친(=가장 큰 bbox) 메시의 값.
 */
function quantizationGrid(doc) {
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
    }
    const extent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    if (Number.isFinite(extent)) {
      grid = Math.max(grid, extent / (2 ** QUANTIZE_POSITION_BITS - 1));
    }
  }
  return grid;
}

/**
 * 양자화 안전성 실측 (헤더 주석 참고).
 *
 * grid   : quantizationGrid 참고.
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
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;

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
  return { grid: quantizationGrid(doc), minGap };
}

/**
 * [0,1] 을 부동소수 노이즈만큼 벗어난 TEXCOORD 를 클램프한다.
 *
 * meshopt 의 UV 양자화(unorm16)는 accessor 에 [0,1] 밖 값이 하나라도 있으면
 * 그 accessor 를 통째로 건너뛰어 float 로 남긴다("Skipping TEXCOORD_n; out of
 * [0,1] range"). 2026-09-11 Terrain 3차 전달본은 도로 3개 프리미티브의 UV
 * 12개가 최대 2.6e-5 벗어나 float 로 남았고, 같은 머티리얼 그룹의 다른
 * 프리미티브(unorm16)와 attribute 구성이 달라져 tile-terrain-glb.mjs 가 병합을
 * 거부했다. 범위 밖 값이 **전부** UV_CLAMP_EPS 안일 때만 accessor 를 고치고,
 * 하나라도 그 밖이면(타일링 UV 등 의도된 범위 밖) 손대지 않는다. 이동량은
 * unorm16 계단(1.5e-5) 1~2칸 수준이라 양자화 자체의 오차와 같은 급이다.
 */
function clampNoisyTexcoords(doc) {
  const texcoords = new Set();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of prim.listSemantics()) {
        if (sem.startsWith('TEXCOORD_')) texcoords.add(prim.getAttribute(sem));
      }
    }
  }
  let fixed = 0;
  for (const accessor of texcoords) {
    const array = accessor.getArray();
    if (!(array instanceof Float32Array)) continue;
    let outside = 0;
    let noisyOnly = true;
    for (const v of array) {
      if (v >= 0 && v <= 1) continue;
      outside++;
      if (!(v >= -UV_CLAMP_EPS && v <= 1 + UV_CLAMP_EPS)) {
        noisyOnly = false;
        break;
      }
    }
    if (outside === 0 || !noisyOnly) continue;
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.min(1, Math.max(0, array[i]));
    }
    accessor.setArray(array);
    fixed++;
  }
  return fixed;
}

/**
 * 어떤 텍스처도 참조하지 않는 TEXCOORD_n (n ≥ 1) 을 프리미티브에서 뗀다.
 *
 * Blender export 가 UV 맵을 전부 실어 보내는 경우가 있다(okpo-tree.glb 는
 * 정점 370만 개에 TEXCOORD_1~4 가 붙어 왔다). 렌더에 쓰이지 않는데 배포 용량과
 * 정점 버퍼 VRAM 만 먹고, weld 의 정점 동등 비교도 방해한다. TEXCOORD_0 은
 * 무텍스처 머티리얼이어도 남긴다 — 타일 스크립트의 attribute 구성 검사와
 * 기존 지도 산출물을 건드리지 않기 위함이다.
 */
function stripUnusedTexcoords(doc) {
  let removed = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial();
      const used = new Set(
        material
          ? listTextureInfoByMaterial(material).map((info) => info.getTexCoord())
          : [],
      );
      for (const sem of prim.listSemantics()) {
        if (!sem.startsWith('TEXCOORD_')) continue;
        const index = Number(sem.slice('TEXCOORD_'.length));
        if (index === 0 || used.has(index)) continue;
        const accessor = prim.getAttribute(sem);
        prim.setAttribute(sem, null);
        if (accessor.listParents().every((p) => p.propertyType === 'Root')) {
          accessor.dispose();
        }
        removed++;
      }
    }
  }
  return removed;
}

/** 다른 프리미티브와 공유하는 accessor 면 복제해 이 프리미티브 전용으로 만든다. */
function ownAccessor(prim, semantic) {
  const accessor =
    semantic === 'indices' ? prim.getIndices() : prim.getAttribute(semantic);
  if (!accessor) return null;
  const owners = accessor.listParents().filter((p) => p instanceof Primitive);
  if (owners.length <= 1) return accessor;
  const clone = accessor.clone();
  if (semantic === 'indices') prim.setIndices(clone);
  else prim.setAttribute(semantic, clone);
  return clone;
}

/**
 * 지오메트리를 고쳐도 되는 평면 레이어만 고른다.
 *
 * 뒤집기·띄우기는 로컬 좌표를 고치므로 로컬 +Y 가 월드 +Y 여야 하고(기울임·
 * 거울상 없음), 메시를 한 노드만 써야 한다(인스턴싱이면 한쪽을 고칠 때 다른
 * 쪽도 움직인다). 지도는 루트 오프셋을 지운 단일 노드라 보통 전부 통과한다.
 */
function editableFlatLayers(layers) {
  return layers.filter((layer) => {
    if (!layer.flat) return false;
    const m = layer.node.getWorldMatrix();
    const upright =
      Math.abs(m[1]) < 1e-6 &&
      Math.abs(m[9]) < 1e-6 &&
      Math.abs(m[4]) < 1e-6 &&
      Math.abs(m[6]) < 1e-6 &&
      m[5] > 0 &&
      m[0] * m[10] - m[2] * m[8] > 0;
    const nodes = layer.mesh
      .listParents()
      .filter((p) => p.propertyType === 'Node');
    return upright && nodes.length === 1;
  });
}

/** 겹침 목록에서 얹힌 표시로 판정된 높이를 고칠 수 있는 레이어별로 모은다. */
function overlayLevels(overlaps, flatLayers) {
  const editable = new Set(flatLayers.map((layer) => layer.prim));
  const targets = new Map();
  for (const overlap of overlaps) {
    if (!editable.has(overlap.over.prim)) continue;
    for (const { level, overlay } of overlap.levels) {
      if (!overlay) continue;
      const levels = targets.get(overlap.over) ?? new Set();
      levels.add(level);
      targets.set(overlap.over, levels);
    }
  }
  return targets;
}

/**
 * 바닥에 얹혔는데 아래를 향한 표시를 위로 뒤집는다 (헤더 "평면 레이어 보호").
 *
 * 그 높이의 아래 향한 면을 **전부** 뒤집는다. 인덱스 순서를 바꾸고, 그 면의
 * 정점 노멀이 아래를 향하면 부호를 뒤집는다. 노멀을 뒤집은 정점은 TANGENT 의
 * w 도 뒤집어 bitangent 방향을 지킨다. weld 뒤에 돌아야 한다 — 인덱스가
 * 있어야 면 단위로 뒤집을 수 있다.
 */
function faceOverlaysUp(doc, flatLayers) {
  const targets = overlayLevels(
    measureHiddenOverlays(collectLayers(doc), OVERLAY_REACH),
    flatLayers,
  );
  let flipped = 0;
  for (const [{ node, prim }, levels] of targets) {
    const m = node.getWorldMatrix();
    const position = prim.getAttribute('POSITION');
    const array = prim.getIndices().getArray().slice();
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    const c = [0, 0, 0];
    const touched = new Set();
    for (let t = 0; t < array.length; t += 3) {
      position.getElement(array[t], a);
      position.getElement(array[t + 1], b);
      position.getElement(array[t + 2], c);
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (ny >= 0) continue;
      const y = m[5] * a[1] + m[13];
      if (![...levels].some((level) => Math.abs(y - level) <= LEVEL_EPS * 2)) {
        continue;
      }
      [array[t + 1], array[t + 2]] = [array[t + 2], array[t + 1]];
      touched.add(array[t]).add(array[t + 1]).add(array[t + 2]);
      flipped++;
    }
    if (touched.size === 0) continue;
    ownAccessor(prim, 'indices').setArray(array);

    const normal = ownAccessor(prim, 'NORMAL');
    const tangent = ownAccessor(prim, 'TANGENT');
    if (!normal) continue;
    const n = [0, 0, 0];
    const tan = [0, 0, 0, 0];
    for (const vertex of touched) {
      normal.getElement(vertex, n);
      if (n[1] >= 0) continue;
      normal.setElement(vertex, [-n[0], -n[1], -n[2]]);
      if (!tangent) continue;
      tangent.getElement(vertex, tan);
      tangent.setElement(vertex, [tan[0], tan[1], tan[2], -tan[3]]);
    }
  }
  return flipped;
}

/**
 * 다른 레이어 위에 같은 높이로 얹힌 평면 레이어의 높이를 띄운다 (헤더 "평면
 * 레이어 보호"). 판정은 audit-map-layers.mjs 의 overlay — 그 높이 면적의
 * OVERLAY_MIN_SHARE 이상이 COPLANAR_EPS 안쪽으로 겹칠 때다.
 *
 * 그 높이의 정점을 **전부** 같은 양만큼 올린다. 겹친 면만 올리면 같은 표시가
 * 바닥 경계에서 꺾인다. 올리는 양은 그리드의 정수 배라 양자화 뒤 바닥과의
 * 칸 수 차가 정확히 그 배수다(round(x + k) = round(x) + k).
 *
 * 반환: 띄운 (프리미티브, 높이) 수와 띄운 양(m).
 */
function liftOverlays(doc, flatLayers, grid) {
  const lift = grid > 0 ? Math.ceil(OVERLAY_LIFT / grid) * grid : OVERLAY_LIFT;
  const targets = overlayLevels(
    measureCoplanarOverlaps(collectLayers(doc)),
    flatLayers,
  );

  let lifted = 0;
  for (const [layer, levels] of targets) {
    const m = layer.node.getWorldMatrix();
    const position = ownAccessor(layer.prim, 'POSITION');
    const el = [0, 0, 0];
    for (let v = 0; v < position.getCount(); v++) {
      position.getElement(v, el);
      const y = m[5] * el[1] + m[13];
      for (const level of levels) {
        if (Math.abs(y - level) > LEVEL_EPS * 2) continue;
        el[1] += lift / m[5];
        position.setElement(v, el);
        break;
      }
    }
    lifted += levels.size;
  }
  return { lifted, lift };
}

/**
 * ③ surgery: CLI 커맨드로는 불가능한 머티리얼/지오메트리 수술.
 *
 * - 미사용 UV 제거: stripUnusedTexcoords 참고. weld 보다 먼저 돈다.
 * - transmission 제거: 굴절 유리를 일반 알파 블렌딩 반투명으로 바꾼다.
 *   유리 삼각형은 소수라 알파 정렬 비용은 미미하다.
 * - 단면화: doubleSided 해제로 래스터/레이캐스트 삼각형 테스트가 절반이 된다.
 *   뒤집힌 면이 구멍으로 보이면 KEEP_DOUBLE_SIDED=1 로 재실행해 복구.
 * - weld: 무손실 인덱스 dedup — simplify 가 프리미티브 경계를 넘어 동작하는 전제.
 * - 평면 레이어 보호: 헤더 주석 참고. 뒤집기 → 띄우기 순서이고(뒤집어야
 *   아래 향하던 표시도 겹침 측정에 잡힌다), simplify 는 평면 레이어를 건너뛴다.
 *   단면화 뒤에 돌아야 한다 — 가려진 면은 머티리얼이 단면일 때만 생긴다.
 * - 출력 검증: 양자화까지 끝난 문서에서 동일 평면 겹침을 다시 잰다.
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

  const strippedUvs = stripUnusedTexcoords(doc);
  if (strippedUvs > 0) console.log(`  미사용 UV 제거: attribute ${strippedUvs}개`);

  await doc.transform(weld());

  // 평면 레이어 보호. KEEP_DOUBLE_SIDED 면 아래 향한 면도 그대로 보이므로
  // 뒤집지 않는다.
  const flatLayers = editableFlatLayers(collectLayers(doc));
  const flipped = keepDoubleSided ? 0 : faceOverlaysUp(doc, flatLayers);
  const { lifted, lift } = liftOverlays(doc, flatLayers, quantizationGrid(doc));

  const flatPrims = new Set(flatLayers.map((layer) => layer.prim));
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (flatPrims.has(prim)) continue;
      simplifyPrimitive(prim, {
        simplifier: MeshoptSimplifier,
        ratio: SIMPLIFY_RATIO,
        error: SIMPLIFY_ERROR,
      });
      if (prim.getIndices()?.getCount() !== 0) continue;
      // 통째로 접힌 프리미티브는 뗀다 (simplify 트랜스폼과 같은 처리).
      const accessors = [prim.getIndices(), ...prim.listAttributes()];
      prim.dispose();
      for (const accessor of accessors) {
        if (accessor.listParents().every((p) => p.propertyType === 'Root')) {
          accessor.dispose();
        }
      }
    }
    if (mesh.listPrimitives().length === 0) mesh.dispose();
  }

  // 양자화 자동 가드: 그리드×2 ≤ 최소 층간 높이 차일 때만 meshopt 를 적용한다.
  const { grid, minGap } = quantizationSafety(doc);
  const meshoptSafe = grid * 2 <= minGap;
  if (meshoptSafe || forceMeshopt) {
    const clamped = clampNoisyTexcoords(doc);
    if (clamped > 0) console.log(`  UV 노이즈 클램프: accessor ${clamped}개 (허용 ${UV_CLAMP_EPS})`);
    await doc.transform(
      meshopt({ encoder: MeshoptEncoder, quantizePosition: QUANTIZE_POSITION_BITS }),
    );
  }

  // 출력 검증: 얹힌 표시가 남았으면 배포하지 않는다. 띄우기가 못 고치는
  // 경우(평면이 아닌 바닥과 맞물린 표시를 simplify 가 깬 경우 등)가 여기 걸린다.
  const overlaps = measureCoplanarOverlaps(collectLayers(doc));
  const overlays = overlaps.filter(isOverlayOverlap);
  if (overlays.length > 0 && !forceMeshopt) {
    throw new Error(
      '출력에 바닥과 같은 높이로 겹친 표시가 남았다 (화면에서 깜빡인다):\n' +
        overlays.map((overlap) => `        ${formatOverlap(overlap)}`).join('\n') +
        '\n      그 층이 화면에 안 보이는 것을 확인했다면 FORCE_MESHOPT=1 로 재실행.',
    );
  }

  await io.write(outputPath, doc);
  return {
    grid,
    minGap,
    meshoptApplied: meshoptSafe || forceMeshopt,
    flat: flatLayers.length,
    flipped,
    lifted,
    lift,
    overlaps,
  };
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
      const { grid, minGap, meshoptApplied, flat, flipped, lifted, lift, overlaps } =
        await surgery(webped, publicPath);
      const fmtCm = (m) => (Number.isFinite(m) ? `${(m * 100).toFixed(1)}cm` : '없음');
      quantInfo = `  [그리드 ${fmtCm(grid)} / 층간 ${fmtCm(minGap)} → meshopt ${meshoptApplied ? '적용' : '생략'}]`;
      console.log(
        `      평면 레이어 ${flat}개: 뒤집은 면 ${flipped}개, 띄운 높이 ${lifted}개` +
          (lifted > 0 ? `(+${fmtCm(lift)})` : ''),
      );
      for (const overlap of overlaps) {
        console.warn(`      동일 평면 겹침: ${formatOverlap(overlap)}`);
      }
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
