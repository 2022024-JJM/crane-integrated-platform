import { ArrowLeft } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  SceneViewportsProvider,
  SilhouetteOutlineWarmup,
  modelObjectRegistry,
  zoneCenterWorld,
  resolveCameraBoundsMaps,
  resolveSceneHomeCamera,
  resolveSeaMirror,
  resolveSeaVisible,
  resolveSplitLayout,
  resolveTrueNorth,
  unionObjectBounds,
  type SceneViewport,
} from '@crane/domain/3d';
import type { AlarmSeverity } from '@crane/domain/alarm';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
import {
  ThreeSceneViewer,
  type SceneController,
} from '@crane/ui/organisms/three-scene-viewer';
import type { Vector3Tuple } from '@crane/core/types/math';
import type { SavedSceneInfo, SavedSceneView } from '@crane/domain/3d';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { usePlay3dStore } from '../model/use-play3d-store';
import { usePlay3dTransport } from '../model/play3d-transport';
import { useSceneCanvasDpr } from '../model/use-scene-canvas-dpr';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useSceneZoneStore } from '../model/use-scene-zone-store';
import type { MonitoringViewMode } from '../model/types';
import { Vector3 } from 'three';
import { useSceneDock } from '../model/use-scene-dock';
import { useTagBindingSource } from '../model/use-tag-binding-source';
import { computeCollisionViewPose } from '../lib/scene-collision-pairs';
import { RigDriver } from './rig-driver';
import { SceneCollisionAlertOverlay } from './scene-collision-alert-overlay';
import { SceneCollisionDetector } from './scene-collision-detector';
import { SceneCollisionHighlight } from './scene-collision-highlight';
import { SceneZoneAlertOverlay } from './scene-zone-alert-overlay';
import { SceneZoneDetector } from './scene-zone-detector';
import { SceneZoneRings } from './scene-zone-rings';
import { SceneClockMenu } from './scene-clock-menu';
import { SceneFrameGovernor } from './scene-frame-governor';
import {
  OutdoorWorkModelSimulation,
  useSceneData,
} from './outdoor-work-model-simulation';
import { SceneEnvironment } from './scene-environment';
import { SceneSurfaceCamera } from './scene-surface-camera';
import { SceneCameraLimits } from './scene-camera-limits';
import { SceneTerrainLod } from './scene-terrain-lod';
import {
  SCENE_CAMERA_CLIP,
  SCENE_GL_OPTIONS,
  SCENE_RAYCASTER_OPTIONS,
  SceneLighting,
} from './scene-render-preset';
import { sceneCanvasShadows } from '../lib/scene-shadow';
import { SceneLoadingOverlay, SceneReadyProbe } from './scene-loading-overlay';
import { SceneMinimap } from './scene-minimap';
import { SceneMinimapCapture } from './scene-minimap-capture';
import { SceneMinimapToggle } from './scene-minimap-toggle';
import { SceneStatusHud } from './scene-status-hud';
import { useModelStatusRecords } from '../model/use-model-runtime-statuses';
import { useStatusJournalSync } from '../model/use-status-journal-sync';
import { ScenePerfHud } from './scene-perf-hud';
import { ScenePerfProbe } from './scene-perf-probe';
import { SceneWarmupIndicator } from './scene-warmup-indicator';
import {
  SceneCompass,
  SceneCompassDriver,
  type SceneCompassHandle,
} from './scene-compass';
import {
  SceneSimulationBadge,
  SceneSimulationFrame,
} from './scene-simulation-badge';
import { SceneViewBar } from './scene-view-bar';
import { SceneSplitOverlay } from './scene-split-overlay';
import { SceneSplitRenderer } from './scene-split-renderer';
import { useSceneSplitStore } from '../model/use-scene-split-store';
import {
  resolveShadowFocusForPose,
  unionShadowFocus,
} from '../lib/scene-shadow';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

/**
 * 페이지가 씬 카메라를 움직일 수 있게 내주는 동작. 우상단 알람 목록
 * (features/alarm `AlarmFullscreenOverlay`)의 영역 침범 행 [영역 보기]가
 * 이걸 부른다 — 알람 슬라이스는 같은 레이어라 이 뷰를 import 하지 못하므로
 * 페이지가 `actionsRef` 로 받아 콜백으로 넘긴다(2026-09-17, 독 영역 팝업의
 * 같은 버튼을 알람 목록으로 옮긴 것).
 */
export interface Monitoring3dViewActions {
  /** 영역(`modelId#zoneId`) 중심을 타깃으로 카메라를 옮긴다. */
  viewZone: (zoneKey: string) => void;
}

interface Monitoring3dViewProps {
  regionId: string;
  /**
   * 크레인별 활성 알람. 넘기면 라벨 배경·미니맵 마커·HUD 알람 칸이 알람을
   * 표시한다. 넘기지 않는 화면은 세 곳 모두 알람을 그리지 않는다(HUD 는 칸
   * 자체를 숨긴다) — 라벨 색을 운전 상태에만 쓰는 화면이다.
   */
  alarmsByCraneId?: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  /**
   * 화면 종류(model/types MonitoringViewMode). 'realtime' 은 WebSocket 만,
   * 'play3d' 은 리플레이|시뮬레이션(소스는 usePlay3dStore, 재생 조작은
   * Play3dView 의 상단 트랜스포트 바), 'simulation' 은 대시보드 미리보기.
   */
  mode?: MonitoringViewMode;
  /**
   * `mode='simulation'` 일 때 진입 즉시 가상 태그 재생을 켤지. 기본 true.
   * 독 ▶ 토글이 없는 뷰(대시보드 3D 미리보기 모달)는 false 로 두어 정지
   * 상태로 연다. 3D 플레이는 이 값과 무관하게 정지로 연다.
   */
  autoStartSimulation?: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
  fullscreenOverlay?: ReactNode;
  fullscreenTopRightOverlay?: ReactNode;
  fullscreenTopCenterOverlay?: ReactNode;
  toolbarExtras?: ReactNode;
  /**
   * Canvas 안에 추가로 마운트할 씬 콘텐츠(R3F 노드). 충돌 감지 레이어처럼
   * 페이지별 3D 확장 기능을 도메인 씬과 독립적으로 주입할 때 사용.
   */
  sceneExtras?: ReactNode;
  /**
   * Canvas 위에 겹치는 DOM 오버레이 (충돌 감지 HUD 등). ThreeSceneViewer의
   * overlay 슬롯(fullscreen 루트 내부)으로 합성되므로 전체화면에서도
   * 유지된다. 컨테이너가 pointer-events-none이라 orbit 조작을 막지 않는다.
   */
  overlayExtras?: ReactNode;
  /**
   * 렌더 해상도(DPR) 오버라이드 — 성능 거버닝용. r3f Canvas는 리렌더마다
   * 자신의 dpr prop을 재적용하므로, 내부에서 setDpr로 바꾸는 대신 이 prop을
   * 상태에 따라 바꿔야 안정적으로 반영된다. undefined면 기본 범위에 이 PC 의
   * 해상도 배율(설정 페이지, useSceneCanvasDpr)을 얹은 값.
   */
  canvasDpr?: number | [number, number];
  /**
   * 조작 UI 배치. 'top-right'(기본)는 우측 상단 툴바(대시보드 미리보기 등
   * 작은 뷰). 'dock' 은 hover 펼침·고정 가능한 우측 독 레일 — 위에서부터
   * 카메라 버튼(원래위치·탑뷰·저장한 뷰·확대·축소·전체화면), 그 아래 화면
   * 표시(toolbarExtras 로 받은 페이지 버튼·미니맵·현장 시각). 충돌·영역
   * 감지 팝업은 2026-09-17 에 감지 설정 페이지로 옮겨 독에서 뺐다. 독은
   * 전체화면 루트 안이라 전체화면에서도 같은 구성이 유지된다 (실시간 모니터링
   * 화면). 'none' 은 조작 UI 없이 씬만 보여준다 (대시보드 미리보기 모달).
   */
  toolbarLayout?: 'top-right' | 'dock' | 'none';
  /** 페이지가 씬 카메라 동작(영역 보기)을 받을 ref — `Monitoring3dViewActions`. */
  actionsRef?: RefObject<Monitoring3dViewActions | null>;
}

const EMPTY_ALARMS: Record<string, AlarmSeverity> = {};
const EMPTY_VIEWS: SavedSceneView[] = [];

export function Monitoring3dView({
  regionId,
  alarmsByCraneId,
  alarmHighlightMesh = false,
  mode = 'simulation',
  autoStartSimulation = true,
  onLoadingChange,
  fullscreenOverlay,
  fullscreenTopRightOverlay,
  fullscreenTopCenterOverlay,
  toolbarExtras,
  sceneExtras,
  overlayExtras,
  canvasDpr,
  toolbarLayout = 'top-right',
  actionsRef,
}: Monitoring3dViewProps) {
  const { t } = useTranslation();
  const sceneAlarms = alarmsByCraneId ?? EMPTY_ALARMS;
  const isDock = toolbarLayout === 'dock';
  const play3dSource = usePlay3dStore((s) => s.source);
  const transport = usePlay3dTransport();
  // 캔버스 해상도 — 기본 범위 × 이 PC 의 해상도 배율(설정 페이지).
  const sceneDpr = useSceneCanvasDpr();
  const isPlay3d = mode === 'play3d';
  const isReplaySource = isPlay3d && play3dSource === 'replay';
  // 시뮬레이션 조작·표시(독 ▶·시계 팝업·배지·테두리)는 시뮬레이션 값이 화면을
  // 움직이는 화면에서만 — 실시간은 WebSocket 만 보여 준다(2026-09-16).
  const simulationUiVisible =
    mode === 'simulation' || (isPlay3d && play3dSource === 'simulation');
  // 조명·HUD 현장 시각의 출처 — 리플레이 소스는 프레임 타임스탬프를 따른다.
  const timeSource = isReplaySource ? 'replay' : 'clock';
  // 관제 HUD·미니맵은 실시간 관제 화면에서만 — 3D 플레이는 분석 화면이라
  // 트랜스포트 바·리포트가 그 자리를 대신한다(2026-09-16).
  const showControlRoomWidgets = isDock && !isPlay3d;
  // 방위 표시는 독 배치 전부(실시간·3D 플레이) — ACMS 는 실시간과 Play Back
  // 화면 모두 좌상단에 방위를 둔다. 자세는 Canvas 안 드라이버가 직접 쓴다.
  const compassRef = useRef<SceneCompassHandle | null>(null);
  // 독 상태는 여기서 소유한다 — 앱 페이지에 두면 페이지 리렌더가 cameraPreset
  // 참조를 흔들어 카메라가 리셋되는 사고(아래 주석)로 이어진다.
  const toolsDock = useSceneDock('tools');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const { sceneInfo, isLoading } = useSceneData(regionId, mode, {
    autoStartSimulation,
  });
  // 콜백(영역 보기)이 최신 씬을 읽도록 — 렌더 중 ref 쓰기 금지라 effect 로.
  const useSceneInfoStoreRef = useRef<SavedSceneInfo | null>(null);
  useEffect(() => {
    useSceneInfoStoreRef.current = sceneInfo;
  }, [sceneInfo]);
  // 캔버스는 항상 frameloop='demand' 다 — 프레임은 SceneFrameGovernor 가
  // 애니메이션 소스(재생·수신·기즈모)가 있을 때 30fps 로, 정지 씬은 조작
  // invalidate 만으로 만든다(2026-09-11, 유휴 발열 절감). 바다가 켜진 씬
  // (resolveSeaVisible — 판정은 이 한 곳)은 파도·미러 패스가 상시
  // 애니메이션이라 거버너에 알려 30fps 를 유지한다 — 예전 demand 모달에서
  // 파도가 얼어붙던 문제의 해법이다.
  const seaVisible = resolveSeaVisible(sceneInfo);
  const trueNorth = resolveTrueNorth(sceneInfo);
  const solarSun = sceneInfo?.lighting?.sunMode === 'solar';
  // 태그 값 버스(가상 태그·WebSocket·리플레이) → 씬 맵핑 → 값 저장소. 드라이버는
  // Canvas 안(RigDriver)에서 매 프레임 노드에 적용한다.
  useTagBindingSource(sceneInfo, true);
  // 모델별 운전 상태(HUD)·라벨 표시 상태(색·아이콘)·외곽선 — 같은 판정 한
  // 번에서 함께 나온다. 상태가 실제로 바뀔 때만 참조가 바뀐다(1Hz 판정). 3D
  // 플레이는 정지 중 재판정을 멈추고 창을 배속에 맞춘다 — 벽시계 창 그대로면
  // 일시정지 뒤 전 장비가 두절이 된다.
  const {
    runtime: runtimeStatuses,
    labels: labelStates,
    outlines: outlineStates,
  } = useModelStatusRecords(
    sceneInfo,
    isPlay3d
      ? { paused: !transport.isPlaying, timeScale: transport.speed }
      : undefined,
  );
  // 통신두절 진입·복귀를 저널에 남긴다(그 밖의 전환은 제외) — 실시간 화면만.
  useStatusJournalSync(
    regionId,
    sceneInfo,
    runtimeStatuses,
    mode === 'realtime',
  );
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const exitFocus = useObjectFocusStore((s) => s.exitFocus);
  // 충돌 감지는 전 모드에서 켠다. 정지 방식은 러너가 정한다(scene-collision-
  // hold) — 시뮬레이션·3D 플레이는 러너 pause, 실시간은 화면 반영 보류.
  const collisionRunner = mode;
  const collisionEnabled = useSceneCollisionStore((s) => s.enabled);
  // 영역 침범은 상태 표시라 전 모드에서 돈다.
  const zonesEnabled = useSceneZoneStore((s) => s.enabled);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const handleControllerReady = useCallback(
    (controller: SceneController | null) => {
      sceneControllerRef.current = controller;
    },
    [],
  );

  const handleMoveTo = useCallback(
    (position: Vector3Tuple, target: Vector3Tuple) => {
      sceneControllerRef.current?.moveTo(position, target);
    },
    [],
  );

  const handleResetCamera = useCallback(() => {
    sceneControllerRef.current?.reset();
  }, []);

  const handleGetPose = useCallback(
    () => sceneControllerRef.current?.getPose() ?? null,
    [],
  );

  // "영역 보기" — 영역 중심을 타깃으로, 현재 시선 방향을 유지한 채 반경만큼
  // 물러난다(수치 계산은 lib/scene-collision-pairs). 영역 중심은 소유 모델
  // 루트 월드 위치 + 오프셋(zoneCenterWorld). 우상단 알람 목록의 영역 침범
  // 행이 `actionsRef.viewZone` 으로 부른다.
  const handleViewZone = useCallback((key: string) => {
    const info = useSceneInfoStoreRef.current;
    const [modelId, zoneId] = key.split('#');
    const model = info?.models.find((m) => m.id === modelId);
    const zone = model?.zones?.find((z) => z.id === zoneId);
    const object = modelObjectRegistry.get(modelId);
    if (!model || !zone || !object) return;
    const center = zoneCenterWorld(
      object.matrixWorld,
      zone.offset,
      new Vector3(),
    );
    const pose = computeCollisionViewPose(
      [center.x, center.y, center.z],
      Math.max(zone.radius * 2.5, 20),
      sceneControllerRef.current?.getPose() ?? null,
    );
    // 분할 중이면 단일 화면으로 나가서 보여 준다 — 타일은 카메라가 고정이다.
    useSceneSplitStore.getState().exit();
    sceneControllerRef.current?.moveTo(pose.position, pose.target);
  }, []);

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = { viewZone: handleViewZone };
    return () => {
      actionsRef.current = null;
    };
  }, [actionsRef, handleViewZone]);

  // 씬 뷰(에디터가 저작해 씬 파일에 저장한 카메라 구도) — 모니터링에는
  // 에디터에서 고정한 뷰만 우상단 고정 줄에 온다. 목록·북마크는 없다.
  const sceneViews = sceneInfo?.views ?? EMPTY_VIEWS;
  const pinnedViews = useMemo(
    () => sceneViews.filter((view) => view.pinned === true),
    [sceneViews],
  );
  // 분할 화면 — 씬의 viewSplit(뷰를 칸에 배정한 것)이 2칸 이상이고 에디터가
  // 분할을 고정했을 때 실시간 독 배치의 우상단 고정 줄 버튼으로만 켠다(독
  // 레일에는 두지 않는다). 켜짐 여부는 세션 스토어(키 = regionId), 타일
  // 카메라·사각형·DOM 컨테이너는 오버레이가 뷰포트로 알리고 Provider 로
  // 캔버스에 넘긴다(라벨 포털·분할 렌더러가 읽는다). 분할 중에는 기본
  // 카메라가 보이지 않으므로 HUD·미니맵·전역 방위 표시를 숨기고, 레일의
  // 카메라 버튼·미니맵 토글을 비활성한다. 카메라를 옮기는 명령(뷰 선택·영역
  // 보기)은 분할에서 나간 뒤 수행한다.
  const splitLayout = useMemo(
    () => resolveSplitLayout(sceneInfo?.viewSplit, sceneInfo?.views),
    [sceneInfo?.viewSplit, sceneInfo?.views],
  );
  const splitPinned = sceneInfo?.viewSplit?.pinned === true;
  const splitAvailable =
    isDock && mode === 'realtime' && splitPinned && splitLayout !== null;
  const splitActiveKey = useSceneSplitStore((s) => s.activeKey);
  const enterSplit = useSceneSplitStore((s) => s.enter);
  const exitSplit = useSceneSplitStore((s) => s.exit);
  const clearSplit = useSceneSplitStore((s) => s.clear);
  const splitActive = splitAvailable && splitActiveKey === regionId;
  const [splitViewports, setSplitViewports] = useState<SceneViewport[] | null>(
    null,
  );
  useEffect(() => () => clearSplit(regionId), [clearSplit, regionId]);
  const toggleSplit = useCallback(() => {
    if (useSceneSplitStore.getState().activeKey === regionId) {
      exitSplit();
      return;
    }
    // 포커스 중이면 풀고 들어간다 — 포커스 패널·복귀 버튼은 단일 화면의 것.
    exitFocus();
    enterSplit(regionId);
  }, [enterSplit, exitFocus, exitSplit, regionId]);
  // shadow frustum 초점 — 분할 중엔 타일 구도들의 합집합으로 고정한다.
  const splitShadowFocus = useMemo(
    () =>
      splitActive && splitLayout
        ? unionShadowFocus(
            splitLayout.tiles.map((tile) =>
              resolveShadowFocusForPose(tile.view.position, tile.view.target),
            ),
          )
        : null,
    [splitActive, splitLayout],
  );
  const splitDisabledLabel = splitActive
    ? t('monitoring:sceneSplit.disabledInSplit')
    : undefined;

  const handleSelectView = useCallback(
    (view: SavedSceneView) => {
      exitSplit();
      sceneControllerRef.current?.moveTo(view.position, view.target);
    },
    [exitSplit],
  );

  // 초기 시점·"메인 뷰" 버튼 = 홈 카메라(메인 뷰, 없으면 저장 시점 카메라).
  const homeCamera = resolveSceneHomeCamera(sceneInfo, regionId);
  const cameraPosition = homeCamera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = homeCamera?.target ?? DEFAULT_CAMERA_TARGET;
  // 인라인 리터럴로 넘기면 부모 리렌더마다 새 객체 → SceneControlsBridge의
  // 컨트롤러 재등록 effect가 재실행되며 reset()이 사용자 카메라를 초기
  // 위치로 되돌린다(알람 배너 등 잦은 리렌더 화면에서 실제 발생).
  // 탑뷰 fit 대상 = 카메라 영역 제한에 체크된 지도들의 합집합(없으면 모든
  // 지도) — SceneCameraLimits 와 같은 기준. id 목록을 이어 붙인 문자열만
  // 의존성에 넣어 sceneInfo 객체가 갱신돼도 cameraPreset 참조가 바뀌지 않게
  // 한다(위 주석의 reset 문제). 객체는 버튼을 누르는 시점에 레지스트리에서
  // 읽으므로 로드 타이밍과 무관하다.
  const cameraBoundsKey = resolveCameraBoundsMaps(sceneInfo?.maps)
    .map((m) => m.id)
    .join('|');
  const cameraPreset = useMemo(
    () => ({
      defaultPosition: cameraPosition,
      defaultTarget: cameraTarget,
      getTopViewBounds: () =>
        unionObjectBounds(
          cameraBoundsKey
            .split('|')
            .filter(Boolean)
            .map((id) => modelObjectRegistry.get(id)),
        ),
    }),
    [cameraPosition, cameraTarget, cameraBoundsKey],
  );

  // 좌측 상단 열 — 첫 줄은 방위 표시와 그 오른쪽의 후처리 상태(BVH 빌드
  // 등), 그 아래 시뮬레이션 배지 → 포커스 복귀 버튼. 방위 표시는 자리가
  // 고정이어야 해서 일시 표시들보다 먼저 둔다. 방위 표시가 없는 배치(독이
  // 아닌 작은 뷰)는 후처리 상태가 열 맨 아래다.
  const topLeftOverlay = (
    <div className="pointer-events-none absolute top-1.5 left-1.5 flex flex-col items-start gap-2">
      {isDock ? (
        <div className="flex items-start gap-2">
          {/* 분할 중엔 타일마다 방위 표시가 있어 전역 것은 숨긴다. */}
          {splitActive ? null : <SceneCompass ref={compassRef} />}
          <SceneWarmupIndicator />
        </div>
      ) : null}
      {/* 시뮬레이션 세션 표시(배지 + 캔버스 테두리) — 시뮬레이션 값이 화면을
          움직이는 배치에서만. */}
      {simulationUiVisible && toolbarLayout !== 'none' ? (
        <SceneSimulationBadge />
      ) : null}
      {focusedModelId !== null ? (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            SCENE_TOOLBAR_BUTTON_CLASS,
            'pointer-events-auto gap-1.5',
          )}
          onClick={exitFocus}
        >
          <ArrowLeft className="size-4" />
          {t('monitoring:focus.back')}
        </Button>
      ) : null}
      {isDock ? null : <SceneWarmupIndicator />}
    </div>
  );

  if (isLoading) {
    return (
      <div
        ref={rootRef}
        className="relative h-full min-h-0 w-full bg-(--canvas-background)"
      />
    );
  }

  const dockRight = isDock
    ? {
        label: t('common:viewer3d.dockTools', { defaultValue: '화면 조작' }),
        expanded: toolsDock.expanded,
        pinned: toolsDock.pinned,
        onPinnedChange: toolsDock.setPinned,
        handlers: toolsDock.handlers,
      }
    : undefined;

  // 우상단 고정 줄의 분할 버튼 — 분할을 켜는 유일한 곳.
  const splitBarProps = splitAvailable
    ? { state: 'enabled' as const, active: splitActive, onToggle: toggleSplit }
    : null;

  return (
    // 뷰포트 Provider 는 R3F 가 Canvas 안으로 다리 놓는 컨텍스트다 — 오버레이
    // (DOM)와 캔버스 자식이 같은 뷰포트 목록을 본다. 분할이 아니면 null.
    <SceneViewportsProvider value={splitActive ? splitViewports : null}>
      <div
        ref={rootRef}
        className="relative h-full min-h-0 w-full bg-(--canvas-background)"
      >
        <ThreeSceneViewer
          cameraPreset={cameraPreset}
          cameraClip={SCENE_CAMERA_CLIP}
          canvasProps={{
            dpr: canvasDpr ?? sceneDpr,
            frameloop: 'demand',
            gl: SCENE_GL_OPTIONS,
            // BVH raycast 를 최근접 히트에서 조기 종료 — 프리셋 주석 참고.
            raycaster: SCENE_RAYCASTER_OPTIONS,
            shadows: sceneCanvasShadows(sceneInfo?.lighting),
            onPointerMissed: exitFocus,
          }}
          overlay={
            <>
              {/* 에셋 로드가 끝날 때까지 캔버스를 덮는다 — 부분 팝인 깜빡임 방지 */}
              <SceneLoadingOverlay ready={sceneReady} />
              {topLeftOverlay}
              {/* 충돌 경보 — 씬 안 표시와 달리 카메라가 어디를 보든 보인다. */}
              {/* 시뮬레이션 세션 테두리 — 오버레이 루트(캔버스 전체). */}
              {simulationUiVisible && toolbarLayout !== 'none' ? (
                <SceneSimulationFrame />
              ) : null}
              {/* 충돌·영역 침범 경보 — 가장자리 비네트만(배너는 HUD·독 배지·
                알람 패널과 겹쳐 2026-09-12 에 뺐다). */}
              <SceneCollisionAlertOverlay runner={collisionRunner} />
              <SceneZoneAlertOverlay />
              {/* 분할 타일(이름·방위·클릭) — 캔버스 위에 깔려 포인터를 전부
                받는다. 비네트는 pointer-events-none 이라 위에 있어도 클릭이
                통과한다. */}
              {splitActive && splitLayout ? (
                <SceneSplitOverlay
                  layout={splitLayout}
                  trueNorth={trueNorth}
                  onSelectTile={handleSelectView}
                  onViewportsChange={setSplitViewports}
                />
              ) : null}
              {overlayExtras}
              {/* 2D 미니맵(좌하단) — 실시간 관제 화면에서만. 배경은
                Canvas 안 SceneMinimapCapture 의 탑뷰 스냅샷, 마커·카메라는 폴링.
                분할 중엔 숨긴다(카메라 표시가 기본 카메라 것이라 의미가 없다). */}
              {showControlRoomWidgets && !splitActive ? (
                <SceneMinimap
                  sceneInfo={sceneInfo}
                  alarmsByCraneId={sceneAlarms}
                  getPose={handleGetPose}
                  onMoveTo={handleMoveTo}
                />
              ) : null}
              {/* 관제 요약 HUD(상단 중앙) — 실시간 관제 화면에서만, 분할 중엔 숨김. */}
              {showControlRoomWidgets && !splitActive ? (
                <SceneStatusHud
                  regionId={regionId}
                  runtimeStatuses={runtimeStatuses}
                  alarmsByCraneId={alarmsByCraneId}
                  sceneInfo={sceneInfo}
                  mode={mode}
                  timeSource={timeSource}
                />
              ) : null}
              {/* dev 전용 성능 HUD(좌하단) — localStorage crane:perf-hud='1'
                일 때만 표시. 값은 Canvas 안 ScenePerfProbe 가 기록한다.
                미니맵과 겹치지 않게 그 오른쪽에 둔다. */}
              <ScenePerfHud
                className={showControlRoomWidgets ? 'left-60' : undefined}
              />
            </>
          }
          fullscreenOverlay={fullscreenOverlay}
          fullscreenTopRightOverlay={
            isDock ? (
              // 우상단 슬롯 — 고정한 뷰 줄이 먼저, 페이지의 알람 패널이 그 아래.
              <div className="flex flex-col items-end gap-2">
                <SceneViewBar
                  views={pinnedViews}
                  onSelectView={handleSelectView}
                  split={splitBarProps}
                />
                {fullscreenTopRightOverlay}
              </div>
            ) : (
              fullscreenTopRightOverlay
            )
          }
          fullscreenTopCenterOverlay={fullscreenTopCenterOverlay}
          toolbarExtras={
            isDock ? (
              // 독 레일에서 카메라 묶음 아래 구성(실시간·3D 플레이 공통) — 화면
              // 표시 계열만: 페이지가 준 버튼(알람 토글·골리앗 가드)·미니맵·
              // 현장 시각. 충돌·영역 감지 팝업은 감지 설정 페이지로 옮겼다
              // (2026-09-17). 작은 뷰(top-right)는 페이지 버튼만 그대로 둔다.
              <>
                {toolbarExtras}
                {showControlRoomWidgets ? (
                  <SceneMinimapToggle disabledLabel={splitDisabledLabel} />
                ) : null}
                {/* 현장 시각·낮/밤 — 태양 위치를 시각에 연동한 씬(sunMode solar)
                  의 시각 미리보기. 수동 태양 씬에서도 안내용으로 둔다. 리플레이
                  소스는 프레임 시각을 따르므로 숨긴다. */}
                {isReplaySource ? null : (
                  <SceneClockMenu regionId={regionId} sceneInfo={sceneInfo} />
                )}
              </>
            ) : (
              toolbarExtras
            )
          }
          toolbarPlacement={toolbarLayout}
          dockRight={dockRight}
          cameraControlsDisabledLabel={splitDisabledLabel}
          toolbarTrailing={
            // 독 레일에는 뷰·분할 버튼을 두지 않는다 — 우상단 고정 줄이 전부다.
            // 가로 툴바(작은 뷰)는 고정한 뷰만 칩으로.
            toolbarLayout === 'none' || isDock ? undefined : (
              <SceneViewBar
                views={pinnedViews}
                onSelectView={handleSelectView}
              />
            )
          }
          onControllerReady={handleControllerReady}
        >
          {/* 프레임 요청의 유일한 상시 틱 — 위 frameloop 주석 참고. */}
          <SceneFrameGovernor animating={seaVisible} slow={solarSun} />
          {/* regionId 는 solar 모드(현장 시각 기반 낮/밤)의 위치·시간대 키.
            리플레이 소스의 낮/밤은 프레임 타임스탬프를 따른다. */}
          <SceneLighting
            sceneInfo={sceneInfo}
            regionId={regionId}
            timeSource={timeSource}
            shadowFocus={splitShadowFocus}
          />
          <SceneSurfaceCamera seaVisible={seaVisible} />
          {/* 표면 카메라 바로 다음 — 같은 priority 의 useFrame 은 마운트 순서라
            표면 피벗 뒤에 이동 범위·바닥을 clamp 한다. */}
          <SceneCameraLimits sceneInfo={sceneInfo} />
          {/* 카메라 확정 뒤 지형 타일 LOD 전환 — 이 프레임의 최종 시점 기준. */}
          <SceneTerrainLod />
          {/* 방위 표시 자세 — 카메라 확정 뒤 이 프레임의 최종 시점을 읽는다.
            분할 중엔 전역 방위 표시가 없다. */}
          {isDock && !splitActive ? (
            <SceneCompassDriver compassRef={compassRef} trueNorth={trueNorth} />
          ) : null}
          {/* 분할 렌더러 — 뷰포트(타일)가 잡힌 뒤 R3F 렌더를 넘겨받는다. 맨
            마지막이 아니어도 된다(priority 1 은 0 들 뒤에 돈다). */}
          {splitActive && splitViewports && splitViewports.length >= 2 ? (
            <SceneSplitRenderer viewports={splitViewports} />
          ) : null}
          {/* 배경 파노라마는 자체 Suspense — 4K EXR(수~십수 MB)이 씬(맵·모델)
            표시를 붙잡지 않고, 로드되는 대로 단색 배경을 대체한다 */}
          <Suspense fallback={null}>
            <SceneEnvironment
              environment={sceneInfo?.environment}
              seaVisible={seaVisible}
              seaMirror={resolveSeaMirror(sceneInfo)}
              maps={sceneInfo?.maps}
            />
          </Suspense>
          <Suspense fallback={null}>
            <RigDriver sceneInfo={sceneInfo} />
            {/* 드라이버 바로 다음 — 같은 priority 의 useFrame 은 마운트 순서로
              실행되므로 노드가 움직인 뒤 검사한다. */}
            <SceneCollisionDetector
              sceneInfo={sceneInfo}
              enabled={collisionEnabled}
              runner={collisionRunner}
            />
            <SceneCollisionHighlight />
            {/* 영역 침범 검출·링 — 검출기 뒤에 링을 두어 같은 틱 상태를 읽는다. */}
            <SceneZoneDetector
              sceneInfo={sceneInfo}
              enabled={zonesEnabled}
              runner={collisionRunner}
            />
            <SceneZoneRings sceneInfo={sceneInfo} />
            {/* 충돌 테두리(실루엣) 셰이더·사본 프리워밍. */}
            <SilhouetteOutlineWarmup />
            <OutdoorWorkModelSimulation
              sceneInfo={sceneInfo}
              regionId={regionId}
              alarmsByCraneId={sceneAlarms}
              alarmHighlightMesh={alarmHighlightMesh}
              mode={mode}
              onMoveTo={handleMoveTo}
              onResetCamera={handleResetCamera}
              getPose={handleGetPose}
              prepareOutline
              labelStates={labelStates}
              outlineStates={outlineStates}
            />
            {sceneExtras}
            <SceneReadyProbe onReady={handleSceneReady} />
            <ScenePerfProbe />
            {/* 미니맵 배경 스냅샷 — 씬 준비 뒤 한 번 탑뷰를 렌더 타깃에 찍는다. */}
            {showControlRoomWidgets ? (
              <SceneMinimapCapture sceneInfo={sceneInfo} ready={sceneReady} />
            ) : null}
          </Suspense>
        </ThreeSceneViewer>
      </div>
    </SceneViewportsProvider>
  );
}
