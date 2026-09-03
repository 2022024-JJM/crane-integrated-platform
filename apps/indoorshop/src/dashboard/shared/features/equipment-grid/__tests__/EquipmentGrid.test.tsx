import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import type { StatusMeaning } from '../../../ui/statusPalette'
import { EquipmentGrid } from '../ui/EquipmentGrid'
import type { EquipmentCell } from '../model/cell'

/**
 * 그리드가 **함께 가야 하는 넷**을 실제로 하는가 (설비관제 레퍼런스 §3.6).
 * 이 중 상태순 정렬과 정상/이상의 톤 차이가 빠지면 그리드 전환은 이득보다 손해다.
 * (정상 램프의 색은 R18 로 초록으로 되돌렸다 — 무채는 "꺼졌다"로 읽혔다.)
 */
const cell = (
  id: string,
  severity: StatusMeaning,
  extra: Partial<EquipmentCell> = {}
): EquipmentCell => ({
  id,
  typeId: 'LIDAR',
  label: id,
  lamps: [
    { label: '링크', meaning: severity },
    { label: '틸팅', meaning: 'done' },
    { label: '이상', meaning: severity },
  ],
  metric: { text: severity === 'done' ? '4분 전' : '오프라인 19분', meaning: severity },
  severity,
  ...extra,
})

const CELLS = [
  cell('LD-P01', 'done'),
  cell('LD-P02', 'error'),
  cell('LD-P03', 'done'),
  cell('LD-P04', 'warning'),
]

function cellButtons() {
  return within(screen.getByRole('list')).getAllByRole('button')
}

describe('설비 그리드 — 상태순 정렬', () => {
  it('이상 셀이 위로 온다 (정상 사이에 묻히지 않는다)', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    expect(cellButtons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'LD-P02',
      'LD-P04',
      'LD-P01',
      'LD-P03',
    ])
  })
})

describe('설비 그리드 — 정상은 조용한 초록 (R18)', () => {
  it('정상 램프는 초록이다 — 돌고 있는 설비가 꺼진 것처럼 보이면 안 된다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done')]} />)
    const lamp = screen.getByLabelText('링크')
    expect(lamp.className).toContain('status-healthy')
    /* 다만 글로우·맥동은 없다 — 색은 있고 강조는 없다 */
    expect(lamp.className).not.toMatch(/animate-|shadow-/)
  })

  it('이상 램프는 낮추지 않는다 — 정상이 색을 되찾아도 먼저 눈에 드는 쪽은 이상이다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P02', 'error')]} />)
    expect(screen.getByLabelText('링크').className).toContain('status-unhealthy')
  })

  it('정상 셀에만 물러남 표시가 붙는다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    const attenuated = cellButtons().filter((b) => b.dataset.attenuated === 'true')
    expect(attenuated.map((b) => b.getAttribute('aria-label'))).toEqual(['LD-P01', 'LD-P03'])
  })

  it('이상 셀은 물러나지 않는다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    const issues = cellButtons().filter((b) => b.dataset.issue === 'true')
    expect(issues.map((b) => b.getAttribute('aria-label'))).toEqual(['LD-P02', 'LD-P04'])
    for (const button of issues) expect(button.dataset.attenuated).toBe('false')
  })
})

describe("설비 그리드 — '이상만 보기'", () => {
  it('누르면 이상 셀만 남는다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    await user.click(screen.getByRole('button', { name: /이상만/ }))
    expect(cellButtons().map((b) => b.getAttribute('aria-label'))).toEqual(['LD-P02', 'LD-P04'])
  })

  it('이상이 없으면 그 사실을 말한다 — 빈 격자를 두지 않는다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done')]} />)
    await user.click(screen.getByRole('button', { name: /이상만/ }))
    expect(screen.getByText('이상 없는 설비뿐입니다.')).toBeInTheDocument()
  })
})

describe('설비 그리드 — 밀도 2단·선택 상세', () => {
  it('밀도 토글이 있다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    expect(screen.getByRole('button', { name: '넓게' })).toBeInTheDocument()
  })

  it('셀을 고르면 상세가 펴지고, 다시 누르면 접힌다', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EquipmentGrid cells={[cell('LD-P01', 'done', { detail: <span>pan 12°</span> })]} />
    )
    expect(screen.queryByText('pan 12°')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'LD-P01' }))
    expect(screen.getByText('pan 12°')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'LD-P01' }))
    expect(screen.queryByText('pan 12°')).not.toBeInTheDocument()
  })
})

describe('설비 그리드 — 클릭 없이 보이는 것 (R13 완료 기준)', () => {
  it('셀에 신선도와 램프 셋이 늘 서 있다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done')]} />)
    expect(screen.getByText('4분 전')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'LD-P01' })
    expect(within(button).getByLabelText('링크')).toBeInTheDocument()
    expect(within(button).getByLabelText('틸팅')).toBeInTheDocument()
    expect(within(button).getByLabelText('이상')).toBeInTheDocument()
  })

  it('이상이면 수치 자리가 사유를 말한다 — 툴팁을 열지 않아도 된다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P02', 'error')]} />)
    expect(screen.getByText('오프라인 19분')).toBeInTheDocument()
  })

  it('부기(note)는 클릭 없이 셀 안에 선다 — 틸팅 모드·각도가 그 자리다', () => {
    renderWithProviders(
      <EquipmentGrid cells={[cell('LD-P01', 'done', { note: '틸팅중 102°/-5°' })]} />
    )
    expect(screen.getByText('틸팅중 102°/-5°')).toBeInTheDocument()
  })
})

describe('설비 그리드 — 미니 트렌드는 이상·선택에만', () => {
  const trend = [
    { label: '1', value: 10 },
    { label: '2', value: 20 },
  ]

  it('정상 셀에는 그리지 않는다 (337칸 × 스파크라인을 만들지 않는다)', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done', { trend })]} />)
    expect(screen.queryByRole('img', { name: 'LD-P01' })).not.toBeInTheDocument()
  })

  it('이상 셀에는 그린다', () => {
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P02', 'error', { trend })]} />)
    expect(screen.getByRole('img', { name: 'LD-P02' })).toBeInTheDocument()
  })

  it('정상이라도 고르면 그린다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EquipmentGrid cells={[cell('LD-P01', 'done', { trend })]} />)
    await user.click(screen.getByRole('button', { name: 'LD-P01' }))
    expect(screen.getByRole('img', { name: 'LD-P01' })).toBeInTheDocument()
  })
})

describe('설비 그리드 — 접근성', () => {
  it('시각은 격자지만 의미는 목록이다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} />)
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(CELLS.length)
  })
})

/*
 * 실시간감 (R19) — 값이 흐르고, 바뀌면 깜빡이고, 안 오면 그렇다고 말한다.
 *
 * 이 셋이 없으면 화면은 마지막으로 받은 값을 영원히 적어 두고, 조작자는 "지금 것인가"를
 * 먼저 의심하게 된다. 그 의심이 한 번 들면 화면이 말하는 나머지도 못 믿게 된다.
 */
describe('설비 그리드 — 실시간감', () => {
  const NOW = 1_756_000_000_000

  afterEach(() => {
    vi.useRealTimers()
  })

  function live(at: number | undefined, text = '방금') {
    return [cell('LD-L01', 'done', { metric: { text, meaning: 'done', at } })]
  }

  it('수신 시각이 오래되면 그 자리가 침묵을 말한다 (마지막 값을 그대로 적지 않는다)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const { rerender } = renderWithProviders(
      <EquipmentGrid cells={live(NOW)} showControls={false} />
    )
    expect(document.querySelector('[data-silent="true"]')).toBeNull()

    /* 2분 침묵 — 임계(90초)를 넘는다 */
    act(() => {
      vi.setSystemTime(NOW + 120_000)
      vi.advanceTimersByTime(1000)
    })
    rerender(<EquipmentGrid cells={live(NOW)} showControls={false} />)

    const metric = document.querySelector('[data-silent="true"]')
    expect(metric).not.toBeNull()
    expect(metric?.textContent).toContain('침묵')
  })

  it('수신 시각이 없는 셀은 시계를 켜지 않는다 (설정값·대수까지 흐르게 하지 않는다)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    renderWithProviders(<EquipmentGrid cells={live(undefined, '3/3')} showControls={false} />)
    act(() => {
      vi.setSystemTime(NOW + 600_000)
      vi.advanceTimersByTime(5000)
    })
    expect(document.querySelector('[data-silent="true"]')).toBeNull()
    expect(screen.getByText('3/3')).toBeInTheDocument()
  })

  it('값이 바뀐 순간 짧게 밝아진다 — 수백 칸 중 무엇이 움직였는지는 변화로만 안다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const { rerender } = renderWithProviders(
      <EquipmentGrid cells={live(NOW, '방금')} showControls={false} />
    )
    expect(document.querySelector('[data-flash="true"]')).toBeNull()

    rerender(<EquipmentGrid cells={live(NOW, '1분 전')} showControls={false} />)
    expect(document.querySelector('[data-flash="true"]')).not.toBeNull()

    /* 깜빡임은 곧 가라앉는다 — 계속 밝으면 그건 강조가 아니라 배경이다 */
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(document.querySelector('[data-flash="true"]')).toBeNull()
  })
})

/*
 * 밖에서 들어온 선택은 **시야로 데려온다** (R29 링킹).
 *
 * 버드뷰에서 심볼을 눌렀는데 그 칸이 스크롤 밖에 있으면, 화면은 아무 일도 안 한 것처럼
 * 보인다. 붙어 있는 머리 밑으로 숨지 않도록 비켜설 자리(`--board-head`)도 함께 둔다.
 */
describe('설비 그리드 — 밖에서 온 선택을 시야로', () => {
  const CALLS: { el: Element; opts: unknown }[] = []
  const original = Element.prototype.scrollIntoView

  beforeEach(() => {
    CALLS.length = 0
    Element.prototype.scrollIntoView = function (this: Element, opts?: unknown) {
      CALLS.push({ el: this, opts })
    } as typeof Element.prototype.scrollIntoView
  })
  afterEach(() => {
    Element.prototype.scrollIntoView = original
  })

  it('제어된 선택이 바뀌면 그 칸을 데려온다', () => {
    const { rerender } = renderWithProviders(
      <EquipmentGrid cells={CELLS} showControls={false} selectedId={null} onSelect={() => {}} />
    )
    expect(CALLS).toHaveLength(0)

    rerender(
      <EquipmentGrid cells={CELLS} showControls={false} selectedId="LD-P03" onSelect={() => {}} />
    )
    expect(CALLS).toHaveLength(1)
    expect(CALLS[0].el.textContent).toContain('LD-P03')
  })

  it('안에서 고른 것은 데려오지 않는다 — 이미 보고 있는 칸이다', async () => {
    const user = userEvent.setup()
    renderWithProviders(<EquipmentGrid cells={CELLS} showControls={false} />)
    await user.click(screen.getByRole('button', { name: 'LD-P01' }))
    expect(CALLS).toHaveLength(0)
  })

  it('칸마다 붙어 있는 머리만큼의 여백을 둔다', () => {
    renderWithProviders(<EquipmentGrid cells={CELLS} showControls={false} />)
    const item = screen.getByRole('list').querySelector('li')!
    expect(item.getAttribute('style')).toContain('--board-head')
  })
})
