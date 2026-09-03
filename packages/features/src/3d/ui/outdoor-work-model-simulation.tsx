import { useCallback, useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Box3, MathUtils, Object3D, PerspectiveCamera, Vector3 } from 'three';
import type { AlarmSeverity } from '@crane/domain/alarm';
import {
  GltfModel,
  SceneText,
  loadSceneInfoByRegionId,
  markSceneRegionActive,
  preloadGltf,
  releaseSceneRegionAssets,
  resolveEnvironmentFileUrl,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  useObjectFocusStore,
  type FocusCameraPose,
} from '../model/use-object-focus-store';
import { useSceneInfoStore } from '../model/use-scene-info-store';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import { useReplayPlayerRunner } from '../model/use-replay-player-runner';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { useRealtimeRunner } from '../model/use-realtime-runner';
import { useRealtimeStore } from '../model/use-realtime-store';
import { useRealtimeWebSocketBridge } from '../model/use-realtime-websocket-bridge';
import { isFocusGhosted, resolveFocusOpacity } from '../lib/focus-ghost';
import { SceneObjectBoundary } from './scene-object-boundary';

export function useSceneData(
  regionId: string,
  mode: 'simulation' | 'replay' | 'realtime' = 'simulation',
) {
  const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** 이 region이 로드한 GLB 경로. cleanup에서 캐시를 비울 때 쓴다. */
  const loadedAssetPathsRef = useRef<string[]>([]);
  const setSceneInfoInStore = useSceneInfoStore((s) => s.setSceneInfo);
  const clearSceneInfoFromStore = useSceneInfoStore((s) => s.clearSceneInfo);
  const loadVirtualTags = useVirtualTagStore((s) => s.load);
  const startSimulation = useVirtualTagStore((s) => s.start);
  const pauseSimulation = useVirtualTagStore((s) => s.pause);
  const resetReplay = useReplayPlayerStore((s) => s.reset);
  const startRealtime = useRealtimeStore((s) => s.start);
  const stopRealtime = useRealtimeStore((s) => s.stop);

  useEffect(() => {
    let isMounted = true;
    // 이 지역 화면이 올라왔음을 모듈 전역에 표시한다. 실시간↔리플레이↔에디터는
    // 서로 다른 컴포넌트라 언마운트/마운트로 전환되므로, 컴포넌트 ref로는
    // "같은 지역으로 이어졌다"를 알 수 없다(markSceneRegionActive 주석 참고).
    markSceneRegionActive(regionId);

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

    if (mode === 'simulation') {
      // 시뮬레이션 = 가상 태그 재생. 정의는 배포 파일에서 한 번 읽는다.
      void loadVirtualTags();
      startSimulation();
      // 다른 모드에서 남은 replay 재생 상태가 useReplayPlayerRunner를 통해
      // 이 mode에서도 계속 tick하지 않도록 진입 시 항상 정리.
      resetReplay();
    } else if (mode === 'realtime') {
      startRealtime();
      resetReplay();
    } else {
      resetReplay();
    }
    void load();

    return () => {
      isMounted = false;
      stopRealtime();
      // unmount 시 replay 재생 상태도 함께 정리. 그렇지 않으면 다른 페이지로
      // 이동해도 store는 유지되어 useReplayPlayerRunner가 isPlaying=true일 때
      // 매 프레임 tick → applyValue를 호출, realtime/simulation의 값과 충돌.
      resetReplay();
      // 가상 태그 재생은 이 화면이 켠 것이므로 떠날 때 멈춘다. 노드 복귀는
      // 드라이버(useTagBindingSource 의 reset + RigDriver 언마운트)가 한다.
      pauseSimulation();
      clearSceneInfoFromStore(regionId);
      // 이 region의 GLB 캐시를 비운다. 해제하지 않으면 지역을 오갈수록
      // 메모리가 단조 증가해 장시간 세션에서 탭이 죽는다.
      //
      // 단, **region이 실제로 바뀔 때만** 비운다. 이 effect는 mode(시뮬레이션
      // ↔ 실시간 ↔ 리플레이)에도 재실행되는데, 같은 지역에서 모드만 바꿨는데
      // 캐시를 버리면 수십 MB를 다시 받는다 — 모드 전환은 흔한 조작이라
      // 그때마다 로딩이 걸리면 오히려 퇴보다.
      const pathsToRelease = loadedAssetPathsRef.current;
      loadedAssetPathsRef.current = [];
      releaseSceneRegionAssets(regionId, pathsToRelease);
    };
  }, [
    clearSceneInfoFromStore,
    loadVirtualTags,
    mode,
    pauseSimulation,
    regionId,
    resetReplay,
    setSceneInfoInStore,
    startRealtime,
    startSimulation,
    stopRealtime,
  ]);

  return { sceneInfo, isLoading };
}

interface OutdoorWorkModelSimulationProps {
  sceneInfo: SavedSceneInfo | null;
  regionId: string;
  alarmsByCraneId: Record<string, AlarmSeverity>;
  alarmHighlightMesh?: boolean;
  mode?: 'simulation' | 'replay' | 'realtime';
  onMoveTo?: (position: Vector3Tuple, target: Vector3Tuple) => void;
  onResetCamera?: () => void;
  /**
   * 현재 카메라 포즈. 모델 포커스 진입 순간에 잡아 두었다가 돌아가기 때
   * 그 시점으로 복귀한다. null 이면 해제 시 onResetCamera 로 폴백.
   */
  getPose?: () => FocusCameraPose | null;
}

export function OutdoorWorkModelSimulation({
  sceneInfo,
  regionId,
  alarmsByCraneId,
  alarmHighlightMesh = false,
  mode = 'simulation',
  onMoveTo,
  onResetCamera,
  getPose,
}: OutdoorWorkModelSimulationProps) {
  const camera = useThree((s) => s.camera);
  // 바다(EXR 배경)가 있는 씬에서만 모델의 수면 아래를 잠김 처리한다 — 바다가
  // 없는 씬에서 y<0 부분에 물 색이 끼면 안 된다. 지도에는 걸지 않는다.
  const hasSea =
    resolveEnvironmentFileUrl(regionId, sceneInfo?.environmentId) !== null;
  // runner 는 항상 mount — 각자 내부 플래그(isRunning / isPlaying)로 비활성화.
  // 가상 태그는 Canvas 밖 setInterval 러너라 여기 없다(virtual-tag-runner).
  useReplayPlayerRunner();
  useRealtimeRunner();
  useRealtimeWebSocketBridge(mode === 'realtime');

  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const enterFocus = useObjectFocusStore((s) => s.enterFocus);
  const exitFocus = useObjectFocusStore((s) => s.exitFocus);

  // 프레이밍(카메라 fit) 대상 조회용. 포커스 밖 모델도 마운트를 유지하고
  // 투명하게만 만들므로, 예전처럼 언마운트 대비 박스 캐시를 둘 필요가 없다.
  const objectMapRef = useRef<Map<string, Object3D>>(new Map());

  const handleObjectReady = useCallback(
    (id: string, object: Object3D | null) => {
      if (object) {
        objectMapRef.current.set(id, object);
        return;
      }

      objectMapRef.current.delete(id);
    },
    [],
  );

  const maps = sceneInfo?.maps ?? [];
  const models = sceneInfo?.models ?? [];
  const texts = sceneInfo?.texts ?? [];

  const handleModelClick = useCallback(
    (id: string) => {
      // 포커스는 1단계 — 포커스 중에는 본체·라벨 어느 경로의 클릭도 무시한다.
      // 다른 모델을 보려면 먼저 돌아가기로 빠져나와야 한다. 스토어의
      // enterFocus 도 no-op 이지만 여기서 먼저 끊어 getPose 호출을 아낀다.
      if (useObjectFocusStore.getState().focusedModelId !== null) {
        return;
      }

      // 돌아가기 복귀 지점 = 클릭 순간의 카메라. 아래 프레이밍 effect 가
      // 카메라를 옮기기 전에 잡아야 하므로 렌더 전에 여기서 캡처한다.
      enterFocus(id, getPose?.() ?? null);
    },
    [enterFocus, getPose],
  );

  const onMoveToRef = useRef(onMoveTo);
  onMoveToRef.current = onMoveTo;
  const onResetCameraRef = useRef(onResetCamera);
  onResetCameraRef.current = onResetCamera;

  // 돌아가기 카메라 복귀. exitFocus 가 포즈까지 비우므로 렌더 뒤 effect 로는
  // 읽을 수 없고, 전이 순간의 prev 상태에서 읽는다. 포즈가 없으면(컨트롤러
  // 미준비 상태에서 진입) 씬 기본 카메라로 리셋한다.
  useEffect(
    () =>
      useObjectFocusStore.subscribe((state, prev) => {
        if (prev.focusedModelId === null || state.focusedModelId !== null) {
          return;
        }

        const pose = prev.returnPose;
        if (pose) {
          onMoveToRef.current?.(pose.position, pose.target);
        } else {
          onResetCameraRef.current?.();
        }
      }),
    [],
  );

  // 직전 effect 실행 시점의 포커스 대상. 마운트(포커스 없음)와 해제(포커스
  // 있음 → 없음)를 구분한다 — 해제 시 카메라는 위 subscribe 가 복귀시키므로
  // 여기서 리셋하면 그 복귀를 덮어쓴다.
  const prevFocusedModelIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevFocusedModelId = prevFocusedModelIdRef.current;
    prevFocusedModelIdRef.current = focusedModelId;

    if (!focusedModelId) {
      if (prevFocusedModelId === null) {
        onResetCameraRef.current?.();
      }
      return;
    }

    // 포커스된 모델의 박스에만 카메라를 맞춘다. 겹치는 이웃 모델까지 합치면
    // (예: LLC 클릭 시 골리앗까지 포함) 클릭한 크레인이 화면에서 작아진다.
    // 나머지 모델은 투명 처리로만 물러나고 fit 에는 들어가지 않는다.
    const focusedObject = objectMapRef.current.get(focusedModelId);

    if (!focusedObject) {
      return;
    }

    const groupBox = new Box3().setFromObject(focusedObject);

    if (groupBox.isEmpty()) {
      return;
    }

    const center = groupBox.getCenter(new Vector3());

    const fov = camera instanceof PerspectiveCamera ? camera.fov : 75;
    const aspect = camera instanceof PerspectiveCamera ? camera.aspect : 16 / 9;
    const vFov = MathUtils.degToRad(fov / 2);
    const hFov = Math.atan(Math.tan(vFov) * aspect);

    // Camera direction: use the initial scene camera direction (consistent angle)
    // instead of current camera position (which shifts as user orbits)
    const defaultDir = new Vector3(0, 0.75, 0.65).normalize();

    // 바운딩 구(sphere) 대신 박스 8개 코너를 시야 축에 투영해 필요한 최소
    // 거리를 구한다. 구 반지름(=박스 대각선 절반) 기준은 가로로 긴 크레인을
    // 실제보다 훨씬 멀리서 잡아 "포커스했는데 작아 보이는" 문제가 있었다.
    const right = new Vector3().crossVectors(defaultDir, Object3D.DEFAULT_UP);
    if (right.lengthSq() < 1e-6) {
      right.set(1, 0, 0);
    }
    right.normalize();
    const up = new Vector3().crossVectors(right, defaultDir).normalize();

    const tanH = Math.tan(hFov);
    const tanV = Math.tan(vFov);
    const corner = new Vector3();
    const offset = new Vector3();
    let fitDistance = 0;

    for (let i = 0; i < 8; i += 1) {
      corner.set(
        i & 1 ? groupBox.max.x : groupBox.min.x,
        i & 2 ? groupBox.max.y : groupBox.min.y,
        i & 4 ? groupBox.max.z : groupBox.min.z,
      );
      offset.copy(corner).sub(center);

      const along = offset.dot(defaultDir);
      const lateralX = Math.abs(offset.dot(right));
      const lateralY = Math.abs(offset.dot(up));

      fitDistance = Math.max(
        fitDistance,
        along + lateralX / tanH,
        along + lateralY / tanV,
      );
    }

    // 여백. near plane 클리핑과 답답함을 피할 정도만 띄운다.
    fitDistance = Math.max(fitDistance * 1.2, 1);

    const newPosition = center
      .clone()
      .add(defaultDir.clone().multiplyScalar(fitDistance));

    const position: Vector3Tuple = [
      newPosition.x,
      newPosition.y,
      newPosition.z,
    ];
    const target: Vector3Tuple = [center.x, center.y, center.z];

    onMoveToRef.current?.(position, target);
  }, [focusedModelId, camera]);

  useEffect(() => {
    objectMapRef.current.clear();

    return () => {
      exitFocus();
    };
  }, [regionId, exitFocus]);

  return (
    <>
      {/* GLB 로드 객체는 개별 경계로 감싼다 — 하나가 404여도 나머지 씬은
          그대로 보인다. 관제 화면에서 모델 하나 때문에 전체가 비면 안 된다. */}
      {maps.map((m) => (
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
            // 지도도 그림자를 드리운다(기본값) — 지도 GLB에 건물이 함께
            // 구워져 있어 끄면 건물 그림자가 통째로 사라진다. 수십만 삼각형
            // depth pass 비용이 문제가 되면 여기부터 다시 끄는 것을 검토.
          />
        </SceneObjectBoundary>
      ))}
      {/* 포커스 중 나머지 모델은 언마운트하지 않고 투명(0.1)·라벨 흐림으로
          물러난다. 흐림은 저장하지 않고 씬 opacity 에서 파생하므로 포커스가
          풀리면 prop 이 원래 값으로 돌아가는 것이 곧 복원이다(focus-ghost.ts). */}
      {models.map((model) => (
        <SceneObjectBoundary
          key={model.id}
          label={`model ${model.equipName || model.id} (${model.path})`}
        >
          <GltfModel
            id={model.id}
            url={model.path}
            equipName={model.equipName}
            opacity={resolveFocusOpacity(
              model.id,
              focusedModelId,
              model.opacity,
            )}
            labelDimmed={isFocusGhosted(model.id, focusedModelId)}
            alarmSeverity={
              model.craneId ? (alarmsByCraneId[model.craneId] ?? null) : null
            }
            alarmHighlightMesh={alarmHighlightMesh}
            seaSubmersion={hasSea}
            position={model.position}
            rotation={model.rotation}
            scale={model.scale}
            onSelect={handleModelClick}
            onObjectReady={handleObjectReady}
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
    </>
  );
}
