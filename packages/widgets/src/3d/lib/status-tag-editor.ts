import type {
  EquipmentLabelState,
  EquipmentOutlineState,
} from '@crane/core/types/status';
import {
  hasAnyTagKey,
  isTagKeySlotsEqual,
  setSlotTagKey,
  type ModelStatusTags,
  type StatusTagBinding,
  type StatusTagRole,
  type TagSlot,
} from '@crane/domain/3d';

/**
 * 상태 태그 섹션의 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는 규칙
 * (AGENTS.md) 대로 여기서 만들고 컴포넌트는 그리기만 한다.
 */

const EMPTY_BINDING: StatusTagBinding = {};

/**
 * 역할 하나의 연결(두 슬롯)을 통째로 바꾼 새 목록. 키는 trim 하고 빈 슬롯은
 * 떼며, 두 슬롯 다 비면 그 역할을 뗀다. 바뀌는 것이 없으면 **같은 참조**를
 * 돌려준다 — 편집 채널이 참조로 no-op 을 가려 히스토리·dirty 에 남기지
 * 않는다(tagMappings updater 와 같은 규칙).
 */
export function setStatusTagBinding(
  tags: ModelStatusTags,
  role: StatusTagRole,
  binding: StatusTagBinding,
): ModelStatusTags {
  const current = tags[role] ?? EMPTY_BINDING;
  // 두 슬롯을 setSlotTagKey 로 정규화(trim·빈 슬롯 제거)한다.
  const next = setSlotTagKey(
    setSlotTagKey(current, 'realtime', binding.realtimeTagKey ?? ''),
    'virtual',
    binding.virtualTagKey ?? '',
  );
  if (isTagKeySlotsEqual(current, next)) return tags;
  const rest = { ...tags };
  delete rest[role];
  return hasAnyTagKey(next) ? { ...rest, [role]: next } : rest;
}

/** 역할 하나의 한 슬롯 키만 바꾼다. 규칙은 `setStatusTagBinding` 과 같다. */
export function setStatusTag(
  tags: ModelStatusTags,
  role: StatusTagRole,
  slot: TagSlot,
  key: string,
): ModelStatusTags {
  const current = tags[role] ?? EMPTY_BINDING;
  return setStatusTagBinding(tags, role, setSlotTagKey(current, slot, key));
}

/** 미리보기 값 선택지 — none 은 "고르지 않음"(그 항목의 미리보기를 뗀다). */
export const PREVIEW_CHOICES = ['none', 'off', 'on'] as const;
export type PreviewChoice = (typeof PREVIEW_CHOICES)[number];

export function toPreviewChoice(value: boolean | undefined): PreviewChoice {
  if (value === undefined) return 'none';
  return value ? 'on' : 'off';
}

export function fromPreviewChoice(choice: PreviewChoice): boolean | null {
  if (choice === 'none') return null;
  return choice === 'on';
}

/**
 * 표시 상태를 한 줄로 — 색 이름 뒤에 켜진 아이콘 이름, 그 뒤에 외곽선 이름을
 * 잇는다. 외곽선이 없으면('none'·생략) 외곽선은 적지 않는다.
 */
export function describeLabelState(
  state: EquipmentLabelState,
  names: {
    tone: Record<EquipmentLabelState['tone'], string>;
    bypass: string;
    freeSwing: string;
    outline: Record<Exclude<EquipmentOutlineState, 'none'>, string>;
  },
  outline: EquipmentOutlineState = 'none',
): string {
  const parts = [names.tone[state.tone]];
  if (state.bypass) parts.push(names.bypass);
  if (state.freeSwing) parts.push(names.freeSwing);
  if (outline !== 'none') parts.push(names.outline[outline]);
  return parts.join(' · ');
}
