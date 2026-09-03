import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'

/*
 * 도면 뷰어 — 큰 이미지 한 장을 줌·팬으로 뜯어보는 모달.
 *
 * 왜 모달인가: 배치 도면은 **참조**다. 지금 보고 있던 목록·지도를 잃지 않고 잠깐 열어
 * 확인하고 닫는 성격이라, 새 라우트로 화면을 갈아치우면 되돌아오는 값이 더 크다.
 *
 * 조작은 이미지 뷰어의 관습을 그대로 따른다 — 휠로 커서 기준 줌, 끌어서 팬, 더블클릭으로
 * 원래대로, Esc 로 닫기. 접근성을 위해 +/-/0 키도 같은 일을 한다(휠이 없는 환경).
 *
 * 이 feature 는 `@/processes/**` 를 모른다 — 이미지 한 장과 제목만 받는다.
 */

interface DrawingViewerModalProps {
  /** 이미지 경로 */
  src: string
  /** 모달 제목 (도명) */
  title: string
  /** 제목 옆 부제 — 도번·개정 같은 출처 표기 */
  subtitle?: string
  /** 원본 픽셀 크기 — 로드 전에 자리를 잡아 화면이 튀지 않게 한다 */
  width: number
  height: number
  onClose: () => void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 8
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function DrawingViewerModal({
  src,
  title,
  subtitle,
  width,
  height,
  onClose,
}: DrawingViewerModalProps) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  /* scale=0 은 '아직 맞춤 배율을 못 정했다' — 첫 측정 뒤에 화면 폭에 맞춘다 */
  const [view, setView] = useState({ scale: 0, x: 0, y: 0 })
  const [fitScale, setFitScale] = useState(1)
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  /* 무대 크기에 맞춘 배율 — 도면 전체가 한눈에 들어오는 자리에서 시작한다 */
  const fitToStage = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const pad = 24
    const scale = Math.min(
      (stage.clientWidth - pad) / width,
      (stage.clientHeight - pad) / height
    )
    const next = clamp(scale, MIN_SCALE, MAX_SCALE)
    setFitScale(next)
    setView({ scale: next, x: 0, y: 0 })
  }, [width, height])

  useEffect(() => {
    fitToStage()
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(() => fitToStage())
    observer.observe(stage)
    return () => observer.disconnect()
  }, [fitToStage])

  /* 열리면 닫기 버튼으로 포커스를 옮긴다 — 키보드 사용자가 모달 안에서 시작하도록 */
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === '0') {
        fitToStage()
        return
      }
      if (e.key === '+' || e.key === '=') {
        setView((v) => ({ ...v, scale: clamp(v.scale * 1.25, MIN_SCALE, MAX_SCALE) }))
        return
      }
      if (e.key === '-') {
        setView((v) => ({ ...v, scale: clamp(v.scale / 1.25, MIN_SCALE, MAX_SCALE) }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, fitToStage])

  /*
   * 커서 기준 줌 — 커서가 짚고 있는 점이 제자리에 남아야 "여기를 확대"가 된다.
   *
   * React 의 `onWheel` 은 루트에 **passive** 로 붙어 `preventDefault()` 가 먹지 않는다 —
   * 그러면 확대하는 동안 뒤 페이지가 같이 스크롤된다. 그래서 무대에 직접, passive 를 끄고
   * 건다.
   */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = stage!.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2
      setView((v) => {
        const next = clamp(v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_SCALE, MAX_SCALE)
        const k = v.scale > 0 ? next / v.scale : 1
        return { scale: next, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    setView((v) => ({ ...v, x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) }))
  }
  const endDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  const zoomPercent = view.scale > 0 && fitScale > 0 ? Math.round((view.scale / fitScale) * 100) : 100

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[#080a0d]/92 backdrop-blur-sm"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-4 py-2.5">
        <h2 className="text-inshop-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="font-mono text-2xs text-white/45">{subtitle}</p>}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="font-mono text-2xs tabular-nums text-white/55">{zoomPercent}%</span>
          <button
            type="button"
            onClick={fitToStage}
            className="rounded border border-white/15 px-2 py-1 text-2xs text-white/75 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {t('drawing.fit')}
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded border border-white/15 px-2 py-1 text-2xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {t('common.close')}
          </button>
        </div>
      </header>

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={fitToStage}
        className={cn(
          'relative flex-1 touch-none select-none overflow-hidden',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
      >
        <img
          src={src}
          alt={title}
          width={width}
          height={height}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-w-none origin-center bg-white"
          style={{
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale || 0.01})`,
            transformOrigin: 'center',
          }}
        />
      </div>

      <footer className="shrink-0 border-t border-white/10 px-4 py-1.5 text-2xs text-white/40">
        {t('drawing.hint')}
      </footer>
    </div>,
    document.body
  )
}
