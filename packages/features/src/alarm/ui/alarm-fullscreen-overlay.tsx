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
import { getFormatLocale } from '@crane/core/config/i18n';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';

import { useRealtimeAlarmStore } from '../model/use-realtime-alarm-store';

const SEVERITY_ORDER: Record<AlarmSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

function formatRelativeTime(timestamp: string, language: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(getFormatLocale(language), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface AlarmFullscreenOverlayProps {
  regionId: string;
  visible: boolean;
  onClose: () => void;
}

const HIGHLIGHT_DURATION_MS = 1500;

export function AlarmFullscreenOverlay({
  regionId,
  visible,
  onClose,
}: AlarmFullscreenOverlayProps) {
  const { i18n } = useTranslation();
  const language = i18n.language;

  const activeAlarms = useRealtimeAlarmStore(
    useShallow((s) => s.activeAlarms),
  );

  const regionAlarms = useMemo(() => {
    const result: Alarm[] = [];
    for (const alarm of Object.values(activeAlarms)) {
      if (alarm.regionId === regionId && alarm.active) {
        result.push(alarm);
      }
    }
    result.sort((left, right) => {
      const severityDiff =
        SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
      if (severityDiff !== 0) return severityDiff;
      return right.timestamp.localeCompare(left.timestamp);
    });
    return result;
  }, [activeAlarms, regionId]);

  // 최근 추가된 알람 ID 추적. 마운트/언마운트와 무관하게 store 변화 기준으로
  // 신규 판별하므로, 토글로 다시 열어도 기존 알람은 강조되지 않는다.
  const seenIdsRef = useRef<Set<string> | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const currentIds = new Set(regionAlarms.map((alarm) => alarm.id));

    // 최초 1회: 현재 알람을 모두 본 것으로 기록(강조 없이 시작).
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return;
    }

    const seen = seenIdsRef.current;
    const newlyAdded: string[] = [];
    for (const id of currentIds) {
      if (!seen.has(id)) {
        newlyAdded.push(id);
      }
    }

    seenIdsRef.current = currentIds;

    if (newlyAdded.length === 0) {
      return;
    }

    setHighlightedIds((prev) => {
      const next = new Set(prev);
      for (const id of newlyAdded) {
        next.add(id);
      }
      return next;
    });

    const timer = window.setTimeout(() => {
      setHighlightedIds((prev) => {
        const next = new Set(prev);
        for (const id of newlyAdded) {
          next.delete(id);
        }
        return next;
      });
    }, HIGHLIGHT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [regionAlarms]);

  if (!visible || regionAlarms.length === 0) {
    return null;
  }

  const headerLabel =
    language.toLowerCase().startsWith('ko')
      ? `알람 ${regionAlarms.length}`
      : `Alarms ${regionAlarms.length}`;

  return (
    <div
      className="bg-background/40 border-border/40 w-75 overflow-hidden rounded-lg border shadow-lg backdrop-blur-lg"
      role="region"
      aria-label={headerLabel}
    >
      <div className="border-border/50 flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Bell className="text-foreground/80 size-4" aria-hidden="true" />
          <span className="text-sm font-semibold">{headerLabel}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close alarm overlay"
        >
          <X />
        </Button>
      </div>
      <ScrollArea className="max-h-[60vh]">
        <ul className="flex flex-col">
          {regionAlarms.map((alarm) => (
            <AlarmOverlayItem
              key={alarm.id}
              alarm={alarm}
              language={language}
              isNew={highlightedIds.has(alarm.id)}
            />
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

interface AlarmOverlayItemProps {
  alarm: Alarm;
  language: string;
  isNew: boolean;
}

function AlarmOverlayItem({ alarm, language, isNew }: AlarmOverlayItemProps) {
  const visual = getAlarmSeverityVisual(alarm.severity);
  const severityLabel = getAlarmSeverityLabel(alarm.severity, language);
  const description = formatAlarmHistoryMessage(alarm, language);
  const isUrgent = alarm.severity === 'critical' || alarm.severity === 'high';

  return (
    <li
      className={cn(
        'border-border/40 border-b last:border-0',
        isNew && 'animate-in slide-in-from-right-4 fade-in-0 duration-300',
        isNew && isUrgent && visual.surfaceClassName,
      )}
    >
      <div className="flex items-stretch gap-2 px-3 py-2">
        <span
          className={cn(
            'w-1 shrink-0 rounded-full',
            visual.surfaceClassName,
            isNew && isUrgent && 'animate-pulse',
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                visual.surfaceClassName,
                visual.emphasisClassName,
                isNew && isUrgent && 'animate-pulse',
              )}
            >
              {severityLabel}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {formatRelativeTime(alarm.timestamp, language)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-medium">
            {alarm.craneName}
          </p>
          <p className="text-foreground/75 mt-0.5 line-clamp-2 text-[11px]">
            {description}
          </p>
        </div>
      </div>
    </li>
  );
}
