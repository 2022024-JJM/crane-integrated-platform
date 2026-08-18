import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ThreeSceneViewer } from '@crane/ui/organisms/three-scene-viewer';
import { Spinner } from '@crane/ui/atoms/spinner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@crane/ui/molecules/card';
import { GltfModel } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

const CAMERA_PRESET = {
  defaultPosition: [15, 12, 20] as Vector3Tuple,
  defaultTarget: [0, 4, 0] as Vector3Tuple,
  topViewPosition: [0, 30, 0] as Vector3Tuple,
  topViewTarget: [0, 0, 0] as Vector3Tuple,
};

const MODEL_SCALE: Vector3Tuple = [1.2, 1.2, 1.2];

function LiveBadge3D() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
      </span>
      <span className="text-[11px] font-semibold tracking-wider text-sky-600 dark:text-sky-400">
        3D
      </span>
    </div>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={2.5} />
      {/* 그림자는 쓰지 않는다 — Canvas에 `shadows`를 켜지 않으므로 castShadow를
          달아도 아무 효과가 없다(플래그만 남으면 "그림자가 되는데 왜 안 보이지"로
          오해를 낳는다). 접지 그림자는 ContactShadows로 시도했다가 지도 위에
          어두운 반점이 생겨 걷어냈다 — scene-render-preset 주석 참고. */}
      <directionalLight position={[10, 20, 10]} intensity={3} />
      <directionalLight position={[-5, 10, -5]} intensity={1} />
      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.5]} />
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1a1a2e" opacity={0.3} transparent />
      </mesh>
      {/* Grid helper */}
      <gridHelper args={[60, 30, '#333355', '#222244']} />
      <Suspense fallback={null}>
        <GltfModel
          id="gc-04-model"
          url="/models/gantry_crane.glb"
          equipName="GC-04"
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          scale={MODEL_SCALE}
          showLabel
        />
      </Suspense>
    </>
  );
}

export function Goliath3dViewer() {
  const { t } = useTranslation('goliath-crane');

  return (
    <Card className="border-border/90 bg-card/60 overflow-hidden border shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle>{t('viewer3d.title')}</CardTitle>
        <CardAction>
          <LiveBadge3D />
        </CardAction>
      </CardHeader>
      <CardContent className="relative min-h-100 p-0">
        <div
          className="h-100 w-full"
          style={{ background: 'var(--canvas-background)' }}
        >
          <ThreeSceneViewer cameraPreset={CAMERA_PRESET}>
            <SceneContent />
          </ThreeSceneViewer>
        </div>
      </CardContent>
    </Card>
  );
}
