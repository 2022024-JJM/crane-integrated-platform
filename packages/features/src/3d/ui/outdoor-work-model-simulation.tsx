import { useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import type { AlarmSeverity } from '@crane/domain/alarm';
import {
  GltfModel,
  SceneRuler,
  SceneText,
  buildLabelReadings,
  isContextMap,
  resolveMapShading,
  getSceneMetersPerUnit,
  loadSceneInfoByRegionId,
  markSceneRegionActive,
  preloadGltf,
  releaseSceneRegionAssets,
  resolveSeaVisible,
  type ModelLabelTitles,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import { useSceneInfoStore } from '../model/use-scene-info-store';
import { usePlanOverlapStore } from '../model/use-plan-overlap-store';
import { usePlanLookStore } from '../model/use-plan-look-store';
import { isPlanLookCamera } from '../lib/plan-look';
import { stopSimulation } from '../model/stop-simulation';
import { readTagLiveValue } from '../model/tag-value-bus';
import type { MonitoringViewMode } from '../model/types';
import { useScenarioStore } from '../model/use-scenario-store';
import { useReplayPlayerRunner } from '../model/use-replay-player-runner';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { useRealtimeRunner } from '../model/use-realtime-runner';
import { useRealtimeStore } from '../model/use-realtime-store';
import { useCraneSnapshotRealtimeBridge } from '../model/use-crane-snapshot-realtime-bridge';
import type { LabelStateRecord } from '../lib/model-label-state';
import type { OutlineStateRecord } from '../lib/model-outline-state';
import { SceneFloodlightFixture } from './scene-floodlight-fixture';
import { SceneFloodlights } from './scene-floodlights';
import { SceneObjectBoundary } from './scene-object-boundary';

export function useSceneData(regionId: string, mode: MonitoringViewMode) {
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** 이 region이 로드한 GLB 경로. cleanup에서 캐시를 비울 때 쓴다. */
  const loadedAssetPathsRef = useRef<string[]>([]);
  const setSceneInfoInStore = useSceneInfoStore((s) => s.setSceneInfo);
  const clearSceneInfoFromStore = useSceneInfoStore((s) => s.clearSceneInfo);
  const setActiveMode = useSceneInfoStore((s) => s.setActiveMode);
  const setActiveRegionId = useSceneInfoStore((s) => s.setActiveRegionId);
  const loadScenarios = useScenarioStore((s) => s.load);
  const resetReplay = useReplayPlayerStore((s) => s.reset);
  const startRealtime = useRealtimeStore((s) => s.start);
  const stopRealtime = useRealtimeStore((s) => s.stop);

  useEffect(() => {
    let isMounted = true;
    // 이 지역 화면이 올라왔음을 모듈 전역에 표시한다. 실시간↔리플레이↔에디터는
    // 서로 다른 컴포넌트라 언마운트/마운트로 전환되므로, 컴포넌트 ref로는
    // "같은 지역으로 이어졌다"를 알 수 없다(markSceneRegionActive 주석 참고).
    markSceneRegionActive(regionId);
    // 알람·알림 브릿지가 "실시간 화면의 사건인가" 를 판정하는 근거.
    setActiveMode(mode);
    setActiveRegionId(regionId);

    const load = async () => {
      setIsLoading(true);

      try {
        const data: SavedSceneInfo = await loadSceneInfoByRegionId(regionId);

        if (!isMounted) {
          return;
        }

        setSceneInfo(data);
        setSceneInfoInStore(regionId, data);
        // 이 region이 쓰는 GLB 경로를 기억해 둔다 — cleanup에서 캐시를 비울 때
        // 필요한데, 그 시점엔 state가 이미 초기화됐을 수 있다.
        const assetPaths = [
          ...(data.models ?? []).map((m) => m.path),
          ...(data.maps ?? []).map((m) => m.path),
        ];
        loadedAssetPathsRef.current = assetPaths;

        // 씬 JSON이 필요한 GLB 목록을 이미 알고 있으므로 곧바로 프리로드를
        // 시작한다. 이걸 안 하면 컴포넌트가 마운트되며 하나씩 요청이 나가
        // 직렬에 가깝게 로드된다 — 지역 진입당 14~35MB라 체감 지연이 크다.
        // 중복 경로는 Set으로 걸러 같은 GLB를 두 번 요청하지 않는다.
        for (const path of new Set(assetPaths)) {
          preloadGltf(path);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSceneInfo(null);
        console.error('Failed to load monitoring scene.', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // 러너는 모듈 싱글턴이라 이전 화면(에디터·다른 리전)의 시간·시나리오·
    // 자세가 남아 있다 — 화면에 들어올 때마다 처음 상태에서 시작한다.
    stopSimulation();
    if (mode === 'realtime') {
      startRealtime();
      // 다른 모드에서 남은 replay 재생 상태가 useReplayPlayerRunner를 통해
      // 이 mode에서도 계속 tick하지 않도록 진입 시 항상 정리.
      resetReplay();
    } else {
      // 3D 플레이 — 소스(리플레이|시뮬레이션)는 usePlay3dStore 가 들고
      // Play3dView 가 전환을 정리한다. 여기서는 둘 다 깨끗이 시작하고
      // 정의만 읽어 둔다(자동 재생 없음 — ▶ 가 실행의 시작점이다).
      resetReplay();
      void loadScenarios();
    }
    void load();

    return () => {
      isMounted = false;
      setActiveMode(null);
      setActiveRegionId(null);
      stopRealtime();
      // unmount 시 replay 재생 상태도 함께 정리. 그렇지 않으면 다른 페이지로
      // 이동해도 store는 유지되어 useReplayPlayerRunner가 isPlaying=true일 때
      // 매 프레임 tick → applyValue를 호출, 실시간·시뮬레이션의 값과 충돌.
      resetReplay();
      // 가상 태그 재생은 이 화면이 켠 것이므로 떠날 때 **종료**한다(시간 0·
      // 시나리오 해제·배속 1) — 다음 화면이 남은 자세·시간을 이어받지 않는다.
      stopSimulation();
      clearSceneInfoFromStore(regionId);
      // 이 region의 GLB 캐시를 비운다. 해제하지 않으면 지역을 오갈수록
      // 메모리가 단조 증가해 장시간 세션에서 탭이 죽는다.
      //
      // 단, **region이 실제로 바뀔 때만** 비운다. 이 effect는 mode(실시간 ↔
      // 3D 플레이)에도 재실행되는데, 같은 지역에서 모드만 바꿨는데
      // 캐시를 버리면 수십 MB를 다시 받는다 — 모드 전환은 흔한 조작이라
      // 그때마다 로딩이 걸리면 오히려 퇴보다.
      const pathsToRelease = loadedAssetPathsRef.current;
      loadedAssetPathsRef.current = [];
      releaseSceneRegionAssets(regionId, pathsToRelease);
    };
  }, [
    clearSceneInfoFromStore,
    loadScenarios,
    mode,
    regionId,
    resetReplay,
    setActiveMode,
    setActiveRegionId,
    setSceneInfoInStore,
    startRealtime,
    stopRealtime,
  ]);

  return { sceneInfo, isLoading };
}

interface OutdoorWorkModelSimulationProps {
  sceneInfo: SavedSceneInfo | null;
  regionId: string;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  mode: MonitoringViewMode;
  onResetCamera?: () => void;
  /**
   * 모델의 실루엣 테두리 사본을 워밍업 큐에서 미리 만들지(GltfModel 로
   * 전달). 충돌 하이라이트가 그려질 수 있는 모니터링만 켠다 — 리플레이는
   * 충돌 감지가 없다. 지도에는 켜지 않는다.
   */
  prepareOutline?: boolean;
  /**
   * 모델별 라벨 표시 상태(useModelStatusRecords). 라벨의 색·아이콘으로
   * 넘긴다. 뷰가 한 번 판정해 HUD 의 운전 상태와 함께 낸다.
   */
  labelStates?: LabelStateRecord;
  /**
   * 모델별 외곽선(useModelStatusRecords) — 통신불량·Slowdown·Endstop. 캔버스에
   * 스텐실 버퍼가 있어야 한다(SCENE_GL_OPTIONS).
   */
  outlineStates?: OutlineStateRecord;
}

const NO_LABEL_STATES: LabelStateRecord = Object.freeze({});
const NO_OUTLINE_STATES: OutlineStateRecord = Object.freeze({});

export function OutdoorWorkModelSimulation({
  sceneInfo,
  regionId,
  alarmsByCraneId,
  alarmHighlightMesh = false,
  mode,
  onResetCamera,
  prepareOutline = false,
  labelStates = NO_LABEL_STATES,
  outlineStates = NO_OUTLINE_STATES,
}: OutdoorWorkModelSimulationProps) {
  const { t } = useTranslation();
  // 라벨(domain)은 i18n 을 모른다 — 번역한 문구를 한 묶음으로 넘긴다. 참조가
  // 유지돼야 memo 된 모델이 리렌더되지 않는다.
  const labelTitles = useMemo<ModelLabelTitles>(
    () => ({
      tone: {
        fault: t('monitoring:runtimeStatus.fault'),
        running: t('monitoring:runtimeStatus.running'),
        standby: t('monitoring:runtimeStatus.standby'),
        off: t('monitoring:runtimeStatus.off'),
        offline: t('monitoring:runtimeStatus.offline'),
        unknown: t('monitoring:runtimeStatus.unknown'),
      },
      bypass: t('monitoring:labelState.bypass'),
      freeSwing: t('monitoring:labelState.freeSwing'),
    }),
    [t],
  );
  // 바다가 켜진 씬(resolveSeaVisible)에서만 모델·지도의 수면 아래를 잠김
  // 처리한다 — 바다가 없는 씬에서 y<0 부분에 물 색이 끼면 안 된다.
  const seaVisible = resolveSeaVisible(sceneInfo);
  // 평면도(직교 탑뷰) 여부 — 탑뷰는 기본 카메라를 직교로 교체하는 토글이라
  // 카메라 종류가 곧 모드다. 구독은 교체 순간에만 리렌더를 일으킨다.
  const planLook = usePlanLookStore((s) => s.enabled);
  const planView = useThree((s) => isPlanLookCamera(s.camera, planLook));
  // 평면도 숨은선 대상 — 검출기(ScenePlanOverlapDetector)가 탑뷰에서 채운다.
  const planHiddenIndexById = usePlanOverlapStore((s) => s.hiddenIndexById);
  // runner 는 항상 mount — 각자 내부 플래그(isRunning / isPlaying)로 비활성화.
  // 시나리오는 Canvas 밖 setInterval 러너라 여기 없다(virtual-tag-runner).
  useReplayPlayerRunner();
  useRealtimeRunner();
  useCraneSnapshotRealtimeBridge(mode === 'realtime');

  const maps = sceneInfo?.maps ?? [];
  const models = sceneInfo?.models ?? [];
  const texts = sceneInfo?.texts ?? [];
  const rulers = sceneInfo?.rulers ?? [];
  const floodlights = sceneInfo?.floodlights;
  const metersPerUnit = getSceneMetersPerUnit(regionId);
  // 라벨 위 태그 값 목록 — 모델마다 참조를 고정해야 memo 된 GltfModel 이
  // 렌더마다 다시 그려지지 않는다. 키는 모델 craneId 로 조립한다 — 어느
  // 생산자의 값인지는 버스 게이트가 정하므로 소스 전환에 무관하다.
  const sceneModels = sceneInfo?.models;
  const labelReadingsById = useMemo(
    () =>
      new Map(
        (sceneModels ?? []).map((model) => [
          model.id,
          buildLabelReadings(model),
        ]),
      ),
    [sceneModels],
  );

  const onResetCameraRef = useRef(onResetCamera);
  onResetCameraRef.current = onResetCamera;

  // 마운트 때 씬 기본 카메라로 한 번 리셋한다. 마운트에만 묶는다 — 기본
  // 카메라 교체(직교 탑뷰)마다 다시 돌면 탑뷰 직후 메인 뷰로 되돌아간다.
  useEffect(() => {
    onResetCameraRef.current?.();
  }, []);

  return (
    <>
      {/* GLB 로드 객체는 개별 경계로 감싼다 — 하나가 404여도 나머지 씬은
          그대로 보인다. 관제 화면에서 모델 하나 때문에 전체가 비면 안 된다. */}
      {maps.map((m) => {
        // 컨텍스트 지형(role === 'context', philly-terrain 등)은
        // 그림자 시스템에서 뺀다 — shadow map 은 매 프레임 다시 그려지는데
        // 178만 삼각형 지형이 depth pass 의 대부분을 차지했고(실측: philly
        // 씬 shadow pass 의 ~78%), 작업 구역 밖 도시 건물 그림자는 관제
        // 줌에서 보이지 않는다. 받는 쪽(receiveShadow)도 끈다 — 모델은 전부
        // 작업 구역(ground 지도) 안이라 이 지형 위에 떨어질 그림자가 없는데
        // 화면 큰 면적에서 PCF 9탭 샘플링만 하게 된다. 에디터도 같은 규칙
        // (scene-objects-edit-canvas.tsx) — 저작 화면과 실제 화면이 같아야 한다.
        const contextMap = isContextMap(m);
        return (
          // 지도도 BVH를 빌드한다(기본값) — 프리미티브 수십 개짜리 지형이라
          // 빌드는 유휴 시간에 싸게 끝나고, 없으면 포인터 이동마다 수십만
          // 삼각형 브루트포스 raycast가 프레임을 밀어낸다(model-mesh 주석 참고).
          // showLabel=false: 지도는 라벨이 없으므로 마운트 시 전체 트리 bbox
          // 순회(수십만 정점)를 건너뛴다.
          <SceneObjectBoundary key={m.id} label={`map ${m.path}`}>
            <GltfModel
              id={m.id}
              url={m.path}
              position={m.position}
              rotation={m.rotation}
              scale={m.scale}
              showLabel={false}
              // ground 지도는 그림자를 드리운다(기본값) — GLB에 건물이 함께
              // 구워져 있어 끄면 건물 그림자가 통째로 사라진다.
              castShadow={!contextMap}
              receiveShadow={!contextMap}
              // 주변 지형은 Lambert, 그 외 지도는 무광(태양·하늘 반사 제거) —
              // 판정은 domain resolveMapShading 하나. 에디터도 같은 함수.
              shading={resolveMapShading(m)}
              // 수면 아래 지형(해안 경사·안벽)도 모델처럼 잠긴다. 바다가 닿지
              // 않는 곳(드라이독)은 셰이더가 마스크로 거른다.
              seaSubmersion={seaVisible}
              planView="ground"
            />
          </SceneObjectBoundary>
        );
      })}
      {/* 관제 화면은 모델 클릭을 받지 않는다 — onSelect 를 넘기지 않는다. */}
      {models.map((model) => (
        <SceneObjectBoundary
          key={model.id}
          label={`model ${model.equipName || model.id} (${model.path})`}
        >
          <GltfModel
            id={model.id}
            url={model.path}
            equipName={model.equipName}
            showLabel={!model.labelHidden}
            opacity={model.opacity}
            alarmSeverity={
              model.craneId ? (alarmsByCraneId[model.craneId] ?? null) : null
            }
            alarmHighlightMesh={alarmHighlightMesh}
            labelState={labelStates[model.id]}
            outlineState={outlineStates[model.id]}
            planOutline={planView}
            planLabel={planView}
            planHiddenIndex={planHiddenIndexById.get(model.id) ?? null}
            labelTitles={labelTitles}
            labelReadings={labelReadingsById.get(model.id)}
            readLabelValue={readTagLiveValue}
            seaSubmersion={seaVisible}
            prepareOutline={prepareOutline}
            position={model.position}
            rotation={model.rotation}
            scale={model.scale}
          />
        </SceneObjectBoundary>
      ))}
      {texts.map((text) => (
        <SceneText
          key={text.id}
          id={text.id}
          content={text.content}
          color={text.color}
          position={text.position}
          rotation={text.rotation}
          scale={text.scale}
        />
      ))}
      {/* 거리 눈금 — onSelect 를 넘기지 않아 클릭이 통과한다(관제 화면). */}
      {rulers.map((ruler) => (
        <SceneRuler
          key={ruler.id}
          id={ruler.id}
          position={ruler.position}
          rotation={ruler.rotation}
          length={ruler.length}
          interval={ruler.interval}
          textColor={ruler.textColor}
          dotColor={ruler.dotColor}
          textSize={ruler.textSize}
          dotSize={ruler.dotSize}
          guide={ruler.guide}
          startValue={ruler.startValue}
          unitHidden={ruler.unitHidden}
          metersPerUnit={metersPerUnit}
        />
      ))}
      {/* 투광등 — 밤에만 켜진다. 빛은 슬롯(SceneFloodlights), 광원 글로우는
          기구(SceneFloodlightFixture). 관제 화면은 클릭을 받지 않는다. */}
      <SceneFloodlights floodlights={floodlights} />
      {(floodlights ?? []).map((light) => (
        <SceneFloodlightFixture
          key={light.id}
          id={light.id}
          position={light.position}
          aim={light.aim}
          angle={light.angle}
        />
      ))}
    </>
  );
}
