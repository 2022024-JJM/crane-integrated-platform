/**
 * 편집기 토스트의 라우팅.
 *
 * sonner 의 Toaster 는 포털이 아니라 마운트한 자리에 인라인 렌더된다
 * (`position: fixed` 로 띄울 뿐). 앱 전역 Toaster 는 app-layout 에 있어
 * 편집 페이지 루트 밖이고, 루트를 Fullscreen API 로 올리면 top layer 밖의
 * DOM 은 z-index 와 무관하게 가려져 토스트가 보이지 않는다. base-ui 포털용
 * `PortalContainerProvider` 도 sonner 에는 닿지 않는다.
 *
 * 그래서 편집 페이지 루트 안에 `<AppToaster id={SCENE_EDITOR_TOASTER_ID}>`
 * 를 하나 더 두고, **전체화면 중에 띄우는 토스트에만** `toasterId` 를 붙여
 * 그쪽으로 보낸다. 항상 루트 안 Toaster 로 보내지 않는 이유: "저장 후
 * 나가기" 흐름에서는 토스트 직후 페이지가 언마운트돼 같이 사라진다 — 전역
 * Toaster 는 라우트가 바뀌어도 남는다.
 *
 * 편집 페이지가 떠 있는 동안 전체화면 요소가 있다면 그것은 편집 루트뿐이라
 * `fullscreenElement !== null` 만 본다.
 */
export const SCENE_EDITOR_TOASTER_ID = 'scene-editor';

export function resolveEditorToasterId(
  fullscreenElement: Element | null,
): string | undefined {
  return fullscreenElement ? SCENE_EDITOR_TOASTER_ID : undefined;
}

/** `toast.*(msg, { ...editorToastOptions(), … })` 로 스프레드한다. */
export function editorToastOptions(): { toasterId?: string } {
  const toasterId = resolveEditorToasterId(
    typeof document === 'undefined' ? null : document.fullscreenElement,
  );
  return toasterId ? { toasterId } : {};
}
