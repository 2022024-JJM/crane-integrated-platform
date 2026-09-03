import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/*
 * 드릴다운 자취 — `야드 › 조립 › GBS › 3BAY`.
 *
 * 이것은 **상태가 아니라 URL 의 표현**이다. 조각을 누르면 그 단계의 주소로 갈 뿐이고,
 * 지금 어디인지는 언제나 URL 이 말한다(`shared/lib/drilldownUrl`). 그래서 브라우저
 * 뒤로가기와 이 줄은 같은 계단을 오르내린다 — 둘이 어긋날 수가 없다.
 *
 * 조각은 진짜 `<a>` 다. 가운데 클릭으로 새 탭에 열고, 주소를 복사해 건넬 수 있어야
 * "자리를 공유한다"가 성립한다 — onClick 핸들러로 흉내 내면 그게 안 된다.
 */

export interface BreadcrumbStep {
  /** React key 이자 테스트가 짚는 이름 */
  key: string
  label: string
  /** 갈 곳. null 이면 **지금 서 있는 자리**라 링크가 아니다 */
  href: string | null
}

export function DrilldownBreadcrumb({
  steps,
  label,
  className,
}: {
  steps: readonly BreadcrumbStep[]
  /** nav 의 접근성 이름 — 화면마다 번역이 다르므로 밖에서 받는다 */
  label: string
  className?: string
}) {
  if (steps.length === 0) return null

  return (
    <nav
      aria-label={label}
      className={cn(
        'flex max-w-full items-center gap-1 overflow-hidden rounded-inshop-lg border border-white/10',
        'bg-[#0b0e12]/88 px-2.5 py-1.5 text-2xs backdrop-blur-md',
        className,
      )}
    >
      <ol className="flex min-w-0 items-center gap-1">
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <Fragment key={step.key}>
              {index > 0 && (
                <li aria-hidden="true" className="shrink-0 text-white/28">
                  ›
                </li>
              )}
              <li className="min-w-0">
                {step.href == null ? (
                  /* 지금 자리 — 링크가 아니므로 스크린리더에도 현재로 알린다 */
                  <span
                    aria-current="page"
                    className="block truncate font-medium text-white/92"
                    title={step.label}
                  >
                    {step.label}
                  </span>
                ) : (
                  <Link
                    to={step.href}
                    className={cn(
                      'block truncate rounded px-0.5 text-white/58 transition-colors',
                      'hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                      last && 'text-white/92',
                    )}
                    title={step.label}
                  >
                    {step.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
