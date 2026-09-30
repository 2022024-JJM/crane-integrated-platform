import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PerspectiveCamera } from 'three';
import type {
  SavedSceneView,
  SceneViewport,
  SplitLayout,
} from '@crane/domain/3d';
import { ensureTopViewTilt } from '@crane/core/lib/top-view-pose';
import { resolveCompassViewForPose } from '../lib/compass';
import { computeSplitRects } from '../lib/split-rects';
import { SCENE_CAMERA_CLIP } from './scene-render-preset';
import { SceneCompass, type SceneCompassHandle } from './scene-compass';

interface SceneSplitOverlayProps {
  layout: SplitLayout;
  /** 씬 진북 — 타일마다 정적으로 그리는 방위 표시의 북쪽. */
  trueNorth: number;
  /** 타일 클릭 — 그 뷰의 단일 화면으로. */
  onSelectTile: (view: SavedSceneView) => void;
  /**
   * 타일의 카메라·사각형·DOM 컨테이너를 뷰포트 목록으로 알린다. 부모가
   * SceneViewportsProvider 로 캔버스에 넘겨 분할 렌더러·라벨 포털이 쓴다.
   * 언마운트 시 null. 참조가 안정된 콜백이어야 한다.
   */
  onViewportsChange: (viewports: SceneViewport[] | null) => void;
}

/**
 * 타일 이름의 글자 그림자 — 상자 없이 흰 글자만 두고 뒤를 진하게 어둡게
 * 깔아 하늘·지도 어느 밝기 위에서도 읽힌다(ACMS 의 Area 이름 자리).
 */
const SPLIT_TITLE_TEXT_SHADOW =
  '0 0 3px rgba(0, 0, 0, 1), 0 0 8px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.9), 0 0 16px rgba(0, 0, 0, 0.7)';

function createTileCamera(view: SavedSceneView): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    75,
    1,
    SCENE_CAMERA_CLIP.near,
    SCENE_CAMERA_CLIP.far,
  );
  // 정수직 구도는 기울인다 — 카메라 명령의 방어선(ensureTopViewTilt)과 같다.
  const position = ensureTopViewTilt(view.position, view.target);
  camera.up.set(0, 1, 0);
  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(view.target[0], view.target[1], view.target[2]);
  camera.updateMatrixWorld();
  return camera;
}

/**
 * 분할 화면의 DOM 층 — 타일마다 클릭 영역·이름·방위 표시·라벨 컨테이너를
 * 두고, 타일 카메라와 사각형을 뷰포트로 내보낸다.
 *
 * - 사각형은 이 오버레이의 크기(ResizeObserver, 캔버스와 같은 박스)로
 *   lib/split-rects 가 계산한다. 렌더러의 viewport·scissor 도 같은 값을 쓴다.
 * - 타일 카메라는 배치(layout)마다 새로 만든다 — 배치는 씬 편집 때만 바뀐다.
 *   fov·종횡비는 렌더러가 프레임마다 맞춘다.
 * - 타일 전체가 클릭 영역이라 캔버스는 포인터를 받지 않는다 — 회전·줌·
 *   크레인 클릭·hover 가 전부 없다. 더블클릭이 아니라 단일 클릭이다.
 * - 라벨 컨테이너(`portal`)는 타일 안 `overflow-hidden` 이라 타일 밖으로
 *   넘어간 라벨이 이웃 타일을 덮지 않는다. 컨테이너 참조는 뷰포트 객체가
 *   들고 있고 타일 DOM 의 콜백 ref 가 채운다 — 뷰포트는 커밋 뒤 effect 에서
 *   알리므로 소비자(라벨 포털)가 마운트될 땐 채워져 있다.
 * - 방위 표시는 카메라가 고정이라 마운트 때 한 번 쓴다(드라이버 없음).
 */
export function SceneSplitOverlay({
  layout,
  trueNorth,
  onSelectTile,
  onViewportsChange,
}: SceneSplitOverlayProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(
    null,
  );

  // ResizeObserver 는 observe 직후 현재 크기로 한 번 부른다 — 첫 측정도 여기.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      const rect = root.getBoundingClientRect();
      setBox((prev) =>
        prev && prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const cameras = useMemo(
    () => layout.tiles.map((tile) => createTileCamera(tile.view)),
    [layout],
  );

  const viewports = useMemo<SceneViewport[] | null>(() => {
    if (!box) return null;
    const rects = computeSplitRects(layout, box.width, box.height);
    return layout.tiles.map((tile, index) => ({
      key: `split:${tile.slot}:${tile.view.id}`,
      camera: cameras[index],
      size: {
        width: rects[index].width,
        height: rects[index].height,
        left: rects[index].x,
        top: rects[index].y,
      },
      portal: { current: null },
    }));
  }, [box, cameras, layout]);

  useEffect(() => {
    onViewportsChange(viewports);
  }, [onViewportsChange, viewports]);
  useEffect(() => () => onViewportsChange(null), [onViewportsChange]);

  const handleKeyDown = (event: KeyboardEvent, view: SavedSceneView) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectTile(view);
    }
  };

  return (
    <div
      ref={rootRef}
      data-slot="scene-split-overlay"
      className="pointer-events-none absolute inset-0"
    >
      {viewports
        ? layout.tiles.map((tile, index) => {
            const viewport = viewports[index];
            const rect = viewport.size;
            const view = tile.view;
            const compassView = resolveCompassViewForPose(
              view.position,
              view.target,
              trueNorth,
            );
            const openLabel = t('monitoring:sceneSplit.openTile', {
              name: view.name,
            });
            return (
              <div
                key={tile.slot}
                role="button"
                tabIndex={0}
                aria-label={openLabel}
                title={openLabel}
                onClick={() => onSelectTile(view)}
                onKeyDown={(event) => handleKeyDown(event, view)}
                className="pointer-events-auto absolute cursor-pointer overflow-hidden ring-1 ring-white/40 outline-none ring-inset focus-visible:ring-2 focus-visible:ring-white/80"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                }}
              >
                {/* 라벨·표지 컨테이너 — drei Html 이 여기 붙는다. */}
                <div
                  ref={(element) => {
                    viewport.portal.current = element;
                  }}
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                />
                {/* 방위 표시 — 고정 카메라라 한 번만 쓴다. */}
                {compassView ? (
                  <div className="pointer-events-none absolute top-3 left-3">
                    <SceneCompass
                      ref={(handle: SceneCompassHandle | null) => {
                        handle?.update(compassView);
                      }}
                    />
                  </div>
                ) : null}
                {/* 뷰 이름 — 상단 중앙(ACMS 의 Area 이름 자리). */}
                <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2">
                  <span
                    className="text-xl font-semibold whitespace-nowrap text-white select-none"
                    style={{ textShadow: SPLIT_TITLE_TEXT_SHADOW }}
                  >
                    {view.name}
                  </span>
                </div>
              </div>
            );
          })
        : null}
    </div>
  );
}
