import { describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import type {
  BlockModelManifest,
  LoadedBlockModel,
} from '../../../../shared/features/bay-viewer/model/blockModel'

/* 3D 뷰어는 WebGL 이 필요하다 — jsdom 에서는 골격만 세운다(여기서 보는 것은 워크스페이스 구조다) */
vi.mock('../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer', async (importOriginal) => {
  const original = await importOriginal<object>()
  return {
    ...original,
    LidarPointCloudViewer: (props: { mode: string; bays: unknown[] }) => (
      <div data-testid="viewer" data-mode={props.mode} data-bays={props.bays.length} />
    ),
  }
})
vi.mock('../../../../shared/features/bay-viewer/api/loadBlockModel', () => ({
  loadBlockModel: vi.fn(async (projNo: string, blkNo: string): Promise<LoadedBlockModel> => {
    const manifest: BlockModelManifest = {
      projNo,
      blkNo,
      wstgCode: 'AA11',
      source: 'test',
      size: [10, 4, 20],
      restQuat: [0, 0, 0, 1],
      restBboxMin: [-5, 0, -10],
      restBboxMax: [5, 4, 10],
      assemblies: [],
    }
    return { manifest, positions: new Float32Array(0) }
  }),
}))

/* 모듈 i18n 조각은 앱 bootstrap 이 등록한다 — 테스트에서는 손으로 등록한다 */
const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { outfittingKo } = await import('../../i18n/ko')
const { outfittingEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', outfittingKo, true, true)
i18n.addResourceBundle('en', 'inshop', outfittingEn, true, true)

const { OutfittingWorkspace } = await import('../pages/OutfittingWorkspace')

function renderWorkspace(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/zones/outfitting/:factoryId" element={<OutfittingWorkspace />} />
      <Route path="/zones/outfitting/:factoryId/:locationId" element={<OutfittingWorkspace />} />
      <Route path="/performance" element={<div data-testid="performance-page" />} />
    </Routes>,
    { route: path }
  )
}

/**
 * 의장 공장 워크스페이스 (W7-10) — **조립과 같은 구조**의 화면 계약.
 * 축 탭 3개, 공장 전환 탭, 3D 공장 뷰(전 베이), 센서·블록 탭의 콘텐츠 이동을 지킨다.
 */
describe('OutfittingWorkspace', () => {
  it('축 탭 [3D 뷰어|센서 상태|블록·실적] 이 서고, 기본은 공장 전체 3D 뷰다', async () => {
    renderWorkspace('/zones/outfitting/ofit-pos1')

    const tablist = await screen.findByRole('tablist', { name: '화면 축 선택' })
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)
    expect(tabs).toEqual(['3D 뷰어', '센서 상태', '블록·실적'])

    /* 공장 전체 뷰 — POS 1공장 7베이 전부가 한 장면에 */
    const viewer = await screen.findByTestId('viewer')
    await waitFor(() => expect(viewer.dataset.mode).toBe('factory'))
    expect(viewer.dataset.bays).toBe('7')
  })

  it('공장 전환 탭 — 7공장이 전부 서고 현재 공장이 표시된다 (조립 탭 문법)', async () => {
    renderWorkspace('/zones/outfitting/ofit-pos1')
    /* 붙은 공장 탭 + 유리 베이 알약 — LocationTabs 두 벌이 같은 라벨을 단다 (조립도 같다) */
    const navs = await screen.findAllByRole('navigation', { name: '공장 및 베이 전환' })
    const factoryNav = navs[0]
    await waitFor(() => {
      expect(factoryNav.querySelectorAll('a[aria-current="page"]').length).toBeGreaterThan(0)
    })
    expect(factoryNav.textContent).toContain('POS 1공장')
    expect(factoryNav.textContent).toContain('두모 선행의장 2공장')
    expect(factoryNav.textContent).toContain('OFD조립의장 셸터')
  })

  it('센서 상태 탭 — 베이마다 한 장씩, 라이다 목록이 선다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/zones/outfitting/ofit-pos1')
    await screen.findByTestId('viewer')

    await user.click(screen.getByRole('tab', { name: '센서 상태' }))
    /* 1BAY 의 이관 라이다가 이름 그대로 선다 */
    expect(await screen.findByText('LD-O101')).toBeInTheDocument()
    expect(screen.getByText('1BAY')).toBeInTheDocument()
  })

  it('블록·실적 탭 — 블록 줄이 통합실적 딥링크를 유지한다', async () => {
    const user = userEvent.setup()
    renderWorkspace('/zones/outfitting/ofit-pos1')
    await screen.findByTestId('viewer')

    await user.click(screen.getByRole('tab', { name: '블록·실적' }))
    await screen.findByRole('heading', { name: /블록 현황/ })
    const links = [...document.querySelectorAll('a[href^="/performance?vessel="]')]
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute('href')).toMatch(/vessel=\d+&block=/)
  })

  it('베이 레벨 — /zones/outfitting/{공장}/{베이} 가 그 베이의 3D 뷰로 선다', async () => {
    renderWorkspace('/zones/outfitting/ofit-pos1/ofit-pos1-b1')
    const viewer = await screen.findByTestId('viewer')
    await waitFor(() => expect(viewer.dataset.mode).toBe('bay'))
    expect(viewer.dataset.bays).toBe('1')
    /* 머리글이 베이 이름을 말한다 */
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('1BAY')
  })
})
