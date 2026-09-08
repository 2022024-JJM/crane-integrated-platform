import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusChip, type ChipTone } from '../StatusChip'
import { StatusDot } from '../StatusDot'
import { STATUS_SHAPE, STATUS_STYLE } from '../../statusPalette'

/*
 * 상태 표시가 **색 단독으로 말하지 않는가**를 본다.
 *
 * 스냅샷은 두지 않는다 — 마크업이 조금만 움직여도 깨지면서 정작 중요한 계약(어떤 색을
 * 쓰는가, 모양·아이콘·이름이 함께 나가는가)은 지키지 못한다. 클래스와 접근성 이름만 본다.
 */

const TONE_CLASS: [ChipTone, string][] = [
  ['good', STATUS_STYLE.done.chip],
  ['progress', STATUS_STYLE.inProgress.chip],
  ['warning', STATUS_STYLE.warning.chip],
  ['critical', STATUS_STYLE.error.chip],
  ['neutral', STATUS_STYLE.idle.chip],
]

describe('상태 칩', () => {
  it.each(TONE_CLASS)('%s 톤은 팔레트가 정한 색을 쓴다', (tone, expected) => {
    const { container } = render(<StatusChip tone={tone} label="상태" />)
    const chip = container.firstElementChild as HTMLElement
    for (const className of expected.split(' ')) {
      expect(chip.className).toContain(className)
    }
  })

  it('강조색을 상태로 재사용하지 않는다', () => {
    for (const [tone] of TONE_CLASS) {
      const { container, unmount } = render(<StatusChip tone={tone} label="상태" />)
      expect((container.firstElementChild as HTMLElement).className).not.toContain('accent')
      unmount()
    }
  })

  it('색 말고 아이콘과 라벨이 함께 나간다 — 중립만 아이콘이 없다', () => {
    const { container, rerender } = render(<StatusChip tone="progress" label="진행중" />)
    expect(container.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('진행중')).toBeInTheDocument()

    rerender(<StatusChip tone="neutral" label="대기" />)
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('상태 점', () => {
  it('의미마다 다른 모양을 그린다 — 색을 못 봐도 갈린다', () => {
    const paths = new Set<string>()
    for (const meaning of ['done', 'inProgress', 'warning', 'error', 'idle'] as const) {
      const { container, unmount } = render(<StatusDot meaning={meaning} label={meaning} />)
      const path = container.querySelector('path')?.getAttribute('d')
      expect(path).toBeTruthy()
      paths.add(path!)
      unmount()
    }
    expect(paths.size).toBe(Object.keys(STATUS_SHAPE).length)
  })

  it('이름을 주면 읽어 주고, 안 주면 장식으로 숨는다', () => {
    const { container, rerender } = render(<StatusDot meaning="error" label="이상" />)
    expect(screen.getByRole('img', { name: '이상' })).toBeInTheDocument()

    rerender(<StatusDot meaning="error" />)
    expect((container.firstElementChild as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })

  it('지도 유리 위에서는 유리 램프를 쓴다 — 라이트 상태색은 어두운 패널에서 묻힌다', () => {
    const { container } = render(<StatusDot meaning="done" label="정상" glass />)
    expect((container.firstElementChild as HTMLElement).className).toContain(
      STATUS_STYLE.done.glassInk
    )
  })
})
