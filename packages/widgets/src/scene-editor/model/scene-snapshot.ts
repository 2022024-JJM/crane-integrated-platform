import type {
  RigConstraint,
  RigDefinition,
  RigJoint,
  SavedCameraInfo,
  SavedMapInfo,
  SavedMeshOverride,
  SavedModelInfo,
  SavedSceneInfo,
  SavedTextInfo,
  TagMapping,
} from '@crane/domain/3d';
import { getTagMappingTargetKey } from '@crane/domain/3d';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  sanitizeSceneInfo,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 정규화는 도메인(sanitize-scene-info)이 소유한다 — 로드 경계에서 이미
 * 적용되므로 에디터·뷰어가 같은 데이터를 본다. 에디터는 저장 직전에 한 번 더
 * 호출해(사용자 편집 결과를 정규화) 쓰기 때문에 여기서 재수출한다.
 */
export { sanitizeSceneInfo };


export function createSceneSnapshot(sceneInfo: SavedSceneInfo | null) {
  if (!sceneInfo) {
    return null;
  }

  return JSON.stringify(sanitizeSceneInfo(sceneInfo));
}

function isVector3TupleEqual(a: Vector3Tuple, b: Vector3Tuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * 순서 무관 비교: id 기준 lookup. scale/offset 은 기본값으로 정규화. 대상은
 * 타깃 키(노드·채널·축 | 관절)로 비교해 객체 참조와 무관하게 판정한다.
 */
function isTagMappingListEqual(
  a: TagMapping[] | undefined,
  b: TagMapping[] | undefined,
): boolean {
  const aLen = a?.length ?? 0;
  const bLen = b?.length ?? 0;
  if (aLen !== bLen) return false;
  if (aLen === 0) return true;
  const bMap = new Map((b ?? []).map((m) => [m.id, m]));
  for (const am of a ?? []) {
    const bm = bMap.get(am.id);
    if (!bm) return false;
    if (
      am.tagKey !== bm.tagKey ||
      getTagMappingTargetKey(am.target) !== getTagMappingTargetKey(bm.target) ||
      (am.scale ?? 1) !== (bm.scale ?? 1) ||
      (am.offset ?? 0) !== (bm.offset ?? 0)
    ) {
      return false;
    }
  }
  return true;
}

function isOptionalVector3TupleEqual(
  a: Vector3Tuple | undefined,
  b: Vector3Tuple | undefined,
): boolean {
  if (!a || !b) return a === b;
  return isVector3TupleEqual(a, b);
}

function isMapsInfoEqual(a: SavedMapInfo[], b: SavedMapInfo[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].path !== b[i].path) return false;
    if (a[i].name !== b[i].name) return false;
    // 잠금은 씬 데이터다 — 토글이 dirty/undo에 잡혀야 저장된다.
    // 지도는 필드 없음 = 잠김(types.ts 주석 참고).
    if ((a[i].locked !== false) !== (b[i].locked !== false)) return false;
    // transform은 비교해야 지도 이동이 dirty로 잡힌다.
    if (!isOptionalVector3TupleEqual(a[i].position, b[i].position)) return false;
    if (!isOptionalVector3TupleEqual(a[i].rotation, b[i].rotation)) return false;
    if (!isOptionalVector3TupleEqual(a[i].scale, b[i].scale)) return false;
  }
  return true;
}

function isTextInfoEqual(a: SavedTextInfo, b: SavedTextInfo): boolean {
  return (
    a.id === b.id &&
    a.content === b.content &&
    a.color === b.color &&
    (a.locked ?? false) === (b.locked ?? false) &&
    isVector3TupleEqual(a.position, b.position) &&
    isVector3TupleEqual(a.rotation, b.rotation) &&
    isVector3TupleEqual(a.scale, b.scale)
  );
}

function isMeshOverrideEqual(
  a: SavedMeshOverride,
  b: SavedMeshOverride,
): boolean {
  if (a.meshPath !== b.meshPath) return false;
  if (a.opacity !== b.opacity) return false;
  if (a.visible !== b.visible) return false;
  if (a.name !== b.name) return false;
  const vecKeys: (keyof Pick<
    SavedMeshOverride,
    'position' | 'rotation' | 'scale'
  >)[] = ['position', 'rotation', 'scale'];
  for (const k of vecKeys) {
    const av = a[k];
    const bv = b[k];
    if (!av && !bv) continue;
    if (!av || !bv) return false;
    if (!isVector3TupleEqual(av, bv)) return false;
  }
  return true;
}

function isMeshOverrideListEqual(
  a: SavedMeshOverride[] | undefined,
  b: SavedMeshOverride[] | undefined,
): boolean {
  const aLen = a?.length ?? 0;
  const bLen = b?.length ?? 0;
  if (aLen !== bLen) return false;
  if (aLen === 0) return true;
  // 순서 무관 비교: meshPath 기준 lookup
  const bMap = new Map((b ?? []).map((o) => [o.meshPath, o]));
  for (const ao of a ?? []) {
    const bo = bMap.get(ao.meshPath);
    if (!bo) return false;
    if (!isMeshOverrideEqual(ao, bo)) return false;
  }
  return true;
}

function isRigJointEqual(a: RigJoint, b: RigJoint): boolean {
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.node === b.node &&
    a.type === b.type &&
    a.axis === b.axis &&
    a.min === b.min &&
    a.max === b.max &&
    (a.sign ?? 1) === (b.sign ?? 1)
  );
}

function isRigConstraintEqual(a: RigConstraint, b: RigConstraint): boolean {
  if (a.type !== b.type || a.id !== b.id || a.label !== b.label) return false;
  // 현재 union 은 linear 뿐이다. 타입이 늘면 여기서 분기한다.
  return (
    a.input === b.input &&
    a.output === b.output &&
    a.factor === b.factor &&
    (a.offset ?? 0) === (b.offset ?? 0)
  );
}

/**
 * 리그 정의는 순서까지 비교한다 — 목록 UI 순서가 곧 저장 순서라 재정렬도
 * 편집이다. 관절·구속조건 배열도 마찬가지.
 */
function isRigDefinitionListEqual(
  a: RigDefinition[] | undefined,
  b: RigDefinition[] | undefined,
): boolean {
  const aList = a ?? [];
  const bList = b ?? [];
  if (aList.length !== bList.length) return false;
  for (let i = 0; i < aList.length; i++) {
    const ar = aList[i];
    const br = bList[i];
    if (
      ar.id !== br.id ||
      ar.name !== br.name ||
      ar.modelPath !== br.modelPath ||
      ar.joints.length !== br.joints.length ||
      ar.constraints.length !== br.constraints.length
    ) {
      return false;
    }
    for (let j = 0; j < ar.joints.length; j++) {
      if (!isRigJointEqual(ar.joints[j], br.joints[j])) return false;
    }
    for (let j = 0; j < ar.constraints.length; j++) {
      if (!isRigConstraintEqual(ar.constraints[j], br.constraints[j])) {
        return false;
      }
    }
  }
  return true;
}

function isModelInfoEqual(a: SavedModelInfo, b: SavedModelInfo): boolean {
  return (
    a.id === b.id &&
    a.equipName === b.equipName &&
    a.craneId === b.craneId &&
    a.path === b.path &&
    a.opacity === b.opacity &&
    (a.locked ?? false) === (b.locked ?? false) &&
    (a.labelHidden ?? false) === (b.labelHidden ?? false) &&
    a.rigId === b.rigId &&
    isVector3TupleEqual(a.position, b.position) &&
    isVector3TupleEqual(a.rotation, b.rotation) &&
    isVector3TupleEqual(a.scale, b.scale) &&
    isTagMappingListEqual(a.tagMappings, b.tagMappings) &&
    isMeshOverrideListEqual(a.meshOverrides, b.meshOverrides)
  );
}

export function isSceneInfoEqual(
  a: SavedSceneInfo | null,
  b: SavedSceneInfo | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  // 배경 선택도 저장 대상이라 dirty 판정에 포함한다. undefined(미지정)와
  // null(배경 없음)은 다른 상태이므로 === 로 구분한다.
  if (a.environmentId !== b.environmentId) return false;
  // 조명은 기본값으로 정규화해 비교한다 — 필드 없음과 명시적 기본값(그림자
  // Off, 태양 기본 위치)은 같은 상태다(sanitize가 기본값 필드를 생략하는
  // 규칙과 짝).
  if ((a.lighting?.shadows ?? false) !== (b.lighting?.shadows ?? false)) {
    return false;
  }
  if (
    (a.lighting?.sunAzimuth ?? SCENE_SUN_AZIMUTH_DEFAULT) !==
    (b.lighting?.sunAzimuth ?? SCENE_SUN_AZIMUTH_DEFAULT)
  ) {
    return false;
  }
  if (
    (a.lighting?.sunElevation ?? SCENE_SUN_ELEVATION_DEFAULT) !==
    (b.lighting?.sunElevation ?? SCENE_SUN_ELEVATION_DEFAULT)
  ) {
    return false;
  }
  if (!isMapsInfoEqual(a.maps ?? [], b.maps ?? [])) return false;
  if (!isCameraInfoEqual(a.camera ?? null, b.camera ?? null)) return false;
  // 리그 정의 편집이 dirty/undo 에 잡혀야 저장된다.
  if (!isRigDefinitionListEqual(a.rigs, b.rigs)) return false;
  if (a.models.length !== b.models.length) return false;
  for (let i = 0; i < a.models.length; i++) {
    if (!isModelInfoEqual(a.models[i], b.models[i])) return false;
  }
  const aTexts = a.texts ?? [];
  const bTexts = b.texts ?? [];
  if (aTexts.length !== bTexts.length) return false;
  for (let i = 0; i < aTexts.length; i++) {
    if (!isTextInfoEqual(aTexts[i], bTexts[i])) return false;
  }
  return true;
}

function isCameraInfoEqual(
  a: SavedCameraInfo | null,
  b: SavedCameraInfo | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    isVector3TupleEqual(a.position, b.position) &&
    isVector3TupleEqual(a.target, b.target)
  );
}
