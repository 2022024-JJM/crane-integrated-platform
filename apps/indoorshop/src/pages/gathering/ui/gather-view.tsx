import type { CSSProperties } from 'react';
import type { GatherVM } from '../model/use-gathering';
import type { KvTone } from '../model/types';

function thStyle(align: 'left' | 'center'): CSSProperties {
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

const procChip: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  padding: '1px 8px',
  borderRadius: 2,
  whiteSpace: 'nowrap',
  color: '#5C6678',
  background: '#EFF1F4',
  border: '1px solid #D5DBE4',
};

function kvValueStyle(tone: KvTone | undefined): CSSProperties {
  switch (tone) {
    case 'key':
      return { fontSize: 11.5, fontWeight: 800, color: '#B55A00', whiteSpace: 'nowrap' };
    case 'g':
      return { fontSize: 11.5, fontWeight: 800, color: '#2F8F5B', whiteSpace: 'nowrap' };
    case 'r':
      return { fontSize: 11.5, fontWeight: 800, color: '#C42B2B', whiteSpace: 'nowrap' };
    case 'o':
      return { fontSize: 11.5, fontWeight: 800, color: '#B5740A', whiteSpace: 'nowrap' };
    case 'k':
      return { fontSize: 11.5, color: '#909AAC', whiteSpace: 'nowrap' };
    default:
      return { fontSize: 11.5, fontWeight: 700, color: '#23344C', whiteSpace: 'nowrap' };
  }
}

/** 수집 데이터 조회 탭 — 로우데이터 테이블 + 하위 상세 드릴다운 */
export function GatherView({ g }: { g: GatherVM }) {
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
              수집 이벤트 로우데이터
            </span>
            <span
              style={{ fontSize: 10.5, color: '#909AAC', whiteSpace: 'nowrap' }}
            >
              {g.cnt}건 · 행 클릭 → 하위 상세
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
            {g.procFilters.map((f) => (
              <div
                key={f.label}
                onClick={f.select}
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
                  ...(f.active
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
                {f.label}
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
                <th style={thStyle('center')}>공정</th>
                <th style={thStyle('left')}>수집 이벤트</th>
                <th style={thStyle('left')}>관리번호</th>
                <th style={thStyle('left')}>발생(시작)</th>
                <th style={thStyle('left')}>완료(수신)</th>
                <th style={thStyle('center')}>상태</th>
                <th style={thStyle('left')}>수집 내용</th>
                <th style={thStyle('left')}>수집 원천</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((e) => (
                <tr
                  key={e.id}
                  onClick={e.open}
                  style={{
                    cursor: 'pointer',
                    borderTop: e.newBlk ? '2px solid #DDD8C8' : undefined,
                    background: e.selected
                      ? '#FBEBD5'
                      : e.warn
                        ? '#FDF7F7'
                        : undefined,
                    boxShadow: e.selected ? 'inset 3px 0 0 #EE7A00' : undefined,
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
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={procChip}>{e.proc}</span>
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
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '1px 8px',
                        borderRadius: 2,
                        whiteSpace: 'nowrap',
                        ...(e.warn
                          ? {
                              color: '#C42B2B',
                              background: '#FBE8E8',
                              border: '1px solid #E8B4B4',
                            }
                          : e.done
                            ? {
                                color: '#2F8F5B',
                                background: '#E9F4EE',
                                border: '1px solid #BFDECB',
                              }
                            : {
                                color: '#5C6678',
                                background: '#EFF1F4',
                                border: '1px solid #D5DBE4',
                              }),
                      }}
                    >
                      {e.warn ? '보완' : e.done ? '완료' : '진행중'}
                    </span>
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
                  <td style={{ ...td, color: '#8A93A6' }}>{e.src}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하위 상세 드릴다운 */}
      {g.drill && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 'none',
            maxHeight: 300,
            background: '#fff',
            border: '1px solid #B9C8DA',
            borderTop: '3px solid #2E5E96',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 12px',
              background: '#EEF3F9',
              borderBottom: '1px solid #D5DEEA',
              flex: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: '#2E5E96',
                  background: '#E3EBF4',
                  border: '1px solid #B9C8DA',
                  padding: '1px 8px',
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                하위 상세
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: '#28354A',
                  whiteSpace: 'nowrap',
                }}
              >
                {g.drill.title}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  color: '#7A8699',
                  whiteSpace: 'nowrap',
                }}
              >
                {g.drill.sub}
              </span>
            </div>
            <div
              onClick={g.drill.close}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 22,
                padding: '0 10px',
                background: '#fff',
                border: '1px solid #A8B2C0',
                color: '#3C4859',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: 2,
              }}
            >
              닫기 ✕
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '10px 12px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
                gap: '6px 18px',
              }}
            >
              {g.drill.kv.map((d) => (
                <div
                  key={d[0]}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    borderBottom: '1px dashed #E5E0D2',
                    padding: '4px 0',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      color: '#7A8699',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d[0]}
                  </span>
                  <span style={kvValueStyle(d[2])}>{d[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
