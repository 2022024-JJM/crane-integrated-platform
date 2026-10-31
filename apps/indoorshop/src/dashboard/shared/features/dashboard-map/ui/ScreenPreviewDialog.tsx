import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { useNavigate } from 'react-router-dom'
import { useEscapeClaim } from '../../../lib/escapeClaims'
import { withEmbed, withoutEmbed } from '../../../lib/embedMode'
import { CloseIcon } from '../../../ui/icons'
import { Spinner } from '../../../ui/atoms/Spinner'

/** 창에 띄울 화면 — 주소와 머리에 적을 이름 */
export interface ScreenPreview {
  href: string
  title: string
}

/**
 * 야드 맵 위에 뜨는 **화면 창** — 3D 뷰어·통합실적·현황 화면을 지도를 떠나지 않고 본다.
 *
 * 그 화면들은 공정 모듈의 것이라 야드 맵(shared)이 컴포넌트로 부를 수 없다. 그래서 같은
 * 앱을 **임베드 모드**(`?embed=1` — 셸 없이 본문만)로 iframe 에 연다. 창 안에서 다른
 * 화면으로 옮겨 다녀도 창 밖의 지도·선택·카메라는 그대로다.
 *
 * 머리의 **확장**(× 왼쪽)은 창에서 보던 화면을 **그 페이지로 이동**해 전체 화면으로 연다(사용자
 * 확정). 창 안에서 다른 화면으로 옮겨 다녔으면 지금 보고 있는 화면으로 간다(같은 출처라 창의
 * 주소를 읽을 수 있다 — 못 읽으면 처음 연 주소로).
 *
 * 닫기는 셋 — 머리의 ×, ESC, 바깥(어두운 막) 클릭. 떠 있는 동안 ESC 우선권을 쥐어 뒤의
 * 드릴다운 ESC(한 계단 뒤로)가 함께 움직이지 않게 한다. (창 **안**에 포커스가 있으면 ESC
 * 는 그 문서가 받는다 — 그때는 ×로 닫는다.)
 */
export function ScreenPreviewDialog({
  preview,
  onClose,
}: {
  preview: ScreenPreview
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const closeRef = useRef<HTMLButtonElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)

  /* 창에서 보던 화면으로 이동 — 창 안의 지금 주소(임베드 쿼리를 떼고), 못 읽으면 처음 연 주소 */
  const expand = () => {
    let target = preview.href
    try {
      const loc = frameRef.current?.contentWindow?.location
      if (loc && loc.origin === window.location.origin && loc.pathname) {
        target = withoutEmbed(`${loc.pathname}${loc.search}`) + loc.hash
      }
    } catch {
      /* 다른 출처면 주소를 못 읽는다 — 처음 연 주소로 간다 */
    }
    onClose()
    void navigate(target)
  }

  useEscapeClaim(true)

  /* 열리면 닫기 버튼으로 포커스 — 키보드 사용자가 창에서 시작하도록 */
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  /* 다른 화면으로 갈아 끼우면 다시 로딩 표시 */
  useEffect(() => {
    setLoaded(false)
  }, [preview.href])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={preview.title}
        className="relative flex h-full max-h-[56rem] w-full max-w-[96rem] flex-col overflow-hidden rounded-inshop-xl border border-white/12 bg-[#0b0e12] text-white shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-fade-in"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
          <h2 className="min-w-0 flex-1 truncate text-inshop-sm font-semibold">{preview.title}</h2>
          <button
            type="button"
            onClick={expand}
            aria-label={t('dashboard.map.preview.expand')}
            title={t('dashboard.map.preview.expand')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-inshop-lg border border-white/10 text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {/* 네 모서리로 벌어지는 화살표 — 창을 페이지로 키운다 */}
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />
            </svg>
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('dashboard.map.preview.close')}
            title={t('dashboard.map.preview.close')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-inshop-lg border border-white/10 text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="relative min-h-0 flex-1 bg-background">
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center">
              <Spinner size={26} label={t('dashboard.map.preview.loading')} className="text-accent" />
            </div>
          )}
          <iframe
            ref={frameRef}
            key={preview.href}
            src={withEmbed(preview.href)}
            title={preview.title}
            onLoad={() => setLoaded(true)}
            className="h-full w-full border-0"
          />
        </div>
      </section>
    </div>,
    document.body
  )
}
