import { useTranslation } from '../../lib/i18n/useTranslation'
import type { InshopKey } from '../../lib/i18n/keys'
import { cn } from '../../lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  labelKey: InshopKey
  /** 툴팁·보조 설명 — 세그먼트 라벨만으로 뜻이 안 서는 경우 */
  descriptionKey?: InshopKey
}

interface SegmentedProps<T extends string> {
  /** 무엇을 고르는 묶음인지 — 라벨을 숨기려면 `hideLegend` */
  legend: string
  hideLegend?: boolean
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  /**
   * 어떤 바탕 위에 서는가.
   * `glass` 는 3D 뷰포트 위에 뜨는 유리 패널용 — 그 위에서는 면 색(surface)이
   * 배경을 가려 유리가 아니게 되고, 본문 글자색은 어두운 점군에 묻힌다.
   */
  tone?: 'surface' | 'glass'
  className?: string
}

const segmentSize = {
  sm: 'px-2.5 py-1 text-inshop-xs',
  md: 'px-3 py-1.5 text-inshop-sm',
}

/**
 * 세그먼트 컨트롤.
 *
 * 항목이 상호배타적이므로 라디오 그룹으로 낸다 — 탭처럼 보이지만 탭이 아니다
 * (화면을 갈아끼우는 게 아니라 지금 보고 있는 것의 표현을 바꾼다).
 * 뷰어 표시 옵션·글자 크기처럼 "몇 개 중 하나"인 설정은 전부 이 하나를 쓴다.
 */
export function Segmented<T extends string>({
  legend,
  hideLegend = false,
  value,
  options,
  onChange,
  size = 'sm',
  tone = 'surface',
  className,
}: SegmentedProps<T>) {
  const { t } = useTranslation()
  const glass = tone === 'glass'

  return (
    <fieldset className={cn('flex items-center gap-2', className)}>
      <legend className="sr-only">{legend}</legend>
      {!hideLegend && (
        <span
          aria-hidden="true"
          className={cn(
            'text-inshop-xs font-medium',
            glass ? 'text-glass-foreground/54' : 'text-foreground/54',
          )}
        >
          {legend}
        </span>
      )}
      <div
        className={cn(
          'flex rounded-inshop-md border p-0.5',
          glass ? 'border-glass-border/70' : 'border-border',
        )}
      >
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.descriptionKey ? t(option.descriptionKey) : undefined}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-inshop-xs font-medium whitespace-nowrap transition-colors',
                'focus:outline-none focus-visible:ring-2',
                glass ? 'focus-visible:ring-glass-accent' : 'focus-visible:ring-accent',
                segmentSize[size],
                glass
                  ? active
                    ? 'bg-glass-active text-glass-accent'
                    : 'text-glass-foreground/63 hover:text-glass-foreground'
                  : active
                    ? 'bg-accent/15 text-accent'
                    : 'text-foreground/68 hover:text-foreground',
              )}
            >
              {t(option.labelKey)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
