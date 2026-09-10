import type { CSSProperties } from 'react';
import type { KpiVM, MainVM } from '../model/use-gathering';
import { useGathering } from '../model/use-gathering';
import { BlockDashboard } from './block-dashboard';
import { BlockDropdown } from './block-dropdown';
import { BlockList } from './block-list';
import { GatherView } from './gather-view';
import { LoginScreen } from './login-screen';

function tabStyle(on: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px',
    fontSize: 12.5,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ...(on
      ? {
          color: '#B55A00',
          borderBottom: '3px solid #EE7A00',
          background: '#FDF8ED',
        }
      : { color: '#7A8699', borderBottom: '3px solid transparent' }),
  };
}

function KpiCell({ k }: { k: KpiVM }) {
  return (
    <div
      onClick={k.onClick ?? undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: '10px 14px',
        background: '#fff',
        border: '1px solid #D3CBB4',
        borderRadius: 3,
        ...(k.warnColor
          ? { borderLeft: `3px solid ${k.warnColor}`, cursor: 'pointer' }
          : { cursor: 'default' }),
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: '#7A8699',
          whiteSpace: 'nowrap',
        }}
      >
        {k.label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: k.warnColor ?? '#23344C',
          }}
        >
          {k.val}
        </span>
        <span style={{ fontSize: 11, color: '#909AAC', whiteSpace: 'nowrap' }}>
          {k.unit}
        </span>
      </div>
      <span
        style={{
          fontSize: 10,
          color: k.warnColor ?? '#909AAC',
          whiteSpace: 'nowrap',
        }}
      >
        {k.sub}
      </span>
    </div>
  );
}

/** 현황 대시보드 탭 — KPI + 블록 목록(마스터) ↔ 블록 대시보드(디테일) */
function DashView({ m }: { m: MainVM }) {
  const d = m.dash;
  if (!d) return null;
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
      {/* 권역 요약 KPI (선택 블록 전체 기준) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5,1fr)',
          gap: 8,
          flex: 'none',
        }}
      >
        {d.kpis.map((k) => (
          <KpiCell key={k.label} k={k} />
        ))}
      </div>

      {d.list && <BlockList list={d.list} scopeName={m.scopeName} />}

      {d.nav && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <div
            onClick={d.nav.backToList}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 12px',
              background: '#fff',
              border: '1px solid #C9B98E',
              borderRadius: 2,
              fontSize: 11.5,
              fontWeight: 800,
              color: '#8A5A1A',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ← 블록 목록
          </div>
          {d.nav.hasNav && (
            <>
              <span
                style={{ fontSize: 10.5, color: '#909AAC', whiteSpace: 'nowrap' }}
              >
                {d.nav.pos} / {d.nav.total}
              </span>
              <div
                onClick={d.nav.prev}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 26,
                  padding: '0 10px',
                  background: '#fff',
                  border: '1px solid #D3CBB4',
                  borderRadius: 2,
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#5C6678',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ◀ 이전
              </div>
              <div
                onClick={d.nav.next}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 26,
                  padding: '0 10px',
                  background: '#fff',
                  border: '1px solid #D3CBB4',
                  borderRadius: 2,
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#5C6678',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                다음 ▶
              </div>
            </>
          )}
        </div>
      )}

      {d.detail && (
        <BlockDashboard
          d={d.detail}
          scopeName={m.scopeName}
          scopeSrc={m.scopeSrc}
        />
      )}
    </div>
  );
}

function MainView({ m }: { m: MainVM }) {
  return (
    <>
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
          <span style={{ fontSize: 12, color: '#FFDFBC', whiteSpace: 'nowrap' }}>
            / {m.scopeName} 권역 현황
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#EE7A00',
              background: '#fff',
              padding: '2px 9px',
              borderRadius: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {m.scopeName} 권역
          </span>
          <span style={{ fontSize: 11.5, color: '#FFE9CF', whiteSpace: 'nowrap' }}>
            {m.userLabel}
          </span>
          <div
            onClick={m.logout}
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#fff',
              border: '1px solid rgba(255,255,255,.55)',
              padding: '2px 9px',
              borderRadius: 2,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            로그아웃
          </div>
        </div>
      </div>

      {/* ===== TAB + FILTER BAR ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          flexWrap: 'wrap',
          rowGap: 6,
          padding: '0 14px',
          background: '#FBF6EA',
          borderBottom: '1px solid #E2D8C2',
          flex: 'none',
          minHeight: 46,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            alignSelf: 'stretch',
            gap: 2,
            marginRight: 18,
          }}
        >
          <div onClick={() => m.setTab('dash')} style={tabStyle(m.tab === 'dash')}>
            {m.scopeName} 현황 대시보드
          </div>
          <div
            onClick={() => m.setTab('gather')}
            style={tabStyle(m.tab === 'gather')}
          >
            수집 데이터 조회
          </div>
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
            호선 번호 <b style={{ color: '#C42B2B' }}>*</b>
          </span>
          <select
            value={m.fShip}
            onChange={(e) => m.setFShip(e.target.value)}
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
            <option value="">— 담당 호선 선택 —</option>
            {m.shipOpts.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <BlockDropdown dd={m.blkDd} scopeName={m.scopeName} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
          }}
        >
          <div
            onClick={m.doSearch}
            style={{
              flex: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              height: 27,
              padding: '0 18px',
              background: '#EE7A00',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            조회
          </div>
          <div
            onClick={m.doReset}
            style={{
              flex: 'none',
              whiteSpace: 'nowrap',
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
          </div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      {!m.searched && (
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
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#7A8699' }}>
            담당 호선과 블록을 선택한 후 [조회]를 클릭하세요
          </span>
          <span style={{ fontSize: 11.5, color: '#909AAC' }}>{m.scopeHint}</span>
        </div>
      )}
      {m.searched && m.tab === 'dash' && <DashView m={m} />}
      {m.searched && m.tab === 'gather' && m.gather && (
        <GatherView g={m.gather} scopeName={m.scopeName} />
      )}
    </>
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
        overflow: 'hidden',
        background: '#EDEAE0',
        fontFamily: "Pretendard, '-apple-system', sans-serif",
        color: '#1E2733',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {g.login && <LoginScreen l={g.login} />}
      {g.main && <MainView m={g.main} />}
    </div>
  );
}
