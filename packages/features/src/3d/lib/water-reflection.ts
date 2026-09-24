import {
  getSceneMapCatalogItemByPath,
  type SavedMapInfo,
} from '@crane/domain/3d';
import type { Object3D } from 'three';

/**
 * 바다 미러 패스에서 뺄 객체 — 판정과 숨김/복원 헬퍼.
 *
 * 컨텍스트 지형(philly-terrain·okpo-terrain·okpo-tree)은 삼각형 수가 커서
 * 반사에 그리지 않는다. 카탈로그 `kind === 'context'` 가 출처이고, 두 캔버스의
 * isContextMap(그림자·Lambert)과 같은 판정이다. ModelMesh 가 지도 루트를
 * modelObjectRegistry 에 id 로 등록하므로 여기서는 id 만 고르고 객체 조회는
 * SceneWater 의 게터가 매 패스 한다. 돔·스프라이트는 model/
 * scene-reflection-exclusions 로 직접 등록된다.
 *
 * 숨김은 `visible` 토글이다(`layers` 안 씀) — three 는 visible=false 루트의
 * 서브트리를 통째로 건너뛰어 지도 루트 하나로 LOD 타일 전부가 빠진다.
 */

/** 씬 지도 중 컨텍스트 지형(카탈로그 kind 'context')의 id. 순서 보존. */
export function resolveReflectionExcludedMapIds(
  maps: readonly SavedMapInfo[] | undefined,
): string[] {
  if (!maps) return [];
  const ids: string[] = [];
  for (const map of maps) {
    if (getSceneMapCatalogItemByPath(map.path)?.kind === 'context') {
      ids.push(map.id);
    }
  }
  return ids;
}

/**
 * 현재 visible 인 객체만 숨기고 `hidden` 에 적재한다. 원래 invisible 인 것은
 * 건드리지 않아 복원 때 켜지지 않는다. `null`/`undefined` 는 건너뛴다
 * (늦게 등록되는 지도 루트). `hidden` 은 호출자가 재사용하는 스크래치다.
 */
export function hideForReflection(
  objects: Iterable<Object3D | null | undefined>,
  hidden: Object3D[],
): void {
  for (const object of objects) {
    if (!object || !object.visible) continue;
    object.visible = false;
    hidden.push(object);
  }
}

/** hideForReflection 이 숨긴 객체를 다시 켜고 스크래치를 비운다. */
export function restoreAfterReflection(hidden: Object3D[]): void {
  for (const object of hidden) object.visible = true;
  hidden.length = 0;
}
