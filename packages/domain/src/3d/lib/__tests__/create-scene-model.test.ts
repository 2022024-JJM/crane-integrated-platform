import { describe, expect, it } from 'vitest';
import { createSceneModel } from '../create-scene-model';

describe('createSceneModel', () => {
  const model = {
    id: 'okpo-ttc',
    version: 3,
    label: 'Okpo TTC',
    path: '/asset-library/files/okpo-ttc/v3/okpo_ttc.glb',
  };

  it('자산의 경로와 참조(id·버전)를 씬 모델에 적는다', () => {
    const created = createSceneModel({ model, position: [1, 2, 3] });
    expect(created).toMatchObject({
      equipName: 'Okpo TTC',
      path: model.path,
      asset: { id: 'okpo-ttc', version: 3 },
      position: [1, 2, 3],
    });
  });

  it('등배·무회전·불투명으로 시작한다', () => {
    const created = createSceneModel({ model, position: [0, 0, 0] });
    expect(created.scale).toEqual([1, 1, 1]);
    expect(created.rotation).toEqual([0, 0, 0]);
    expect(created.opacity).toBe(1);
  });

  it('놓을 때마다 새 id 를 만든다', () => {
    const a = createSceneModel({ model, position: [0, 0, 0] });
    const b = createSceneModel({ model, position: [0, 0, 0] });
    expect(a.id).not.toBe(b.id);
    expect(a.id.length).toBeGreaterThan(0);
  });
});
