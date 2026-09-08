import type { CSSProperties } from 'react';
import type { MainVM } from '../model/use-keyin';
import { useKeyin } from '../model/use-keyin';
import { ActivityCard } from './activity-card';
import { LoginScreen } from './login-screen';
import { Modal } from './modal';
import { WoListModal } from './wo-list-modal';

function ShipModal({ m }: { m: MainVM }) {
  return (
    <Modal onClose={m.closeShip} title="담당 호선 선택" width={360}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 14,
        }}
      >
        {m.shipOpts.map((s) => (
          <div
            key={s.no}
            onClick={s.select}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 60,
              padding: '0 18px',
              borderRadius: 8,
              cursor: 'pointer',
              ...(s.selected
                ? { background: '#EE7A00', color: '#fff' }
                : {
                    background: '#F7F5EE',
                    color: '#1E2733',
                    border: '1px solid #E2DCCA',
                  }),
            }}
          >
            <span
              style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}
            >
              {s.no}호
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                padding: '4px 11px',
                borderRadius: 12,
                whiteSpace: 'nowrap',
                ...(s.selected
                  ? { background: 'rgba(255,255,255,.25)', color: '#fff' }
                  : { background: '#ECEEF1', color: '#8A93A6' }),
              }}
            >
              {s.selected ? '선택됨' : '담당'}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function PadModal({ m }: { m: MainVM }) {
  const pad = m.pad;
  if (!pad) return null;
  return (
    <Modal onClose={pad.close} title="완성도 수정" width={396}>
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
            fontSize: 46,
            fontWeight: 800,
            letterSpacing: '-1.5px',
            color: pad.empty ? '#C9CFD8' : '#1E2733',
          }}
        >
          {pad.display}
        </span>
        <span style={{ fontSize: 24, fontWeight: 800, color: '#8A93A6' }}>
          %
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
        {pad.keys.map((k) => (
          <div
            key={k.label}
            onClick={k.press}
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              fontSize: 24,
              fontWeight: 800,
              cursor: 'pointer',
              ...(k.isFn
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
            {k.label}
          </div>
        ))}
      </div>
      <div style={{ padding: '0 14px 16px' }}>
        <div
          onClick={pad.confirm}
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
  );
}

/** 좌측 블록 패널 — 검색 + 미확인/완료 탭 + 타일 그리드 */
function BlockPanel({ m }: { m: MainVM }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 'none',
        width: 316,
        background: '#F7F4EC',
        borderRight: '1px solid #DDD4BE',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 'none',
          padding: '12px 12px 10px',
          borderBottom: '1px solid #E5DCC6',
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: '#8A7A5C',
            whiteSpace: 'nowrap',
          }}
        >
          담당 블록 {m.blkTotal}개
        </span>
        <input
          value={m.blkQuery}
          onChange={(e) => m.setBlkQuery(e.target.value)}
          placeholder="블록 번호 검색"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minWidth: 0,
            height: 46,
            border: '1px solid #C9B98E',
            borderRadius: 7,
            padding: '0 12px',
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'inherit',
            color: '#1E2733',
            outline: 'none',
            background: '#fff',
          }}
        />
      </div>

      <div style={{ display: 'flex', flex: 'none', gap: 6, padding: '10px 12px 0' }}>
        {m.blkTabs.map((t) => {
          const accent = t.key === 'wait' ? '#C42B2B' : '#2F8F5B';
          const border = t.key === 'wait' ? '#E8B4B4' : '#BFDECB';
          return (
            <div
              key={t.key}
              onClick={t.select}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 44,
                borderRadius: 7,
                fontSize: 14.5,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                ...(t.active
                  ? {
                      background: accent,
                      color: '#fff',
                      border: `1px solid ${accent}`,
                    }
                  : {
                      background: '#fff',
                      color: accent,
                      border: `1px solid ${border}`,
                    }),
              }}
            >
              {t.label}
            </div>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '10px 12px 12px',
        }}
      >
        {m.tiles.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 7,
            }}
          >
            {m.tiles.map((b) => (
              <div
                key={b.no}
                onClick={b.select}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 52,
                  padding: '0 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  ...(b.selected
                    ? {
                        background: '#EE7A00',
                        color: '#fff',
                        boxShadow: '0 2px 6px rgba(238,122,0,.35)',
                      }
                    : b.hasWait
                      ? {
                          background: '#fff',
                          color: '#1E2733',
                          border: '1px solid #E8C2C2',
                        }
                      : {
                          background: '#F3F6F0',
                          color: '#5C6678',
                          border: '1px solid #D9E5D4',
                        }),
                }}
              >
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.no}
                </span>
                {b.dirty && (
                  <span
                    title="미제출 수정 있음"
                    style={{
                      position: 'absolute',
                      top: -5,
                      right: -5,
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      background: '#C42B2B',
                      border: '2px solid #F7F4EC',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {m.blkEmptyMsg && (
          <span
            style={{
              display: 'block',
              fontSize: 13.5,
              color: '#8A93A6',
              padding: '14px 6px',
              textAlign: 'center',
            }}
          >
            {m.blkEmptyMsg}
          </span>
        )}
      </div>
    </div>
  );
}

const footerNavBtn: CSSProperties = {
  flex: 'none',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  height: 54,
  padding: '0 20px',
  background: '#fff',
  borderRadius: 7,
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
};

function MainScreen({ m }: { m: MainVM }) {
  return (
    <>
      {/* ===== 헤더 ===== */}
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
            onClick={m.openShip}
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
            {m.ship}호 ▾
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
            미확인 {m.totalWait}건
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{ fontSize: 14, color: '#FDE9D2', whiteSpace: 'nowrap' }}
          >
            {m.userLabel}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            {m.clock}
          </span>
          <div
            onClick={m.doLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 38,
              padding: '0 14px',
              background: 'rgba(0,0,0,.16)',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            로그아웃
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <BlockPanel m={m} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* 선택 블록 헤더 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 'none',
              height: 50,
              boxSizing: 'border-box',
              padding: '0 16px',
              background: '#FBF9F2',
              borderBottom: '1px solid #E5DCC6',
            }}
          >
            <span
              style={{
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: '-0.4px',
                color: '#28354A',
                whiteSpace: 'nowrap',
              }}
            >
              블록 {m.blk}
            </span>
            <span
              style={{ fontSize: 13.5, color: '#8A93A6', whiteSpace: 'nowrap' }}
            >
              {m.blkSub}
            </span>
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flex: 'none',
              }}
            >
              {m.lastSubStamp && (
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#8A93A6',
                    whiteSpace: 'nowrap',
                  }}
                >
                  마지막 제출 {m.lastSubStamp}
                </span>
              )}
              {m.hasRevert && (
                <div
                  onClick={m.doRevert}
                  style={{
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    height: 36,
                    boxSizing: 'border-box',
                    padding: '0 14px',
                    background: '#fff',
                    border: '2px solid #E8C2C2',
                    borderRadius: 7,
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#C42B2B',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ↺ 수정 취소
                </div>
              )}
            </div>
          </div>

          {/* 카드 그리드 */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(440px,1fr))',
              gap: 14,
              alignContent: 'start',
            }}
          >
            {m.cards.map((c) => (
              <ActivityCard key={c.id} c={c} />
            ))}
            {m.allDone && (
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
                <span
                  style={{ fontSize: 19, fontWeight: 800, color: '#2F8F5B' }}
                >
                  이 블록은 입력할 액티비티가 없습니다
                </span>
                <span style={{ fontSize: 15, color: '#8A93A6' }}>
                  왼쪽 목록에서 다른 블록을 선택하세요
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 푸터 ===== */}
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
            whiteSpace: 'nowrap',
            color: m.msgOk ? '#2F8F5B' : '#7A8699',
          }}
        >
          {m.msg}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginLeft: 'auto',
          }}
        >
          {m.prevNo && (
            <div
              onClick={m.goPrev}
              style={{
                ...footerNavBtn,
                border: '2px solid #D8CFB8',
                color: '#8A5A1A',
              }}
            >
              ← 이전 블록 <b>{m.prevNo}</b>
            </div>
          )}
          {m.nextWaitNo && (
            <div
              onClick={m.goNextWait}
              style={{
                ...footerNavBtn,
                border: '2px solid #E8B4B4',
                color: '#C42B2B',
              }}
            >
              다음 미확인 블록 <b>{m.nextWaitNo}</b> →
            </div>
          )}
          <div
            onClick={m.doSubmit}
            style={{
              flex: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              height: 54,
              padding: '0 34px',
              borderRadius: 7,
              fontSize: 17,
              fontWeight: 800,
              ...(m.readyN > 0
                ? { background: '#EE7A00', color: '#fff', cursor: 'pointer' }
                : {
                    background: '#F1EFE7',
                    color: '#B0A88F',
                    cursor: 'default',
                  }),
            }}
          >
            {m.submitLabel}
          </div>
        </div>
      </div>

      {/* ===== 모달 ===== */}
      {m.shipOpen && <ShipModal m={m} />}
      {m.wo && <WoListModal wo={m.wo} />}
      {m.pad && <PadModal m={m} />}
    </>
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
      {k.main ? <MainScreen m={k.main} /> : <LoginScreen l={k.login} />}
    </div>
  );
}
