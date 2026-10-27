import { describe, expect, it } from 'vitest';
import { matchTagsSubRoute, realtimeTagsPath } from '../tags-route';

const list = { craneId: null };

describe('matchTagsSubRoute', () => {
  it('tags 는 목록, tags/{id} 는 실시간 상세', () => {
    expect(matchTagsSubRoute('tags')).toEqual(list);
    expect(matchTagsSubRoute('tags/')).toEqual(list);
    expect(matchTagsSubRoute('tags/C_867')).toEqual({ craneId: 'C_867' });
    expect(matchTagsSubRoute('tags/C_867/')).toEqual({ craneId: 'C_867' });
  });

  it('URL 인코딩된 id 를 푼다', () => {
    expect(matchTagsSubRoute('tags/C%2D1')?.craneId).toBe('C-1');
  });

  it('옛 가상 탭 경로·다른 서브라우트·더 깊은 경로·빈 값은 null, 뒤 슬래시만 남는 것은 목록', () => {
    expect(matchTagsSubRoute('tags/virtual/e1')).toBeNull();
    expect(matchTagsSubRoute('3d-monitoring')).toBeNull();
    expect(matchTagsSubRoute('virtual-tags')).toBeNull();
    expect(matchTagsSubRoute('tags/C_867/extra')).toBeNull();
    expect(matchTagsSubRoute('tags//')).toEqual(list);
    expect(matchTagsSubRoute('')).toBeNull();
    expect(matchTagsSubRoute(undefined)).toBeNull();
  });

  it('`tags/virtual` 은 이제 크레인 상세로 읽힌다 — 세그먼트가 예약되지 않는다', () => {
    expect(matchTagsSubRoute('tags/virtual')).toEqual({ craneId: 'virtual' });
  });
});

describe('경로 조립', () => {
  it('목록·상세 — id 는 인코딩한다', () => {
    expect(realtimeTagsPath('/outdoor-work/r/tags')).toBe(
      '/outdoor-work/r/tags',
    );
    expect(realtimeTagsPath('/outdoor-work/r/tags', 'C-1')).toBe(
      '/outdoor-work/r/tags/C-1',
    );
    expect(realtimeTagsPath('/x/tags', 'a b')).toBe('/x/tags/a%20b');
  });
});
