import { describe, expect, it } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { stubRect } from '../../../lib/testing/domGeometry'
import { hasEscapeClaims } from '../../../lib/escapeClaims'
import { TourController } from '../ui/TourController'
import { DASHBOARD_TOUR } from '../model/dashboardTour'
import { isTourSeen, markTourSeen, tourStorageKey, type TourStorage } from '../lib/tourStorage'
import { startTour } from '../lib/tourBus'

/*
 * 인앱 투어 (W8-1) — 스텝 진행·건너뛰기·영구 기억·ESC 종료.
 *
 * 대상 요소들은 화면마다 `data-tour` 로 서 있다 — 여기서는 그 손잡이만 세워 두고
 * 지휘부(TourController)와 층(TourOverlay)의 계약을 본다.
 */

function fakeStorage(seed: Record<string, string> = {}): TourStorage & {
  data: Map<string, string>
} {
  const data = new Map(Object.entries(seed))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

/** 대시보드 투어의 대상들 — 실제 화면의 data-tour 손잡이를 흉내 낸다.
 *  글자는 말풍선 제목과 겹치지 않는 표식으로 둔다(중복 매칭 방지) */
function Targets() {
  return (
    <div>
      <div data-tour="dashboard-map">[map]</div>
      <div data-tour="block-search">[block-search]</div>
      <button type="button" data-tour="global-search">
        [global-search]
      </button>
      <div data-tour="alarms">[alarms]</div>
      <a href="/indoorshop/performance" data-tour="nav-performance">
        [performance]
      </a>
    </div>
  )
}

function renderTour(storage: TourStorage, route = '/') {
  const result = renderWithProviders(
    <div>
      <Targets />
      <TourController storage={storage} />
    </div>,
    { route },
  )
  /* jsdom 에는 레이아웃이 없다(전부 0×0) — 대상들이 화면 어딘가에 서 있다고 말해 준다.
     첫 측정은 스텁 전에 지나갔으므로 resize 로 재측정을 부른다 */
  for (const el of document.querySelectorAll<HTMLElement>('[data-tour]')) {
    stubRect(el, { left: 40, top: 40, width: 200, height: 32 })
  }
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
  return result
}

const dialog = () => screen.getByRole('dialog', { name: '화면 안내 투어' })

describe('첫 방문 자동 1회', () => {
  it('본 적 없으면 시작 화면(/)에서 저절로 뜬다 — 첫 스텝은 지도', () => {
    renderTour(fakeStorage())
    expect(dialog()).toBeInTheDocument()
    expect(screen.getByText('야드 지도에서 파고들기')).toBeInTheDocument()
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
  })

  it('이미 봤으면 뜨지 않는다 — 영구 기억', () => {
    const storage = fakeStorage({ [tourStorageKey(DASHBOARD_TOUR.id)]: 'done' })
    renderTour(storage)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('다른 화면에서는 저절로 뜨지 않는다', () => {
    renderTour(fakeStorage(), '/indoorshop/performance')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('스텝 진행', () => {
  it('[다음] 이 스텝을 순서대로 밟고, 마지막 [완료] 가 닫으며 봤음을 기억한다', async () => {
    const storage = fakeStorage()
    renderTour(storage)
    const user = userEvent.setup()

    const titles = [
      '야드 지도에서 파고들기',
      '블록 검색',
      '통합 검색 (Cmd+K)',
      '알람',
      '통합실적으로 가는 길',
    ]
    for (let i = 0; i < titles.length; i += 1) {
      expect(screen.getByText(titles[i])).toBeInTheDocument()
      expect(screen.getByText(`${i + 1} / 5`)).toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: i === titles.length - 1 ? '완료' : '다음' }),
      )
    }
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(isTourSeen(storage, DASHBOARD_TOUR.id)).toBe(true)
  })

  it('[이전] 으로 되돌아간다 — 첫 스텝에는 이전이 없다', async () => {
    renderTour(fakeStorage())
    const user = userEvent.setup()
    expect(screen.queryByRole('button', { name: '이전' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '이전' }))
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
  })

  it('스포트라이트가 그 스텝의 대상을 비춘다', async () => {
    const { container } = renderTour(fakeStorage())
    expect(container.ownerDocument.querySelector('[data-tour-spot="map"]')).not.toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: '다음' }))
    expect(
      container.ownerDocument.querySelector('[data-tour-spot="block-search"]'),
    ).not.toBeNull()
  })
})

describe('건너뛰기 · ESC', () => {
  it('[건너뛰기] 는 닫고 영구 기억한다 — 다음 방문에 다시 뜨지 않는다', async () => {
    const storage = fakeStorage()
    const first = renderTour(storage)
    await userEvent.setup().click(screen.getByRole('button', { name: '건너뛰기' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(isTourSeen(storage, DASHBOARD_TOUR.id)).toBe(true)

    first.unmount()
    renderTour(storage)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ESC = 투어 종료 — 우선권을 쥐고 있어 드릴다운 ESC 는 움직이지 않는다', () => {
    const storage = fakeStorage()
    renderTour(storage)
    /* 떠 있는 동안 escapeClaims 장부에 우선권이 서 있다 (W7-6C 규칙) */
    expect(hasEscapeClaims()).toBe(true)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(isTourSeen(storage, DASHBOARD_TOUR.id)).toBe(true)
    /* 닫히면 우선권도 놓인다 — 안 놓이면 앱의 ESC 가 영영 죽는다 */
    expect(hasEscapeClaims()).toBe(false)
  })
})

describe('재실행 (헤더 도움말)', () => {
  it('봤어도 startTour 신호로 다시 뜬다', () => {
    const storage = fakeStorage()
    markTourSeen(storage, DASHBOARD_TOUR.id)
    renderTour(storage)
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => startTour(DASHBOARD_TOUR.id))
    expect(dialog()).toBeInTheDocument()
  })
})
