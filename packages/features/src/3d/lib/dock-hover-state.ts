/**
 * 씬 독(dock)의 hover 펼침/접힘 상태기계 — 순수 리듀서.
 *
 * 타이머(setTimeout)는 여기서 걸지 않는다. 리듀서는 "지금 어떤 타이머가
 * 대기 중이어야 하는지"(`pendingTimer`)만 상태로 돌려주고, 실제 예약·취소는
 * 훅(use-scene-dock)이 `pendingTimer` 변화를 보고 한다. 그래서 지연·재진입·
 * hold 같은 경계가 DOM·타이머 없이 테스트된다.
 *
 * 규칙:
 * - enter → openDelay 뒤 펼침. 열리기 전에 leave 하면 취소(핸들 스침 무시).
 * - leave → closeDelay 뒤 접힘. 그 사이 enter 하면 취소.
 * - hold(팝오버 열림·키보드 포커스·드래그 중)가 하나라도 있으면 접지 않는다.
 *   마지막 hold 가 풀렸을 때 마우스가 밖이면 그때 closeDelay 를 시작한다.
 * - toggle(핸들 클릭·Enter/Space)은 지연 없이 즉시 펼치거나 접는다.
 * - pinned 면 항상 펼침이고 enter/leave/escape/toggle 은 무시한다.
 * - unpin 하면 마우스가 안에 있거나 hold 중이면 펼친 채 두고, 아니면 접힘 예약.
 * - 변화가 없으면 같은 상태 참조를 돌려준다 (불필요한 리렌더 방지).
 */

export type DockTimer = 'open' | 'close';

export interface DockHoverState {
  expanded: boolean;
  pinned: boolean;
  /** 포인터가 독 위에 있는지. leave 후 hold 해제 시 접을지 판단에 쓴다. */
  hovered: boolean;
  /** 접힘을 막는 조건의 개수(팝오버·포커스·드래그). 0 미만으로 내려가지 않는다. */
  holdCount: number;
  /** 훅이 예약해야 하는 타이머. null 이면 대기 중인 타이머가 없다. */
  pendingTimer: DockTimer | null;
}

export type DockHoverEvent =
  | { type: 'enter' }
  | { type: 'leave' }
  | { type: 'holdStart' }
  | { type: 'holdEnd' }
  | { type: 'escape' }
  /** 핸들 클릭·키보드 활성화 — 지연 없이 즉시 펼치거나 접는다. */
  | { type: 'toggle' }
  | { type: 'setPinned'; pinned: boolean }
  | { type: 'timerFired'; timer: DockTimer };

export const DOCK_OPEN_DELAY_MS = 100;
export const DOCK_CLOSE_DELAY_MS = 300;

export function dockTimerDelayMs(timer: DockTimer): number {
  return timer === 'open' ? DOCK_OPEN_DELAY_MS : DOCK_CLOSE_DELAY_MS;
}

export function createDockHoverState(pinned: boolean): DockHoverState {
  return {
    expanded: pinned,
    pinned,
    hovered: false,
    holdCount: 0,
    pendingTimer: null,
  };
}

function patch(
  state: DockHoverState,
  next: Partial<DockHoverState>,
): DockHoverState {
  let changed = false;
  for (const key of Object.keys(next) as (keyof DockHoverState)[]) {
    if (state[key] !== next[key]) {
      changed = true;
      break;
    }
  }
  return changed ? { ...state, ...next } : state;
}

/** 접힘 예약이 허용되는 상황인지 — 펼쳐져 있고, 고정·hover·hold 가 없어야 한다. */
function canScheduleClose(state: DockHoverState): boolean {
  return (
    state.expanded && !state.pinned && !state.hovered && state.holdCount === 0
  );
}

export function reduceDockHover(
  state: DockHoverState,
  event: DockHoverEvent,
): DockHoverState {
  switch (event.type) {
    case 'enter': {
      if (state.pinned) {
        return patch(state, { hovered: true });
      }
      if (state.expanded) {
        // 접힘 대기 중이었다면 취소
        return patch(state, {
          hovered: true,
          pendingTimer:
            state.pendingTimer === 'close' ? null : state.pendingTimer,
        });
      }
      return patch(state, { hovered: true, pendingTimer: 'open' });
    }
    case 'leave': {
      if (state.pinned) {
        return patch(state, { hovered: false });
      }
      if (!state.expanded) {
        // 열리기 전에 벗어남 — 열림 예약 취소
        return patch(state, { hovered: false, pendingTimer: null });
      }
      const next = patch(state, { hovered: false });
      return canScheduleClose(next)
        ? patch(next, { pendingTimer: 'close' })
        : next;
    }
    case 'holdStart': {
      return patch(state, {
        holdCount: state.holdCount + 1,
        pendingTimer:
          state.pendingTimer === 'close' ? null : state.pendingTimer,
      });
    }
    case 'holdEnd': {
      const next = patch(state, {
        holdCount: Math.max(0, state.holdCount - 1),
      });
      if (next.holdCount === 0 && canScheduleClose(next)) {
        return patch(next, { pendingTimer: 'close' });
      }
      return next;
    }
    case 'escape': {
      if (state.pinned) {
        return state;
      }
      return patch(state, { expanded: false, pendingTimer: null });
    }
    case 'toggle': {
      if (state.pinned) {
        return state;
      }
      return patch(state, { expanded: !state.expanded, pendingTimer: null });
    }
    case 'setPinned': {
      if (event.pinned) {
        return patch(state, {
          pinned: true,
          expanded: true,
          pendingTimer: null,
        });
      }
      const next = patch(state, { pinned: false });
      if (next === state) {
        return state;
      }
      return canScheduleClose(next)
        ? patch(next, { pendingTimer: 'close' })
        : next;
    }
    case 'timerFired': {
      // 예약과 다른 타이머의 발화는 취소된 옛 타이머 — 무시
      if (state.pendingTimer !== event.timer) {
        return state;
      }
      if (event.timer === 'open') {
        return patch(state, { expanded: true, pendingTimer: null });
      }
      return patch(state, { expanded: false, pendingTimer: null });
    }
  }
}
