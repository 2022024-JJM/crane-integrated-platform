import { describe, expect, it } from 'vitest';
import { matchTagsSubRoute } from '../tags-route';

describe('matchTagsSubRoute', () => {
  it('tags 는 목록, tags/{id} 는 상세', () => {
    expect(matchTagsSubRoute('tags')).toEqual({ craneId: null });
    expect(matchTagsSubRoute('tags/')).toEqual({ craneId: null });
    expect(matchTagsSubRoute('tags/C_867')).toEqual({ craneId: 'C_867' });
    expect(matchTagsSubRoute('tags/C_867/')).toEqual({ craneId: 'C_867' });
  });

  it('URL 인코딩된 id 를 푼다', () => {
    expect(matchTagsSubRoute('tags/C%2D1')).toEqual({ craneId: 'C-1' });
  });

  it('다른 서브라우트·더 깊은 경로·빈 값은 null, 뒤 슬래시만 남는 것은 목록', () => {
    expect(matchTagsSubRoute('3d-monitoring')).toBeNull();
    expect(matchTagsSubRoute('virtual-tags')).toBeNull();
    expect(matchTagsSubRoute('tags/C_867/extra')).toBeNull();
    expect(matchTagsSubRoute('tags//')).toEqual({ craneId: null });
    expect(matchTagsSubRoute('')).toBeNull();
    expect(matchTagsSubRoute(undefined)).toBeNull();
  });
});
