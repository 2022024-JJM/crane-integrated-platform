import {
  numRound,
  parseMeshId,
  type RigDefinition,
  type SavedMapInfo,
  type SavedModelInfo,
  type SavedSceneInfo,
  type SavedTextInfo,
  type TagMapping,
} from '@crane/domain/3d';
import { useEffect, useMemo, type SetStateAction } from 'react';
import type { Vector3Tuple } from '@crane/core/types/math';
import { createId } from '@crane/core/lib/create-id';
import { clampToRange } from '@crane/core/lib/utils';
import { useSceneObjectSelectionStore } from './use-scene-object-selection-store';
import type { AxisKey, SceneTransformField } from './types';
import {
  applyAxisUpdate,
  roundCommittedField,
  roundVectorValue,
  type AxisUpdateOptions,
} from '../lib/vector-edit';

function clampOpacity(value: number) {
  return numRound(clampToRange(value, 0.1, 1));
}

interface UseSelectedSceneObjectEditorParams {
  sceneInfo: SavedSceneInfo | null;
  updateSceneInfo: (
    updater: SetStateAction<SavedSceneInfo | null>,
    options?: {
      recordHistory?: boolean;
    },
  ) => void;
}

/**
 * 모델 안쪽 노드가 선택된 경우의 도출 정보(parseMeshId 결과 + 부모 모델).
 * 노드 선택은 읽기 전용이다 — 바운딩 박스 표시용이며 편집 API 가 없다.
 * 저장된 `meshOverrides` 는 렌더에만 쓰이고 에디터에서 만들지 않는다.
 */
export interface SelectedMeshInfo {
  modelId: string;
  meshPath: string;
  parentModel: SavedModelInfo;
}

interface UseSelectedSceneObjectEditorResult {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
  selectedMesh: SelectedMeshInfo | null;
  renameObject: (id: string, name: string) => void;
  /**
   * 선택 모델의 태그 맵핑 목록을 통째로 갱신한다. 빈 배열을 돌려주면 필드가
   * 빠진다(직렬화 diff 0). 항목 추가·삭제·필드 편집이 전부 이 한 채널을
   * 지나므로 undo/redo·dirty 에 잡힌다.
   */
  updateSelectedTagMappings: (
    updater: (mappings: TagMapping[]) => TagMapping[],
  ) => void;
  updateSelectedOpacity: (value: number) => void;
  updateSelectedTransform: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  updateSelectedTransformVector: (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: {
      recordHistory?: boolean;
    },
  ) => void;
  commitSelectedTransform: (
    position: Vector3Tuple | null,
    rotation: Vector3Tuple | null,
    scale: Vector3Tuple | null,
    options?: { recordHistory?: boolean },
  ) => void;
  updateSelectedTextContent: (content: string) => void;
  updateSelectedTextColor: (color: string) => void;
  updateMultiObjectTransforms: (
    updates: Array<{
      id: string;
      position?: Vector3Tuple;
      rotation?: Vector3Tuple;
      scale?: Vector3Tuple;
    }>,
    options?: { recordHistory?: boolean },
  ) => void;
  selectedMap: SavedMapInfo | null;
  setObjectLocked: (id: string, locked: boolean) => void;
  removeSelectedModel: () => void;
  // ==== 리깅 ====
  /** 선택 모델의 GLB 경로로 빈 리그를 만들고 곧바로 그 모델에 할당한다. */
  createRigForSelectedModel: () => void;
  /** null 이면 해제. 관절 대상 맵핑은 리그와 함께 떨어진다. */
  assignRigToSelectedModel: (rigId: string | null) => void;
  updateRig: (
    rigId: string,
    updater: (rig: RigDefinition) => RigDefinition,
  ) => void;
  /** 정의 삭제 + 그 리그를 쓰던 모든 모델의 rigId·관절 맵핑 제거. */
  removeRig: (rigId: string) => void;
}

export function useSelectedSceneObjectEditor({
  sceneInfo,
  updateSceneInfo,
}: UseSelectedSceneObjectEditorParams): UseSelectedSceneObjectEditorResult {
  const selectedModelId = useSceneObjectSelectionStore(
    (state) => state.selectedModelId,
  );
  const selectedObjectType = useSceneObjectSelectionStore(
    (state) => state.selectedObjectType,
  );
  const selectedIds = useSceneObjectSelectionStore(
    (state) => state.selectedIds,
  );
  const clearSelectedModel = useSceneObjectSelectionStore(
    (state) => state.clearSelectedModel,
  );

  useEffect(() => {
    if (!sceneInfo || !selectedModelId) {
      return;
    }

    if (selectedObjectType === 'mesh') {
      // mesh ID는 `${modelId}::${meshPath}` 형식. 부모 모델이 살아있으면 유지.
      const parsed = parseMeshId(selectedModelId);
      if (!parsed) {
        clearSelectedModel();
        return;
      }
      const parentExists = sceneInfo.models.some(
        (m) => m.id === parsed.modelId,
      );
      if (!parentExists) {
        clearSelectedModel();
      }
      return;
    }

    // model/text/map은 id가 전역 고유하므로 타입 분기 없이 세 컬렉션
    // 어디에든 존재하면 선택을 유지한다.
    const exists =
      sceneInfo.models.some((m) => m.id === selectedModelId) ||
      (sceneInfo.texts ?? []).some((t) => t.id === selectedModelId) ||
      (sceneInfo.maps ?? []).some((m) => m.id === selectedModelId);

    if (!exists) {
      clearSelectedModel();
    }
  }, [clearSelectedModel, sceneInfo, selectedModelId, selectedObjectType]);

  // 잠긴 객체가 선택에 남아 있으면 선택을 해제한다 — 잠금 토글 자체는
  // setObjectLocked가 처리하지만, undo/redo로 잠금이 복원되는 경로는 씬만
  // 바뀌므로 여기서 걸러야 기즈모·인스펙터가 함께 내려간다.
  useEffect(() => {
    if (!sceneInfo || selectedIds.size === 0) {
      return;
    }
    const hasLockedSelection =
      sceneInfo.models.some(
        (m) => m.locked === true && selectedIds.has(m.id),
      ) ||
      (sceneInfo.texts ?? []).some(
        (t) => t.locked === true && selectedIds.has(t.id),
      ) ||
      (sceneInfo.maps ?? []).some(
        (m) => m.locked !== false && selectedIds.has(m.id),
      );
    if (hasLockedSelection) {
      clearSelectedModel();
    }
  }, [clearSelectedModel, sceneInfo, selectedIds]);

  const selectedModel = useMemo(
    () =>
      selectedObjectType === 'model'
        ? (sceneInfo?.models.find((model) => model.id === selectedModelId) ??
          null)
        : null,
    [sceneInfo?.models, selectedModelId, selectedObjectType],
  );

  const selectedText = useMemo(
    () =>
      selectedObjectType === 'text'
        ? ((sceneInfo?.texts ?? []).find((t) => t.id === selectedModelId) ??
          null)
        : null,
    [sceneInfo?.texts, selectedModelId, selectedObjectType],
  );

  const selectedMap = useMemo(
    () =>
      selectedObjectType === 'map'
        ? ((sceneInfo?.maps ?? []).find((m) => m.id === selectedModelId) ??
          null)
        : null,
    [sceneInfo?.maps, selectedModelId, selectedObjectType],
  );

  const selectedMesh = useMemo<SelectedMeshInfo | null>(() => {
    if (selectedObjectType !== 'mesh' || !selectedModelId || !sceneInfo) {
      return null;
    }
    const parsed = parseMeshId(selectedModelId);
    if (!parsed) return null;
    const parentModel = sceneInfo.models.find((m) => m.id === parsed.modelId);
    if (!parentModel) return null;
    return { modelId: parsed.modelId, meshPath: parsed.meshPath, parentModel };
  }, [selectedObjectType, selectedModelId, sceneInfo]);

  /**
   * id 기반 이름 변경 — 모델은 equipName, 텍스트는 content(내용이 곧
   * 표시 이름), 지도는 name(없으면 경로 파생 이름으로 표시)을 바꾼다.
   * 빈 이름은 무시한다.
   */
  const renameObject = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    updateSceneInfo((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.models.some((model) => model.id === id)) {
        return {
          ...prev,
          models: prev.models.map((model) =>
            model.id === id ? { ...model, equipName: trimmed } : model,
          ),
        };
      }
      if ((prev.texts ?? []).some((text) => text.id === id)) {
        return {
          ...prev,
          texts: (prev.texts ?? []).map((text) =>
            text.id === id ? { ...text, content: trimmed } : text,
          ),
        };
      }
      if ((prev.maps ?? []).some((map) => map.id === id)) {
        return {
          ...prev,
          maps: (prev.maps ?? []).map((map) =>
            map.id === id ? { ...map, name: trimmed } : map,
          ),
        };
      }
      return prev;
    });
  };

  const updateSelectedOpacity = (value: number) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) {
            return model;
          }

          return {
            ...model,
            opacity: clampOpacity(value),
          };
        }),
      };
    });
  };

  /**
   * transform 편집 공통 경로 — 모델/텍스트/지도는 transform 필드 형태가
   * 같으므로 selectedModelId가 속한 컬렉션(models → texts → maps)을 찾아
   * patch를 병합한다(renameObject/setObjectLocked와 같은 컬렉션 해석 패턴).
   * 지도는 transform 필드가 optional이지만 스프레드 병합은 터치한 필드만
   * 기록하므로 "손대지 않은 필드는 저장본에서도 없는 채로 유지" 계약이
   * 그대로 지켜진다. 모델 안쪽 노드 선택은 읽기 전용이라 편집 함수가 없다.
   */
  const patchSelectedTransform = (
    prev: SavedSceneInfo,
    makePatch: (current: {
      position?: Vector3Tuple;
      rotation?: Vector3Tuple;
      scale?: Vector3Tuple;
    }) => Partial<Record<SceneTransformField, Vector3Tuple>>,
  ): SavedSceneInfo => {
    const patchItem = <
      T extends {
        id: string;
        position?: Vector3Tuple;
        rotation?: Vector3Tuple;
        scale?: Vector3Tuple;
      },
    >(
      item: T,
    ): T =>
      item.id === selectedModelId ? { ...item, ...makePatch(item) } : item;

    if (prev.models.some((m) => m.id === selectedModelId)) {
      return { ...prev, models: prev.models.map(patchItem) };
    }
    if ((prev.texts ?? []).some((t) => t.id === selectedModelId)) {
      return { ...prev, texts: (prev.texts ?? []).map(patchItem) };
    }
    return { ...prev, maps: (prev.maps ?? []).map(patchItem) };
  };

  const updateSelectedTransform = (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
    options?: AxisUpdateOptions,
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return patchSelectedTransform(prev, (current) => {
        // 기존 값이 없으면(손대지 않은 지도) 렌더러 기본값에서 출발해야
        // 인스펙터에 보이던 수치와 결과가 일치한다.
        const base =
          current[field] ??
          (field === 'scale'
            ? ([1, 1, 1] as Vector3Tuple)
            : ([0, 0, 0] as Vector3Tuple));
        return { [field]: applyAxisUpdate(field, base, axis, value, options) };
      });
    });
  };

  const updateSelectedTransformVector = (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: {
      recordHistory?: boolean;
    },
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return patchSelectedTransform(prev, () => ({
        [field]: roundCommittedField(field, value),
      }));
    }, options);
  };

  const updateSelectedTextContent = (content: string) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) =>
          t.id === selectedModelId ? { ...t, content } : t,
        ),
      };
    });
  };

  const updateSelectedTextColor = (color: string) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) =>
          t.id === selectedModelId ? { ...t, color } : t,
        ),
      };
    });
  };

  /**
   * 편집 잠금 토글 — 씬 데이터에 쓴다(저장·undo·dirty 참여).
   * 지도는 "필드 없음 = 잠김"이라 항상 명시적 boolean을 기록하고,
   * 모델·텍스트는 true일 때만 필드를 남긴다(types.ts 주석 참고).
   * 잠글 때 선택 중이었다면 선택을 해제한다.
   */
  const setObjectLocked = (id: string, locked: boolean) => {
    updateSceneInfo((prev) => {
      if (!prev) {
        return prev;
      }
      if ((prev.maps ?? []).some((m) => m.id === id)) {
        return {
          ...prev,
          maps: (prev.maps ?? []).map((m) =>
            m.id === id ? { ...m, locked } : m,
          ),
        };
      }
      if ((prev.texts ?? []).some((t) => t.id === id)) {
        return {
          ...prev,
          texts: (prev.texts ?? []).map((t) => {
            if (t.id !== id) return t;
            if (locked) return { ...t, locked: true };
            const { locked: _removed, ...rest } = t;
            return rest;
          }),
        };
      }
      return {
        ...prev,
        models: prev.models.map((m) => {
          if (m.id !== id) return m;
          if (locked) return { ...m, locked: true };
          const { locked: _removed, ...rest } = m;
          return rest;
        }),
      };
    });
    if (locked && selectedIds.has(id)) {
      clearSelectedModel();
    }
  };

  // position/rotation/scale 3개를 단일 updateSceneInfo 호출로 처리.
  // commitFinal에서 3번 따로 호출하면 React 배치 처리가 안 될 때 3번 렌더가
  // 발생하고, 각 렌더마다 sceneModels 참조가 바뀌어 selectedObject가 리셋된다.
  // position/rotation/scale 중 변경된 필드만 단일 updateSceneInfo 호출로 commit.
  // null인 필드는 기존 sceneInfo 값을 그대로 유지해 부동소수점 역변환 오차로
  // 인한 rotation 덮어쓰기를 방지한다 (translate 모드에서 rotation을 건드리지 않음).
  const commitSelectedTransform = (
    position: Vector3Tuple | null,
    rotation: Vector3Tuple | null,
    scale: Vector3Tuple | null,
    options?: { recordHistory?: boolean },
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) return prev;
      return patchSelectedTransform(prev, () => ({
        ...(position !== null && { position: roundVectorValue(position) }),
        // rotation은 [0,360) 정규화까지 — UI 표시 단위와 저장값을 일치시킨다.
        ...(rotation !== null && {
          rotation: roundCommittedField('rotation', rotation),
        }),
        ...(scale !== null && { scale: roundVectorValue(scale) }),
      }));
    }, options);
  };

  const updateMultiObjectTransforms = (
    updates: Array<{
      id: string;
      position?: Vector3Tuple;
      rotation?: Vector3Tuple;
      scale?: Vector3Tuple;
    }>,
    options?: { recordHistory?: boolean },
  ) => {
    if (updates.length === 0) return;

    const updateMap = new Map(updates.map((u) => [u.id, u]));

    // commitSelectedTransform과 동일하게, 전달된 필드만 덮어쓴다 — 없는 필드는
    // 기존 값 유지 (rad↔deg 역변환 오차로 인한 rotation 덮어쓰기 방지).
    const applyUpdate = <
      T extends {
        id: string;
        position?: Vector3Tuple;
        rotation?: Vector3Tuple;
        scale?: Vector3Tuple;
      },
    >(
      item: T,
    ): T => {
      const u = updateMap.get(item.id);
      if (!u) return item;
      return {
        ...item,
        ...(u.position && { position: roundVectorValue(u.position) }),
        ...(u.rotation && {
          rotation: roundCommittedField('rotation', u.rotation),
        }),
        ...(u.scale && { scale: roundVectorValue(u.scale) }),
      };
    };

    updateSceneInfo((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        models: prev.models.map(applyUpdate),
        texts: (prev.texts ?? []).map(applyUpdate),
        // 잠금 해제된 지도는 Ctrl 토글·Ctrl+A로 다중 선택에 참여한다.
        // 터치한 필드만 병합되므로 optional transform 계약도 유지된다.
        maps: (prev.maps ?? []).map(applyUpdate),
      };
    }, options);
  };

  const updateSelectedTagMappings = (
    updater: (mappings: TagMapping[]) => TagMapping[],
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) return prev;
      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) return model;
          const current = model.tagMappings ?? [];
          const next = updater(current);
          if (next === current) return model;
          const rest = { ...model };
          delete rest.tagMappings;
          return next.length > 0 ? { ...rest, tagMappings: next } : rest;
        }),
      };
    });
  };

  // ==== 리깅 ====

  /**
   * rigId 를 뗀 복사본 — 필드 자체를 없애야 직렬화에서 빠진다. 관절 대상
   * 맵핑은 가리킬 관절이 사라지므로 함께 지운다(sanitize 도 같은 규칙).
   */
  const stripRig = (model: SavedModelInfo): SavedModelInfo => {
    const rest = { ...model };
    delete rest.rigId;
    const mappings = (model.tagMappings ?? []).filter(
      (m) => m.target.kind !== 'joint',
    );
    if (mappings.length > 0) rest.tagMappings = mappings;
    else delete rest.tagMappings;
    return rest;
  };

  const createRigForSelectedModel = () => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) return prev;
      const model = prev.models.find((m) => m.id === selectedModelId);
      if (!model) return prev;
      const rig: RigDefinition = {
        id: `rig-${createId()}`,
        name: model.equipName.trim() || model.id,
        modelPath: model.path,
        joints: [],
        constraints: [],
      };
      return {
        ...prev,
        rigs: [...(prev.rigs ?? []), rig],
        models: prev.models.map((m) =>
          m.id === selectedModelId ? { ...stripRig(m), rigId: rig.id } : m,
        ),
      };
    });
  };

  const assignRigToSelectedModel = (rigId: string | null) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) return prev;
      if (rigId !== null && !(prev.rigs ?? []).some((r) => r.id === rigId)) {
        return prev;
      }
      return {
        ...prev,
        models: prev.models.map((m) => {
          if (m.id !== selectedModelId) return m;
          if (m.rigId === (rigId ?? undefined)) return m;
          const rest = stripRig(m);
          return rigId === null ? rest : { ...rest, rigId };
        }),
      };
    });
  };

  const updateRig = (
    rigId: string,
    updater: (rig: RigDefinition) => RigDefinition,
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !prev.rigs?.some((r) => r.id === rigId)) return prev;
      return {
        ...prev,
        rigs: prev.rigs.map((r) => (r.id === rigId ? updater(r) : r)),
      };
    });
  };

  const removeRig = (rigId: string) => {
    updateSceneInfo((prev) => {
      if (!prev || !prev.rigs?.some((r) => r.id === rigId)) return prev;
      const rigs = prev.rigs.filter((r) => r.id !== rigId);
      return {
        ...prev,
        rigs: rigs.length > 0 ? rigs : undefined,
        models: prev.models.map((m) =>
          m.rigId === rigId ? stripRig(m) : m,
        ),
      };
    });
  };

  const removeSelectedModel = () => {
    if (selectedIds.size === 0) {
      return;
    }

    updateSceneInfo((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        models: prev.models.filter((model) => !selectedIds.has(model.id)),
        texts: (prev.texts ?? []).filter((t) => !selectedIds.has(t.id)),
        // 잠금 해제된 지도도 선택·삭제 대상이다. 지도가 없어지면 드롭
        // raycast는 y=0 평면으로 폴백한다(use-scene-drop 참고).
        maps: (prev.maps ?? []).filter((m) => !selectedIds.has(m.id)),
      };
    });

    clearSelectedModel();
  };

  return {
    selectedModel,
    selectedText,
    selectedMesh,
    renameObject,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    commitSelectedTransform,
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateMultiObjectTransforms,
    updateSelectedTagMappings,
    selectedMap,
    setObjectLocked,
    removeSelectedModel,
    createRigForSelectedModel,
    assignRigToSelectedModel,
    updateRig,
    removeRig,
  };
}
