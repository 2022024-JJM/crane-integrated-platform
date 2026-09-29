import { create } from 'zustand';
import type {
  EquipmentLabelState,
  EquipmentOutlineState,
} from '@crane/core/types/status';
import type { StatusTagRole } from '@crane/domain/3d';
import {
  EMPTY_LABEL_PREVIEW,
  isEmptyLabelPreview,
  resolvePreviewLabelState,
  setPreviewBit,
  setPreviewMoving,
  type LabelStatePreview,
} from '../lib/model-label-state';
import { resolvePreviewOutlineState } from '../lib/model-outline-state';

/**
 * 라벨 표시 상태·외곽선 미리보기 — 씬 에디터에서 상태 값을 골라 라벨과 외곽선
 * 모양을 바로 확인한다. 에디터에는 값 생산자가 없어(시뮬레이션 종료·실시간
 * 미연결) 상태 태그를 연결해도 라벨이 늘 "상태 미확인"이고 외곽선이 없기
 * 때문이다.
 *
 * 세션 상태다 — 씬 데이터·히스토리·dirty 에 닿지 않는다. 대상은 한 번에 모델
 * 하나이고, 다른 모델의 값을 고르면 앞선 미리보기는 버린다. 인스펙터의 상태
 * 태그 구역이 닫힐 때 `clear()` 로 지운다 — 남아 있으면 에디터 라벨이 저장된
 * 상태처럼 보인다.
 */
interface LabelPreviewState {
  modelId: string | null;
  preview: LabelStatePreview;
  /** `preview` 에서 파생한 표시 상태. 미리보기가 없으면 null. */
  state: EquipmentLabelState | null;
  /** `preview` 에서 파생한 외곽선. 미리보기가 없으면 null. */
  outline: EquipmentOutlineState | null;
  /** null 은 그 역할의 미리보기를 뗀다. */
  setBit: (modelId: string, role: StatusTagRole, value: boolean | null) => void;
  setMoving: (modelId: string, value: boolean | null) => void;
  clear: () => void;
}

export const useLabelPreviewStore = create<LabelPreviewState>()((set, get) => {
  const apply = (
    modelId: string,
    update: (preview: LabelStatePreview) => LabelStatePreview,
  ) => {
    const current = get();
    const base =
      current.modelId === modelId ? current.preview : EMPTY_LABEL_PREVIEW;
    const next = update(base);
    if (isEmptyLabelPreview(next)) {
      // 같은 모델의 마지막 값을 뗐거나, 미리보기가 없는 모델에서 뗀 것 —
      // 후자는 다른 모델의 미리보기를 건드리지 않는다.
      if (current.modelId === modelId) current.clear();
      return;
    }
    if (current.modelId === modelId && next === current.preview) return;
    set({
      modelId,
      preview: next,
      state: resolvePreviewLabelState(next),
      outline: resolvePreviewOutlineState(next),
    });
  };

  return {
    modelId: null,
    preview: EMPTY_LABEL_PREVIEW,
    state: null,
    outline: null,
    setBit: (modelId, role, value) =>
      apply(modelId, (preview) => setPreviewBit(preview, role, value)),
    setMoving: (modelId, value) =>
      apply(modelId, (preview) => setPreviewMoving(preview, value)),
    clear: () => {
      if (get().modelId === null) return;
      set({
        modelId: null,
        preview: EMPTY_LABEL_PREVIEW,
        state: null,
        outline: null,
      });
    },
  };
});

/** 이 모델의 미리보기 표시 상태 — 없으면 undefined(라벨 기본 모양). */
export function useLabelPreviewState(
  modelId: string,
): EquipmentLabelState | undefined {
  return useLabelPreviewStore((s) =>
    s.modelId === modelId ? (s.state ?? undefined) : undefined,
  );
}

/** 이 모델의 미리보기 외곽선 — 없으면 undefined(외곽선 없음). */
export function useOutlinePreviewState(
  modelId: string,
): EquipmentOutlineState | undefined {
  return useLabelPreviewStore((s) =>
    s.modelId === modelId ? (s.outline ?? undefined) : undefined,
  );
}

/** 이 모델의 미리보기 값 — 없으면 빈 미리보기(같은 참조). */
export function useLabelPreview(modelId: string): LabelStatePreview {
  return useLabelPreviewStore((s) =>
    s.modelId === modelId ? s.preview : EMPTY_LABEL_PREVIEW,
  );
}
