import type { CSSProperties } from 'react';
import type { DashVM, TierChipVM } from '../model/use-gathering';
import type { TierKey } from '../model/types';

/** 티어별 [라벨, 글자색, 배경, 테두리] */
const TIER_META: Record<TierKey, [string, string, string, string]> = {
  delay: ['지연', '#C42B2B', '#FBE8E8', '#E8B4B4'],
  warn: ['주의', '#B5740A', '#FBF2DE', '#E8CB9C'],
  ok: ['정상', '#2F8F5B', '#E9F4EE', '#BFDECB'],
};

const BAR_COLOR: Record<TierKey, string> = {
  delay: '#C42B2B',
  warn: '#D9A11B',
  ok: '#56687E',
};

function thStyle(align: 'left' | 'center' | 'right', sep?: boolean): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#EDF0F5',
    borderBottom: '1px solid #C5CDD9',
    borderLeft: sep ? '2px solid #DDE2EA' : undefined,
    padding: '6px 8px',
    textAlign: align,
    fontSize: 10,
    color: '#5C6678',
    whiteSpace: 'nowrap',
  };
}

const td: CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid #EFEDE4',
  whiteSpace: 'nowrap',
};

function chipStyle(c: TierChipVM): CSSProperties {
  const [, color, bg, bd] =
    c.tier === '' ? ['', '#28354A', '#F5F3EC', '#D3CBB4'] : TIER_META[c.tier];
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    height: 24,
    padding: '0 11px',
    borderRadius: 2,
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ...(c.active
      ? { background: color, color: '#fff', border: `1px solid ${color}` }
      : { background: bg, color, border: `1px solid ${bd}` }),
  };
}

/** 1단계: 블록 현황 목록 (복수 선택 시 마스터) */
export function BlockList({ list }: { list: NonNullable<DashVM['list']> }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: '#fff',
        border: '1px solid #D3CBB4',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: '#F3F1EA',
          borderBottom: '1px solid #DDD8C8',
          flex: 'none',
          flexWrap: 'wrap',
          rowGap: 6,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: '#28354A',
            whiteSpace: 'nowrap',
          }}
        >
          블록 현황 목록
        </span>
        <span
          style={{ fontSize: 10.5, color: '#909AAC', whiteSpace: 'nowrap' }}
        >
          {list.shownN} / {list.total}개 · 지연 큰 순 · 행 클릭 → 블록 대시보드
        </span>
        <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
          {list.chips.map((c) => (
            <div key={c.label} onClick={c.select} style={chipStyle(c)}>
              {c.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table
          style={{ borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}
        >
          <thead>
            <tr>
              <th style={thStyle('center')}>블록</th>
              <th style={thStyle('center')}>상태</th>
              <th style={thStyle('left')}>종합 진행 (▏계획)</th>
              <th style={thStyle('right')}>실적</th>
              <th style={thStyle('right')}>계획</th>
              <th style={thStyle('right')}>지연</th>
              <th style={thStyle('left', true)}>가공 (현재 단계)</th>
              <th style={thStyle('right')}>조립</th>
              <th style={thStyle('right')}>의장</th>
              <th style={thStyle('center')}>도장</th>
              <th style={thStyle('right', true)}>하위 WO</th>
              <th style={thStyle('right')}>확인 필요</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((lr, i) => {
              const tm = TIER_META[lr.tier];
              return (
                <tr
                  key={lr.no}
                  onClick={lr.open}
                  style={{
                    cursor: 'pointer',
                    background: i % 2 ? '#FAF9F4' : undefined,
                  }}
                >
                  <td
                    style={{
                      ...td,
                      textAlign: 'center',
                      fontWeight: 800,
                      color: '#8A5A1A',
                    }}
                  >
                    {lr.no}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '1px 8px',
                        borderRadius: 2,
                        whiteSpace: 'nowrap',
                        color: tm[1],
                        background: tm[2],
                        border: `1px solid ${tm[3]}`,
                      }}
                    >
                      {tm[0]}
                    </span>
                  </td>
                  <td style={{ ...td, width: '22%' }}>
                    <div
                      style={{
                        width: '100%',
                        minWidth: 160,
                        height: 10,
                        background: '#F0EDE3',
                        borderRadius: 1,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          height: '100%',
                          width: `${lr.act}%`,
                          background: BAR_COLOR[lr.tier],
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: -1,
                          bottom: -1,
                          width: 2,
                          background: '#28354A',
                          left: `${lr.plan}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      fontWeight: 800,
                      color: '#23344C',
                    }}
                  >
                    {lr.act}%
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: '#8A93A6' }}>
                    {lr.plan}%
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      fontWeight: 800,
                      color:
                        lr.delay >= 5
                          ? '#C42B2B'
                          : lr.delay > 0
                            ? '#B5740A'
                            : '#C2C9D4',
                    }}
                  >
                    {lr.delayTxt}
                  </td>
                  <td
                    style={{
                      ...td,
                      borderLeft: '2px solid #EFEDE4',
                      color: '#3C4859',
                      fontWeight: 700,
                    }}
                  >
                    {lr.fab}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      color: '#3C4859',
                      fontWeight: 700,
                    }}
                  >
                    {lr.asm}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      color: '#3C4859',
                      fontWeight: 700,
                    }}
                  >
                    {lr.otf}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'center',
                      color: '#3C4859',
                      fontWeight: 700,
                    }}
                  >
                    {lr.pnt}
                  </td>
                  <td
                    style={{
                      ...td,
                      borderLeft: '2px solid #EFEDE4',
                      textAlign: 'right',
                      color: '#5C6678',
                    }}
                  >
                    {lr.woN}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      fontWeight: 800,
                      color: lr.iss > 0 ? '#C42B2B' : '#C2C9D4',
                    }}
                  >
                    {lr.iss > 0 ? lr.iss : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '5px 12px',
          background: '#F7F5EE',
          borderTop: '1px solid #E2D8C2',
          flex: 'none',
          fontSize: 10,
          color: '#8A93A6',
        }}
      >
        <span>상태: 지연 = 계획 대비 -5%p 이상 · 주의 = -1~4%p · 정상 = 계획 달성</span>
        <span>확인 필요 = 정합성 불일치 + Key-In 대기 + I/F 미수신 건수</span>
      </div>
    </div>
  );
}
