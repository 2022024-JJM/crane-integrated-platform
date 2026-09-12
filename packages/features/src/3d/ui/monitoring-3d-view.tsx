import { ArrowLeft } from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  SilhouetteOutlineWarmup,
  modelObjectRegistry,
  resolveCameraBoundsMaps,
  resolveEnvironmentFileUrl,
  unionObjectBounds,
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
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useSceneZoneStore } from '../model/use-scene-zone-store';
import { useSceneDock } from '../model/use-scene-dock';
import { useTagBindingSource } from '../model/use-tag-binding-source';
import {
  collisionViewRadius,
  computeCollisionViewPose,
  resolveRecordNodes,
} from '../lib/scene-collision-pairs';
import { RigDriver } from './rig-driver';
import { SceneCollisionAlertOverlay } from './scene-collision-alert-overlay';
import { SceneCollisionDetector } from './scene-collision-detector';
import { SceneCollisionHighlight } from './scene-collision-highlight';
import { SceneCollisionMenu } from './scene-collision-menu';
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
import { useModelRuntimeStatuses } from '../model/use-model-runtime-statuses';
import { ScenePerfHud } from './scene-perf-hud';
import { ScenePerfProbe } from './scene-perf-probe';
import { SceneWarmupIndicator } from './scene-warmup-indicator';
import { SceneSimulationToggle } from './scene-simulation-toggle';
import { SceneViewBookmarks } from './scene-view-bookmarks';

const DEFAULT_CAMERA_POSITION: Vector3Tuple = [-65, 20, -10];
const DEFAULT_CAMERA_TARGET: Vector3Tuple = [-65, 0, -35];

interface Monitoring3dViewProps {
  regionId: string;
  alarmsByCraneId?: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  mode?: 'simulation' | 'replay' | 'realtime';
  /**
   * `mode='simulation'` 일 때 진입 즉시 가상 태그 재생을 켤지. 기본 true.
   * 독 ▶ 토글이 없는 뷰(대시보드 3D 미리보기 모달)는 false 로 두어 정지
   * 상태로 연다.
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
   * 상태에 따라 바꿔야 안정적으로 반영된다. undefined면 기기 기본값.
   */
  canvasDpr?: number | [number, number];
  /**
   * 조작 UI 배치. 'top-right'(기본)는 우측 상단 툴바(대시보드 미리보기 등
   * 작은 뷰). 'dock' 은 hover 펼침·고정 가능한 우측 독 레일 — 카메라
   * 버튼·toolbarExtras·북마크·시뮬레이션 토글. 독은 전체화면 루트 안이라
   * 전체화면에서도 같은 구성이 유지된다 (실시간 모니터링 화면).
   * 'none' 은 조작 UI 없이 씬만 보여준다 (대시보드 미리보기 모달).
   */
  toolbarLayout?: 'top-right' | 'dock' | 'none';
}

const EMPTY_ALARMS: Record<string, AlarmSeverity> = {};

export function Monitoring3dView({
  regionId,
  alarmsByCraneId = EMPTY_ALARMS,
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
}: Monitoring3dViewProps) {
  const { t } = useTranslation();
  const isDock = toolbarLayout === 'dock';
  // 독 상태는 여기서 소유한다 — 앱 페이지에 두면 페이지 리렌더가 cameraPreset
  // 참조를 흔들어 카메라가 리셋되는 사고(아래 주석)로 이어진다.
  const toolsDock = useSceneDock('tools');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const { sceneInfo, isLoading } = useSceneData(regionId, mode, {
    autoStartSimulation,
  });
  // 캔버스는 항상 frameloop='demand' 다 — 프레임은 SceneFrameGovernor 가
  // 애니메이션 소스(재생·수신·기즈모)가 있을 때 30fps 로, 정지 씬은 조작
  // invalidate 만으로 만든다(2026-09-11, 유휴 발열 절감). 바다(EXR 배경)
  // 씬은 파도가 상시 애니메이션이라 거버너에 알려 30fps 를 유지한다 —
  // 예전 demand 모달에서 파도가 얼어붙던 문제의 해법이다.
  const hasSea =
    resolveEnvironmentFileUrl(regionId, sceneInfo?.environmentId) !== null;
  const solarSun = sceneInfo?.lighting?.sunMode === 'solar';
  // 태그 값 버스(가상 태그·WebSocket·리플레이) → 씬 맵핑 → 값 저장소. 드라이버는
  // Canvas 안(RigDriver)에서 매 프레임 노드에 적용한다.
  useTagBindingSource(sceneInfo, true);
  // 모델별 운전 상태(태그 활동 기반) — 라벨 점·미니맵 마커·HUD 가 공유한다.
  // 상태가 실제로 바뀔 때만 참조가 바뀐다(1Hz 판정).
  const runtimeStatuses = useModelRuntimeStatuses(sceneInfo);
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const exitFocus = useObjectFocusStore((s) => s.exitFocus);
  // 충돌 감지는 시뮬레이션·실시간에서 켠다. 실시간 정지는 화면 반영 보류
  // (scene-collision-hold)다. 리플레이는 기록 재생이라 정지·복원 대상이 아니다.
  const collisionActive = mode !== 'replay';
  const collisionRunner = mode === 'realtime' ? 'realtime' : 'simulation';
  const collisionEnabled = useSceneCollisionStore((s) => s.enabled);
  // 영역 침범은 상태 표시라 리플레이 포함 전 모드에서 돈다(정지·복원 없음).
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

  // "충돌 지점 보기" — 접촉점을 타깃으로, 현재 시선 방향을 유지한 채 두 노드가
  // 들어오는 거리로 물러난다(수치 계산은 lib/scene-collision-pairs).
  const handleViewCollision = useCallback(() => {
    const { history, activeRecordId } = useSceneCollisionStore.getState();
    const record = history.find((r) => r.id === activeRecordId);
    if (!record) return;
    const pose = computeCollisionViewPose(
      record.contactPoint,
      collisionViewRadius(resolveRecordNodes([record.a, record.b])),
      sceneControllerRef.current?.getPose() ?? null,
    );
    sceneControllerRef.current?.moveTo(pose.position, pose.target);
  }, []);

  const cameraPosition = sceneInfo?.camera?.position ?? DEFAULT_CAMERA_POSITION;
  const cameraTarget = sceneInfo?.camera?.target ?? DEFAULT_CAMERA_TARGET;
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

  // 좌측 상단 열 — 포커스 복귀 버튼 위, 후처리 상태(BVH 빌드 등) 아래.
  const topLeftOverlay = (
    <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-2">
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
      <SceneWarmupIndicator />
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

  return (
    <div
      ref={rootRef}
      className="relative h-full min-h-0 w-full bg-(--canvas-background)"
    >
      <ThreeSceneViewer
        cameraPreset={cameraPreset}
        cameraClip={SCENE_CAMERA_CLIP}
        canvasProps={{
          dpr: canvasDpr,
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
            {collisionActive ? (
              <SceneCollisionAlertOverlay
                runner={collisionRunner}
                onViewCollision={handleViewCollision}
                // 독 배치는 상단 중앙에 관제 HUD 가 있어 그 아래로 내린다.
                bannerClassName={isDock ? 'top-16' : undefined}
              />
            ) : null}
            {overlayExtras}
            {/* 2D 미니맵(좌하단) — 독 배치(실시간 모니터링 화면)에서만. 배경은
                Canvas 안 SceneMinimapCapture 의 탑뷰 스냅샷, 마커·카메라는 폴링. */}
            {isDock ? (
              <SceneMinimap
                sceneInfo={sceneInfo}
                alarmsByCraneId={alarmsByCraneId}
                runtimeStatuses={runtimeStatuses}
                getPose={handleGetPose}
                onMoveTo={handleMoveTo}
              />
            ) : null}
            {/* 관제 요약 HUD(상단 중앙) — 독 배치에서만. */}
            {isDock ? (
              <SceneStatusHud
                regionId={regionId}
                runtimeStatuses={runtimeStatuses}
                alarmsByCraneId={alarmsByCraneId}
              />
            ) : null}
            {/* dev 전용 성능 HUD(좌하단) — localStorage crane:perf-hud='1'
                일 때만 표시. 값은 Canvas 안 ScenePerfProbe 가 기록한다.
                미니맵과 겹치지 않게 그 오른쪽에 둔다. */}
            <ScenePerfHud className={isDock ? 'left-60' : undefined} />
          </>
        }
        fullscreenOverlay={fullscreenOverlay}
        fullscreenTopRightOverlay={fullscreenTopRightOverlay}
        fullscreenTopCenterOverlay={fullscreenTopCenterOverlay}
        toolbarExtras={
          isDock ? (
            // 독 레일에는 페이지가 준 버튼 뒤에 시뮬레이션 재생 토글과 충돌
            // 감지 팝업을 붙인다(실시간 모니터링 화면 공통). 작은 뷰(top-right)
            // 에는 두지 않는다.
            <>
              {toolbarExtras}
              <SceneSimulationToggle />
              <SceneMinimapToggle />
              {collisionActive ? (
                <SceneCollisionMenu
                  runner={collisionRunner}
                  onViewCollision={handleViewCollision}
                />
              ) : null}
              {/* 현장 시각·낮/밤 — 태양 위치를 시각에 연동한 씬(sunMode solar)
                  의 시각 미리보기. 수동 태양 씬에서도 안내용으로 둔다. */}
              <SceneClockMenu regionId={regionId} sceneInfo={sceneInfo} />
            </>
          ) : (
            toolbarExtras
          )
        }
        toolbarPlacement={toolbarLayout}
        dockRight={dockRight}
        toolbarTrailing={
          toolbarLayout === 'none' ? undefined : (
            <SceneViewBookmarks
              regionId={regionId}
              variant={isDock ? 'rail' : 'toolbar'}
              getPose={handleGetPose}
              onMoveTo={handleMoveTo}
            />
          )
        }
        onControllerReady={handleControllerReady}
      >
        {/* 프레임 요청의 유일한 상시 틱 — 위 frameloop 주석 참고. */}
        <SceneFrameGovernor animating={hasSea} slow={solarSun} />
        {/* regionId 는 solar 모드(현장 시각 기반 낮/밤)의 위치·시간대 키. */}
        <SceneLighting sceneInfo={sceneInfo} regionId={regionId} />
        <SceneSurfaceCamera
          regionId={regionId}
          environmentId={sceneInfo?.environmentId}
        />
        {/* 표면 카메라 바로 다음 — 같은 priority 의 useFrame 은 마운트 순서라
            표면 피벗 뒤에 이동 범위·바닥을 clamp 한다. */}
        <SceneCameraLimits sceneInfo={sceneInfo} />
        {/* 카메라 확정 뒤 지형 타일 LOD 전환 — 이 프레임의 최종 시점 기준. */}
        <SceneTerrainLod />
        {/* 배경 파노라마는 자체 Suspense — 4K EXR(수~십수 MB)이 씬(맵·모델)
            표시를 붙잡지 않고, 로드되는 대로 단색 배경을 대체한다 */}
        <Suspense fallback={null}>
          <SceneEnvironment
            regionId={regionId}
            environmentId={sceneInfo?.environmentId}
          />
        </Suspense>
        <Suspense fallback={null}>
          <RigDriver sceneInfo={sceneInfo} />
          {/* 드라이버 바로 다음 — 같은 priority 의 useFrame 은 마운트 순서로
              실행되므로 노드가 움직인 뒤 검사한다. */}
          {collisionActive ? (
            <SceneCollisionDetector
              sceneInfo={sceneInfo}
              enabled={collisionEnabled}
              runner={collisionRunner}
            />
          ) : null}
          <SceneCollisionHighlight />
          {/* 영역 침범 검출·링 — 검출기 뒤에 링을 두어 같은 틱 상태를 읽는다. */}
          <SceneZoneDetector sceneInfo={sceneInfo} enabled={zonesEnabled} />
          <SceneZoneRings sceneInfo={sceneInfo} />
          {/* 충돌 테두리(실루엣) 셰이더·사본 프리워밍 — 감지가 도는 모드만. */}
          {collisionActive ? <SilhouetteOutlineWarmup /> : null}
          <OutdoorWorkModelSimulation
            sceneInfo={sceneInfo}
            regionId={regionId}
            alarmsByCraneId={alarmsByCraneId}
            alarmHighlightMesh={alarmHighlightMesh}
            mode={mode}
            onMoveTo={handleMoveTo}
            onResetCamera={handleResetCamera}
            getPose={handleGetPose}
            prepareOutline={collisionActive}
            runtimeStatuses={runtimeStatuses}
          />
          {sceneExtras}
          <SceneReadyProbe onReady={handleSceneReady} />
          <ScenePerfProbe />
          {/* 미니맵 배경 스냅샷 — 씬 준비 뒤 한 번 탑뷰를 렌더 타깃에 찍는다. */}
          {isDock ? (
            <SceneMinimapCapture sceneInfo={sceneInfo} ready={sceneReady} />
          ) : null}
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
