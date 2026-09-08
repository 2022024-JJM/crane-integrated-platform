import type { CSSProperties } from 'react';
import type { DetailVM, ProcCardVM } from '../model/use-gathering';
import type { TierKey } from '../model/types';

const TIER_BAR: Record<TierKey, string> = {
  delay: '#C42B2B',
  warn: '#D9A11B',
  ok: '#56687E',
};

/** 진행 바 단일 중립색 — 색은 상태 신호에만 사용 */
const BAR = '#56687E';

const panel: CSSProperties = {
  background: '#fff',
  border: '1px solid #D3CBB4',
  borderRadius: 3,
};

const panelTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#28354A',
  whiteSpace: 'nowrap',
};

function ProcCard({ p }: { p: ProcCardVM }) {
  const v = p.pct;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid #D3CBB4',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 14px',
          background: '#F5F3EC',
          borderBottom: '1px solid #E5E0D2',
          flex: 'none',
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
            color: '#28354A',
          }}
        >
          {p.name}
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            padding: '1px 8px',
            borderRadius: 2,
            whiteSpace: 'nowrap',
            ...(v == null
              ? {
                  color: '#8A93A6',
                  background: '#EFF1F4',
                  border: '1px solid #D5DBE4',
                }
              : v >= 100
                ? {
                    color: '#2F8F5B',
                    background: '#E9F4EE',
                    border: '1px solid #BFDECB',
                  }
                : {
                    color: '#5C6678',
                    background: '#fff',
                    border: '1px solid #C9CFD8',
                  }),
          }}
        >
          {p.st}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '9px 14px 8px',
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 5,
            flex: 'none',
            flexWrap: 'wrap',
            rowGap: 2,
          }}
        >
          <span
            style={{
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1,
              color: v == null ? '#C2C9D4' : p.stale ? '#A8AFBC' : '#1E2733',
            }}
          >
            {v == null ? '—' : v}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#8A93A6' }}>
            {v == null ? '' : '%'}
          </span>
          {p.subTag && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '1px 7px',
                borderRadius: 2,
                whiteSpace: 'nowrap',
                ...(p.stale
                  ? {
                      color: '#8A93A6',
                      background: '#EFF1F4',
                      border: '1px solid #D5DBE4',
                    }
                  : {
                      color: '#B55A00',
                      background: '#FDF3E7',
                      border: '1px solid #EDD3AE',
                    }),
              }}
            >
              {p.subTag}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            color: '#7A8699',
            marginTop: 2,
            flex: 'none',
          }}
        >
          {p.woCnt}
        </span>
        <div
          style={{
            height: 12,
            background: '#F0EDE3',
            borderRadius: 1,
            overflow: 'hidden',
            flex: 'none',
            marginTop: 6,
          }}
        >
          <div
            style={{ height: '100%', width: `${v ?? 0}%`, background: BAR }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'space-evenly',
            minHeight: 0,
            padding: '5px 0',
          }}
        >
          {p.rows.map((r) => (
            <div
              key={r.k}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span
                style={{
                  flex: 'none',
                  width: 56,
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#5C6678',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.k}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 10,
                  background: '#F4F1E8',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${r.val ?? 0}%`,
                    background: r.val == null ? 'transparent' : BAR,
                  }}
                />
              </div>
              <span
                style={{
                  flex: 'none',
                  minWidth: 46,
                  textAlign: 'right',
                  fontSize: 12.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  color:
                    r.txt == null && r.val == null
                      ? '#C2C9D4'
                      : r.txt != null && r.val == null
                        ? '#3C4859'
                        : r.val == null
                          ? '#C2C9D4'
                          : '#3C4859',
                }}
              >
                {r.txt ?? (r.val == null ? '—' : `${r.val}%`)}
              </span>
            </div>
          ))}
        </div>
        <div
          onClick={p.goProc}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            flex: 'none',
            borderTop: '1px solid #EFEDE4',
            paddingTop: 5,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              color: '#909AAC',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {p.src}
          </span>
          <span
            style={{
              flex: 'none',
              fontSize: 9.5,
              fontWeight: 800,
              color: '#B55A00',
              whiteSpace: 'nowrap',
            }}
          >
            로우데이터 →
          </span>
        </div>
      </div>
    </div>
  );
}

/** 2단계: 블록 대시보드 (헤더 + 공정 카드 + 하단 패널) */
export function BlockDashboard({ d }: { d: DetailVM }) {
  return (
    <>
      {/* 블록 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          flex: 'none',
          ...panel,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 2,
            flex: 'none',
            padding: '12px 22px',
            background: '#28354A',
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: '#AAB6C8',
              whiteSpace: 'nowrap',
            }}
          >
            {d.ship}호 · {d.fac}
          </span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '-1px',
              color: '#fff',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            블록 {d.no}
          </span>
          <span
            style={{ fontSize: 10.5, color: '#AAB6C8', whiteSpace: 'nowrap' }}
          >
            내업 재공 블록
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* 종합 진행 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 14px',
              borderBottom: '1px solid #EFEDE4',
            }}
          >
            <span
              style={{
                flex: 'none',
                fontSize: 11,
                fontWeight: 800,
                color: '#28354A',
                whiteSpace: 'nowrap',
              }}
            >
              종합 진행
            </span>
            <div
              style={{
                flex: 1,
                height: 16,
                background: '#F0EDE3',
                borderRadius: 2,
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
                  width: `${d.ovAct}%`,
                  background: TIER_BAR[d.ovTier],
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  bottom: -2,
                  width: 3,
                  background: '#28354A',
                  left: `${d.ovPlan}%`,
                }}
              />
            </div>
            <span
              style={{
                flex: 'none',
                fontSize: 13,
                fontWeight: 800,
                color: '#23344C',
                whiteSpace: 'nowrap',
              }}
            >
              실적 {d.ovAct}%
            </span>
            <span
              style={{
                flex: 'none',
                fontSize: 10.5,
                color: '#8A93A6',
                whiteSpace: 'nowrap',
              }}
            >
              계획 {d.ovPlan}% ▏
            </span>
            <span
              style={{
                flex: 'none',
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                padding: '2px 10px',
                borderRadius: 2,
                ...(d.ovTier === 'delay'
                  ? { color: '#C42B2B', background: '#FBE8E8' }
                  : d.ovTier === 'warn'
                    ? { color: '#B5740A', background: '#FBF2DE' }
                    : { color: '#2F8F5B', background: '#E9F4EE' }),
              }}
            >
              {d.ovDelay > 0 ? `지연 -${d.ovDelay}%p` : '계획 달성'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', flex: 1 }}>
            {d.stats.map((ss) => (
              <div
                key={ss.k}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  padding: '7px 4px',
                  borderRight: '1px solid #EFEDE4',
                }}
              >
                <span
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    color: ss.warm ? '#B5740A' : ss.dim ? '#5C6678' : '#23344C',
                  }}
                >
                  {ss.v}
                </span>
                <span
                  style={{ fontSize: 10, color: '#7A8699', whiteSpace: 'nowrap' }}
                >
                  {ss.k}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 공정 파이프라인 카드 4 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 10,
          flex: 'none',
          height: 238,
        }}
      >
        {d.procCards.map((p) => (
          <ProcCard key={p.name} p={p} />
        ))}
      </div>

      {/* 2번째 로우: WO 분포 · 어셈블리 진행 · 최근 수집 · 확인 필요 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.9fr 1.2fr 1fr 1.3fr',
          gridAutoRows: 'minmax(0,1fr)',
          gap: 10,
          flex: 1,
          minHeight: 250,
          maxHeight: 340,
        }}
      >
        {/* WO 분포 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            ...panel,
            padding: '10px 14px',
          }}
        >
          <span style={{ ...panelTitle, flex: 'none' }}>
            하위 WO 실적 분포{' '}
            <b style={{ color: '#909AAC', fontWeight: 700 }}>— {d.woN}개</b>
          </span>
          <div
            style={{
              display: 'flex',
              height: 22,
              borderRadius: 2,
              overflow: 'hidden',
              flex: 'none',
            }}
          >
            {d.distSegs.map((s, i) => (
              <div
                key={i}
                style={{ width: `${s.w}%`, background: s.color }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'space-evenly',
            }}
          >
            {d.distCells.map((dc) => (
              <div
                key={dc.k}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: dc.color,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 11.5,
                    color: '#5C6678',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dc.k}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    color: dc.warm
                      ? '#C42B2B'
                      : dc.k === '수집 실패'
                        ? '#C2C9D4'
                        : dc.k === '완료'
                          ? '#3C4859'
                          : dc.k === '진행중'
                            ? '#5C6678'
                            : '#8A93A6',
                  }}
                >
                  {dc.v}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: '#909AAC',
                    whiteSpace: 'nowrap',
                    width: 38,
                    textAlign: 'right',
                  }}
                >
                  {dc.p}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 어셈블리 진행률 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            ...panel,
            padding: '10px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flex: 'none',
            }}
          >
            <span style={panelTitle}>
              어셈블리 진행률{' '}
              <b style={{ color: '#909AAC', fontWeight: 700 }}>(LiDAR)</b>
            </span>
            <span
              style={{ fontSize: 10, color: '#909AAC', whiteSpace: 'nowrap' }}
            >
              {d.asmN}개 중 하위 7
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'space-evenly',
            }}
          >
            {d.asmBars.map((ab) => (
              <div
                key={ab.name}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 56,
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: '#8A5A1A',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ab.name}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 11,
                    background: '#F0EDE3',
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${ab.avg}%`,
                      background: ab.avg < 40 ? '#C42B2B' : BAR,
                    }}
                  />
                </div>
                <span
                  style={{
                    flex: 'none',
                    width: 34,
                    textAlign: 'right',
                    fontSize: 11,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    color: ab.avg < 40 ? '#C42B2B' : '#3C4859',
                  }}
                >
                  {ab.avg}%
                </span>
                <span
                  style={{
                    flex: 'none',
                    width: 52,
                    textAlign: 'right',
                    fontSize: 9.5,
                    color: '#909AAC',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ab.cnt}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 수집 이벤트 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            ...panel,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 14px 7px',
              flex: 'none',
            }}
          >
            <span style={panelTitle}>최근 수집 이벤트</span>
            <span
              onClick={d.goGather}
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#B55A00',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              전체 보기 →
            </span>
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {d.recentEv.map((re, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 14px',
                  borderTop: '1px solid #F2EFE6',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '1px 7px',
                    borderRadius: 2,
                    whiteSpace: 'nowrap',
                    color: '#5C6678',
                    background: '#EFF1F4',
                    border: '1px solid #D5DBE4',
                  }}
                >
                  {re.proc}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#3C4859',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {re.ev}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: '#909AAC',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {re.t}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 확인 필요 + 저조 WO */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            ...panel,
            padding: '10px 12px',
          }}
        >
          <span style={{ ...panelTitle, flex: 'none' }}>확인 필요</span>
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            {d.care.map((cr) => (
              <div
                key={cr.k}
                onClick={cr.open}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  ...(cr.v > 0
                    ? cr.warm
                      ? { background: '#FBE8E8', border: '1px solid #E8B4B4' }
                      : { background: '#FBF2DE', border: '1px solid #E8CB9C' }
                    : { background: '#F7F5EE', border: '1px solid #E5E0D2' }),
                }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    whiteSpace: 'nowrap',
                    color:
                      cr.v > 0
                        ? cr.warm
                          ? '#C42B2B'
                          : '#B5740A'
                        : '#C2C9D4',
                  }}
                >
                  {cr.v > 0 ? `${cr.v}건` : '0'}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#5C6678',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cr.k}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flex: 'none',
              paddingTop: 4,
              borderTop: '1px solid #EFEDE4',
              marginTop: 2,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#28354A',
                whiteSpace: 'nowrap',
              }}
            >
              실적 저조 WO <b style={{ color: '#C42B2B' }}>TOP 10</b>
            </span>
            <span
              style={{ fontSize: 9.5, color: '#909AAC', whiteSpace: 'nowrap' }}
            >
              진행중 WO 중 진행률 낮은 순
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <table
              style={{
                borderCollapse: 'collapse',
                fontSize: 10.5,
                width: '100%',
              }}
            >
              <thead>
                <tr>
                  {(
                    [
                      ['#', 'center', 22],
                      ['공정', 'left', undefined],
                      ['WO', 'left', undefined],
                      ['진행률', 'left', undefined],
                    ] as [string, 'left' | 'center', number | undefined][]
                  ).map(([label, align, w]) => (
                    <th
                      key={label}
                      style={{
                        position: 'sticky',
                        top: 0,
                        background: '#F5F3EC',
                        borderBottom: '1px solid #E5E0D2',
                        padding: '3px 4px',
                        textAlign: align,
                        fontSize: 9,
                        color: '#5C6678',
                        whiteSpace: 'nowrap',
                        width: w,
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.lowWos.map((lw) => (
                  <tr key={lw.wo}>
                    <td
                      style={{
                        padding: '3px 4px',
                        borderBottom: '1px solid #F2EFE6',
                        textAlign: 'center',
                        fontWeight: 800,
                        color: '#8A93A6',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lw.rank}
                    </td>
                    <td
                      style={{
                        padding: '3px 4px',
                        borderBottom: '1px solid #F2EFE6',
                        color: '#5C6678',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lw.proc}
                    </td>
                    <td
                      style={{
                        padding: '3px 4px',
                        borderBottom: '1px solid #F2EFE6',
                        fontWeight: 700,
                        color: '#3C4859',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 110,
                      }}
                    >
                      {lw.wo}
                    </td>
                    <td
                      style={{
                        padding: '3px 4px',
                        borderBottom: '1px solid #F2EFE6',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <div
                          style={{
                            width: 54,
                            height: 8,
                            background: '#F0EDE3',
                            borderRadius: 1,
                            overflow: 'hidden',
                            flex: 'none',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${lw.pct}%`,
                              background: lw.pct < 40 ? '#C42B2B' : BAR,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            width: 30,
                            textAlign: 'right',
                            color: lw.pct < 40 ? '#C42B2B' : '#3C4859',
                          }}
                        >
                          {lw.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d.lowWos.length === 0 && (
              <span
                style={{
                  display: 'block',
                  fontSize: 10.5,
                  color: '#909AAC',
                  padding: '10px 4px',
                  textAlign: 'center',
                }}
              >
                저조 WO 없음
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
