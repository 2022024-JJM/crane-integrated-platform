// 모델 GLB 에 거리별 LOD 체인 추가 (가까이는 원본, 멀리는 데시메이션).
//
// 사용법:
//   node scripts/add-model-lod.mjs <파일명.glb>   # assets-src/models/ 의 현재본에 LOD 추가
//   이어서 반드시: pnpm optimize:glb <파일명.glb> # public 으로 압축 배포
//
// 왜:
//   타워크레인 한 기가 11만~17만 삼각형인데 관제 시점(300m 안팎)에선 그
//   세부가 화면 픽셀 아래로 사라진다. 모델은 계속 늘어나므로 "가까이서 볼
//   때만 원본" 이 모델 수에 비례하는 비용을 잡는 유일한 길이다(2026-09-11,
//   "핵심인 지도와 크레인이 잘 보이면 된다" — 화질은 근접 시점에서 지킨다).
//
// 구조 (지형 타일 LOD 와 같은 계약 — packages/features/src/3d/ui/scene-terrain-lod.tsx):
//   메시가 달린 노드마다 **형제 노드** `<이름>-lod<N>` 을 같은 부모의 자식
//   목록 **끝에** 붙인다. extras { lodGroup:<그룹키>, lod:N, lodError:<m> },
//   원본 노드에도 { lodGroup, lod:0, lodError:0 } 을 넣는다. 끝에 붙이므로
//   기존 노드의 `[index]name` 메쉬 경로(mesh-path.ts)는 변하지 않는다.
//   LOD 프리미티브는 정점 accessor 를 원본과 공유하고 인덱스만 새로 만든다
//   (tile-terrain-glb.mjs 와 같은 shadow-weld → simplify → 실 정점 되매핑).
//   런타임은 LOD>0 노드를 clone 시점에 숨기고 raycast·BVH·실루엣에서 빼며,
//   거리·화면 오차(TERRAIN_LOD_THRESHOLD_PX)로 레벨을 고른다.
//
// ⚠️ 실행 전 확인 — 하나라도 해당하면 거부한다(스크립트가 전 씬을 역스캔):
//   - 어떤 씬이든 이 모델에 meshOverrides 가 있다 (LOD 사본은 override 를 못 받는다)
//   - 어떤 씬이든 내부 노드 대상 tagMappings(node !== '')·rigId 가 있다
//     (LOD 사본은 관절·내부 노드 구동을 따라가지 못한다. 루트 맵핑은 무관)
//   - GLB 에 skin·animation 이 있다
//   join-static-glb.mjs 의 금지 조건과 같다. 이미 LOD 가 있으면 거부한다(멱등 아님).
//
// 동작:
//   1. assets-src/models/<파일>(현재본)을 읽는다. LOD 전 원본을 <파일>.nolod 로
//      보존한다(이미 있으면 건너뜀 — .glb 가 아니라 optimize:glb 대상이 아니다).
//      자산을 새 버전으로 교체할 때는 옛 .nolod 를 함께 지운다.
//   2. 노드별 삼각형이 MIN_NODE_TRIS 이상인 메시 노드에 LOD_LEVELS 를 만든다.
//      각 레벨은 목표 비율(ratio)까지 줄이되 상대 오차(maxError, 메시 크기 대비)를
//      넘지 않는다. lodError(extras)는 달성 오차 × 메시 크기 × 노드 월드 스케일
//      = 절대 미터 상한이다. 직전 레벨 대비 90% 넘게 남으면 그 레벨은 생략.
//   3. 결과를 assets-src/models/<파일> 에 덮어쓴다 → pnpm optimize:glb 로 배포.
import { copyFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  MeshoptDecoder,
  MeshoptEncoder,
  MeshoptSimplifier,
} from 'meshoptimizer';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = join(repoRoot, 'assets-src/models');
const SCENES_DIR = join(repoRoot, 'apps/shell/public/scenes');

/** 이보다 작은 노드는 LOD 를 만들지 않는다 — 블록·소품은 이득이 없다. */
const MIN_NODE_TRIS = 5000;
/** 프리미티브 단위 하한 — 이 아래는 원본 인덱스를 그대로 LOD 메시에 넣는다. */
const MIN_PRIM_TRIS = 500;
/**
 * LOD 티어. ratio 는 목표 잔존 비율, maxError 는 메시 최대 폭 대비 상대 오차
 * 상한(meshopt 규약: getScale 기준). 100m 크레인이면 0.5% = 0.5m — 화면
 * 오차 2.5px 기준으로 약 300m 부터 LOD1, 1km 부터 LOD2.
 */
const LOD_LEVELS = [
  { lod: 1, ratio: 0.35, maxError: 0.005 },
  { lod: 2, ratio: 0.12, maxError: 0.02 },
  { lod: 3, ratio: 0.05, maxError: 0.05 },
];
/** 직전 레벨 대비 이 비율 넘게 남으면 그 레벨은 무의미 — 생략. */
const MIN_GAIN_RATIO = 0.9;

const file = process.argv[2];
if (!file || !file.endsWith('.glb')) {
  console.error('사용법: node scripts/add-model-lod.mjs <파일명.glb>');
  process.exit(1);
}
const backupPath = join(BACKUP_DIR, file);
if (!existsSync(backupPath)) {
  console.error(
    `원본 백업본이 없습니다: ${backupPath}\n` +
      '신규 모델이면 먼저 pnpm optimize:glb 로 반입해 백업본을 만든 뒤 실행하세요.',
  );
  process.exit(1);
}

// ── 전 씬 역스캔: 계층 참조가 있으면 거부 ──────────────────────────────────
const modelPath = `/models/${file}`;
const blockers = new Map();
const addBlocker = (reason, scene) => {
  const set = blockers.get(reason) ?? new Set();
  set.add(scene);
  blockers.set(reason, set);
};
for (const sceneFile of readdirSync(SCENES_DIR).filter((f) =>
  f.endsWith('.json'),
)) {
  let scene;
  try {
    scene = JSON.parse(readFileSync(join(SCENES_DIR, sceneFile), 'utf8'));
  } catch {
    continue;
  }
  const sceneName = sceneFile.replace(/\.json$/, '');
  for (const m of scene.models ?? []) {
    if (m.path !== modelPath) continue;
    if (Array.isArray(m.meshOverrides) && m.meshOverrides.length > 0) {
      addBlocker('meshOverrides', sceneName);
    }
    if (m.rigId) addBlocker('rigId', sceneName);
    if (Array.isArray(m.rigBindings) && m.rigBindings.length > 0) {
      addBlocker('rigBindings', sceneName);
    }
    for (const t of m.tagMappings ?? []) {
      const target = t?.target;
      if (!target) continue;
      if (target.kind === 'joint') addBlocker('joint tagMapping', sceneName);
      if (target.kind === 'node' && target.node)
        addBlocker('내부 노드 tagMapping', sceneName);
    }
  }
}
if (blockers.size > 0) {
  const reasons = [...blockers.entries()]
    .map(([reason, scenes]) => `${reason}(${[...scenes].sort().join(', ')})`)
    .join(' · ');
  console.error(
    `LOD 불가: ${reasons} — LOD 사본은 override·관절·내부 노드 구동을 따라가지 못합니다.`,
  );
  process.exit(1);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

const doc = await io.read(backupPath);
const root = doc.getRoot();

if (root.listSkins().length > 0 || root.listAnimations().length > 0) {
  console.error('LOD 불가: skin/animation 이 있는 GLB 입니다.');
  process.exit(1);
}
for (const node of root.listNodes()) {
  const extras = node.getExtras();
  if (extras && typeof extras.lod === 'number') {
    console.error(
      `이미 LOD 가 있는 파일입니다(${node.getName()}). 재실행하려면 .nolod 원본을 되돌리세요.`,
    );
    process.exit(1);
  }
}

// ── 유틸 ────────────────────────────────────────────────────────────────────
const buffer = root.listBuffers()[0] ?? doc.createBuffer();
const primTriCount = (prim) => {
  const idx = prim.getIndices();
  const pos = prim.getAttribute('POSITION');
  const count = idx ? idx.getCount() : pos ? pos.getCount() : 0;
  return Math.floor(count / 3);
};
const nodeTriCount = (node) => {
  const mesh = node.getMesh();
  if (!mesh) return 0;
  return mesh.listPrimitives().reduce((sum, p) => sum + primTriCount(p), 0);
};
const worldMaxScale = (node) => {
  const m = node.getWorldMatrix();
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  return Math.max(sx, sy, sz) || 1;
};
const parentOf = (node) => node.getParentNode();
const sceneOf = (node) =>
  root.listScenes().find((s) => s.listChildren().includes(node)) ?? null;

/**
 * simplify 입력 준비 — tile-terrain-glb.mjs 의 shadow weld 와 같은 원리.
 * 위치(+텍스처 UV, 정점색)가 같은 wedge 를 하나로 합쳐 simplify 하고, 살아남은
 * 삼각형은 원본 wedge 로 되매핑한다(위치·UV·색 정확, 노멀만 국소 변화).
 */
function prepare(prim) {
  const posAcc = prim.getAttribute('POSITION');
  const vertCount = posAcc.getCount();
  const mat = prim.getMaterial();
  const hasTexture = !!(
    mat &&
    (mat.getBaseColorTexture() ||
      mat.getMetallicRoughnessTexture() ||
      mat.getNormalTexture() ||
      mat.getOcclusionTexture() ||
      mat.getEmissiveTexture())
  );
  const keyAccessors = [];
  for (const sem of prim.listSemantics()) {
    if (sem === 'COLOR_0' || (sem.startsWith('TEXCOORD_') && hasTexture)) {
      keyAccessors.push(prim.getAttribute(sem));
    }
  }
  let realIdx;
  const srcIdxAcc = prim.getIndices();
  if (srcIdxAcc) {
    const src = srcIdxAcc.getArray();
    realIdx = src instanceof Uint32Array ? src : new Uint32Array(src);
  } else {
    realIdx = new Uint32Array(vertCount);
    for (let i = 0; i < vertCount; i++) realIdx[i] = i;
  }
  const refCount = new Uint32Array(vertCount);
  for (let i = 0; i < realIdx.length; i++) refCount[realIdx[i]] += 1;

  const remap = new Map();
  const vmap = new Uint32Array(vertCount);
  const w2v = [];
  const el = [];
  for (let i = 0; i < vertCount; i++) {
    posAcc.getElement(i, el);
    let key = `${el[0]},${el[1]},${el[2]}`;
    for (const acc of keyAccessors) {
      acc.getElement(i, el);
      key += `|${el.join(',')}`;
    }
    let s = remap.get(key);
    if (s === undefined) {
      s = w2v.length;
      remap.set(key, s);
      w2v.push(i);
    } else if (refCount[i] > refCount[w2v[s]]) {
      w2v[s] = i;
    }
    vmap[i] = s;
  }
  const shadowCount = w2v.length;
  const posF32 = new Float32Array(shadowCount * 3);
  for (let s = 0; s < shadowCount; s++) {
    posAcc.getElement(w2v[s], el);
    posF32[s * 3] = el[0];
    posF32[s * 3 + 1] = el[1];
    posF32[s * 3 + 2] = el[2];
  }
  const shadowIdx = new Uint32Array(realIdx.length);
  for (let i = 0; i < realIdx.length; i++) shadowIdx[i] = vmap[realIdx[i]];
  const triMap = new Map();
  for (let t = 0; t < shadowIdx.length; t += 3) {
    const key = `${shadowIdx[t]},${shadowIdx[t + 1]},${shadowIdx[t + 2]}`;
    if (!triMap.has(key)) triMap.set(key, t);
  }
  return {
    prim,
    posF32,
    shadowIdx,
    w2v,
    realIdx,
    triMap,
    vertCount,
    shadowCount,
  };
}

function simplifyPrim(pre, ratio, maxError) {
  const targetIndexCount = Math.max(
    3,
    Math.floor((pre.shadowIdx.length * ratio) / 3) * 3,
  );
  const [resIdx, relError] = MeshoptSimplifier.simplify(
    pre.shadowIdx,
    pre.posF32,
    3,
    targetIndexCount,
    maxError,
    [],
  );
  if (resIdx.length === 0) return null;
  const mapped = new Uint32Array(resIdx.length);
  for (let t = 0; t < resIdx.length; t += 3) {
    const orig = pre.triMap.get(
      `${resIdx[t]},${resIdx[t + 1]},${resIdx[t + 2]}`,
    );
    if (orig !== undefined) {
      mapped[t] = pre.realIdx[orig];
      mapped[t + 1] = pre.realIdx[orig + 1];
      mapped[t + 2] = pre.realIdx[orig + 2];
    } else {
      mapped[t] = pre.w2v[resIdx[t]];
      mapped[t + 1] = pre.w2v[resIdx[t + 1]];
      mapped[t + 2] = pre.w2v[resIdx[t + 2]];
    }
  }
  // meshopt 의 상대 오차 → 절대(로컬 단위): × getScale(메시 최대 폭).
  const scale = MeshoptSimplifier.getScale(pre.posF32, 3);
  return { mapped, absError: relError * scale };
}

// ── 노드별 LOD 생성 ─────────────────────────────────────────────────────────
const report = [];
let groupSeq = 0;
// 원본 노드 목록을 먼저 고정한다 — 순회 중 형제를 추가하므로.
const targets = root
  .listNodes()
  .filter((n) => n.getMesh() && nodeTriCount(n) >= MIN_NODE_TRIS);
for (const node of targets) {
  const mesh = node.getMesh();
  const groupKey = `${node.getName() || 'node'}#${groupSeq++}`;
  const scaleToMeters = worldMaxScale(node);
  const pres = mesh
    .listPrimitives()
    .map((prim) =>
      primTriCount(prim) >= MIN_PRIM_TRIS
        ? prepare(prim)
        : { prim, small: true },
    );
  const lod0Tris = nodeTriCount(node);
  node.setExtras({
    ...(node.getExtras() ?? {}),
    lodGroup: groupKey,
    lod: 0,
    lodError: 0,
  });
  const levels = [{ lod: 0, tris: lod0Tris, error: 0 }];

  let prevTris = lod0Tris;
  for (const { lod, ratio, maxError } of LOD_LEVELS) {
    const lodName = `${node.getName() || 'node'}-lod${lod}`;
    const lodMesh = doc.createMesh(lodName);
    let tris = 0;
    let worstError = 0;
    for (const pre of pres) {
      const lodPrim = doc
        .createPrimitive()
        .setMode(pre.prim.getMode())
        .setMaterial(pre.prim.getMaterial());
      for (const sem of pre.prim.listSemantics())
        lodPrim.setAttribute(sem, pre.prim.getAttribute(sem));
      if (pre.small) {
        // 작은 프리미티브는 원본 인덱스 공유 — LOD 노드가 온전한 모델이어야 한다.
        if (pre.prim.getIndices()) lodPrim.setIndices(pre.prim.getIndices());
        tris += primTriCount(pre.prim);
        lodMesh.addPrimitive(lodPrim);
        continue;
      }
      const result = simplifyPrim(pre, ratio, maxError);
      if (!result) {
        lodPrim.dispose();
        continue;
      }
      const IdxCtor = pre.vertCount > 65535 ? Uint32Array : Uint16Array;
      const idxAcc = doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(
          IdxCtor === Uint32Array ? result.mapped : new IdxCtor(result.mapped),
        )
        .setBuffer(buffer);
      lodPrim.setIndices(idxAcc);
      lodMesh.addPrimitive(lodPrim);
      tris += result.mapped.length / 3;
      worstError = Math.max(worstError, result.absError);
    }
    if (
      lodMesh.listPrimitives().length === 0 ||
      tris > prevTris * MIN_GAIN_RATIO
    ) {
      // 이득이 없는 레벨 — 사본을 버린다(공유 accessor 는 남는다).
      for (const p of lodMesh.listPrimitives()) {
        const idx = p.getIndices();
        p.dispose();
        if (idx && idx.listParents().length <= 1) idx.dispose();
      }
      lodMesh.dispose();
      continue;
    }
    const lodError = worstError * scaleToMeters;
    const lodNode = doc
      .createNode(lodName)
      .setMesh(lodMesh)
      .setTranslation(node.getTranslation())
      .setRotation(node.getRotation())
      .setScale(node.getScale())
      .setExtras({ lodGroup: groupKey, lod, lodError });
    lodMesh.setExtras({ lodGroup: groupKey, lod, lodError });
    const parent = parentOf(node);
    if (parent) parent.addChild(lodNode);
    else (sceneOf(node) ?? root.listScenes()[0]).addChild(lodNode);
    levels.push({ lod, tris, error: lodError });
    prevTris = tris;
  }
  report.push({ node: node.getName() || '(무명)', levels });
}

if (report.length === 0) {
  console.log(
    `LOD 대상 노드가 없습니다(노드당 ${MIN_NODE_TRIS} 삼각형 이상). 파일을 바꾸지 않습니다.`,
  );
  process.exit(0);
}

// LOD 전 원본 보존 — 대상이 있을 때만(바꾸지 않는 파일에 백업을 남기지 않는다).
const nolodPath = `${backupPath}.nolod`;
if (!existsSync(nolodPath)) {
  copyFileSync(backupPath, nolodPath);
  console.log(`LOD 전 원본 보존: ${nolodPath}`);
} else {
  console.log(`LOD 전 원본 이미 있음: ${nolodPath}`);
}

await io.write(backupPath, doc);

const fmt = (n) => n.toLocaleString('en-US');
for (const r of report) {
  console.log(`노드 ${r.node}:`);
  for (const l of r.levels) {
    const pct =
      r.levels[0].tris > 0 ? Math.round((l.tris / r.levels[0].tris) * 100) : 0;
    console.log(
      `  LOD${l.lod}  ${fmt(l.tris)} tris (${pct}%)  오차 ≤ ${l.error.toFixed(3)} m`,
    );
  }
}
console.log(`\n저장: ${backupPath}\n이어서: pnpm optimize:glb ${file}`);
