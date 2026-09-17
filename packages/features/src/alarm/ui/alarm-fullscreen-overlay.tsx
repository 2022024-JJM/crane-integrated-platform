import { Bell, Crosshair, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
  getAlarmRiskLevelLabel,
  getAlarmSeverityVisual,
  getZoneAlarmMeta,
  type Alarm,
  type AlarmSeverity,
} from '@crane/domain/alarm';
import { getCraneIdsByRegion } from '@crane/domain/crane';
import { getFormatLocale } from '@crane/core/config/i18n';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';

import {
  isAlarmInRegion,
  useRealtimeAlarmStore,
} from '../model/use-realtime-alarm-store';

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
  /**
   * 영역 침범 알람 행의 [영역 보기] — 카메라를 그 영역으로 옮긴다. 페이지가
   * `Monitoring3dView actionsRef.viewZone` 을 이어 준다(features/3d 는 같은
   * 레이어라 여기서 import 하지 않는다). 없으면 버튼을 그리지 않는다.
   */
  onViewZone?: (zoneKey: string) => void;
}

const HIGHLIGHT_DURATION_MS = 1500;

export function AlarmFullscreenOverlay({
  regionId,
  visible,
  onClose,
  onViewZone,
}: AlarmFullscreenOverlayProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const activeAlarms = useRealtimeAlarmStore(useShallow((s) => s.activeAlarms));

  const regionAlarms = useMemo(() => {
    const allowedCraneIds = new Set(getCraneIdsByRegion(regionId));
    const result: Alarm[] = [];
    for (const alarm of Object.values(activeAlarms)) {
      if (isAlarmInRegion(alarm, regionId, allowedCraneIds) && alarm.active) {
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

  const headerLabel = language.toLowerCase().startsWith('ko')
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
              viewZoneLabel={t('monitoring:sceneZone.viewZone')}
              onViewZone={onViewZone}
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
  viewZoneLabel: string;
  onViewZone?: (zoneKey: string) => void;
}

function AlarmOverlayItem({
  alarm,
  language,
  isNew,
  viewZoneLabel,
  onViewZone,
}: AlarmOverlayItemProps) {
  const visual = getAlarmSeverityVisual(alarm.severity);
  // 배지는 심각도 분류명이 아니라 위험 수준(위험/경고/주의/정보)으로 읽힌다.
  const severityLabel = getAlarmRiskLevelLabel(alarm.severity, language);
  const isUrgent = alarm.severity === 'critical' || alarm.severity === 'high';
  // 영역 침범 로컬 알람 — 영역 색 점과 [영역 보기](2026-09-17, 독 영역 팝업의
  // 침범 목록에서 옮겨 온 것). 색은 상태가 아니라 영역 식별자다.
  const zoneMeta = getZoneAlarmMeta(alarm);

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
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium">
            {zoneMeta?.color ? (
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: zoneMeta.color }}
              />
            ) : null}
            <span className="truncate">{alarm.craneName}</span>
          </p>
          {/* 알람 설명 대신 발생 시각 — 목록이 좁아 설명은 두 줄로 넘쳤고,
              같은 내용은 헤더 알람 패널·알람 이력이 보여 준다(2026-09-17). */}
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            {formatRelativeTime(alarm.timestamp, language)}
          </p>
        </div>
        {zoneMeta && onViewZone ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground shrink-0 self-center"
            aria-label={viewZoneLabel}
            title={viewZoneLabel}
            onClick={() => onViewZone(zoneMeta.zoneKey)}
          >
            <Crosshair className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}
