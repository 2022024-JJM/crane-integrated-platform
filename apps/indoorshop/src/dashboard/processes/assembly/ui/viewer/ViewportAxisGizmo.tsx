import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../../shared/lib/i18n/keys'
import type { ViewDirection } from '../../lib/blenderControls'
import type { AxisViewState } from '../../lib/axisGizmo'
import { cn } from '../../../../shared/lib/utils'

interface ViewportAxisGizmoProps {
  view: AxisViewState | null
  onSelectDirection: (direction: ViewDirection) => void
  onGoHome: () => void
  className?: string
}

/** 기즈모 원의 반지름(px) — 축 끝이 원 안에 들어오도록 라벨 반지름만큼 줄여 쓴다 */
const RADIUS = 27
const CENTER = 36
const KNOB = 8.5

const directionNameKey: Record<ViewDirection, InshopKey> = {
  front: 'viewer.gizmo.front',
  back: 'viewer.gizmo.back',
  right: 'viewer.gizmo.right',
  left: 'viewer.gizmo.left',
  top: 'viewer.gizmo.top',
  bottom: 'viewer.gizmo.bottom',
}

/**
 * 좌표축 기즈모.
 *
 * 축을 보여주기만 하면 "지금 어디서 보고 있는지"는 알아도 원하는 시점으로는
 * 못 간다 — 그래서 축 끝이 곧 버튼이다 (+X 를 누르면 우측면).
 * 숫자 좌표(궤도 중심·거리)를 함께 내는 이유는, 정반 두 개를 오가며 볼 때
 * "같은 자리를 보고 있는가"를 눈대중이 아니라 값으로 맞출 수 있어야 해서다.
 *
 * 기즈모·좌표·처음위치는 **한 장의 유리** 안에 둔다. 예전처럼 판을 둘로 나누면
 * 뷰포트 구석에 상자가 두 개 겹쳐 보여, 하나의 도구가 아니라 잔해처럼 읽힌다.
 */
export function ViewportAxisGizmo({
  view,
  onSelectDirection,
  onGoHome,
  className,
}: ViewportAxisGizmoProps) {
  const { t } = useTranslation()

  if (!view) return null

  return (
    <div
      className={cn(
        'absolute bottom-4 left-4 w-fit overflow-hidden rounded-inshop-lg glass-panel',
        className,
      )}
      role="group"
      aria-label={t('viewer.gizmo.group')}
    >
      {/* 축 구를 유리 가장자리에 붙이지 않는다 — 노브가 테두리에 닿으면 잘려 보인다 */}
      <div className="p-1.5">
        <svg width={CENTER * 2} height={CENTER * 2} className="mx-auto block">
          {/* 축 선 — 원점에서 각 끝으로. 뒤쪽 축은 흐리게 눕혀 앞뒤가 읽히게 한다 */}
          {view.ends.map((end) => {
            const x = CENTER + end.x * RADIUS
            const y = CENTER + end.y * RADIUS
            const behind = end.depth < 0
            return (
              <line
                key={`line-${end.id}`}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke={end.color}
                strokeWidth={end.positive ? 2 : 1.5}
                strokeLinecap="round"
                opacity={behind ? 0.28 : 0.85}
              />
            )
          })}

          {/* 축 끝 — 클릭 대상. 정렬된 순서대로 그리므로 앞쪽이 위에 온다 */}
          {view.ends.map((end) => {
            const x = CENTER + end.x * RADIUS
            const y = CENTER + end.y * RADIUS
            const behind = end.depth < 0
            const axis = `${end.positive ? '+' : '−'}${end.label}`
            const title = `${axis} · ${t(directionNameKey[end.direction])}`

            return (
              <g
                key={`knob-${end.id}`}
                role="button"
                tabIndex={0}
                aria-label={t('viewer.gizmo.viewAria', {
                  axis,
                  view: t(directionNameKey[end.direction]),
                })}
                onClick={() => onSelectDirection(end.direction)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectDirection(end.direction)
                  }
                }}
                className="outline-none focus-visible:opacity-100"
              >
                <title>{title}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={KNOB}
                  /* 음축은 속이 빈 원이다 — 유리 위이므로 바탕이 아니라 유리보다 짙은 색으로 채운다 */
                  fill={end.positive ? end.color : 'rgb(16 21 28 / 0.72)'}
                  stroke={end.color}
                  strokeWidth={1.5}
                  opacity={behind ? 0.45 : 1}
                />
                {end.positive && (
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={9}
                    fontWeight={700}
                    fill="#ffffff"
                    opacity={behind ? 0.6 : 1}
                    className="pointer-events-none select-none"
                  >
                    {end.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/*
        좌표 읽기 — 같은 유리 안에서 실선 한 겹으로만 갈라 둔다.
        축 구가 가운데 서 있으므로 아래 숫자도 가운데로 모은다 — 양끝으로 밀면
        기즈모와 축이 어긋나 보이고, 값이 한 자리 늘 때마다 글자가 좌우로 흔들린다.
      */}
      <div className="border-t border-glass-border/70 px-2.5 pb-2 pt-2">
        <dl className="flex items-center justify-center gap-2.5 font-mono text-2xs tabular-nums">
          {(['X', 'Y', 'Z'] as const).map((label, index) => (
            <div key={label} className="flex items-baseline gap-0.5">
              <dt className="text-glass-foreground/50">{label}</dt>
              <dd className="text-glass-foreground/80">{view.target[index].toFixed(1)}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-1.5 flex items-center justify-center gap-1 font-mono text-2xs tabular-nums">
          <span className="text-glass-foreground/50">{t('viewer.gizmo.distance')}</span>
          <span className="text-glass-foreground/80">{view.distance.toFixed(1)}m</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onGoHome}
        title={t('viewer.gizmo.home')}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 border-t border-glass-border/70 px-2.5 py-2',
          'text-2xs font-medium text-glass-foreground/68 transition-colors',
          'hover:bg-glass-hover hover:text-glass-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glass-accent',
        )}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
          <path
            d="M1.5 5.6 6 1.8l4.5 3.8M2.9 5v5.2h6.2V5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t('viewer.help.home')}
      </button>
    </div>
  )
}
