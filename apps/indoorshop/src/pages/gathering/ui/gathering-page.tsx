import type { CSSProperties } from 'react';
import {
  SHIP_OPTIONS,
  STAGE_KEY_LABEL,
  STEP_OPTIONS,
} from '../model/mock-data';
import type { CellTone, DetailCell, DetailCol } from '../model/types';
import { useGathering } from '../model/use-gathering';

/** 시안의 tone 맵 — 셀 강조 색상 */
const TONE_STYLE: Record<CellTone, CSSProperties> = {
  r: { fontWeight: 800, color: '#C42B2B' },
  g: { fontWeight: 700, color: '#5CA627' },
  o: { fontWeight: 700, color: '#B55A00' },
  k: { color: '#C2C9D4' },
  b: { fontWeight: 700, color: '#2E5E96' },
  key: { fontWeight: 700, color: '#B55A00' },
};

const PROC_COLOR: Record<string, string> = {
  가공: '#4A6E96',
  조립: '#2F6E58',
  의장: '#6D5A9C',
  도장: '#96604A',
};

const STAGE_COLOR: Record<string, string> = {
  SSY: '#5C6678',
  전처리: '#8A6D1F',
  절단: '#2E5E96',
  사상: '#B55A00',
  선별: '#6D5A9C',
  조립: '#2F6E58',
  의장: '#6D5A9C',
  도장: '#96604A',
};

const MAIN_COLS: { label: string; align: 'left' | 'center' | 'right' }[] = [
  { label: '호선', align: 'center' },
  { label: '블록', align: 'center' },
  { label: '공정', align: 'center' },
  { label: '단계', align: 'center' },
  { label: '세부 단계', align: 'center' },
  { label: '작업시작일시', align: 'left' },
  { label: '작업완료일시', align: 'left' },
  { label: '대상번호 (추적객체)', align: 'left' },
  { label: '추적 단위', align: 'left' },
  { label: '비고', align: 'left' },
  { label: '실적률', align: 'right' },
];

function thStyle(align: string): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    background: '#EBEBE4',
    borderBottom: '1px solid #C9C5B6',
    borderRight: '1px solid #DEDBD0',
    padding: '6px 8px',
    fontSize: 10,
    color: '#4A4A42',
    whiteSpace: 'nowrap',
    textAlign: align as CSSProperties['textAlign'],
  };
}

function tdStyle(align: string): CSSProperties {
  return {
    padding: '5px 8px',
    borderBottom: '1px solid #EFEDE4',
    borderRight: '1px solid #F6F4EC',
    whiteSpace: 'nowrap',
    textAlign: align as CSSProperties['textAlign'],
  };
}

function DetailTable({
  cols,
  rows,
}: {
  cols: DetailCol[];
  rows: DetailCell[][];
}) {
  return (
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
          {cols.map((c, i) => (
            <th key={i} style={thStyle(c.align)}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td
                key={j}
                style={{
                  ...tdStyle(c.align),
                  color: '#3C4859',
                  ...(c.tone ? TONE_STYLE[c.tone] : undefined),
                }}
              >
                {c.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GatheringPage() {
  const g = useGathering();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        background: '#EDEAE0',
        fontFamily: "Pretendard, '-apple-system', sans-serif",
        color: '#1E2733',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`@keyframes indoorshop-live-blink{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* ===== UTILITY BAR ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 34,
          padding: '0 14px',
          background: '#EE7A00',
          flex: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EE7A00',
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            HW
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.2px',
              whiteSpace: 'nowrap',
            }}
          >
            한화오션 내업 공정실적 자료수집 시스템
          </span>
          <span
            style={{ fontSize: 12, color: '#FFDFBC', whiteSpace: 'nowrap' }}
          >
            / 통합조회 — 데이터 게더링
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#B4E34F',
                animation: 'indoorshop-live-blink 1.6s infinite',
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#FFF3D9',
                letterSpacing: '0.5px',
              }}
            >
              수집중
            </span>
          </div>
          <span style={{ fontSize: 11.5, color: '#FFDFBC' }}>
            {g.dateStr} {g.timeStr}
          </span>
          <span style={{ fontSize: 11.5, color: '#FFE9CF' }}>
            사용자:{' '}
            <b style={{ color: '#fff', fontWeight: 600 }}>생산계획팀</b>
          </span>
        </div>
      </div>

      {/* ===== TOOLBAR ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 4,
          minHeight: 42,
          padding: '5px 14px',
          background: '#FBF6EA',
          borderBottom: '1px solid #E2D8C2',
          flex: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 3, height: 15, background: '#EE7A00' }} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#23344C',
              whiteSpace: 'nowrap',
            }}
          >
            내업 공정실적 통합조회
          </span>
          <span
            style={{ fontSize: 11.5, color: '#7A8699', whiteSpace: 'nowrap' }}
          >
            [ 기준일 2026-07-21 ]
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: '#909AAC',
              borderLeft: '1px solid #DDD2B8',
              paddingLeft: 11,
              whiteSpace: 'nowrap',
            }}
          >
            로우데이터 수집·정합성 확인 목적 · 공정률은 참고 수치
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <span
            style={{ fontSize: 11, color: '#7A8699', whiteSpace: 'nowrap' }}
          >
            최종수신 {g.updStr}
          </span>
          <label
            onClick={g.toggleAuto}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              fontSize: 11.5,
              color: '#3C4859',
              userSelect: 'none',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                border: '1px solid #C9B98E',
                borderRadius: 2,
                background: g.auto ? '#EE7A00' : '#fff',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {g.auto ? '✓' : ''}
            </span>
            자동갱신 {g.refreshSec}s
          </label>
          <button
            type="button"
            onClick={g.doExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 26,
              padding: '0 12px',
              background: '#5CA627',
              color: '#fff',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              borderRadius: 2,
            }}
          >
            내보내기
          </button>
        </div>
      </div>

      {/* ===== FILTER BAR ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 6,
          padding: '9px 14px',
          background: '#FDF8ED',
          borderBottom: '1px solid #E2D8C2',
          flex: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: '#3C4859',
                whiteSpace: 'nowrap',
              }}
            >
              호선 번호 <b style={{ color: '#C42B2B' }}>*</b>
            </span>
            <select
              value={g.fShip}
              onChange={(e) => g.setFShip(e.target.value)}
              style={{
                height: 27,
                border: '1px solid #C9B98E',
                borderRadius: 2,
                padding: '0 6px',
                fontSize: 11.5,
                fontFamily: 'inherit',
                color: '#1E2733',
                background: '#fff',
                outline: 'none',
                minWidth: 150,
              }}
            >
              <option value="">— 선택 —</option>
              {SHIP_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: '#3C4859',
                whiteSpace: 'nowrap',
              }}
            >
              블록 No
            </span>
            <input
              value={g.fBlock}
              onChange={(e) => g.setFBlock(e.target.value)}
              placeholder="예: 101 (부분 입력 가능)"
              style={{
                height: 27,
                width: 170,
                border: '1px solid #C9B98E',
                borderRadius: 2,
                padding: '0 8px',
                fontSize: 11.5,
                fontFamily: 'inherit',
                color: '#1E2733',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: '#3C4859',
                whiteSpace: 'nowrap',
              }}
            >
              단계(공정)
            </span>
            <select
              value={g.fStep}
              onChange={(e) => g.setFStep(e.target.value)}
              style={{
                height: 27,
                border: '1px solid #C9B98E',
                borderRadius: 2,
                padding: '0 6px',
                fontSize: 11.5,
                fontFamily: 'inherit',
                color: '#1E2733',
                background: '#fff',
                outline: 'none',
              }}
            >
              {STEP_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
          }}
        >
          <button
            type="button"
            onClick={g.doSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 27,
              padding: '0 18px',
              background: '#EE7A00',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              borderRadius: 2,
            }}
          >
            조회
          </button>
          <button
            type="button"
            onClick={g.doReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 27,
              padding: '0 12px',
              background: '#fff',
              border: '1px solid #C9B98E',
              color: '#8A5A1A',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            초기화
          </button>
        </div>
      </div>

      {/* ===== EMPTY STATE ===== */}
      {!g.query && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 10,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C9B98E"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span
            style={{ fontSize: 13.5, fontWeight: 700, color: '#7A8699' }}
          >
            호선 번호를 선택한 후 [조회]를 클릭하세요
          </span>
          <span style={{ fontSize: 11.5, color: '#909AAC' }}>
            블록 No 부분 입력으로 특정 블록만 조회할 수 있습니다 · 공정 구분은
            결과 그리드에서 정렬(공정순)로 확인합니다
          </span>
        </div>
      )}

      {/* ===== RESULTS ===== */}
      {g.query && (
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
          {/* 단일 통합 그리드: FACT_공정이벤트 */}
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
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: '#28354A',
                    whiteSpace: 'nowrap',
                  }}
                >
                  내업 공정 실적 수집 현황
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: '#909AAC',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g.rows.length}건 · 행 클릭 → 하위 데이터 드릴다운
                </span>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  color: '#909AAC',
                  whiteSpace: 'nowrap',
                }}
              >
                단계: SSY(입고·적치·선별·불출) → 전처리 → 절단 → 사상 → 선별 ·
                적색 = 확인 필요
              </span>
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
                    {MAIN_COLS.map((c) => (
                      <th key={c.label} style={thStyle(c.align)}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((row, i) => {
                    const selected = g.drill === i;
                    return (
                      <tr
                        key={i}
                        onClick={() => g.setDrill(i)}
                        style={{
                          cursor: 'pointer',
                          background: selected
                            ? '#FDF0E0'
                            : row.warn
                              ? '#FDF7F7'
                              : undefined,
                          boxShadow: selected
                            ? 'inset 3px 0 0 #EE7A00'
                            : undefined,
                        }}
                      >
                        <td style={{ ...tdStyle('center'), color: '#5C6678' }}>
                          {row.ship}
                        </td>
                        <td
                          style={{
                            ...tdStyle('center'),
                            fontWeight: 700,
                            color: '#8A5A1A',
                          }}
                        >
                          {row.blk}
                        </td>
                        <td
                          style={{
                            ...tdStyle('center'),
                            fontWeight: 800,
                            color: PROC_COLOR[row.proc],
                          }}
                        >
                          {row.proc}
                        </td>
                        <td
                          style={{
                            ...tdStyle('center'),
                            fontWeight: 800,
                            color: STAGE_COLOR[row.stage],
                          }}
                        >
                          {row.stage}
                        </td>
                        <td style={{ ...tdStyle('center'), color: '#5C6678' }}>
                          {row.sub}
                        </td>
                        <td
                          style={{
                            ...tdStyle('left'),
                            color: row.start ? '#3C4859' : '#C2C9D4',
                          }}
                        >
                          {row.start || '—'}
                        </td>
                        <td
                          style={{
                            ...tdStyle('left'),
                            color: row.end ? '#23344C' : '#C2C9D4',
                            fontWeight: row.end ? 700 : undefined,
                          }}
                        >
                          {row.end || '—'}
                        </td>
                        <td
                          style={{
                            ...tdStyle('left'),
                            fontWeight: 700,
                            color: '#B55A00',
                          }}
                        >
                          {row.key}
                        </td>
                        <td style={{ ...tdStyle('left'), color: '#8A93A6' }}>
                          {STAGE_KEY_LABEL[row.stage]}
                        </td>
                        <td
                          style={{
                            ...tdStyle('left'),
                            color: row.warn ? '#C42B2B' : '#5C6678',
                            fontWeight: row.warn ? 800 : undefined,
                          }}
                        >
                          {row.note || '—'}
                        </td>
                        <td style={{ ...tdStyle('right'), color: '#C2C9D4' }}>
                          —
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DRILLDOWN: 원천 네이티브 그리드 */}
          {g.drillDetail && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 'none',
                maxHeight: 340,
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
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
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
                    하위 데이터
                  </span>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#28354A',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.drillDetail.title}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      color: '#2E5E96',
                      background: '#fff',
                      border: '1px solid #B9C8DA',
                      padding: '1px 8px',
                      borderRadius: 2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    관리 단위: {g.drillDetail.axis}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => g.setDrill(null)}
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
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <DetailTable
                  cols={g.drillDetail.cols}
                  rows={g.drillDetail.rows}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
