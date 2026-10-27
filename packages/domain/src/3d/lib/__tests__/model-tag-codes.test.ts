import { describe, expect, it } from 'vitest';
import { collectModelTagCodes } from '../model-tag-codes';
import type { TagMapping } from '../../model/tag-mapping-types';

const root: TagMapping['target'] = {
  kind: 'node',
  node: '',
  channel: 'position',
  axis: 'z',
};

describe('collectModelTagCodes', () => {
  it('맵핑 코드 다음에 상태 태그 역할 순으로 편다', () => {
    expect(
      collectModelTagCodes({
        tagMappings: [
          { id: 'a', target: root, code: 'tl_distance' },
          { id: 'b', target: { kind: 'joint', jointId: 'luff' }, code: 'luff' },
        ],
        statusTags: {
          fault: 'crane_system_error',
          controlOn: 'crane_control_on',
        },
      }),
    ).toEqual([
      { code: 'tl_distance', source: 'mapping', mappingId: 'a', target: root },
      {
        code: 'luff',
        source: 'mapping',
        mappingId: 'b',
        target: { kind: 'joint', jointId: 'luff' },
      },
      { code: 'crane_control_on', source: 'status', role: 'controlOn' },
      { code: 'crane_system_error', source: 'status', role: 'fault' },
    ]);
  });

  it('같은 코드는 첫 항목만 — 팬아웃 맵핑과 맵핑·상태 중복', () => {
    const out = collectModelTagCodes({
      tagMappings: [
        { id: 'a', target: root, code: 'x' },
        { id: 'b', target: { ...root, axis: 'y' }, code: 'x' },
      ],
      statusTags: { fault: 'x' },
    });
    expect(out).toEqual([
      { code: 'x', source: 'mapping', mappingId: 'a', target: root },
    ]);
  });

  it('빈 코드는 건너뛰고, 아무것도 없으면 빈 배열', () => {
    expect(
      collectModelTagCodes({
        tagMappings: [{ id: 'a', target: root, code: '' }],
        statusTags: { fault: '' },
      }),
    ).toEqual([]);
    expect(collectModelTagCodes({})).toEqual([]);
  });
});
