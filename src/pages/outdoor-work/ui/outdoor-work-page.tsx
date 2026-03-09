import {
  Activity,
  AlertTriangle,
  Clock3,
  FileText,
  Gauge,
  Info,
  Menu,
  Monitor,
  PencilLine,
  Search,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { OutdoorWork3dViewHandle } from './outdoor-work-3d-view';
import { OutdoorWork3dView } from './outdoor-work-3d-view';
import './outdoor-work-page.css';

type OutdoorMenuKey =
  | 'realtime-monitoring'
  | 'operation-info'
  | 'operation-status'
  | 'event-log'
  | 'playback'
  | 'screen-editor';

const TEXT = {
  back: '대시보드',
  sidebarTitle: '2도크',
  viewerTitle: '3D CRANE VIEW',
  viewerHint: '스크롤 = 줌, 드래그 = 이동',
  topTag: '실외 작업 모니터링',
  topDescription: '야드 · 항만 실외 3D 모니터링',
  live: '실시간 연결됨',
  statsTitle: '알람 통계',
  alarmTitle: '알람 내역',
} as const;

export function OutdoorWorkPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] =
    useState<OutdoorMenuKey>('realtime-monitoring');
  const [leftPanelWidth, setLeftPanelWidth] = useState(156);
  const [rightPanelWidth, setRightPanelWidth] = useState(248);
  const [viewerHeight, setViewerHeight] = useState(0);
  const [draggingPanel, setDraggingPanel] = useState<
    'left' | 'right' | 'bottom' | null
  >(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const viewerPanelRef = useRef<HTMLElement | null>(null);
  const viewerRef = useRef<OutdoorWork3dViewHandle | null>(null);
  const menuItems = [
    { key: 'realtime-monitoring', label: '실시간 감시', icon: Monitor },
    { key: 'operation-info', label: '운행 정보', icon: Info },
    { key: 'operation-status', label: '운행 현황', icon: Activity },
    { key: 'event-log', label: '이벤트 로그', icon: FileText },
    { key: 'playback', label: '다시 보기', icon: Clock3 },
    { key: 'screen-editor', label: '화면 편집', icon: PencilLine },
  ];
  const statCards = [
    { label: '# Alarms', value: '4', tone: 'danger' },
    { label: 'Elapsed Time', value: '4 min', tone: 'neutral' },
    { label: '# Occurrence', value: '1', tone: 'ok' },
    { label: 'Abnormal', value: '4', tone: 'danger' },
    { label: 'Danger', value: '0', tone: 'danger' },
    { label: 'Normal', value: '0', tone: 'ok' },
  ];
  const alarmRows = [
    {
      no: '132',
      severity: 'Warning',
      occurrenceTime: '2019-01-23 15:16',
      target: 'TC-m',
      count: '4',
    },
    {
      no: '131',
      severity: 'Critical',
      occurrenceTime: '2019-01-23 15:10',
      target: 'GC-4',
      count: '2',
    },
    {
      no: '130',
      severity: 'Critical',
      occurrenceTime: '2019-01-23 15:10',
      target: 'TTC-26',
      count: '1',
    },
    {
      no: '129',
      severity: 'Critical',
      occurrenceTime: '2019-01-23 15:11',
      target: 'TTC-12',
      count: '3',
    },
    {
      no: '128',
      severity: 'Critical',
      occurrenceTime: '2019-01-23 15:06',
      target: 'TC-57',
      count: '2',
    },
    {
      no: '127',
      severity: 'Critical',
      occurrenceTime: '2019-01-23 15:03',
      target: 'OC-05',
      count: '1 minute',
    },
  ];
  const craneRows = [
    ['GC-4', true, true, false, false, false, false, '74.3', '', '71.3', '67.8', '118.4', '', '', '239', '24.4'],
    ['TTC-26', true, true, false, false, false, false, '', '85', '52', '', '', '85', '', '696.6', '6.6'],
    ['TTC-20', true, true, false, false, false, false, '', '89', '49', '', '', '89', '', '604.8', '0'],
    ['TTC-13', true, true, true, false, false, false, '', '75.5', '62', '', '16.8', '', '', '635.7', '-0.6'],
    ['TTC-5', true, true, false, false, false, false, '', '90.8', '61', '', '34.1', '', '', '307.7', '-0.1'],
    ['TTC-12', true, true, false, false, false, false, '', '265.6', '55', '', '85.3', '', '', '806.6', '0'],
    ['TTC-30', true, true, false, false, false, false, '', '352.9', '39.1', '', '53.2', '', '', '528.1', '0'],
  ];
  const operationInfoCards = [
    { label: '도크명', value: '2도크 / Busan New Port' },
    { label: '활성 장비', value: 'Gantry 1, TC 6, TTC 5' },
    { label: '현재 작업', value: '컨테이너 이송 / 선석 적재' },
    { label: '작업 구간', value: 'Berth A-03 ~ Yard B-12' },
  ];
  const operationInfoRows = [
    ['GC-4', 'Gantry Crane', 'Berth A-03', '정상', '컨테이너 양하', '정면'],
    ['TTC-26', 'Transfer Crane', 'Yard B-12', '정상', '블록 적재', '북동'],
    ['TTC-20', 'Transfer Crane', 'Yard B-07', '점검', '대기', '서측'],
    ['TC-57', 'Trolley Crane', 'Berth A-05', '주의', '선적 대기', '남동'],
  ];
  const operationStatusCards = [
    { label: '총 운행 장비', value: '12', tone: 'neutral' },
    { label: '정상 장비', value: '9', tone: 'ok' },
    { label: '주의 장비', value: '2', tone: 'danger' },
    { label: '점검 장비', value: '1', tone: 'danger' },
  ];
  const operationStatusRows = [
    ['09:10', 'GC-4', '호이스트 상승', '정상', '상단 프레임'],
    ['09:12', 'TTC-26', '트롤리 이동', '정상', '야드 라인 3'],
    ['09:14', 'TC-57', '회전 속도 편차', '주의', '버스 바 인근'],
    ['09:18', 'TTC-20', '점검 모드 전환', '점검', '블록 B-07'],
    ['09:20', 'GC-4', '컨테이너 인계 완료', '정상', '선석 A-03'],
  ];

  const viewerSubtitleMap: Record<OutdoorMenuKey, string> = {
    'realtime-monitoring': '스크롤 · 드래그 이동',
    'operation-info': '운행 정보 · 장비 위치 · 작업 구간',
    'operation-status': '운행 현황 · 장비 상태 · 이벤트 흐름',
    'event-log': '이벤트 로그 · 최근 발생 이력',
    playback: '다시 보기 · 과거 시점 재생',
    'screen-editor': '화면 편집 · 배치 및 패널 구성',
  };

  const rightPanelTitleMap: Record<OutdoorMenuKey, string> = {
    'realtime-monitoring': TEXT.statsTitle,
    'operation-info': '운행 정보',
    'operation-status': '운행 현황',
    'event-log': '이벤트 로그',
    playback: '다시 보기',
    'screen-editor': '화면 편집',
  };

  const lowerPanelTitleMap: Record<OutdoorMenuKey, string> = {
    'realtime-monitoring': '실시간 장비 상태 테이블',
    'operation-info': '장비 운행 정보',
    'operation-status': '운행 상태 이력',
    'event-log': '이벤트 로그 목록',
    playback: '재생 구간 요약',
    'screen-editor': '패널 배치 정보',
  };

  useEffect(() => {
    if (!draggingPanel) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const layoutElement = layoutRef.current;

      if (!layoutElement) {
        return;
      }

      const rect = layoutElement.getBoundingClientRect();

      if (draggingPanel === 'left' && !isSidebarCollapsed) {
        const nextWidth = Math.min(Math.max(event.clientX - rect.left, 120), 320);
        setLeftPanelWidth(nextWidth);
      }

      if (draggingPanel === 'right') {
        const nextWidth = Math.min(Math.max(rect.right - event.clientX, 220), 420);
        setRightPanelWidth(nextWidth);
      }

      if (draggingPanel === 'bottom') {
        const viewerPanelElement = viewerPanelRef.current;

        if (!viewerPanelElement) {
          return;
        }

        const viewerRect = viewerPanelElement.getBoundingClientRect();
        const toolbarHeight = 42;
        const nextHeight = Math.min(
          Math.max(event.clientY - viewerRect.top - toolbarHeight, 260),
          viewerRect.height - 160,
        );

        setViewerHeight(nextHeight);
      }
    };

    const handlePointerUp = () => {
      setDraggingPanel(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [draggingPanel, isSidebarCollapsed]);

  useEffect(() => {
    const viewerPanelElement = viewerPanelRef.current;

    if (!viewerPanelElement || viewerHeight > 0) {
      return;
    }

    const updateDefaultViewerHeight = () => {
      const panelHeight = viewerPanelElement.getBoundingClientRect().height;
      const nextHeight = Math.max(panelHeight - 240, 320);
      setViewerHeight(nextHeight);
    };

    updateDefaultViewerHeight();
    window.addEventListener('resize', updateDefaultViewerHeight);

    return () => {
      window.removeEventListener('resize', updateDefaultViewerHeight);
    };
  }, [viewerHeight]);

  const renderBottomPanel = () => {
    if (activeMenu === 'operation-info') {
      return (
        <table className="ow-monitor__table">
          <thead>
            <tr>
              <th>장비</th>
              <th>유형</th>
              <th>위치</th>
              <th>상태</th>
              <th>작업</th>
              <th>방향</th>
            </tr>
          </thead>
          <tbody>
            {operationInfoRows.map((row) => (
              <tr key={row[0]}>
                <td className="is-name">{row[0]}</td>
                <td>{row[1]}</td>
                <td>{row[2]}</td>
                <td>{row[3]}</td>
                <td>{row[4]}</td>
                <td className="is-accent">{row[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeMenu === 'operation-status') {
      return (
        <table className="ow-monitor__table">
          <thead>
            <tr>
              <th>시각</th>
              <th>장비</th>
              <th>상태 변화</th>
              <th>레벨</th>
              <th>위치</th>
            </tr>
          </thead>
          <tbody>
            {operationStatusRows.map((row) => (
              <tr key={`${row[0]}-${row[1]}`}>
                <td>{row[0]}</td>
                <td className="is-name">{row[1]}</td>
                <td>{row[2]}</td>
                <td className={row[3] === '정상' ? '' : 'is-accent'}>{row[3]}</td>
                <td>{row[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="ow-monitor__table">
        <thead>
          <tr>
            <th>Crane</th>
            <th>Comm</th>
            <th>On</th>
            <th>Fault</th>
            <th>Not Comm</th>
            <th>Free Slewing</th>
            <th>Rotate</th>
            <th>Trolley #1</th>
            <th>Trolley #2</th>
            <th>Gantry</th>
            <th>Hoist #1</th>
            <th>Hoist #2</th>
            <th>Hoist #3</th>
            <th>Trolley #2</th>
            <th>Slewing</th>
            <th>Gantry</th>
          </tr>
        </thead>
        <tbody>
          {craneRows.map((row) => (
            <tr key={row[0]}>
              <td className="is-name">{row[0]}</td>
              <td><span className={`ow-monitor__dot${row[1] ? ' is-green' : ''}`} /></td>
              <td><span className={`ow-monitor__dot${row[2] ? ' is-green' : ''}`} /></td>
              <td><span className={`ow-monitor__dot${row[3] ? ' is-red' : ''}`} /></td>
              <td><span className="ow-monitor__dot" /></td>
              <td><span className="ow-monitor__dot" /></td>
              <td><span className="ow-monitor__dot" /></td>
              <td>{row[7]}</td>
              <td>{row[8]}</td>
              <td>{row[9]}</td>
              <td>{row[10]}</td>
              <td>{row[11]}</td>
              <td>{row[12]}</td>
              <td>{row[13]}</td>
              <td>{row[14]}</td>
              <td className="is-accent">{row[15]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderRightPanel = () => {
    if (activeMenu === 'operation-info') {
      return (
        <>
          <section className="ow-monitor__stats">
            <div className="ow-monitor__section-title">{rightPanelTitleMap[activeMenu]}</div>
            <div className="ow-monitor__info-grid">
              {operationInfoCards.map((item) => (
                <div key={item.label} className="ow-monitor__info-card">
                  <div className="ow-monitor__info-label">{item.label}</div>
                  <div className="ow-monitor__info-value">{item.value}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="ow-monitor__alarms">
            <div className="ow-monitor__section-title">운행 메모</div>
            <div className="ow-monitor__info-list">
              <div className="ow-monitor__info-list-item">선석 A-03 작업 우선순위 상향</div>
              <div className="ow-monitor__info-list-item">TTC-20은 점검 모드 유지</div>
              <div className="ow-monitor__info-list-item">GC-4 호이스트 응답 정상</div>
              <div className="ow-monitor__info-list-item">Berth 라인 풍속 5.1m/s</div>
            </div>
          </section>
        </>
      );
    }

    if (activeMenu === 'operation-status') {
      return (
        <>
          <section className="ow-monitor__stats">
            <div className="ow-monitor__section-title">{rightPanelTitleMap[activeMenu]}</div>
            <div className="ow-monitor__stats-grid ow-monitor__stats-grid--compact">
              {operationStatusCards.map((item) => (
                <div key={item.label} className="ow-monitor__stat-card">
                  <div className="ow-monitor__stat-label">{item.label}</div>
                  <div className={`ow-monitor__stat-value is-${item.tone}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="ow-monitor__alarms">
            <div className="ow-monitor__section-title">상태 요약</div>
            <div className="ow-monitor__info-list">
              <div className="ow-monitor__info-list-item">정상 장비 비율 75%</div>
              <div className="ow-monitor__info-list-item">주의 레벨 2건 유지</div>
              <div className="ow-monitor__info-list-item">점검 장비 1건 대응 중</div>
              <div className="ow-monitor__info-list-item">평균 이동 응답 0.82s</div>
            </div>
          </section>
        </>
      );
    }

    return (
      <>
        <section className="ow-monitor__stats">
          <div className="ow-monitor__section-title">{TEXT.statsTitle}</div>
          <div className="ow-monitor__stats-grid">
            {statCards.map((item) => (
              <div key={item.label} className="ow-monitor__stat-card">
                <div className="ow-monitor__stat-label">{item.label}</div>
                <div className={`ow-monitor__stat-value is-${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="ow-monitor__alarms">
          <div className="ow-monitor__section-title">{TEXT.alarmTitle}</div>
          <div className="ow-monitor__alarm-table-wrap">
            <table className="ow-monitor__alarm-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>Severity</th>
                  <th>OccurrenceTime</th>
                  <th>Crane</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {alarmRows.map((row) => (
                  <tr key={row.no}>
                    <td>{row.no}</td>
                    <td>
                      <span
                        className={`ow-monitor__severity${row.severity === 'Warning' ? ' is-warning' : ' is-critical'}`}
                      >
                        {row.severity === 'Warning' ? (
                          <AlertTriangle size={10} />
                        ) : (
                          <ShieldAlert size={10} />
                        )}
                        {row.severity}
                      </span>
                    </td>
                    <td>{row.occurrenceTime}</td>
                    <td>{row.target}</td>
                    <td className="is-count">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  };

  return (
    <main className="ow-monitor">
      <div className="ow-monitor__topbar">
        <div className="ow-monitor__topbar-left">
          <Link to="/" className="ow-monitor__back-link">
            <span className="ow-monitor__back-chevron">‹</span>
            {TEXT.back}
          </Link>
          <div className="ow-monitor__brand">
            <div className="ow-monitor__brand-mark">C</div>
            <div>
              <div className="ow-monitor__brand-title">CRANEOPS</div>
              <div className="ow-monitor__brand-subtitle">3D MONITORING SYSTEM</div>
            </div>
          </div>
        </div>

        <div className="ow-monitor__topbar-center">
          <div className="ow-monitor__top-tag">{TEXT.topTag}</div>
          <div className="ow-monitor__top-description">{TEXT.topDescription}</div>
        </div>

        <div className="ow-monitor__live">
          <span className="ow-monitor__live-dot" />
          {TEXT.live}
        </div>
      </div>

      <div
        ref={layoutRef}
        className="ow-monitor__layout"
        style={{
          gridTemplateColumns: `${isSidebarCollapsed ? 64 : leftPanelWidth}px 8px minmax(0, 1fr) 8px ${rightPanelWidth}px`,
        }}
      >
        <aside
          className={`ow-monitor__sidebar${isSidebarCollapsed ? ' is-collapsed' : ''}`}
        >
          <div className="ow-monitor__sidebar-head">
            <button
              className="ow-monitor__menu-button"
              type="button"
              aria-label={isSidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
              aria-expanded={!isSidebarCollapsed}
              onClick={() => {
                setIsSidebarCollapsed((prev) => {
                  const next = !prev;
                  return next;
                });
              }}
            >
              <Menu size={16} />
            </button>
            <div className="ow-monitor__sidebar-title">{TEXT.sidebarTitle}</div>
          </div>

          <nav className="ow-monitor__nav">
            <ul className="ow-monitor__nav-list">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeMenu;

                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      className={`ow-monitor__nav-item${isActive ? ' is-active' : ''}`}
                      title={item.label}
                      onClick={() => setActiveMenu(item.key as OutdoorMenuKey)}
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div
          className="ow-monitor__resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="좌측 패널 크기 조절"
          onMouseDown={() => {
            if (!isSidebarCollapsed) {
              setDraggingPanel('left');
            }
          }}
        >
          <div className="ow-monitor__resize-handle-grip">⋮</div>
        </div>

        <section
          ref={viewerPanelRef}
          className="ow-monitor__viewer-panel"
          style={{
            gridTemplateRows:
              viewerHeight > 0
                ? `42px minmax(0, ${viewerHeight}px) 8px minmax(120px, 1fr)`
                : undefined,
          }}
        >
          <div className="ow-monitor__viewer-toolbar">
            <div className="ow-monitor__viewer-title-wrap">
              <div className="ow-monitor__viewer-bar" />
              <h1 className="ow-monitor__viewer-title">{TEXT.viewerTitle}</h1>
              <div className="ow-monitor__viewer-subtitle">{viewerSubtitleMap[activeMenu]}</div>
            </div>

            <div className="ow-monitor__viewer-badge">100%</div>
          </div>

          <div className="ow-monitor__viewer-stage">
            <div className="ow-monitor__viewer-controls">
              <button
                type="button"
                className="ow-monitor__viewer-control"
                aria-label="기본 시점으로 이동"
                onClick={() => viewerRef.current?.resetView()}
              >
                <Search size={15} />
              </button>
              <button
                type="button"
                className="ow-monitor__viewer-control"
                aria-label="확대"
                onClick={() => viewerRef.current?.zoomIn()}
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                className="ow-monitor__viewer-control"
                aria-label="축소"
                onClick={() => viewerRef.current?.zoomOut()}
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className="ow-monitor__viewer-control"
                aria-label="탑뷰 전환"
                onClick={() => viewerRef.current?.toggleTopView()}
              >
                <Gauge size={15} />
              </button>
            </div>

            <div className="ow-monitor__viewer-frame">
              <OutdoorWork3dView ref={viewerRef} />
            </div>

            <div className="ow-monitor__viewer-hint">{TEXT.viewerHint}</div>
          </div>

          <div
            className="ow-monitor__resize-handle ow-monitor__resize-handle--horizontal"
            role="separator"
            aria-orientation="horizontal"
            aria-label="하단 그리드 크기 조절"
            onMouseDown={() => setDraggingPanel('bottom')}
          >
            <div className="ow-monitor__resize-handle-grip ow-monitor__resize-handle-grip--horizontal">
              ⋯
            </div>
          </div>

          <div className="ow-monitor__table-wrap">
            <div className="ow-monitor__subpanel-title">
              {lowerPanelTitleMap[activeMenu]}
            </div>
            {renderBottomPanel()}
          </div>
        </section>

        <div
          className="ow-monitor__resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="우측 패널 크기 조절"
          onMouseDown={() => setDraggingPanel('right')}
        >
          <div className="ow-monitor__resize-handle-grip">⋮</div>
        </div>

        <aside className="ow-monitor__right-panel">
          {renderRightPanel()}
        </aside>
      </div>
    </main>
  );
}
