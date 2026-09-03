import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { BlockSearch } from '../ui/BlockSearch'

/*
 * 대시보드 블록 검색의 **존재감 계약** (UX 감사 — "못 찾는 수준" 지적의 수리).
 *
 * 시각은 스타일시트의 몫이지만, 그 시각을 움직이는 **상태 전이**는 여기서 잠근다:
 * 포커스하면 입력이 펴지고(placeholder 의 예시가 다 보인다), 글자가 남아 있는 동안은
 * 접히지 않으며, 블록 특화 칩·예시 플레이스홀더가 실제로 그려진다. 이 전이가 죽으면
 * 검색은 다시 "작은 회색 상자"로 돌아간다.
 */

const noop = () => {}

const setup = () =>
  renderWithProviders(
    <BlockSearch loadIndex={null} hit={null} onPick={noop} onClear={noop} />
  )

describe('블록 검색 존재감', () => {
  it('블록 특화 칩과 예시 플레이스홀더가 선다 — 전역 팔레트와의 분업이 보인다', () => {
    setup()
    expect(screen.getByText('블록')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('호선-블록 검색 · 예 7004-222')).toBeInTheDocument()
  })

  it('포커스하면 펴지고, 빈 채로 떠나면 접힌다', async () => {
    setup()
    const input = screen.getByLabelText('블록 검색')
    expect(input).toHaveAttribute('data-expanded', 'false')

    await userEvent.click(input)
    expect(input).toHaveAttribute('data-expanded', 'true')

    await userEvent.tab()
    expect(input).toHaveAttribute('data-expanded', 'false')
  })

  it('글자가 남아 있으면 포커스를 잃어도 편 채로 있다 — 입력 중 폭이 줄면 글자가 밀린다', async () => {
    setup()
    const input = screen.getByLabelText('블록 검색')
    await userEvent.type(input, '7004')
    await userEvent.tab()
    expect(input).toHaveAttribute('data-expanded', 'true')
  })

  it('로스터 결과는 색인 로더 없이도 뜬다 (기존 동작 보존)', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004-222')
    expect(await screen.findByText('재공 블록')).toBeInTheDocument()
    expect(screen.getByText('7004-222')).toBeInTheDocument()
  })
})
