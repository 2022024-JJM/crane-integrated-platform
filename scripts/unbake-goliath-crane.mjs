// goliath_crane.glb 재반입 도구 — 베이크된 월드 포즈를 제거해 원점 중심으로 되돌린다.
//
// 왜 필요한가: 충돌 감지 존·FSD 카메라·에디터 기즈모는 모두 "GLB 원점 =
// 크레인 중심(다리 사이), 거더 = 로컬 +X" 계약 위에서 씬 배치 transform으로
// 파생된다 (goliath-collision-zone.ts). Blender 에서 월드 좌표를 지오메트리에
// 베이크한 채 내보내면 씬 배치가 identity 가 되어 존이 원점(맵에서 2km 밖)에
// 그려지고, 에디터 회전 피벗도 원점으로 튄다 (2026-08-20 실제 발생).
//
// 사용법:
//   node scripts/unbake-goliath-crane.mjs   # public 의 새 GLB 를 읽어
//                                           # assets-src/ 원본으로 저장
//   pnpm optimize:glb goliath_crane.glb     # 이어서 압축 배포
//   → 출력된 "씬 배치값"을 goliath.json / philly-2dock.json 크레인 항목에 기입
//
// 원점 정의: 다리(지면 접촉 정점 군집) 중심선이 로컬 +X 축에서 L1=+63.034 /
// L2=-60.900 unit 에 오도록 — 기존 GLB·LEG_OFFSETS 실측 계약과 동일.
//
// 물리 L1 = 월드 거더축 +X 쪽 다리. goliath.json 의 종전 배치(rot 6.178°)와
// 정합하는 선택이다 — 골리앗 페이지에서 검증된 L1/L2 배지·차선 밴드·에고
// 카메라 방향(주행축 -쪽에서 진입 → 저작 카메라 반대편이라 스윕이 생김)이
// 이 관례를 전제한다. 반대(185.909°)로 잡으면 화면상 크레인은 동일하지만
// 에고 카메라가 저작 카메라와 같은 편에 내려 진입 스윕이 사라진다
// (2026-08-20 실제 발생). 참고: 구 philly-2dock 의 rot 183° 배치는 이와
// 반대 관례였다 — 씬 간 불일치는 이 선택으로 goliath.json 쪽에 통일됐다.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const IN = process.argv[2] ?? 'apps/shell/public/models/goliath_crane.glb';
const OUT = 'assets-src/models/goliath_crane.glb';
const L1_OFFSET = 63.034; // 물리 L1 (구 GLB 실측)
const L2_OFFSET = -60.9;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const d = await io.read(IN);
const scene = d.getRoot().getDefaultScene() ?? d.getRoot().listScenes()[0];

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
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// 1) 월드 정점 수집 → 지면 접촉 군집으로 다리 중심 측정
const pts = [];
function walk(node, parent) {
  const world = mul(parent, node.getMatrix());
  const mesh = node.getMesh();
  if (mesh)
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const el = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        pts.push(xf(world, el));
      }
    }
  for (const c of node.listChildren()) walk(c, world);
}
for (const n of scene.listChildren()) walk(n, I);

const minY = Math.min(...pts.map((p) => p[1]));
const ground = pts.filter((p) => p[1] < minY + 2);
const xs = ground.map((p) => p[0]);
const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
const centroid = (side) => [
  side.reduce((s, p) => s + p[0], 0) / side.length,
  side.reduce((s, p) => s + p[2], 0) / side.length,
];
const posX = centroid(ground.filter((p) => p[0] > mid));
const negX = centroid(ground.filter((p) => p[0] <= mid));

// 물리 L1 = 월드 +X 쪽 다리 (파일 상단 관례 주석 참고)
const L1 = posX;
const L2 = negX;
const span = Math.hypot(L1[0] - L2[0], L1[1] - L2[1]);
const u = [(L1[0] - L2[0]) / span, (L1[1] - L2[1]) / span]; // 거더 +X 단위벡터(월드)
// 원점: L1 - u*63.034 와 L2 + u*60.9 의 평균
const o1 = [L1[0] - u[0] * L1_OFFSET, L1[1] - u[1] * L1_OFFSET];
const o2 = [L2[0] - u[0] * L2_OFFSET, L2[1] - u[1] * L2_OFFSET];
const origin = [(o1[0] + o2[0]) / 2, (o1[1] + o2[1]) / 2];

// three.js rotation.y = yaw 가 로컬 +X 를 u 로 보내도록: cos=ux, sin=-uz
const yaw = Math.atan2(-u[1], u[0]);
const yawDeg = ((yaw * 180) / Math.PI + 360) % 360;

console.log('다리 간격:', span.toFixed(3));
console.log('씬 배치값  position:', [origin[0], 0, origin[1]].map((v) => +v.toFixed(3)));
console.log('씬 배치값  rotationY(도):', +yawDeg.toFixed(3));

// 2) 역변환 M = RotY(-yaw) · T(-origin) 을 루트 노드에 합성
const c = Math.cos(-yaw), s = Math.sin(-yaw);
// glTF column-major. RotY: +X→(cos,-sin), +Z→(sin,cos) (three 규약과 동일)
const R = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -origin[0], 0, -origin[1], 1];
const M = mul(R, T);
for (const n of scene.listChildren()) n.setMatrix(mul(M, n.getMatrix()));

await io.write(OUT, d);
console.log('저장:', OUT);

// 3) 검증: 출력 파일 재측정 — 다리가 ±63.034/-60.9, z≈0, yaw≈0 이어야 한다
const v = await io.read(OUT);
const vs = v.getRoot().getDefaultScene() ?? v.getRoot().listScenes()[0];
const vpts = [];
(function vwalk(nodes, parent) {
  for (const node of nodes) {
    const world = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh)
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const el = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, el);
          vpts.push(xf(world, el));
        }
      }
    vwalk(node.listChildren(), world);
  }
})(vs.listChildren(), I);
const vminY = Math.min(...vpts.map((p) => p[1]));
const vground = vpts.filter((p) => p[1] < vminY + 2);
const vxs = vground.map((p) => p[0]);
const vmid = (Math.min(...vxs) + Math.max(...vxs)) / 2;
const vL1 = centroid(vground.filter((p) => p[0] > vmid));
const vL2 = centroid(vground.filter((p) => p[0] <= vmid));
console.log('검증 L1(+X):', vL1.map((n) => +n.toFixed(3)), ' 기대 [63.034, ~0]');
console.log('검증 L2(-X):', vL2.map((n) => +n.toFixed(3)), ' 기대 [-60.9, ~0]');
console.log('검증 minY:', vminY.toFixed(3));
