// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState, type SetStateAction } from 'react';
import type {
  SavedModelInfo,
  SavedRulerInfo,
  SavedSceneInfo,
  SavedTextInfo,
} from '@crane/domain/3d';
import { useSceneObjectSelectionStore } from '../use-scene-object-selection-store';
import { useSelectedSceneObjectEditor } from '../use-selected-scene-object-editor';

/**
 * 거리 눈금이 편집 훅의 공통 경로(선택 유지·이름·잠금·트랜스폼·삭제)에
 * 끼어든 부분의 테스트. 모델·텍스트·지도 경로는 같은 코드를 지나므로 눈금이
 * 그 동작을 바꾸지 않았는지도 함께 본다.
 */

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const selection = useSceneObjectSelectionStore;

function ruler(overrides: Partial<SavedRulerInfo> = {}): SavedRulerInfo {
  return {
    id: 'r1',
    name: '눈금 1',
    position: [10, 5, -20],
    rotation: [0, 90, 0],
    length: 750,
    interval: 100,
    textColor: '#ffffff',
    dotColor: '#ffffff',
    ...overrides,
  };
}

function model(overrides: Partial<SavedModelInfo> = {}): SavedModelInfo {
  return {
    id: 'm1',
    equipName: 'Crane',
    path: '/models/crane.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...overrides,
  };
}

function text(overrides: Partial<SavedTextInfo> = {}): SavedTextInfo {
  return {
    id: 't1',
    content: 'Text',
    color: '#ffffff',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...overrides,
  };
}

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return { maps: [], models: [], texts: [], camera: null, ...overrides };
}

/** 씬 상태를 들고 있는 최소 하니스 — updateSceneInfo 는 setState 그대로다. */
function renderEditor(initial: SavedSceneInfo | null) {
  return renderHook(() => {
    const [sceneInfo, setSceneInfo] = useState<SavedSceneInfo | null>(initial);
    const editor = useSelectedSceneObjectEditor({
      sceneInfo,
      updateSceneInfo: (updater: SetStateAction<SavedSceneInfo | null>) =>
        setSceneInfo(updater),
    });
    return { sceneInfo, editor };
  });
}

beforeEach(() => {
  selection.getState().clearSelectedModel();
});

afterEach(() => {
  cleanup();
  selection.getState().clearSelectedModel();
});

describe('눈금 선택', () => {
  it('선택한 눈금을 selectedRuler 로 돌려주고 다른 종류는 null 이다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('r1'));
    expect(result.current.editor.selectedRuler?.id).toBe('r1');
    expect(result.current.editor.selectedModel).toBeNull();
    expect(result.current.editor.selectedText).toBeNull();
    expect(result.current.editor.selectedMap).toBeNull();
  });

  it('종류가 ruler 가 아니면 같은 id 여도 selectedRuler 는 null', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectModel('r1'));
    expect(result.current.editor.selectedRuler).toBeNull();
  });

  it('씬에 있는 눈금의 선택은 유지된다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('r1'));
    expect(selection.getState().selectedModelId).toBe('r1');
    expect(result.current.editor.selectedRuler).not.toBeNull();
  });

  it('씬에 없는 눈금을 선택하면 선택이 풀린다', () => {
    renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('missing'));
    expect(selection.getState().selectedIds.size).toBe(0);
  });

  it('rulers 필드가 없는 씬에서도 던지지 않고 선택을 푼다', () => {
    const { result } = renderEditor(scene());
    act(() => selection.getState().selectRuler('r1'));
    expect(selection.getState().selectedIds.size).toBe(0);
    expect(result.current.editor.selectedRuler).toBeNull();
  });

  it('잠긴 눈금이 선택에 남아 있으면 선택을 푼다', () => {
    renderEditor(scene({ rulers: [ruler({ locked: true })] }));
    act(() => selection.getState().selectRuler('r1'));
    expect(selection.getState().selectedIds.size).toBe(0);
  });
});

describe('updateSelectedRuler', () => {
  it('선택 눈금만 고치고 다른 눈금은 참조를 유지한다', () => {
    const other = ruler({ id: 'r2' });
    const { result } = renderEditor(scene({ rulers: [ruler(), other] }));
    act(() => selection.getState().selectRuler('r1'));
    act(() =>
      result.current.editor.updateSelectedRuler((r) => ({
        ...r,
        interval: 50,
      })),
    );
    expect(result.current.sceneInfo?.rulers?.[0].interval).toBe(50);
    expect(result.current.sceneInfo?.rulers?.[1]).toBe(other);
  });

  it('updater 가 같은 참조를 돌려주면 씬 참조도 그대로다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('r1'));
    const before = result.current.sceneInfo;
    act(() => result.current.editor.updateSelectedRuler((r) => r));
    expect(result.current.sceneInfo).toBe(before);
  });

  it('선택이 없거나 눈금이 아니면 no-op (참조 유지, updater 호출 없음)', () => {
    const { result } = renderEditor(
      scene({ models: [model()], rulers: [ruler()] }),
    );
    const before = result.current.sceneInfo;
    let called = 0;
    const updater = (r: SavedRulerInfo) => {
      called += 1;
      return { ...r, length: 1 };
    };
    act(() => result.current.editor.updateSelectedRuler(updater));
    act(() => selection.getState().selectModel('m1'));
    act(() => result.current.editor.updateSelectedRuler(updater));
    expect(result.current.sceneInfo).toBe(before);
    expect(called).toBe(0);
  });

  it('씬이 없으면(로드 전) no-op', () => {
    const { result } = renderEditor(null);
    act(() =>
      result.current.editor.updateSelectedRuler((r) => ({ ...r, length: 1 })),
    );
    expect(result.current.sceneInfo).toBeNull();
  });
});

describe('공통 경로 — 이름·잠금', () => {
  it('renameObject 는 눈금의 name 을 바꾼다', () => {
    const { result } = renderEditor(
      scene({ models: [model()], rulers: [ruler()] }),
    );
    act(() => result.current.editor.renameObject('r1', '  1Dock 레일  '));
    expect(result.current.sceneInfo?.rulers?.[0].name).toBe('1Dock 레일');
    expect(result.current.sceneInfo?.models[0].equipName).toBe('Crane');
  });

  it('빈 이름은 무시한다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    const before = result.current.sceneInfo;
    act(() => result.current.editor.renameObject('r1', '   '));
    expect(result.current.sceneInfo).toBe(before);
  });

  it('잠그면 locked: true, 풀면 필드를 지운다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => result.current.editor.setObjectLocked('r1', true));
    expect(result.current.sceneInfo?.rulers?.[0].locked).toBe(true);
    act(() => result.current.editor.setObjectLocked('r1', false));
    expect(result.current.sceneInfo?.rulers?.[0]).not.toHaveProperty('locked');
  });

  it('선택 중인 눈금을 잠그면 선택이 풀린다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('r1'));
    act(() => result.current.editor.setObjectLocked('r1', true));
    expect(selection.getState().selectedIds.size).toBe(0);
  });

  it('눈금 잠금이 같은 씬의 모델·텍스트를 건드리지 않는다', () => {
    const m = model();
    const t = text();
    const { result } = renderEditor(
      scene({ models: [m], texts: [t], rulers: [ruler()] }),
    );
    act(() => result.current.editor.setObjectLocked('r1', true));
    expect(result.current.sceneInfo?.models[0]).toBe(m);
    expect(result.current.sceneInfo?.texts?.[0]).toBe(t);
  });
});

describe('공통 경로 — 트랜스폼', () => {
  it('인스펙터 축 입력은 눈금의 위치·회전을 바꾼다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('r1'));
    act(() =>
      result.current.editor.updateSelectedTransform('position', 'x', 42),
    );
    act(() =>
      result.current.editor.updateSelectedTransform('rotation', 'y', 450),
    );
    expect(result.current.sceneInfo?.rulers?.[0].position).toEqual([
      42, 5, -20,
    ]);
    // 회전은 [0,360) 으로 정규화된다.
    expect(result.current.sceneInfo?.rulers?.[0].rotation).toEqual([0, 90, 0]);
  });

  it('기즈모 커밋은 넘어온 필드만 고친다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('r1'));
    act(() =>
      result.current.editor.commitSelectedTransform([1, 2, 3], null, null),
    );
    const next = result.current.sceneInfo?.rulers?.[0];
    expect(next?.position).toEqual([1, 2, 3]);
    expect(next?.rotation).toEqual([0, 90, 0]);
    expect(next?.length).toBe(750);
  });

  it('눈금에는 크기가 없다 — scale 이 넘어와도 저장본에 남지 않는다', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    act(() => selection.getState().selectRuler('r1'));
    act(() =>
      result.current.editor.commitSelectedTransform(null, null, [2, 2, 2]),
    );
    act(() => result.current.editor.updateSelectedTransform('scale', 'x', 3));
    act(() =>
      result.current.editor.updateSelectedTransformVector('scale', [4, 4, 4]),
    );
    expect(result.current.sceneInfo?.rulers?.[0]).not.toHaveProperty('scale');
    expect(result.current.sceneInfo?.rulers?.[0].length).toBe(750);
  });

  it('다중 변형은 눈금의 위치·회전만 받고 scale 은 버린다', () => {
    const { result } = renderEditor(
      scene({ models: [model()], rulers: [ruler()] }),
    );
    act(() =>
      result.current.editor.updateMultiObjectTransforms([
        { id: 'r1', position: [7, 8, 9], scale: [2, 2, 2] },
        { id: 'm1', scale: [2, 2, 2] },
      ]),
    );
    const next = result.current.sceneInfo;
    expect(next?.rulers?.[0].position).toEqual([7, 8, 9]);
    expect(next?.rulers?.[0]).not.toHaveProperty('scale');
    // 모델은 종전대로 scale 을 받는다.
    expect(next?.models[0].scale).toEqual([2, 2, 2]);
  });

  it('다중 변형은 눈금 필드가 없던 씬에 rulers 를 만들지 않는다', () => {
    const { result } = renderEditor(scene({ models: [model()] }));
    act(() =>
      result.current.editor.updateMultiObjectTransforms([
        { id: 'm1', position: [1, 1, 1] },
      ]),
    );
    expect(result.current.sceneInfo).not.toHaveProperty('rulers');
  });

  it('빈 다중 변형은 no-op (참조 유지)', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    const before = result.current.sceneInfo;
    act(() => result.current.editor.updateMultiObjectTransforms([]));
    expect(result.current.sceneInfo).toBe(before);
  });
});

describe('공통 경로 — 삭제', () => {
  it('선택한 눈금을 지우고 선택을 푼다', () => {
    const keep = ruler({ id: 'r2' });
    const { result } = renderEditor(scene({ rulers: [ruler(), keep] }));
    act(() => selection.getState().selectRuler('r1'));
    act(() => result.current.editor.removeSelectedModel());
    expect(result.current.sceneInfo?.rulers).toEqual([keep]);
    expect(selection.getState().selectedIds.size).toBe(0);
  });

  it('모델·텍스트·눈금이 섞인 선택을 한 번에 지운다', () => {
    const { result } = renderEditor(
      scene({
        models: [model(), model({ id: 'm2' })],
        texts: [text()],
        rulers: [ruler()],
      }),
    );
    act(() =>
      selection.getState().selectAll([
        { id: 'm1', type: 'model' },
        { id: 't1', type: 'text' },
        { id: 'r1', type: 'ruler' },
      ]),
    );
    act(() => result.current.editor.removeSelectedModel());
    const next = result.current.sceneInfo;
    expect(next?.models.map((m) => m.id)).toEqual(['m2']);
    expect(next?.texts).toEqual([]);
    expect(next?.rulers).toEqual([]);
  });

  it('눈금 필드가 없던 씬에서 모델을 지워도 rulers 가 생기지 않는다', () => {
    const { result } = renderEditor(scene({ models: [model()] }));
    act(() => selection.getState().selectModel('m1'));
    act(() => result.current.editor.removeSelectedModel());
    expect(result.current.sceneInfo).not.toHaveProperty('rulers');
  });

  it('선택이 없으면 no-op (참조 유지)', () => {
    const { result } = renderEditor(scene({ rulers: [ruler()] }));
    const before = result.current.sceneInfo;
    act(() => result.current.editor.removeSelectedModel());
    expect(result.current.sceneInfo).toBe(before);
  });
});
