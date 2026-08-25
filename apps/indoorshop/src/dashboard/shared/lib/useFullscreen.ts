import { useCallback, useEffect, useRef, useState } from 'react'

/** Safari 계열의 접두사 API — 표준 이름이 없을 때만 쓴다 */
interface LegacyFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}
interface LegacyDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

function currentFullscreenElement(): Element | null {
  const doc = document as LegacyDocument
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

/**
 * 한 요소를 전체 화면으로 띄운다.
 *
 * 3D 뷰포트처럼 "크게 볼수록 일이 되는" 화면을 위한 것이다. 앱 안에서 `fixed inset-0`
 * 으로 덮는 방법도 있지만, 그러면 브라우저 탭·주소창·작업표시줄이 그대로 남아 실제로
 * 얻는 픽셀이 얼마 안 된다 — 진짜 전체 화면이어야 형상이 커진다.
 *
 * ESC 로 빠져나오는 것은 브라우저가 이미 해 주므로 따로 처리하지 않는다. 다만 상태는
 * `fullscreenchange` 로 받아야 한다 — ESC 나 F11 로 나간 경우 우리 코드는 호출되지 않는다.
 *
 * `f` 키는 **커서가 그 요소 위에 있을 때만** 듣는다. 뷰포트 단축키(1/3/7/./Home)가
 * 쓰는 규칙과 같다 — 캔버스는 클릭해도 포커스를 안 받는 경우가 있어 포커스에 기대면
 * 키가 먹지 않는다.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const supported =
    typeof document !== 'undefined' &&
    (document.fullscreenEnabled || 'webkitFullscreenEnabled' in document)

  const toggle = useCallback(() => {
    const element = ref.current as LegacyFullscreenElement | null
    if (!element) return

    if (currentFullscreenElement() === element) {
      const doc = document as LegacyDocument
      void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      return
    }

    /*
     * 사용자 제스처 없이 부르거나 브라우저 정책에 막히면 거부된다 —
     * 그 경우 화면은 그대로 두고 조용히 넘어간다 (버튼은 계속 눌러 볼 수 있다).
     */
    const request = element.requestFullscreen?.bind(element) ?? element.webkitRequestFullscreen
    try {
      void Promise.resolve(request?.()).catch(() => {})
    } catch {
      // 구형 브라우저에서 동기 예외를 던지는 경우
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(currentFullscreenElement() === ref.current)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'f' && event.key !== 'F') return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      // 입력 중인 필드의 키를 가로채지 않는다
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return

      // 커서가 뷰포트 위일 때만 — 다른 곳을 보다가 f 를 눌러 화면이 뒤집히면 안 된다
      if (!ref.current?.matches(':hover')) return

      event.preventDefault()
      toggle()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  return { ref, isFullscreen, toggle, supported }
}
