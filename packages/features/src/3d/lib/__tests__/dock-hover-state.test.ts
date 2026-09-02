import { describe, expect, it } from 'vitest';
import {
  DOCK_CLOSE_DELAY_MS,
  DOCK_OPEN_DELAY_MS,
  createDockHoverState,
  dockTimerDelayMs,
  reduceDockHover,
  type DockHoverEvent,
  type DockHoverState,
} from '../dock-hover-state';

function run(state: DockHoverState, ...events: DockHoverEvent[]) {
  return events.reduce(reduceDockHover, state);
}

describe('createDockHoverState', () => {
  it('고정이면 펼쳐진 채 시작하고, 아니면 접힌 채 시작한다', () => {
    expect(createDockHoverState(false)).toEqual({
      expanded: false,
      pinned: false,
      hovered: false,
      holdCount: 0,
      pendingTimer: null,
    });
    expect(createDockHoverState(true)).toMatchObject({
      expanded: true,
      pinned: true,
      pendingTimer: null,
    });
  });
});

describe('dockTimerDelayMs', () => {
  it('열림·닫힘 지연을 상수 그대로 돌려준다', () => {
    expect(dockTimerDelayMs('open')).toBe(DOCK_OPEN_DELAY_MS);
    expect(dockTimerDelayMs('close')).toBe(DOCK_CLOSE_DELAY_MS);
    expect(DOCK_OPEN_DELAY_MS).toBeLessThan(DOCK_CLOSE_DELAY_MS);
  });
});

describe('reduceDockHover — 열림', () => {
  it('enter 는 즉시 펼치지 않고 open 타이머만 예약한다', () => {
    const next = run(createDockHoverState(false), { type: 'enter' });
    expect(next.expanded).toBe(false);
    expect(next.pendingTimer).toBe('open');
    expect(next.hovered).toBe(true);
  });

  it('open 타이머가 발화하면 펼쳐진다', () => {
    const next = run(
      createDockHoverState(false),
      { type: 'enter' },
      { type: 'timerFired', timer: 'open' },
    );
    expect(next.expanded).toBe(true);
    expect(next.pendingTimer).toBeNull();
  });

  it('열리기 전에 leave 하면 예약이 취소되고 접힌 채 남는다 (핸들 스침)', () => {
    const next = run(
      createDockHoverState(false),
      { type: 'enter' },
      { type: 'leave' },
    );
    expect(next.expanded).toBe(false);
    expect(next.pendingTimer).toBeNull();
    expect(next.hovered).toBe(false);
  });

  it('취소된 open 타이머가 뒤늦게 발화해도 무시한다', () => {
    const before = run(
      createDockHoverState(false),
      { type: 'enter' },
      { type: 'leave' },
    );
    const after = reduceDockHover(before, {
      type: 'timerFired',
      timer: 'open',
    });
    expect(after).toBe(before);
    expect(after.expanded).toBe(false);
  });
});

describe('reduceDockHover — 닫힘', () => {
  const opened = run(
    createDockHoverState(false),
    { type: 'enter' },
    { type: 'timerFired', timer: 'open' },
  );

  it('leave 는 close 타이머를 예약하고 펼침은 유지한다', () => {
    const next = reduceDockHover(opened, { type: 'leave' });
    expect(next.expanded).toBe(true);
    expect(next.pendingTimer).toBe('close');
  });

  it('close 타이머가 발화하면 접힌다', () => {
    const next = run(
      opened,
      { type: 'leave' },
      { type: 'timerFired', timer: 'close' },
    );
    expect(next.expanded).toBe(false);
    expect(next.pendingTimer).toBeNull();
  });

  it('close 대기 중 다시 enter 하면 예약이 취소된다 (잠깐 벗어남 허용)', () => {
    const next = run(opened, { type: 'leave' }, { type: 'enter' });
    expect(next.expanded).toBe(true);
    expect(next.pendingTimer).toBeNull();
  });

  it('취소된 close 타이머가 뒤늦게 발화해도 접히지 않는다', () => {
    const before = run(opened, { type: 'leave' }, { type: 'enter' });
    const after = reduceDockHover(before, {
      type: 'timerFired',
      timer: 'close',
    });
    expect(after).toBe(before);
    expect(after.expanded).toBe(true);
  });

  it('펼쳐져 있을 때 enter 를 반복해도 상태 참조가 유지된다', () => {
    const hovered = reduceDockHover(opened, { type: 'enter' });
    expect(reduceDockHover(hovered, { type: 'enter' })).toBe(hovered);
  });
});

describe('reduceDockHover — hold', () => {
  const opened = run(
    createDockHoverState(false),
    { type: 'enter' },
    { type: 'timerFired', timer: 'open' },
  );

  it('hold 중에는 leave 해도 close 를 예약하지 않는다', () => {
    const next = run(opened, { type: 'holdStart' }, { type: 'leave' });
    expect(next.expanded).toBe(true);
    expect(next.pendingTimer).toBeNull();
    expect(next.holdCount).toBe(1);
  });

  it('holdStart 는 대기 중인 close 예약을 취소한다', () => {
    const next = run(opened, { type: 'leave' }, { type: 'holdStart' });
    expect(next.pendingTimer).toBeNull();
  });

  it('hold 가 풀렸을 때 마우스가 밖이면 그제서야 close 를 예약한다', () => {
    const next = run(
      opened,
      { type: 'holdStart' },
      { type: 'leave' },
      { type: 'holdEnd' },
    );
    expect(next.holdCount).toBe(0);
    expect(next.pendingTimer).toBe('close');
  });

  it('hold 가 풀려도 마우스가 안에 있으면 close 를 예약하지 않는다', () => {
    const next = run(opened, { type: 'holdStart' }, { type: 'holdEnd' });
    expect(next.pendingTimer).toBeNull();
    expect(next.expanded).toBe(true);
  });

  it('hold 가 중첩되면 마지막 하나가 풀릴 때까지 접지 않는다', () => {
    const twice = run(
      opened,
      { type: 'holdStart' },
      { type: 'holdStart' },
      { type: 'leave' },
      { type: 'holdEnd' },
    );
    expect(twice.holdCount).toBe(1);
    expect(twice.pendingTimer).toBeNull();
    const released = reduceDockHover(twice, { type: 'holdEnd' });
    expect(released.holdCount).toBe(0);
    expect(released.pendingTimer).toBe('close');
  });

  it('holdCount 는 0 아래로 내려가지 않고, 그때 참조도 유지된다', () => {
    const next = reduceDockHover(opened, { type: 'holdEnd' });
    expect(next.holdCount).toBe(0);
    expect(next).toBe(opened);
  });
});

describe('reduceDockHover — escape', () => {
  it('펼쳐진 독을 즉시 접고 타이머를 지운다', () => {
    const opened = run(
      createDockHoverState(false),
      { type: 'enter' },
      { type: 'timerFired', timer: 'open' },
      { type: 'leave' },
    );
    const next = reduceDockHover(opened, { type: 'escape' });
    expect(next.expanded).toBe(false);
    expect(next.pendingTimer).toBeNull();
  });

  it('접힌 독에는 no-op 이고 참조가 유지된다', () => {
    const collapsed = createDockHoverState(false);
    expect(reduceDockHover(collapsed, { type: 'escape' })).toBe(collapsed);
  });

  it('고정 상태에서는 무시한다', () => {
    const pinned = createDockHoverState(true);
    expect(reduceDockHover(pinned, { type: 'escape' })).toBe(pinned);
  });
});

describe('reduceDockHover — toggle', () => {
  it('접힌 독을 지연 없이 즉시 펼치고 대기 중인 open 예약을 지운다', () => {
    const next = run(
      createDockHoverState(false),
      { type: 'enter' },
      { type: 'toggle' },
    );
    expect(next.expanded).toBe(true);
    expect(next.pendingTimer).toBeNull();
  });

  it('펼쳐진 독을 즉시 접고, 마우스가 안에 있어도 다시 열리지 않는다', () => {
    const opened = run(
      createDockHoverState(false),
      { type: 'enter' },
      { type: 'timerFired', timer: 'open' },
    );
    const next = reduceDockHover(opened, { type: 'toggle' });
    expect(next.expanded).toBe(false);
    expect(next.pendingTimer).toBeNull();
    // 접힌 뒤 leave 하면 예약 없이 접힌 채 남는다
    const left = reduceDockHover(next, { type: 'leave' });
    expect(left.expanded).toBe(false);
    expect(left.pendingTimer).toBeNull();
  });

  it('고정 상태에서는 무시한다', () => {
    const pinned = createDockHoverState(true);
    expect(reduceDockHover(pinned, { type: 'toggle' })).toBe(pinned);
  });
});

describe('reduceDockHover — pin', () => {
  it('pin 하면 즉시 펼쳐지고 대기 타이머가 지워진다', () => {
    const closing = run(
      createDockHoverState(false),
      { type: 'enter' },
      { type: 'timerFired', timer: 'open' },
      { type: 'leave' },
    );
    const next = reduceDockHover(closing, { type: 'setPinned', pinned: true });
    expect(next).toMatchObject({
      pinned: true,
      expanded: true,
      pendingTimer: null,
    });
  });

  it('고정 중에는 enter/leave 가 펼침을 바꾸지 못하고 타이머도 예약하지 않는다', () => {
    const pinned = createDockHoverState(true);
    const left = run(pinned, { type: 'enter' }, { type: 'leave' });
    expect(left.expanded).toBe(true);
    expect(left.pendingTimer).toBeNull();
    const closeFired = reduceDockHover(left, {
      type: 'timerFired',
      timer: 'close',
    });
    expect(closeFired.expanded).toBe(true);
  });

  it('unpin 시 마우스가 밖이면 close 를 예약한다', () => {
    const next = run(createDockHoverState(true), {
      type: 'setPinned',
      pinned: false,
    });
    expect(next.pinned).toBe(false);
    expect(next.expanded).toBe(true);
    expect(next.pendingTimer).toBe('close');
  });

  it('unpin 시 마우스가 안에 있으면(버튼 클릭) 펼친 채 두고 예약하지 않는다', () => {
    const next = run(
      createDockHoverState(true),
      { type: 'enter' },
      { type: 'setPinned', pinned: false },
    );
    expect(next.expanded).toBe(true);
    expect(next.pendingTimer).toBeNull();
    const left = reduceDockHover(next, { type: 'leave' });
    expect(left.pendingTimer).toBe('close');
  });

  it('같은 pin 값을 다시 넣으면 참조가 유지된다', () => {
    const pinned = createDockHoverState(true);
    expect(reduceDockHover(pinned, { type: 'setPinned', pinned: true })).toBe(
      pinned,
    );
    const unpinned = createDockHoverState(false);
    expect(
      reduceDockHover(unpinned, { type: 'setPinned', pinned: false }),
    ).toBe(unpinned);
  });
});
