import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import { PaintingCard } from '../PaintingCard'
import type { PaintingStepState, PaintingSummary } from '../../model/types'

/*
 * 도장 카드의 **일일공정률 자리**만 본다.
 *
 * 그 값은 YPWG413M 의 하루 1회 일괄 등록에서 오므로, 오늘 치가 아직 안 온 스텝이
 * 정상적으로 존재한다. 그때 카드가 내는 % 는 일일공정률이 아니라 완료 행 기준으로
 * **물러선** 값이다 — 사용자가 그 둘을 같은 것으로 읽으면 진척을 잘못 판단한다.
 * (현재 목업 데이터에는 이 조합이 없어서 브라우저로는 볼 수 없는 자리다.)
 */

function step(overrides: Partial<PaintingStepState> = {}): PaintingStepState {
  return {
    step: 'SP',
    status: 'inProgress',
    woNo: 'WO-00676',
    elmtItemCodes: ['S1'],
    plannedRows: 8,
    doneRows: 2,
    progressPct: 25,
    progressAsOf: null,
    progressHistory: [],
    startDate: '2026-09-01',
    endDate: null,
    confirmed: false,
    ...overrides,
  }
}

function summary(steps: PaintingStepState[]): PaintingSummary {
  return {
    steps,
    doneSteps: 0,
    confirmedSteps: 0,
    phase: 'inShop',
    factory: '도장 1공장',
    btsInDate: '2026-09-01',
    btsOutDate: null,
  }
}

describe('도장 카드 — 일일공정률', () => {
  it('오늘 치 일괄 등록이 안 온 스텝은 그 사실을 먼저 말한다', () => {
    renderWithProviders(<PaintingCard summary={summary([step()])} />)

    expect(screen.getByText('오늘 배치가 아직 도착하지 않았습니다')).toBeInTheDocument()
    /* 왜 이 % 인지 — 완료 행 기준으로 물러섰다는 사실이 함께 선다 */
    expect(screen.getByText(/완료 행만 반영/)).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('등록분이 있으면 그 날짜를 내고 배치 안내는 서지 않는다', () => {
    renderWithProviders(
      <PaintingCard summary={summary([step({ progressPct: 45, progressAsOf: '2026-09-02' })])} />
    )

    expect(screen.getByText(/2026-09-02 등록분 기준/)).toBeInTheDocument()
    expect(screen.queryByText('오늘 배치가 아직 도착하지 않았습니다')).not.toBeInTheDocument()
  })

  it('진행 중이 아닌 스텝에는 일일공정률 자리 자체가 없다', () => {
    renderWithProviders(
      <PaintingCard summary={summary([step({ status: 'notDue', doneRows: 0 })])} />
    )

    expect(screen.queryByText('오늘 배치가 아직 도착하지 않았습니다')).not.toBeInTheDocument()
    expect(screen.queryByText(/일일공정률/)).not.toBeInTheDocument()
  })
})
