import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  CloudSun,
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
import { Link, useLocation } from 'react-router-dom';

import { useMainPageClock } from '@/pages/main/model/use-main-page-clock';
import { useSiteWeather } from '@/shared/hooks/use-site-weather';
import { cn } from '@/shared/lib/utils';
import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';
import type { OutdoorWork3dViewHandle } from './outdoor-work-3d-view';
import { OutdoorWork3dView } from './outdoor-work-3d-view';

type OutdoorMenuKey =
  | 'realtime-monitoring'
  | 'operation-info'
  | 'operation-status'
  | 'event-log'
  | 'playback'
  | 'screen-editor';

const TEXT = {
  sidebarTitle: '2도크',
  viewerTitle: '3D CRANE VIEW',
  topTag: '실외 작업 모니터링',
  topDescription: '야드 · 항만 실외 3D 모니터링',
  live: '온라인',
  statsTitle: '알람 통계',
  alarmTitle: '알람 내역',
} as const;

const panelSurfaceClass =
  'min-h-0 overflow-hidden bg-[linear-gradient(180deg,rgba(8,11,24,0.98),rgba(5,7,18,0.98))]';
const sectionTitleClass = 'mb-2.5 text-[18px] font-bold text-[#f2f5ff]';
const viewerControlClass =
  'grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-lg border border-[rgba(133,149,190,0.2)] bg-[rgba(7,18,36,0.84)] text-[#c6d1ec] shadow-[0_8px_18px_rgba(0,0,0,0.22)]';
const resizeHandleClass =
  'group flex items-center justify-center bg-[linear-gradient(180deg,rgba(255,166,0,0.04),rgba(255,166,0,0.12),rgba(255,166,0,0.04))] transition-colors hover:bg-[linear-gradient(180deg,rgba(255,166,0,0.12),rgba(255,166,0,0.3),rgba(255,166,0,0.12))]';
const resizeGripClass =
  'grid select-none place-items-center rounded-full border border-[rgba(255,166,0,0.26)] bg-[rgba(11,17,30,0.96)] text-[12px] leading-none text-[#f3b247]';
const tableCellClass =
  'border-r border-b border-[rgba(255,255,255,0.04)] px-2 py-2 text-center font-mono text-[11px] text-[#71809e]';
const tableHeadClass =
  'border-r border-b border-[rgba(255,255,255,0.04)] bg-[rgba(16,15,34,0.9)] px-2 py-[9px] text-[11px] font-medium text-[#54627f]';

export function OutdoorWorkPage() {
  const location = useLocation();
  const regionName = (location.state as { regionName?: string } | null)?.regionName;
  const { dateTime, clockLabel } = useMainPageClock();
  const { siteLabel, temperatureLabel, weatherLabel } = useSiteWeather({
    regionName,
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] =
    useState<OutdoorMenuKey>('realtime-monitoring');
  const [leftPanelWidth, setLeftPanelWidth] = useState(156);
  const [rightPanelWidth, setRightPanelWidth] = useState(248);
  const [viewerHeight, setViewerHeight] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
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
  ] as const;

  const statCards = [
    { label: '# Alarms', value: '4', tone: 'danger' },
    { label: 'Elapsed Time', value: '4 min', tone: 'neutral' },
    { label: '# Occurrence', value: '1', tone: 'ok' },
    { label: 'Abnormal', value: '4', tone: 'danger' },
    { label: 'Danger', value: '0', tone: 'danger' },
    { label: 'Normal', value: '0', tone: 'ok' },
  ] as const;

  const alarmRows = [
    ['132', 'Warning', '2019-01-23 15:16', 'TC-m', '4'],
    ['131', 'Critical', '2019-01-23 15:10', 'GC-4', '2'],
    ['130', 'Critical', '2019-01-23 15:10', 'TTC-26', '1'],
    ['129', 'Critical', '2019-01-23 15:11', 'TTC-12', '3'],
    ['128', 'Critical', '2019-01-23 15:06', 'TC-57', '2'],
    ['127', 'Critical', '2019-01-23 15:03', 'OC-05', '1 minute'],
  ] as const;

  const craneRows = [
    ['GC-4', true, true, false, false, false, false, '74.3', '', '71.3', '67.8', '118.4', '', '', '239', '24.4'],
    ['TTC-26', true, true, false, false, false, false, '', '85', '52', '', '', '85', '', '696.6', '6.6'],
    ['TTC-20', true, true, false, false, false, false, '', '89', '49', '', '', '89', '', '604.8', '0'],
    ['TTC-13', true, true, true, false, false, false, '', '75.5', '62', '', '16.8', '', '', '635.7', '-0.6'],
    ['TTC-5', true, true, false, false, false, false, '', '90.8', '61', '', '34.1', '', '', '307.7', '-0.1'],
    ['TTC-12', true, true, false, false, false, false, '', '265.6', '55', '', '85.3', '', '', '806.6', '0'],
    ['TTC-30', true, true, false, false, false, false, '', '352.9', '39.1', '', '53.2', '', '', '528.1', '0'],
  ] as const;

  const operationInfoCards = [
    ['도크명', '2도크 / Busan New Port'],
    ['활성 장비', 'Gantry 1, TC 6, TTC 5'],
    ['현재 작업', '컨테이너 이송 / 선석 적재'],
    ['작업 구간', 'Berth A-03 ~ Yard B-12'],
  ] as const;

  const operationInfoRows = [
    ['GC-4', 'Gantry Crane', 'Berth A-03', '정상', '컨테이너 양하', '정면'],
    ['TTC-26', 'Transfer Crane', 'Yard B-12', '정상', '블록 적재', '북동'],
    ['TTC-20', 'Transfer Crane', 'Yard B-07', '점검', '대기', '서측'],
    ['TC-57', 'Trolley Crane', 'Berth A-05', '주의', '선적 대기', '남동'],
  ] as const;

  const operationStatusCards = [
    ['총 운행 장비', '12', 'neutral'],
    ['정상 장비', '9', 'ok'],
    ['주의 장비', '2', 'danger'],
    ['점검 장비', '1', 'danger'],
  ] as const;

  const operationStatusRows = [
    ['09:10', 'GC-4', '호이스트 상승', '정상', '상단 프레임'],
    ['09:12', 'TTC-26', '트롤리 이동', '정상', '야드 라인 3'],
    ['09:14', 'TC-57', '회전 속도 편차', '주의', '버스 바 인근'],
    ['09:18', 'TTC-20', '점검 모드 전환', '점검', '블록 B-07'],
    ['09:20', 'GC-4', '컨테이너 인계 완료', '정상', '선석 A-03'],
  ] as const;

  const viewerSubtitleMap: Record<OutdoorMenuKey, string> = {
    'realtime-monitoring': '',
    'operation-info': '운행 정보 · 장비 위치 · 작업 구간',
    'operation-status': '운행 현황 · 장비 상태 · 이벤트 흐름',
    'event-log': '이벤트 로그 · 최근 발생 이력',
    playback: '다시 보기 · 과거 시점 재생',
    'screen-editor': '화면 편집 · 배치 및 패널 구성',
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
    if (!draggingPanel) return;

    const handlePointerMove = (event: MouseEvent) => {
      const layoutElement = layoutRef.current;
      if (!layoutElement) return;

      const rect = layoutElement.getBoundingClientRect();

      if (draggingPanel === 'left' && !isSidebarCollapsed) {
        setLeftPanelWidth(Math.min(Math.max(event.clientX - rect.left, 120), 320));
      }

      if (draggingPanel === 'right') {
        setRightPanelWidth(Math.min(Math.max(rect.right - event.clientX, 220), 420));
      }

      if (draggingPanel === 'bottom') {
        const viewerPanelElement = viewerPanelRef.current;
        if (!viewerPanelElement) return;

        const viewerRect = viewerPanelElement.getBoundingClientRect();
        const nextHeight = Math.min(
          Math.max(event.clientY - viewerRect.top - 42, 260),
          viewerRect.height - 160,
        );

        setViewerHeight(nextHeight);
      }
    };

    const handlePointerUp = () => setDraggingPanel(null);

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [draggingPanel, isSidebarCollapsed]);

  useEffect(() => {
    const viewerPanelElement = viewerPanelRef.current;
    if (!viewerPanelElement || viewerHeight > 0) return;

    const updateDefaultViewerHeight = () => {
      const panelHeight = viewerPanelElement.getBoundingClientRect().height;
      setViewerHeight(Math.max(panelHeight - 240, 320));
    };

    updateDefaultViewerHeight();
    window.addEventListener('resize', updateDefaultViewerHeight);

    return () => {
      window.removeEventListener('resize', updateDefaultViewerHeight);
    };
  }, [viewerHeight]);

  const getStatValueClass = (tone: string) =>
    cn(
      'mt-2.5 text-[34px] leading-none font-bold',
      tone === 'ok' && 'text-[#36d681]',
      tone === 'danger' && 'text-[#ff4e5f]',
      tone === 'neutral' && 'text-[#f4f7ff]',
    );

  const renderBottomPanel = () => {
    if (activeMenu === 'operation-info') {
      return (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['장비', '유형', '위치', '상태', '작업', '방향'].map((header) => (
                <th key={header} className={tableHeadClass}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operationInfoRows.map((row) => (
              <tr key={row[0]}>
                <td className={cn(tableCellClass, 'text-left font-bold text-[#f0b144]')}>
                  {row[0]}
                </td>
                <td className={tableCellClass}>{row[1]}</td>
                <td className={tableCellClass}>{row[2]}</td>
                <td className={tableCellClass}>{row[3]}</td>
                <td className={tableCellClass}>{row[4]}</td>
                <td className={cn(tableCellClass, 'font-bold text-[#f0b144]')}>
                  {row[5]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeMenu === 'operation-status') {
      return (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['시각', '장비', '상태 변화', '레벨', '위치'].map((header) => (
                <th key={header} className={tableHeadClass}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operationStatusRows.map((row) => (
              <tr key={`${row[0]}-${row[1]}`}>
                <td className={tableCellClass}>{row[0]}</td>
                <td className={cn(tableCellClass, 'text-left font-bold text-[#f0b144]')}>
                  {row[1]}
                </td>
                <td className={tableCellClass}>{row[2]}</td>
                <td
                  className={cn(
                    tableCellClass,
                    row[3] !== '정상' && 'font-bold text-[#f0b144]',
                  )}
                >
                  {row[3]}
                </td>
                <td className={tableCellClass}>{row[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[
              'Crane',
              'Comm',
              'On',
              'Fault',
              'Not Comm',
              'Free Slewing',
              'Rotate',
              'Trolley #1',
              'Trolley #2',
              'Gantry',
              'Hoist #1',
              'Hoist #2',
              'Hoist #3',
              'Trolley #2',
              'Slewing',
              'Gantry',
            ].map((header) => (
              <th key={header} className={tableHeadClass}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {craneRows.map((row) => (
            <tr key={row[0]}>
              <td className={cn(tableCellClass, 'text-left font-bold text-[#f0b144]')}>
                {row[0]}
              </td>
              {[row[1], row[2], row[3]].map((value, index) => (
                <td key={index} className={tableCellClass}>
                  <span
                    className={cn(
                      'inline-block h-2 w-2 rounded-full bg-[rgba(111,123,155,0.34)]',
                      value === true &&
                        index < 2 &&
                        'bg-[#39d47f] shadow-[0_0_8px_rgba(57,212,127,0.7)]',
                      value === true &&
                        index === 2 &&
                        'bg-[#ef4545] shadow-[0_0_8px_rgba(239,69,69,0.6)]',
                    )}
                  />
                </td>
              ))}
              {[0, 1, 2].map((index) => (
                <td key={`dot-${index}`} className={tableCellClass}>
                  <span className="inline-block h-2 w-2 rounded-full bg-[rgba(111,123,155,0.34)]" />
                </td>
              ))}
              {row.slice(7, 15).map((value, index) => (
                <td key={index} className={tableCellClass}>
                  {value}
                </td>
              ))}
              <td className={cn(tableCellClass, 'font-bold text-[#f0b144]')}>
                {row[15]}
              </td>
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
          <section className="min-h-0 border-b border-[rgba(255,166,0,0.08)] p-3">
            <div className={sectionTitleClass}>운행 정보</div>
            <div className="grid grid-cols-1 gap-2">
              {operationInfoCards.map(([label, value]) => (
                <div
                  key={label}
                  className="border border-[rgba(255,255,255,0.06)] bg-[rgba(8,9,21,0.94)] p-3"
                >
                  <div className="mb-1.5 text-[11px] text-[#607097]">{label}</div>
                  <div className="text-[13px] font-semibold leading-[1.5] text-[#eef3ff]">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
            <div className={sectionTitleClass}>운행 메모</div>
            <div className="flex flex-col gap-2">
              {[
                '선석 A-03 작업 우선순위 상향',
                'TTC-20은 점검 모드 유지',
                'GC-4 호이스트 응답 정상',
                'Berth 라인 풍속 5.1m/s',
              ].map((item) => (
                <div
                  key={item}
                  className="border border-[rgba(255,255,255,0.06)] border-l-[2px] border-l-[rgba(255,166,0,0.45)] bg-[rgba(8,9,21,0.94)] px-3 py-2.5 text-[12px] leading-[1.5] text-[#cfd6e8]"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        </>
      );
    }

    if (activeMenu === 'operation-status') {
      return (
        <>
          <section className="min-h-0 border-b border-[rgba(255,166,0,0.08)] p-3">
            <div className={sectionTitleClass}>운행 현황</div>
            <div className="grid grid-cols-2 gap-px overflow-hidden border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.05)]">
              {operationStatusCards.map(([label, value, tone]) => (
                <div key={label} className="min-h-[82px] bg-[rgba(8,9,21,0.94)] p-2.5">
                  <div className="text-[11px] text-[#5f6f93]">{label}</div>
                  <div className={getStatValueClass(tone)}>{value}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
            <div className={sectionTitleClass}>상태 요약</div>
            <div className="flex flex-col gap-2">
              {[
                '정상 장비 비율 75%',
                '주의 레벨 2건 유지',
                '점검 장비 1건 대응 중',
                '평균 이동 응답 0.82s',
              ].map((item) => (
                <div
                  key={item}
                  className="border border-[rgba(255,255,255,0.06)] border-l-[2px] border-l-[rgba(255,166,0,0.45)] bg-[rgba(8,9,21,0.94)] px-3 py-2.5 text-[12px] leading-[1.5] text-[#cfd6e8]"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        </>
      );
    }

    return (
      <>
        <section className="min-h-0 border-b border-[rgba(255,166,0,0.08)] p-3">
          <div className={sectionTitleClass}>{TEXT.statsTitle}</div>
          <div className="grid grid-cols-3 gap-px overflow-hidden border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.05)]">
            {statCards.map((item) => (
              <div key={item.label} className="min-h-[82px] bg-[rgba(8,9,21,0.94)] p-2.5">
                <div className="text-[11px] text-[#5f6f93]">{item.label}</div>
                <div className={getStatValueClass(item.tone)}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
          <div className={sectionTitleClass}>{TEXT.alarmTitle}</div>
          <div className="max-h-full min-h-0 overflow-auto border border-[rgba(255,255,255,0.06)]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['NO', 'Severity', 'OccurrenceTime', 'Crane', 'Count'].map(
                    (header) => (
                      <th
                        key={header}
                        className="border-r border-b border-[rgba(255,255,255,0.04)] bg-[rgba(15,16,31,0.92)] px-1.5 py-2 text-left text-[10px] font-semibold text-[#576683]"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {alarmRows.map(([no, severity, occurrenceTime, target, count]) => (
                  <tr key={no}>
                    <td className="border-r border-b border-[rgba(255,255,255,0.04)] px-1.5 py-[9px] text-[11px] text-[#7f8dad]">
                      {no}
                    </td>
                    <td className="border-r border-b border-[rgba(255,255,255,0.04)] px-1.5 py-[9px] text-[11px] text-[#7f8dad]">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                          severity === 'Warning'
                            ? 'bg-[rgba(244,179,71,0.12)] text-[#f4b347]'
                            : 'bg-[rgba(255,90,100,0.12)] text-[#ff5a64]',
                        )}
                      >
                        {severity === 'Warning' ? (
                          <AlertTriangle size={10} />
                        ) : (
                          <ShieldAlert size={10} />
                        )}
                        {severity}
                      </span>
                    </td>
                    <td className="border-r border-b border-[rgba(255,255,255,0.04)] px-1.5 py-[9px] text-[11px] text-[#7f8dad]">
                      {occurrenceTime}
                    </td>
                    <td className="border-r border-b border-[rgba(255,255,255,0.04)] px-1.5 py-[9px] text-[11px] text-[#7f8dad]">
                      {target}
                    </td>
                    <td className="border-r border-b border-[rgba(255,255,255,0.04)] px-1.5 py-[9px] text-[11px] font-bold text-[#f0b144]">
                      {count}
                    </td>
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
    <main className="h-screen overflow-hidden bg-[linear-gradient(180deg,rgba(4,8,18,0.94),rgba(6,10,20,0.98)),repeating-linear-gradient(-45deg,transparent_0,transparent_18px,rgba(255,255,255,0.012)_18px,rgba(255,255,255,0.012)_19px)] text-[#d7def0]">
      <div className="grid min-h-[52px] grid-cols-[320px_1fr_220px] items-center gap-4 border-b border-b-[rgba(255,166,0,0.16)] bg-[linear-gradient(180deg,rgba(6,8,16,0.98),rgba(4,7,14,0.92))] px-3.5 py-2 shadow-[inset_0_-1px_0_rgba(255,166,0,0.08)] max-[1080px]:grid-cols-1 max-[1080px]:justify-items-start">
        <div className="flex items-center gap-3.5">
          <Link
            to="/"
            aria-label="뒤로가기"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[rgba(255,166,0,0.22)] bg-[rgba(255,166,0,0.08)] text-[#ffb84d] no-underline"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2.5">
            <HanwhaIcon className="h-[26px] w-[26px] shrink-0" width={26} height={26} />
            <div>
              <div className="text-[18px] leading-none tracking-[0.1em] text-[#f3f6ff]">
                CRANE<span className="text-[#f7b443]">OPS</span>
              </div>
              <div className="text-[9px] tracking-[0.14em] text-[#66718f]">
                3D Monitoring System
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-3 max-[1080px]:flex-wrap max-[1080px]:justify-start">
          <div className="rounded-lg border border-[rgba(255,166,0,0.24)] bg-[rgba(255,166,0,0.08)] px-3 py-1.5 text-[12px] font-bold text-[#ffb33f]">
            {TEXT.topTag}
          </div>
          <div className="whitespace-nowrap text-[13px] text-[#7b89aa]">
            {TEXT.topDescription}
          </div>
        </div>

        <div className="flex items-center justify-self-end gap-2 max-[1080px]:justify-self-start max-[720px]:flex-wrap">
          <div className="flex min-w-[132px] items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(9,14,28,0.82)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(255,166,0,0.1)] text-[#f7b443]">
              <CloudSun size={15} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[10px] uppercase tracking-[0.12em] text-[#66789f]">
                Weather
              </div>
              <div className="truncate text-[12px] font-semibold text-[#dbe5fb]">
                {siteLabel} {weatherLabel}
              </div>
              <div className="text-[11px] text-[#8ea0c6]">{temperatureLabel}</div>
            </div>
          </div>
          <div className="flex min-w-[116px] items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(9,14,28,0.82)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(110,130,255,0.1)] text-[#9fb4ff]">
              <Clock3 size={15} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#66789f]">
                Time
              </div>
              <time
                className="font-mono text-[13px] font-semibold text-[#dbe5fb]"
                dateTime={dateTime}
              >
                {clockLabel}
              </time>
            </div>
          </div>
          <div className="flex min-w-[134px] items-center gap-2 rounded-xl border border-[rgba(55,214,122,0.18)] bg-[rgba(7,24,16,0.72)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(55,214,122,0.12)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#37d67a] shadow-[0_0_10px_rgba(55,214,122,0.8)]" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#5d9271]">
                Status
              </div>
              <div className="text-[12px] font-semibold text-[#5ff29a]">{TEXT.live}</div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={layoutRef}
        className="grid h-[calc(100vh-52px)] min-h-0 max-[1080px]:block max-[1080px]:h-auto"
        style={{
          gridTemplateColumns: `${isSidebarCollapsed ? 64 : leftPanelWidth}px 8px minmax(0, 1fr) 8px ${rightPanelWidth}px`,
        }}
      >
        <aside
          className={cn(
            panelSurfaceClass,
            'flex flex-col border-r border-r-[rgba(255,166,0,0.08)]',
            isSidebarCollapsed &&
              '[&_.sidebar-title]:pointer-events-none [&_.sidebar-title]:-translate-x-1.5 [&_.sidebar-title]:opacity-0 [&_.sidebar-head]:justify-center [&_.sidebar-item]:justify-center [&_.sidebar-item]:px-0 [&_.sidebar-item_span]:hidden',
          )}
        >
          <div className="sidebar-head flex h-[46px] items-center gap-2 border-b border-b-[rgba(255,166,0,0.08)] px-2.5">
            <button
              className="grid h-6 w-6 place-items-center rounded-md border border-[rgba(107,120,166,0.22)] bg-[rgba(255,255,255,0.02)] text-[#8793b2]"
              type="button"
              aria-label={isSidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
              aria-expanded={!isSidebarCollapsed}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            >
              <Menu size={16} />
            </button>
            <div className="sidebar-title text-[24px] font-bold tracking-[0.03em] text-[#f2a329] transition-all">
              {TEXT.sidebarTitle}
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-auto p-2">
            <ul className="flex flex-col gap-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeMenu;

                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      className={cn(
                        'sidebar-item flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-[11px] text-left text-[13px] text-[#8490b0] transition-all',
                        isActive &&
                          'border-[rgba(255,166,0,0.18)] bg-[linear-gradient(90deg,rgba(255,166,0,0.14),rgba(255,166,0,0.03))] text-[#f4af3c] shadow-[inset_3px_0_0_#f4af3c]',
                      )}
                      title={item.label}
                      onClick={() => setActiveMenu(item.key)}
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
          className={cn(resizeHandleClass, 'w-2 min-w-2 cursor-col-resize max-[1080px]:hidden')}
          role="separator"
          aria-orientation="vertical"
          aria-label="좌측 패널 크기 조절"
          onMouseDown={() => {
            if (!isSidebarCollapsed) setDraggingPanel('left');
          }}
        >
          <div className={cn(resizeGripClass, 'h-11 w-3')}>⋮</div>
        </div>

        <section
          ref={viewerPanelRef}
          className="grid h-full min-h-0 min-w-0 border-r border-r-[rgba(255,166,0,0.08)] bg-[linear-gradient(180deg,rgba(8,13,27,0.96),rgba(5,9,19,0.98)),radial-gradient(circle_at_top_left,rgba(255,166,0,0.08),transparent_28%)]"
          style={{
            gridTemplateRows:
              viewerHeight > 0
                ? `42px minmax(0, ${viewerHeight}px) 8px minmax(120px, 1fr)`
                : '42px minmax(0,1fr) 8px minmax(170px,26vh)',
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-b-[rgba(255,166,0,0.08)] px-3.5">
            <div className="flex min-w-0 items-center gap-2.5 max-[720px]:flex-wrap">
              <div className="h-[22px] w-[3px] rounded-full bg-[linear-gradient(180deg,#ffcc6e,#f29f05)]" />
              <h1 className="m-0 text-[24px] font-bold tracking-[0.04em] text-[#f7b443] max-[1280px]:text-[20px] max-[720px]:text-[18px]">
                {TEXT.viewerTitle}
              </h1>
              <div className="text-[14px] text-[#506181] max-[720px]:w-full max-[720px]:text-[12px]">
                {viewerSubtitleMap[activeMenu]}
              </div>
            </div>
            <div className="rounded-lg border border-[rgba(255,166,0,0.24)] bg-[rgba(255,166,0,0.08)] px-2.5 py-[5px] font-mono text-[12px] font-bold text-[#ffbe54]">
              {zoomPercent}%
            </div>
          </div>

          <div className="relative min-h-0 overflow-hidden">
            <div className="absolute left-3 top-3 z-[2] flex gap-2">
              <button
                type="button"
                className={viewerControlClass}
                aria-label="기본 시점으로 이동"
                onClick={() => viewerRef.current?.resetView()}
              >
                <Search size={15} />
              </button>
              <button
                type="button"
                className={viewerControlClass}
                aria-label="확대"
                onClick={() => viewerRef.current?.zoomIn()}
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                className={viewerControlClass}
                aria-label="축소"
                onClick={() => viewerRef.current?.zoomOut()}
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className={viewerControlClass}
                aria-label="탑뷰 전환"
                onClick={() => viewerRef.current?.toggleTopView()}
              >
                <Gauge size={15} />
              </button>
            </div>

            <div className="h-full min-h-0 border-x border-x-[rgba(255,166,0,0.06)] bg-[linear-gradient(180deg,rgba(5,17,37,0.92),rgba(4,13,31,0.98))] [&>*]:h-full [&>*]:w-full [&_canvas]:block">
              <OutdoorWork3dView
                ref={viewerRef}
                onZoomChange={setZoomPercent}
              />
            </div>

          </div>

          <div
            className={cn(
              resizeHandleClass,
              'h-2 min-h-2 w-full cursor-row-resize max-[1080px]:hidden',
            )}
            role="separator"
            aria-orientation="horizontal"
            aria-label="하단 그리드 크기 조절"
            onMouseDown={() => setDraggingPanel('bottom')}
          >
            <div className={cn(resizeGripClass, 'h-3 w-11')}>⋯</div>
          </div>

          <div className="min-h-0 overflow-auto border-t border-t-[rgba(255,166,0,0.08)] bg-[rgba(5,8,17,0.96)]">
            <div className="sticky top-0 z-[1] border-b border-b-[rgba(255,255,255,0.04)] bg-[rgba(11,13,27,0.96)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8795b6]">
              {lowerPanelTitleMap[activeMenu]}
            </div>
            {renderBottomPanel()}
          </div>
        </section>

        <div
          className={cn(resizeHandleClass, 'w-2 min-w-2 cursor-col-resize max-[1080px]:hidden')}
          role="separator"
          aria-orientation="vertical"
          aria-label="우측 패널 크기 조절"
          onMouseDown={() => setDraggingPanel('right')}
        >
          <div className={cn(resizeGripClass, 'h-11 w-3')}>⋮</div>
        </div>

        <aside
          className={cn(
            panelSurfaceClass,
            'grid h-full min-h-0 grid-rows-[minmax(212px,32vh)_minmax(0,1fr)] max-[1080px]:grid-rows-none',
          )}
        >
          {renderRightPanel()}
        </aside>
      </div>
    </main>
  );
}
