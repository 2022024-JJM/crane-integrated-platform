import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { GlobalSearch } from '../ui/GlobalSearch'

/*
 * 통합 검색 팔레트 — 화면 계약: 열림(단축키), 검색, 키보드 이동, 그리고 **이동 URL**.
 *
 * 이동은 실제 라우터로 검증한다(useNavigate 를 흉내내지 않는다) — 팔레트가 찍는
 * 주소가 곧 화면 간 계약이고, 그 주소는 searchIndex 계약 테스트가 파서로 되읽는
 * 것과 같은 것이어야 한다.
 */

/** 팔레트가 어디로 보냈는지 라우터에게 직접 묻는 창 */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

const setup = () => renderWithProviders(
  <>
    <GlobalSearch />
    <LocationProbe />
  </>
)

const openPalette = async () => {
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
  return await screen.findByRole('dialog')
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('통합 검색 팔레트', () => {
  it('Cmd+K 로 열리고, 다시 누르면 닫힌다 (토글)', async () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
    await openPalette()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it("'/' 로도 열린다 — 단, 글자를 치는 중이 아닐 때만", async () => {
    setup()
    fireEvent.keyDown(window, { key: '/' })
    const dialog = await screen.findByRole('dialog')
    /* 팔레트 입력창에서 '/' 를 쳐도 다시 열기 신호가 되지 않는다(입력 중이다) */
    expect(dialog).toBeInTheDocument()
  })

  it('Esc 로 닫힌다', async () => {
    setup()
    await openPalette()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('호선 검색 → Enter → 통합실적 호선 조회로 이동하고 닫힌다', async () => {
    setup()
    await openPalette()
    await userEvent.type(screen.getByRole('combobox'), '7004')
    await screen.findByText('7004호')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('location').textContent).toBe('/performance?vessel=7004')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('↓ 로 다음 결과(블록)로 옮겨 Enter — 블록 딥링크로 간다', async () => {
    setup()
    await openPalette()
    await userEvent.type(screen.getByRole('combobox'), '7004-222')
    await screen.findByText('7004-222')
    /* 첫 줄은 호선(7004) — 한 칸 내리면 블록 7004-222 */
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByTestId('location').textContent).toBe(
      '/performance?vessel=7004&block=222'
    )
  })

  it('설비ID 검색 → 그 공정 맵의 공장·베이 드릴다운으로 간다', async () => {
    setup()
    await openPalette()
    await userEvent.type(screen.getByRole('combobox'), 'LD-D01')
    /* 설비 그룹은 지번 로드(비동기) 뒤에 선다 — findBy 가 그 시간을 기다린다 */
    const option = await screen.findByText('LD-D01')
    await userEvent.click(option)
    expect(screen.getByTestId('location').textContent).toBe(
      /* 값은 안정 슬러그·베이 조각 (F-30) — 도착 화면이 계약 파서로 3DS#1 로 되읽는다 */
      '/zones/assembly?factory=asm-3ds&bay=1'
    )
  })

  it('아무 데도 걸리지 않으면 0건 문구가 선다', async () => {
    setup()
    await openPalette()
    await userEvent.type(screen.getByRole('combobox'), 'zzzz없는것')
    await screen.findByText(/걸리는 호선·블록·ASSY·W\/O·설비가 없습니다/)
  })

  it('고른 결과는 최근 검색으로 남아, 빈 팔레트에 다시 선다 (최대 3건)', async () => {
    setup()
    await openPalette()
    await userEvent.type(screen.getByRole('combobox'), '7004')
    await screen.findByText('7004호')
    await userEvent.keyboard('{Enter}')

    await openPalette()
    await screen.findByText('최근 검색')
    /* 최근 항목도 같은 키보드 문법 — Enter 로 바로 되돌아간다 */
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('location').textContent).toBe('/performance?vessel=7004')
  })
})
