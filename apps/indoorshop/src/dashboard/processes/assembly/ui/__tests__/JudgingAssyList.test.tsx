import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import { addProcessMessages } from '../../../../shared/lib/testing/processMessages'
import { assemblyKo } from '../../i18n/ko'
import { assemblyEn } from '../../i18n/en'
import type { JudgingAssy } from '../../lib/judgingAssys'
import { JudgingAssyList } from '../JudgingAssyList'

/* 공정 문구는 부트스트랩이 얹는다 — 컴포넌트 하나만 그리는 테스트는 직접 얹어야 한다 */
addProcessMessages(assemblyKo, assemblyEn)

/**
 * '진행중 판별' 섹션의 화면 계약 (W7-7-5).
 *
 * 값을 만드는 규칙은 `lib/__tests__/judgingAssys.test.ts` 가 본다. 여기서 보는 것은
 * **그린 것**뿐이다 — 줄이 통합실적으로 가는 문이 되는가, 빈 자리를 왜 비었는지 말하는가,
 * 그리고 화면이 자기율을 그대로 내는가(카드가 몰래 반올림·롤업으로 바꿔치지 않는가).
 */
function assy(over: Partial<JudgingAssy> = {}): JudgingAssy {
  return {
    projNo: '7004',
    blockNo: '222',
    blockKey: '7004-222',
    assyNo: '7004-222-M02',
    tier: 'mid',
    selfRate: 62.5,
    recognizedQty: 5,
    reqQty: 8,
    mapBay: '6',
    href: '/indoorshop/performance?vessel=7004&block=222&assy=7004-222-M02',
    ...over,
  }
}

describe('줄이 통합실적으로 가는 문이다', () => {
  it('줄 전체가 그 ASSY 를 지목한 링크다', () => {
    renderWithProviders(<JudgingAssyList assys={[assy()]} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/indoorshop/performance?vessel=7004&block=222&assy=7004-222-M02')
    expect(link).toHaveTextContent('7004-222-M02')
  })

  it('여러 줄이면 줄마다 제 링크를 갖는다', () => {
    renderWithProviders(
      <JudgingAssyList
        assys={[
          assy({ assyNo: 'A-1', href: '/indoorshop/performance?vessel=1&block=2&assy=A-1' }),
          assy({ assyNo: 'A-2', href: '/indoorshop/performance?vessel=1&block=2&assy=A-2' }),
        ]}
      />
    )
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([
      '/indoorshop/performance?vessel=1&block=2&assy=A-1',
      '/indoorshop/performance?vessel=1&block=2&assy=A-2',
    ])
  })
})

describe('무엇을 적는가', () => {
  it('급·번호·자리·자기율·분수를 한 줄에 낸다', () => {
    renderWithProviders(<JudgingAssyList assys={[assy()]} />)
    expect(screen.getByText('중조')).toBeInTheDocument()
    expect(screen.getByText('7004-222-M02')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('63')).toBeInTheDocument() // 62.5 → 반올림
    expect(screen.getByText('5/8')).toBeInTheDocument()
  })

  it('자리를 모르면 대시 — 빈 칸으로 두지 않는다', () => {
    renderWithProviders(<JudgingAssyList assys={[assy({ mapBay: null })]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('기준이 자기율임을 머리에서 말한다 — 롤업으로 오해하지 않게', () => {
    renderWithProviders(<JudgingAssyList assys={[assy()]} />)
    expect(screen.getByText('판별 자기율 (하위 미합산)')).toBeInTheDocument()
  })
})

describe('빈 자리·로딩', () => {
  it('비면 왜 비었는지 말한다 — 완료된 것은 이미 떠났다', () => {
    renderWithProviders(<JudgingAssyList assys={[]} />)
    expect(
      screen.getByText('이 공장에서 진행 중인 판별이 없습니다 — 완료된 것은 이미 공장을 떠났습니다.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('아직 안 왔으면 불러오는 중이라 말한다 — 없음과 구분한다', () => {
    renderWithProviders(<JudgingAssyList assys={null} loading />)
    expect(screen.getByText('불러오는 중')).toBeInTheDocument()
    expect(screen.queryByText(/진행 중인 판별이 없습니다/)).not.toBeInTheDocument()
  })

  it('제목은 언제나 선다 — 비어도 자리가 사라지지 않는다', () => {
    renderWithProviders(<JudgingAssyList assys={[]} />)
    expect(screen.getByRole('heading', { name: '진행중 판별' })).toBeInTheDocument()
  })
})
