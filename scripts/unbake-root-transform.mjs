// 범용 언베이크 도구 — 루트 노드에 베이크된 월드 포즈(T/R/S)를 제거해 원점 중심으로 되돌린다.
//
// 언제 쓰나: Blender 에서 씬에 배치된 오브젝트를 그대로 내보내면 루트 노드
// translation/rotation 에 월드 좌표가 실려 온다(Block_001/002 가 그랬다 —
// 정점은 원점 중심인데 루트 노드가 (-2214, 0, 1868) 에 놓여 있었다). 이 상태로
// 카탈로그에 등록하면 드롭 지점에서 수 km 떨어진 곳에 나타나고 회전 피벗도
// 원점으로 튄다. 정점 자체에 좌표가 베이크된 goliath_crane.glb 는 다리 위치
// 계약까지 맞춰야 하므로 전용 스크립트(unbake-goliath-crane.mjs)를 쓴다.
//
// 사용법:
//   node scripts/unbake-root-transform.mjs assets-src/models/Block_001.glb [...]
//   node scripts/unbake-root-transform.mjs --fold-scale assets-src/models/LLC_002.glb
//   pnpm optimize:glb Block_001.glb                # 이어서 압축 배포
//
// --fold-scale: 루트에 실린 uniform scale 을 지우는 대신 **직계 자식에 접어
// 넣는다**(자식 translation×s, scale×s). 리깅된 Blender export 는 루트 Empty 에
// 20.267 같은 큰 scale 을 두고 자식 mesh 에 1/s 를 두는 식으로 실제 미터를
// 맞춰 오는데, 루트 scale 을 그냥 identity 로 만들면 모델이 s 배 작아진다.
// uniform scale 은 회전과 가환이라 자식 rotation 은 건드리지 않아도 정확하다.
// 이렇게 하면 루트는 identity, 자식 노드 좌표는 실제 미터가 되어 씬 배치
// scale [1,1,1] 로 놓을 수 있고, 리그 드라이버의 scale 체인 누적도 단순해진다.
//
// 입력은 어느 경로든 받지만 출력은 항상 assets-src/models/<파일명> 이다 —
// optimize:glb 가 그 백업본을 원본으로 취급하기 때문(public 에 쓰면 옛 백업이
// 도로 덮어쓴다). 제거한 포즈는 "씬 배치값"으로 출력하므로 원래 자리에 두고
// 싶으면 씬 JSON 에 그대로 기입하면 된다.
import { basename, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const OUT_DIR = 'assets-src/models';
const argv = process.argv.slice(2);
const foldScale = argv.includes('--fold-scale');
const inputs = argv.filter((a) => !a.startsWith('--'));
if (inputs.length === 0) {
  console.error(
    '사용법: node scripts/unbake-root-transform.mjs [--fold-scale] <glb 경로> [...]',
  );
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const fmt = (v) => +v.toFixed(3);
/** 단위 쿼터니언 [x,y,z,w] → three.js rotation.y(도). yaw 만 있는 경우를 전제한다. */
const quatToYawDeg = ([x, y, z, w]) => {
  const yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
  return ((yaw * 180) / Math.PI + 360) % 360;
};

for (const input of inputs) {
  const out = join(OUT_DIR, basename(input));
  const doc = await io.read(input);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const roots = scene.listChildren();

  console.log(`== ${input} (루트 노드 ${roots.length}개)`);
  for (const node of roots) {
    const t = node.getTranslation();
    const r = node.getRotation();
    const s = node.getScale();
    console.log(`  ${node.getName() || '(이름 없음)'}`);
    console.log('    씬 배치값  position:', t.map(fmt));
    console.log('    씬 배치값  rotationY(도):', fmt(quatToYawDeg(r)), ' (quat', r.map(fmt), ')');
    const hasScale = s.some((v) => Math.abs(v - 1) > 1e-6);
    if (hasScale && foldScale) {
      const uniform = Math.abs(s[0] - s[1]) < 1e-6 && Math.abs(s[1] - s[2]) < 1e-6;
      if (!uniform) {
        console.error(`    scale ${s.map(fmt)} 이 uniform 이 아니라 --fold-scale 을 적용할 수 없다.`);
        process.exit(1);
      }
      const k = s[0];
      for (const child of node.listChildren()) {
        child.setTranslation(child.getTranslation().map((v) => v * k));
        child.setScale(child.getScale().map((v) => v * k));
      }
      console.log(`    scale: ${s.map(fmt)} ← 직계 자식 ${node.listChildren().length}개에 접어 넣음`);
    } else if (hasScale) {
      console.log('    scale:', s.map(fmt), '← 제거됨');
    }
    node.setTranslation([0, 0, 0]);
    node.setRotation([0, 0, 0, 1]);
    node.setScale([1, 1, 1]);
  }

  await io.write(out, doc);

  // 검증: 다시 읽어 bbox 중심이 XZ 원점 근처인지 확인
  const v = await io.read(out);
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const node of v.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const lo = pos.getMin([0, 0, 0]);
      const hi = pos.getMax([0, 0, 0]);
      for (let i = 0; i < 3; i++) {
        mn[i] = Math.min(mn[i], lo[i]);
        mx[i] = Math.max(mx[i], hi[i]);
      }
    }
  }
  console.log('  저장:', out);
  console.log('  검증 bbox min:', mn.map(fmt), ' max:', mx.map(fmt));
}
