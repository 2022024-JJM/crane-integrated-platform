import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import {
  selectionOfDate,
  selectionOfPreset,
  todayString,
  windowOf,
  type BaseDateSelection,
} from '../lib/baseDate'

/*
 * 기준일 컨트롤 — 통합실적 머리에 서는 시간축 조작 자리 (W7-2).
 *
 * 별도 화면을 두지 않기로 했으므로(사용자 확정) 이 컨트롤이 곧 시간축 UI 전부다.
 * 그래서 두 가지를 한 줄에 담는다 — 자주 쓰는 세 자리(오늘·어제·지난 7일)를 버튼으로,
 * 그 밖의 하루는 달력으로. 프리셋만 두면 "저번 주 화요일"을 못 보고, 달력만 두면 가장
 * 흔한 세 동작에 매번 달력을 연다.
 *
 * 판단 둘:
 *  · **달력의 max 는 오늘이다.** 미래 실적은 없다 — 고를 수 없어야 고르고 나서 빈 화면을
 *    보지 않는다(모델도 같은 규칙을 다시 지킨다: `selectionOfDate` 가 접는다).
 *  · **고른 상태를 버튼이 되비춘다.** 달력으로 어제를 고르면 '어제' 버튼이 눌린 것으로
 *    선다 — 같은 상태를 두 가지로 보여 주면 어느 쪽이 참인지 알 수 없다(그 판정은
 *    `selectionOfDate` 가 하고 여기서 다시 하지 않는다).
 */

const PRESETS = [
  { preset: 'today', labelKey: 'performance.dateRange.today' },
  { preset: 'yesterday', labelKey: 'performance.dateRange.yesterday' },
  { preset: 'last7', labelKey: 'performance.dateRange.last7' },
] as const

export interface BaseDateControlProps {
  selection: BaseDateSelection
  onChange: (selection: BaseDateSelection) => void
  /** 오늘 — 주입 가능하게 둔다(테스트가 시계에 묶이지 않도록) */
  today?: string
  className?: string
}

export function BaseDateControl({
  selection,
  onChange,
  today = todayString(),
  className,
}: BaseDateControlProps) {
  const { t } = useTranslation()
  const range = windowOf(selection)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        role="group"
        aria-label={t('performance.dateRange.label')}
        className="flex items-center gap-1 rounded-inshop-md border border-border p-0.5"
      >
        {PRESETS.map(({ preset, labelKey }) => (
          <button
            key={preset}
            type="button"
            aria-pressed={selection.preset === preset}
            onClick={() => onChange(selectionOfPreset(preset, today))}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              selection.preset === preset
                ? 'bg-accent/12 text-accent'
                : 'text-foreground/60 hover:text-foreground'
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-foreground/55">
        <span>{t('performance.dateRange.pick')}</span>
        <input
          type="date"
          value={selection.date}
          max={today}
          onChange={(event) => onChange(selectionOfDate(event.target.value, today))}
          className="rounded-inshop-md border border-border bg-surface px-2 py-1 text-[11px] tabular-nums text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      {/* 창이 하루보다 길면 그 범위를 말한다 — 기준일만 적어 두면 7일치를 보면서
          하루치로 읽게 된다 */}
      <span className="text-[11px] tabular-nums text-foreground/45">
        {selection.spanDays > 1
          ? t('performance.dateRange.window', { from: range.from, to: range.to })
          : t('performance.baseDate', { date: selection.date })}
      </span>
    </div>
  )
}
