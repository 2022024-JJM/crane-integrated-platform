import { describe, expect, it } from 'vitest';
import {
  parseVirtualTagSetJson,
  serializeVirtualTagSet,
} from '../virtual-tag-file';

const set = {
  version: 1 as const,
  tickMs: 100,
  tags: [
    {
      id: 'a',
      key: 'C_1:x',
      name: 'X',
      min: 0,
      max: 10,
      initial: 0,
      pattern: { kind: 'triangle' as const, periodMs: 1000 },
      enabled: true,
    },
  ],
};

describe('virtual-tag-file', () => {
  it('직렬화 → 파싱 왕복이 같다', () => {
    const text = serializeVirtualTagSet(set);
    expect(text.endsWith('\n')).toBe(true);
    expect(parseVirtualTagSetJson(text)).toEqual(set);
  });

  it('손상 JSON·비객체는 null, 배열만 있으면 봉투로 감싼다', () => {
    expect(parseVirtualTagSetJson('{')).toBeNull();
    expect(parseVirtualTagSetJson('"x"')).toBeNull();
    expect(parseVirtualTagSetJson('null')).toBeNull();
    expect(parseVirtualTagSetJson(JSON.stringify(set.tags))).toEqual(set);
  });

  it('손상 항목은 sanitize 가 버린다', () => {
    const out = parseVirtualTagSetJson(
      JSON.stringify({
        version: 1,
        tickMs: 'x',
        tags: [set.tags[0], { id: 'b' }],
      }),
    );
    expect(out?.tickMs).toBe(100);
    expect(out?.tags.map((t) => t.id)).toEqual(['a']);
  });
});
