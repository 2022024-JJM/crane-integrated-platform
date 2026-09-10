import type { CSSProperties } from 'react';
import type { GatherVM } from '../model/use-gathering';

function thStyle(align: 'left' | 'center' | 'right'): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: '#EDF0F5',
    borderBottom: '1px solid #C5CDD9',
    padding: '6px 8px',
    textAlign: align,
    fontSize: 10,
    color: '#5C6678',
    whiteSpace: 'nowrap',
  };
}

const td: CSSProperties = {
  padding: '5px 8px',
  borderBottom: '1px solid #EFEDE4',
  whiteSpace: 'nowrap',
};

function chip(warn: boolean, done: boolean): CSSProperties {
  return {
    fontSize: 9.5,
    fontWeight: 800,
    padding: '1px 8px',
    borderRadius: 2,
    whiteSpace: 'nowrap',
    ...(warn
      ? { color: '#C42B2B', background: '#FBE8E8', border: '1px solid #E8B4B4' }
      : done
        ? { color: '#2F8F5B', background: '#E9F4EE', border: '1px solid #BFDECB' }
        : {
            color: '#5C6678',
            background: '#EFF1F4',
            border: '1px solid #D5DBE4',
          }),
  };
}

/** 수집 데이터 조회 탭 — 권역 수집 이벤트 로우데이터 */
export function GatherView({ g, scopeName }: { g: GatherVM; scopeName: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        gap: 10,
        padding: 10,
        overflowY: 'auto',
      }}
    >
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
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            rowGap: 4,
            padding: '7px 12px',
            background: '#F3F1EA',
            borderBottom: '1px solid #DDD8C8',
            flex: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: '#28354A',
                whiteSpace: 'nowrap',
              }}
            >
              {scopeName} 수집 이벤트 로우데이터
            </span>
            <span style={{ fontSize: 10.5, color: '#909AAC', whiteSpace: 'nowrap' }}>
              {g.cnt}건
            </span>
            {g.issueChip && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#C42B2B',
                  background: '#FBE8E8',
                  border: '1px solid #E8B4B4',
                  padding: '2px 9px',
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {g.issueChip.label}{' '}
                <span
                  onClick={g.issueChip.clear}
                  style={{ cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </span>
              </span>
            )}
            {g.blkChip && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#2E5E96',
                  background: '#E3EBF4',
                  border: '1px solid #B9C8DA',
                  padding: '2px 9px',
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                블록 {g.blkChip.no}{' '}
                <span
                  onClick={g.blkChip.clear}
                  style={{ cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </span>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {g.stFilters.map((gf) => (
              <div
                key={gf.label}
                onClick={gf.select}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 22,
                  padding: '0 11px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                  ...(gf.active
                    ? {
                        background: '#3C4859',
                        color: '#fff',
                        border: '1px solid #3C4859',
                      }
                    : {
                        background: '#fff',
                        color: '#5C6678',
                        border: '1px solid #D8CFB8',
                      }),
                }}
              >
                {gf.label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              fontSize: 11,
              width: 'auto',
              minWidth: '100%',
            }}
          >
            <thead>
              <tr>
                <th style={thStyle('center')}>블록</th>
                <th style={thStyle('left')}>수집 이벤트</th>
                <th style={thStyle('left')}>관리번호</th>
                <th style={thStyle('left')}>발생(시작)</th>
                <th style={thStyle('left')}>완료(수신)</th>
                <th style={thStyle('center')}>상태</th>
                <th style={thStyle('left')}>수집 내용</th>
                {g.hasLegacy && (
                  <>
                    <th style={thStyle('right')}>자동 중량률</th>
                    <th style={thStyle('right')}>레거시 실적</th>
                    <th style={thStyle('center')}>정합성</th>
                  </>
                )}
                <th style={thStyle('left')}>수집 원천</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((e, i) => (
                <tr
                  key={`${e.key}-${e.ev}-${i}`}
                  style={{
                    borderTop: e.newBlk ? '2px solid #DDD8C8' : undefined,
                    background: e.warn ? '#FDF7F7' : undefined,
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
                    {e.blk}
                  </td>
                  <td style={{ ...td, color: '#3C4859', fontWeight: 700 }}>
                    {e.ev}
                  </td>
                  <td style={{ ...td, color: '#B55A00', fontWeight: 700 }}>
                    {e.key}
                  </td>
                  <td style={{ ...td, color: '#5C6678' }}>{e.start}</td>
                  <td style={{ ...td, color: '#5C6678' }}>{e.end}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={chip(e.warn, e.st === '완료')}>{e.st}</span>
                  </td>
                  <td
                    style={{
                      ...td,
                      ...(e.warn
                        ? { color: '#C42B2B', fontWeight: 700 }
                        : { color: '#3C4859' }),
                    }}
                  >
                    {e.note}
                  </td>
                  {g.hasLegacy && (
                    <>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#3C4859',
                        }}
                      >
                        {e.autoPct}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          fontWeight: 700,
                          color: e.legacyWarn ? '#C42B2B' : '#3C4859',
                        }}
                      >
                        {e.legacy}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={chip(e.matchWarn, !e.matchWarn)}>
                          {e.match}
                        </span>
                      </td>
                    </>
                  )}
                  <td style={{ ...td, color: '#8A93A6' }}>{e.src}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
