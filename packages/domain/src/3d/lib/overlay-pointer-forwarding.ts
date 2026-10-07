/**
 * 캔버스 위 DOM 오버레이(모델 라벨·눈금 점/숫자)의 휠·포인터를 캔버스로
 * 넘기는 순수 DOM 함수 — 적용은 model/use-overlay-pointer-forwarding.ts.
 *
 * 오버레이가 pointer-events 를 받으면(클릭으로 선택·포커스) 그 위에서 난
 * 휠·드래그는 카메라 조작에 닿지 않는다. 휠 줌(features SceneSurfaceCamera)은
 * 캔버스 요소의 리스너이고, 회전(OrbitControls)·R3F 이벤트는 R3F 가 연결한
 * 요소(Canvas 의 래퍼 div, `events.connected`)의 리스너인데, 오버레이는
 * 캔버스의 자손이 아니고 라벨의 React 핸들러가 pointerdown 전파를 끊는다.
 *
 * 그래서 "캔버스에서 난 이벤트"로 다시 만든다 — 같은 좌표·버튼의 이벤트를
 * 캔버스에 bubbles:true 로 발행하고 원본의 전파는 끊는다. 캔버스 → 래퍼 →
 * 조상 순으로 실제 캔버스 입력과 같은 경로를 타고, 어느 리스너도 두 번 받지
 * 않는다. OrbitControls 는 pointerdown 만 자기 요소에서 받고 이후
 * pointermove·pointerup 은 document 에서 받으므로 pointerdown 하나만 넘기면
 * 드래그가 이어진다.
 */

/**
 * 눌린 자리에서 이보다(px) 넘게 움직인 뒤의 click 은 드래그의 끝으로 보고
 * 선택·포커스로 치지 않는다. 경계 정확값은 클릭이다.
 */
export const OVERLAY_CLICK_SLOP_PX = 4;

/**
 * 오버레이 위 휠을 캔버스에서 난 것처럼 다시 발행하고 원본의 전파를 끊는다.
 * 캔버스 쪽 리스너가 기본 동작(스크롤)을 막았으면 원본도 막는다. 막았는지를
 * 돌려준다.
 */
export function forwardWheelToCanvas(
  event: WheelEvent,
  canvas: HTMLElement,
): boolean {
  event.stopPropagation();
  const forwarded = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaZ: event.deltaZ,
    deltaMode: event.deltaMode,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  });
  const allowed = canvas.dispatchEvent(forwarded);
  if (!allowed) event.preventDefault();
  return !allowed;
}

/**
 * 오버레이 위 pointerdown 을 캔버스에서 난 것처럼 다시 발행하고 원본의 전파를
 * 끊는다. pointerId 를 그대로 쓰므로 이어지는 실제 pointermove·pointerup 이
 * 같은 포인터로 묶인다. 원본의 기본 동작은 막지 않는다 — 오버레이의 click 이
 * 그대로 나야 한다.
 */
export function forwardPointerDownToCanvas(
  event: PointerEvent,
  canvas: HTMLElement,
): void {
  event.stopPropagation();
  const forwarded = new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    button: event.button,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    width: event.width,
    height: event.height,
    pressure: event.pressure,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  });
  canvas.dispatchEvent(forwarded);
}

/**
 * 눌린 자리 (downX, downY) 에서 (x, y) 까지가 클릭 허용 범위를 넘었는가 —
 * 넘었으면 드래그다. 좌표가 유한하지 않으면 클릭으로 본다(사용자의 클릭을
 * 버리지 않는다).
 */
export function isOverlayDrag(
  downX: number,
  downY: number,
  x: number,
  y: number,
): boolean {
  const dx = x - downX;
  const dy = y - downY;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
  return dx * dx + dy * dy > OVERLAY_CLICK_SLOP_PX * OVERLAY_CLICK_SLOP_PX;
}
