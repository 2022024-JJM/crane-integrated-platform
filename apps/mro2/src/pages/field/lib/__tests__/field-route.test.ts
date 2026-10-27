import { describe, expect, it } from 'vitest';
import {
  fieldNewPath,
  fieldTicketPath,
  isFieldKind,
  matchFieldSubRoute,
} from '../field-route';

describe('matchFieldSubRoute', () => {
  it('빈 값·undefined·모르는 경로는 홈', () => {
    expect(matchFieldSubRoute(undefined)).toEqual({ view: 'home' });
    expect(matchFieldSubRoute('')).toEqual({ view: 'home' });
    expect(matchFieldSubRoute('nope')).toEqual({ view: 'home' });
    expect(matchFieldSubRoute('new/unknown')).toEqual({ view: 'home' });
    expect(matchFieldSubRoute('new')).toEqual({ view: 'home' });
  });
  it('new/<kind> 와 tickets, 앞뒤 슬래시 허용', () => {
    expect(matchFieldSubRoute('new/repair')).toEqual({
      view: 'new',
      kind: 'repair',
    });
    expect(matchFieldSubRoute('/new/parts/')).toEqual({
      view: 'new',
      kind: 'parts',
    });
    expect(matchFieldSubRoute('tickets')).toEqual({ view: 'tickets' });
    expect(matchFieldSubRoute('emergency')).toEqual({ view: 'emergency' });
    expect(matchFieldSubRoute('inspect/insp-1')).toEqual({
      view: 'inspect',
      id: 'insp-1',
    });
    expect(matchFieldSubRoute('inspect')).toEqual({ view: 'home' });
    expect(matchFieldSubRoute('tickets/repair/r-1')).toEqual({
      view: 'ticket',
      kind: 'repair',
      id: 'r-1',
    });
    // 종류가 틀리거나 id 가 없으면 목록으로.
    expect(matchFieldSubRoute('tickets/x/r-1')).toEqual({ view: 'tickets' });
    expect(matchFieldSubRoute('tickets/repair')).toEqual({ view: 'tickets' });
    expect(fieldTicketPath('parts', 'p 1')).toBe(
      '/mro2/field/tickets/parts/p%201',
    );
  });
  it('isFieldKind·fieldNewPath', () => {
    expect(isFieldKind('inspection')).toBe(true);
    expect(isFieldKind('x')).toBe(false);
    expect(fieldNewPath('repair')).toBe('/mro2/field/new/repair');
    expect(fieldNewPath('parts', 'crane 1')).toBe(
      '/mro2/field/new/parts?asset=crane%201',
    );
  });
});
