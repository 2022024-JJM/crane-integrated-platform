// 지도 GLB 최적화 파이프라인 (텍스처 + 머티리얼 + 지오메트리 + 타일·LOD).
//
// 절차의 현재 상태: docs/agents/assets-glb.md
// 스테이지별 튜닝 근거(도입 시점의 기록): docs/지도-GLB-최적화-파이프라인.md
//
// 사용법:
//   node scripts/optimize-map.mjs --single <입력.glb> <출력.glb> [--report <json>]
//
// 파일 하나를 받아 하나를 낸다. 입력은 건드리지 않는다. 자산 라이브러리의 등록·
// 새 버전 올리기가 "최적화" 를 켰을 때 dev 미들웨어가 이 명령을 돌린다
// (apps/shell/vite.config.ts devAssetLibraryPlugin). 배포 파일을 제자리에서
// 덮어쓰는 모드는 없다 — 지도를 바꾸면 항상 라이브러리의 새 버전이 된다.
//
// **사람이 고를 옵션이 없다.** 예전에 환경 변수와 별도 명령으로 정하던 것을
// 파이프라인이 파일을 재서 정하고, 무엇을 골랐는지를 --report 에 적는다:
//   - 루트 오프셋: 루트 노드 하나에 이동만 실려 있으면 지운다(removeRootOffset).
//     지운 값은 보고에 실어, 새 지도는 그 자리가 기본 위치가 된다.
//   - 단색 텍스처: 모든 픽셀이 같은 텍스처를 4×4 로 줄인다(shrink-flat-textures).
//   - 양면 유지: 불투명 머티리얼만 단면으로 만든다. 알파(MASK·BLEND) 머티리얼은
//     잎 카드처럼 뒷면이 보여야 하는 것이라 양면 그대로 둔다.
//   - 지오메트리 압축(meshopt): 항상 건다. 양자화로 층이 붙지 않게, 그리드보다
//     가깝게 얹힌 평면 표시를 먼저 그리드 정수 배만큼 띄운다. 그래도 겹친 표시가
//     남으면 원본에 있던 결함이라 고칠 수 없다 — 저장하고 보고에 경고를 남긴다.
//   - 타일 + LOD: 삼각형이 많고 텍스처 머티리얼이 적은 지형만 나눈다
//     (pickTileGrid). 나누면 tile-terrain-glb.mjs 를 이어 돌린다.
//   - 작은 지도: 삼각형이 SURGERY_MIN_TRIANGLES 미만이면 지오메트리를 고치지
//     않는다(단면화·평면 레이어 보호·데시메이션 생략). 텍스처와 압축만 건다.
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
//     쓰지 않으므로 토폴로지 변경이 안전하다.
//     단 join/prune 금지는 레포 정책 그대로 준수한다.
//
// 배경: phillyshipyard.glb 교체(de85396)로 지도가 1.7MB→53.6MB(정점 27배,
// KHR_materials_transmission 포함)가 되며 전 3D 화면이 저하됐다. transmission
// 머티리얼은 three.js 가 매 프레임 씬 전체를 별도 렌더 타겟에 한 번 더
// 그리게 만들어 프레임 비용을 사실상 2배로 만든다 — 여기서 제거한다.
//
// 파이프라인 (순서가 중요하다):
//   ⓪ prepare   (in-process) 루트 오프셋 제거 → 단색 텍스처 축소
//   ① resize    텍스처 최대 2048px
//   ② webp      전 슬롯 손실 압축(q80) — 노멀/ORM 포함
//   ③ surgery   (in-process) transmission 제거 → 단면화(불투명만) → 미사용 UV
//               제거 → weld → 평면 레이어 보호(아래) → simplify
//               → meshopt 압축  ← meshopt 는 반드시 마지막 (텍스처 커맨드가
//               EXT_meshopt_compression 을 제거하므로, optimize-glb.mjs 참고)
//               → 출력 검증(동일 평면 겹침)
//   ④ tile      (조건부) 공간 타일 + LOD — tile-terrain-glb.mjs
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
//   - 양자화: 바닥에서 그리드보다 가깝게 얹은 표시는 양자화로 바닥과 같은
//     칸에 떨어져 완전히 같은 높이가 된다. 간격 0 은 로그 깊이로도 못 가른다.
//     → 다른 레이어 위에 그리드(최소 COPLANAR_EPS) 안쪽으로 놓인 높이는
//     OVERLAY_LIFT 이상, 그리드 정수 배만큼 띄운다. 띄운 층이 그 위의 층과
//     다시 가까워질 수 있어 더 띄울 것이 없을 때까지 되풀이한다(liftOverlays).
// 판정은 머티리얼 이름이 아니라 지오메트리 실측이다(audit-map-layers.mjs).
//
// simplify 튜닝 노브:
//   - SIMPLIFY_RATIO 0.4: 삼각형 60% 감소 목표. 더 공격적으로 줄이려면 낮춘다.
//   - SIMPLIFY_ERROR 0.0002: bbox 대각 기준 상대 오차 — philly 기준(~2.9km)
//     최대 편차 약 0.6m 가 안전 레일. 감소가 부족하면 0.001 까지 올려본다.
//   simplify 는 정점을 기존 표면 위로 붕괴시키므로(양자화식 스냅과 다름)
//   드롭 레이캐스트 착지 높이가 오차 한도 안에서 보존된다.
//
// meshopt 양자화는 CLI 가 아니라 in-process 로 돌린다. 양자화 그리드는
// "지도 최대 폭 / 65535"(16bit)라 지도가 클수록 거칠어지는데, 그리드가
// 레이어 간 높이 차보다 거칠면 두 층이 같은 셀로 붕괴해 z-fighting 이 난다.
// 실제 사고: CLI 기본 14bit(그리드 14.6cm)가 philly 의 지면(3.682m)-도로
// (3.782m) 10cm 차를 붕괴시켜 도로 전체가 깜빡였다. 폭 18.9km 지형은 그리드가
// 28.8cm 라 10cm 간격의 도로·숲·지면 평면이 전부 붙는다. 그래서 양자화 전에
// **그리드를 기준으로** 얹힌 평면 표시를 띄우고(위 "평면 레이어 보호"),
// 양자화가 끝난 문서에서 겹침을 다시 잰다(출력 검증).
//
// 출력 검증에 걸리는 것 — 띄우기가 못 고치는 겹침이다: 평면이 아닌 바닥과
// 맞물린 표시, 인스턴싱된 메시, 원본부터 같은 높이로 겹쳐 온 입체 면.
// 파이프라인이 만든 결함이 아니라 원본의 결함이므로 저장을 막지 않는다 —
// 원본을 그대로 저장해도 똑같이 깜빡이고 용량만 열 배다. 보고에 겹친 곳을
// 적어 검토 단계에서 보게 한다. 배포본은 audit-map-layers.mjs 로 다시 본다.
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
  COPLANAR_EPS,
  LEVEL_EPS,
  collectLayers,
  formatOverlap,
  isOverlayOverlap,
  measureCoplanarOverlaps,
  measureHiddenOverlays,
} from './audit-map-layers.mjs';
import { shrinkFlatTextures } from './shrink-flat-textures.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(repoRoot, 'node_modules/@gltf-transform/cli/bin/cli.js');
const TILE_SCRIPT = join(repoRoot, 'scripts/tile-terrain-glb.mjs');

const MAX_TEXTURE_SIZE = 2048;
const LOSSY_QUALITY = 80;
const SIMPLIFY_RATIO = 0.4;
const SIMPLIFY_ERROR = 0.0002;
/** 헤더 주석 참고 — 14bit(CLI 기본값)는 도로-지면 10cm 오프셋을 붕괴시킨다. */
const QUANTIZE_POSITION_BITS = 16;
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
/** 얹힌 표시를 띄우는 일을 되풀이하는 상한 — 층이 이보다 깊게 쌓인 지도는 없다. */
const LIFT_PASSES_MAX = 4;
/**
 * 타일 + LOD 로 나누는 기준. 삼각형이 이보다 적으면 통짜로도 가볍고(컬링 이득이
 * 작다), 타일마다 프리미티브가 머티리얼 수만큼 생기므로 "격자² × 타일당
 * 프리미티브" 가 예산을 넘지 않는 가장 촘촘한 격자를 고른다. 야드처럼 텍스처
 * 머티리얼이 수십 개인 지도는 어느 격자도 예산에 들지 않아 나누지 않는다.
 */
const TILE_MIN_TRIANGLES = 500_000;
const TILE_DRAW_CALL_BUDGET = 200;
const TILE_GRIDS = [8, 4];
/**
 * 지오메트리 수술(단면화·평면 레이어 보호·데시메이션)을 거는 최소 삼각형 수.
 * 이보다 작은 지도(평면 한 장, 도크 하나)는 줄일 것이 없고, 한 장짜리 면은
 * 단면화하면 뒤에서 사라진다 — 텍스처와 압축만 건다.
 */
const SURGERY_MIN_TRIANGLES = 10_000;
/** 타일 스크립트가 만드는 LOD 단계 수(LOD0~3). 보고에 적는 값이다. */
const TILE_LOD_LEVELS = 4;

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
 * 다른 레이어 위에 가깝게 얹힌 평면 레이어의 높이를 띄운다 (헤더 "평면 레이어
 * 보호"). 판정은 audit-map-layers.mjs 의 overlay — 그 높이 면적의
 * OVERLAY_MIN_SHARE 이상이 `eps` 안쪽으로 겹칠 때다. `eps` 는 양자화 그리드와
 * COPLANAR_EPS 중 큰 값이다: 그리드보다 가까운 두 층은 양자화로 같은 칸에
 * 떨어질 수 있다.
 *
 * 그 높이의 정점을 **전부** 같은 양만큼 올린다. 겹친 면만 올리면 같은 표시가
 * 바닥 경계에서 꺾인다. 올리는 양은 그리드의 정수 배라 양자화 뒤 바닥과의
 * 칸 수 차가 정확히 그 배수다(round(x + k) = round(x) + k).
 *
 * 한 번 띄운 층이 그 위에 있던 층과 다시 가까워질 수 있다(지면 0 · 숲 0.1 ·
 * 도로 0.3 에서 숲을 올리면 도로와 붙는다). 더 띄울 것이 없을 때까지
 * 되풀이하되 LIFT_PASSES_MAX 에서 멈춘다 — 남은 겹침은 출력 검증이 알린다.
 *
 * 반환: 띄운 (프리미티브, 높이) 수와 한 번에 띄운 양(m), 되풀이한 횟수.
 */
function liftOverlays(doc, flatLayers) {
  const grid = quantizationGrid(doc);
  const lift = grid > 0 ? Math.ceil(OVERLAY_LIFT / grid) * grid : OVERLAY_LIFT;
  const eps = Math.max(COPLANAR_EPS, grid);

  let lifted = 0;
  let passes = 0;
  for (; passes < LIFT_PASSES_MAX; passes++) {
    const targets = overlayLevels(
      measureCoplanarOverlaps(collectLayers(doc), eps),
      flatLayers,
    );
    if (targets.size === 0) break;
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
  }
  return { lifted, lift, passes };
}

/** 문서의 삼각형 수 — 인덱스가 없는 프리미티브는 정점 수로 센다. */
function countTriangles(doc) {
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const count = indices
        ? indices.getCount()
        : (prim.getAttribute('POSITION')?.getCount() ?? 0);
      triangles += Math.floor(count / 3);
    }
  }
  return triangles;
}

/**
 * ⓪ 루트 오프셋 제거. Blender 씬에 배치된 지도를 그대로 내보내면 루트 노드의
 * translation 에 월드 좌표가 실려 온다 — 기즈모 피벗이 지도에서 수 km 떨어지고,
 * 평면 레이어 보호와 타일 스크립트가 전제하는 "루트가 원점" 도 깨진다.
 *
 * 지우는 것은 **루트 노드가 하나이고 이동만 실려 있을 때**뿐이다. 회전·스케일이
 * 섞였거나 루트가 여럿이면 한 값으로 되돌릴 수 없어 그대로 둔다. 지운 값을
 * 돌려준다(없으면 null) — 그 값을 배치 위치로 쓰면 지도가 원래 자리에 놓인다.
 * 같은 지도의 새 버전도 같은 오프셋을 달고 오므로, 매번 지워야 버전이 바뀌어도
 * 씬의 배치가 그대로 맞는다.
 */
function removeRootOffset(doc) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const roots = scene ? scene.listChildren() : [];
  if (roots.length !== 1) return null;
  const [node] = roots;
  const translation = node.getTranslation();
  const rotation = node.getRotation();
  const scale = node.getScale();
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const identityRotation =
    near(rotation[0], 0) && near(rotation[1], 0) && near(rotation[2], 0) &&
    near(Math.abs(rotation[3]), 1);
  const unitScale = scale.every((value) => near(value, 1));
  if (!identityRotation || !unitScale) return null;
  if (translation.every((value) => near(value, 0))) return null;
  node.setTranslation([0, 0, 0]);
  return translation.map((value) => +value.toFixed(3));
}

/**
 * ⓪ prepare: 루트 오프셋 제거 → 단색 텍스처 축소. 바뀐 것이 없으면 입력을
 * 그대로 다음 단계로 넘긴다(수백 MB 를 헛되이 다시 쓰지 않는다).
 */
async function prepare(io, inputPath, outputPath) {
  const doc = await io.read(inputPath);
  const rootOffset = removeRootOffset(doc);
  const { shrunk } = await shrinkFlatTextures(doc);
  if (rootOffset === null && shrunk === 0) {
    return { path: inputPath, rootOffset, shrunk };
  }
  await io.write(outputPath, doc);
  return { path: outputPath, rootOffset, shrunk };
}

/**
 * ③ surgery: CLI 커맨드로는 불가능한 머티리얼/지오메트리 수술.
 *
 * - 미사용 UV 제거: stripUnusedTexcoords 참고. weld 보다 먼저 돈다.
 * - transmission 제거: 굴절 유리를 일반 알파 블렌딩 반투명으로 바꾼다.
 *   유리 삼각형은 소수라 알파 정렬 비용은 미미하다.
 * - 단면화: 불투명 머티리얼의 doubleSided 를 풀어 래스터/레이캐스트 삼각형
 *   테스트를 절반으로 줄인다. 알파(MASK·BLEND) 머티리얼은 양면 그대로다 —
 *   잎 카드는 한 장짜리 면이라 단면화하면 절반이 사라진다.
 * - weld: 무손실 인덱스 dedup — simplify 가 프리미티브 경계를 넘어 동작하는 전제.
 * - 평면 레이어 보호: 헤더 주석 참고. 뒤집기 → 띄우기 순서이고(뒤집어야
 *   아래 향하던 표시도 겹침 측정에 잡힌다), simplify 는 평면 레이어를 건너뛴다.
 *   단면화 뒤에 돌아야 한다 — 가려진 면은 머티리얼이 단면일 때만 생긴다.
 * - meshopt: 항상 건다. 양자화로 붙을 층은 띄우기가 이미 벌려 놓았다.
 * - 출력 검증: 양자화까지 끝난 문서에서 동일 평면 겹침을 다시 잰다. 남은 얹힌
 *   표시는 돌려줄 뿐 실패시키지 않는다(헤더 "출력 검증에 걸리는 것").
 *
 * 작은 지도(SURGERY_MIN_TRIANGLES 미만)는 단면화·평면 레이어 보호·simplify 를
 * 건너뛴다(`reshaped: false`) — 모양은 올린 그대로이고 압축만 된다.
 */
async function surgery(io, inputPath, outputPath) {
  const doc = await io.read(inputPath);
  const root = doc.getRoot();
  const trianglesBefore = countTriangles(doc);
  const reshaped = trianglesBefore >= SURGERY_MIN_TRIANGLES;

  let keptDoubleSided = 0;
  for (const material of root.listMaterials()) {
    if (material.getExtension(TRANSMISSION_EXT)) {
      material.setExtension(TRANSMISSION_EXT, null);
      material.setAlphaMode('BLEND');
      const [r, g, b] = material.getBaseColorFactor();
      material.setBaseColorFactor([r, g, b, 0.5]);
      material.setRoughnessFactor(0.1);
      material.setMetallicFactor(0);
    }
    if (!reshaped) continue;
    if (material.getAlphaMode() === 'OPAQUE') {
      material.setDoubleSided(false);
    } else if (material.getDoubleSided()) {
      keptDoubleSided += 1;
    }
  }
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === TRANSMISSION_EXT) ext.dispose();
  }

  const strippedUvs = stripUnusedTexcoords(doc);
  if (strippedUvs > 0) console.log(`  미사용 UV 제거: attribute ${strippedUvs}개`);

  await doc.transform(weld());

  // 평면 레이어 보호. 양면으로 남긴 머티리얼의 면은 가려진 면이 없어 뒤집을
  // 것이 잡히지 않는다.
  const flatLayers = reshaped ? editableFlatLayers(collectLayers(doc)) : [];
  const flipped = faceOverlaysUp(doc, flatLayers);
  const { lifted, lift, passes } = liftOverlays(doc, flatLayers);

  const flatPrims = new Set(flatLayers.map((layer) => layer.prim));
  for (const mesh of reshaped ? root.listMeshes() : []) {
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
  const trianglesAfter = countTriangles(doc);

  const grid = quantizationGrid(doc);
  const clamped = clampNoisyTexcoords(doc);
  if (clamped > 0) console.log(`  UV 노이즈 클램프: accessor ${clamped}개 (허용 ${UV_CLAMP_EPS})`);
  await doc.transform(
    meshopt({ encoder: MeshoptEncoder, quantizePosition: QUANTIZE_POSITION_BITS }),
  );

  // 출력 검증: 띄우기가 못 고친 얹힌 표시(평면이 아닌 바닥과 맞물린 표시 등).
  const overlaps = measureCoplanarOverlaps(collectLayers(doc));
  const overlays = overlaps.filter(isOverlayOverlap);

  const tileGrid = pickTileGrid(doc, trianglesAfter);
  await io.write(outputPath, doc);
  return {
    grid,
    reshaped,
    flat: flatLayers.length,
    flipped,
    lifted,
    lift,
    passes,
    keptDoubleSided,
    overlaps,
    overlays,
    trianglesBefore,
    trianglesAfter,
    tileGrid,
  };
}

/**
 * ④ 타일 + LOD 로 나눌지와 격자 수. 나누지 않으면 null.
 *
 * 통짜 메시는 frustum 컬링이 걸리지 않아 어느 방위를 보든 전량 렌더된다 —
 * 삼각형이 많은 지형은 XZ 격자로 쪼개고 타일마다 LOD 를 붙인다. 다만 타일
 * 스크립트는 무텍스처 머티리얼만 정점색으로 하나로 합치고 텍스처 머티리얼은
 * 그대로 두므로, 타일당 프리미티브는 "텍스처 머티리얼 수 + (무텍스처가 있으면)
 * 1" 이다. 그 수에 타일 수를 곱한 것이 드로우콜 상한이라, 예산 안에 드는 가장
 * 촘촘한 격자를 고른다.
 */
function pickTileGrid(doc, triangles) {
  if (triangles < TILE_MIN_TRIANGLES) return null;
  const used = new Set();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial();
      if (material) used.add(material);
    }
  }
  let textured = 0;
  let plain = 0;
  for (const material of used) {
    if (listTextureInfoByMaterial(material).length > 0) textured += 1;
    else plain += 1;
  }
  const perTile = textured + (plain > 0 ? 1 : 0);
  if (perTile === 0) return null;
  return (
    TILE_GRIDS.find((grid) => grid * grid * perTile <= TILE_DRAW_CALL_BUDGET) ??
    null
  );
}

const fmtCount = (n) =>
  n >= 10_000 ? `${Math.round(n / 10_000)}만` : n.toLocaleString('ko-KR');
const fmtCm = (m) => `${(m * 100).toFixed(1)}cm`;

/**
 * 파일 하나를 최적화한다. 화면이 그대로 알릴 줄들(`lines`)과 지운 루트 오프셋
 * (`rootOffset`)을 돌려준다. 단계가 던지면 그대로 던진다 — 호출부가 실패로
 * 알리고 원본을 쓴다.
 */
async function optimizeMap(inputPath, outputPath, workDir) {
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
  // EXT_meshopt_compression 인코딩은 io.write 시점에 등록된 의존성으로 수행된다.
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const lines = [];

  const prepared = await prepare(io, inputPath, join(workDir, 'prepared.glb'));
  if (prepared.rootOffset) {
    lines.push(`루트 오프셋 (${prepared.rootOffset.join(', ')}) 제거`);
  }
  if (prepared.shrunk > 0) lines.push(`단색 텍스처 ${prepared.shrunk}장 축소`);

  const resized = join(workDir, 'resized.glb');
  const webped = join(workDir, 'webp.glb');
  const cliStages = [
    ['resize', prepared.path, resized, '--width', String(MAX_TEXTURE_SIZE), '--height', String(MAX_TEXTURE_SIZE)],
    ['webp', resized, webped, '--quality', String(LOSSY_QUALITY)],
  ];
  for (const [cmd, input, output, ...args] of cliStages) {
    execFileSync(process.execPath, [CLI, cmd, input, output, ...args], { stdio: 'pipe' });
  }

  const compressed = join(workDir, 'compressed.glb');
  const result = await surgery(io, webped, compressed);
  console.log(
    `  평면 레이어 ${result.flat}개: 뒤집은 면 ${result.flipped}개, 띄운 높이 ${result.lifted}개` +
      (result.lifted > 0 ? `(+${fmtCm(result.lift)} × ${result.passes}회)` : ''),
  );
  console.log(`  양자화 그리드 ${fmtCm(result.grid)}`);
  for (const overlap of result.overlaps) {
    console.warn(`  동일 평면 겹침: ${formatOverlap(overlap)}`);
  }
  lines.push(
    result.reshaped
      ? `삼각형 ${fmtCount(result.trianglesBefore)} → ${fmtCount(result.trianglesAfter)}`
      : `삼각형 ${fmtCount(result.trianglesBefore)}개 — 작은 지도라 모양은 그대로 두고 압축만`,
  );
  if (result.keptDoubleSided > 0) {
    lines.push(`알파 머티리얼 ${result.keptDoubleSided}개 양면 유지`);
  }
  if (result.lifted > 0) lines.push(`얹힌 표시 ${result.lifted}곳 띄움`);
  if (result.overlays.length > 0) {
    lines.push(
      `겹친 표시 ${result.overlays.length}곳이 남아 깜빡일 수 있음(원본 확인)`,
    );
  }

  let finalPath = compressed;
  if (result.tileGrid !== null) {
    const tiled = join(workDir, 'tiled.glb');
    try {
      execFileSync(
        process.execPath,
        [TILE_SCRIPT, compressed, tiled, `--grid=${result.tileGrid}`, '--lod'],
        { stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 },
      );
      finalPath = tiled;
      lines.push(
        `타일 ${result.tileGrid}×${result.tileGrid} + LOD ${TILE_LOD_LEVELS}단계`,
      );
    } catch (error) {
      // 타일로 나누지 못해도 압축까지 한 파일은 쓸 수 있다 — 통짜로 저장한다.
      console.warn(
        `  타일 분할 실패: ${error.stderr?.toString().trim() ?? error.message}`,
      );
      lines.push('타일 분할 실패 — 통짜 메시로 저장');
    }
  }

  copyFileSync(finalPath, outputPath);
  return { lines, rootOffset: prepared.rootOffset };
}

const USAGE =
  '사용법: node scripts/optimize-map.mjs --single <입력.glb> <출력.glb> [--report <json>]';

const argv = process.argv.slice(2);
if (argv[0] !== '--single') {
  console.error(USAGE);
  console.error(
    '배포 파일을 제자리에서 덮어쓰는 모드는 없다 — 지도는 자산 라이브러리에서 ' +
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

/** 화면이 읽는 보고 — `{ lines, rootOffset? }`. 실패해도 이유를 남긴다. */
function writeReport(report) {
  if (reportPath) writeFileSync(resolve(reportPath), JSON.stringify(report));
}

const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;
const workDir = mkdtempSync(join(tmpdir(), 'map-optimize-'));
try {
  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  const { lines, rootOffset } = await optimizeMap(inputPath, outputPath, workDir);
  writeReport({ lines, ...(rootOffset ? { rootOffset } : {}) });
  console.log(
    `OK    ${fmtMB(statSync(inputPath).size)} -> ${fmtMB(statSync(outputPath).size)}`,
  );
  for (const line of lines) console.log(`      ${line}`);
} catch (error) {
  const message = error.stderr?.toString().trim() || error.message;
  writeReport({ lines: [`최적화 실패: ${message.split('\n').pop()}`] });
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
