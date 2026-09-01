// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { useSceneHistory } from '../use-scene-history';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** environmentId만 다른 씬 — isSceneInfoEqual이 구분하는 최소 차이 */
function scene(environmentId: string): SavedSceneInfo {
  return { maps: [], models: [], texts: [], camera: null, environmentId };
}

function setup() {
  return renderHook(() => useSceneHistory());
}

afterEach(() => {
  cleanup();
});

describe('초기 상태 / replaceScene', () => {
  it('초기에는 씬도 히스토리도 없다', () => {
    const { result } = setup();
    expect(result.current.sceneInfo).toBeNull();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('replaceScene은 present를 바꾸고 스택을 비운다', () => {
    const { result } = setup();
    act(() => result.current.replaceScene(scene('a')));
    act(() => result.current.updateScene(scene('b')));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.replaceScene(scene('fresh')));
    expect(result.current.sceneInfo?.environmentId).toBe('fresh');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});

describe('updateScene', () => {
  it('변경을 기록하고 undo/redo로 왕복한다', () => {
    const { result } = setup();
    act(() => result.current.replaceScene(scene('a')));
    act(() => result.current.updateScene(scene('b')));
    act(() => result.current.updateScene((prev) => ({ ...prev!, environmentId: 'c' })));

    expect(result.current.sceneInfo?.environmentId).toBe('c');

    act(() => result.current.undo());
    expect(result.current.sceneInfo?.environmentId).toBe('b');
    act(() => result.current.undo());
    expect(result.current.sceneInfo?.environmentId).toBe('a');
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    act(() => result.current.redo());
    expect(result.current.sceneInfo?.environmentId).toBe('c');
    expect(result.current.canRedo).toBe(false);
  });

  it('내용이 같으면 참조를 유지하고 히스토리에 쌓지 않는다', () => {
    const { result } = setup();
    const initial = scene('a');
    act(() => result.current.replaceScene(initial));
    act(() => result.current.updateScene(scene('a'))); // 같은 내용의 새 객체

    expect(result.current.sceneInfo).toBe(initial);
    expect(result.current.canUndo).toBe(false);
  });

  it('recordHistory: false는 present만 바꾼다 (드래그 중간 상태)', () => {
    const { result } = setup();
    act(() => result.current.replaceScene(scene('a')));
    act(() => result.current.updateScene(scene('b'), { recordHistory: false }));

    expect(result.current.sceneInfo?.environmentId).toBe('b');
    expect(result.current.canUndo).toBe(false);
  });

  it('present가 null이면 히스토리 없이 채운다', () => {
    const { result } = setup();
    act(() => result.current.updateScene(scene('a')));
    expect(result.current.sceneInfo?.environmentId).toBe('a');
    expect(result.current.canUndo).toBe(false);
  });

  it('updater가 null을 돌려주면(씬 제거) 히스토리에 남고 undo로 복원된다', () => {
    const { result } = setup();
    act(() => result.current.replaceScene(scene('a')));
    act(() => result.current.updateScene(() => null));

    expect(result.current.sceneInfo).toBeNull();
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    // present가 null이면 undo는 no-op이다 — null 전이는 되돌릴 수 없다
    // (undo 구현이 !prev.present에서 조기 반환). 현재 동작의 특성화.
    expect(result.current.sceneInfo).toBeNull();
  });

  it('undo 후 새 변경은 redo 스택을 무효화한다 (분기)', () => {
    const { result } = setup();
    act(() => result.current.replaceScene(scene('a')));
    act(() => result.current.updateScene(scene('b')));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.updateScene(scene('branch')));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    expect(result.current.sceneInfo?.environmentId).toBe('a');
  });

  it('undo 깊이는 50으로 제한된다', () => {
    const { result } = setup();
    act(() => result.current.replaceScene(scene('base')));
    for (let i = 0; i < 55; i++) {
      act(() => result.current.updateScene(scene(`v${i}`)));
    }

    let undoCount = 0;
    while (result.current.canUndo && undoCount < 100) {
      act(() => result.current.undo());
      undoCount += 1;
    }
    expect(undoCount).toBe(50);
    // 가장 오래된 5개(base, v0..v3)는 잘려 나갔다.
    expect(result.current.sceneInfo?.environmentId).toBe('v4');
  });
});

describe('undo / redo 경계', () => {
  it('빈 스택에서의 undo/redo는 no-op', () => {
    const { result } = setup();
    act(() => result.current.replaceScene(scene('a')));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.sceneInfo?.environmentId).toBe('a');
  });
});

describe('commitHistoryFrom', () => {
  it('base를 past에 쌓아 드래그 1회를 undo 1회로 만든다', () => {
    const { result } = setup();
    const base = scene('base');
    act(() => result.current.replaceScene(base));
    // 드래그 중간 프레임들 — 히스토리 미기록
    act(() => result.current.updateScene(scene('mid'), { recordHistory: false }));
    act(() => result.current.updateScene(scene('final'), { recordHistory: false }));
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.commitHistoryFrom(base));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.sceneInfo?.environmentId).toBe('base');
    act(() => result.current.redo());
    expect(result.current.sceneInfo?.environmentId).toBe('final');
  });

  it('base가 present와 같거나 null이면 no-op', () => {
    const { result } = setup();
    const base = scene('a');
    act(() => result.current.replaceScene(base));
    act(() => result.current.commitHistoryFrom(base));
    act(() => result.current.commitHistoryFrom(null));
    expect(result.current.canUndo).toBe(false);
  });
});
