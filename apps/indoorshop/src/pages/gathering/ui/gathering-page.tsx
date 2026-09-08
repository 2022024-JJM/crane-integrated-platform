import type { CSSProperties } from 'react';
import { SHIP_OPTIONS } from '../model/mock-data';
import type { GatheringVM } from '../model/use-gathering';
import { useGathering } from '../model/use-gathering';
import { BlockDashboard } from './block-dashboard';
import { BlockDropdown } from './block-dropdown';
import { BlockList } from './block-list';
import { GatherView } from './gather-view';

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

function EmptyPrompt({ title, sub }: { title: string; sub: string }) {
  return (
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
        {title}
      </span>
      <span style={{ fontSize: 11.5, color: '#909AAC' }}>{sub}</span>
    </div>
  );
}

/** 현황 대시보드 탭 — 블록 목록(마스터) ↔ 블록 대시보드(디테일) */
function DashView({ g }: { g: GatheringVM }) {
  const d = g.dash;
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
      {d.prompt && (
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
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#7A8699' }}>
            블록을 선택한 후 [조회]를 클릭하세요
          </span>
          <span style={{ fontSize: 11.5, color: '#909AAC' }}>
            복수 블록을 조회하면 탭으로 나란히 비교할 수 있습니다
          </span>
        </div>
      )}

      {d.list && <BlockList list={d.list} />}

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
                style={{
                  fontSize: 10.5,
                  color: '#909AAC',
                  whiteSpace: 'nowrap',
                }}
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

      {d.detail && <BlockDashboard d={d.detail} />}
    </div>
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
            / 통합 현황 · 수집 데이터 조회
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 11.5, color: '#FFE9CF' }}>
            사용자: <b style={{ color: '#fff', fontWeight: 600 }}>생산계획팀</b>
          </span>
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
          <div onClick={() => g.setTab('dash')} style={tabStyle(g.tab === 'dash')}>
            현황 대시보드
          </div>
          <div
            onClick={() => g.setTab('gather')}
            style={tabStyle(g.tab === 'gather')}
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
              minWidth: 140,
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

        <BlockDropdown dd={g.blkDd} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 'auto',
          }}
        >
          <div
            onClick={g.doSearch}
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
            onClick={g.doReset}
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
      {!g.searched && (
        <EmptyPrompt
          title="호선 번호와 블록 No를 입력한 후 [조회]를 클릭하세요"
          sub="현황 대시보드 — 블록 공정률·WO 실적 / 수집 데이터 조회 — 수집 이벤트 로우데이터"
        />
      )}
      {g.searched && g.tab === 'dash' && <DashView g={g} />}
      {g.searched && g.tab === 'gather' && g.gather && <GatherView g={g.gather} />}
    </div>
  );
}
