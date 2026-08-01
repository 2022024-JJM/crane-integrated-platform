import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Group, Vector3 } from 'three';
import { getCraneModel, withBaseUrl } from '@crane/domain/3d';
import type { CraneType } from '@crane/domain/asset';

const THUMB_FOV_DEG = 30;
// 바운딩 스피어 대비 여백 배수 (1 = 원에 딱 접함)
const THUMB_MARGIN = 1.18;

/** 썸네일용 크레인 모델 — 원점 기준 자동 프레이밍, 정면 고정(회전 없음) */
function ThumbModel({ craneType }: { craneType: CraneType }) {
  const cfg = getCraneModel(craneType);
  const gltf = useGLTF(withBaseUrl(cfg.url));
  const clone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const innerRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const fitted = useRef(false);

  useFrame(() => {
    if (fitted.current || !innerRef.current) return;
    innerRef.current.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(innerRef.current);
    if (box.isEmpty()) {
      invalidate(); // 모델이 아직 준비 안 됨 — 다음 프레임 재요청 (demand 모드)
      return;
    }
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    // 모델 중심을 원점으로 이동
    innerRef.current.position.set(-center.x, -center.y, -center.z);
    // 바운딩 스피어(대각선 반지름)를 원형 뷰포트에 맞춘다 → 방향과 무관하게
    // 모델 전체가 원 안에 들어와 잘리지 않는다. (fov는 Canvas와 동일해야 함)
    const radius = 0.5 * Math.hypot(size.x, size.y, size.z) || 1;
    const fov = (THUMB_FOV_DEG * Math.PI) / 180;
    const dist = (radius / Math.sin(fov / 2)) * THUMB_MARGIN;
    const dir = new Vector3(0.28, 0.18, 1).normalize();
    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0, 0, 0);
    fitted.current = true;
    invalidate(); // 맞춰진 카메라로 한 번 더 렌더
  });

  return (
    <group ref={innerRef}>
      <primitive object={clone} scale={cfg.scale} />
    </group>
  );
}

export default function CraneThumbScene({ craneType }: { craneType: CraneType }) {
  return (
    <Canvas
      camera={{ fov: THUMB_FOV_DEG, position: [1, 1, 3], near: 0.01, far: 1000 }}
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
        <ThumbModel craneType={craneType} />
      </Suspense>
    </Canvas>
  );
}
