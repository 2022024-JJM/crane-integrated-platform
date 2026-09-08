import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
  createSceneModel,
  createSceneText,
  type SavedLightingInfo,
  type SavedSceneInfo,
  type SceneMapCatalogItem,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import { createId } from '@crane/core/lib/create-id';
import type { MutableRefObject, SetStateAction } from 'react';

interface UpdateSceneOptions {
  recordHistory?: boolean;
}

interface SceneManipulationDeps {
  updateScene: (
    updater: SetStateAction<SavedSceneInfo | null>,
    options?: UpdateSceneOptions,
  ) => void;
  commitHistoryFrom: (base: SavedSceneInfo | null) => void;
  selectModel: (id: string) => void;
  selectText: (id: string) => void;
  selectMap: (id: string) => void;
  clearSelectedModel: () => void;
  selectedIds: Set<string>;
  sceneInfoRef: MutableRefObject<SavedSceneInfo | null>;
  selectAll: (entries: Array<{ id: string; type: 'model' | 'text' }>) => void;
  transformHistoryBaseRef: MutableRefObject<SavedSceneInfo | null>;
}

export function createSceneManipulationActions({
  updateScene,
  commitHistoryFrom,
  selectModel,
  selectText,
  selectMap,
  clearSelectedModel,
  selectedIds,
  sceneInfoRef,
  selectAll,
  transformHistoryBaseRef,
}: SceneManipulationDeps) {
  const addModel = (
    catalogItem: SceneModelCatalogItem,
    position: [number, number, number],
  ) => {
    const nextModel = createSceneModel({
      catalogItem,
      position,
    });

    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        models: [...prev.models, nextModel],
      };
    });

    selectModel(nextModel.id);
  };

  const addText = (position: [number, number, number]) => {
    const nextText = createSceneText({ position });

    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        texts: [...(prev.texts ?? []), nextText],
      };
    });

    selectText(nextText.id);
  };

  const deletePlacedText = (id: string) => {
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      // 잠긴 텍스트는 삭제 불가 — 계층 목록은 잠긴 행의 삭제 버튼을 숨기지만,
      // updater 안에서 한 번 더 막아야 다른 호출 경로가 생겨도 안전하다.
      if ((prev.texts ?? []).some((t) => t.id === id && t.locked)) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).filter((t) => t.id !== id),
      };
    });

    if (selectedIds.has(id)) {
      clearSelectedModel();
    }
  };

  const deletePlacedMap = (id: string) => {
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      // 잠긴 지도는 삭제 불가 — 지도는 "필드 없음 = 잠김"(반전 기본값)이라
      // locked !== false 로 검사한다. 계층 목록은 잠긴 행의 삭제 버튼을
      // 숨기지만 updater 안에서 한 번 더 막아야 다른 호출 경로에도 안전하다.
      if ((prev.maps ?? []).some((m) => m.id === id && m.locked !== false)) {
        return prev;
      }

      return {
        ...prev,
        maps: (prev.maps ?? []).filter((m) => m.id !== id),
      };
    });

    if (selectedIds.has(id)) {
      clearSelectedModel();
    }
  };

  /**
   * 지도 추가 — 팔레트 "맵" 탭의 타일 클릭. 배경(setEnvironmentId)과 달리 단일
   * 선택이 아니라 append 다: 씬에는 지도가 여러 장 놓일 수 있고(조선소 +
   * 주변 지형), 제거는 deletePlacedMap 이 맡는다. 바닥 지도 판정은 배열
   * 순서가 아니라 카탈로그 kind(resolveGroundMap)라 뒤에 붙여도 무방하다.
   *
   * 같은 경로가 이미 있으면(잠김 여부 무관) 아무것도 하지 않는다 — 팔레트는
   * 경로당 한 장만 관리하며, UI 도 배치된 타일을 "추가" 로 다루지 않지만
   * 여기서 한 번 더 막아야 다른 경로가 생겨도 중복이 안 생긴다.
   *
   * 새 지도는 잠기지 않은 상태로 시작하고 곧바로 선택한다(addModel 과 같은
   * 규약) — 기즈모가 바로 붙어 배치를 먼저 하고, 계층 목록·타일의 자물쇠로
   * 잠근다. position 은 카탈로그 defaultPosition(주변 지형의 조선소 기준
   * 오프셋)이 있으면 그 값, 없으면 원점이다.
   */
  const addSceneMap = (catalogItem: SceneMapCatalogItem) => {
    const maps = sceneInfoRef.current?.maps ?? [];
    if (maps.some((m) => m.path === catalogItem.path)) {
      return;
    }

    const id = createId();
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        // transform을 명시 저장한다 — 새 지도는 어떤 경로로 추가되든 항상
        // 정해진 배치/무회전/등배로 시작한다는 보장을 렌더러 기본값에 맡기지
        // 않는다. sanitize는 유효한 벡터 필드를 그대로 보존하므로 round-trip
        // 에도 값이 유지된다.
        maps: [
          ...(prev.maps ?? []),
          {
            id,
            path: catalogItem.path,
            name: catalogItem.label,
            position: catalogItem.defaultPosition ?? [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            locked: false,
          },
        ],
      };
    });

    selectMap(id);
  };

  const selectPlacedModel = (id: string) => {
    selectModel(id);
  };

  const selectPlacedMap = (id: string) => {
    selectMap(id);
  };

  /**
   * 배경 파노라마 선택. null이면 "배경 없음"을 명시적으로 저장한다 —
   * undefined로 지우면 region 기본 배경이 되살아나 사용자가 끌 수 없다.
   */
  const setEnvironmentId = (environmentId: string | null) => {
    updateScene((prev) => {
      if (!prev) return prev;
      if (prev.environmentId === environmentId) return prev;
      return { ...prev, environmentId };
    });
  };

  /**
   * 조명 설정(그림자·태양 위치) 변경. patch를 기존 값에 merge한 뒤 기본값
   * 필드는 제거해 정규화한다 — "필드 없음 = 기본값"이라(sanitize와 같은 규칙)
   * 기본값으로 되돌린 씬이 저장본에 lighting 필드를 남기지 않고, 기본값으로의
   * no-op 변경이 히스토리에 쌓이지 않는다.
   *
   * 슬라이더 드래그는 recordHistory: false로 호출하고 드래그 종료 시
   * endTransformInteraction으로 1회만 커밋한다(TransformControls와 같은 패턴).
   */
  const setLighting = (
    patch: Partial<SavedLightingInfo>,
    options?: UpdateSceneOptions,
  ) => {
    updateScene((prev) => {
      if (!prev) return prev;

      const merged = { ...prev.lighting, ...patch };
      const normalized: SavedLightingInfo = {};
      if (merged.shadows === true) {
        normalized.shadows = true;
      }
      // sanitize와 동일한 랩·클램프 — 여기서 안 맞추면 라이브 상태(az=360)와
      // 로드본(az=0)이 어긋나 저장 직후에도 dirty로 남는다.
      if (
        typeof merged.sunAzimuth === 'number' &&
        Number.isFinite(merged.sunAzimuth)
      ) {
        const sunAzimuth = ((merged.sunAzimuth % 360) + 360) % 360;
        if (sunAzimuth !== SCENE_SUN_AZIMUTH_DEFAULT) {
          normalized.sunAzimuth = sunAzimuth;
        }
      }
      if (
        typeof merged.sunElevation === 'number' &&
        Number.isFinite(merged.sunElevation)
      ) {
        const sunElevation = Math.min(
          90,
          Math.max(SCENE_SUN_ELEVATION_MIN, merged.sunElevation),
        );
        if (sunElevation !== SCENE_SUN_ELEVATION_DEFAULT) {
          normalized.sunElevation = sunElevation;
        }
      }

      const nextLighting =
        Object.keys(normalized).length > 0 ? normalized : undefined;

      if (
        (prev.lighting?.shadows ?? false) ===
          (nextLighting?.shadows ?? false) &&
        (prev.lighting?.sunAzimuth ?? SCENE_SUN_AZIMUTH_DEFAULT) ===
          (nextLighting?.sunAzimuth ?? SCENE_SUN_AZIMUTH_DEFAULT) &&
        (prev.lighting?.sunElevation ?? SCENE_SUN_ELEVATION_DEFAULT) ===
          (nextLighting?.sunElevation ?? SCENE_SUN_ELEVATION_DEFAULT)
      ) {
        return prev;
      }

      return { ...prev, lighting: nextLighting };
    }, options);
  };

  const selectPlacedText = (id: string) => {
    selectText(id);
  };

  const deletePlacedModel = (id: string) => {
    updateScene((prev) => {
      if (!prev) {
        return prev;
      }

      // 잠긴 모델은 삭제 불가 — 계층 목록은 잠긴 행의 삭제 버튼을 숨기지만,
      // updater 안에서 한 번 더 막아야 다른 호출 경로가 생겨도 안전하다.
      if (prev.models.some((model) => model.id === id && model.locked)) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.filter((model) => model.id !== id),
      };
    });

    if (selectedIds.has(id)) {
      clearSelectedModel();
    }
  };

  const startTransformInteraction = () => {
    transformHistoryBaseRef.current = sceneInfoRef.current;
  };

  const endTransformInteraction = () => {
    commitHistoryFrom(transformHistoryBaseRef.current);
    transformHistoryBaseRef.current = null;
  };

  const duplicateSelectedObject = () => {
    if (selectedIds.size === 0) return;

    const scene = sceneInfoRef.current;
    if (!scene) return;

    const newModelDuplicates: typeof scene.models = [];
    const newTextDuplicates: NonNullable<typeof scene.texts> = [];
    const newEntries: Array<{ id: string; type: 'model' | 'text' }> = [];

    for (const id of selectedIds) {
      const modelSource = scene.models.find((m) => m.id === id);
      if (modelSource) {
        const newId = createId();
        newEntries.push({ id: newId, type: 'model' });
        newModelDuplicates.push({
          ...modelSource,
          id: newId,
          // 잠긴 모델은 선택 자체가 안 되니 여기 올 수 없지만, 복제본이
          // 잠김을 물려받는 일은 어떤 경로로도 없어야 한다.
          locked: undefined,
          position: [
            modelSource.position[0] + 2,
            modelSource.position[1],
            modelSource.position[2],
          ] as [number, number, number],
        });
        continue;
      }

      const textSource = (scene.texts ?? []).find((t) => t.id === id);
      if (textSource) {
        const newId = createId();
        newEntries.push({ id: newId, type: 'text' });
        newTextDuplicates.push({
          ...textSource,
          id: newId,
          // 모델 복제와 같은 규칙 — 복제본이 잠김을 물려받지 않는다.
          locked: undefined,
          position: [
            textSource.position[0] + 2,
            textSource.position[1],
            textSource.position[2],
          ] as [number, number, number],
        });
      }
    }

    if (newModelDuplicates.length === 0 && newTextDuplicates.length === 0)
      return;

    updateScene((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: [...prev.models, ...newModelDuplicates],
        texts: [...(prev.texts ?? []), ...newTextDuplicates],
      };
    });

    selectAll(newEntries);
  };

  return {
    addModel,
    addText,
    addSceneMap,
    selectPlacedMap,
    setEnvironmentId,
    setLighting,
    selectPlacedModel,
    selectPlacedText,
    deletePlacedModel,
    deletePlacedText,
    deletePlacedMap,
    startTransformInteraction,
    endTransformInteraction,
    duplicateSelectedObject,
  };
}
