import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import type { LidarHistoryEvent } from '../../model/lidarBlock'

interface LidarHistoryTimelineProps {
  history: LidarHistoryEvent[]
}

export function LidarHistoryTimeline({ history }: LidarHistoryTimelineProps) {
  const { t } = useTranslation()

  if (history.length === 0) {
    return <p className="text-inshop-sm text-foreground/68">{t('blocks.noHistory')}</p>
  }

  return (
    <ul className="space-y-3">
      {history.map((entry, index) => (
        <li key={index} className="flex items-center gap-4 border-l-2 border-border pl-4">
          <span className="w-12 shrink-0 font-mono text-inshop-sm text-foreground/68">
            {entry.timestamp}
          </span>
          <span className="flex-1 text-inshop-sm text-foreground">{entry.event}</span>
          {entry.progress !== undefined && (
            <span className="flex shrink-0 items-center gap-2" title={t('blocks.progressTitle', { percent: entry.progress })}>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-secondary">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${entry.progress}%` }}
                />
              </span>
              <span className="w-9 text-right font-mono text-inshop-xs font-semibold text-foreground">
                {entry.progress}%
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
