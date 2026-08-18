import type { CSSProperties, ReactNode } from 'react';
import { KEYIN_DATES, KEYIN_REASONS, KEYIN_SHIPS } from '../model/mock-data';
import type { KeyinItem, KeyinStatus } from '../model/types';
import { useKeyin } from '../model/use-keyin';

const PROC_COLOR: Record<string, string> = {
  가공: '#2E5E96',
  조립: '#2F6E58',
  의장: '#6D5A9C',
  도장: '#96604A',
};

/** 상태 칩 — [라벨, 글자색, 배경, 테두리] */
const STATUS_META: Record<KeyinStatus, [string, string, string, string]> = {
  none: ['미입력', '#5C6678', '#ECEEF1', '#CFD5DE'],
  typed: ['입력됨', '#B55A00', '#FBF1E2', '#E8CB9C'],
  draft: ['임시저장', '#2E5E96', '#E9F0F8', '#B9C8DA'],
  fixed: ['확정', '#2F8F5B', '#E9F4EE', '#BFDECB'],
};

const MSG_TONE_COLOR = { ok: '#2F8F5B', warn: '#C42B2B', info: '#5C6678' };

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'];

function chipStyle(selected: boolean, locked: boolean): CSSProperties {
  return {
    height: 48,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    borderRadius: 24,
    fontSize: 15,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    ...(locked
      ? {
          cursor: 'default',
          background: '#F4F6F2',
          color: '#A9B0BC',
          border: '1px solid #E4E9DE',
        }
      : selected
        ? {
            cursor: 'pointer',
            background: '#3C4859',
            color: '#fff',
            border: '1px solid #3C4859',
          }
        : {
            cursor: 'pointer',
            background: '#F7F5EE',
            color: '#5C6678',
            border: '1px solid #DDD4BE',
          }),
  };
}

function quickStyle(selected: boolean, locked: boolean): CSSProperties {
  return {
    flex: 1,
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    fontSize: 17,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    ...(locked
      ? {
          cursor: 'default',
          background: '#F4F6F2',
          color: '#A9B0BC',
          border: '1px solid #E4E9DE',
        }
      : selected
        ? {
            cursor: 'pointer',
            background: '#EE7A00',
            color: '#fff',
            border: '1px solid #EE7A00',
          }
        : {
            cursor: 'pointer',
            background: '#fff',
            color: '#5C6678',
            border: '1px solid #D8CFB8',
          }),
  };
}

function stepStyle(locked: boolean): CSSProperties {
  return {
    flex: 1,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    fontSize: 20,
    fontWeight: 800,
    ...(locked
      ? {
          cursor: 'default',
          background: '#F4F6F2',
          color: '#B7BEC8',
          border: '1px solid #E4E9DE',
        }
      : {
          cursor: 'pointer',
          background: '#F2EFE6',
          color: '#5C6678',
          border: '1px solid #D8CFB8',
        }),
  };
}

function Modal({
  onClose,
  title,
  width,
  children,
}: {
  onClose: () => void;
  title: string;
  width: number;
  children: ReactNode;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(30,39,51,.55)',
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width,
          maxWidth: '92vw',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.32)',
          zIndex: 41,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: '#F3F1EA',
            borderBottom: '1px solid #DDD8C8',
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#28354A',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <div
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              fontSize: 19,
              fontWeight: 800,
              color: '#5C6678',
              cursor: 'pointer',
            }}
          >
            ✕
          </div>
        </div>
        {children}
      </div>
    </>
  );
}

function KeyinCard({
  it,
  k,
}: {
  it: KeyinItem;
  k: ReturnType<typeof useKeyin>;
}) {
  const locked = it.status === 'fixed';
  const diff =
    it.kind === 'pct' && it.val != null && it.auto != null
      ? it.val - it.auto
      : null;
  const needMemo = diff != null && Math.abs(diff) >= 15;
  const missMemo = needMemo && !it.memo;
  const meta = STATUS_META[it.status];
  const curVal = it.kind === 'pct' ? it.val : it.cnt;

  const step = (delta: number) => {
    if (locked) return;
    if (it.kind === 'pct')
      k.upd(it.id, (x) =>
        k.mark(
          Object.assign(x, {
            val: Math.max(0, Math.min(100, (x.val ?? 0) + delta * 5)),
          }),
        ),
      );
    else
      k.upd(it.id, (x) =>
        k.mark(
          Object.assign(x, {
            cnt: Math.max(0, Math.min(x.total ?? 0, (x.cnt ?? 0) + delta)),
          }),
        ),
      );
  };

  const valueBoxStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
    padding: '16px 0',
    borderRadius: 8,
    cursor: locked ? 'default' : 'pointer',
    ...(locked
      ? { background: '#F4F8F0', border: '1px solid #D6E8C4' }
      : curVal == null
        ? { background: '#FEFAF3', border: '2px dashed #E0C89B' }
        : { background: '#FEFAF3', border: '2px solid #EE7A00' }),
  };

  const valueStyle: CSSProperties = {
    fontSize: 52,
    fontWeight: 800,
    letterSpacing: -2,
    lineHeight: 1,
    color: curVal == null ? '#C9CFD8' : '#1E2733',
  };

  const sideCol: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 7,
    flex: 'none',
    width: 168,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: '#fff',
        borderRadius: 9,
        ...(locked
          ? {
              border: '1px solid #C6E3A2',
              boxShadow: 'inset 4px 0 0 #5CA627',
            }
          : missMemo
            ? {
                border: '1px solid #E8B4B4',
                boxShadow: 'inset 4px 0 0 #C42B2B',
              }
            : { border: '1px solid #D3CBB4' }),
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: -0.4,
              whiteSpace: 'nowrap',
              color: PROC_COLOR[it.proc],
            }}
          >
            {it.proc}
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#3C4859',
              whiteSpace: 'nowrap',
            }}
          >
            {it.ev}
          </span>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            padding: '5px 12px',
            borderRadius: 14,
            whiteSpace: 'nowrap',
            color: meta[1],
            background: meta[2],
            border: `1px solid ${meta[3]}`,
          }}
        >
          {meta[0]}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 'none',
          padding: '8px 12px',
          background: '#FBECEC',
          border: '1px solid #EDCFCF',
          borderRadius: 5,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: '#C42B2B',
            whiteSpace: 'nowrap',
          }}
        >
          자동수집 실패
        </span>
        <span style={{ fontSize: 14, color: '#8A5252', whiteSpace: 'nowrap' }}>
          {it.fail}
        </span>
      </div>

      {it.kind === 'pct' && (
        <>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
            <div onClick={() => k.openPad(it)} style={valueBoxStyle}>
              <span style={valueStyle}>{it.val == null ? '—' : it.val}</span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#8A93A6',
                  marginLeft: 2,
                }}
              >
                %
              </span>
            </div>
            <div style={sideCol}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    color: '#7A8394',
                    whiteSpace: 'nowrap',
                  }}
                >
                  직전 자동값
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    color: it.auto == null ? '#C2C9D4' : '#5C6678',
                  }}
                >
                  {it.auto == null ? '없음' : `${it.auto}% (${it.autoAt})`}
                </span>
              </div>
              {it.auto != null && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: '#7A8394',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    차이
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      color:
                        diff == null
                          ? '#C2C9D4'
                          : Math.abs(diff) >= 15
                            ? '#C42B2B'
                            : Math.abs(diff) >= 7
                              ? '#B5740A'
                              : '#5CA627',
                    }}
                  >
                    {diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff}`}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <div onClick={() => step(-1)} style={stepStyle(locked)}>
                  −5
                </div>
                <div onClick={() => step(1)} style={stepStyle(locked)}>
                  +5
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {[0, 25, 50, 75, 100].map((v) => (
              <div
                key={v}
                onClick={() => {
                  if (!locked)
                    k.upd(it.id, (x) => k.mark(Object.assign(x, { val: v })));
                }}
                style={quickStyle(it.val === v, locked)}
              >
                {v}%
              </div>
            ))}
          </div>
        </>
      )}

      {it.kind === 'count' && (
        <>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
            <div onClick={() => k.openPad(it)} style={valueBoxStyle}>
              <span style={valueStyle}>{it.cnt == null ? '—' : it.cnt}</span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#8A93A6',
                  marginLeft: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                / {it.total}건 설치
              </span>
            </div>
            <div style={sideCol}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    color: '#7A8394',
                    whiteSpace: 'nowrap',
                  }}
                >
                  직전 인식
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    color: it.auto == null ? '#C2C9D4' : '#5C6678',
                  }}
                >
                  {it.auto == null ? '없음' : `${it.auto}건 (${it.autoAt})`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <div onClick={() => step(-1)} style={stepStyle(locked)}>
                  −1
                </div>
                <div onClick={() => step(1)} style={stepStyle(locked)}>
                  +1
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            {(
              [
                ['없음', 0],
                ['절반', Math.round((it.total ?? 0) / 2)],
                [`전체 ${it.total}`, it.total ?? 0],
              ] as [string, number][]
            ).map((p) => (
              <div
                key={p[0]}
                onClick={() => {
                  if (!locked)
                    k.upd(it.id, (x) =>
                      k.mark(Object.assign(x, { cnt: p[1] })),
                    );
                }}
                style={{
                  ...quickStyle(it.cnt === p[1], locked),
                  fontSize: 16,
                }}
              >
                {p[0]}
              </div>
            ))}
          </div>
        </>
      )}

      {it.kind === 'event' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            onClick={() => {
              if (!locked)
                k.upd(it.id, (x) =>
                  k.mark(
                    Object.assign(
                      x,
                      x.done === true
                        ? { done: null, doneAt: null }
                        : { done: true, doneAt: '08-11' },
                    ),
                  ),
                );
            }}
            style={{
              flex: 1,
              height: 58,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 7,
              fontSize: 17,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              ...(locked
                ? {
                    cursor: 'default',
                    background: '#F4F6F2',
                    color: '#A9B0BC',
                    border: '1px solid #E4E9DE',
                  }
                : it.done === true
                  ? {
                      cursor: 'pointer',
                      background: '#5CA627',
                      color: '#fff',
                      border: '2px solid #5CA627',
                    }
                  : {
                      cursor: 'pointer',
                      background: '#fff',
                      color: '#2F8F5B',
                      border: '2px dashed #9CC98A',
                    }),
            }}
          >
            {it.done === true ? `✓ 완료 · ${it.doneAt}` : '완료로 기록'}
          </div>
          {it.done === true && !locked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{ fontSize: 13, color: '#8A93A6', whiteSpace: 'nowrap' }}
              >
                완료일
              </span>
              {KEYIN_DATES.map((dd) => (
                <div
                  key={dd[1]}
                  onClick={() =>
                    k.upd(it.id, (x) =>
                      k.mark(Object.assign(x, { doneAt: dd[1] })),
                    )
                  }
                  style={{
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    borderRadius: 22,
                    fontSize: 14,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    ...(it.doneAt === dd[1]
                      ? {
                          background: '#3C4859',
                          color: '#fff',
                          border: '1px solid #3C4859',
                        }
                      : {
                          background: '#F7F5EE',
                          color: '#5C6678',
                          border: '1px solid #DDD4BE',
                        }),
                  }}
                >
                  {dd[0]}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {locked && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingTop: 9,
            borderTop: '1px dashed #DCE6D2',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: '#2F8F5B',
              whiteSpace: 'nowrap',
            }}
          >
            확정됨 · 수정하려면 관리자 문의
          </span>
        </div>
      )}

      {needMemo && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            paddingTop: 9,
            borderTop: '1px dashed #E2DCCA',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              color: missMemo ? '#C42B2B' : '#5CA627',
            }}
          >
            {missMemo
              ? `직전 자동값과 ${Math.abs(diff as number)}%p 차이 — 사유를 선택하세요`
              : `사유: ${it.memo}`}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {KEYIN_REASONS.map((r) => (
              <div
                key={r}
                onClick={() => {
                  if (!locked)
                    k.upd(it.id, (x) => {
                      x.memo = x.memo === r ? '' : r;
                      return x;
                    });
                }}
                style={chipStyle(it.memo === r, locked)}
              >
                {r}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function KeyinPage() {
  const k = useKeyin();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        overflow: 'hidden',
        background: '#EDEAE0',
        color: '#1E2733',
        fontFamily: 'Pretendard, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* ===== HEADER ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 'none',
          height: 60,
          padding: '0 18px',
          background: '#EE7A00',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            실적 입력
          </span>
          <span
            onClick={() => k.setShipOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 40,
              padding: '0 16px',
              background: 'rgba(255,255,255,.18)',
              border: '1px solid rgba(255,255,255,.45)',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 800,
              color: '#fff',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {k.ship}호 ▾
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#fff',
              background: 'rgba(0,0,0,.14)',
              padding: '6px 13px',
              borderRadius: 15,
              whiteSpace: 'nowrap',
            }}
          >
            남은 입력 {k.totalWait}건
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{ fontSize: 14, color: '#FDE9D2', whiteSpace: 'nowrap' }}
          >
            가공1부 · 김현수
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            {k.clock}
          </span>
        </div>
      </div>

      {/* ===== BLOCK TABS ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 'none',
          padding: '10px 14px',
          background: '#F7F4EC',
          borderBottom: '1px solid #DDD4BE',
          overflowX: 'auto',
        }}
      >
        <span
          style={{
            flex: 'none',
            fontSize: 13,
            fontWeight: 700,
            color: '#8A7A5C',
            whiteSpace: 'nowrap',
            paddingRight: 4,
          }}
        >
          담당 블록
          <br />
          (미입력 표시)
        </span>
        {Object.keys(k.data).map((no) => {
          const arr = k.data[no];
          const w = k.waitOf(arr);
          const sel = no === k.blk;
          const clear = arr.length > 0 && w === 0;
          return (
            <div
              key={no}
              onClick={() => k.setBlk(no)}
              style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                height: 52,
                padding: '0 16px',
                borderRadius: 8,
                cursor: 'pointer',
                ...(sel
                  ? {
                      background: '#EE7A00',
                      color: '#fff',
                      boxShadow: '0 2px 6px rgba(238,122,0,.35)',
                    }
                  : {
                      background: '#fff',
                      color: '#1E2733',
                      border: '1px solid #E2DCCA',
                    }),
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: -0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                {no}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  padding: '4px 11px',
                  borderRadius: 13,
                  whiteSpace: 'nowrap',
                  ...(sel
                    ? { background: 'rgba(255,255,255,.25)', color: '#fff' }
                    : arr.length === 0
                      ? { background: '#ECEEF1', color: '#8A93A6' }
                      : clear
                        ? { background: '#E9F4EE', color: '#2F8F5B' }
                        : { background: '#FBE8E8', color: '#C42B2B' }),
                }}
              >
                {arr.length === 0 ? '없음' : clear ? '완료' : `${w}건`}
              </span>
            </div>
          );
        })}
      </div>

      {/* ===== CARDS ===== */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))',
          gap: 14,
          alignContent: 'start',
        }}
      >
        {k.list.map((it) => (
          <KeyinCard key={it.id} it={it} k={k} />
        ))}
        {k.list.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '56px 0',
              background: '#fff',
              border: '1px solid #D3CBB4',
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 19, fontWeight: 800, color: '#2F8F5B' }}>
              이 블록은 입력할 항목이 없습니다
            </span>
            <span style={{ fontSize: 15, color: '#8A93A6' }}>
              위에서 다른 블록을 선택하세요
            </span>
          </div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flex: 'none',
          minHeight: 78,
          padding: '10px 18px',
          background: '#fff',
          borderTop: '1px solid #D3CBB4',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: MSG_TONE_COLOR[k.msgTone],
          }}
        >
          {k.msg}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginLeft: 'auto',
          }}
        >
          <div
            onClick={k.doDraft}
            style={{
              flex: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              height: 54,
              padding: '0 26px',
              background: '#fff',
              border: '2px solid #A8B8CC',
              borderRadius: 7,
              fontSize: 17,
              fontWeight: 800,
              color: '#2E5E96',
              cursor: 'pointer',
            }}
          >
            임시저장
          </div>
          <div
            onMouseDown={k.holdStart}
            onMouseUp={k.holdEnd}
            onMouseLeave={k.holdEnd}
            onTouchStart={k.holdStart}
            onTouchEnd={k.holdEnd}
            style={{
              flex: 'none',
              whiteSpace: 'nowrap',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 54,
              padding: '0 40px',
              borderRadius: 7,
              fontSize: 18,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              WebkitTouchCallout: 'none',
              background: `linear-gradient(90deg,#2F8F5B ${k.holdPct}%,#5CA627 ${k.holdPct}%)`,
              border: `2px solid ${k.holdPct > 0 ? '#2F8F5B' : '#5CA627'}`,
            }}
          >
            {k.holdPct > 0
              ? '계속 누르고 계세요…'
              : `제출${k.readyN ? ` (${k.readyN}건)` : ''}`}
          </div>
        </div>
      </div>

      {/* ===== SHIP MODAL ===== */}
      {k.shipOpen && (
        <Modal
          onClose={() => k.setShipOpen(false)}
          title="호선 선택"
          width={360}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 14,
            }}
          >
            {KEYIN_SHIPS.map((no) => {
              const sel = no === k.ship;
              return (
                <div
                  key={no}
                  onClick={() => k.setShip(no)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 60,
                    padding: '0 18px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    ...(sel
                      ? { background: '#EE7A00', color: '#fff' }
                      : {
                          background: '#F9F7F1',
                          color: '#1E2733',
                          border: '1px solid #E7E1D0',
                        }),
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: -0.5,
                    }}
                  >
                    {no}호
                  </span>
                  {sel && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        padding: '4px 11px',
                        borderRadius: 12,
                        whiteSpace: 'nowrap',
                        background: 'rgba(255,255,255,.25)',
                        color: '#fff',
                      }}
                    >
                      현재
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ===== NUMPAD MODAL ===== */}
      {k.padItem && (
        <Modal
          onClose={k.closePad}
          title={`${k.blk}블록 · ${k.padItem.proc} ${k.padItem.ev}`}
          width={396}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'flex-end',
              gap: 4,
              padding: '14px 22px',
              background: '#FEFAF3',
              borderBottom: '1px solid #EFE7D4',
            }}
          >
            <span
              style={{
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: -2,
                color: k.padVal === '' ? '#C9CFD8' : '#1E2733',
              }}
            >
              {k.padVal === '' ? '0' : k.padVal}
            </span>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#8A93A6' }}>
              {k.padItem.kind === 'count' ? '건' : '%'}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              padding: 14,
            }}
          >
            {PAD_KEYS.map((key) => (
              <div
                key={key}
                onClick={() => k.padPress(key)}
                style={{
                  height: 64,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  fontSize: 24,
                  fontWeight: 800,
                  cursor: 'pointer',
                  ...(key === 'C' || key === '←'
                    ? {
                        background: '#F1EFE7',
                        color: '#8A5A1A',
                        border: '1px solid #DDD4BE',
                      }
                    : {
                        background: '#fff',
                        color: '#1E2733',
                        border: '1px solid #DDD4BE',
                      }),
                }}
              >
                {key}
              </div>
            ))}
          </div>
          <div style={{ padding: '0 14px 16px' }}>
            <div
              onClick={k.padConfirm}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 60,
                background: '#EE7A00',
                borderRadius: 8,
                fontSize: 19,
                fontWeight: 800,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              확인
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
