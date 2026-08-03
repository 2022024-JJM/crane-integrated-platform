import { describe, expect, it } from 'vitest';
import { toCsv, type CsvColumn } from './export-csv';

interface Row {
  name: string;
  qty: number;
  note?: string | null;
}

const columns: CsvColumn<Row>[] = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Qty', value: (r) => r.qty },
  { header: 'Note', value: (r) => r.note },
];

describe('toCsv', () => {
  it('헤더와 행을 CRLF로 결합한다', () => {
    const csv = toCsv([{ name: 'Rope', qty: 2 }], columns);
    expect(csv).toBe('Name,Qty,Note\r\nRope,2,');
  });

  it('행이 없으면 헤더만 남는다', () => {
    expect(toCsv([], columns)).toBe('Name,Qty,Note');
  });

  it('쉼표가 있는 값은 따옴표로 감싼다', () => {
    const csv = toCsv([{ name: 'Fan, Filter Unit', qty: 1 }], columns);
    expect(csv).toContain('"Fan, Filter Unit"');
  });

  it('따옴표는 중복시켜 이스케이프한다', () => {
    const csv = toCsv([{ name: 'Wire "28mm"', qty: 1 }], columns);
    expect(csv).toContain('"Wire ""28mm"""');
  });

  it('줄바꿈이 있는 값도 따옴표로 감싼다', () => {
    const csv = toCsv([{ name: 'a\nb', qty: 1 }], columns);
    expect(csv).toContain('"a\nb"');
  });

  it('null/undefined는 빈 칸으로 쓴다', () => {
    const csv = toCsv([{ name: 'X', qty: 0, note: null }], columns);
    expect(csv).toBe('Name,Qty,Note\r\nX,0,');
  });
});
