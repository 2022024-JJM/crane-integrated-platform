import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { ZoneJumpButton } from '../ui/ZoneJumpButton'

/*
 * '/' 드릴인 상태의 "공정 화면으로 넘어가기" 버튼 — 버튼이 내는 주소와 카메라 승계.
 * 주소 규칙 자체는 zoneJump.test.ts(노드)가 본다.
 */
describe('ZoneJumpButton', () => {
  it('공장을 실은 공정 화면 주소로 나간다 — 카메라는 클릭 순간 맡긴다', async () => {
    const onStash = vi.fn()
    renderWithProviders(<ZoneJumpButton process="조립" factory="GBS" onStash={onStash} />)
    const link = screen.getByRole('link', { name: /조립 공정 화면 열기/ })
    /* 값은 안정 슬러그(F-30) */
    expect(link).toHaveAttribute('href', '/zones/assembly?factory=asm-gbs')

    await userEvent.setup().click(link)
    expect(onStash).toHaveBeenCalledOnce()
  })

  it('가공은 갈 화면이 없다 — 버튼 자체가 서지 않는다', () => {
    const { container } = renderWithProviders(
      <ZoneJumpButton process="가공" factory="CTS" onStash={() => {}} />,
    )
    expect(container.querySelector('a')).toBeNull()
  })
})
