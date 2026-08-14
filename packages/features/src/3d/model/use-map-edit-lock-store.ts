import { create } from 'zustand';

/**
 * 지도 편집 잠금 — 씬 데이터가 아니라 에디터의 작업 상태다.
 *
 * 잠금은 "지금 내가 지도를 만지는 중인가"라는 세션 한정 의도일 뿐,
 * 모니터링 화면에 보이는 결과를 아무것도 바꾸지 않는다. 그래서 씬 파일에
 * 저장하지 않는다 — 저장하면 자물쇠를 열기만 해도 "저장되지 않음"이 뜨고,
 * 사용자는 아무 배치도 바꾸지 않았는데 저장을 강요받는다.
 *
 * 기본값은 잠김이다. 지도는 화면 대부분을 덮는 거대 메시라, 열린 채로
 * 시작하면 다른 객체를 고르려는 클릭이 번번이 지도에 먹힌다. 그래서
 * 이 스토어는 "해제된 지도 id 집합"만 들고 있고, 없으면 잠긴 것으로 본다.
 *
 * 씬을 벗어나면(에디터 언마운트) clear()로 비워 다음 진입이 항상 잠긴
 * 상태에서 시작하게 한다.
 */
interface MapEditLockState {
  /** 잠금이 해제된 지도 id 집합. 여기 없으면 잠긴 것이다. */
  unlockedIds: Set<string>;
  setLocked: (id: string, locked: boolean) => void;
  clear: () => void;
}

export const useMapEditLockStore = create<MapEditLockState>()((set) => ({
  unlockedIds: new Set<string>(),

  setLocked: (id, locked) =>
    set((state) => {
      if (locked === !state.unlockedIds.has(id)) {
        return state;
      }
      const next = new Set(state.unlockedIds);
      if (locked) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { unlockedIds: next };
    }),

  clear: () =>
    set((state) => (state.unlockedIds.size === 0 ? state : { unlockedIds: new Set<string>() })),
}));

/**
 * 지도 하나의 잠금 여부만 boolean으로 구독한다. Set 참조가 바뀌어도
 * 해당 지도의 상태가 그대로면 리렌더되지 않는다.
 */
export function useIsMapLocked(id: string): boolean {
  return useMapEditLockStore((state) => !state.unlockedIds.has(id));
}
