import type { EquipmentLabelState } from '@crane/core/types/status';
import type { ModelStatusTags, StatusTagRole } from '@crane/domain/3d';

/**
 * 상태 태그 섹션의 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는 규칙
 * (AGENTS.md) 대로 여기서 만들고 컴포넌트는 그리기만 한다.
 */

/**
 * 역할 하나의 태그 키를 바꾼 새 목록. 빈 키(공백 포함)는 그 역할을 뗀다.
 * 바뀌는 것이 없으면 **같은 참조**를 돌려준다 — 편집 채널이 참조로 no-op 을
 * 가려 히스토리·dirty 에 남기지 않는다(tagMappings updater 와 같은 규칙).
 */
export function setStatusTag(
  tags: ModelStatusTags,
  role: StatusTagRole,
  key: string,
): ModelStatusTags {
  const next = key.trim();
  if ((tags[role] ?? '') === next) return tags;
  const rest = { ...tags };
  delete rest[role];
  return next.length > 0 ? { ...rest, [role]: next } : rest;
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

/** 표시 상태를 한 줄로 — 색 이름 뒤에 켜진 아이콘 이름을 잇는다. */
export function describeLabelState(
  state: EquipmentLabelState,
  names: {
    tone: Record<EquipmentLabelState['tone'], string>;
    bypass: string;
    freeSwing: string;
  },
): string {
  const parts = [names.tone[state.tone]];
  if (state.bypass) parts.push(names.bypass);
  if (state.freeSwing) parts.push(names.freeSwing);
  return parts.join(' · ');
}
