import { Suspense, useCallback, useRef } from 'react';
import { Box3, Vector3, type Object3D } from 'three';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import { GltfModel, getCraneModel } from '@crane/domain/3d';
import type { CraneType } from '@crane/domain/asset';
import type { Vector3Tuple } from '@crane/core/types/math';
import { cn } from '@crane/core/lib/utils';

// R3F 기본 카메라 fov (Canvas에 fov 미지정 시 75)
const CAMERA_FOV_DEG = 75;

/** 모델 바운딩 박스 기준 정면·근접 카메라 위치/타깃 계산 */
function computeFrontalView(
  object: Object3D,
): { position: Vector3Tuple; target: Vector3Tuple } | null {
  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  if (box.isEmpty()) return null;

  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (CAMERA_FOV_DEG * Math.PI) / 180;
  // 대상이 프레임에 꽉 차도록 거리 계산 + 약간의 여백
  const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.25;

  return {
    // 정면(+Z)에서 살짝만 올려다보는 근접 뷰
    position: [center.x, center.y + size.y * 0.1, center.z + dist],
    target: [center.x, center.y, center.z],
  };
}

function SceneContent({
  craneType,
  onModelReady,
}: {
  craneType: CraneType;
  onModelReady: (object: Object3D | null) => void;
}) {
  const cfg = getCraneModel(craneType);
  return (
    <>
      <ambientLight intensity={2.5} />
      <directionalLight position={[10, 20, 10]} intensity={3} castShadow />
      <directionalLight position={[-5, 10, -5]} intensity={1} />
      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.5]} />
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1a1a2e" opacity={0.3} transparent />
      </mesh>
      {/* Grid helper */}
      <gridHelper args={[60, 30, '#333355', '#222244']} />
      <Suspense fallback={null}>
        <GltfModel
          id={`asset-3d-${craneType}`}
          url={cfg.url}
          scale={cfg.scale}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          showLabel={false}
          isSensorOccluder={false}
          onObjectReady={(_id, object) => onModelReady(object)}
        />
      </Suspense>
    </>
  );
}

/** 자산 카드 안에 인라인으로 임베드되는 크레인 3D 뷰어 (모달 아님) */
export function Crane3dViewer({
  craneType,
  className,
}: {
  craneType: CraneType;
  className?: string;
}) {
  const cfg = getCraneModel(craneType);

  const controllerRef = useRef<SceneController | null>(null);
  const objectRef = useRef<Object3D | null>(null);

  // 컨트롤러·모델이 모두 준비되면 정면·근접으로 프레이밍
  const fitToModel = useCallback(() => {
    const controller = controllerRef.current;
    const object = objectRef.current;
    if (!controller || !object) return;
    const view = computeFrontalView(object);
    if (view) controller.moveTo(view.position, view.target);
  }, []);

  const handleControllerReady = useCallback(
    (controller: SceneController | null) => {
      controllerRef.current = controller;
      fitToModel();
    },
    [fitToModel],
  );

  const handleModelReady = useCallback(
    (object: Object3D | null) => {
      objectRef.current = object;
      fitToModel();
    },
    [fitToModel],
  );

  return (
    <div
      className={cn(
        'h-72 w-full overflow-hidden rounded-md border border-border',
        className,
      )}
      style={{ background: 'var(--canvas-background)' }}
    >
      <ThreeSceneViewer
        cameraPreset={cfg.cameraPreset}
        onControllerReady={handleControllerReady}
      >
        <SceneContent craneType={craneType} onModelReady={handleModelReady} />
      </ThreeSceneViewer>
    </div>
  );
}
