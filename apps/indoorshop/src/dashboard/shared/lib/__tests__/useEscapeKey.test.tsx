import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useCallback } from 'react'
import { useEscapeKey } from '../useEscapeKey'
import { claimEscape } from '../escapeClaims'

/*
 * 문서 레벨 ESC (링크 스모크 ⑤).
 *
 * 딥링크로 막 연 화면에서는 아직 클릭도 호버도 없다. 그때 ESC 가 안 먹으면 키보드로
 * 들어온 사람에게 "먼저 마우스를 올려 보라"고 요구하는 셈이다 — 여기가 그 계약이다.
 */
function Screen({ onEscape }: { onEscape: () => boolean | void }) {
  useEscapeKey(useCallback(onEscape, [onEscape]))
  return (
    <div>
      <input aria-label="검색" />
      <button type="button">버튼</button>
    </div>
  )
}

describe('useEscapeKey — 클릭·호버 전에도 먹는다', () => {
  it('아무 데도 손대지 않은 화면의 첫 ESC 가 먹는다', () => {
    const onEscape = vi.fn()
    render(<Screen onEscape={onEscape} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('포커스가 어디에 있든 문서에서 받는다', () => {
    const onEscape = vi.fn()
    const { getByRole } = render(<Screen onEscape={onEscape} />)
    const button = getByRole('button')
    button.focus()
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('소비하면 preventDefault — 같은 키의 다른 청취자를 멈춘다', () => {
    render(<Screen onEscape={() => true} />)
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('false 를 돌려주면 흘려보낸다 — 바깥 단계가 이어받게', () => {
    render(<Screen onEscape={() => false} />)
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    document.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('입력 중이면 삼킨다 — 검색창의 ESC 는 드롭다운 몫이다', () => {
    const onEscape = vi.fn()
    const { getByLabelText } = render(<Screen onEscape={onEscape} />)
    fireEvent.keyDown(getByLabelText('검색'), { key: 'Escape' })
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('오버레이가 우선권을 쥐고 있으면 삼킨다 (escapeClaims)', () => {
    const onEscape = vi.fn()
    render(<Screen onEscape={onEscape} />)
    const release = claimEscape()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).not.toHaveBeenCalled()
    release()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledOnce()
  })

  it('이미 처리된 이벤트는 건드리지 않는다', () => {
    const onEscape = vi.fn()
    render(<Screen onEscape={onEscape} />)
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    event.preventDefault()
    document.dispatchEvent(event)
    expect(onEscape).not.toHaveBeenCalled()
  })

  it('언마운트하면 리스너를 놓는다', () => {
    const onEscape = vi.fn()
    const view = render(<Screen onEscape={onEscape} />)
    view.unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onEscape).not.toHaveBeenCalled()
  })
})
