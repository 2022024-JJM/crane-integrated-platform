import { describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import type { BayAirState } from '../../lib/airEffect'

/*
 * 가동 뷰의 3D 는 WebGL 이 필요하다 — jsdom 에서는 골격만 세운다. 여기서 보는 것은 그림이
 * 아니라 **배선**이다: 탭이 뷰어를 세우는가, 그리고 **이 공장의** 대기를 넘기는가.
 * (뷰어 자신의 껍데기 계약은 `PaintingAirViewer.test.tsx` 가 본다.)
 */
vi.mock('../PaintingAirViewer', () => ({
  PaintingAirViewer: (props: { bays: BayAirState[] }) => (
    <div
      data-testid="air-viewer"
      data-bays={props.bays.length}
      data-bay-names={props.bays.map((bay) => bay.bay).join(',')}
    />
  ),
}))

const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { paintingKo } = await import('../../i18n/ko')
const { paintingEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', paintingKo, true, true)
i18n.addResourceBundle('en', 'inshop', paintingEn, true, true)

const { PaintingFactoryStatusPage } = await import('../pages/PaintingFactoryStatusPage')

function renderPage(path = '/indoorshop/zones/painting/pnt-1dock') {
  return renderWithProviders(
    <Routes>
      <Route path="/indoorshop/zones/painting/:factoryId" element={<PaintingFactoryStatusPage />} />
    </Routes>,
    { route: path }
  )
}

/**
 * 도장 공장 화면의 축 탭 (P4·R24) — 조립·의장과 **같은 세 칸**이고,
 * 가운데 칸에는 **가동 뷰의 실체**가 선다(P4 가 세워 둔 빈 자리를 R24 가 채웠다).
 */
describe('PaintingFactoryStatusPage — 축 탭', () => {
  it('[현황 | 가동 뷰 | 공장 현황] 이 서고 기본은 현황이다', async () => {
    renderPage()
    const tablist = await screen.findByRole('tablist', { name: '화면 축 선택' })
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)
    expect(tabs).toEqual(['현황', '가동 뷰', '공장 현황'])
    expect(screen.getByRole('tab', { name: '현황' })).toHaveAttribute('aria-selected', 'true')
  })

  it('현황 탭 — 공장 목록과 설비 그리드가 선다 (세 공정 공용 보드)', async () => {
    renderPage()
    const list = await screen.findByRole('list', { name: '공장 목록' })
    expect(list.textContent).toContain('1DOCK 도장공장')
    expect(list.textContent).toContain('느태 도장공장')
    /* 이관 설비 fixture 의 실 ID(EQ###)가 셀로 선다 */
    expect((await screen.findAllByRole('button', { name: /^EQ\d+$/ })).length).toBeGreaterThan(0)
  })

  it('가동 뷰 탭에 뷰어 실체가 선다 — 자리표시가 아니다 (R24)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('tab', { name: '가동 뷰' }))
    /* 뷰어는 탭을 열 때 받아 온다(lazy) — 설 때까지 기다린다 */
    const viewer = await screen.findByTestId('air-viewer')
    expect(viewer).toBeInTheDocument()
    /* 무엇을 그리는 뷰인지도 그 자리에서 말한다 */
    expect(screen.getByText(/설비가 만드는 공기/)).toBeInTheDocument()
  })

  it('가동 뷰가 받는 것은 **이 공장의** 대기다 — 공장이 바뀌면 베이도 바뀐다 (R24)', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage('/indoorshop/zones/painting/pnt-1dock')
    await screen.findByRole('tablist', { name: '화면 축 선택' })
    await user.click(screen.getByRole('tab', { name: '가동 뷰' }))

    /* 1DOCK 도장공장 설비 30대가 15개 베이로 접힌다 (`lib/airEffect` 의 집계) */
    const dock = await screen.findByTestId('air-viewer')
    expect(dock.dataset.bays).toBe('15')
    expect(dock.dataset.bayNames).toContain('B1')
    unmount()

    renderPage('/indoorshop/zones/painting/pnt-neutae')
    await screen.findByRole('tablist', { name: '화면 축 선택' })
    await user.click(screen.getByRole('tab', { name: '가동 뷰' }))

    const neutae = await screen.findByTestId('air-viewer')
    expect(neutae.dataset.bays).toBe('6')
    expect(neutae.dataset.bayNames).toContain('NP1')
  })

  it('공장 현황 탭 — 스텝 진행·블록 목록이 그대로 남아 있다 (딥링크 보존)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('tab', { name: '공장 현황' }))
    expect(screen.getByRole('heading', { name: /스텝 진행/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /블록 목록|재공 블록/ })).toBeInTheDocument()
  })
})
