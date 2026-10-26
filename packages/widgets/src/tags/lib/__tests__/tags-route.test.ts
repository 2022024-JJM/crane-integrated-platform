import { describe, expect, it } from 'vitest';
import {
  matchTagsSubRoute,
  realtimeTagsPath,
  virtualTagsPath,
} from '../tags-route';

const realtimeList = { tab: 'realtime', craneId: null, equipmentId: null };
const virtualList = { tab: 'virtual', craneId: null, equipmentId: null };

describe('matchTagsSubRoute', () => {
  it('tags 는 실시간 목록, tags/{id} 는 실시간 상세', () => {
    expect(matchTagsSubRoute('tags')).toEqual(realtimeList);
    expect(matchTagsSubRoute('tags/')).toEqual(realtimeList);
    expect(matchTagsSubRoute('tags/C_867')).toEqual({
      tab: 'realtime',
      craneId: 'C_867',
      equipmentId: null,
    });
    expect(matchTagsSubRoute('tags/C_867/')).toEqual({
      tab: 'realtime',
      craneId: 'C_867',
      equipmentId: null,
    });
  });

  it('tags/virtual 은 가상 목록, tags/virtual/{id} 는 가상 장비 상세', () => {
    expect(matchTagsSubRoute('tags/virtual')).toEqual(virtualList);
    expect(matchTagsSubRoute('tags/virtual/')).toEqual(virtualList);
    expect(matchTagsSubRoute('tags/virtual/legacy-GC_04')).toEqual({
      tab: 'virtual',
      craneId: null,
      equipmentId: 'legacy-GC_04',
    });
    expect(matchTagsSubRoute('tags/virtual/a/b')).toBeNull();
  });

  it('URL 인코딩된 id 를 푼다', () => {
    expect(matchTagsSubRoute('tags/C%2D1')?.craneId).toBe('C-1');
    expect(matchTagsSubRoute('tags/virtual/e%201')?.equipmentId).toBe('e 1');
  });

  it('다른 서브라우트·더 깊은 경로·빈 값은 null, 뒤 슬래시만 남는 것은 목록', () => {
    expect(matchTagsSubRoute('3d-monitoring')).toBeNull();
    expect(matchTagsSubRoute('virtual-tags')).toBeNull();
    expect(matchTagsSubRoute('tags/C_867/extra')).toBeNull();
    expect(matchTagsSubRoute('tags//')).toEqual(realtimeList);
    expect(matchTagsSubRoute('')).toBeNull();
    expect(matchTagsSubRoute(undefined)).toBeNull();
  });
});

describe('경로 조립', () => {
  it('실시간 목록·상세, 가상 목록·상세 — id 는 인코딩한다', () => {
    expect(realtimeTagsPath('/outdoor-work/r/tags')).toBe(
      '/outdoor-work/r/tags',
    );
    expect(realtimeTagsPath('/outdoor-work/r/tags', 'C-1')).toBe(
      '/outdoor-work/r/tags/C-1',
    );
    expect(virtualTagsPath('/outdoor-work/r/tags')).toBe(
      '/outdoor-work/r/tags/virtual',
    );
    expect(virtualTagsPath('/outdoor-work/r/tags', 'e 1')).toBe(
      '/outdoor-work/r/tags/virtual/e%201',
    );
  });

  it('조립한 경로의 서브라우트가 다시 같은 매치로 풀린다', () => {
    const base = '/outdoor-work/r/tags';
    const sub = (path: string) => path.slice('/outdoor-work/r/'.length);
    expect(matchTagsSubRoute(sub(virtualTagsPath(base, 'x/y')))).toEqual({
      tab: 'virtual',
      craneId: null,
      equipmentId: 'x/y',
    });
    expect(matchTagsSubRoute(sub(realtimeTagsPath(base, 'GC-04')))).toEqual({
      tab: 'realtime',
      craneId: 'GC-04',
      equipmentId: null,
    });
  });
});
