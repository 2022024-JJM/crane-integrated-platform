import { beforeEach, describe, expect, it } from 'vitest';
import { useNodePreviewStore } from '../use-node-preview-store';

describe('useNodePreviewStore', () => {
  beforeEach(() => {
    useNodePreviewStore.setState({ preview: null });
  });

  it('시작하면 대상이 잡히고 다른 행으로 바꾸면 교체된다', () => {
    useNodePreviewStore.getState().startPreview('m1', '[0]A');
    expect(useNodePreviewStore.getState().preview).toEqual({
      modelId: 'm1',
      nodePath: '[0]A',
    });
    useNodePreviewStore.getState().startPreview('m1', '[0]A/[1]B');
    expect(useNodePreviewStore.getState().preview).toEqual({
      modelId: 'm1',
      nodePath: '[0]A/[1]B',
    });
  });

  it('모델 루트(빈 경로)도 대상이다', () => {
    useNodePreviewStore.getState().startPreview('m1', '');
    expect(useNodePreviewStore.getState().preview).toEqual({
      modelId: 'm1',
      nodePath: '',
    });
  });

  it('같은 대상 재시작은 상태 참조를 유지한다', () => {
    useNodePreviewStore.getState().startPreview('m1', '[0]A');
    const before = useNodePreviewStore.getState();
    useNodePreviewStore.getState().startPreview('m1', '[0]A');
    expect(useNodePreviewStore.getState()).toBe(before);
    expect(useNodePreviewStore.getState().preview).toBe(before.preview);
  });

  it('종료하면 빈다', () => {
    useNodePreviewStore.getState().startPreview('m1', '[0]A');
    useNodePreviewStore.getState().endPreview();
    expect(useNodePreviewStore.getState().preview).toBeNull();
  });

  it('빈 상태에서 종료는 no-op — 참조 유지', () => {
    const before = useNodePreviewStore.getState();
    useNodePreviewStore.getState().endPreview();
    expect(useNodePreviewStore.getState()).toBe(before);
  });
});
