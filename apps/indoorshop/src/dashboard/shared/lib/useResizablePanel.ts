import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

interface ResizablePanelOptions {
  /** localStorage 키 — 화면마다 다른 폭을 기억한다 */
  storageKey: string
  /** 설정을 건드리지 않은 상태의 폭(px) */
  defaultWidth: number
  /** 패널이 제 내용을 담을 수 있는 최소 폭(px) */
  min: number
  /** 패널이 화면을 독식하지 않는 최대 폭(px) */
  max: number
  /** 반대편(뷰어)이 남겨 둬야 하는 최소 폭(px) — 컨테이너가 좁으면 max 보다 우선한다 */
  minOpposite: number
  /** 키보드 한 번에 움직이는 양(px) */
  step?: number
}

export interface SeparatorProps {
  role: 'separator'
  tabIndex: 0
  'aria-orientation': 'vertical'
  'aria-valuenow': number
  'aria-valuemin': number
  'aria-valuemax': number
  'aria-label': string
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onDoubleClick: () => void
}

function readStored(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    // 사생활 보호 모드 등에서 접근이 막힐 수 있다 — 기본값으로 넘어간다
    return null
  }
}

function writeStored(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.round(value)))
  } catch {
    // 저장에 실패해도 이번 세션 동작에는 영향이 없다
  }
}

/**
 * 오른쪽 패널의 폭을 드래그로 조절한다.
 *
 * 뷰어와 목록 중 무엇이 더 넓어야 하는지는 하는 일마다 다르다 — 형상을 뜯어볼
 * 때는 뷰어가, 인식 결과를 훑을 때는 목록이 넓어야 한다. 그래서 비율을 고정하지
 * 않고 사용자가 정하게 하되, **정한 값은 기억한다** (매번 다시 끄는 건 조절이 아니다).
 *
 * 폭은 px 상태로만 들고 있고 CSS 변수로 내보낸다 — 좁은 화면에서는 두 칸이 위아래로
 * 쌓이므로, 그때는 이 값을 아예 참조하지 않게 하기 위해서다.
 */
export function useResizablePanel({
  storageKey,
  defaultWidth,
  min,
  max,
  minOpposite,
  step = 24,
}: ResizablePanelOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(() => readStored(storageKey) ?? defaultWidth)
  const [dragging, setDragging] = useState(false)

  /** 컨테이너 실폭까지 반영한 한계 — 창을 줄이면 상한도 같이 내려온다 */
  const clamp = useCallback(
    (value: number) => {
      const available = containerRef.current?.getBoundingClientRect().width ?? Infinity
      const upper = Math.max(min, Math.min(max, available - minOpposite))
      return Math.round(Math.max(min, Math.min(upper, value)))
    },
    [min, max, minOpposite],
  )

  const commit = useCallback(
    (value: number) => {
      const next = clamp(value)
      setWidth(next)
      writeStored(storageKey, next)
      return next
    },
    [clamp, storageKey],
  )

  const reset = useCallback(() => commit(defaultWidth), [commit, defaultWidth])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      const container = containerRef.current
      if (!container) return

      /*
       * 포인터를 핸들에 붙잡아 둔다 — 그래야 커서가 3D 캔버스나 창 밖으로 나가도
       * 드래그가 끊기지 않는다 (뷰포트가 pointermove 를 궤도 회전으로 먹는다).
       */
      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)
      setDragging(true)

      const right = container.getBoundingClientRect().right
      const move = (e: PointerEvent) => setWidth(clamp(right - e.clientX))
      const end = (e: PointerEvent) => {
        // pointercancel 은 캡처를 이미 풀어 놓는다 — 그때 release 를 부르면 던진다
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', end)
        handle.removeEventListener('pointercancel', end)
        setDragging(false)
        commit(right - e.clientX)
      }

      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', end)
      handle.addEventListener('pointercancel', end)
    },
    [clamp, commit],
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      // 왼쪽 = 경계를 왼쪽으로 = 패널이 넓어진다 (보이는 방향과 값의 방향을 맞춘다)
      if (event.key === 'ArrowLeft') commit(width + step)
      else if (event.key === 'ArrowRight') commit(width - step)
      else if (event.key === 'Home') reset()
      else return
      event.preventDefault()
    },
    [commit, reset, step, width],
  )

  // 창을 줄이면 저장해 둔 폭이 상한을 넘을 수 있다 — 그때는 조용히 끌어내린다
  useEffect(() => {
    const onResize = () => setWidth((current) => clamp(current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clamp])

  const separatorProps: SeparatorProps = {
    role: 'separator',
    tabIndex: 0,
    'aria-orientation': 'vertical',
    'aria-valuenow': width,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-label': '패널 폭 조절 (← → 로 조절, Home 으로 기본값)',
    onPointerDown,
    onKeyDown,
    onDoubleClick: reset,
  }

  return { width, dragging, containerRef, separatorProps, reset }
}
