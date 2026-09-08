import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../testing/renderWithProviders'
import { setNowSource } from '../now'
import { useAxisNow, useBaseDate } from '../useBaseDate'

/*
 * 화면이 축을 읽는 법 — **주소가 정본**이다.
 *
 * 링크를 복사하면 날짜까지 함께 가야 하고(그래야 "그때 그 화면"을 남에게 보낼 수 있다),
 * 아무것도 안 붙은 주소는 오늘이어야 한다(기존 링크가 내일 거짓이 되지 않게).
 */

const TODAY = '2026-09-03'

function AxisProbe() {
  const axis = useBaseDate()
  const now = useAxisNow(60_000)
  return (
    <dl>
      <dd data-testid="base">{axis.baseDate}</dd>
      <dd data-testid="span">{axis.selection.spanDays}</dd>
      <dd data-testid="window">{`${axis.window.from}~${axis.window.to}`}</dd>
      <dd data-testid="rewind">{axis.rewindDays}</dd>
      <dd data-testid="now">{now.toISOString()}</dd>
    </dl>
  )
}

beforeEach(() => {
  setNowSource(new Date(`${TODAY}T10:00:00`).getTime())
})

afterEach(() => {
  setNowSource(null)
})

describe('useBaseDate', () => {
  it('주소에 아무것도 없으면 오늘 하루다', () => {
    renderWithProviders(<AxisProbe />)
    expect(screen.getByTestId('base')).toHaveTextContent(TODAY)
    expect(screen.getByTestId('span')).toHaveTextContent('1')
    expect(screen.getByTestId('rewind')).toHaveTextContent('0')
  })

  it('`?date=` 를 따라간다 — 통합실적에서 되감고 넘어온 링크', () => {
    renderWithProviders(<AxisProbe />, { route: '/?date=2026-08-31' })
    expect(screen.getByTestId('base')).toHaveTextContent('2026-08-31')
    expect(screen.getByTestId('rewind')).toHaveTextContent('3')
  })

  it('`?span=` 은 조회 창을 연다', () => {
    renderWithProviders(<AxisProbe />, { route: '/?date=2026-09-02&span=7' })
    expect(screen.getByTestId('window')).toHaveTextContent('2026-08-27~2026-09-02')
  })

  it('미래 날짜는 오늘로 접는다 — 아직 일어나지 않은 일을 실적으로 내지 않는다', () => {
    renderWithProviders(<AxisProbe />, { route: '/?date=2026-12-31' })
    expect(screen.getByTestId('base')).toHaveTextContent(TODAY)
  })

  it('망가진 날짜는 조용히 오늘로 — 남이 보낸 링크의 오타로 화면이 서지 않는 편보다 낫다', () => {
    renderWithProviders(<AxisProbe />, { route: '/?date=어제' })
    expect(screen.getByTestId('base')).toHaveTextContent(TODAY)
  })
})

describe('useAxisNow — 경과 시간을 재는 시계', () => {
  it('오늘이면 지금이 흐른다', () => {
    renderWithProviders(<AxisProbe />)
    expect(screen.getByTestId('now')).toHaveTextContent(
      new Date(`${TODAY}T10:00:00`).toISOString()
    )
  })

  it('되감으면 그날의 끝에서 멈춘다 — 사흘 전 화면의 "하트비트 방금"을 막는다', () => {
    renderWithProviders(<AxisProbe />, { route: '/?date=2026-08-31' })
    expect(screen.getByTestId('now')).toHaveTextContent(
      new Date('2026-08-31T23:59:59.999').toISOString()
    )
  })
})
