import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { PerformanceBadge, hasPerformanceBadge } from '../ui/PerformanceBadge'

/*
 * 실적 노출 = **공정 일치** 계약 (P1 ②).
 *
 * 예전에는 어느 공장을 눌러도 조립 판별 실적이 붙었다 — 도장공장을 열어 놓고 조립
 * 인식률을 읽는 화면은 숫자가 맞아도 거짓말이다. 여기가 깨지면 그 사고가 돌아온다.
 */
describe('hasPerformanceBadge — 낼 수 있는 공정만', () => {
  it('조립·도장만 참 — 의장·가공은 이 자리에 낼 절점 원천이 없다', () => {
    expect(hasPerformanceBadge('조립')).toBe(true)
    expect(hasPerformanceBadge('도장')).toBe(true)
    expect(hasPerformanceBadge('의장')).toBe(false)
    expect(hasPerformanceBadge('가공')).toBe(false)
    expect(hasPerformanceBadge(null)).toBe(false)
  })
})

describe('PerformanceBadge — 그 공장 공정의 실적만', () => {
  it('조립 공장은 판별 실적을 낸다', async () => {
    renderWithProviders(<PerformanceBadge factory="PBS" process="조립" />)
    expect(await screen.findByText(/판별 기반 실적/)).toBeInTheDocument()
    expect(screen.queryByText(/스텝 절점 실적/)).toBeNull()
  })

  it('도장공장은 스텝 절점 실적을 낸다 — 조립 판별이 섞이지 않는다', async () => {
    renderWithProviders(<PerformanceBadge factory="2DOCK 도장공장" process="도장" />)
    expect(await screen.findByText(/스텝 절점 실적/)).toBeInTheDocument()
    expect(screen.queryByText(/판별 기반 실적/)).toBeNull()
  })

  it('의장·가공 공장은 배지 자체를 세우지 않는다 — 남의 공정 숫자로 채우지 않는다', async () => {
    for (const [factory, process] of [
      ['POS 1공장', '의장'],
      ['CTS', '가공'],
    ] as const) {
      const { container, unmount } = renderWithProviders(
        <PerformanceBadge factory={factory} process={process} />,
      )
      /* 비동기 로더가 돌 틈을 준 뒤에도 비어 있어야 한다 */
      await waitFor(() => expect(container.firstElementChild).toBeNull())
      unmount()
    }
  })

  it('같은 공장 이름이라도 공정을 안 주면 아무것도 그리지 않는다 (기본값 금지)', async () => {
    const { container } = renderWithProviders(<PerformanceBadge factory="PBS" process={null} />)
    await waitFor(() => expect(container.firstElementChild).toBeNull())
  })

  it('지도의 모든 공장 공정이 이 계약 안에 있다 — 새 공정이 조용히 조립 실적을 받지 않게', async () => {
    const parcels = await loadYardParcels()
    const processes = [...new Set(parcels.factories.map((f) => f.process))]
    expect(processes.length).toBeGreaterThan(0)
    for (const process of processes) {
      /* 참이면 그 공정 전용 실적이 있고, 거짓이면 배지가 서지 않는다 — 둘 다 정의된 결과다 */
      expect(typeof hasPerformanceBadge(process)).toBe('boolean')
    }
    /* 지도에 실제로 있는 공정 중 배지를 내는 것은 조립·도장 둘뿐 */
    expect(processes.filter(hasPerformanceBadge).sort()).toEqual(['도장', '조립'])
  })
})
