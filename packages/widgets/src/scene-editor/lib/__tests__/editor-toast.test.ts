// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  SCENE_EDITOR_TOASTER_ID,
  editorToastOptions,
  resolveEditorToasterId,
} from '../editor-toast';

function setFullscreenElement(value: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  setFullscreenElement(null);
});

describe('resolveEditorToasterId', () => {
  it('전체화면 요소가 없으면 undefined — 전역 Toaster 로 간다', () => {
    expect(resolveEditorToasterId(null)).toBeUndefined();
  });

  it('전체화면 요소가 있으면 편집기 Toaster id', () => {
    expect(resolveEditorToasterId(document.createElement('div'))).toBe(
      SCENE_EDITOR_TOASTER_ID,
    );
  });
});

describe('editorToastOptions', () => {
  it('비전체화면에서는 빈 객체 — 스프레드해도 toasterId 키가 생기지 않는다', () => {
    setFullscreenElement(null);
    const options = editorToastOptions();
    expect(options).toEqual({});
    expect('toasterId' in options).toBe(false);
  });

  it('전체화면 중에는 toasterId 가 붙는다', () => {
    setFullscreenElement(document.createElement('div'));
    expect(editorToastOptions()).toEqual({
      toasterId: SCENE_EDITOR_TOASTER_ID,
    });
  });

  it('기존 옵션과 합쳐도 서로를 덮지 않는다', () => {
    setFullscreenElement(document.createElement('div'));
    expect({ ...editorToastOptions(), description: 'hint' }).toEqual({
      toasterId: SCENE_EDITOR_TOASTER_ID,
      description: 'hint',
    });
  });
});
