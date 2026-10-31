import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import { BlockPicker } from '../BlockPicker'

const options = [
  { blockNo: '222', factory: '조립4공장-OFD1' },
  { blockNo: '223', factory: 'PBS' },
  { blockNo: '310', factory: 'PBS' },
]

function setup(selected: string[] = [], opts = options) {
  const onApply = vi.fn()
  renderWithProviders(<BlockPicker options={opts} selected={selected} onApply={onApply} />)
  return { onApply, user: userEvent.setup() }
}

describe('BlockPicker — 체크박스 + 확인', () => {
  it('체크는 초안이고, 확인을 눌러야 호선 블록 순서로 알린다', async () => {
    const { user, onApply } = setup()
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(screen.getByRole('checkbox', { name: /^310/ }))
    await user.click(screen.getByRole('checkbox', { name: /^222/ }))
    expect(onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onApply).toHaveBeenCalledWith(['222', '310'])
  })

  it('지금 탭이 체크된 채로 열리고, 하나도 고르지 않으면 확인을 막는다', async () => {
    const { user } = setup(['222'])
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    expect(screen.getByRole('checkbox', { name: /^222/ })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /^222/ }))
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled()
  })

  it('취소하면 초안을 버린다', async () => {
    const { user, onApply } = setup(['222'])
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(screen.getByRole('checkbox', { name: /^310/ }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(onApply).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    expect(screen.getByRole('checkbox', { name: /^310/ })).not.toBeChecked()
  })
})

describe('BlockPicker — 검색 · 전체', () => {
  it('검색어로 목록을 거른다', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.type(screen.getByRole('searchbox', { name: '블록 번호 검색' }), '31')
    expect(within(screen.getByRole('list', { name: '블록' })).getAllByRole('checkbox')).toHaveLength(1)
  })

  it('검색으로 걸러진 블록 하나만 켜도 전체는 켜지지 않는다 — 전체는 호선의 블록 전부 기준', async () => {
    const { user, onApply } = setup()
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.type(screen.getByRole('searchbox', { name: '블록 번호 검색' }), '31')
    await user.click(screen.getByRole('checkbox', { name: /^310/ }))
    const all = screen.getByRole('checkbox', { name: /전체/ })
    expect(all).not.toBeChecked()
    expect((all as HTMLInputElement).indeterminate).toBe(true)
    /* 전체를 누르면 걸러진 것과 상관없이 호선의 블록 전부를 켠다 */
    await user.click(all)
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onApply).toHaveBeenCalledWith(['222', '223', '310'])
  })

  it('맞는 블록이 없으면 그렇게 말한다', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.type(screen.getByRole('searchbox', { name: '블록 번호 검색' }), '999')
    expect(screen.getByText('맞는 블록이 없습니다')).toBeInTheDocument()
  })
})

describe('BlockPicker — 최대 10개', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ blockNo: String(100 + i), factory: 'PBS' }))

  it('10개를 고르면 나머지는 고를 수 없고, 전체도 10개까지만 켠다', async () => {
    const { user, onApply } = setup([], many)
    await user.click(screen.getByRole('button', { name: /블록 선택/ }))
    await user.click(screen.getByRole('checkbox', { name: /전체/ }))
    expect(screen.getByRole('checkbox', { name: /^110/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /^100/ })).toBeEnabled()
    expect(screen.getByText('최대 10개까지 고를 수 있습니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onApply.mock.calls[0][0]).toHaveLength(10)
  })
})
