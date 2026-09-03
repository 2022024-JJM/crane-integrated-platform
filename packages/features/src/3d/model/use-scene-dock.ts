import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  createDockHoverState,
  dockTimerDelayMs,
  reduceDockHover,
  type DockHoverEvent,
  type DockHoverState,
} from '../lib/dock-hover-state';
import { readDockPinned, writeDockPinned } from '../lib/dock-storage';

/**
 * 독 껍데기(@crane/ui SceneDock*)가 호출하는 인터랙션 핸들러 묶음.
 * 껍데기는 이 객체를 그대로 이벤트에 연결만 하고 판단은 하지 않는다.
 */
export interface SceneDockHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  /** 핸들 클릭 — 지연 없이 즉시 펼치거나 접는다. 고정 중엔 no-op. */
  onToggle: () => void;
  /** 접힘을 막는 조건 시작(팝오버 열림·키보드 포커스·드래그). 반드시 holdEnd 와 짝. */
  holdStart: () => void;
  holdEnd: () => void;
}

export interface SceneDockController {
  expanded: boolean;
  pinned: boolean;
  setPinned: (next: boolean) => void;
  togglePinned: () => void;
  handlers: SceneDockHandlers;
}

/**
 * 씬 독 하나의 상태(hover 펼침·고정)를 소유하는 훅.
 *
 * 상태 전이는 lib/dock-hover-state 의 순수 리듀서가, 타이머 예약은 이 훅이
 * `pendingTimer` 를 보고 한다. 고정 여부는 localStorage 에 영속화한다.
 * 이 훅은 Monitoring3dView 가 소유한다 — 앱 페이지에 두면 페이지 리렌더가
 * cameraPreset 참조를 흔들어 카메라가 리셋되는 사고(monitoring-3d-view.tsx
 * 주석)로 이어진다.
 */
export function useSceneDock(dockId: string): SceneDockController {
  const [state, setState] = useState<DockHoverState>(() =>
    createDockHoverState(readDockPinned(dockId)),
  );
  const dispatch = useCallback((event: DockHoverEvent) => {
    setState((prev) => reduceDockHover(prev, event));
  }, []);

  // 타이머 예약: pendingTimer 가 바뀔 때마다 이전 예약을 지우고 새로 건다.
  // enter→leave→enter 처럼 같은 값('close')이 연달아 와도 리듀서가 중간에
  // null 을 거치므로 effect 가 다시 돈다.
  const pendingTimer = state.pendingTimer;
  useEffect(() => {
    if (!pendingTimer) {
      return;
    }
    const timer = pendingTimer;
    const handle = setTimeout(() => {
      dispatch({ type: 'timerFired', timer });
    }, dockTimerDelayMs(timer));
    return () => {
      clearTimeout(handle);
    };
  }, [dispatch, pendingTimer]);

  const setPinned = useCallback(
    (next: boolean) => {
      writeDockPinned(dockId, next);
      dispatch({ type: 'setPinned', pinned: next });
    },
    [dispatch, dockId],
  );

  const pinned = state.pinned;
  const togglePinned = useCallback(() => {
    setPinned(!pinned);
  }, [pinned, setPinned]);

  const handlers = useMemo<SceneDockHandlers>(
    () => ({
      onPointerEnter: () => dispatch({ type: 'enter' }),
      onPointerLeave: () => dispatch({ type: 'leave' }),
      onKeyDown: (event) => {
        if (event.key === 'Escape') {
          dispatch({ type: 'escape' });
        }
      },
      onToggle: () => dispatch({ type: 'toggle' }),
      holdStart: () => dispatch({ type: 'holdStart' }),
      holdEnd: () => dispatch({ type: 'holdEnd' }),
    }),
    [dispatch],
  );

  return {
    expanded: state.expanded,
    pinned,
    setPinned,
    togglePinned,
    handlers,
  };
}
