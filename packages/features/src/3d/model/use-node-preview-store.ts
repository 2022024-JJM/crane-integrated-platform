import { create } from 'zustand';

/** 미리보기 대상 — 모델 id 와 그 안의 GLB 노드 경로(`''` 는 모델 루트). */
export interface NodePreview {
  modelId: string;
  nodePath: string;
}

interface NodePreviewState {
  preview: NodePreview | null;
  startPreview: (modelId: string, nodePath: string) => void;
  endPreview: () => void;
}

/**
 * 노드 미리보기 — 씬 에디터 인스펙터의 노드 선택기(태그 매핑·리깅)에서 행을
 * 하이라이트(호버·↑↓)하는 동안 그 노드를 알린다. 캔버스가 받아 노드 서브트리에
 * 실루엣을 두르고 같은 모델의 나머지를 고스트로 그리며 카메라를 그 노드에
 * 맞춘다. 끝나도 카메라는 돌아오지 않는다.
 *
 * 세션 상태다 — 씬 데이터·히스토리·dirty 에 닿지 않는다. 대상은 한 번에
 * 하나이고, 선택기가 닫힐 때 `endPreview` 로 끝낸다. 같은 대상 재시작과 빈
 * 상태 종료는 참조를 유지한다(구독자 리렌더 없음).
 */
export const useNodePreviewStore = create<NodePreviewState>()((set) => ({
  preview: null,
  startPreview: (modelId, nodePath) =>
    set((state) =>
      state.preview &&
      state.preview.modelId === modelId &&
      state.preview.nodePath === nodePath
        ? state
        : { preview: { modelId, nodePath } },
    ),
  endPreview: () =>
    set((state) => (state.preview === null ? state : { preview: null })),
}));
