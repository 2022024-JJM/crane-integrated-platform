import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { Button } from '../../atoms/Button'
import {
  BatchPendingState,
  CardSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  MapPanelSkeleton,
} from '..'

/*
 * 상태 UX 3종을 **브라우저 없이** 확인한다.
 *
 * 여기서 보는 것은 생김새가 아니라 계약이다 — 뼈대가 "기다리는 중"임을 스크린리더에
 * 알리는가, 빈 상태가 원인별로 다른 말을 하는가, 실패가 재시도를 실제로 호출하고
 * 마지막 성공 시각을 내는가. 색·여백은 토큰이 지키므로 테스트가 세지 않는다.
 */

describe('로딩 뼈대', () => {
  it('세 변형 모두 기다리는 중임을 한 번만 알린다', () => {
    const { unmount } = renderWithProviders(<CardSkeleton label="도장 실적" />)
    const card = screen.getByRole('status')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(within(card).getByText('도장 실적')).toBeInTheDocument()
    unmount()

    renderWithProviders(
      <>
        <ListSkeleton label="설비 목록" rows={3} />
        <MapPanelSkeleton label="공장 요약" sections={2} />
      </>
    )
    const frames = screen.getAllByRole('status')
    expect(frames).toHaveLength(2)
    expect(screen.getByText('설비 목록')).toBeInTheDocument()
    expect(screen.getByText('공장 요약')).toBeInTheDocument()
  })

  it('목록 뼈대는 요청한 줄 수만큼 자리를 잡는다', () => {
    const { container, rerender } = renderWithProviders(<ListSkeleton rows={2} />)
    const rowsOf = () => container.querySelectorAll('[role="status"] > div')
    expect(rowsOf()).toHaveLength(2)
    rerender(<ListSkeleton rows={5} />)
    expect(rowsOf()).toHaveLength(5)
  })

  it('뼈대 조각은 스크린리더가 읽지 않는다 — 껍데기 한 마디로 충분하다', () => {
    const { container } = renderWithProviders(<CardSkeleton rows={3} />)
    const pieces = container.querySelectorAll('span[aria-hidden="true"]')
    expect(pieces.length).toBeGreaterThan(0)
  })
})

describe('빈 상태', () => {
  it('원인마다 다른 말을 한다', () => {
    const { unmount } = renderWithProviders(<EmptyState reason="filtered" />)
    expect(screen.getByText('조건에 맞는 항목이 없습니다')).toBeInTheDocument()
    unmount()

    renderWithProviders(<EmptyState reason="notCollected" />)
    expect(screen.getByText('아직 수집된 값이 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('data-empty-reason', 'notCollected')
  })

  it('행동 유도 슬롯을 그대로 세운다', async () => {
    const onReset = vi.fn()
    renderWithProviders(
      <EmptyState reason="filtered" action={<Button onClick={onReset}>초기화</Button>} />
    )
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('문구를 덮어써도 원인은 남는다', () => {
    renderWithProviders(
      <EmptyState reason="none" title="이 공장에는 설비가 없습니다" description={null} />
    )
    expect(screen.getByText('이 공장에는 설비가 없습니다')).toBeInTheDocument()
    expect(screen.queryByText('이 자리에 해당하는 항목이 아직 없습니다.')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('data-empty-reason', 'none')
  })

  it('오늘 배치 미도착 — 마지막 반영 날짜를 함께 낸다', () => {
    const { unmount } = renderWithProviders(<BatchPendingState asOf="2026-09-02" />)
    expect(screen.getByText('오늘 배치가 아직 도착하지 않았습니다')).toBeInTheDocument()
    expect(screen.getByText(/2026-09-02/)).toBeInTheDocument()
    unmount()

    /* 한 번도 안 온 경우 — 날짜 대신 일괄 등록을 기다린다는 사실만 */
    renderWithProviders(<BatchPendingState asOf={null} />)
    expect(screen.getByText(/일괄 등록/)).toBeInTheDocument()
    expect(screen.queryByText(/마지막 반영/)).not.toBeInTheDocument()
  })
})

describe('실패 상태', () => {
  it('재시도를 누르면 같은 요청을 다시 걸도록 호출한다', async () => {
    const onRetry = vi.fn()
    renderWithProviders(<ErrorState error={new Error('boom')} onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('데이터를 불러오지 못했습니다')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('재시도가 도는 동안에는 버튼을 잠근다', async () => {
    const onRetry = vi.fn()
    renderWithProviders(<ErrorState onRetry={onRetry} retrying />)
    const button = screen.getByRole('button', { name: '다시 시도' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('마지막 성공 시각을 상대 표기로 낸다', () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60_000).toISOString()
    renderWithProviders(<ErrorState lastSuccessAt={threeMinutesAgo} />)
    expect(screen.getByText(/마지막 성공/)).toBeInTheDocument()
    expect(screen.getByText(/3분 전/)).toBeInTheDocument()
  })

  it('한 번도 성공하지 못했으면 그렇다고 말한다', () => {
    renderWithProviders(<ErrorState lastSuccessAt={null} />)
    expect(screen.getByText('아직 한 번도 불러오지 못했습니다')).toBeInTheDocument()
  })

  it('되돌릴 방법이 없는 자리에는 재시도 버튼을 세우지 않는다', () => {
    renderWithProviders(<ErrorState />)
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('오류 원문은 화면에 내지 않고 툴팁으로만 남긴다', () => {
    renderWithProviders(<ErrorState error={new Error('HTTP 503 upstream timeout')} />)
    expect(screen.queryByText(/503/)).not.toBeInTheDocument()
    expect(screen.getByText('데이터를 불러오지 못했습니다')).toHaveAttribute(
      'title',
      'HTTP 503 upstream timeout'
    )
  })
})
