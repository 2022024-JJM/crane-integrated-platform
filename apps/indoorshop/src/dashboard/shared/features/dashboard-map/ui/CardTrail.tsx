import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { ChevronRightIcon } from '../../../ui/icons'

/** 경로 한 조각 — `href` 가 있으면 누를 수 있다, 없으면 글자(문맥) */
export interface CardTrailStep {
  key: string
  label: string
  href: string | null
  /** 조각 앞에 찍을 색 점 — 공정 조각이 그 공정 색을 단다 */
  dot?: string
}

/*
 * 왼쪽 카드 머리의 **뎁스 경로** — 카드 제목까지 온 길(`공장 목록 › 조립 › PBS`, 제목 5BAY).
 *
 * 예전에는 앱 헤더에 이어 붙였다. 지금 보고 있는 카드와 그 카드까지 온 길이 화면 양 끝에
 * 갈라져 있으면 눈이 오가야 하므로, 카드 맨 위(뒤로 버튼 자리)로 옮겼다. 조각을 누르면 그
 * 단계의 주소로 간다 — 상태를 따로 들지 않으므로 브라우저 뒤로가기와 어긋날 수 없다.
 * 지금 자리는 바로 아래 카드 제목이 말하므로 경로에 다시 적지 않는다.
 */
export function CardTrail({ steps, className }: { steps: readonly CardTrailStep[]; className?: string }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('dashboard.map.cardTrail')} className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-inshop-sm leading-normal">
        {/* 조각 사이의 '›' 는 두지 않는다 — 칩마다 '<' 가 있어 순서가 읽힌다(사용자 확정) */}
        {steps.map((step) => (
          <li key={step.key} className="flex min-w-0 items-center gap-1.5">
            {step.dot && (
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: step.dot }} />
            )}
            {step.href ? (
              <Link
                to={step.href}
                /* 버튼처럼 보이게 — 테두리·바탕이 있어야 글자가 아니라 누를 곳으로 읽힌다(사용자 확정) */
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-inshop-md border border-white/15 bg-white/[0.07] py-1 pl-1.5 pr-2.5 text-inshop-sm font-medium text-white/85 transition-colors hover:border-white/30 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {/* 앞의 '<' — 누르면 그 단계로 **돌아간다**는 표시(사용자 확정) */}
                <ChevronRightIcon size={15} className="shrink-0 rotate-180 text-white/60" />
                {step.label}
              </Link>
            ) : (
              <span className="whitespace-nowrap text-inshop-sm text-white/50">{step.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
