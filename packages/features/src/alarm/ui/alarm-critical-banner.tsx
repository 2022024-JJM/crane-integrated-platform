import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  formatAlarmHistoryMessage,
  getAlarmSeverityLabel,
  type Alarm,
  type AlarmSeverity,
} from '@crane/domain/alarm';
import { Button } from '@crane/ui/atoms/button';

interface AlarmCriticalBannerProps {
  alarm: Alarm | null;
  onDismiss: () => void;
}

// 배너는 일반 카드보다 더 강한 시각 자극이 필요하므로 도메인 헬퍼의
// surfaceClassName(은은한 채도) 대신 severity별 강한 배경 매핑을 별도 정의.
const BANNER_STYLE: Record<
  Extract<AlarmSeverity, 'critical' | 'high'>,
  { container: string; confirm: string }
> = {
  critical: {
    container: 'border-red-500/70 bg-red-600/95',
    confirm: 'bg-white text-red-700 hover:bg-white/90',
  },
  high: {
    container: 'border-orange-500/70 bg-orange-500/95',
    confirm: 'bg-white text-orange-700 hover:bg-white/90',
  },
};

export function AlarmCriticalBanner({
  alarm,
  onDismiss,
}: AlarmCriticalBannerProps) {
  const { t, i18n } = useTranslation();

  if (alarm === null) {
    return null;
  }

  const language = i18n.language;
  const isKorean = language.toLowerCase().startsWith('ko');
  const description = formatAlarmHistoryMessage(alarm, language);
  const severityLabel = getAlarmSeverityLabel(alarm.severity, language);

  const style =
    alarm.severity === 'critical'
      ? BANNER_STYLE.critical
      : BANNER_STYLE.high;

  const titleLabel = isKorean
    ? `${severityLabel} 알람`
    : `${severityLabel} Alarm`;
  const confirmLabel = t('common:alarms.criticalBannerConfirm', {
    defaultValue: isKorean ? '확인' : 'Confirm',
  });
  const dismissLabel = t('common:alarms.criticalBannerDismiss', {
    defaultValue: isKorean ? '닫기' : 'Dismiss',
  });

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={titleLabel}
      className={`animate-in slide-in-from-top-4 fade-in-0 duration-300 flex w-105 max-w-[90vw] items-start gap-3 rounded-lg border-2 p-4 text-white shadow-2xl backdrop-blur-sm ${style.container}`}
    >
      <AlertTriangle
        className="mt-0.5 size-6 shrink-0 animate-pulse"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide uppercase opacity-90">
          {titleLabel}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold">{alarm.craneName}</p>
        <p className="mt-0.5 line-clamp-2 text-xs opacity-95">{description}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className={style.confirm}
          onClick={onDismiss}
        >
          {confirmLabel}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/20"
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
