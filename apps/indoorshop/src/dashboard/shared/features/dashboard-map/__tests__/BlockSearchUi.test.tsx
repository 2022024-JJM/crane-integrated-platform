import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { SearchField } from '../../global-search'

/*
 * 대시보드 지도 위 검색창의 **존재감 계약** (UX 감사 — "못 찾는 수준" 지적의 수리).
 *
 * 시각은 스타일시트의 몫이지만, 그 시각을 움직이는 **상태 전이**는 여기서 잠근다:
 * 포커스하면 입력이 펴지고(placeholder 의 예시가 다 보인다), 글자가 남아 있는 동안은
 * 접히지 않으며, 예시 플레이스홀더와 단축키 칩이 실제로 그려진다. 이 전이가 죽으면
 * 검색은 다시 "작은 회색 상자"로 돌아간다.
 *
 * ⚠️ 이 창은 이제 `global-search` 모듈의 **임베드 변형**이다 — 예전에는 dashboard-map 이
 * 자기 검색 컴포넌트를 따로 들고 있었고(자기 색인·자기 키보드), 그래서 팔레트와 답이
 * 갈렸다. 칩이 `⌘K` 인 것도 그 통합을 자리에서 말하기 위해서다.
 */

const setup = () => renderWithProviders(<SearchField />)

describe('지도 위 검색창 존재감', () => {
  it('단축키 칩과 예시 플레이스홀더가 선다 — 팔레트와 한 기능임이 보인다', () => {
    setup()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('호선 · 블록 · ASSY · W/O · 설비 검색 (예 7004-222)')
    ).toBeInTheDocument()
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

  it('로스터 결과는 비동기 원천을 기다리지 않고 뜬다 (기존 동작 보존)', async () => {
    setup()
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004-222')
    expect(await screen.findByText('블록')).toBeInTheDocument()
    expect(screen.getByText('7004-222')).toBeInTheDocument()
  })
})
