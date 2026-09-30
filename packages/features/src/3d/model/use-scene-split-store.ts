import { create } from 'zustand';

/**
 * 분할 화면 상태 — 어느 캔버스(키 = regionId)가 지금 분할로 그리고 있는지.
 * 저장하지 않는 세션 상태다. 분할 지정(어느 뷰가 어느 칸인지)은 씬 파일
 * (`SavedSceneInfo.viewSplit`)이고, 여기는 켜짐 여부뿐이다.
 *
 * 한 번에 한 캔버스만 분할이다 — 실시간 관제 화면(독 배치·realtime)만 분할을
 * 지원하고, 그 화면은 region 당 하나다. 키를 두는 이유는 대시보드 미리보기
 * 같은 다른 캔버스가 같은 스토어를 읽어도 자기 것이 아니면 단일로 남게
 * 하기 위해서다.
 */
interface SceneSplitState {
  activeKey: string | null;
  enter: (key: string) => void;
  exit: () => void;
  /** 캔버스 언마운트 — 자기 키일 때만 끈다(다른 캔버스의 분할을 건드리지 않는다). */
  clear: (key: string) => void;
}

export const useSceneSplitStore = create<SceneSplitState>()((set, get) => ({
  activeKey: null,
  enter: (key) => {
    if (get().activeKey === key) return;
    set({ activeKey: key });
  },
  exit: () => {
    if (get().activeKey === null) return;
    set({ activeKey: null });
  },
  clear: (key) => {
    if (get().activeKey !== key) return;
    set({ activeKey: null });
  },
}));

/** 이 캔버스가 분할로 그리는 중인지. */
export function useSceneSplitActive(key: string): boolean {
  return useSceneSplitStore((s) => s.activeKey === key);
}
