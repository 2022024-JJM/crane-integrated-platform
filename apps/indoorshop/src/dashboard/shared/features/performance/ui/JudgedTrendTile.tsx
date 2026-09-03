import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { Sparkline } from '../../../ui/atoms/Sparkline'
import { judgedTotalOf, type JudgedDayCount } from '../lib/judgedTrend'

/*
 * 조립 **일자별 인식 추이** 타일 — 조립 섹션 머리에 선다 (W7-2).
 *
 * 조립 카드가 말하는 "몇 개 중 몇 개"는 누적이라 **언제** 들어왔는지를 지운다. 이 타일이
 * 그 하나를 되살린다: 창 안의 날마다 몇 건이 판별됐는가. 수집이 하루 멈춘 것은 누적
 * 수치로는 보이지 않지만 여기서는 빈 칸으로 곧장 보인다.
 *
 * 하루짜리 창(기준일 하루)에서는 막대가 하나뿐이라 추이가 아니다 — 그럴 때는 그림을
 * 세우지 않고 건수만 말한다(`Sparkline` 이 점 2개 미만이면 null 을 내므로 저절로 그렇게
 * 된다). 창을 '지난 7일' 로 넓히면 그때 그림이 선다.
 */
export function JudgedTrendTile({
  trend,
  className,
}: {
  trend: readonly JudgedDayCount[]
  className?: string
}) {
  const { t } = useTranslation()
  const total = judgedTotalOf(trend)

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-inshop-md border border-border px-2.5 py-1.5',
        className
      )}
    >
      <span className="text-[11px] text-foreground/55">{t('performance.asm.trendTitle')}</span>
      <Sparkline
        variant="bars"
        points={trend.map((day) => ({ label: day.date, value: day.count }))}
        ariaLabel={t('performance.asm.trendAria')}
        unit={t('performance.asm.trendUnit')}
        className="text-accent"
        width={72}
        height={18}
      />
      <span className="font-mono text-inshop-xs tabular-nums text-foreground/85">
        {t('performance.asm.trendTotal', { count: total })}
      </span>
    </div>
  )
}
