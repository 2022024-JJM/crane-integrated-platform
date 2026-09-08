import { create } from 'zustand';

interface UniformScaleState {
  /** 인스펙터 크기 입력 시 나머지 축도 같은 비율로 따라가게 할지 여부. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

/**
 * 인스펙터 "비율 유지" 체크 상태.
 *
 * TransformSection은 모델/메시/텍스트/지도 인스펙터마다 따로 마운트되고
 * 탭·선택 전환 시 리마운트되므로 컴포넌트 로컬 state로는 체크가 유지되지
 * 않는다. 기즈모(TransformControls) 경로는 이 값을 읽지 않는다.
 */
export const useUniformScaleStore = create<UniformScaleState>()((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
  toggle: () => set((state) => ({ enabled: !state.enabled })),
}));
