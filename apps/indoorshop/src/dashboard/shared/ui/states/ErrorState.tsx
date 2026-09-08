import { useTranslation } from '../../lib/i18n/useTranslation'
import { cn } from '../../lib/utils'
import { useTimeFormat } from '../../lib/i18n/useTimeFormat'
import { Button } from '../atoms/Button'
import type { StateTone } from './Skeleton'

/*
 * 실패 상태 — 못 불러왔다는 사실 + **다시 해 볼 문** + **마지막으로 성공한 때**.
 *
 * 마지막 성공 시각이 요점이다. 현장 화면에서 "지금 값을 못 받았다"보다 중요한 것은
 * "그럼 내가 지금 보고 있던 값은 언제 것인가"이기 때문이다. 5분 전이면 기다리면 되고
 * 어제부터라면 사람을 불러야 한다 — 그 판단이 이 한 줄에 달려 있다.
 *
 * 오류 원문(`error.message`)은 화면에 그대로 내지 않는다. 현장 사용자에게 스택이나
 * HTTP 상태는 읽을 수 없는 말이고, 대신 `title` 속성으로 남겨 개발자가 손 얹어 볼 수
 * 있게 한다. 사람이 읽는 문구가 필요하면 호출부가 `description` 으로 준다.
 */

export interface ErrorStateProps {
  /**
   * 실패의 원인. 화면에는 원문을 내지 않고 툴팁으로만 남긴다.
   * (비동기 훅의 `error` 채널을 그대로 받는 자리 — `Error | null` 계약)
   */
  error?: Error | null
  /** 기본 문구를 덮어쓴다 */
  title?: React.ReactNode
  /** 사람이 읽는 원인 설명 — `null` 이면 제목만 남는다 */
  description?: React.ReactNode | null
  /** 다시 시도 — 주면 버튼이 서고, 없으면 서지 않는다(되돌릴 방법이 없는 자리) */
  onRetry?: () => void
  /** 다시 시도가 진행 중 — 버튼을 잠가 연타를 막는다 */
  retrying?: boolean
  /** 마지막으로 성공한 시각 (ISO). 상대 표기로 내고 정확한 시각은 툴팁에 싣는다 */
  lastSuccessAt?: string | null
  /** 마지막 성공 줄을 통째로 대신 그리는 슬롯 — 이미 서식이 끝난 값을 가진 화면용 */
  lastSuccess?: React.ReactNode
  tone?: StateTone
  size?: 'sm' | 'md'
  className?: string
}

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  retrying = false,
  lastSuccessAt,
  lastSuccess,
  tone = 'surface',
  size = 'md',
  className,
}: ErrorStateProps) {
  const { t } = useTranslation()
  const time = useTimeFormat()

  const lastSuccessLine =
    lastSuccess ??
    (lastSuccessAt !== undefined ? (
      <span title={lastSuccessAt ? time.absolute(lastSuccessAt) : undefined}>
        {lastSuccessAt
          ? t('states.error.lastSuccess', { time: time.relative(lastSuccessAt) })
          : t('states.error.neverSucceeded')}
      </span>
    ) : null)

  return (
    <div
      /* 실패는 사용자가 놓치면 안 되는 변화다 — 빈 상태와 달리 alert 로 알린다 */
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-inshop-lg border text-center',
        size === 'sm' ? 'gap-1 px-3 py-3' : 'gap-1.5 px-4 py-8',
        tone === 'glass'
          ? 'border-white/12 bg-status-unhealthy/10'
          : 'border-status-unhealthy/40 bg-status-unhealthy/5',
        className,
      )}
    >
      <p
        title={error?.message}
        className={cn(
          'font-medium',
          size === 'sm' ? 'text-2xs' : 'text-inshop-sm',
          tone === 'glass' ? 'text-white/85' : 'text-status-unhealthy',
        )}
      >
        {title ?? t('states.error.title')}
      </p>
      {description !== null && (
        <p
          className={cn(
            'max-w-prose leading-relaxed',
            size === 'sm' ? 'text-[10px]' : 'text-inshop-xs',
            tone === 'glass' ? 'text-white/50' : 'text-foreground/55',
          )}
        >
          {description ?? t('states.error.description')}
        </p>
      )}
      {lastSuccessLine && (
        <p
          className={cn(
            'tabular-nums',
            size === 'sm' ? 'text-[10px]' : 'text-inshop-xs',
            tone === 'glass' ? 'text-white/40' : 'text-foreground/45',
          )}
        >
          {lastSuccessLine}
        </p>
      )}
      {onRetry &&
        (tone === 'glass' ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className={cn(
              'mt-1.5 rounded-inshop-md border border-white/20 px-2.5 py-1 text-2xs font-medium text-white/85',
              'transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {t('states.error.retry')}
          </button>
        ) : (
          <Button size="sm" onClick={onRetry} disabled={retrying} className="mt-1.5">
            {t('states.error.retry')}
          </Button>
        ))}
    </div>
  )
}
