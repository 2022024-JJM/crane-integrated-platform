import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { ALARM_SEVERITY_META, alarmText, type Alarm } from '../../../entities/alarm/model/types'
import { useTimeFormat } from '../../../lib/i18n/useTimeFormat'
import { CloseIcon } from '../../../ui/icons'
import { cn } from '../../../lib/utils'

interface AlarmItemProps {
  alarm: Alarm
  onOpen: (alarm: Alarm) => void
  onDismiss: (id: string) => void
}

/**
 * 알림 한 줄.
 *
 * 안 읽은 것은 배경이 아니라 **왼쪽 점**으로만 구분한다 — 목록 절반이 틴트로
 * 채워지면 정작 심각도 색이 안 읽힌다.
 * 관련 화면이 있으면 항목 전체가 링크가 되고, 없으면 그냥 읽음 처리만 한다.
 */
export function AlarmItem({ alarm, onOpen, onDismiss }: AlarmItemProps) {
  const { t } = useTranslation()
  const time = useTimeFormat()
  const severity = ALARM_SEVERITY_META[alarm.severity]
  const { title, message } = alarmText(alarm, t)

  const body = (
    <>
      <span className="flex w-3 shrink-0 flex-col items-center pt-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', severity.dotClass)} />
        {!alarm.read && (
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-inshop-sm',
              alarm.read ? 'font-medium text-foreground/70' : 'font-semibold text-foreground',
            )}
          >
            {title}
          </span>
          <time
            dateTime={alarm.occurredAt}
            title={time.absolute(alarm.occurredAt)}
            className="shrink-0 text-2xs tabular-nums text-foreground/50"
          >
            {time.relative(alarm.occurredAt)}
          </time>
        </span>
        <span className="mt-0.5 block text-inshop-xs leading-relaxed text-foreground/63">
          {message}
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="rounded-inshop-xs bg-foreground/6 px-1.5 py-0.5 font-mono text-2xs text-foreground/58">
            {alarm.source}
          </span>
          <span className={cn('text-2xs font-medium', severity.textClass)}>{t(severity.labelKey)}</span>
        </span>
      </span>
    </>
  )

  const rowClass = cn(
    'group/alarm flex w-full items-start gap-2.5 rounded-inshop-md px-2.5 py-2.5 text-left transition-colors',
    'hover:bg-foreground/6 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  )

  return (
    <li className="relative">
      {alarm.href ? (
        <Link to={alarm.href} onClick={() => onOpen(alarm)} className={rowClass}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={() => onOpen(alarm)} className={rowClass}>
          {body}
        </button>
      )}

      {/* 지우기는 항목 위에 겹쳐 둔다 — 링크 안에 버튼을 넣으면 중첩 인터랙션이 된다 */}
      <button
        type="button"
        aria-label={t('alarms.dismiss', { title })}
        onClick={() => onDismiss(alarm.id)}
        className={cn(
          'absolute right-1 top-1 rounded-inshop-xs p-1 text-foreground/40 opacity-0 transition-opacity',
          'hover:bg-foreground/8 hover:text-foreground focus:opacity-100 focus:outline-none',
          'focus-visible:ring-2 focus-visible:ring-accent group-hover/alarm:opacity-100',
        )}
      >
        <CloseIcon size={12} />
      </button>
    </li>
  )
}
