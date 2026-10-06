import { OrbitControls } from '@react-three/drei';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { Camera, CloudSun } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  EquirectangularReflectionMapping,
  type Scene,
  type Texture,
} from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { cn } from '@crane/core/lib/utils';
import { TooltipProvider } from '@crane/ui/molecules/tooltip';
import { VIEWER_GLASS_BAR } from '../lib/asset-presentation';
import { renderCoverThumbnail } from '../lib/thumbnail-crop';
import type { AssetViewerHandle } from './asset-model-viewer';
import {
  ViewerErrorBoundary,
  ViewerIconButton,
  ViewerLoadingOverlay,
} from './asset-viewer-chrome';

/**
 * 배경(등장방형 파노라마 EXR) 한 장을 둘러보는 뷰어.
 *
 * 씬이 쓰는 것과 같은 방식으로 보인다 — EXR 을 `scene.background` 에 걸고
 * 렌더러의 톤매핑(ACES, 노출 1)을 그대로 거친다. 펼친 그림으로 보이면 위아래가
 * 늘어난 채라 씬에서 어떻게 보일지 알 수 없다.
 *
 * 카메라는 제자리에서 돌기만 한다. 캔버스는 `frameloop="demand"` 다.
 */

const FOV_DEG = 70;
/**
 * 파노라마의 한가운데(등장방형 u = 0.5)는 +X 방향이다. 카메라를 원점 뒤(−X)에
 * 두고 원점을 보게 하면 그림의 가운데에서 시작한다. 배경은 무한히 멀어
 * 카메라 위치는 보이는 것을 바꾸지 않는다 — 거리는 도는 축의 길이일 뿐이다.
 */
const EYE_DISTANCE = 1;
/** 썸네일 크기 — 목록 카드와 미리보기의 그림 자리에 가깝게 가로로 길다. */
const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 400;

interface AssetEnvironmentViewerProps {
  /**
   * 열 파일. `null` 이면 아직 열지 않는다 — 자리와 불러오는 표시만 그리고
   * 파일은 받지 않는다(목록에서 지나치는 자산).
   */
  url: string | null;
  /** 뷰어 아래에 놓이는 표제란. */
  titleBlock?: ReactNode;
  handleRef?: Ref<AssetViewerHandle>;
  /** 배경이 올라온 뒤 한 번 — 이때부터 썸네일을 찍을 수 있다. */
  onReady?: () => void;
  /** 썸네일 저장 버튼. 없으면 버튼을 그리지 않는다. */
  onSaveThumbnail?: () => void;
  /** 뷰어 왼쪽 아래에 놓이는 꼬리표(어느 버전인지 등). */
  cornerLabel?: ReactNode;
}

/**
 * 정리는 자기가 건 텍스처일 때만 한다 — 파일이 바뀌는 사이 두 인스턴스가
 * 겹쳐도 새로 걸린 배경을 걷어내지 않는다(씬의 EnvironmentBackground 와 같다).
 */
function applyPanorama(scene: Scene, texture: Texture) {
  texture.mapping = EquirectangularReflectionMapping;
  scene.background = texture;
  return () => {
    if (scene.background === texture) scene.background = null;
  };
}

function Panorama({
  url,
  handleRef,
  onShown,
}: {
  url: string;
  handleRef: Ref<AssetViewerHandle>;
  onShown: () => void;
}) {
  const texture = useLoader(EXRLoader, url);
  const getState = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);

  // scene.background 는 리컨실러 밖 변조라 demand 캔버스에서 프레임을 직접 깨운다.
  useEffect(() => {
    const cleanup = applyPanorama(getState().scene, texture);
    invalidate();
    onShown();
    return () => {
      cleanup();
      invalidate();
    };
  }, [getState, invalidate, onShown, texture]);

  useImperativeHandle(
    handleRef,
    () => ({
      captureThumbnail: () => {
        const { camera, gl, scene } = getState();
        gl.render(scene, camera);
        // 그리기 버퍼는 이 태스크가 끝나면 비워질 수 있다 — 렌더 직후
        // 동기로 2D 캔버스에 옮겨 둔다.
        const canvas = renderCoverThumbnail(
          gl.domElement,
          THUMBNAIL_WIDTH,
          THUMBNAIL_HEIGHT,
        );
        return new Promise<Blob | null>((resolve) => {
          if (!canvas) resolve(null);
          else canvas.toBlob(resolve, 'image/png');
        });
      },
    }),
    [getState],
  );

  return null;
}

export function AssetEnvironmentViewer({
  url,
  titleBlock,
  handleRef,
  onReady,
  onSaveThumbnail,
  cornerLabel,
}: AssetEnvironmentViewerProps) {
  const { t } = useTranslation();
  const panoramaRef = useRef<AssetViewerHandle | null>(null);
  // 캔버스가 놓이는 자리 — 요소를 직접 넘겨, 그 사이 뷰어가 사라져도 R3F 가
  // 없는 요소에 이벤트를 걸다 던지지 않게 한다(모델 뷰어와 같다).
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  // 결과는 URL 에 묶어 둔다 — 다른 파일로 바뀌면 옛 결과가 보이지 않는다.
  const [shownUrl, setShownUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shown = url !== null && shownUrl === url;
  const failed = url !== null && failedUrl === url;

  useImperativeHandle(
    handleRef,
    () => ({
      captureThumbnail: () =>
        panoramaRef.current?.captureThumbnail() ?? Promise.resolve(null),
    }),
    [],
  );

  // 콜백은 ref 로 읽는다 — 호출부가 매 렌더 새 함수를 넘겨도 배경을 다시 걸지
  // 않는다.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  const handleShown = useCallback(() => {
    setShownUrl(url);
    onReadyRef.current?.();
  }, [url]);

  // 화면을 떠나면 이 파일의 디코딩 결과를 캐시에서 놓는다 — 4K 파노라마
  // 한 장이 수십 MB 다.
  useEffect(() => {
    if (url === null) return;
    return () => {
      try {
        useLoader.clear(EXRLoader, url);
      } catch {
        // 캐시에 없으면 그만이다.
      }
    };
  }, [url]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 bg-[#1b1c1f]">
        <div
          ref={setSurface}
          className={cn(
            'absolute inset-0 cursor-grab transition-opacity duration-200 active:cursor-grabbing',
            shown ? 'opacity-100' : 'opacity-0',
          )}
        >
          {surface && url !== null ? (
            <Canvas
              key={url}
              eventSource={surface}
              frameloop="demand"
              dpr={[1, 1.5]}
              camera={{
                fov: FOV_DEG,
                near: 0.1,
                far: 10,
                position: [-EYE_DISTANCE, 0, 0],
              }}
            >
              <ViewerErrorBoundary onError={() => setFailedUrl(url)}>
                <Suspense fallback={null}>
                  <Panorama
                    url={url}
                    handleRef={panoramaRef}
                    onShown={handleShown}
                  />
                </Suspense>
              </ViewerErrorBoundary>
              {/* 제자리에서 돌기만 한다. 속도의 부호를 뒤집어, 끌면 그림이
                  손을 따라온다. */}
              <OrbitControls
                makeDefault
                enableZoom={false}
                enablePan={false}
                enableDamping
                dampingFactor={0.12}
                rotateSpeed={-0.35}
              />
            </Canvas>
          ) : null}
        </div>

        {failed ? (
          <div
            role="alert"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/85"
          >
            <CloudSun className="size-6 opacity-60" />
            <p className="text-sm font-medium">
              {t('asset-library:viewer.environmentLoadFailed')}
            </p>
            <p className="max-w-sm text-xs opacity-75">
              {t('asset-library:viewer.loadFailedHint')}
            </p>
          </div>
        ) : shown ? (
          <p className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-md bg-black/50 px-2 py-1 text-[11px] leading-none text-white/80 backdrop-blur-md">
            {t('asset-library:viewer.panoramaHint')}
          </p>
        ) : (
          <ViewerLoadingOverlay light={false} subject="environment" />
        )}

        {cornerLabel ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10">
            {cornerLabel}
          </div>
        ) : null}

        {onSaveThumbnail ? (
          <TooltipProvider delay={150}>
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-end">
              <div
                role="group"
                aria-label={t('asset-library:viewer.display')}
                className={cn(VIEWER_GLASS_BAR, 'pointer-events-auto')}
              >
                <ViewerIconButton
                  label={t('asset-library:viewer.saveThumbnail')}
                  onClick={onSaveThumbnail}
                >
                  <Camera />
                </ViewerIconButton>
              </div>
            </div>
          </TooltipProvider>
        ) : null}
      </div>
      {titleBlock}
    </div>
  );
}
