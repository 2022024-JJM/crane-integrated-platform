import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { useEscapeClaim } from '../../../lib/escapeClaims'
import { cn } from '../../../lib/utils'
import type { TourDefinition, TourStep } from '../model/types'

/*
 * 코치마크 층 (W8-1) — 대상 요소를 스포트라이트(컷아웃)로 비추고 말풍선을 붙인다.
 *
 * 층 전체는 클릭을 막는다(반투명 장막) — 투어 중의 화면은 읽는 것이지 조작하는 것이
 * 아니다. 조작은 말풍선의 [다음]/[건너뛰기] 와 ESC 뿐이다. ESC 는 escapeClaims 에
 * 우선권을 등록해 뒤의 드릴다운 ESC 가 같이 움직이지 않는다(W7-6C 규칙).
 *
 * 대상을 찾는 눈은 `[data-tour="…"]` 속성이다. lazy 청크(지도)가 아직 안 붙었으면
 * 잠시 재시도하고, 끝내 없으면 컷아웃 없이 말풍선만 화면 가운데 세운다 — 대상이
 * 없다고 투어가 통째로 죽는 것보다 낫다.
 */

/** 컷아웃과 대상 사이 여백(px) */
const SPOT_PADDING = 8
/** 대상 탐색 재시도 간격/횟수 — lazy 청크가 붙을 시간(~3s)을 준다 */
const FIND_RETRY_MS = 150
const FIND_RETRY_MAX = 20

interface SpotRect {
  left: number
  top: number
  width: number
  height: number
}

function rectOfTarget(target: string): SpotRect | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const box = el.getBoundingClientRect()
  if (box.width === 0 && box.height === 0) return null
  return { left: box.left, top: box.top, width: box.width, height: box.height }
}

/** 말풍선을 컷아웃 아래/위 어느 쪽에 세울까 — 둘 다 모자라면(지도처럼 화면을 다
    차지하는 대상) 가운데에 겹쳐 세운다. 위로 밀다 화면 밖으로 나가면 머리가 잘린다 */
function balloonPlacement(rect: SpotRect | null): 'below' | 'above' | 'center' {
  if (!rect) return 'center'
  if (typeof window === 'undefined') return 'below'
  if (window.innerHeight - (rect.top + rect.height) > 220) return 'below'
  if (rect.top > 220) return 'above'
  return 'center'
}

export function TourOverlay({
  tour,
  onClose,
}: {
  tour: TourDefinition
  /** 끝·건너뛰기·ESC — 모두 같은 문이다. 호출부가 '봤음'을 영구 기억한다 */
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const step: TourStep = tour.steps[index]
  const [rect, setRect] = useState<SpotRect | null>(null)

  /* 투어가 떠 있는 동안 ESC 우선권을 쥔다 — 드릴다운 ESC 가 같이 움직이지 않게 */
  useEscapeClaim(true)

  /* 대상 측정 — 스텝이 바뀔 때 찾고, 없으면 잠시 재시도(lazy 청크), 크기 변화를 따라간다 */
  useEffect(() => {
    let tries = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const measure = () => {
      const next = rectOfTarget(step.target)
      setRect(next)
      if (!next && tries < FIND_RETRY_MAX) {
        tries += 1
        timer = setTimeout(measure, FIND_RETRY_MS)
      }
    }
    measure()
    const remeasure = () => setRect(rectOfTarget(step.target))
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [step.target])

  const next = useCallback(() => {
    if (index + 1 >= tour.steps.length) onClose()
    else setIndex(index + 1)
  }, [index, tour.steps.length, onClose])

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  /* ESC = 투어 종료 — 이 층이 소비했다고 못박는다(preventDefault) */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const placement = balloonPlacement(rect)
  const last = index === tour.steps.length - 1

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('tour.aria')}
      data-tour-overlay={tour.id}
      className="fixed inset-0 z-[70]"
    >
      {/* 스포트라이트 — 컷아웃 밖 전부를 장막이 덮는다. 컷아웃은 그림자 트릭 하나로 판다 */}
      {rect ? (
        <div
          aria-hidden="true"
          data-tour-spot={step.id}
          className="absolute rounded-inshop-xl transition-all duration-300"
          style={{
            left: rect.left - SPOT_PADDING,
            top: rect.top - SPOT_PADDING,
            width: rect.width + SPOT_PADDING * 2,
            height: rect.height + SPOT_PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(4, 8, 14, 0.62)',
            outline: '1px solid rgba(255,255,255,0.35)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(4,8,14,0.62)]" />
      )}

      {/* 말풍선 — 컷아웃 아래(모자라면 위), 대상이 없으면 화면 가운데 */}
      <div
        className={cn('absolute w-[min(92vw,21rem)]')}
        style={
          placement === 'center' || !rect
            ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
            : {
                left: Math.min(
                  Math.max(12, rect.left),
                  Math.max(12, window.innerWidth - 348)
                ),
                ...(placement === 'below'
                  ? { top: rect.top + rect.height + SPOT_PADDING + 12 }
                  : { bottom: window.innerHeight - rect.top + SPOT_PADDING + 12 }),
              }
        }
      >
        <div className="rounded-inshop-xl border border-white/15 bg-[#0b0e12]/95 p-4 text-white shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <p className="text-2xs font-medium tabular-nums text-white/45">
            {t('tour.progress', { current: index + 1, total: tour.steps.length })}
          </p>
          <h2 className="mt-1 text-inshop-sm font-semibold tracking-[-0.01em]">{t(step.titleKey)}</h2>
          <p className="mt-1.5 text-inshop-xs leading-relaxed text-white/72">{t(step.bodyKey)}</p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-inshop-md px-2 py-1.5 text-inshop-xs text-white/55 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t('tour.skip')}
            </button>
            <span className="flex-1" />
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="rounded-inshop-md px-2.5 py-1.5 text-inshop-xs text-white/70 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {t('tour.back')}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-inshop-md bg-accent px-3 py-1.5 text-inshop-xs font-semibold text-white transition-colors hover:bg-accent/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {last ? t('tour.done') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(body, document.body)
}
