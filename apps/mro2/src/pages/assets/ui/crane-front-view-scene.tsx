import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Group, Vector3 } from 'three';
import { getCraneModel, withBaseUrl } from '@crane/domain/3d';
import type { CraneType } from '@crane/domain/asset';
import { ASPECT_ESTIMATE, computeFrontalViewFromBox } from '../lib/compute-frontal-view';

/* compute-frontal-view는 R3F 기본 fov(75) 기준으로 거리를 계산하므로 동일하게 맞춘다.
 * (다른 값을 쓰면 모델이 잘리거나 지나치게 작게 보인다) */
const FRONT_FOV_DEG = 75;

/** 자산 정보용 정면 뷰 모델 — 회전 없이 정면 고정, 바운딩박스 기준 자동 프레이밍 */
function FrontModel({ craneType }: { craneType: CraneType }) {
  const cfg = getCraneModel(craneType);
  const gltf = useGLTF(withBaseUrl(cfg.url));
  const clone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const innerRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const fitted = useRef(false);
  // 마지막으로 맞춘 종횡비 — 창 크기가 바뀌면 다시 프레이밍한다
  const fittedAspect = useRef(0);

  useFrame(() => {
    if (!innerRef.current) return;
    const currentAspect = 'aspect' in camera ? (camera.aspect as number) : ASPECT_ESTIMATE;
    // 종횡비가 유의미하게 달라졌으면 재프레이밍 (리사이즈 대응)
    if (fitted.current && Math.abs(currentAspect - fittedAspect.current) < 0.01) return;
    innerRef.current.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(innerRef.current);
    if (box.isEmpty()) {
      invalidate(); // 모델이 아직 준비 안 됨 — 다음 프레임 재요청 (demand 모드)
      return;
    }
    const view = computeFrontalViewFromBox(box);
    if (!view) return;
    camera.position.set(...view.position);
    camera.lookAt(...view.target);

    /* computeFrontalViewFromBox는 종횡비를 1.4로 추정해 거리를 잡는다.
     * 실제 패널이 그보다 좁으면(세로로 긴 컨테이너) 모델 좌우가 잘리므로,
     * 부족한 만큼만 카메라를 뒤로 물린다. */
    const target = new Vector3(...view.target);
    if (currentAspect < ASPECT_ESTIMATE) {
      const offset = camera.position.clone().sub(target);
      camera.position.copy(target).addScaledVector(offset, ASPECT_ESTIMATE / currentAspect);
      camera.lookAt(target);
    }

    fitted.current = true;
    fittedAspect.current = currentAspect;
    invalidate(); // 맞춰진 카메라로 한 번 더 렌더
  });

  return (
    <group ref={innerRef}>
      <primitive object={clone} scale={cfg.scale} />
    </group>
  );
}

export default function CraneFrontViewScene({ craneType }: { craneType: CraneType }) {
  return (
    <Canvas
      camera={{ fov: FRONT_FOV_DEG, position: [0, 0, 10], near: 0.01, far: 5000 }}
      gl={{ alpha: true, antialias: true }}
      style={{ pointerEvents: 'none' }}
      dpr={[1, 2]}
      frameloop="demand"
    >
      <ambientLight intensity={2.2} />
      <directionalLight position={[5, 8, 5]} intensity={2.2} />
      <directionalLight position={[-4, 3, -4]} intensity={0.8} />
      <hemisphereLight args={['#cfe8ff', '#5a4020', 0.4]} />
      <Suspense fallback={null}>
        <FrontModel craneType={craneType} />
      </Suspense>
    </Canvas>
  );
}
