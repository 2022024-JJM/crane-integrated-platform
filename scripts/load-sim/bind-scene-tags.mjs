#!/usr/bin/env node
/**
 * 씬의 모든 크레인 모델에 태그 맵핑을 넣는다 — 부하 테스트에서 "크레인 전부가
 * 움직이는" 상태를 만들기 위한 일회성 생성기. 이미 맵핑·레거시 valueMapList 가
 * 있는 모델은 건드리지 않는다(멱등).
 *
 *   node scripts/load-sim/bind-scene-tags.mjs [--dry]
 *
 * 규칙
 * - 크레인 판정: equipName 이 비어 있지 않고 자산 id 가 블록·선체·베이가 아님.
 * - craneId: 기존 값 > equipName('-'→'_', 공백→'_'). 중복이면 모델 id 꼬리를 붙인다.
 * - 리그가 없는 GLB 에는 SIM_RIGS 표의 리그(`rig-sim-*`)를 씬 rigs[] 에 넣고 모델에
 *   할당한다 — TC·TTC 상부 선회(마스트 피벗), 골리앗 트롤리 주행. 사람이 만든
 *   옥포 OC 리그에는 상부 선회 관절(`joint-sim-slew`)만 보탠다.
 * - 리그가 있으면: 구속조건의 출력(driven)이 아닌 관절마다 `${craneId}:${label}` joint 맵핑.
 * - 루트: 모든 크레인은 주행축 position `gantry_position` 하나다. 루트를
 *   회전시키면 레일 위 크레인이 레일을 벗어나므로 루트 rotation 맵핑은 만들지
 *   않는다(선회는 리그 관절이 있을 때만). 루트 position Δ 는 부모(월드) 축에
 *   더해지므로(apply-channel.ts 의 `node.position[axis] +=`) 주행축은 **월드**
 *   기준으로 정해야 하고 배치 회전(rotation.y)은 보지 않는다.
 *   레일은 직선이라 같은 레일의 크레인은 x 나 z 한 좌표를 공유한다 — 씬 안의 다른
 *   크레인 중 z 가 같은 것이 많으면 x 축, x 가 같은 것이 많으면 z 축이다. 이웃이
 *   없으면 GLB 바운딩 박스의 짧은 수평축으로 떨어진다.
 * 생성 id 는 `map-sim-<n>` 이다. 이 스크립트가 만든 맵핑(`map-sim-*` 만 있는
 * 모델)은 다시 돌리면 교체되고, 사람이 만든 맵핑·레거시는 건드리지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { SCENES_DIR, SCENE_FILES } from './scene-tags.mjs';

const dry = process.argv.includes('--dry');
const PUBLIC_DIR = path.resolve('apps/shell/public');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const travelAxisCache = new Map();

const RAIL_EXACT = 6; // m — 한 레일 위로 확실한 좌표 차
const RAIL_LOOSE = 25; // m — 같은 열로 볼 만한 좌표 차
const RAIL_MIN_GAP = 30; // m — 이보다 가까우면 바로 옆 다른 장비라 이웃으로 안 센다

/**
 * 씬 배치에서 월드 주행축. 같은 레일(한 좌표 공유)에 선 이웃을 점수로 센다 —
 * 정확히 같은 좌표는 3점, 비슷한 좌표는 1점. 동점이면 null.
 */
function travelAxisFromLayout(model, cranes) {
  const [x, , z] = model.position ?? [0, 0, 0];
  let alongX = 0;
  let alongZ = 0;
  for (const o of cranes) {
    if (o === model) continue;
    const [ox, , oz] = o.position ?? [0, 0, 0];
    const dx = Math.abs(ox - x);
    const dz = Math.abs(oz - z);
    if (dx > RAIL_MIN_GAP)
      alongX += dz < RAIL_EXACT ? 3 : dz < RAIL_LOOSE ? 1 : 0;
    if (dz > RAIL_MIN_GAP)
      alongZ += dx < RAIL_EXACT ? 3 : dx < RAIL_LOOSE ? 1 : 0;
  }
  if (alongX === alongZ) return null;
  return alongX > alongZ ? 'x' : 'z';
}

/** 동점인 크레인은 가장 가까운 '결정된' 크레인의 축을 따른다. */
function travelAxisFromNeighbor(model, decided) {
  const [x, , z] = model.position ?? [0, 0, 0];
  let best = null;
  for (const [o, axis] of decided) {
    const [ox, , oz] = o.position ?? [0, 0, 0];
    const d = Math.hypot(ox - x, oz - z);
    if (!best || d < best.d) best = { d, axis };
  }
  return best && best.d < 300 ? best.axis : null;
}

/** GLB 폴백: 수평 두 축 중 짧은 쪽. 못 읽으면 z. */
async function travelAxisOf(modelPath) {
  if (travelAxisCache.has(modelPath)) return travelAxisCache.get(modelPath);
  let axis = 'z';
  try {
    const doc = await io.read(path.join(PUBLIC_DIR, modelPath));
    const b = getBounds(doc.getRoot().listScenes()[0]);
    const sx = b.max[0] - b.min[0];
    const sz = b.max[2] - b.min[2];
    axis = sx < sz ? 'x' : 'z';
  } catch (e) {
    console.warn(`  ${modelPath}: bounds 읽기 실패, z 사용 (${e.message})`);
  }
  travelAxisCache.set(modelPath, axis);
  return axis;
}
const NOT_CRANE_ASSET = /block|lngc|bay|ship|hull|terrain|map/i;

/**
 * GLB 별 시뮬레이션 리그. 노드 경로는 mesh-path 형식(`[index]name`)이고 이름은
 * three GLTFLoader 가 정리한 것(공백→`_`, `.` 제거)이다. pivot 은 부모 프레임
 * 좌표 — 타워크레인 상부는 Blender 원점이 지브 중앙이라 마스트 축을 따로 준다.
 */
const SIM_RIGS = {
  '/asset-library/files/okpo-tc/v2/TC-Crane_Okpo.glb': {
    id: 'rig-sim-okpo-tc',
    name: 'TC (sim)',
    joints: [
      {
        id: 'slew',
        label: 'slew',
        node: '[0]TC_크레인/[1]TC_Top',
        type: 'hinge',
        axis: 'y',
        min: -180,
        max: 180,
        pivot: [0.3, 34.5, 0],
      },
    ],
    constraints: [],
  },
  '/asset-library/files/okpo-ttc/v2/TTC-Crane_Okpo.glb': {
    id: 'rig-sim-okpo-ttc',
    name: 'TTC (sim)',
    joints: [
      {
        id: 'slew',
        label: 'slew',
        node: '[0]TTC_크레인/[1]TTC_Top',
        type: 'hinge',
        axis: 'y',
        min: -180,
        max: 180,
        pivot: [0, 59.2, 0],
      },
    ],
    constraints: [],
  },
  '/asset-library/files/okpo-goliath/v3/Okpo_Goliath.glb': {
    id: 'rig-sim-okpo-goliath',
    name: 'Goliath (sim)',
    joints: [
      {
        id: 'trolley',
        label: 'trolley',
        node: '[0]Goliath/[1]Trolly_Goliath_001',
        type: 'slide',
        axis: 'z',
        min: -25,
        max: 110,
      },
      {
        id: 'hoist',
        label: 'hoist',
        node: '[0]Goliath/[2]Trolly_Goliath_002',
        type: 'slide',
        axis: 'z',
      },
    ],
    constraints: [
      {
        type: 'linear',
        id: 'hoist-follows',
        input: 'trolley',
        output: 'hoist',
        factor: 1,
      },
    ],
  },
  '/models/goliath_crane.glb': {
    id: 'rig-sim-goliath',
    name: 'Goliath (sim)',
    joints: [
      {
        id: 'trolley',
        label: 'trolley',
        node: '[0]Goliath/[1]Goliath_Crane_Trolley_01',
        type: 'slide',
        axis: 'x',
        min: -95,
        max: 15,
      },
      {
        id: 'hoist',
        label: 'hoist',
        node: '[0]Goliath/[2]Goliath_Crane_Trolley_02',
        type: 'slide',
        axis: 'x',
      },
    ],
    constraints: [
      {
        type: 'linear',
        id: 'hoist-follows',
        input: 'trolley',
        output: 'hoist',
        factor: 1,
      },
    ],
  },
};
/** 사람이 만든 옥포 OC 리그에 보태는 상부 선회 관절. */
const OC_SLEW_JOINT = {
  id: 'joint-sim-slew',
  label: 'slew',
  node: '[0]OC_크레인/[0]Base/[0]Top',
  type: 'hinge',
  axis: 'y',
  min: -180,
  max: 180,
};
const OC_GLB = /okpo[-_]oc/i;
/** 주행하지 않는 고정식 크레인 — 루트 맵핑을 만들지 않는다. */
const FIXED_FAMILY = /^TC(_|$)/i;

function toCraneId(name) {
  return name
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toUpperCase();
}

let total = 0;
for (const file of SCENE_FILES) {
  const full = path.join(SCENES_DIR, file);
  if (!fs.existsSync(full)) continue;
  const scene = JSON.parse(fs.readFileSync(full, 'utf8'));
  scene.rigs = (scene.rigs ?? []).filter(
    (r) => !String(r.id).startsWith('rig-sim-'),
  );
  for (const [modelPath, def] of Object.entries(SIM_RIGS)) {
    if (!(scene.models ?? []).some((m) => m.path === modelPath)) continue;
    scene.rigs.push({ ...def, modelPath });
  }
  const ocRig = scene.rigs.find(
    (r) => OC_GLB.test(r.modelPath) && !r.id.startsWith('rig-sim-'),
  );
  if (ocRig && !ocRig.joints.some((j) => j.id === OC_SLEW_JOINT.id)) {
    ocRig.joints.push({ ...OC_SLEW_JOINT });
  }
  const rigs = new Map(scene.rigs.map((r) => [r.id, r]));
  const rigForPath = (p) =>
    SIM_RIGS[p]?.id ?? (OC_GLB.test(p) && ocRig ? ocRig.id : undefined);
  const used = new Set(
    (scene.models ?? [])
      .map((m) => m.craneId)
      .filter((v) => typeof v === 'string'),
  );
  let added = 0;
  let n = 0;
  const isCrane = (model) => {
    const name = typeof model.equipName === 'string' ? model.equipName : '';
    const assetId = model.asset?.id ?? model.path ?? '';
    return Boolean(name.trim()) && !NOT_CRANE_ASSET.test(assetId);
  };
  const cranes = (scene.models ?? []).filter(isCrane);
  const decided = new Map();
  for (const c of cranes) {
    const a = travelAxisFromLayout(c, cranes);
    if (a) decided.set(c, a);
  }

  for (const model of scene.models ?? []) {
    const name = typeof model.equipName === 'string' ? model.equipName : '';
    if (!isCrane(model)) continue;
    const existing = model.tagMappings ?? [];
    const simOnly =
      existing.length > 0 &&
      existing.every((m) => String(m.id).startsWith('map-sim-'));
    if ((existing.length && !simOnly) || (model.valueMapList ?? []).length)
      continue;

    if (!model.rigId && rigForPath(model.path ?? ''))
      model.rigId = rigForPath(model.path);
    let craneId =
      typeof model.craneId === 'string' && model.craneId
        ? model.craneId
        : toCraneId(name);
    if (used.has(craneId))
      craneId = `${craneId}_${String(model.id)
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(-4)
        .toUpperCase()}`;
    used.add(craneId);

    const mappings = [];
    const rig = model.rigId ? rigs.get(model.rigId) : undefined;
    if (rig) {
      const driven = new Set((rig.constraints ?? []).map((c) => c.output));
      for (const joint of rig.joints ?? []) {
        if (driven.has(joint.id)) continue;
        const code = toCraneId(joint.label || joint.id).toLowerCase();
        mappings.push({
          id: `map-sim-${++n}`,
          target: { kind: 'joint', jointId: joint.id },
          tagKey: `${craneId}:${code}`,
          caption: (joint.label || 'joint').slice(0, 12),
        });
      }
    }
    if (FIXED_FAMILY.test(craneId)) {
      console.log(`  ${file} ${craneId}: 고정식(주행 없음)`);
    } else {
      const layoutAxis = decided.get(model) ?? null;
      const neighborAxis = layoutAxis
        ? null
        : travelAxisFromNeighbor(model, decided);
      const axis =
        layoutAxis ?? neighborAxis ?? (await travelAxisOf(model.path ?? ''));
      mappings.push({
        id: `map-sim-${++n}`,
        target: { kind: 'node', node: '', channel: 'position', axis },
        tagKey: `${craneId}:gantry_position`,
        caption: '주행',
      });
      console.log(
        `  ${file} ${craneId}: 주행축 ${axis} (${layoutAxis ? '배치' : neighborAxis ? '이웃' : 'GLB'})`,
      );
    }
    model.tagMappings = mappings;
    added += mappings.length;
  }

  console.log(`${file}: +${added} mappings${dry ? ' (dry)' : ''}`);
  total += added;
  if (scene.rigs.length === 0) delete scene.rigs;
  if (!dry && added > 0)
    fs.writeFileSync(full, JSON.stringify(scene, null, 2) + '\n');
}
console.log(`total +${total}`);
