import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { generateAssyUnits } from '../api/performanceApi'
import type { OutfittingOverall, OutfittingRow } from '../api/outfittingPerformance'
import { AssemblyCard } from '../ui/AssemblyCard'
import { OutfittingCard } from '../ui/OutfittingCard'
import {
  findBlock,
  pcdHrefOfAssy,
  pcdHrefOfOutfittingBlock,
} from '../../../entities/vessel'

/**
 * 통합실적 진행중 줄의 'PCD 뷰' 문 (W8-3) — 소재를 아는 줄에만 서고, URL 은 로스터
 * 소재 그대로다. 소재 미상 줄에는 문이 없다(지어내지 않는다).
 */
const BASE = '2026-09-03'

describe('AssemblyCard — 진행중 ASSY 줄의 PCD 뷰', () => {
  it('소재를 아는 미완료 ASSY 줄에 PCD 링크가 서고 href=로스터 소재다', () => {
    const summary = generateAssyUnits('2540', '283', BASE)
    renderWithProviders(<AssemblyCard summary={summary} />)

    const links = screen.getAllByRole('link', { name: /PCD 뷰/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      const href = link.getAttribute('href')!
      /* href 는 조립 베이 워크스페이스 + 선택 승계 쿼리 + 착지 탭(R28) */
      expect(href).toMatch(
        /^\/indoorshop\/zones\/assembly\/asm-[a-z0-9]+\/asm-[a-z0-9]+-b\d+\?block=2540-283&tab=viewer$/
      )
    }
    /* 미완료 ASSY 중 소재(placement.berth) 있는 것 전부에 문이 선다 */
    const expected = summary.assys.filter((assy) => {
      if (assy.done) return false
      return pcdHrefOfAssy(assy.assyNo) != null
    })
    expect(links.length).toBe(expected.length)
  })

  it('소재 미상 블록(정반 없는 7004-310)의 줄에는 PCD 링크가 없다', () => {
    expect(findBlock('7004', '310')?.berth).toBeUndefined()
    const summary = generateAssyUnits('7004', '310', BASE)
    renderWithProviders(<AssemblyCard summary={summary} />)
    expect(screen.queryAllByRole('link', { name: /PCD 뷰/ })).toHaveLength(0)
  })

  /*
   * **실측 블록에도 돌아가는 문이 선다** (R31). 통합실적 → 실측 공장뷰 방향이 없어서,
   * 실측 정반에서 통합실적으로 건너간 사용자는 브라우저 뒤로가기 말고는 돌아올 길이
   * 없었다. 목업 진행중 줄과 **같은 컴포넌트·같은 문법**이다 — 실측만 다른 문을 만들지
   * 않는다(그러면 같은 동작이 화면마다 다르게 생긴다).
   */
  it('실측 블록의 진행중 줄이 실측 워크스페이스(PBS 5BAY)로 착지한다', () => {
    const summary = generateAssyUnits('5510', '553', BASE)
    renderWithProviders(<AssemblyCard summary={summary} />)

    const links = screen.getAllByRole('link', { name: /PCD 뷰/ })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe(
        '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5?block=5510-553&tab=viewer'
      )
    }
    /* 지금 붙고 있는 대조 줄에는 반드시 문이 있다 — 그 줄이 곧 "실측 정반에서 보라" 다 */
    expect(pcdHrefOfAssy('5510-553-G01')).toBe(
      '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b5?block=5510-553&tab=viewer'
    )
  })
})

describe('OutfittingCard — 진행중 블록 줄의 PCD 뷰', () => {
  const overall: OutfittingOverall = {
    judgedRate: 50,
    blockCount: 3,
    inProgress: 2,
    justArrived: 0,
  } as OutfittingOverall

  /* 행 재료는 레지스트리(의장 모듈) 몫이라 shared 테스트에서는 로스터 블록으로 직접
   * 짓는다 — 이 검사의 대상은 행이 아니라 줄에 서는 문이다 */
  const rowOf = (
    projNo: string,
    blockNo: string,
    status: OutfittingRow['status']
  ): OutfittingRow => ({
    projNo,
    blockNo,
    factoryId: 'x',
    areaName: '구역',
    wstgCode: 'AA11',
    judgedRate: 50,
    status,
    justArrived: false,
    key: `${projNo}-${blockNo}`,
    orderMatch: 'matched',
  })

  it('작업중 + 베이를 아는 줄에만 링크가 서고 href=로스터 소재다', () => {
    const rows = [
      rowOf('7004', '530', 'in_progress') /* 소재 있음 — 문이 선다 */,
      rowOf('8103', '157', 'in_progress') /* 베이 미상 — 문 없음 */,
      rowOf('2540', '286', 'completed') /* 완료 — 진행중이 아니라 문 없음 */,
    ]
    renderWithProviders(<OutfittingCard rows={rows} overall={overall} />)

    const links = screen.getAllByRole('link', { name: /PCD 뷰/ })
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe(pcdHrefOfOutfittingBlock('7004', '530'))
    expect(links[0].getAttribute('href')).toBe(
      '/indoorshop/zones/outfitting/ofit-bos1/ofit-bos1-b1?block=7004-530&tab=viewer'
    )
  })
})
