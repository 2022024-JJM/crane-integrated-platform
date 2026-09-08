import { Bell, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
  formatAlarmHistoryMessage,
  getAlarmSeverityLabel,
  getAlarmSeverityVisual,
  type Alarm,
  type AlarmSeverity,
} from '@crane/domain/alarm';
import { getRegionById } from '@crane/domain/region';
import { getFormatLocale } from '@crane/core/config/i18n';
import { cn } from '@crane/core/lib/utils';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { Button } from '@crane/ui/atoms/button';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';

import { useRealtimeAlarmStore } from '../model/use-realtime-alarm-store';
import {
  useExternalAlarms,
  type ExternalAlarm,
} from '../model/use-external-alarm-feed';

const severityOrder: AlarmSeverity[] = ['critical', 'high', 'medium', 'info'];

/*
 * 벨은 두 원천을 함께 본다 — 크레인 실시간 알람(WebSocket)과, 화면이 실어 둔 **외부
 * 알람**(`useExternalAlarms` — 지금은 내업 Indoorshop.OT 의 판정 결과). 둘의 타입이
 * 다르므로 표에 그리기 직전에 이 한 겹으로 normalize 한다: 표가 필요로 하는 것은
 * 심각도·시각·주체·문장 넷뿐이고, 그 넷은 두 원천 모두 말할 수 있다.
 */
interface AlarmRowModel {
  key: string;
  severity: AlarmSeverity;
  active: boolean;
  timestamp: string;
  /** 표의 '설비' 칸 — 크레인 이름 또는 알람을 낸 주체 */
  device: string;
  /** 표의 '메시지' 칸 */
  message: string;
  /** 외부 알람이 덧붙이는 부연 — 있으면 메시지 아래 한 줄로 눕는다 */
  detail?: string;
  /** 누르면 갈 곳 — 외부 알람만 가진다 */
  href?: string;
}

function formatDateTime(timestamp: string, language: string) {
  const date = new Date(timestamp);
  return date.toLocaleString(getFormatLocale(language), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** 크레인 알람 → 표 한 줄 */
function toRowModel(alarm: Alarm, language: string): AlarmRowModel {
  return {
    key: `crane:${alarm.id}`,
    severity: alarm.severity,
    active: alarm.active,
    timestamp: alarm.timestamp,
    device: alarm.craneName,
    message: formatAlarmHistoryMessage(alarm, language),
  };
}

/** 외부 알람(내업 등) → 표 한 줄. 제목이 본문, 상세는 그 아래 눕는다 */
function externalToRowModel(alarm: ExternalAlarm): AlarmRowModel {
  return {
    key: `external:${alarm.id}`,
    severity: alarm.severity,
    active: alarm.active,
    timestamp: alarm.timestamp,
    device: alarm.source,
    message: alarm.title,
    detail: alarm.message,
    href: alarm.href,
  };
}

interface AlarmRowProps {
  row: AlarmRowModel;
  language: string;
  onOpen: (href: string) => void;
}

function AlarmRow({ row, language, onOpen }: AlarmRowProps) {
  const visual = row.active ? getAlarmSeverityVisual(row.severity) : null;
  const severityLabel = getAlarmSeverityLabel(row.severity, language);

  return (
    <tr
      className={cn(
        'border-b text-xs transition-colors last:border-0',
        row.active
          ? visual?.surfaceClassName
          : 'border-emerald-500/20 bg-emerald-500/6',
        // 갈 곳이 있는 줄만 눌린다 — 없는 줄에 손 모양을 띄우면 눌러도 아무 일이 없다
        row.href && 'hover:bg-foreground/6 cursor-pointer',
      )}
      onClick={row.href ? () => onOpen(row.href!) : undefined}
      /* 모달 안은 Tab 순환이라, 눌리는 줄은 키보드로도 닿아야 한다 */
      tabIndex={row.href ? 0 : undefined}
      role={row.href ? 'button' : undefined}
      onKeyDown={
        row.href
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onOpen(row.href!);
            }
          : undefined
      }
    >
      <td className="px-3 py-2 whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
            row.active
              ? visual?.surfaceClassName
              : 'border border-emerald-500/30 bg-emerald-500/10',
          )}
        >
          <span
            className={
              row.active
                ? visual?.emphasisClassName
                : 'text-emerald-600 dark:text-emerald-400'
            }
          >
            {row.active ? severityLabel : '해제'}
          </span>
        </span>
      </td>
      <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
        {formatDateTime(row.timestamp, language)}
      </td>
      <td className="px-3 py-2 font-medium whitespace-nowrap">{row.device}</td>
      <td className="text-foreground/80 px-3 py-2">
        {row.message}
        {row.detail && (
          <span className="text-muted-foreground mt-0.5 block">
            {row.detail}
          </span>
        )}
      </td>
    </tr>
  );
}

export function HeaderAlarmButton() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<Set<AlarmSeverity>>(
    () => new Set(),
  );
  const modalRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { activeAlarms, history } = useRealtimeAlarmStore(
    useShallow((s) => ({
      activeAlarms: s.activeAlarms,
      history: s.history,
    })),
  );

  /* 화면이 실어 둔 외부 알람 — 내업(Indoorshop.OT) 등, 크레인 밖에서 온 것들 */
  const externalAlarms = useExternalAlarms();

  // 활성 알람 단일 순회로 통계 산출. 객체 참조 안정성을 위해 useMemo.
  const stats = useMemo(() => {
    let total = 0;
    let critical = 0;
    let high = 0;
    const count = (severity: AlarmSeverity) => {
      total += 1;
      if (severity === 'critical') critical += 1;
      else if (severity === 'high') high += 1;
    };
    for (const alarm of Object.values(activeAlarms)) count(alarm.severity);
    /* 배지는 "지금 살아 있는 것"만 센다 — 외부 알람도 같은 잣대다 */
    for (const alarm of externalAlarms) {
      if (alarm.active) count(alarm.severity);
    }
    return { total, critical, high };
  }, [activeAlarms, externalAlarms]);

  const totalCount = stats.total;
  const badgeColor =
    stats.critical > 0
      ? 'bg-red-500'
      : stats.high > 0
        ? 'bg-orange-500'
        : 'bg-amber-500';

  /*
   * 표에 그릴 줄 — 두 원천을 normalize 해 합치고 **최신 순**으로 한 줄기로 세운다.
   * 원천별로 단을 나누지 않는 이유: 벨을 여는 사람이 묻는 것은 "방금 뭐가 났나"이고,
   * 그 답은 시각 순이지 어느 시스템이 냈는지가 아니다.
   */
  const rows = useMemo<AlarmRowModel[]>(
    () =>
      [
        ...history.map((alarm) => toRowModel(alarm, i18n.language)),
        ...externalAlarms.map(externalToRowModel),
      ].sort((left, right) => right.timestamp.localeCompare(left.timestamp)),
    [history, externalAlarms, i18n.language],
  );

  const filteredRows = useMemo(
    () =>
      severityFilter.size === 0
        ? rows
        : rows.filter((row) => severityFilter.has(row.severity)),
    [rows, severityFilter],
  );

  const toggleSeverity = (sev: AlarmSeverity) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  const navigate = useProgressNavigate();
  const latestRegionId = history[0]?.regionId;
  const historyHref = useMemo(() => {
    if (!latestRegionId) return null;
    const region = getRegionById(latestRegionId);
    return region ? `${region.navigateTo}/alarm-history` : null;
  }, [latestRegionId]);

  /* 외부 알람 줄 클릭 — 그 사정이 보이는 화면으로. 모달은 닫는다(새 화면 위에 남으면 걸린다) */
  const handleOpenRow = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const handleNavigateHistory = () => {
    if (!historyHref) return;
    setOpen(false);
    navigate(historyHref);
  };

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // 모달 첫 진입 시 닫기 버튼 등으로 포커스 이동
    const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const items = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;

        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      // 모달 닫힐 때 트리거 버튼으로 포커스 복귀.
      // 라우트 전환 등으로 트리거가 unmount된 경우엔 focus가 body로 빠지지 않도록 가드.
      if (
        previouslyFocused &&
        document.body.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon-lg"
        onClick={() => setOpen((v) => !v)}
        className={cn('relative', open && 'bg-muted text-foreground')}
        aria-label={t('common:alarms.title')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span
            aria-label={t('common:alarms.activeCountLabel', {
              count: totalCount,
              defaultValue: `${totalCount} active alarms`,
            })}
            className={cn(
              'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
              badgeColor,
            )}
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="header-alarm-modal-title"
          className="bg-background fixed top-16 right-4 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border shadow-[0_8px_40px_rgba(0,0,0,0.3)]"
          style={{ width: 640 }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="text-muted-foreground h-4 w-4" />
              <h3
                id="header-alarm-modal-title"
                className="text-sm font-semibold"
              >
                {t('common:alarms.title')}
              </h3>
              {totalCount > 0 && (
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white',
                    badgeColor,
                  )}
                >
                  {totalCount}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen(false)}
              aria-label={t('common:close', { defaultValue: '닫기' })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 border-b px-4 py-2">
            {severityOrder.map((sev) => {
              const visual = getAlarmSeverityVisual(sev);
              const count = rows.filter((r) => r.severity === sev).length;
              const isActive = severityFilter.has(sev);
              return (
                <Button
                  key={sev}
                  variant="ghost"
                  size="xs"
                  onClick={() => toggleSeverity(sev)}
                  aria-pressed={isActive}
                  className={cn(
                    'rounded-full',
                    isActive && visual.surfaceClassName,
                  )}
                >
                  <span className={visual.emphasisClassName}>
                    {getAlarmSeverityLabel(sev, i18n.language)} ({count})
                  </span>
                </Button>
              );
            })}
          </div>

          <ScrollArea className="min-h-0 flex-1 overflow-auto">
            {filteredRows.length === 0 ? (
              <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                {t('common:alarms.historyEmpty')}
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-muted-foreground text-left text-[11px]">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      {t('common:alarms.historyColumns.severity')}
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      {t('common:alarms.historyColumns.time')}
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      {t('common:alarms.historyColumns.device')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('common:alarms.historyColumns.message')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <AlarmRow
                      key={row.key}
                      row={row}
                      language={i18n.language}
                      onOpen={handleOpenRow}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </ScrollArea>

          <div className="shrink-0 border-t px-4 py-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigateHistory}
              disabled={!historyHref}
              className="w-full"
            >
              {t('common:alarms.viewAllHistory', {
                defaultValue: '알람 이력 전체 보기',
              })}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
