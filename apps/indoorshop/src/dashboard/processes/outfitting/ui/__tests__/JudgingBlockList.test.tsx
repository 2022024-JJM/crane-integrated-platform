import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import { addProcessMessages } from '../../../../shared/lib/testing/processMessages'
import { outfittingKo } from '../../i18n/ko'
import { outfittingEn } from '../../i18n/en'
import type { OutfittingWipBlock } from '../../../../shared/model/processModule'
import { JudgingBlockList } from '../JudgingBlockList'

/* 공정 문구는 부트스트랩이 얹는다 — 컴포넌트 하나만 그리는 테스트는 직접 얹어야 한다 */
addProcessMessages(outfittingKo, outfittingEn)

/**
 * '진행중 판별' 구획의 화면 계약 (W8-4).
 *
 * 값 규칙(집합·수치가 통합실적과 같은가)은 `src/__tests__/outfittingJudgingParity.test.ts`
 * 가 본다. 여기서 보는 것은 **그린 것**이다 — 줄이 통합실적으로 가는 문인가, 판별 %가
 * 그 줄의 주인공인가, 비었을 때 아래 목록으로 안내하는가(중복이 아니라 역할이 다르다는
 * 사실이 문구로 드러나는가).
 */
function block(over: Partial<OutfittingWipBlock> = {}): OutfittingWipBlock {
  return {
    projNo: '7004',
    blockNo: '530',
    factoryId: 'ofit-bos1',
    areaName: '조립의장 1공장 BOS 1',
    wstgCode: 'E11',
    judgedRate: 59,
    status: 'in_progress',
    justArrived: false,
    ...over,
  }
}

describe('줄이 통합실적으로 가는 문이다', () => {
  it('줄 전체가 그 블록의 통합실적 링크다', () => {
    renderWithProviders(<JudgingBlockList blocks={[block()]} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/indoorshop/performance?vessel=7004&block=530')
    expect(link).toHaveTextContent('7004-530')
  })

  it('여러 줄이면 줄마다 제 링크를 갖는다', () => {
    renderWithProviders(
      <JudgingBlockList blocks={[block(), block({ blockNo: '534' })]} />
    )
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/indoorshop/performance?vessel=7004&block=530',
      '/indoorshop/performance?vessel=7004&block=534',
    ])
  })
})

describe('무엇을 적는가', () => {
  it('블록번호·구역·송선기호·판별 %를 한 줄에 낸다', () => {
    renderWithProviders(<JudgingBlockList blocks={[block()]} />)
    const link = screen.getByRole('link')
    for (const text of ['7004-530', '조립의장 1공장 BOS 1', 'E11', '59']) {
      expect(link).toHaveTextContent(text)
    }
  })

  it('기준이 블록 단위 판별임을 머리에서 말한다 — 계층으로 오해하지 않게', () => {
    renderWithProviders(<JudgingBlockList blocks={[block()]} />)
    expect(screen.getByText('블록 단위 판별 % (계층 없음)')).toBeInTheDocument()
  })

  it('개수를 제목 옆에 낸다', () => {
    renderWithProviders(<JudgingBlockList blocks={[block(), block({ blockNo: '534' })]} />)
    expect(screen.getByRole('heading', { name: /진행중 판별/ })).toHaveTextContent('2')
  })

  it('계층 어휘(대조·중조·소조·ASSY)가 화면에 없다', () => {
    const { container } = renderWithProviders(<JudgingBlockList blocks={[block()]} />)
    const text = container.textContent ?? ''
    for (const word of ['대조', '중조', '소조', 'ASSY']) {
      expect(`${word} 있음=${text.includes(word)}`).toBe(`${word} 있음=false`)
    }
  })
})

describe('빈 자리 — 아래 목록과 역할이 다르다는 것을 말한다', () => {
  it('비면 완료·대기는 아래 목록에 있다고 안내한다', () => {
    renderWithProviders(<JudgingBlockList blocks={[]} />)
    expect(
      screen.getByText(
        '이 공장에서 진행 중인 판별이 없습니다 — 완료·대기 블록은 아래 목록에 있습니다.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('제목은 언제나 선다 — 비어도 자리가 사라지지 않는다', () => {
    renderWithProviders(<JudgingBlockList blocks={[]} />)
    expect(screen.getByRole('heading', { name: /진행중 판별/ })).toBeInTheDocument()
  })

  it('차 있으면 원천이 통합실적과 같다는 사실을 적는다', () => {
    renderWithProviders(<JudgingBlockList blocks={[block()]} />)
    expect(screen.getByText(/통합실적 의장 카드와 같은 원천/)).toBeInTheDocument()
  })
})
