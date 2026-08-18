/**
 * 씬 JSON 정규화 — **로드 경계에서 단 한 번** 수행한다.
 *
 * 예전에는 에디터만 이걸 거치고 뷰어는 원본 JSON을 그대로 소비했다. 그래서
 * legacy 단수 `map` 필드를 가진 씬은 에디터엔 지도가 보이고 뷰어엔 안 보였다.
 * id 중복 제거·opacity 클램프도 뷰어에는 적용되지 않아, 같은
 * 파일을 두 화면이 다르게 해석했다.
 *
 * 지금은 loadSceneInfoByRegionId가 이 함수를 통과시키므로 에디터·뷰어·
 * 리플레이가 **같은 데이터**를 본다. 이 파일이 도메인에 있는 이유다.
 */
import type {
  SavedCameraInfo,
  SavedMapInfo,
  SavedMeshOverride,
  SavedSceneInfo,
} from '../model/types';
import { createId } from '@crane/core/lib/create-id';
import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

function createSceneModelId() {
  return createId();
}

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVector3Tuple(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => isFiniteNumber(item))
  );
}

function clampOpacity(value: unknown) {
  if (!isFiniteNumber(value)) {
    return 1;
  }

  return clampToRange(Number(value), 0.1, 1);
}

function sanitizeMeshOverrides(
  raw: unknown,
): SavedMeshOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SavedMeshOverride[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.meshPath !== 'string' || o.meshPath.length === 0) continue;
    const sanitized: SavedMeshOverride = { meshPath: o.meshPath };
    if (isVector3Tuple(o.position)) sanitized.position = o.position as Vector3Tuple;
    if (isVector3Tuple(o.rotation)) sanitized.rotation = o.rotation as Vector3Tuple;
    if (isVector3Tuple(o.scale)) sanitized.scale = o.scale as Vector3Tuple;
    if (isFiniteNumber(o.opacity))
      sanitized.opacity = clampToRange(Number(o.opacity), 0.1, 1);
    if (typeof o.visible === 'boolean') sanitized.visible = o.visible;
    if (typeof o.name === 'string') sanitized.name = o.name;
    out.push(sanitized);
  }
  return out.length > 0 ? out : undefined;
}

export function sanitizeSceneInfo(sceneInfo: SavedSceneInfo): SavedSceneInfo {
  const seenIds = new Set<string>();

  const legacyMap = (sceneInfo as unknown as { map?: SavedMapInfo | null })?.map;
  const rawMaps = Array.isArray(sceneInfo?.maps)
    ? sceneInfo.maps
    : legacyMap
      ? [legacyMap]
      : [];
  const safeMaps = rawMaps.map((m) => {
    // transform은 optional이므로 유효할 때만 싣는다 — 손대지 않은 지도는
    // 저장본에서도 필드 없는 상태로 남아야 기존 씬과 diff가 없다.
    // 편집 잠금(locked)은 씬 데이터다. 필드가 없는 저장본(잠금이 세션
    // 상태였던 시절)은 잠김으로 정규화한다 — 종전 UX가 "항상 잠김 시작"
    // 이었으므로 화면 동작이 달라지지 않는다.
    const safeMap: SavedMapInfo = {
      id:
        typeof m.id === 'string' && m.id.length > 0 ? m.id : createSceneModelId(),
      path: typeof m.path === 'string' && m.path.length > 0 ? m.path : '',
      locked: m.locked !== false,
    };
    if (isVector3Tuple(m.position)) safeMap.position = m.position;
    if (isVector3Tuple(m.rotation)) safeMap.rotation = m.rotation;
    if (isVector3Tuple(m.scale)) safeMap.scale = m.scale;
    if (typeof m.name === 'string' && m.name.trim().length > 0) {
      safeMap.name = m.name;
    }
    return safeMap;
  });

  const safeModels = Array.isArray(sceneInfo?.models)
    ? sceneInfo.models.flatMap((model) => {
        if (
          !model ||
          typeof model.path !== 'string' ||
          model.path.length === 0 ||
          typeof model.equipName !== 'string' ||
          !isVector3Tuple(model.position) ||
          !isVector3Tuple(model.rotation) ||
          !isVector3Tuple(model.scale) ||
          !Array.isArray(model.valueMapList)
        ) {
          return [];
        }

        let nextId =
          typeof model.id === 'string' && model.id.length > 0
            ? model.id
            : createSceneModelId();

        if (seenIds.has(nextId)) {
          nextId = createSceneModelId();
        }

        seenIds.add(nextId);

        return [
          {
            ...model,
            id: nextId,
            opacity: clampOpacity(model.opacity),
            meshOverrides: sanitizeMeshOverrides(model.meshOverrides),
            // true가 아닌 값(과거 버전이 남긴 문자열 등)은 잠기지 않은
            // 것으로 정규화한다. undefined는 JSON 직렬화에서 빠진다.
            locked: model.locked === true ? true : undefined,
          },
        ];
      })
    : [];

  const safeTexts = Array.isArray(sceneInfo?.texts)
    ? sceneInfo.texts.flatMap((text) => {
        if (
          !text ||
          typeof text.content !== 'string' ||
          typeof text.color !== 'string' ||
          !isVector3Tuple(text.position) ||
          !isVector3Tuple(text.rotation) ||
          !isVector3Tuple(text.scale)
        ) {
          return [];
        }

        let nextId =
          typeof text.id === 'string' && text.id.length > 0
            ? text.id
            : createSceneModelId();

        if (seenIds.has(nextId)) {
          nextId = createSceneModelId();
        }

        seenIds.add(nextId);

        return [{ ...text, id: nextId }];
      })
    : [];

  const safeCamera = sanitizeCamera(sceneInfo?.camera);

  const sanitized: SavedSceneInfo = {
    maps: safeMaps,
    models: safeModels,
    texts: safeTexts,
    camera: safeCamera,
  };

  // environmentId는 3-상태다(문자열=선택 / null=배경 없음 / 없음=region 기본).
  // 셋을 구분해 실어야 하므로 값이 있을 때만 넣는다 — 미지정 씬에 null을
  // 채워 넣으면 region 기본 배경이 꺼져버린다.
  const rawEnvironmentId = (sceneInfo as SavedSceneInfo).environmentId;
  if (typeof rawEnvironmentId === 'string' && rawEnvironmentId.length > 0) {
    sanitized.environmentId = rawEnvironmentId;
  } else if (rawEnvironmentId === null) {
    sanitized.environmentId = null;
  }

  return sanitized;
}

function sanitizeCamera(
  camera: SavedCameraInfo | null | undefined,
): SavedCameraInfo | null {
  if (
    !camera ||
    !isVector3Tuple(camera.position) ||
    !isVector3Tuple(camera.target)
  ) {
    return null;
  }

  return {
    position: camera.position,
    target: camera.target,
  };
}
