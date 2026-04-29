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

const severityOrder: AlarmSeverity[] = ['critical', 'high', 'medium', 'info'];

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

interface AlarmRowProps {
  alarm: Alarm;
  language: string;
}

function AlarmRow({ alarm, language }: AlarmRowProps) {
  const visual = alarm.active ? getAlarmSeverityVisual(alarm.severity) : null;
  const severityLabel = getAlarmSeverityLabel(alarm.severity, language);
  const description = formatAlarmHistoryMessage(alarm, language);

  return (
    <tr
      className={cn(
        'border-b text-xs transition-colors last:border-0',
        alarm.active
          ? visual?.surfaceClassName
          : 'border-emerald-500/20 bg-emerald-500/6',
      )}
    >
      <td className="px-3 py-2 whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
            alarm.active
              ? visual?.surfaceClassName
              : 'border border-emerald-500/30 bg-emerald-500/10',
          )}
        >
          <span
            className={
              alarm.active
                ? visual?.emphasisClassName
                : 'text-emerald-600 dark:text-emerald-400'
            }
          >
            {alarm.active ? severityLabel : '해제'}
          </span>
        </span>
      </td>
      <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
        {formatDateTime(alarm.timestamp, language)}
      </td>
      <td className="px-3 py-2 font-medium whitespace-nowrap">
        {alarm.craneName}
      </td>
      <td className="text-foreground/80 px-3 py-2">{description}</td>
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

  // 활성 알람 단일 순회로 통계 산출. 객체 참조 안정성을 위해 useMemo.
  const stats = useMemo(() => {
    let total = 0;
    let critical = 0;
    let high = 0;
    for (const alarm of Object.values(activeAlarms)) {
      total += 1;
      if (alarm.severity === 'critical') critical += 1;
      else if (alarm.severity === 'high') high += 1;
    }
    return { total, critical, high };
  }, [activeAlarms]);

  const totalCount = stats.total;
  const badgeColor =
    stats.critical > 0
      ? 'bg-red-500'
      : stats.high > 0
        ? 'bg-orange-500'
        : 'bg-amber-500';

  const filteredHistory = useMemo(
    () =>
      severityFilter.size === 0
        ? history
        : history.filter((a) => severityFilter.has(a.severity)),
    [history, severityFilter],
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
              const count = history.filter((a) => a.severity === sev).length;
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
            {filteredHistory.length === 0 ? (
              <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                알람 이력이 없습니다
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-muted-foreground text-left text-[11px]">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      단계
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      시간
                    </th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      장비
                    </th>
                    <th className="px-3 py-2 font-medium">설명</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((alarm) => (
                    <AlarmRow
                      key={alarm.id}
                      alarm={alarm}
                      language={i18n.language}
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
