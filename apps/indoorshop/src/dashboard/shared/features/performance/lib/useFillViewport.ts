import { useLayoutEffect, type RefObject } from 'react'

/**
 * 요소를 **스크롤되지 않는 만큼** 키운다 — 남는 세로를 이 요소가 다 갖는다.
 *
 * 높이를 비운 채(내용 그대로) 잰 스크롤 영역이 보이는 높이보다 짧으면 모자란 만큼 늘린다. 위아래에
 * 무엇이 몇 px 있는지 알 필요가 없다. 내용만으로 이미 넘칠 때는 `shrinkTo` 를 주면 남는 높이에
 * 딱 맞추고 넘치는 몫은 요소 **안에서** 스크롤한다(화면은 스크롤되지 않는다). 남는 높이가
 * `shrinkTo` 보다 작으면 줄이지 않고 화면이 스크롤된다. `minWidth` 보다 좁은 창에서는 손대지
 * 않는다(카드가 흐르는 좁은 배치).
 *
 * 스크롤 영역은 요소에서 가장 가까운 스크롤 조상이다(이식본은 셸 본문의 ScrollArea 가 스크롤한다).
 * 없으면 문서다(원본 앱).
 *
 * `deps` 가 바뀌면(내용이 바뀌면) 다시 잰다. 창 크기(브라우저 확대 포함)나 스크롤 영역의 크기가
 * 바뀌어도(사이드바 접기 등) 다시 잰다.
 */
/** 아래 여백을 잴 때 잠깐 늘리는 높이 — 어떤 창보다도 커야 한다 */
const PROBE_PX = 20000

/** 스크롤 영역 하나를 잰 값 — 요소를 `PROBE_PX` 로 늘린 상태에서 잰다 */
export interface FillMeasure {
  /** 높이를 비운 요소의 원래 높이 */
  natural: number
  /** 스크롤 내용의 맨 위에서 요소 위끝까지 */
  top: number
  /** 스크롤 내용 전체 높이 (요소가 PROBE_PX 일 때) */
  scrollHeight: number
  /** 스크롤 영역의 보이는 높이 */
  clientHeight: number
  /** 이 높이 이상 남으면 내용보다 작아도 거기 맞춘다(안에서 스크롤) — 없으면 늘리기만 한다 */
  shrinkTo?: number
}

/**
 * 요소에 줄 높이 — 늘릴 필요가 없으면 `null`(비운 채 둔다).
 *
 * 요소 아래에 붙는 여백(패딩 · 테두리 · 뒤 형제)은 늘린 상태의 내용 끝과 요소 끝의 차이로 안다.
 */
export function fillHeight({ natural, top, scrollHeight, clientHeight, shrinkTo }: FillMeasure): number | null {
  const below = scrollHeight - (top + PROBE_PX)
  const fill = Math.floor(clientHeight - top - below)
  if (!Number.isFinite(fill)) return null
  if (fill > natural) return fill
  if (shrinkTo !== undefined && fill < natural && fill >= shrinkTo) return fill
  return null
}

function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

export function useFillViewport(
  ref: RefObject<HTMLElement | null>,
  { minWidth, shrinkTo }: { minWidth: number; shrinkTo?: number },
  deps: readonly unknown[]
) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = ''
      el.style.overflowY = ''
      if (window.innerWidth < minWidth) return
      const natural = el.offsetHeight
      const box = scrollParentOf(el)
      const scroller = box ?? document.scrollingElement ?? document.documentElement
      /* 잠깐 크게 늘려 내용을 넘치게 한 뒤 내용 끝과 요소 끝의 차이를 본다 — 레이아웃이 높이를
         최소로 잡고 있으면(`min-h-*`) 내용 높이만으로는 남는 자리를 알 수 없다 */
      el.style.height = `${PROBE_PX}px`
      const origin = box ? box.getBoundingClientRect().top : 0
      const top = el.getBoundingClientRect().top - origin + scroller.scrollTop
      const height = fillHeight({
        natural,
        top,
        scrollHeight: scroller.scrollHeight,
        clientHeight: box ? box.clientHeight : window.innerHeight,
        shrinkTo,
      })
      el.style.height = height === null ? '' : `${height}px`
      /* 내용보다 작게 맞췄으면 넘치는 몫은 안에서 스크롤한다 */
      el.style.overflowY = height !== null && height < natural ? 'auto' : ''
    }
    fit()
    /* 한 프레임 뒤 한 번 더 — 글자 크기처럼 부모 effect 가 이 뒤에 바꾸는 값이 있다 */
    const frame = requestAnimationFrame(fit)
    window.addEventListener('resize', fit)
    /* 스크롤 영역의 크기 — 높이를 바꾸는 것은 요소라 영역 자체는 따라 변하지 않는다(되먹임 없음) */
    const box = scrollParentOf(el)
    const observer = box ? new ResizeObserver(() => fit()) : null
    if (box) observer?.observe(box)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', fit)
      observer?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 내용이 바뀌는 신호는 부르는 쪽이 deps 로 준다
  }, [ref, minWidth, shrinkTo, ...deps])
}
