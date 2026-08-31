import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { useTranslation } from '../../lib/i18n/useTranslation'
import {
  visibleBounds,
  type LatLonBounds,
  type Viewport,
  type YardView,
} from '../../features/yard-map'
import { colorOfProcess, type YardParcels } from '../../entities/yard-parcels'
import { cn } from '../../lib/utils'

export interface DashboardMiniMapHandle {
  updateView: (view: YardView, viewport: Viewport) => void
}

interface DashboardMiniMapProps {
  extent: LatLonBounds
  parcels: YardParcels
  onNavigate: (point: { lat: number; lon: number }) => void
  /**
   * 지금 카메라 — **처음 한 번** 그릴 밑천이다.
   *
   * 이 지도는 카메라가 움직일 때만 다시 그린다(그래야 부모가 매 프레임 렌더링되지
   * 않는다). 그래서 카메라가 멈춰 있는 동안 붙거나 다시 보이게 되면 그릴 것이 없어
   * 검은 판이 된다 — 화면이 낮아 잠시 접어 두었다 펴는 경우가 그렇다.
   */
  initialCamera?: { view: YardView; viewport: Viewport } | null
  /**
   * 자리가 빠듯할 때(상세 카드가 열린 낮은 해상도) 쓰는 작은 몸집.
   *
   * 접어 버리지 않는 것은, 전체 야드에서 지금 어디를 보고 있는지가 낮은 해상도일수록
   * 더 필요하기 때문이다 — 화면이 좁을수록 지도에 보이는 범위가 작다. 대신 몸집을
   * 줄여 상세 카드에 높이를 내준다.
   */
  compact?: boolean
}

/**
 * 전체 야드를 한눈에 보여주는 전술 지도. 메인 지도 애니메이션 중 부모 React 트리를
 * 다시 렌더링하지 않도록 카메라 위치는 imperative handle 로 받아 작은 캔버스만 갱신한다.
 */
export const DashboardMiniMap = forwardRef<DashboardMiniMapHandle, DashboardMiniMapProps>(
  function DashboardMiniMap(
    { extent, parcels, onNavigate, initialCamera = null, compact = false },
    ref
  ) {
    const { t } = useTranslation()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const latestViewRef = useRef<{ view: YardView; viewport: Viewport } | null>(null)
    const frameRef = useRef(0)
    const lastDrawRef = useRef(0)

    const draw = useCallback(() => {
      frameRef.current = 0
      const canvas = canvasRef.current
      const latest = latestViewRef.current
      if (!canvas || !latest) return

      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#071018'
      ctx.fillRect(0, 0, width, height)

      const pad = 8
      const spanLon = Math.max(0.000001, extent.maxLon - extent.minLon)
      const spanLat = Math.max(0.000001, extent.maxLat - extent.minLat)
      const x = (lon: number) => pad + ((lon - extent.minLon) / spanLon) * (width - pad * 2)
      const y = (lat: number) => pad + ((extent.maxLat - lat) / spanLat) * (height - pad * 2)

      for (const lot of parcels.lots) {
        if (lot.polygon.length < 3 || !lot.factory) continue
        ctx.beginPath()
        lot.polygon.forEach((point, index) => {
          const px = x(point.lon)
          const py = y(point.lat)
          if (index === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.fillStyle = lot.process ? colorOfProcess(lot.process) : '#53616c'
        ctx.globalAlpha = 0.7
        ctx.fill()
      }
      ctx.globalAlpha = 1

      const bounds = visibleBounds(latest.view, latest.viewport)
      const left = Math.max(pad, Math.min(width - pad, x(bounds.minLon)))
      const right = Math.max(pad, Math.min(width - pad, x(bounds.maxLon)))
      const top = Math.max(pad, Math.min(height - pad, y(bounds.maxLat)))
      const bottom = Math.max(pad, Math.min(height - pad, y(bounds.minLat)))
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(left, top, Math.max(3, right - left), Math.max(3, bottom - top))
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.lineWidth = 1.25
      ctx.strokeRect(left + 0.5, top + 0.5, Math.max(2, right - left - 1), Math.max(2, bottom - top - 1))
      lastDrawRef.current = performance.now()
    }, [extent, parcels])

    /*
     * 캔버스가 **크기를 얻는 순간** 그린다 — 붙을 때, 그리고 접혔다 펴질 때
     * (display:none 이면 폭이 0이라 그려 둔 것이 지워진다). 카메라가 다시 움직이기를
     * 기다리면 그때까지 빈 판이 서 있게 된다.
     */
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!latestViewRef.current && initialCamera) latestViewRef.current = initialCamera
      draw()
      if (typeof ResizeObserver === 'undefined') return
      const observer = new ResizeObserver(() => {
        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) draw()
      })
      observer.observe(canvas)
      return () => observer.disconnect()
    }, [draw, initialCamera])

    useImperativeHandle(
      ref,
      () => ({
        updateView(view, viewport) {
          latestViewRef.current = { view, viewport }
          if (frameRef.current) return
          const delay = Math.max(0, 50 - (performance.now() - lastDrawRef.current))
          frameRef.current = -1
          window.setTimeout(() => {
            frameRef.current = requestAnimationFrame(draw)
          }, delay)
        },
      }),
      [draw]
    )

    return (
      <aside
        aria-label={t('dashboard.map.minimap')}
        className="pointer-events-auto overflow-hidden rounded-inshop-lg border border-white/20 bg-[#071018]/95 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1.5">
          <span className="text-2xs font-medium text-white/62">{t('dashboard.map.minimap')}</span>
          <span className="flex items-center gap-1 text-[9px] text-white/42">
            <span className="h-2 w-2 border border-white/90" />
            {t('dashboard.map.currentView')}
          </span>
        </div>
        <button
          type="button"
          aria-label={t('dashboard.map.minimapNavigate')}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const pad = 8
            const ratioX = Math.max(
              0,
              Math.min(1, (event.clientX - rect.left - pad) / Math.max(1, rect.width - pad * 2))
            )
            const ratioY = Math.max(
              0,
              Math.min(1, (event.clientY - rect.top - pad) / Math.max(1, rect.height - pad * 2))
            )
            onNavigate({
              lat: extent.maxLat - ratioY * (extent.maxLat - extent.minLat),
              lon: extent.minLon + ratioX * (extent.maxLon - extent.minLon),
            })
          }}
          className="block cursor-crosshair focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
        >
          <canvas
            ref={canvasRef}
            className={cn(
              /* 좁은 화면에서도 몸집만 줄이고 계속 서 있는다 (max-sm 은 화면 폭이 곧 한계다) */
              'block max-sm:h-[4.75rem] max-sm:w-[8rem]',
              compact ? 'h-[5.5rem] w-[9.25rem]' : 'h-[8.5rem] w-[14rem]'
            )}
          />
        </button>
      </aside>
    )
  }
)
