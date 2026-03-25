import { Canvas, useThree } from '@react-three/fiber';
import { AlertCircle, Box, Loader2 } from 'lucide-react';
import {
  Component,
  Suspense,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box3,
  Group,
  Object3D,
  OrthographicCamera,
  Sphere,
  Vector3,
} from 'three';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import type { SceneModelPreviewPreset } from '@/entities/3d';
import { cn } from '@/shared/lib/utils';

interface SceneModelPreviewProps {
  path: string;
  label: string;
  preview?: SceneModelPreviewPreset;
  overlayLabel?: string | null;
  overlayHint?: string | null;
  showOverlay?: boolean;
  className?: string;
}

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function PreviewFallback({
  label,
  message,
  tone = 'loading',
}: {
  label: string;
  message: string;
  tone?: 'loading' | 'error';
}) {
  const Icon = tone === 'loading' ? Loader2 : AlertCircle;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/88 text-center">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6',
          tone === 'loading' && 'animate-pulse',
        )}
      >
        <Icon
          className={cn(
            'size-4 text-white/75',
            tone === 'loading' && 'animate-spin',
          )}
        />
      </div>
      <div className="space-y-1 px-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-white/90 uppercase">
          {label}
        </p>
        <p className="text-[11px] text-white/55">{message}</p>
      </div>
    </div>
  );
}

function PreviewStage() {
  return (
    <>
      <ambientLight intensity={2.4} />
      <directionalLight position={[3, 4, 2]} intensity={4.4} color="#ffffff" />
      <directionalLight position={[-2, 2, -3]} intensity={1.2} color="#93c5fd" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]} receiveShadow>
        <circleGeometry args={[2.5, 48]} />
        <meshStandardMaterial color="#0f172a" roughness={0.92} metalness={0.05} />
      </mesh>
    </>
  );
}

function PreviewModel({
  resolvedUrl,
  preview,
  onReady,
}: {
  resolvedUrl: string;
  preview?: SceneModelPreviewPreset;
  onReady: () => void;
}) {
  const { scene } = useGLTF(resolvedUrl);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const previewGroupRef = useRef<Group | null>(null);
  const camera = useThree((state) => state.camera as OrthographicCamera);
  const canvasSize = useThree((state) => state.size);

  useLayoutEffect(() => {
    if (!previewGroupRef.current) {
      return;
    }

    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);

    const normalizedRadius = preview?.fitScale ?? 0.72;
    const safeRadius = Math.max(sphere.radius, 0.001);
    const scale = normalizedRadius / safeRadius;
    const visualCenterY =
      box.min.y + size.y * (preview?.centerYRatio ?? 0.42);
    const target = new Vector3(
      0,
      Math.max(size.y * scale * (preview?.targetYRatio ?? 0.06), 0),
      0,
    );

    previewGroupRef.current.scale.setScalar(scale);
    previewGroupRef.current.position.set(
      -center.x * scale,
      -visualCenterY * scale,
      -center.z * scale,
    );

    const cameraDistance = 10 * (preview?.cameraDistanceMultiplier ?? 1);
    const viewDirection = new Vector3(
      ...(preview?.cameraDirection ?? [1.2, 0.72, 1.18]),
    ).normalize();

    camera.position.copy(target).add(viewDirection.multiplyScalar(cameraDistance));
    camera.near = 0.1;
    camera.far = 100;
    camera.lookAt(target);
    camera.updateMatrixWorld(true);

    const fittedBox = new Box3().setFromObject(previewGroupRef.current);
    const corners = [
      new Vector3(fittedBox.min.x, fittedBox.min.y, fittedBox.min.z),
      new Vector3(fittedBox.min.x, fittedBox.min.y, fittedBox.max.z),
      new Vector3(fittedBox.min.x, fittedBox.max.y, fittedBox.min.z),
      new Vector3(fittedBox.min.x, fittedBox.max.y, fittedBox.max.z),
      new Vector3(fittedBox.max.x, fittedBox.min.y, fittedBox.min.z),
      new Vector3(fittedBox.max.x, fittedBox.min.y, fittedBox.max.z),
      new Vector3(fittedBox.max.x, fittedBox.max.y, fittedBox.min.z),
      new Vector3(fittedBox.max.x, fittedBox.max.y, fittedBox.max.z),
    ];
    let maxProjectedX = 0;
    let maxProjectedY = 0;

    for (const corner of corners) {
      const projectedCorner = corner.clone().applyMatrix4(camera.matrixWorldInverse);
      maxProjectedX = Math.max(maxProjectedX, Math.abs(projectedCorner.x));
      maxProjectedY = Math.max(maxProjectedY, Math.abs(projectedCorner.y));
    }

    const paddedProjectedX = Math.max(maxProjectedX * 1.45, 0.001);
    const paddedProjectedY = Math.max(maxProjectedY * 1.45, 0.001);
    const zoomFromWidth = canvasSize.width / (paddedProjectedX * 2);
    const zoomFromHeight = canvasSize.height / (paddedProjectedY * 2);

    camera.zoom = Math.max(8, Math.min(zoomFromWidth, zoomFromHeight));
    camera.updateProjectionMatrix();

    onReady();
  }, [camera, canvasSize.height, canvasSize.width, clone, onReady, preview]);

  return (
    <group ref={previewGroupRef}>
      <primitive object={clone as Object3D} />
    </group>
  );
}

export function SceneModelPreview({
  path,
  label,
  preview,
  overlayLabel,
  overlayHint,
  showOverlay = false,
  className,
}: SceneModelPreviewProps) {
  const { t } = useTranslation();

  useEffect(() => {
    useGLTF.preload(path);
  }, [path]);

  return (
    <PreviewErrorBoundary
      fallback={
        <div
          className={cn(
            'relative h-28 overflow-hidden rounded-[0.95rem] border border-white/10 bg-slate-950/92',
            className,
          )}
        >
          <PreviewFallback
            label={label}
            message={t('monitoring:palette.previewLoadError')}
            tone="error"
          />
        </div>
      }
    >
      <SceneModelPreviewInner
        path={path}
        label={label}
        preview={preview}
        overlayLabel={overlayLabel}
        overlayHint={overlayHint}
        showOverlay={showOverlay}
        className={className}
      />
    </PreviewErrorBoundary>
  );
}

function SceneModelPreviewInner({
  path,
  label,
  preview,
  overlayLabel,
  overlayHint,
  showOverlay = false,
  className,
}: SceneModelPreviewProps) {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
  }, [path]);

  return (
    <div
      className={cn(
        'pointer-events-none relative h-28 overflow-hidden rounded-[0.95rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_38%),linear-gradient(180deg,#111827_0%,#020617_100%)]',
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/85 to-transparent" />
      {!isReady ? (
        <PreviewFallback
          label={label}
          message={t('monitoring:palette.previewLoading')}
        />
      ) : null}
      <Canvas
        orthographic
        frameloop="demand"
        dpr={[1, 1]}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        camera={{ position: [2.6, 1.8, 2.6], zoom: 72 }}
      >
        <PreviewStage />
        <Suspense fallback={null}>
          <PreviewModel
            resolvedUrl={path}
            preview={preview}
            onReady={() => {
              setIsReady(true);
            }}
          />
        </Suspense>
      </Canvas>
      <div
        className={cn(
          'pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-slate-950/82 px-2.5 py-2 text-white transition duration-200',
          showOverlay
            ? 'translate-y-0 opacity-100'
            : 'translate-y-1 opacity-0',
        )}
      >
        {overlayLabel ? (
          <p className="truncate text-[11px] font-semibold leading-tight">
            {overlayLabel}
          </p>
        ) : null}
        {overlayHint ? (
          <p className="mt-0.5 truncate text-[10px] leading-tight text-white/65">
            {overlayHint}
          </p>
        ) : null}
      </div>
      <div className="absolute right-3 bottom-3 left-3 h-3 rounded-full bg-black/30 blur-md" />
      <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/55 px-2 py-1 text-[9px] font-semibold tracking-[0.18em] text-white/85 uppercase">
        <Box className="size-2.5" />
        GLB
      </div>
    </div>
  );
}
