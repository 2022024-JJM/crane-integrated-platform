import { beforeEach, describe, expect, it } from 'vitest';
import {
  getActivities,
  logActivity,
  resetActivitiesForTest,
} from '../activity';

beforeEach(() => resetActivitiesForTest());

describe('activity', () => {
  it('요청별로 쌓이고 순서가 유지된다', () => {
    logActivity({
      kind: 'repair',
      refId: 'r1',
      type: 'assigned',
      by: 'a',
      detail: '박순영',
    });
    logActivity({ kind: 'repair', refId: 'r2', type: 'started', by: 'b' });
    logActivity({ kind: 'repair', refId: 'r1', type: 'completed', by: 'c' });
    expect(getActivities('repair', 'r1').map((a) => a.type)).toEqual([
      'assigned',
      'completed',
    ]);
    expect(getActivities('inspection', 'r1')).toEqual([]);
  });
});
