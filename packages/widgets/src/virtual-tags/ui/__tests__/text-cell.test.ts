// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TextCell } from '../text-cell';

/**
 * JSX 대신 `createElement` 를 쓰는 이유: 이 패키지의 vitest include 가
 * `src/**\/*.test.ts` 라 테스트 파일은 .ts 다(설정 주석 — 순수 로직 테스트가
 * DOM 없이 도는 것이 기본). 컴포넌트 하나를 붙이자고 그 규약을 바꾸지 않는다.
 */

afterEach(cleanup);

/** 스토어처럼 값을 다듬어 되돌려주는 부모. 가상 태그 sanitize 가 trim 한다. */
function TrimmingHost({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return createElement(TextCell, {
    value,
    onChange: (next: string) => setValue(next.trim()),
  });
}

function input(): HTMLInputElement {
  return screen.getByRole('textbox') as HTMLInputElement;
}

describe('TextCell — 끝 공백', () => {
  it('문자 끝에서 스페이스를 쳐도 화면에 남는다', () => {
    // 이 결함의 재현: 부모가 trim 해서 같은 값을 되돌려주면, 제어 입력이
    // 방금 친 공백을 지워 스페이스가 안 먹는 것처럼 보였다.
    render(createElement(TrimmingHost, { initial: 'Ship' }));
    fireEvent.change(input(), { target: { value: 'Ship ' } });
    expect(input().value).toBe('Ship ');
  });

  it('공백 뒤에 이어 쓰면 그대로 이어진다', () => {
    render(createElement(TrimmingHost, { initial: 'Ship' }));
    fireEvent.change(input(), { target: { value: 'Ship ' } });
    fireEvent.change(input(), { target: { value: 'Ship 2' } });
    expect(input().value).toBe('Ship 2');
  });

  it('포커스를 떠나면 저장된(다듬어진) 값으로 돌아간다', () => {
    render(createElement(TrimmingHost, { initial: 'Ship' }));
    fireEvent.change(input(), { target: { value: 'Ship  ' } });
    expect(input().value).toBe('Ship  ');
    fireEvent.blur(input());
    expect(input().value).toBe('Ship');
  });

  it('앞 공백도 편집 중에는 남는다', () => {
    render(createElement(TrimmingHost, { initial: '' }));
    fireEvent.change(input(), { target: { value: ' ' } });
    expect(input().value).toBe(' ');
    fireEvent.blur(input());
    expect(input().value).toBe('');
  });
});

describe('TextCell — 값 전달', () => {
  it('친 값을 다듬지 않고 그대로 올린다 — 다듬는 것은 저장 쪽 몫이다', () => {
    const onChange = vi.fn();
    render(createElement(TextCell, { value: 'Ship', onChange }));
    fireEvent.change(input(), { target: { value: 'Ship ' } });
    expect(onChange).toHaveBeenCalledWith('Ship ');
  });

  it('매 글자마다 올린다 — 미저장 표시가 살아 있어야 한다', () => {
    const onChange = vi.fn();
    render(createElement(TextCell, { value: '', onChange }));
    fireEvent.change(input(), { target: { value: 'a' } });
    fireEvent.change(input(), { target: { value: 'ab' } });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('부모가 값을 거부해도 blur 하면 저장된 값이 드러난다', () => {
    // 길이 상한 초과처럼 스토어가 되돌려주지 않는 경우 — 화면과 데이터가
    // 어긋난 채로 남으면 안 된다.
    render(
      createElement(TextCell, { value: 'kept', onChange: () => undefined }),
    );
    fireEvent.change(input(), { target: { value: 'rejected' } });
    expect(input().value).toBe('rejected');
    fireEvent.blur(input());
    expect(input().value).toBe('kept');
  });

  it('바깥에서 값이 바뀌면 편집 중이 아닐 때 따라간다', () => {
    const { rerender } = render(
      createElement(TextCell, { value: 'a', onChange: () => undefined }),
    );
    rerender(
      createElement(TextCell, { value: 'b', onChange: () => undefined }),
    );
    expect(input().value).toBe('b');
  });
});
