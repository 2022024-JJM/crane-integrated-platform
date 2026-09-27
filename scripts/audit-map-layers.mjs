// 지도 GLB 의 "동일 평면 겹침" 검사.
//
// 서로 다른 프리미티브의 면이 같은 높이에서 XZ 로 겹치는 면적을 잰다. 겹친
// 두 면은 깊이가 같아 픽셀마다 승자가 계산 오차로 갈리고(z-fighting), 카메라가
// 움직이는 동안 반짝이다 멈추면 얼룩진 채 굳는다. 간격이 있는 층은 로그 깊이가
// 가르지만 **간격이 0 인 겹침은 깊이 정밀도로 풀리지 않는다.**
//
// 사용법:
//   node scripts/audit-map-layers.mjs apps/shell/public/maps/okpo.glb [...]
//
// optimize-map.mjs 가 같은 함수로 얹힌 표시를 찾아 띄우고 출력을 검증한다.
// 배포본만 따로 볼 때 이 스크립트를 직접 돌린다. 항상 exit 0 — 진단 도구다.
//
// 출력의 "← 얹힌 표시" 는 평면 레이어(차선·횡단보도처럼 전부 수평면인
// 프리미티브)의 한 높이가 통째로 다른 레이어 위에 같은 높이로 놓였다는 뜻이다.
// 배포본에 이 표식이 있으면 그 표시가 화면에서 깜빡인다. 표식 없는 줄은 건물
// 모서리·타일 이음매의 국소 겹침이다.
//
// 재는 방법: 위에서 보이는 면(위를 향하거나 머티리얼이 양면)을 전부 XZ 격자에
// 넣고, 각 면 위에 표본점을 찍어 그 점을 덮는 **다른 프리미티브**의 면을
// 찾는다. 두 면의 그 지점 높이 차가 COPLANAR_EPS 미만이면 겹침으로 센다.
// 높이는 면 위에서 보간하므로 경사면도 같은 식으로 잡힌다.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

/**
 * 이보다 가까운 두 면은 같은 평면으로 본다(m). 최대 줌아웃(camera-limits.ts
 * CAMERA_MAX_DISTANCE)에서 로그 깊이 24bit 가 가르는 간격이 약 2cm 다.
 */
export const COPLANAR_EPS = 0.02;
/** 세 정점의 높이 차가 이 안이면 수평면이다(m). */
export const LEVEL_EPS = 0.001;
/** 이 면적 미만의 겹침은 보고하지 않는다(m²) — 타일 이음매의 실낱 겹침. */
export const REPORT_MIN_AREA = 1;
/**
 * 평면 레이어의 한 높이 면적 중 이 비율 이상이 다른 레이어와 동일 평면으로
 * 겹치면 그 높이를 얹힌 표시로 본다. 맞물린 타일의 이음매 겹침(1% 미만)과
 * 바닥 위에 놓인 표시(수십 %)를 가른다.
 */
export const OVERLAY_MIN_SHARE = 0.05;

/** 표본점 하나가 대표하는 면적의 목표 상한(m²). */
const SAMPLE_AREA = 0.25;
/** 삼각형 한 변의 최대 분할 수 — 표본점은 분할 수의 제곱이다. */
const MAX_SUBDIVISION = 16;
/** XZ 격자 한 칸(m). */
const CELL = 8;
/** 연직에 가까운 면(벽)은 XZ 면적이 없어 겹침 대상이 아니다. */
const MIN_NORMAL_Y = 0.2;

/**
 * 프리미티브별로 면을 월드 좌표로 모은다.
 *
 * faces 는 위에서 보이는 면(위를 향하거나 머티리얼이 양면), hiddenFaces 는
 * 단면 머티리얼의 아래 향한 면(위에서 컬링된다)이다.
 * flat: 퇴화하지 않은 삼각형이 전부 수평면인 프리미티브(차선·아스팔트 같은
 * 평면 레이어). LOD>0 노드(tile-terrain-glb.mjs, add-model-lod.mjs 의 extras)
 * 는 LOD0 과 같은 자리를 덮는 사본이라 건너뛴다.
 */
export function collectLayers(doc) {
  const layers = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if ((node.getExtras()?.lod ?? 0) > 0) continue;
    const m = node.getWorldMatrix();
    // 거울상 변환은 렌더러가 앞면 판정을 뒤집는다(three 는 determinant 부호를 본다).
    const mirrored =
      m[0] * (m[5] * m[10] - m[6] * m[9]) -
        m[4] * (m[1] * m[10] - m[2] * m[9]) +
        m[8] * (m[1] * m[6] - m[2] * m[5]) <
      0;
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (!position || prim.getMode() !== 4) continue;
      const material = prim.getMaterial();
      const doubleSided = material?.getDoubleSided() ?? false;
      const count = position.getCount();
      const world = new Float64Array(count * 3);
      const el = [0, 0, 0];
      for (let v = 0; v < count; v++) {
        position.getElement(v, el);
        world[v * 3] = m[0] * el[0] + m[4] * el[1] + m[8] * el[2] + m[12];
        world[v * 3 + 1] = m[1] * el[0] + m[5] * el[1] + m[9] * el[2] + m[13];
        world[v * 3 + 2] = m[2] * el[0] + m[6] * el[1] + m[10] * el[2] + m[14];
      }
      const indices = prim.getIndices()?.getArray();
      const triangleCount = (indices ? indices.length : count) / 3;
      const faces = [];
      const hiddenFaces = [];
      let flat = true;
      let solid = 0;
      for (let t = 0; t < triangleCount; t++) {
        const a = (indices ? indices[t * 3] : t * 3) * 3;
        const b = (indices ? indices[t * 3 + 1] : t * 3 + 1) * 3;
        const c = (indices ? indices[t * 3 + 2] : t * 3 + 2) * 3;
        const ux = world[b] - world[a];
        const uy = world[b + 1] - world[a + 1];
        const uz = world[b + 2] - world[a + 2];
        const vx = world[c] - world[a];
        const vy = world[c + 1] - world[a + 1];
        const vz = world[c + 2] - world[a + 2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const length = Math.hypot(nx, ny, nz);
        if (length < 1e-9) continue;
        solid++;
        const ya = world[a + 1];
        const yb = world[b + 1];
        const yc = world[c + 1];
        const horizontal =
          Math.max(ya, yb, yc) - Math.min(ya, yb, yc) <= LEVEL_EPS;
        if (!horizontal) flat = false;
        if (Math.abs(ny) / length < MIN_NORMAL_Y) continue;
        const up = mirrored ? ny < 0 : ny > 0;
        (up || doubleSided ? faces : hiddenFaces).push({
          ax: world[a],
          az: world[a + 2],
          ay: ya,
          bx: world[b],
          bz: world[b + 2],
          by: yb,
          cx: world[c],
          cz: world[c + 2],
          cy: yc,
          area: Math.abs(ny) / 2,
          level: horizontal ? Math.round(ya * 1000) : null,
        });
      }
      layers.push({
        node,
        mesh,
        prim,
        name: material?.getName() || '(머티리얼 없음)',
        flat: flat && solid > 0,
        faces,
        hiddenFaces,
        area: faces.reduce((sum, face) => sum + face.area, 0),
      });
    }
  }
  return layers;
}

/** 면 위 XZ 지점의 높이. 면 밖이면 null. */
function heightAt(face, x, z) {
  const d =
    (face.bz - face.cz) * (face.ax - face.cx) +
    (face.cx - face.bx) * (face.az - face.cz);
  if (d === 0) return null;
  const wa =
    ((face.bz - face.cz) * (x - face.cx) + (face.cx - face.bx) * (z - face.cz)) /
    d;
  const wb =
    ((face.cz - face.az) * (x - face.cx) + (face.ax - face.cx) * (z - face.cz)) /
    d;
  const wc = 1 - wa - wb;
  if (wa < 0 || wb < 0 || wc < 0) return null;
  return wa * face.ay + wb * face.by + wc * face.cy;
}

/** 수평면 높이(mm 반올림)별 면적. */
function levelAreas(faces) {
  const areas = new Map();
  for (const face of faces) {
    if (face.level === null) continue;
    areas.set(face.level, (areas.get(face.level) ?? 0) + face.area);
  }
  return areas;
}

/**
 * overs[i] 의 면 위에 표본점을 찍어, 그 점을 덮는 unders(자기 레이어 제외)의
 * 면 중 accept(표본 높이 − 면 높이) 를 통과하는 것을 센다.
 *
 * 반환: Map<`${overIndex}>${underIndex}`, { area, levels: Map<level, { area, base }> }>
 */
function sampleOverlaps(layers, overFaces, accept) {
  const grid = new Map();
  layers.forEach((layer, layerIndex) => {
    for (const face of layer.faces) {
      const x0 = Math.floor(Math.min(face.ax, face.bx, face.cx) / CELL);
      const x1 = Math.floor(Math.max(face.ax, face.bx, face.cx) / CELL);
      const z0 = Math.floor(Math.min(face.az, face.bz, face.cz) / CELL);
      const z1 = Math.floor(Math.max(face.az, face.bz, face.cz) / CELL);
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const key = x * 1048576 + z;
          let cell = grid.get(key);
          if (!cell) {
            cell = [];
            grid.set(key, cell);
          }
          cell.push(layerIndex, face);
        }
      }
    }
  });

  const pairs = new Map();
  layers.forEach((layer, layerIndex) => {
    for (const face of overFaces(layer)) {
      const n = Math.min(
        MAX_SUBDIVISION,
        Math.max(1, Math.ceil(Math.sqrt(face.area / SAMPLE_AREA))),
      );
      const weight = face.area / (n * n);
      // 한 변을 n 등분한 작은 삼각형 n² 개의 무게중심이 표본점이다.
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - i; j++) {
          for (let flip = 0; flip < 2; flip++) {
            if (flip === 1 && j === n - i - 1) continue;
            const u = (i + (flip ? 2 / 3 : 1 / 3)) / n;
            const v = (j + (flip ? 2 / 3 : 1 / 3)) / n;
            const w = 1 - u - v;
            const x = w * face.ax + u * face.bx + v * face.cx;
            const z = w * face.az + u * face.bz + v * face.cz;
            const y = w * face.ay + u * face.by + v * face.cy;
            const cell = grid.get(
              Math.floor(x / CELL) * 1048576 + Math.floor(z / CELL),
            );
            if (!cell) continue;
            const hit = new Map();
            for (let k = 0; k < cell.length; k += 2) {
              const other = cell[k];
              if (other === layerIndex) continue;
              const height = heightAt(cell[k + 1], x, z);
              if (height === null || !accept(y - height)) continue;
              hit.set(other, Math.max(hit.get(other) ?? -Infinity, height));
            }
            for (const [other, height] of hit) {
              const key = `${layerIndex}>${other}`;
              let pair = pairs.get(key);
              if (!pair) {
                pair = { area: 0, levels: new Map() };
                pairs.set(key, pair);
              }
              pair.area += weight;
              if (face.level !== null) {
                const entry = pair.levels.get(face.level) ?? {
                  area: 0,
                  base: -Infinity,
                };
                entry.area += weight;
                entry.base = Math.max(entry.base, height);
                pair.levels.set(face.level, entry);
              }
            }
          }
        }
      }
    }
  });
  return pairs;
}

/** 표본 결과의 높이별 집계를 얹힌 표시 판정과 함께 정리한다. */
function summarizeLevels(pair, layer, areas) {
  return [...pair.levels.entries()]
    .map(([level, entry]) => {
      const share = entry.area / areas.get(level);
      return {
        level: level / 1000,
        area: entry.area,
        share,
        base: entry.base,
        overlay:
          layer.flat &&
          entry.area >= REPORT_MIN_AREA &&
          share >= OVERLAY_MIN_SHARE,
      };
    })
    .sort((a, b) => b.area - a.area);
}

/**
 * 프리미티브 쌍별 동일 평면 겹침.
 *
 * 반환: [{ over, under, area, levels }] — over 는 쌍 중 면적이 작은 쪽(얹힌
 * 쪽)이다. levels 는 over 의 수평면 높이별 { level(m), area, share(그 높이
 * 면적 중 겹친 비율), base(그 아래 under 의 최고 높이), overlay(얹힌 표시
 * 판정) } 이다. 면적은 over 쪽 표본으로 추정한다.
 */
export function measureCoplanarOverlaps(layers, eps = COPLANAR_EPS) {
  const pairs = sampleOverlaps(
    layers,
    (layer) => layer.faces,
    (gap) => Math.abs(gap) < eps,
  );
  const areas = layers.map((layer) => levelAreas(layer.faces));
  const result = [];
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      const [over, under] =
        layers[i].area <= layers[j].area ? [i, j] : [j, i];
      const pair = pairs.get(`${over}>${under}`);
      if (!pair || pair.area < REPORT_MIN_AREA) continue;
      result.push({
        over: layers[over],
        under: layers[under],
        area: pair.area,
        levels: summarizeLevels(pair, layers[over], areas[over]),
      });
    }
  }
  return result.sort((a, b) => b.area - a.area);
}

/**
 * 위에서 안 보이는(아래 향한) 면 중 다른 레이어의 윗면 위 reach 안쪽에 놓인 것.
 *
 * 바닥에 얹은 표시인데 면이 뒤집혀 단면화로 사라진 경우를 찾는다. 아래에
 * 받치는 면이 없는 아래 향한 면(지도에 딸려 온 바다 평면 등)은 잡지 않는다.
 * 반환 형식은 measureCoplanarOverlaps 와 같고 over 는 가려진 쪽이다.
 */
export function measureHiddenOverlays(layers, reach) {
  const pairs = sampleOverlaps(
    layers,
    (layer) => layer.hiddenFaces,
    (gap) => gap > -COPLANAR_EPS && gap < reach,
  );
  const result = [];
  layers.forEach((layer, over) => {
    const areas = levelAreas(layer.hiddenFaces);
    layers.forEach((base, under) => {
      const pair = pairs.get(`${over}>${under}`);
      if (!pair || pair.area < REPORT_MIN_AREA) return;
      result.push({
        over: layer,
        under: base,
        area: pair.area,
        levels: summarizeLevels(pair, layer, areas),
      });
    });
  });
  return result.sort((a, b) => b.area - a.area);
}

/** 얹힌 표시로 판정된 높이가 하나라도 있는 겹침인가. */
export function isOverlayOverlap(overlap) {
  return overlap.levels.some((level) => level.overlay);
}

export function formatOverlap(overlap) {
  const levels = overlap.levels
    .slice(0, 3)
    .map(({ level, area, share, base }) => {
      const gap = Math.round((level - base) * 1000);
      return `${level.toFixed(3)}m(간격 ${gap}mm, ${area.toFixed(0)}m², 그 높이의 ${(share * 100).toFixed(0)}%)`;
    })
    .join(' ');
  return (
    `${overlap.over.name} × ${overlap.under.name}: ${overlap.area.toFixed(0)}m²` +
    (levels ? `  ${levels}` : '') +
    (isOverlayOverlap(overlap) ? '  ← 얹힌 표시' : '')
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('사용법: node scripts/audit-map-layers.mjs <glb 경로> [...]');
    process.exit(1);
  }
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const file of files) {
    const layers = collectLayers(await io.read(file));
    const overlaps = measureCoplanarOverlaps(layers);
    console.log(`== ${file}`);
    console.log(
      `   평면 레이어: ${
        layers
          .filter((layer) => layer.flat)
          .map((layer) => layer.name)
          .join(', ') || '없음'
      }`,
    );
    if (overlaps.length === 0) {
      console.log('   동일 평면 겹침 없음');
      continue;
    }
    for (const overlap of overlaps) console.log(`   ${formatOverlap(overlap)}`);
  }
}
