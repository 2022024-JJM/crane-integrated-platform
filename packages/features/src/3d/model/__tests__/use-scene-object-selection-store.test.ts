import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneObjectSelectionStore } from '../use-scene-object-selection-store';

const store = useSceneObjectSelectionStore;

beforeEach(() => {
  store.getState().clearSelectedModel();
});

describe('useSceneObjectSelectionStore — 노드(mesh) 선택', () => {
  it('selectMesh 는 mesh 타입 단일 선택을 만들고 파생 필드가 모두 그 id 를 가리킨다', () => {
    store.getState().selectMesh('m1::[0]Arm');
    const s = store.getState();
    expect(s.selectedObjectType).toBe('mesh');
    expect(s.selectedIds.size).toBe(1);
    expect(s.selectedIds.has('m1::[0]Arm')).toBe(true);
    expect(s.primarySelectedId).toBe('m1::[0]Arm');
    expect(s.selectedModelId).toBe('m1::[0]Arm');
  });

  it('모델 멀티 선택 중 selectMesh 하면 기존 선택이 대체돼 단일 선택이 된다', () => {
    store.getState().selectModel('m1');
    store.getState().toggleModel('m2');
    expect(store.getState().selectedIds.size).toBe(2);

    store.getState().selectMesh('m1::[0]Arm');
    const s = store.getState();
    expect(s.selectedIds.size).toBe(1);
    expect(s.selectedIds.has('m2')).toBe(false);
    expect(s.selectedObjectType).toBe('mesh');
  });

  it('노드 선택 상태에서 모델을 Ctrl 토글하면 노드는 선택에 남지만 타입은 model 이 된다(특성화)', () => {
    // 토글 액션은 타입을 자기 것으로 덮어쓴다. 노드 id 가 섞인 멀티 선택은
    // 편집 경로가 id 로 컬렉션을 찾다 실패해 조용히 무시된다 — 현재 동작 고정.
    store.getState().selectMesh('m1::[0]Arm');
    store.getState().toggleModel('m2');
    const s = store.getState();
    expect(s.selectedIds.size).toBe(2);
    expect(s.selectedObjectType).toBe('model');
    expect(s.primarySelectedId).toBe('m2');
  });

  it('노드에는 토글 액션이 없다 — 항상 단일 선택만 가능', () => {
    expect(
      (store.getState() as unknown as Record<string, unknown>).toggleMesh,
    ).toBeUndefined();
  });

  it('clearSelectedModel 뒤에는 파생 4필드가 전부 초기값', () => {
    store.getState().selectMesh('m1::[0]Arm');
    store.getState().clearSelectedModel();
    const s = store.getState();
    expect(s.selectedIds.size).toBe(0);
    expect(s.selectedModelId).toBeNull();
    expect(s.primarySelectedId).toBeNull();
    expect(s.selectedObjectType).toBeNull();
  });

  it('같은 노드를 다시 선택하면 selectedIds 참조가 새로 만들어진다(특성화 — no-op 최적화 없음)', () => {
    store.getState().selectMesh('m1::[0]Arm');
    const before = store.getState().selectedIds;
    store.getState().selectMesh('m1::[0]Arm');
    expect(store.getState().selectedIds).not.toBe(before);
    expect(store.getState().selectedIds.has('m1::[0]Arm')).toBe(true);
  });

  it('빈 문자열 id 도 그대로 선택된다(특성화 — 검증은 상위 훅이 한다)', () => {
    store.getState().selectMesh('');
    expect(store.getState().selectedObjectType).toBe('mesh');
    expect(store.getState().primarySelectedId).toBe('');
  });
});
