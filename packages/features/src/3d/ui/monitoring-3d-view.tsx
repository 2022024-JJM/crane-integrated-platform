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
import { SceneCollisionPrediction } from './scene-collision-prediction';
import { SceneCollisionPredictionHighlight } from './scene-collision-prediction-highlight';
import { SceneCollisionPredictionOverlay } from './scene-collision-prediction-overlay';
import { SceneCollisionMenu } from './scene-collision-menu';
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
   * R3F 프레임루프 모드. 기본 undefined(= 'always', 매 프레임 렌더).
   * 'demand' 는 invalidate() 가 불린 프레임만 렌더한다 — **로드 후 완전
   * 정지가 보장되는 뷰만** 켠다(대시보드 3D 미리보기 모달: autoStart
   * Simulation=false). 재생 중 모니터링·realtime(WS 수신이 useFrame 드레인에
   * 기댐)에는 켜지 말 것 — 화면이 다음 조작까지 낡은 프레임에 머문다.
   * 바다 씬(파도 uTime 상시 애니메이션)은 호출부가 몰라도 되게 아래에서
   * 씬의 environment 유무로 자동 무시된다 — goliath/philly 씬을 이 모달로
   * 열면 파도가 얼어붙는 품질 저하가 있었다.
   */
  frameloop?: 'always' | 'demand';
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
  frameloop,
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
  // 바다(EXR 배경) 씬은 파도가 상시 애니메이션이라 demand 로 돌리면 물이
  // 사진처럼 얼어붙는다 — 호출부의 demand 요청을 씬 데이터 기준으로 무시한다
  // (frameloop prop 주석). isLoading 동안은 sceneInfo 가 없어 캔버스도 아직
  // 없으므로 판정 시점 문제가 없다.
  const effectiveFrameloop =
    frameloop === 'demand' &&
    resolveEnvironmentFileUrl(regionId, sceneInfo?.environmentId) !== null
      ? undefined
      : frameloop;
  // 태그 값 버스(가상 태그·WebSocket·리플레이) → 씬 맵핑 → 값 저장소. 드라이버는
  // Canvas 안(RigDriver)에서 매 프레임 노드에 적용한다.
  useTagBindingSource(sceneInfo, true);
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const exitFocus = useObjectFocusStore((s) => s.exitFocus);
  // 충돌 감지는 시뮬레이션·실시간에서 켠다. 실시간 정지는 화면 반영 보류
  // (scene-collision-hold)다. 리플레이는 기록 재생이라 정지·복원 대상이 아니다.
  const collisionActive = mode !== 'replay';
  const collisionRunner = mode === 'realtime' ? 'realtime' : 'simulation';
  const collisionEnabled = useSceneCollisionStore((s) => s.enabled);

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

  // "예상 지점 보기" — 충돌 지점 보기와 같은 수식. 대상 노드는 예측 당사자의
  // 모델 루트다(예측 박스는 미래 위치지만 카메라는 현재 장비를 담아야 한다).
  const handleViewPrediction = useCallback(() => {
    const { predicted } = useSceneCollisionStore.getState();
    if (!predicted) return;
    const pose = computeCollisionViewPose(
      predicted.contactPoint,
      collisionViewRadius(
        resolveRecordNodes([
          { ...predicted.a, nodePath: '' },
          { ...predicted.b, nodePath: '' },
        ]),
      ),
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
          frameloop: effectiveFrameloop,
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
              />
            ) : null}
            {/* 예측 경보 — 실제 충돌 경보가 떠 있으면 스스로 내려간다. */}
            {collisionActive ? (
              <SceneCollisionPredictionOverlay
                onViewPrediction={handleViewPrediction}
              />
            ) : null}
            {overlayExtras}
            {/* dev 전용 성능 HUD(좌하단) — localStorage crane:perf-hud='1'
                일 때만 표시. 값은 Canvas 안 ScenePerfProbe 가 기록한다. */}
            <ScenePerfHud />
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
              {collisionActive ? (
                <SceneCollisionMenu
                  runner={collisionRunner}
                  onViewCollision={handleViewCollision}
                />
              ) : null}
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
        <SceneLighting sceneInfo={sceneInfo} />
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
          {/* 검사기 직후 — 예측이 앞서면 감지의 변화 감지가 미래 행렬을
              움직임으로 읽어 거짓 충돌을 보고한다.

              감지와 같은 범위다(리플레이만 제외). 실제로 도는 조건은 "가상
              태그 러너가 값을 만드는 중" 이고 그 판정은 훅 안에 있다 —
              실시간 모니터링 화면도 독 ▶ 로 가상 태그를 켜면 그것이 장비를
              움직이므로 예측이 성립한다. */}
          {collisionActive ? (
            <SceneCollisionPrediction
              sceneInfo={sceneInfo}
              enabled={collisionEnabled}
            />
          ) : null}
          <SceneCollisionHighlight />
          <SceneCollisionPredictionHighlight />
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
          />
          {sceneExtras}
          <SceneReadyProbe onReady={handleSceneReady} />
          <ScenePerfProbe />
        </Suspense>
      </ThreeSceneViewer>
    </div>
  );
}
