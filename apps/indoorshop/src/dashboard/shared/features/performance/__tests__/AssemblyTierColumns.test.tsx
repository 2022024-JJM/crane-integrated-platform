import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { generateAssyUnits } from '../api/performanceApi'
import { AssemblyCard } from '../ui/AssemblyCard'
import { blockOptionsOfVessel, listVessels } from '../../../entities/vessel'

/*
 * 조립 ASSY — 급마다 한 단(대조 → 중조 → 소조, 사용자 확정). 대조를 누르면 그 중조가,
 * 중조를 누르면 그 소조가 아래 단에 선다. 카드가 없는 단은 세우지 않는다.
 */
const BASE = '2026-09-03'

describe('AssemblyCard — 급마다 한 단', () => {
  it('처음(검색만 했을 때)에는 아무 대조도 고르지 않아 대조 단만 선다', () => {
    const summary = generateAssyUnits('7004', '222', BASE)
    renderWithProviders(<AssemblyCard summary={summary} />)
    const grands = within(screen.getByRole('region', { name: '대조' })).getAllByRole('button')
    for (const g of grands) expect(g).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('region', { name: '중조' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '소조' })).not.toBeInTheDocument()
  })

  it('대조를 누르면 중조가, 중조를 누르면 그 중조의 소조만 아래 단에 선다', async () => {
    const summary = generateAssyUnits('7004', '222', BASE)
    renderWithProviders(<AssemblyCard summary={summary} />)
    await userEvent.click(within(screen.getByRole('region', { name: '대조' })).getAllByRole('button')[0])
    const mids = within(screen.getByRole('region', { name: '중조' })).getAllByRole('button', { pressed: false })
    const mid = summary.assys.find((u) => mids[0].id === `assy-${u.assyNo}`)!
    await userEvent.click(mids[0])
    const subs = within(screen.getByRole('region', { name: '소조' }))
      .getAllByText(/-S\d+$/)
      .map((el) => el.textContent)
    const expected = summary.assys.filter((u) => u.parentAssyNo === mid.assyNo && u.tier === 'sub').map((u) => u.assyNo)
    expect(subs).toEqual(expected)
  })
})

describe('AssemblyCard — 고른 카드 + 그 하위 단만 한 테두리로', () => {
  /* 대조가 둘 이상인 블록 — 옆 대조가 묶음 밖에 남는지 본다 */
  const pick = () => {
    for (const vessel of listVessels()) {
      for (const block of blockOptionsOfVessel(vessel.projNo)) {
        const summary = generateAssyUnits(vessel.projNo, block.blockNo, BASE)
        if (summary.assys.filter((u) => u.tier === 'grand').length >= 2) return summary
      }
    }
    throw new Error('대조가 둘인 블록이 없다')
  }

  it('대조를 고르면 그 대조(탭)와 그 중조 칸만 한 테두리로 이어지고 옆 대조는 밖에 남는다 — 카드 자리는 그대로', async () => {
    const summary = pick()
    const { container } = renderWithProviders(<AssemblyCard summary={summary} />)
    expect(container.querySelector('[data-assy-frame]')).toBeNull()

    const grandRegion = screen.getByRole('region', { name: '대조' })
    const cards = () => [...grandRegion.querySelectorAll<HTMLElement>(':scope [data-assy-card="grand"]')]
    const [first, second] = cards()
    /* 고르기 전에도 모든 카드는 같은 테두리 자리(투명)에 서 있다 — 고를 때 자리가 움직이지 않는다 */
    expect(first.parentElement!.className).toContain('border-transparent')
    expect(second.parentElement!.className).toContain('border-transparent')

    await userEvent.click(first)
    /* 고른 대조의 자리(탭)만 색이 들고, 옆 대조는 그대로 투명 */
    expect(first.parentElement!.className).toContain('border-accent/50')
    expect(second.parentElement!.className).toContain('border-transparent')
    /* 탭 바로 아래 칸에 그 중조 단이 — 대조 단은 칸 밖 */
    const outer = container.querySelector<HTMLElement>('[data-assy-frame="0"]')!
    expect(within(outer).getByRole('region', { name: '중조' })).toBeInTheDocument()
    expect(outer.contains(first)).toBe(false)
    expect(outer.contains(second)).toBe(false)
    /* 들여쓰기로 계층을 보이지 않는다 */
    for (const region of within(outer).getAllByRole('region')) expect(region.className).not.toMatch(/\bml-\d|\bpl-\d|border-l-2/)

    const midRegion = within(outer).getByRole('region', { name: '중조' })
    const mid = midRegion.querySelector<HTMLElement>('[data-assy-card="mid"]')!
    await userEvent.click(mid)
    const inner = outer.querySelector<HTMLElement>('[data-assy-frame="1"]')
    if (inner) {
      expect(mid.parentElement!.className).toContain('border-accent/35')
      expect(within(inner).getByRole('region', { name: '소조' })).toBeInTheDocument()
    }
  })
})
