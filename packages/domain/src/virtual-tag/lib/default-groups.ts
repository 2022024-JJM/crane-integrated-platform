import {
  VIRTUAL_TAG_GROUP_NAME_MAX,
  VIRTUAL_TAG_GROUP_PRESETS,
  type VirtualTagGroup,
  type VirtualTagGroupPreset,
} from '../model/types';

/**
 * 장비 등록 때 시드하는 기본 그룹 — 실시간 태그 카탈로그의 묶음(시각·계측값·
 * 상태) 순서 그대로다. 이름은 호출자가 번역해 넘긴다(도메인은 i18n 을 모른다).
 * id 도 호출자가 만든다(createId) — 테스트 결정론을 위해 여기서 난수를 쓰지 않는다.
 */
export function createDefaultGroups(
  names: Record<VirtualTagGroupPreset, string>,
  nextId: () => string,
): VirtualTagGroup[] {
  return VIRTUAL_TAG_GROUP_PRESETS.map((preset) => ({
    id: nextId(),
    name: names[preset].trim().slice(0, VIRTUAL_TAG_GROUP_NAME_MAX),
    preset,
  }));
}

/**
 * 실시간 태그 메타의 묶음 문자열(`getMonitoringTagMetadata().category`)을 기본
 * 그룹 표식으로. 모르는 값은 status — 카탈로그도 그렇게 떨어뜨린다.
 */
export function toGroupPreset(category: string): VirtualTagGroupPreset {
  return category === 'datetime' || category === 'measurement'
    ? category
    : 'status';
}

/** 표식이 붙은 그룹을 찾는다. 이름을 바꿨어도 표식으로 찾는다. */
export function findPresetGroup(
  groups: readonly VirtualTagGroup[],
  preset: VirtualTagGroupPreset,
): VirtualTagGroup | undefined {
  return groups.find((group) => group.preset === preset);
}
