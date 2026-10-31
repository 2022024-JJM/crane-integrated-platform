import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'

/*
 * 가동 뷰의 3D 는 WebGL 이 필요하다 — jsdom 에서는 골격만 세운다. 여기서 보는 것은 그림이
 * 아니라 **배선**이다: 탭이 뷰어를 세우는가, 그리고 **이 공장의** 대기를 넘기는가.
 * (뷰어 자신의 껍데기 계약은 `PaintingAirViewer.test.tsx` 가 본다.)
 */
/*
 * 3D 는 **실물 그대로** 세운다 — jsdom 에는 WebGL 이 없으므로 뷰어는 "왜 못 그리는지"를
 * 말하고 껍데기(요약 계기·범례)만 남긴다. 여기서 보는 것은 그림이 아니라 **배선**이다:
 * 배치 옆 손잡이가 뷰어를 그 자리에 세우는가, 그리고 그 뷰어가 **이 공장의** 장면을
 * 받았는가(계기가 적는 베이 수가 공장마다 다르다).
 *
 * 뷰어를 mock 으로 갈아 끼우지 않는 이유: 이 화면은 뷰어를 `lazy()` 안의 동적 import 로
 * 받는데 그 경로는 모듈 mock 이 잡지 못한다. 붙잡히지도 않는 mock 을 두면 테스트가
 * 조용히 실물을 세우면서 mock 을 세운 척한다 — 그럴 바에는 실물을 보는 편이 정직하다.
 */
const i18n = (await import('../../../../shared/lib/i18n/config')).default
const { paintingKo } = await import('../../i18n/ko')
const { paintingEn } = await import('../../i18n/en')
i18n.addResourceBundle('ko', 'inshop', paintingKo, true, true)
i18n.addResourceBundle('en', 'inshop', paintingEn, true, true)

const { PaintingFactoryStatusPage } = await import('../pages/PaintingFactoryStatusPage')

/*
 * 기본 갈래는 실적이다 — 축 탭을 보는 검사들은 현황 갈래(`?view=status`)에서 출발한다.
 * 기본 갈래 자체를 보는 검사만 `asIs` 로 주소를 그대로 둔다.
 */
function renderPage(path = '/indoorshop/zones/painting/pnt-1dock', { asIs = false }: { asIs?: boolean } = {}) {
  const route = asIs || path.includes('view=') ? path : `${path}${path.includes('?') ? '&' : '?'}view=status`
  return renderWithProviders(
    <Routes>
      <Route path="/indoorshop/zones/painting/:factoryId" element={<PaintingFactoryStatusPage />} />
    </Routes>,
    { route }
  )
}

/**
 * 도장 공장 화면의 축 탭 (P4·R24·R45).
 *
 * 한때 가운데에 '가동 뷰' 탭이 따로 있었다. 지금 3D 는 ①현황의 **설비 배치 그 자리에서**
 * 뒤집혀 선다 — 문이 하나가 되면서 탭도 둘로 줄었다(R45). 여기서 보는 것은 그 배선이다:
 * 배치 옆 손잡이가 뷰어를 세우는가, 그리고 **이 공장의** 대기를 넘기는가.
 */
describe('PaintingFactoryStatusPage — 축 탭', () => {
  it('[현황 | 블록·실적] 이 서고 기본은 현황이다 — 3D 는 탭이 아니라 배치 안의 손잡이다', async () => {
    renderPage()
    const tablist = await screen.findByRole('tablist', { name: '화면 축 선택' })
    const tabs = [...tablist.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)
    expect(tabs).toEqual(['현황', '블록·실적'])
    expect(within(screen.getByRole('tablist', { name: '화면 축 선택' })).getByRole('tab', { name: '현황' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: '가동 뷰' })).toBeNull()
  })

  it('현황 탭 — 공장 목록과 설비 그리드가 선다 (세 공정 공용 보드)', async () => {
    renderPage()
    const list = await screen.findByRole('list', { name: '공장 목록' })
    expect(list.textContent).toContain('1DOCK 도장공장')
    expect(list.textContent).toContain('느태 도장공장')
    /* 이관 설비 fixture 의 실 ID(EQ###)가 셀로 선다 */
    expect((await screen.findAllByRole('button', { name: /^EQ\d+$/ })).length).toBeGreaterThan(0)
  })

  it('배치 옆 손잡이를 누르면 **도면 자리에** 뷰어 실체가 선다 (R45)', async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    await screen.findByRole('tablist', { name: '화면 축 선택' })
    /* 처음에는 도면(SVG)이 서 있다 */
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()

    await user.click(await screen.findByRole('button', { name: /3D 가동 뷰/ }))

    /*
     * 같은 자리를 쓴다 — 도면(SVG)은 물러나고 손잡이는 돌아가는 문이 된다.
     * 탭은 그대로 '현황'이다(3D 로 가려고 화면을 옮기지 않는다).
     */
    expect(await screen.findByRole('button', { name: /2D 도면/ })).toBeInTheDocument()
    expect(container.querySelector('svg[role="img"]')).toBeNull()
    expect(within(screen.getByRole('tablist', { name: '화면 축 선택' })).getByRole('tab', { name: '현황' })).toHaveAttribute('aria-selected', 'true')
    /* 받아 오는 동안에도 빈 화면으로 두지 않는다 — 무엇을 하는 중인지 말한다 */
    expect(screen.getAllByText(/3D 화 진행 중/).length).toBeGreaterThan(0)

    /* 다시 누르면 도면으로 돌아온다 */
    await user.click(screen.getByRole('button', { name: /2D 도면/ }))
    expect(container.querySelector('svg[role="img"]')).not.toBeNull()
  })

  it('3D 가 받는 것은 **이 공장의** 대기다 — 공장이 바뀌면 베이도 바뀐다 (R24)', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage('/indoorshop/zones/painting/pnt-1dock')
    await screen.findByRole('tablist', { name: '화면 축 선택' })
    await user.click(await screen.findByRole('button', { name: /3D 가동 뷰/ }))

    /* 1DOCK 도장공장 — 설비 30대가 15개 베이에 서고, 바닥은 그보다 넓다 (R38) */
    expect(await screen.findByText('설비 30대', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByText('26개 베이')).toBeInTheDocument()
    unmount()

    renderPage('/indoorshop/zones/painting/pnt-neutae')
    await screen.findByRole('tablist', { name: '화면 축 선택' })
    await user.click(await screen.findByRole('button', { name: /3D 가동 뷰/ }))

    expect(await screen.findByText('설비 20대', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await screen.findByText('9개 베이')).toBeInTheDocument()
  })

  it('블록·실적 탭(옛 공장 현황) — 스텝 진행·블록 목록이 오른쪽 칸에 서고 공장 목록은 남는다', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('tablist', { name: '화면 축 선택' })

    await user.click(screen.getByRole('tab', { name: '블록·실적' }))
    expect(screen.getByRole('heading', { name: /스텝 진행/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /블록 목록|재공 블록/ })).toBeInTheDocument()
    /* 조립·의장과 같은 배치 — 왼쪽 공장 목록은 탭을 옮겨도 그대로다 */
    expect(screen.getByRole('list', { name: '공장 목록' })).toBeInTheDocument()
  })

  /* 화면 안의 [현황 | 실적] 탭은 걷었다(사용자 확정) — 갈래는 헤더 메뉴 드롭다운이 `?view=` 로 고른다 */
  it('화면 안에 갈래 탭은 없고, 기본은 현황(축 탭 화면), ?view=performance 는 도장 공정만', async () => {
    const { unmount } = renderPage('/indoorshop/zones/painting/pnt-1dock', { asIs: true })
    expect(await screen.findByRole('tablist', { name: '화면 축 선택' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: '화면 갈래 선택' })).not.toBeInTheDocument()
    unmount()

    renderPage('/indoorshop/zones/painting/pnt-1dock?view=performance', { asIs: true })
    expect(await screen.findByText('호선 번호를 선택하세요')).toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: '화면 축 선택' })).not.toBeInTheDocument()
  })

  it('실적 갈래 — 주소에 실린 호선·블록으로 곧바로 도장 스텝 절점을 낸다', async () => {
    renderPage('/indoorshop/zones/painting/pnt-1dock?view=performance&vessel=7004&block=530')
    expect(await screen.findByRole('heading', { name: /도장 — 스텝 절점/ })).toBeInTheDocument()
  })
})
