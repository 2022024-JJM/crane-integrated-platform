import {
  modelObjectRegistry,
  numRound,
  parseMeshId,
  radToDeg,
  type SavedMeshOverride,
  type SavedModelInfo,
  type SavedSceneInfo,
  type SavedSensorInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';
import { useEffect, useMemo, type SetStateAction } from 'react';
import type { Vector3Tuple } from '@crane/core/types/math';
import { clampToRange } from '@crane/core/lib/utils';
import { useSceneObjectSelectionStore } from './use-scene-object-selection-store';
import { AXIS_INDEX, type AxisKey, type SceneTransformField } from './types';

function updateVectorValue(tuple: Vector3Tuple, axis: AxisKey, value: number) {
  const nextTuple = [...tuple] as Vector3Tuple;
  nextTuple[AXIS_INDEX[axis]] = value;
  return nextTuple;
}

function roundVectorValue(tuple: Vector3Tuple): Vector3Tuple {
  return tuple.map((value) => numRound(value)) as Vector3Tuple;
}

function clampOpacity(value: number) {
  return numRound(clampToRange(value, 0.1, 1));
}

/**
 * 모델의 meshOverrides 배열에서 meshPath에 해당하는 override를
 * upsert(존재하면 patch, 없으면 새로 추가)한다. 빈 patch는 전혀 변경하지 않는다.
 */
function upsertMeshOverride(
  model: SavedModelInfo,
  meshPath: string,
  patch: Partial<Omit<SavedMeshOverride, 'meshPath'>>,
): SavedModelInfo {
  const existing = model.meshOverrides ?? [];
  const idx = existing.findIndex((o) => o.meshPath === meshPath);
  if (idx < 0) {
    return {
      ...model,
      meshOverrides: [...existing, { meshPath, ...patch }],
    };
  }
  const next = [...existing];
  next[idx] = { ...next[idx], ...patch };
  return { ...model, meshOverrides: next };
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
 * mesh가 선택된 경우의 도출 정보. selectedMesh.override는 sceneInfo에 저장된
 * override(없으면 null), selectedMesh.modelId/meshPath는 parseMeshId 결과.
 */
export interface SelectedMeshInfo {
  modelId: string;
  meshPath: string;
  override: SavedMeshOverride | null;
  parentModel: SavedModelInfo;
  /** 현재 mount된 mesh Object3D. Inspector가 baseline transform을 읽는다. */
  meshObject: import('three').Object3D | null;
}

interface UseSelectedSceneObjectEditorResult {
  selectedModel: SavedModelInfo | null;
  selectedText: SavedTextInfo | null;
  selectedSensor: SavedSensorInfo | null;
  selectedMesh: SelectedMeshInfo | null;
  updateSelectedMeshTransform: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  updateSelectedMeshTransformVector: (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: { recordHistory?: boolean },
  ) => void;
  updateSelectedMeshOpacity: (value: number) => void;
  updateSelectedMeshName: (name: string) => void;
  updateSelectedName: (name: string) => void;
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
  updateSelectedTextTransform: (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => void;
  updateSelectedTextTransformVector: (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: {
      recordHistory?: boolean;
    },
  ) => void;
  updateMultiObjectPositions: (
    updates: Array<{ id: string; position: Vector3Tuple }>,
    options?: { recordHistory?: boolean },
  ) => void;
  removeSelectedModel: () => void;
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

    if (selectedObjectType === 'text') {
      const exists = (sceneInfo.texts ?? []).some(
        (t) => t.id === selectedModelId,
      );
      if (!exists) {
        clearSelectedModel();
      }
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

    if (selectedObjectType === 'sensor') {
      const exists = (sceneInfo.sensors ?? []).some(
        (s) => s.id === selectedModelId,
      );
      if (!exists) {
        clearSelectedModel();
      }
      return;
    }

    const isSelectedModelExists = sceneInfo.models.some(
      (model) => model.id === selectedModelId,
    );

    if (!isSelectedModelExists) {
      clearSelectedModel();
    }
  }, [clearSelectedModel, sceneInfo, selectedModelId, selectedObjectType]);

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

  const selectedSensor = useMemo(
    () =>
      selectedObjectType === 'sensor'
        ? ((sceneInfo?.sensors ?? []).find((s) => s.id === selectedModelId) ??
          null)
        : null,
    [sceneInfo?.sensors, selectedModelId, selectedObjectType],
  );

  const selectedMesh = useMemo<SelectedMeshInfo | null>(() => {
    if (selectedObjectType !== 'mesh' || !selectedModelId || !sceneInfo) {
      return null;
    }
    const parsed = parseMeshId(selectedModelId);
    if (!parsed) return null;
    const parentModel = sceneInfo.models.find((m) => m.id === parsed.modelId);
    if (!parentModel) return null;
    const override =
      parentModel.meshOverrides?.find((o) => o.meshPath === parsed.meshPath) ??
      null;
    return {
      modelId: parsed.modelId,
      meshPath: parsed.meshPath,
      override,
      parentModel,
      meshObject: modelObjectRegistry.get(selectedModelId) ?? null,
    };
  }, [selectedObjectType, selectedModelId, sceneInfo]);

  const updateSelectedName = (name: string) => {
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
            equipName: name,
          };
        }),
      };
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

  const updateSelectedTransform = (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => {
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
            [field]: updateVectorValue(model[field], axis, numRound(value)),
          };
        }),
      };
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

      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) {
            return model;
          }

          return {
            ...model,
            [field]: roundVectorValue(value),
          };
        }),
      };
    }, options);
  };

  // ==== mesh-specific updates ====

  const updateSelectedMeshTransform = (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => {
    if (!selectedMesh) return;
    const { modelId, meshPath, override } = selectedMesh;
    const overrideVec = override?.[field];
    // 첫 axis 편집 시에는 mesh의 현재 transform(=GLTF 원본 또는 마지막 적용
    // 상태)을 baseline으로 사용해야 한다. [0,0,0]에서 시작하면 mesh가 원점
    // 으로 점프한다. 현재 mesh 객체를 registry에서 가져와 read한다.
    let start: Vector3Tuple;
    if (overrideVec) {
      start = overrideVec;
    } else {
      const meshId = `${modelId}::${meshPath}`;
      const meshObj = modelObjectRegistry.get(meshId);
      if (meshObj) {
        if (field === 'position') {
          start = [meshObj.position.x, meshObj.position.y, meshObj.position.z];
        } else if (field === 'rotation') {
          start = [
            radToDeg(meshObj.rotation.x),
            radToDeg(meshObj.rotation.y),
            radToDeg(meshObj.rotation.z),
          ];
        } else {
          start = [meshObj.scale.x, meshObj.scale.y, meshObj.scale.z];
        }
      } else {
        start = field === 'scale' ? [1, 1, 1] : [0, 0, 0];
      }
    }
    const nextVec = updateVectorValue(start, axis, numRound(value));
    updateSceneInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: prev.models.map((m) =>
          m.id === modelId ? upsertMeshOverride(m, meshPath, { [field]: nextVec }) : m,
        ),
      };
    });
  };

  const updateSelectedMeshTransformVector = (
    field: SceneTransformField,
    value: Vector3Tuple,
    options?: { recordHistory?: boolean },
  ) => {
    if (!selectedMesh) return;
    const { modelId, meshPath } = selectedMesh;
    const rounded = roundVectorValue(value);
    updateSceneInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: prev.models.map((m) =>
          m.id === modelId ? upsertMeshOverride(m, meshPath, { [field]: rounded }) : m,
        ),
      };
    }, options);
  };

  const updateSelectedMeshOpacity = (value: number) => {
    if (!selectedMesh) return;
    const { modelId, meshPath } = selectedMesh;
    const opacity = clampOpacity(value);
    updateSceneInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: prev.models.map((m) =>
          m.id === modelId ? upsertMeshOverride(m, meshPath, { opacity }) : m,
        ),
      };
    });
  };

  const updateSelectedMeshName = (name: string) => {
    if (!selectedMesh) return;
    const { modelId, meshPath } = selectedMesh;
    updateSceneInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        models: prev.models.map((m) =>
          m.id === modelId ? upsertMeshOverride(m, meshPath, { name }) : m,
        ),
      };
    });
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

  const updateSelectedTextTransform = (
    field: SceneTransformField,
    axis: AxisKey,
    value: number,
  ) => {
    updateSceneInfo((prev) => {
      if (!prev || !selectedModelId) {
        return prev;
      }

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) => {
          if (t.id !== selectedModelId) {
            return t;
          }

          return {
            ...t,
            [field]: updateVectorValue(t[field], axis, numRound(value)),
          };
        }),
      };
    });
  };

  const updateSelectedTextTransformVector = (
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

      return {
        ...prev,
        texts: (prev.texts ?? []).map((t) => {
          if (t.id !== selectedModelId) {
            return t;
          }

          return {
            ...t,
            [field]: roundVectorValue(value),
          };
        }),
      };
    }, options);
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
      return {
        ...prev,
        models: prev.models.map((model) => {
          if (model.id !== selectedModelId) return model;
          return {
            ...model,
            ...(position !== null && { position: roundVectorValue(position) }),
            ...(rotation !== null && { rotation: roundVectorValue(rotation) }),
            ...(scale !== null && { scale: roundVectorValue(scale) }),
          };
        }),
      };
    }, options);
  };

  const updateMultiObjectPositions = (
    updates: Array<{ id: string; position: Vector3Tuple }>,
    options?: { recordHistory?: boolean },
  ) => {
    if (updates.length === 0) return;

    const updateMap = new Map(updates.map((u) => [u.id, u.position]));

    updateSceneInfo((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        models: prev.models.map((model) => {
          const pos = updateMap.get(model.id);
          if (!pos) return model;
          return { ...model, position: roundVectorValue(pos) };
        }),
        texts: (prev.texts ?? []).map((t) => {
          const pos = updateMap.get(t.id);
          if (!pos) return t;
          return { ...t, position: roundVectorValue(pos) };
        }),
      };
    }, options);
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
        sensors: (prev.sensors ?? []).filter((s) => !selectedIds.has(s.id)),
      };
    });

    clearSelectedModel();
  };

  return {
    selectedModel,
    selectedText,
    selectedSensor,
    selectedMesh,
    updateSelectedName,
    updateSelectedOpacity,
    updateSelectedTransform,
    updateSelectedTransformVector,
    commitSelectedTransform,
    updateSelectedMeshTransform,
    updateSelectedMeshTransformVector,
    updateSelectedMeshOpacity,
    updateSelectedMeshName,
    updateSelectedTextContent,
    updateSelectedTextColor,
    updateSelectedTextTransform,
    updateSelectedTextTransformVector,
    updateMultiObjectPositions,
    removeSelectedModel,
  };
}
