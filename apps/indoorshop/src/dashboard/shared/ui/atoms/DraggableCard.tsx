import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from '../../lib/i18n/useTranslation'
import { cn } from '../../lib/utils'
import {
  clampCardOffset,
  clearCardOffset,
  dragCardStorageKey,
  isZeroOffset,
  readCardOffset,
  sessionStorageOrNull,
  writeCardOffset,
  ZERO_OFFSET,
  type CardOffset,
  type CardOffsetStorage,
} from '../../lib/draggableCard'

/*
 * 지도 위 오버레이 카드를 **손으로 옮길 수 있게** 하는 껍데기.
 *
 * 지도 화면의 카드는 저마다 제 자리(좌상단 상세 · 우측 공장 목록 · 좌하단 미니맵)를
 * 가지고 있는데, 그 자리에 하필 지금 보고 싶은 블록이 서 있을 때가 있다. 그때까지는
 * 카드를 닫는 것 말고는 방법이 없었다. 이 껍데기는 카드를 **원래 자리에 그대로 두되**
 * `transform` 으로만 옮긴다 — 레이아웃(격자·흐름)은 손대지 않으므로, 옮기지 않은 카드의
 * 배치는 한 픽셀도 바뀌지 않고 창 크기가 바뀌어도 원래 규칙대로 다시 선다.
 *
 * ## 어디를 잡으면 끌리는가
 *
 * 1. 카드 안에 `data-drag-handle` 이 있으면 **거기만** 손잡이다 (보통 카드 머리글).
 * 2. 없으면 카드 아무 데나 잡아도 되지만, 조작 요소(버튼·링크·입력·캔버스)와
 *    스크롤 영역(`.scroll-thin`), 그리고 `data-drag-ignore` 를 붙인 자리는 뺀다 —
 *    목록을 굴리려다 카드가 딸려 오면 안 된다.
 *
 * ## 터치
 *
 * `touch-action: none` 이 걸린 자리에서만 터치 드래그가 성립한다(안 걸면 브라우저가
 * 스크롤로 가로챈다). 그래서 카드 안에 스크롤 영역이 **없으면** 카드 전체에 걸고,
 * 있으면 손잡이에만 건다(`globals.css`) — 목록의 터치 스크롤을 죽이지 않기 위해서다.
 * 이 판단은 마운트 뒤 DOM 을 한 번 훑어 자동으로 내린다.
 *
 * ## 자리 기억 · 되돌리기
 *
 * 옮긴 자리는 `sessionStorage` 에 **경로 × 카드 이름**으로 남는다(새로고침 유지).
 * 되돌리기는 **손잡이 더블클릭** 하나로 통일했다 — 카드마다 리셋 버튼을 달면 이미
 * 빽빽한 머리글이 더 좁아지고, 그 버튼 자체가 또 오조작 대상이 된다.
 */

/** 잡아도 드래그가 시작되지 않는 것들 — 제 할 일이 있는 요소와 스크롤 영역 */
const NON_DRAGGABLE =
  'button, a[href], input, select, textarea, canvas, summary, [role="button"], [role="tab"], [role="slider"], [contenteditable="true"], .scroll-thin, [data-drag-ignore]'

const HANDLE_SELECTOR = '[data-drag-handle]'

/** 이만큼 움직이기 전에는 드래그로 치지 않는다 — 카드 위 클릭이 죽지 않게 */
const DRAG_THRESHOLD_PX = 3

/** 카드가 뷰포트 가장자리에 남겨 두는 최소 여백 — 완전히 밀려 나가지 않게 */
const DEFAULT_MARGIN_PX = 8

export interface DraggableCardProps {
  /** 이 화면 안에서 이 카드를 가리키는 이름 — 저장 키의 뒷자리 */
  cardKey: string
  /**
   * 저장 키의 앞자리. 기본은 현재 경로라 화면마다 자리를 따로 기억한다
   * (같은 프레임을 쓰는 조립·의장·도장 맵이 서로의 자리를 덮어쓰지 않는다).
   */
  pageKey?: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** 끌 수 없게 잠근다 — 옮긴 자리는 그대로 두고 손잡이만 죽인다 */
  disabled?: boolean
  /** 뷰포트 가장자리에 남길 여백(px) */
  margin?: number
  /** 저장소 주입구 — 테스트가 가짜 저장소를 끼운다. 기본은 sessionStorage */
  storage?: CardOffsetStorage | null
}

function viewportBounds() {
  return {
    left: 0,
    top: 0,
    right: typeof window === 'undefined' ? 0 : window.innerWidth,
    bottom: typeof window === 'undefined' ? 0 : window.innerHeight,
  }
}

/** 지금 잡은 자리가 손잡이인가 — 위 "어디를 잡으면 끌리는가" 규칙 그대로 */
function isDragOrigin(card: HTMLElement, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (!card.contains(target)) return false

  const handle = target.closest(HANDLE_SELECTOR)
  /* 손잡이를 명시한 카드 — 그 안에서 시작한 것만 인정한다 */
  if (card.querySelector(HANDLE_SELECTOR)) return handle != null && card.contains(handle)

  const blocked = target.closest(NON_DRAGGABLE)
  return blocked == null || !card.contains(blocked)
}

export function DraggableCard({
  cardKey,
  pageKey,
  children,
  className,
  style,
  disabled = false,
  margin = DEFAULT_MARGIN_PX,
  storage,
}: DraggableCardProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  const store = useMemo(
    () => (storage === undefined ? sessionStorageOrNull() : storage),
    [storage],
  )
  const path =
    pageKey ?? (typeof window === 'undefined' ? 'app' : window.location.pathname)
  const storageKey = dragCardStorageKey(path, cardKey)

  /* 저장된 자리는 **첫 그림부터** 실려 있어야 한다 — 나중에 넣으면 카드가 한 번 튄다 */
  const [offset, setOffset] = useState<CardOffset>(
    () => readCardOffset(store, storageKey) ?? ZERO_OFFSET,
  )
  const [dragging, setDragging] = useState(false)

  /* 드래그 한 판의 밑천 — 매 프레임 state 를 읽지 않으려고 ref 에 담는다 */
  const gesture = useRef<{
    pointerId: number
    startX: number
    startY: number
    from: CardOffset
    /** 옮기기 **전** 자리 — 가두기(clamp)의 기준 */
    natural: { left: number; top: number; width: number; height: number }
    moved: boolean
  } | null>(null)

  /* 지금 이동량을 콜백들이 의존성 없이 읽는 창구 — 드래그 프레임마다 리스너를
     새로 만들지 않으려고 둔다 */
  const offsetRef = useRef(offset)
  offsetRef.current = offset

  /** 이동량을 뷰포트 안으로 가둔 값으로 바꾼다 */
  const clampToViewport = useCallback(
    (next: CardOffset, natural?: { left: number; top: number; width: number; height: number }) => {
      const el = ref.current
      if (!el) return next
      let rect = natural
      if (!rect) {
        const box = el.getBoundingClientRect()
        rect = {
          left: box.left - offsetRef.current.x,
          top: box.top - offsetRef.current.y,
          width: box.width,
          height: box.height,
        }
      }
      return clampCardOffset(next, rect, viewportBounds(), margin)
    },
    [margin],
  )

  /*
   * 터치 드래그가 성립하려면 `touch-action: none` 이 필요한데, 카드 전체에 걸면 안쪽
   * 목록의 터치 스크롤이 죽는다. 그래서 스크롤 영역이 없는 카드에만 전체로 건다.
   */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const hasScroller = el.querySelector('.scroll-thin, [data-drag-ignore]') != null
    el.style.touchAction = hasScroller ? '' : 'none'
  }, [])

  /* 창이 좁아지면 밖으로 나간 카드를 도로 끌어들인다 — 못 찾는 카드가 생기지 않게 */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      setOffset((current) => {
        if (isZeroOffset(current)) return current
        const next = clampToViewport(current)
        return next.x === current.x && next.y === current.y ? current : next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clampToViewport])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el || disabled) return
      /* 주 버튼만 — 가운데 클릭(자동 스크롤)·우클릭(맥락 메뉴)은 제 일을 하게 둔다 */
      if (event.button !== 0) return
      if (!isDragOrigin(el, event.target)) return

      const rect = el.getBoundingClientRect()
      const from = offsetRef.current
      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        from,
        natural: {
          left: rect.left - from.x,
          top: rect.top - from.y,
          width: rect.width,
          height: rect.height,
        },
        moved: false,
      }
      /* 기본 동작(글자 선택 시작)을 막는다 — 안 막으면 카드를 끄는 내내 본문이 파랗게
         드래그 선택된다. 손잡이는 조작 요소가 아니므로 여기서 잃을 기본 동작이 없다 */
      event.preventDefault()
      el.setPointerCapture?.(event.pointerId)
    },
    [disabled],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) return
      const dx = event.clientX - g.startX
      const dy = event.clientY - g.startY
      if (!g.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
        g.moved = true
        setDragging(true)
      }
      setOffset(clampToViewport({ x: g.from.x + dx, y: g.from.y + dy }, g.natural))
    },
    [clampToViewport],
  )

  const endGesture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const g = gesture.current
      if (!g || g.pointerId !== event.pointerId) return
      gesture.current = null
      ref.current?.releasePointerCapture?.(event.pointerId)
      if (!g.moved) return
      setDragging(false)
      /* 저장은 손을 뗄 때 한 번 — 매 프레임 쓰면 저장소가 드래그 속도를 붙든다 */
      setOffset((current) => {
        writeCardOffset(store, storageKey, current)
        return current
      })
    },
    [storageKey, store],
  )

  /** 손잡이 더블클릭 = 원위치 */
  const onDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el || disabled) return
      if (!isDragOrigin(el, event.target)) return
      clearCardOffset(store, storageKey)
      setOffset(ZERO_OFFSET)
    },
    [disabled, storageKey, store],
  )

  const moved = !isZeroOffset(offset)

  return (
    <div
      ref={ref}
      data-draggable-card={cardKey}
      data-dragging={dragging ? 'true' : undefined}
      data-moved={moved ? 'true' : undefined}
      title={disabled ? undefined : t('common.dragCardHint')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onDoubleClick={onDoubleClick}
      className={cn(className, !disabled && 'drag-card')}
      style={{
        ...style,
        /* 안 옮긴 카드에는 transform 을 아예 걸지 않는다 — 쓸데없는 레이어 승격을 아낀다 */
        transform: moved ? `translate3d(${offset.x}px, ${offset.y}px, 0)` : undefined,
        /* 끄는 동안에는 지도 위 어떤 것보다 앞에 선다 */
        zIndex: dragging ? 60 : style?.zIndex,
      }}
    >
      {children}
    </div>
  )
}
