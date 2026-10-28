import { describe, expect, it } from 'vitest';
import type { RigDefinition } from '@crane/domain/3d';
import { listRigChoices } from '../rig-choices';

function rig(id: string, assetId: string): RigDefinition {
  return { id, name: id, assetId, joints: [], constraints: [] };
}

const rigs = [
  rig('oc-a', 'okpo-oc'),
  rig('tc', 'okpo-tc'),
  rig('oc-b', 'okpo-oc'),
];

describe('listRigChoices', () => {
  it('같은 자산의 리그를 씬 순서대로, 다른 자산은 뺀다', () => {
    const out = listRigChoices(rigs, { asset: { id: 'okpo-oc', version: 3 } });
    expect(out.map((r) => r.id)).toEqual(['oc-a', 'oc-b']);
  });

  it('붙어 있는 리그가 후보면 중복 없이 그 자리 그대로', () => {
    const out = listRigChoices(rigs, {
      rigId: 'oc-b',
      asset: { id: 'okpo-oc', version: 1 },
    });
    expect(out.map((r) => r.id)).toEqual(['oc-a', 'oc-b']);
  });

  it('붙어 있는 리그가 다른 자산이면 맨 앞에 더한다', () => {
    const out = listRigChoices(rigs, {
      rigId: 'tc',
      asset: { id: 'okpo-oc', version: 1 },
    });
    expect(out.map((r) => r.id)).toEqual(['tc', 'oc-a', 'oc-b']);
  });

  it('자산 참조가 없는 모델은 붙어 있는 리그만', () => {
    expect(listRigChoices(rigs, {})).toEqual([]);
    expect(listRigChoices(rigs, { rigId: 'tc' }).map((r) => r.id)).toEqual([
      'tc',
    ]);
  });

  it('없는 리그를 가리키는 rigId 는 아무것도 더하지 않는다', () => {
    const out = listRigChoices(rigs, {
      rigId: 'ghost',
      asset: { id: 'okpo-tc', version: 1 },
    });
    expect(out.map((r) => r.id)).toEqual(['tc']);
  });

  it('빈 리그 목록은 빈 결과', () => {
    expect(
      listRigChoices([], { rigId: 'x', asset: { id: 'a', version: 1 } }),
    ).toEqual([]);
  });
});
