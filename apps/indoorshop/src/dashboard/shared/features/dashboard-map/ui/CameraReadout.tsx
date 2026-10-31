import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { YardView } from '../../yard-map'
import { cn } from '../../../lib/utils'
import { cameraValuesOf } from '../lib/cameraValues'

/** 지도 카메라 값을 받는 손잡이 — 카메라가 움직일 때마다 지도가 부른다(React 를 거치지 않게) */
export interface CameraReadoutHandle {
  updateView: (view: YardView) => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    /* 클립보드 API 를 못 쓰면(비보안 주소 등) 숨은 입력란으로 */
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'absolute'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

/**
 * 지도 위 가운데 — **지금 카메라의 기울기 · 회전**을 보여 주고, 누르면 그 값을 JSON 으로
 * 복사한다(사용자 요청: 원하는 시점을 잡아 초기 카메라 값으로 옮기기 위해). 줌·위치는 적지
 * 않는다(사용자 확정). 회전은 코드 상수와 같은 -180~180 표기(`MAP_BEARING`).
 */
export const CameraReadout = forwardRef<CameraReadoutHandle, { className?: string }>(function CameraReadout(
  { className },
  ref
) {
  const { t } = useTranslation()
  const [view, setView] = useState<YardView | null>(null)
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useImperativeHandle(ref, () => ({ updateView: (next) => setView({ ...next }) }), [])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  if (!view) return null
  const v = cameraValuesOf(view)

  const copy = async () => {
    const ok = await copyText(JSON.stringify({ pitch: v.pitch, bearing: v.bearing }))
    setCopied(ok ? 'ok' : 'fail')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 1500)
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={t('dashboard.map.camera.copyHint')}
      className={cn(
        'pointer-events-auto inline-flex h-9 cursor-pointer items-center gap-3 whitespace-nowrap rounded-inshop-xl border border-white/12 bg-[#0b0e12]/90 px-3.5 font-mono text-inshop-xs text-white/80 shadow-[0_12px_32px_rgba(0,0,0,0.32)] backdrop-blur-md transition-colors hover:bg-[#151a20] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        className
      )}
    >
      <span>
        <span className="text-white/45">{t('dashboard.map.camera.pitch')} </span>
        {v.pitch}°
      </span>
      <span>
        <span className="text-white/45">{t('dashboard.map.camera.bearing')} </span>
        {v.bearing}°
      </span>
      <span
        className={cn(
          'font-inshop-sans text-2xs font-semibold',
          copied === 'ok' ? 'text-status-healthy' : copied === 'fail' ? 'text-status-unhealthy' : 'text-white/45'
        )}
      >
        {t(copied === 'ok' ? 'dashboard.map.camera.copied' : copied === 'fail' ? 'dashboard.map.camera.copyFailed' : 'dashboard.map.camera.copy')}
      </span>
    </button>
  )
})
