import type { ChecklistItem } from '@crane/domain/inspection';
import type { FieldKind } from './field-route';
import { checklistOutcome, type FieldJudgments } from './field-checklist';

/**
 * 현장 등록의 단계형 초안 — 한 화면 한 질문. 사무실이 나중에 채우는 항목
 * (담당자·수행 주체·일정·고장 유형)은 현장에서 묻지 않는다.
 */
export type FieldStep =
  | 'asset'
  | 'symptom'
  | 'parts'
  | 'inspection'
  | 'photo'
  | 'priority';

export const FIELD_STEPS: Record<FieldKind, readonly FieldStep[]> = {
  repair: ['asset', 'symptom', 'photo', 'priority'],
  parts: ['asset', 'parts', 'priority'],
  inspection: ['asset', 'inspection', 'photo'],
};

export type RepairPriority = 'emergency' | 'high' | 'normal';
export type PartsPriority = 'urgent' | 'normal';

export interface FieldPartLine {
  partId: string;
  qty: number;
}

export interface FieldDraft {
  assetId: string | null;
  /** 증상(고장 신고) 또는 소견(점검 결과) — 프리셋 칩 + 자유 입력을 합친 문장. */
  symptom: string;
  component: string;
  photos: File[];
  repairPriority: RepairPriority;
  partsPriority: PartsPriority;
  parts: FieldPartLine[];
  inspectionType: 'frequent' | 'periodic' | 'emergency' | 'special';
  /** 체크리스트 항목 id → 판정. 점검 결과는 이것으로 정해진다(lib/field-checklist). */
  checklist: FieldJudgments;
  note: string;
}

export function emptyDraft(assetId: string | null = null): FieldDraft {
  return {
    assetId,
    symptom: '',
    component: '',
    photos: [],
    repairPriority: 'normal',
    partsPriority: 'normal',
    parts: [],
    inspectionType: 'frequent',
    checklist: {},
    note: '',
  };
}

/** 사진 수 상한 — 세션 메모리(object URL)에 들고 있으므로 작게. */
export const FIELD_MAX_PHOTOS = 4;
/** 증상 글자 상한 — 현장 입력은 짧다. */
export const FIELD_SYMPTOM_MAX = 300;

/** 해당 단계에서 "다음" 을 누를 수 있는가. 사진·확인 단계는 항상 통과. */
export function canProceed(
  step: FieldStep,
  draft: FieldDraft,
  /** 점검 단계의 체크리스트 템플릿 — 전 항목 판정이 조건. */
  template: readonly ChecklistItem[] = [],
): boolean {
  switch (step) {
    case 'asset':
      return draft.assetId !== null && draft.assetId.length > 0;
    case 'symptom':
      return draft.symptom.trim().length > 0;
    case 'parts':
      return draft.parts.some((p) => p.partId && p.qty > 0);
    case 'inspection':
      return checklistOutcome(template, draft.checklist) !== null;
    case 'photo':
    case 'priority':
      return true;
  }
}

/** 프리셋 칩 토글 — 문장 안에 같은 문구가 있으면 빼고 없으면 끝에 붙인다. */
export function toggleSymptomPreset(current: string, phrase: string): string {
  const parts = current
    .split(/[,，]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const i = parts.indexOf(phrase);
  if (i >= 0) parts.splice(i, 1);
  else parts.push(phrase);
  return parts.join(', ').slice(0, FIELD_SYMPTOM_MAX);
}

export function hasSymptomPreset(current: string, phrase: string): boolean {
  return current
    .split(/[,，]\s*/)
    .map((s) => s.trim())
    .includes(phrase);
}

/** 부품 줄 갱신 — 같은 partId 는 수량만, qty 0 이하는 제거. */
export function setPartLine(
  lines: readonly FieldPartLine[],
  partId: string,
  qty: number,
): FieldPartLine[] {
  const out = lines.filter((l) => l.partId !== partId);
  if (qty > 0) out.push({ partId, qty: Math.floor(qty) });
  return out;
}

export function addPhotos(
  current: readonly File[],
  incoming: readonly File[],
  max: number = FIELD_MAX_PHOTOS,
): File[] {
  return [...current, ...incoming].slice(0, max);
}
