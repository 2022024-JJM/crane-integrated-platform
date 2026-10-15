import { useRef, type FocusEvent } from 'react';

type TextField = HTMLInputElement | HTMLTextAreaElement;

/**
 * 조합을 거치는 키 입력이 주는 keyCode. 조합을 끝내는 키를 `isComposing`
 * 없이 이것으로만 알리는 브라우저가 있다.
 */
const IME_PROCESS_KEY_CODE = 229;

/** 초점이 빠질 때의 입력란 — 한글 조합이 끝난 뒤에 읽는다. */
export interface ImeSafeBlur {
  /** 입력란의 값. 조합 중이던 글자까지 든 최종값이다. */
  value: string;
  /** 초점이 옮겨 간 곳(`FocusEvent.relatedTarget`). */
  relatedTarget: EventTarget | null;
}

export interface ImeSafeBlurHandlers<E extends TextField> {
  onFocus: () => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  onBlur: (event: FocusEvent<E>) => void;
}

/**
 * 한글처럼 조합해 넣는 글자를 아직 조합 중인 키 입력인지. 조합을 끝내는
 * Enter 는 확정이 아니다 — 그 뒤에 진짜 Enter 가 한 번 더 온다.
 */
export function isImeComposing(event: {
  isComposing: boolean;
  keyCode: number;
}): boolean {
  return event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE;
}

/**
 * 초점이 빠질 때 확정하는 입력란의 blur 를 한글 조합이 끝난 뒤로 미룬다.
 * 반환한 핸들러를 입력란에 그대로 펼쳐 붙인다.
 *
 * 맥의 한글 입력기는 마지막 글자를 조합 중인 채로 들고 있다가 초점이 빠진
 * 뒤에 확정할 수 있다. 그 전에 blur 에서 입력란을 비우거나 값을 바꾸면 늦게
 * 온 확정이 같은 글자를 한 번 더 넣는다. blur 가 조합보다 먼저 오면 확정을
 * `compositionend` 까지 미루고, 조합이 이미 끝났으면 바로 부른다 — 두 이벤트의
 * 순서는 브라우저·OS 마다 달라 어느 쪽으로 와도 한 번만 부른다.
 *
 * 미룬 확정은 다시 초점을 받으면 버린다. 친 글자는 입력란에 남아 있어 다음
 * blur 가 확정한다 — `compositionend` 를 놓쳐도 조합 표시가 남아 이후의 blur 가
 * 영영 미뤄지는 일이 없다.
 */
export function useImeSafeBlur<E extends TextField>(
  onBlur: (blur: ImeSafeBlur) => void,
): ImeSafeBlurHandlers<E> {
  const composingRef = useRef(false);
  const pendingRef = useRef<(() => void) | null>(null);

  return {
    onFocus: () => {
      composingRef.current = false;
      pendingRef.current = null;
    },
    onCompositionStart: () => {
      composingRef.current = true;
    },
    onCompositionEnd: () => {
      composingRef.current = false;
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.();
    },
    onBlur: (event) => {
      const field = event.currentTarget;
      const relatedTarget = event.relatedTarget;
      const run = () => onBlur({ value: field.value, relatedTarget });
      if (composingRef.current) pendingRef.current = run;
      else run();
    },
  };
}
