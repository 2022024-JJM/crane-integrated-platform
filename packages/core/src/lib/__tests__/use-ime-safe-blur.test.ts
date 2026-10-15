// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FocusEvent } from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import {
  isImeComposing,
  useImeSafeBlur,
  type ImeSafeBlur,
} from '../use-ime-safe-blur';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});

function setup(value = '') {
  const input = document.createElement('input');
  input.value = value;
  const onBlur = vi.fn<(blur: ImeSafeBlur) => void>();
  const { result } = renderHook(() => useImeSafeBlur<HTMLInputElement>(onBlur));
  const blur = (relatedTarget: EventTarget | null = null) =>
    result.current.onBlur({
      currentTarget: input,
      relatedTarget,
    } as unknown as FocusEvent<HTMLInputElement>);
  return { input, onBlur, handlers: () => result.current, blur };
}

describe('isImeComposing', () => {
  it('조합 중인 키 입력이면 true', () => {
    expect(isImeComposing({ isComposing: true, keyCode: 13 })).toBe(true);
  });

  it('isComposing 없이 조합 키코드(229)만 와도 true', () => {
    expect(isImeComposing({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it('조합이 끝난 뒤의 Enter 는 false', () => {
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it('조합 키코드의 이웃 값은 조합이 아니다', () => {
    expect(isImeComposing({ isComposing: false, keyCode: 228 })).toBe(false);
    expect(isImeComposing({ isComposing: false, keyCode: 230 })).toBe(false);
  });
});

describe('useImeSafeBlur', () => {
  it('조합이 없으면 blur 때 입력란 값과 옮겨 간 곳으로 바로 부른다', () => {
    const { input, onBlur, blur } = setup('가나다');
    const next = document.createElement('button');
    blur(next);
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith({
      value: '가나다',
      relatedTarget: next,
    });
    expect(input.value).toBe('가나다');
  });

  it('조합이 blur 보다 먼저 끝나면 blur 때 한 번만 부른다', () => {
    const { onBlur, handlers, blur } = setup('가나다');
    handlers().onCompositionStart();
    handlers().onCompositionEnd();
    expect(onBlur).not.toHaveBeenCalled();
    blur();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledWith({
      value: '가나다',
      relatedTarget: null,
    });
  });

  it('blur 가 조합보다 먼저 오면 조합이 끝날 때까지 미룬다', () => {
    const { onBlur, handlers, blur } = setup('가나다');
    handlers().onCompositionStart();
    blur();
    expect(onBlur).not.toHaveBeenCalled();
    handlers().onCompositionEnd();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('미룬 확정은 조합이 끝난 때의 값과 blur 때 옮겨 간 곳을 쓴다', () => {
    const { input, onBlur, handlers, blur } = setup('가나');
    const next = document.createElement('textarea');
    handlers().onCompositionStart();
    blur(next);
    input.value = '가나다';
    handlers().onCompositionEnd();
    expect(onBlur).toHaveBeenCalledWith({
      value: '가나다',
      relatedTarget: next,
    });
  });

  it('미룬 확정은 한 번만 부른다 — 다음 조합 끝에서 다시 부르지 않는다', () => {
    const { onBlur, handlers, blur } = setup('가');
    handlers().onCompositionStart();
    blur();
    handlers().onCompositionEnd();
    handlers().onCompositionStart();
    handlers().onCompositionEnd();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('미룬 확정이 없을 때의 조합 끝은 아무것도 부르지 않는다', () => {
    const { onBlur, handlers } = setup('가');
    handlers().onCompositionEnd();
    handlers().onCompositionStart();
    handlers().onCompositionEnd();
    expect(onBlur).not.toHaveBeenCalled();
  });

  it('조합 끝 전에 다시 초점을 받으면 미룬 확정을 버리고, 다음 blur 가 확정한다', () => {
    const { onBlur, handlers, blur } = setup('가나다');
    handlers().onCompositionStart();
    blur();
    handlers().onFocus();
    handlers().onCompositionEnd();
    expect(onBlur).not.toHaveBeenCalled();
    blur();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('조합 끝을 놓쳐도 다시 초점을 받으면 그다음 blur 는 미루지 않는다', () => {
    const { onBlur, handlers, blur } = setup('가');
    handlers().onCompositionStart();
    handlers().onFocus();
    blur();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('조합 끝을 놓친 채 다시 초점을 받지 않으면 blur 는 계속 미뤄진다', () => {
    // 같은 입력란에서 초점을 받지 않고 다시 잃을 수는 없다 — 이 경로는 실제로
    // 오지 않지만, 버리지 않고 쌓아 두지도 않는다는 것을 고정한다.
    const { onBlur, handlers, blur } = setup('가');
    handlers().onCompositionStart();
    blur();
    blur();
    expect(onBlur).not.toHaveBeenCalled();
    handlers().onCompositionEnd();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('빈 입력란도 그대로 넘긴다 — 빈 값을 어떻게 할지는 호출측 몫이다', () => {
    const { onBlur, blur } = setup('');
    blur();
    expect(onBlur).toHaveBeenCalledWith({ value: '', relatedTarget: null });
  });
});
