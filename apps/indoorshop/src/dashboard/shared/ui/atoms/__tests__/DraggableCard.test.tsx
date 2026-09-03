import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraggableCard } from '../DraggableCard'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { stubRect, stubViewport } from '../../../lib/testing/domGeometry'
import { dragCardStorageKey, readCardOffset } from '../../../lib/draggableCard'

/*
 * 카드 옮기기를 **브라우저 없이** 확인한다. 가두기·저장 규칙 자체는 순수 테스트
 * (`shared/lib/__tests__/draggableCard.test.ts`)가 이미 다 보고 있으므로, 여기서는
 * 그 계산이 실제 포인터 사건에 물려 있는지 — 손잡이가 어디인지, 뗀 자리가 남는지,
 * 더블클릭이 되돌리는지 — 를 본다.
 */

/** 카드가 선 자리와 크기 (jsdom 은 레이아웃이 없으므로 테스트가 말해 준다) */
const CARD = { left: 12, top: 12, width: 300, height: 200 }

function setup(ui: Parameters<typeof renderWithProviders>[0]) {
  stubViewport(1280, 720)
  const result = renderWithProviders(ui)
  const card = result.container.querySelector('[data-draggable-card]') as HTMLElement
  stubRect(card, CARD)
  return { ...result, card }
}

/** 포인터로 카드를 (dx, dy) 만큼 끈다 — 실제 드래그와 같은 사건 순서 */
async function drag(from: HTMLElement, dx: number, dy: number, startAt = { x: 100, y: 100 }) {
  const user = userEvent.setup()
  await user.pointer([
    { keys: '[MouseLeft>]', target: from, coords: { clientX: startAt.x, clientY: startAt.y } },
    { target: from, coords: { clientX: startAt.x + dx, clientY: startAt.y + dy } },
    { keys: '[/MouseLeft]', target: from, coords: { clientX: startAt.x + dx, clientY: startAt.y + dy } },
  ])
}

function offsetOf(card: HTMLElement) {
  return card.style.transform
}

describe('DraggableCard', () => {
  it('처음에는 옮기지 않은 상태 — transform 을 아예 걸지 않는다', () => {
    const { card } = setup(
      <DraggableCard cardKey="detail">
        <p>본문</p>
      </DraggableCard>,
    )
    expect(offsetOf(card)).toBe('')
    expect(card.dataset.moved).toBeUndefined()
  })

  it('끌면 그만큼 옮겨진다', async () => {
    const { card } = setup(
      <DraggableCard cardKey="detail">
        <p>본문</p>
      </DraggableCard>,
    )
    await drag(screen.getByText('본문'), 120, 60)
    expect(offsetOf(card)).toBe('translate3d(120px, 60px, 0)')
    expect(card.dataset.moved).toBe('true')
  })

  it('창 밖으로는 못 나간다 — 가장자리 여백에서 선다', async () => {
    const { card } = setup(
      <DraggableCard cardKey="detail">
        <p>본문</p>
      </DraggableCard>,
    )
    await drag(screen.getByText('본문'), 5000, 5000)
    /* 카드 오른쪽·아래 끝이 창 안에 남는다 (여백 8px) */
    expect(offsetOf(card)).toBe(
      `translate3d(${1280 - 8 - CARD.width - CARD.left}px, ${720 - 8 - CARD.height - CARD.top}px, 0)`,
    )
  })

  it('옮긴 자리를 sessionStorage 에 남기고, 다시 그리면 그 자리에서 선다', async () => {
    const view = setup(
      <DraggableCard cardKey="detail">
        <p>본문</p>
      </DraggableCard>,
    )
    await drag(screen.getByText('본문'), 80, 40)

    const key = dragCardStorageKey(window.location.pathname, 'detail')
    expect(readCardOffset(sessionStorage, key)).toEqual({ x: 80, y: 40 })

    /* 새로고침에 해당 — 같은 키로 다시 그리면 저장된 자리가 첫 프레임부터 실려 있다 */
    view.unmount()
    const again = setup(
      <DraggableCard cardKey="detail">
        <p>본문</p>
      </DraggableCard>,
    )
    expect(offsetOf(again.card)).toBe('translate3d(80px, 40px, 0)')
  })

  it('손잡이를 지정한 카드는 그 자리에서만 끌린다', async () => {
    const { card } = setup(
      <DraggableCard cardKey="panel">
        <div data-drag-handle>제목</div>
        <div className="scroll-thin">목록</div>
      </DraggableCard>,
    )

    /* 스크롤 목록을 잡아 끌어도 카드는 제자리 — 굴리려던 손에 카드가 딸려 오지 않는다 */
    await drag(screen.getByText('목록'), 100, 100)
    expect(offsetOf(card)).toBe('')

    await drag(screen.getByText('제목'), 100, 100)
    expect(offsetOf(card)).toBe('translate3d(100px, 100px, 0)')
  })

  it('버튼을 잡아도 끌리지 않는다 — 카드 위 조작이 죽지 않게', async () => {
    let clicks = 0
    const { card } = setup(
      <DraggableCard cardKey="detail">
        <button type="button" onClick={() => (clicks += 1)}>
          닫기
        </button>
      </DraggableCard>,
    )
    await drag(screen.getByRole('button', { name: '닫기' }), 100, 100)
    expect(offsetOf(card)).toBe('')
    /* 버튼 위에서 손을 움직여도 그건 여전히 버튼 누르기다 — 카드만 안 따라올 뿐 */
    expect(clicks).toBe(1)

    await userEvent.setup().click(screen.getByRole('button', { name: '닫기' }))
    expect(clicks).toBe(2)
  })

  it('손잡이 더블클릭이 제자리로 되돌린다 — 저장된 자리도 함께 지운다', async () => {
    const { card } = setup(
      <DraggableCard cardKey="detail">
        <p>본문</p>
      </DraggableCard>,
    )
    await drag(screen.getByText('본문'), 90, 90)
    expect(card.dataset.moved).toBe('true')

    await userEvent.setup().dblClick(screen.getByText('본문'))
    expect(offsetOf(card)).toBe('')
    expect(card.dataset.moved).toBeUndefined()
    expect(
      readCardOffset(sessionStorage, dragCardStorageKey(window.location.pathname, 'detail')),
    ).toBeNull()
  })

  it('문턱(3px) 아래의 흔들림은 드래그로 치지 않는다', async () => {
    const { card } = setup(
      <DraggableCard cardKey="detail">
        <p>본문</p>
      </DraggableCard>,
    )
    await drag(screen.getByText('본문'), 2, 2)
    expect(offsetOf(card)).toBe('')
  })

  it('잠근 카드는 끌리지 않는다', async () => {
    const { card } = setup(
      <DraggableCard cardKey="detail" disabled>
        <p>본문</p>
      </DraggableCard>,
    )
    await drag(screen.getByText('본문'), 100, 100)
    expect(offsetOf(card)).toBe('')
  })

  it('화면(pageKey)이 다르면 자리를 따로 기억한다', async () => {
    const first = setup(
      <DraggableCard cardKey="detail" pageKey="/assembly/map">
        <p>본문</p>
      </DraggableCard>,
    )
    await drag(screen.getByText('본문'), 50, 50)
    first.unmount()

    const other = setup(
      <DraggableCard cardKey="detail" pageKey="/outfitting/map">
        <p>본문</p>
      </DraggableCard>,
    )
    expect(offsetOf(other.card)).toBe('')
    expect(readCardOffset(sessionStorage, dragCardStorageKey('/assembly/map', 'detail'))).toEqual({
      x: 50,
      y: 50,
    })
  })
})
