import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { GlobalSearch } from '../ui/GlobalSearch'
import { SearchField } from '../ui/SearchField'

/*
 * **검색은 하나다** — 진입점이 둘일 뿐. 이 파일이 그 사실을 잠근다.
 *
 * 예전에는 대시보드 지도 위 검색창과 Cmd+K 팔레트가 서로 다른 구현이었다: 색인도
 * (지도 검색만 야드 BTS 를 알았다), 행선지도(지도 검색은 지도에 표시, 팔레트는 통합실적
 * 으로 이탈) 갈렸다. 사용자에게는 같은 이름의 기능이 어디서 여느냐에 따라 다르게
 * 동작하는 상태였고, 그건 기능이 둘이라는 뜻이다.
 *
 * 그래서 여기서 검증하는 것은 화면 두 개가 아니라 **한 기능의 두 입구**다:
 *   ① 같은 질의에 같은 결과(줄 제목이 같은 순서로)
 *   ② 같은 결과는 같은 곳으로 (행선지는 결과 타입이 정한다)
 */

/** 지금 주소를 라우터에게 직접 묻는 창 */
function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

const QUERY = '7004'

beforeEach(() => {
  sessionStorage.clear()
})

/* 두 진입점을 한 테스트 안에서 차례로 세운다 — 앞의 것을 반드시 걷고(unmount) 다음을
   세워야 한다. 둘이 함께 떠 있으면 같은 role 을 두 벌 읽어 비교가 무의미해진다. */

/** 팔레트를 열고 질의를 친 뒤, 결과 줄들을 순서대로 읽는다 */
async function rowsFromPalette(): Promise<{ rows: string[]; unmount: () => void }> {
  const { unmount } = renderWithProviders(<GlobalSearch />)
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
  const dialog = await screen.findByRole('dialog')
  await userEvent.type(within(dialog).getByRole('combobox'), QUERY)
  await within(dialog).findAllByRole('option')
  const rows = within(dialog)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '')
  return { rows, unmount }
}

/** 지도 위 검색창에 같은 질의를 친 뒤, 결과 줄들을 순서대로 읽는다 */
async function rowsFromField(): Promise<{ rows: string[]; unmount: () => void }> {
  const { unmount } = renderWithProviders(<SearchField />)
  await userEvent.type(screen.getByLabelText('블록 검색'), QUERY)
  await screen.findAllByRole('option')
  const rows = screen.getAllByRole('option').map((option) => option.textContent ?? '')
  return { rows, unmount }
}

describe('두 진입점은 한 기능이다', () => {
  it('같은 질의에 같은 결과가 같은 순서로 선다', async () => {
    const palette = await rowsFromPalette()
    palette.unmount()
    const field = await rowsFromField()
    field.unmount()

    expect(palette.rows.length).toBeGreaterThan(0)
    expect(field.rows).toEqual(palette.rows)
  })

  it('같은 결과는 같은 곳으로 간다 — 행선지는 진입점이 아니라 결과 타입이 정한다', async () => {
    /* 팔레트에서 블록을 고른다 */
    const palette = renderWithProviders(
      <>
        <GlobalSearch />
        <LocationProbe />
      </>
    )
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('combobox'), '7004-222')
    await userEvent.click(await within(dialog).findByText('7004-222'))
    const fromPalette = screen.getByTestId('location').textContent
    palette.unmount()

    /* 지도 위 검색창에서 같은 블록을 고른다 */
    renderWithProviders(
      <>
        <SearchField />
        <LocationProbe />
      </>
    )
    await userEvent.type(screen.getByLabelText('블록 검색'), '7004-222')
    await userEvent.click(await screen.findByText('7004-222'))
    const fromField = screen.getByTestId('location').textContent

    expect(fromPalette).toBe('/?vessel=7004&block=222')
    expect(fromField).toBe(fromPalette)
  })

  it('팔레트에서 고른 블록도 총괄로 이동한다 — 어느 화면에서 찾았든 자리는 지도가 보여 준다', async () => {
    renderWithProviders(
      <>
        <GlobalSearch />
        <LocationProbe />
      </>,
      { route: '/indoorshop/performance?vessel=8103' }
    )
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('combobox'), '7004-222')
    await userEvent.click(await within(dialog).findByText('7004-222'))

    /* 통합실적에 서 있다가 블록을 골라도 지도로 나간다(경로가 바뀐다) */
    expect(screen.getByTestId('location').textContent).toBe('/?vessel=7004&block=222')
  })
})
