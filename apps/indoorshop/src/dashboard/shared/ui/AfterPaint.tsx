import { startTransition, useEffect, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'
import { Spinner } from './atoms/Spinner'

/**
 * **한 번 그려 보인 뒤에** 무거운 내용을 세운다 — 3D 뷰어처럼 처음 장면을 만드는 데 화면을 0.8초쯤
 * 붙잡는 부품용(사용자 확정: 3D 뷰어를 그리는 타이밍을 바꾼다).
 *
 * 처음에는 같은 자리에 '준비 중' 판만 그린다. 탭 강조와 그 판이 화면에 실제로 칠해진 다음
 * (프레임 두 번을 넘긴 뒤) 내용으로 갈아 끼운다 — 그래서 누른 탭이 먼저 바뀌어 보이고, 멈춤은
 * 그 뒤에 온다. 그 사이 다른 탭으로 옮겨 이 부품이 사라지면 내용은 아예 세우지 않는다.
 */
export function AfterPaint({
  children,
  label,
  className,
}: {
  children: ReactNode
  /** 준비 중 판의 문구 */
  label: string
  /** 준비 중 판의 크기 — 내용이 설 자리와 같게 */
  className?: string
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let raf1 = 0
    let raf2 = 0
    let timer = 0
    const go = () => startTransition(() => setReady(true))
    if (typeof requestAnimationFrame === 'function') {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          timer = window.setTimeout(go, 0)
        })
      })
    } else {
      timer = window.setTimeout(go, 0)
    }
    return () => {
      if (raf1) cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      window.clearTimeout(timer)
    }
  }, [])
  if (ready) return <>{children}</>
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Spinner size={26} label={label} className="text-accent" />
    </div>
  )
}
