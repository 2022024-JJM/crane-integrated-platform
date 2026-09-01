// goliath_crane.glb → body/trolley 파트 분리 도구.
//
// 왜 필요한가: 자산 상세 3D 탭은 골리앗을 'parts' 전략으로 그린다
// (crane-zone-config.ts GOLIATH_ZONES) — 통짜 모델 대신 존별 파트 GLB 를
// 조립 렌더해 트롤리를 메시 단위로 hover/클릭하기 위해서다. 그래서 파트
// 파일이 원본과 어긋나면 3D 탭에서만 형상이 달라진다. 실제로 종전 파트
// 파일은 언베이크(2026-08-21) 이전의 옛 모델에서 잘린 것이라 좌표계가
// 어긋나 있었고, 트롤리는 8,400 삼각형 중 144 개(1.7%)만 담고 있어
// 로프·후크가 통째로 사라졌다 (자산 정보 탭의 정면 뷰는 통짜 원본을
// 쓰므로 로프가 보여서, 두 화면이 서로 달라 보이는 증상이 됐다).
//
// 사용법:
//   node scripts/split-goliath-parts.mjs        # assets-src 원본 → 파트 2개
//   pnpm optimize:glb goliath_crane_body.glb goliath_crane_trolley.glb
//
// 입력은 assets-src/models/goliath_crane.glb (언베이크된 "진짜 원본"),
// 출력도 assets-src/models/ 다 — optimize:glb 가 백업본을 원본으로 취급하므로
// public 에 직접 쓰면 다음 최적화 때 옛 백업이 도로 덮어쓴다
// (optimize-glb.mjs 상단 경고 참고).
//
// 분리 기준은 원본의 노드 이름이다. 종전처럼 지오메트리 연결 요소로 자르지
// 않는다 — 원본이 이미 트롤리를 별도 노드로 갖고 있어 이름만 보면 되고,
// 노드 단위로 옮기면 월드 변환이 보존되어 두 파트가 position [0,0,0] 으로
// 정확히 조립된다(존 설정이 전제하는 계약).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const SRC = 'assets-src/models/goliath_crane.glb';

/** 트롤리 파트로 보낼 원본 노드 이름 (나머지는 전부 body). */
const TROLLEY_NODES = ['Goliath Crane_Trolley_01', 'Goliath Crane_Trolley_02'];

const OUTPUTS = [
  { path: 'assets-src/models/goliath_crane_body.glb', name: 'Goliath Crane Body', trolley: false },
  { path: 'assets-src/models/goliath_crane_trolley.glb', name: 'Goliath Crane Trolley', trolley: true },
];

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const xf = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** 씬을 순회하며 메시 노드의 삼각형 수와 월드 바운딩박스를 집계한다. */
function measure(doc) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let tris = 0;
  const walk = (node, parent) => {
    const world = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const idx = prim.getIndices();
        tris += idx ? idx.getCount() / 3 : pos.getCount() / 3;
        const el = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, el);
          const w = xf(world, el);
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], w[k]);
            max[k] = Math.max(max[k], w[k]);
          }
        }
      }
    }
    for (const child of node.listChildren()) walk(child, world);
  };
  for (const n of scene.listChildren()) walk(n, I);
  return { tris: Math.round(tris), min, max };
}

const fmt = (a) => a.map((v) => v.toFixed(2)).join(', ');

const source = await io.read(SRC);
const srcStats = measure(source);
console.log(`원본 ${SRC}`);
console.log(`  삼각형 ${srcStats.tris}  bbox [${fmt(srcStats.min)}] .. [${fmt(srcStats.max)}]`);

// 원본에 기대한 트롤리 노드가 실제로 있는지 먼저 확인한다 — 모델을 새로
// 반입하면서 노드 이름이 바뀌면 조용히 빈 파트가 나오는 사고를 막는다.
const srcNodeNames = source.getRoot().listNodes().map((n) => n.getName());
const missing = TROLLEY_NODES.filter((n) => !srcNodeNames.includes(n));
if (missing.length > 0) {
  console.error(`\n원본에 트롤리 노드가 없습니다: ${missing.join(', ')}`);
  console.error(`원본 노드 목록: ${srcNodeNames.join(' | ')}`);
  console.error('모델을 새로 반입했다면 이 스크립트의 TROLLEY_NODES 를 갱신하세요.');
  process.exit(1);
}

const results = [];

for (const out of OUTPUTS) {
  // 매번 원본을 다시 읽는다 — 한 문서를 잘라 쓰면 두 번째 출력이 이미 지워진
  // 노드를 못 찾는다.
  const doc = await io.read(SRC);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

  // 반대편 파트의 노드를 씬에서 떼어낸다. 남긴 노드의 월드 변환은 그대로라
  // 두 파트를 position [0,0,0] 으로 겹쳐 놓으면 원본과 동일하게 조립된다.
  const drop = [];
  const walk = (node) => {
    const isTrolley = TROLLEY_NODES.includes(node.getName());
    if (node.getMesh() && isTrolley !== out.trolley) drop.push(node);
    for (const child of node.listChildren()) walk(child);
  };
  for (const n of scene.listChildren()) walk(n);
  for (const node of drop) node.dispose();

  // 남은 메시 노드에 파트 이름을 부여한다(디버깅·에디터 표시용).
  const kept = doc.getRoot().listNodes().filter((n) => n.getMesh());
  if (kept.length === 1) kept[0].setName(out.name);

  // 떼어낸 노드가 참조하던 메시·머티리얼·텍스처를 정리한다.
  await doc.transform((d) => {
    for (const kind of ['listMeshes', 'listMaterials', 'listTextures', 'listAccessors']) {
      for (const el of d.getRoot()[kind]()) {
        if (el.listParents().every((p) => p.propertyType === 'Root')) el.dispose();
      }
    }
  });

  await io.write(out.path, doc);
  const stats = measure(await io.read(out.path));
  results.push({ out, stats });
  console.log(`\n저장 ${out.path}`);
  console.log(`  삼각형 ${stats.tris}  bbox [${fmt(stats.min)}] .. [${fmt(stats.max)}]`);
}

// 검증: 파트 삼각형 합이 원본과 같아야 하고, 두 파트의 합집합 bbox 도
// 원본과 일치해야 한다(조립 시 형상이 원본과 동일하다는 뜻).
const sumTris = results.reduce((n, r) => n + r.stats.tris, 0);
const unionMin = [0, 1, 2].map((k) => Math.min(...results.map((r) => r.stats.min[k])));
const unionMax = [0, 1, 2].map((k) => Math.max(...results.map((r) => r.stats.max[k])));
const bboxOk = [0, 1, 2].every(
  (k) =>
    Math.abs(unionMin[k] - srcStats.min[k]) < 1e-3 && Math.abs(unionMax[k] - srcStats.max[k]) < 1e-3,
);

console.log('\n--- 검증 ---');
console.log(`삼각형  원본 ${srcStats.tris} / 파트 합 ${sumTris}  ${sumTris === srcStats.tris ? 'OK' : '불일치'}`);
console.log(`bbox    합집합 [${fmt(unionMin)}] .. [${fmt(unionMax)}]  ${bboxOk ? 'OK' : '불일치'}`);

if (sumTris !== srcStats.tris || !bboxOk) {
  console.error('\n분리 결과가 원본과 다릅니다 — 파트 파일을 배포하지 마세요.');
  process.exit(1);
}
console.log('\n이어서: pnpm optimize:glb goliath_crane_body.glb goliath_crane_trolley.glb');
