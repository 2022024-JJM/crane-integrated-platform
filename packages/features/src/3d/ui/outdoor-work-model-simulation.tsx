import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Box3,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Vector3,
} from 'three';
import type { AlarmSeverity } from '@crane/domain/alarm';
import {
  GltfModel,
  SceneText,
  loadSceneInfoByRegionId,
  markSceneRegionActive,
  preloadGltf,
  releaseSceneRegionAssets,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useObjectFocusStore } from '../model/use-object-focus-store';
import { useSceneInfoStore } from '../model/use-scene-info-store';
import { useValueMapperStore } from '../model/use-value-mapper-store';
import { useValueGeneratorRunner } from '../model/use-value-generator-runner';
import { useValueGeneratorStore } from '../model/use-value-generator-store';
import { useReplayPlayerRunner } from '../model/use-replay-player-runner';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { useRealtimeRunner } from '../model/use-realtime-runner';
import { useRealtimeStore } from '../model/use-realtime-store';
import { useRealtimeWebSocketBridge } from '../model/use-realtime-websocket-bridge';
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
  const registerFromModel = useValueMapperStore((s) => s.registerFromModel);
  const clearValueMapper = useValueMapperStore((s) => s.clear);
  const resetToOrigin = useValueMapperStore((s) => s.resetToOrigin);
  const startSimulation = useValueGeneratorStore((s) => s.start);
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
      clearValueMapper();

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

        data.models?.forEach((modelInfo) => {
          registerFromModel(modelInfo);
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        clearValueMapper();
        setSceneInfo(null);
        console.error('Failed to load monitoring scene.', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (mode === 'simulation') {
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
      // unmount 전 Object3D가 아직 registry에 있을 때 원위치 복귀
      resetToOrigin();
      clearValueMapper();
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
  }, [clearSceneInfoFromStore, clearValueMapper, mode, regionId, registerFromModel, resetReplay, resetToOrigin, setSceneInfoInStore, startRealtime, startSimulation, stopRealtime]);

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
}

export function OutdoorWorkModelSimulation({
  sceneInfo,
  regionId,
  alarmsByCraneId,
  alarmHighlightMesh = false,
  mode = 'simulation',
  onMoveTo,
  onResetCamera,
}: OutdoorWorkModelSimulationProps) {
  const camera = useThree((s) => s.camera);
  // 세 runner 모두 항상 mount — 각자 내부 플래그(isRunning / isPlaying)로 비활성화
  useValueGeneratorRunner();
  useReplayPlayerRunner();
  useRealtimeRunner();
  useRealtimeWebSocketBridge(mode === 'realtime');

  const focusedModelId = useObjectFocusStore((s) => s.focusedModelId);
  const pushFocus = useObjectFocusStore((s) => s.pushFocus);

  const objectMapRef = useRef<Map<string, Object3D>>(new Map());
  const boxCacheRef = useRef<Map<string, Box3>>(new Map());

  const getObjectBounds = useCallback((id: string) => {
    const object = objectMapRef.current.get(id);
    if (object) {
      const liveBounds = new Box3().setFromObject(object);
      boxCacheRef.current.set(id, liveBounds);
      return liveBounds;
    }

    return boxCacheRef.current.get(id) ?? null;
  }, []);

  const handleObjectReady = useCallback(
    (id: string, object: Object3D | null) => {
      if (object) {
        objectMapRef.current.set(id, object);
        boxCacheRef.current.set(id, new Box3().setFromObject(object));
        return;
      }

      objectMapRef.current.delete(id);
    },
    [],
  );

  const maps = sceneInfo?.maps ?? [];
  const models = sceneInfo?.models ?? [];
  const modelIds = useMemo(() => models.map((model) => model.id), [models]);
  const texts = sceneInfo?.texts ?? [];

  const focusStack = useObjectFocusStore((s) => s.focusStack);

  const handleModelClick = useCallback(
    (id: string) => {
      // If clicking from full scene (stack empty), check if this model
      // overlaps with a larger model (e.g. crane inside a bay).
      // If so, push the container first to enable two-level back navigation.
      if (focusStack.length === 0) {
        const clickedBox = getObjectBounds(id);

        if (clickedBox) {
          const clickedSize = new Vector3();
          clickedBox.getSize(clickedSize);
          const clickedVolume = clickedSize.x * clickedSize.y * clickedSize.z;

          let bestContainer: string | null = null;
          let bestVolume = Infinity;

          for (const otherId of modelIds) {
            if (otherId === id) {
              continue;
            }

            const otherBox = getObjectBounds(otherId);
            if (!otherBox) {
              continue;
            }

            if (!otherBox.intersectsBox(clickedBox)) {
              continue;
            }

            const otherSize = new Vector3();
            otherBox.getSize(otherSize);
            const otherVolume = otherSize.x * otherSize.y * otherSize.z;

            // Only consider objects larger than the clicked one as containers
            if (otherVolume > clickedVolume && otherVolume < bestVolume) {
              bestContainer = otherId;
              bestVolume = otherVolume;
            }
          }

          if (bestContainer) {
            pushFocus(bestContainer);
            pushFocus(id);
            return;
          }
        }
      }

      pushFocus(id);
    },
    [focusStack.length, getObjectBounds, modelIds, pushFocus],
  );

  const { visibleModelIds, visibleGroupBox } = useMemo(() => {
    if (!focusedModelId) {
      return { visibleModelIds: null, visibleGroupBox: null };
    }

    const focusedBox = getObjectBounds(focusedModelId);

    if (!focusedBox) {
      return {
        visibleModelIds: new Set([focusedModelId]),
        visibleGroupBox: null,
      };
    }

    const result = new Set<string>();
    const groupBox = focusedBox.clone();

    for (const id of modelIds) {
      if (id === focusedModelId) {
        result.add(id);
        continue;
      }

      const otherBox = getObjectBounds(id);
      if (!otherBox) {
        continue;
      }

      if (focusedBox.intersectsBox(otherBox)) {
        result.add(id);
        groupBox.union(otherBox);
      }
    }

    return { visibleModelIds: result, visibleGroupBox: groupBox };
  }, [focusedModelId, getObjectBounds, modelIds]);

  const onMoveToRef = useRef(onMoveTo);
  onMoveToRef.current = onMoveTo;
  const onResetCameraRef = useRef(onResetCamera);
  onResetCameraRef.current = onResetCamera;

  useEffect(() => {
    if (!focusedModelId) {
      onResetCameraRef.current?.();
      return;
    }

    // 포커스된 모델의 박스에만 카메라를 맞춘다. 겹치는 이웃 모델까지 합치면
    // (예: LLC 클릭 시 골리앗까지 포함) 클릭한 크레인이 화면에서 작아진다.
    // 이웃 모델의 표시 여부는 visibleModelIds가 별도로 처리한다.
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

  const clearFocus = useObjectFocusStore((s) => s.clearFocus);

  useEffect(() => {
    objectMapRef.current.clear();
    boxCacheRef.current.clear();

    return () => {
      clearFocus();
    };
  }, [regionId, clearFocus]);

  return (
    <>
      {/* GLB 로드 객체는 개별 경계로 감싼다 — 하나가 404여도 나머지 씬은
          그대로 보인다. 관제 화면에서 모델 하나 때문에 전체가 비면 안 된다. */}
      {maps.map((m) => (
        // 지도는 지형이라 raycast BVH를 빌드하지 않는다 — 수만 개 메시에
        // 빌드 비용만 크고 개별 클릭 대상도 아니다(model-mesh 주석 참고).
        <SceneObjectBoundary key={m.id} label={`map ${m.path}`}>
          <GltfModel
            id={m.id}
            url={m.path}
            position={m.position}
            rotation={m.rotation}
            scale={m.scale}
            enableRaycastBvh={false}
          />
        </SceneObjectBoundary>
      ))}
      {models.map((model) => {
        if (visibleModelIds && !visibleModelIds.has(model.id)) {
          return null;
        }

        return (
          <SceneObjectBoundary
            key={model.id}
            label={`model ${model.equipName || model.id} (${model.path})`}
          >
            <GltfModel
              id={model.id}
              url={model.path}
              equipName={model.equipName}
              opacity={model.opacity}
              alarmSeverity={
                model.craneId ? (alarmsByCraneId[model.craneId] ?? null) : null
              }
              alarmHighlightMesh={alarmHighlightMesh}
              position={model.position}
              rotation={model.rotation}
              scale={model.scale}
              onSelect={handleModelClick}
              onObjectReady={handleObjectReady}
            />
          </SceneObjectBoundary>
        );
      })}
      {texts.map((text) => {
        if (visibleGroupBox) {
          const [tx] = text.position;

          if (tx < visibleGroupBox.min.x || tx > visibleGroupBox.max.x) {
            return null;
          }
        }

        return (
          <SceneText
            key={text.id}
            id={text.id}
            content={text.content}
            color={text.color}
            position={text.position}
            rotation={text.rotation}
            scale={text.scale}
          />
        );
      })}
    </>
  );
}
