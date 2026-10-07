// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forwardPointerDownToCanvas,
  forwardWheelToCanvas,
  isOverlayDrag,
  OVERLAY_CLICK_SLOP_PX,
} from '../overlay-pointer-forwarding';

/**
 * 실제 배치를 흉내 낸다 — 래퍼(R3F 이벤트 연결 요소) 안에 캔버스와 오버레이
 * 컨테이너(drei Html portal)가 형제로 있고, 라벨은 컨테이너 안에 있다.
 */
function mount() {
  const wrapper = document.createElement('div');
  const canvas = document.createElement('canvas');
  const overlay = document.createElement('div');
  const label = document.createElement('div');
  overlay.appendChild(label);
  wrapper.appendChild(canvas);
  wrapper.appendChild(overlay);
  document.body.appendChild(wrapper);
  return { wrapper, canvas, overlay, label };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('forwardWheelToCanvas', () => {
  it('같은 좌표·delta·modifier 의 wheel 을 캔버스에 발행한다', () => {
    const { canvas } = mount();
    const received: WheelEvent[] = [];
    canvas.addEventListener('wheel', (e) => received.push(e));
    const original = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 80,
      screenX: 1120,
      screenY: 580,
      deltaX: 3,
      deltaY: -100,
      deltaZ: 0,
      deltaMode: 1,
      ctrlKey: true,
      shiftKey: true,
    });

    forwardWheelToCanvas(original, canvas);

    expect(received).toHaveLength(1);
    const e = received[0];
    expect(e).not.toBe(original);
    expect(e.target).toBe(canvas);
    expect([e.clientX, e.clientY, e.screenX, e.screenY]).toEqual([
      120, 80, 1120, 580,
    ]);
    expect([e.deltaX, e.deltaY, e.deltaZ, e.deltaMode]).toEqual([
      3, -100, 0, 1,
    ]);
    expect([e.ctrlKey, e.shiftKey, e.altKey, e.metaKey]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('래퍼(캔버스 조상)는 캔버스에서 올라온 휠을 정확히 한 번 받는다 — 원본은 끊긴다', () => {
    const { wrapper, canvas, label } = mount();
    const seen: EventTarget[] = [];
    wrapper.addEventListener('wheel', (e) => seen.push(e.target!));
    label.addEventListener('wheel', (e) => forwardWheelToCanvas(e, canvas));

    label.dispatchEvent(
      new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -1 }),
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(canvas);
  });

  it('캔버스 리스너가 preventDefault 하면 원본도 막고 true 를 돌려준다', () => {
    const { canvas } = mount();
    canvas.addEventListener('wheel', (e) => e.preventDefault());
    const original = new WheelEvent('wheel', {
      cancelable: true,
      deltaY: -100,
    });
    expect(forwardWheelToCanvas(original, canvas)).toBe(true);
    expect(original.defaultPrevented).toBe(true);
  });

  it('캔버스 리스너가 막지 않으면 원본의 기본 동작을 남기고 false', () => {
    const { canvas } = mount();
    canvas.addEventListener('wheel', () => {});
    const original = new WheelEvent('wheel', {
      cancelable: true,
      deltaY: -100,
    });
    expect(forwardWheelToCanvas(original, canvas)).toBe(false);
    expect(original.defaultPrevented).toBe(false);
  });

  it('리스너가 없어도 던지지 않는다', () => {
    const { canvas } = mount();
    expect(() =>
      forwardWheelToCanvas(new WheelEvent('wheel', { deltaY: 1 }), canvas),
    ).not.toThrow();
  });
});

describe('forwardPointerDownToCanvas', () => {
  it('같은 pointerId·버튼·좌표의 pointerdown 을 캔버스에 발행한다', () => {
    const { canvas } = mount();
    const received: PointerEvent[] = [];
    canvas.addEventListener('pointerdown', (e) =>
      received.push(e as PointerEvent),
    );
    const original = new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 7,
      pointerType: 'mouse',
      isPrimary: true,
      button: 1,
      buttons: 4,
      clientX: 33,
      clientY: 44,
      shiftKey: true,
    });

    forwardPointerDownToCanvas(original, canvas);

    expect(received).toHaveLength(1);
    const e = received[0];
    expect(e).not.toBe(original);
    expect(e.type).toBe('pointerdown');
    expect(e.target).toBe(canvas);
    expect([e.pointerId, e.pointerType, e.isPrimary]).toEqual([
      7,
      'mouse',
      true,
    ]);
    expect([e.button, e.buttons]).toEqual([1, 4]);
    expect([e.clientX, e.clientY]).toEqual([33, 44]);
    expect(e.shiftKey).toBe(true);
  });

  it('래퍼(OrbitControls 의 요소)는 캔버스에서 올라온 pointerdown 을 정확히 한 번 받는다', () => {
    const { wrapper, canvas, label } = mount();
    const seen: EventTarget[] = [];
    wrapper.addEventListener('pointerdown', (e) => seen.push(e.target!));
    label.addEventListener('pointerdown', (e) =>
      forwardPointerDownToCanvas(e as PointerEvent, canvas),
    );

    label.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(canvas);
  });

  it('원본의 기본 동작은 막지 않는다 — 오버레이의 click 이 그대로 난다', () => {
    const { canvas } = mount();
    const original = new PointerEvent('pointerdown', {
      cancelable: true,
      pointerId: 1,
    });
    const stop = vi.spyOn(original, 'stopPropagation');
    forwardPointerDownToCanvas(original, canvas);
    expect(original.defaultPrevented).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('isOverlayDrag', () => {
  it('허용 범위 경계 정확값은 클릭, 1px 넘으면 드래그', () => {
    expect(isOverlayDrag(10, 10, 10 + OVERLAY_CLICK_SLOP_PX, 10)).toBe(false);
    expect(isOverlayDrag(10, 10, 10, 10 - OVERLAY_CLICK_SLOP_PX)).toBe(false);
    expect(isOverlayDrag(10, 10, 10 + OVERLAY_CLICK_SLOP_PX + 1, 10)).toBe(
      true,
    );
    expect(isOverlayDrag(10, 10, 10, 10 + OVERLAY_CLICK_SLOP_PX + 1)).toBe(
      true,
    );
  });

  it('대각선은 유클리드 거리로 잰다', () => {
    const d = OVERLAY_CLICK_SLOP_PX / Math.SQRT2;
    expect(isOverlayDrag(0, 0, d, d)).toBe(false);
    expect(isOverlayDrag(0, 0, d + 0.5, d + 0.5)).toBe(true);
  });

  it('제자리는 클릭', () => {
    expect(isOverlayDrag(5, 5, 5, 5)).toBe(false);
  });

  it('좌표가 유한하지 않으면 클릭으로 본다', () => {
    expect(isOverlayDrag(NaN, 0, 100, 0)).toBe(false);
    expect(isOverlayDrag(0, 0, Infinity, 0)).toBe(false);
  });
});
