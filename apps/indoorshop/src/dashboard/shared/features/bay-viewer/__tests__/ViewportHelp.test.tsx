import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { ViewportHelp } from '../ui/ViewportHelp'

/*
 * 조작 안내는 **실제 배치와 같은 말을 해야 한다**.
 *
 * 손이 먼저 알아채는 종류의 거짓말이다 — "왼쪽이 회전이라더니 이동하네". 표를 손으로
 * 적어 두면 배치를 바꿀 때마다 그 거짓말이 생기므로 표는 문법에서 만들고(ViewportHelp),
 * 여기서는 그 결과가 P3 에서 정한 뷰어 문법 그대로인지 본다.
 */

describe('뷰포트 조작 안내', () => {
  it('뷰어 문법 그대로 말한다 — 왼쪽 회전 · 오른쪽 이동 · Shift 이동', async () => {
    renderWithProviders(<ViewportHelp />)
    await userEvent.setup().click(screen.getByRole('button', { name: '뷰포트 조작 안내' }))

    const panel = screen.getByText('마우스').closest('div')?.parentElement as HTMLElement
    const text = panel.textContent ?? ''
    /* 표는 [키 이름][동작] 쌍이 이어진 문자열이 된다 — 붙어 있는 순서가 곧 계약이다 */
    expect(text).toContain('왼쪽 드래그회전')
    expect(text).toContain('오른쪽 드래그이동')
    expect(text).toContain('Shift + 드래그이동')
    expect(text).toContain('가운데 드래그회전')
  })

  it('휠은 클릭 후에 켜진다는 사정을 그대로 남긴다', async () => {
    renderWithProviders(<ViewportHelp />)
    await userEvent.setup().click(screen.getByRole('button', { name: '뷰포트 조작 안내' }))
    expect(screen.getByText('줌 (클릭 후)')).toBeInTheDocument()
  })
})
