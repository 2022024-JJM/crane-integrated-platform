import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'

/* 모듈 i18n 조각은 앱 bootstrap 이 등록한다 — 테스트에서는 손으로 등록한다 */
const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { outfittingKo } = await import('../../i18n/ko')
i18n.addResourceBundle('ko', 'inshop', { outfitting: outfittingKo.outfitting }, true, true)

const { OutfittingEquipmentStatusPage } = await import('../pages/OutfittingEquipmentStatusPage')

/**
 * 설비 관제 화면의 **역할**과 워크스페이스로 돌아가는 문 (W8-5).
 *
 * 이 화면은 전 공장 관제다 — 공장을 고르는 목록이 왼쪽에 있고, 고른 공장이 URL 에 실린다.
 * 그 열쇠(`?shop=`)가 있어야 워크스페이스 센서 탭에서 넘어올 때 그 공장이 열린다.
 */
describe('의장 설비 관제 화면', () => {
  it('전 공장을 고를 수 있다 — 여기가 관제, 워크스페이스는 그 공장 화면이다', () => {
    renderWithProviders(<OutfittingEquipmentStatusPage />, {
      route: '/indoorshop/zones/outfitting/equipment',
    })
    /* 공장 고르기 버튼이 7개(의장 공장 수)만큼 선다 */
    expect(screen.getByRole('button', { name: /POS 1공장/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /두모 선행의장 2공장/ })).toBeInTheDocument()
  })

  it('`?shop=` 딥링크로 들어오면 그 공장이 열린다', () => {
    renderWithProviders(<OutfittingEquipmentStatusPage />, {
      route: `/indoorshop/zones/outfitting/equipment?shop=${encodeURIComponent('두모 선행의장 2공장')}`,
    })
    expect(
      screen.getByRole('heading', { level: 2, name: '두모 선행의장 2공장' })
    ).toBeInTheDocument()
  })

  it('모르는 공장 이름이 오면 첫 공장으로 선다 — 빈 화면을 두지 않는다', () => {
    renderWithProviders(<OutfittingEquipmentStatusPage />, {
      route: '/indoorshop/zones/outfitting/equipment?shop=없는공장',
    })
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it("고른 공장의 '워크스페이스로' 문이 그 공장 경로로 열린다 (반대 방향 링크)", () => {
    renderWithProviders(<OutfittingEquipmentStatusPage />, {
      route: `/indoorshop/zones/outfitting/equipment?shop=${encodeURIComponent('POS 1공장')}`,
    })
    const link = screen.getByRole('link', { name: '워크스페이스로' })
    expect(link.getAttribute('href')).toBe('/indoorshop/zones/outfitting/ofit-pos1')
  })

  it('본문은 관제 화면과 같은 설비 그리드다 — 워크스페이스 탭과 같은 컴포넌트', () => {
    renderWithProviders(<OutfittingEquipmentStatusPage />, {
      route: `/indoorshop/zones/outfitting/equipment?shop=${encodeURIComponent('POS 1공장')}`,
    })
    /* 그리드 셀은 설비ID 를 이름으로 쓴다(이관 설비) */
    expect(screen.getByRole('button', { name: 'LD-O101' })).toBeInTheDocument()
  })
})
