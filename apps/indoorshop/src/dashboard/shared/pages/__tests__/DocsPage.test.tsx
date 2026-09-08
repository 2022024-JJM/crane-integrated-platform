import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../lib/testing/renderWithProviders'
import { DocsPage } from '../DocsPage'

/*
 * 문서 목록의 빈 상태 두 갈래 (UX 감사 F-28).
 *
 * 예전에는 목록이 비면 무조건 `"" 와(과) 맞는 문서가 없습니다` — 빈 검색어가 문구에
 * 그대로 실렸다. "검색이 못 찾았다"와 "원래 아무것도 없다"는 다음 행동이 다른 사정
 * 이므로(검색어를 고친다 vs 등록을 기다린다) 문구가 갈라져야 한다.
 */

/* 레포 .md 를 통째 싣는 실제 레지스트리 대신 빈 우주 — 0건 화면을 세우기 위한 것 */
vi.mock('../../entities/doc/api/docsRegistry', () => ({
  listDocGroups: () => [],
}))

describe('문서 목록 빈 상태', () => {
  it('검색어 없이 0건이면 "등록된 문서가 없습니다" — 빈 따옴표를 싣지 않는다', () => {
    renderWithProviders(<DocsPage />)
    expect(screen.getByText('등록된 문서가 없습니다')).toBeInTheDocument()
    /* 결함 재발 감지 — 빈 검색어가 문구에 끼어들면 이 형태가 다시 나타난다 */
    expect(screen.queryByText(/[‘"]\s*[’"]/)).toBeNull()
  })

  it('검색어가 있으면 그 검색어를 넣은 "맞는 문서 없음" 문구가 선다', async () => {
    renderWithProviders(<DocsPage />)
    await userEvent.type(screen.getByRole('searchbox'), 'MQTT')
    expect(screen.getByText(/‘MQTT’ 에 맞는 문서가 없습니다/)).toBeInTheDocument()
  })
})
