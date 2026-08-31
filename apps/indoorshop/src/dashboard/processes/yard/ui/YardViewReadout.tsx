import { forwardRef, useImperativeHandle, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import { metersPer100px, type YardView } from '../lib/projection'

export interface YardViewReadoutHandle {
  update: (view: YardView) => void
}

interface YardViewReadoutProps {
  onGoHome: () => void
  className?: string
}

/**
 * 좌표·배율 표시와 전체 보기.
 *
 * 3D 뷰포트의 좌표축 기즈모와 같은 자리(왼쪽 아래)·같은 유리에 둔다 — 두 화면이
 * 같은 규칙으로 움직인다는 것을 자리로 말한다. 다만 야드는 평면이라 축 대신
 * **위경도와 축척**을 낸다: 현장이 부르는 이름이 지번이고, 지번을 못 찾을 때
 * 마지막으로 기대는 것이 좌표다 — 베이스맵과 같은 WGS84 라 지도 앱에 그대로 넣힌다.
 *
 * 카메라는 비행·드래그 중 **매 프레임** 바뀐다. 뷰를 워크스페이스의 state 로 받으면
 * 이 작은 상자 때문에 화면 전체(수백 줄 목록 포함)가 프레임마다 리렌더돼 3D
 * 애니메이션이 끈적해진다 — 그래서 뷰는 imperative handle 로 받아 여기만 다시 그린다.
 */
export const YardViewReadout = forwardRef<YardViewReadoutHandle, YardViewReadoutProps>(
  function YardViewReadout({ onGoHome, className }, ref) {
  const { t } = useTranslation()
  const [view, setView] = useState<YardView | null>(null)
  useImperativeHandle(ref, () => ({ update: setView }), [])
  if (!view) return null

  const meters = metersPer100px(view)

  return (
    <div
      className={cn(
        'absolute bottom-3 left-3 w-fit overflow-hidden rounded-inshop-lg glass-panel',
        className,
      )}
    >
      <div className="px-2.5 pb-2 pt-2">
        <dl className="flex items-center justify-center gap-2.5 font-mono text-2xs tabular-nums">
          <div className="flex items-baseline gap-0.5">
            <dt className="text-glass-foreground/50">N</dt>
            <dd className="text-glass-foreground/80">{view.centerLat.toFixed(5)}</dd>
          </div>
          <div className="flex items-baseline gap-0.5">
            <dt className="text-glass-foreground/50">E</dt>
            <dd className="text-glass-foreground/80">{view.centerLon.toFixed(5)}</dd>
          </div>
        </dl>
        <div className="mt-1.5 flex items-center justify-center gap-1 font-mono text-2xs tabular-nums">
          <span className="text-glass-foreground/50">{t('yard.readout.scale')}</span>
          <span className="text-glass-foreground/80">
            100px = {meters < 10 ? meters.toFixed(1) : meters.toFixed(0)}m
          </span>
        </div>

        {/*
          기울여 놓고 돌리면 북쪽을 잃는다 — 그때 "어디를 보고 있는가"를 되찾는 값이
          이 두 개다. 평면에서는 늘 0°/북쪽이라 낼 이유가 없어 아예 뜨지 않는다.
        */}
        {view.pitch > 0 && (
          <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-2xs tabular-nums">
            <span className="text-glass-foreground/50">{t('yard.readout.bearing')}</span>
            <span className="text-glass-foreground/80">{Math.round(view.bearing)}°</span>
            <span aria-hidden="true" className="text-glass-foreground/30">
              ·
            </span>
            <span className="text-glass-foreground/50">{t('yard.readout.pitch')}</span>
            <span className="text-glass-foreground/80">{Math.round(view.pitch)}°</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onGoHome}
        title={t('yard.readout.fitTitle')}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 border-t border-glass-border/70 px-2.5 py-2',
          'text-2xs font-medium text-glass-foreground/68 transition-colors',
          'hover:bg-glass-hover hover:text-glass-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glass-accent',
        )}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
          <path
            d="M1.5 4.2V1.5h2.7M10.5 4.2V1.5H7.8M1.5 7.8v2.7h2.7M10.5 7.8v2.7H7.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t('yard.readout.fit')}
      </button>
    </div>
  )
  }
)
