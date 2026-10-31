import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FolderPanel, FolderTabs } from '../FolderTabs'

const items = [
  { key: 'status', label: '현황' },
  { key: 'viewer', label: '3D 뷰어' },
] as const

describe('FolderTabs', () => {
  it('고른 탭만 위·양옆 테두리로 서고 아래 내용 칸과 한 테두리로 이어진다', () => {
    render(<FolderTabs ariaLabel="화면 축 선택" items={items} value="viewer" onChange={() => undefined} />)
    const on = screen.getByRole('tab', { name: '3D 뷰어', selected: true })
    const off = screen.getByRole('tab', { name: '현황', selected: false })
    /* 고른 탭은 밑을 비우고 1px 내려와 칸의 윗변을 덮는다 */
    expect(on.className).toContain('border-b-0')
    expect(on.className).toContain('-mb-px')
    expect(off.className).not.toContain('-mb-px')
  })

  it('탭을 누르면 그 키를 알린다', async () => {
    const onChange = vi.fn()
    render(<FolderTabs ariaLabel="화면 축 선택" items={items} value="status" onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: '3D 뷰어' }))
    expect(onChange).toHaveBeenCalledWith('viewer')
  })

  it('강조는 부품 안에서 즉시 바뀐다 — 바깥 값이 아직 따라오지 않아도', async () => {
    render(<FolderTabs ariaLabel="화면 축 선택" items={items} value="status" onChange={() => undefined} />)
    await userEvent.click(screen.getByRole('tab', { name: '3D 뷰어' }))
    expect(screen.getByRole('tab', { name: '3D 뷰어', selected: true })).toBeInTheDocument()
  })

  it('내용 칸은 네 변을 두르고 네 모서리가 다 둥글다', () => {
    render(<FolderPanel>본문</FolderPanel>)
    const cls = screen.getByText('본문').className
    expect(cls).toContain('rounded-inshop-lg')
    expect(cls).not.toContain('rounded-tl-none')
    expect(cls).not.toContain('border-t-0')
  })
})
