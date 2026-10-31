import { describe, expect, it } from 'vitest'
import { fillHeight } from '../useFillViewport'

/* 요소를 20000px 로 늘린 상태에서 잰 값 — 아래 여백(below)은 scrollHeight - (top + 20000) */
const PROBE = 20000

describe('fillHeight', () => {
  it('보이는 높이에서 위·아래 몫을 빼고 남는 만큼 준다', () => {
    /* 위 200 · 아래 여백 32 · 보이는 높이 844 → 844 - 200 - 32 = 612 */
    expect(fillHeight({ natural: 300, top: 200, scrollHeight: 200 + PROBE + 32, clientHeight: 844 })).toBe(612)
  })

  it('내용이 이미 남는 자리보다 크면 손대지 않는다(null)', () => {
    expect(fillHeight({ natural: 700, top: 200, scrollHeight: 200 + PROBE + 32, clientHeight: 844 })).toBeNull()
  })

  it('경계 — 남는 자리와 내용이 같으면 늘리지 않고, 1px 모자라면 늘린다', () => {
    const base = { top: 200, scrollHeight: 200 + PROBE + 32, clientHeight: 844 }
    expect(fillHeight({ ...base, natural: 612 })).toBeNull()
    expect(fillHeight({ ...base, natural: 611 })).toBe(612)
  })

  it('스크롤된 상태(top 이 내용 기준)여도 같은 값 — 보이는 위치가 아니라 내용 위치로 잰다', () => {
    expect(fillHeight({ natural: 0, top: 200, scrollHeight: 200 + PROBE, clientHeight: 800 })).toBe(600)
  })

  it('소수 픽셀은 내려 스크롤 막대가 서지 않게 한다', () => {
    expect(fillHeight({ natural: 0, top: 200.6, scrollHeight: 200.6 + PROBE, clientHeight: 800 })).toBe(599)
  })

  it('측정값이 깨지면(NaN) 손대지 않는다', () => {
    expect(fillHeight({ natural: 0, top: Number.NaN, scrollHeight: PROBE, clientHeight: 800 })).toBeNull()
  })
})

describe('fillHeight — shrinkTo (안에서 스크롤)', () => {
  /* 남는 자리 612 (위 200 · 아래 32 · 보이는 844) */
  const base = { top: 200, scrollHeight: 200 + PROBE + 32, clientHeight: 844 }

  it('내용이 더 길면 남는 자리에 맞춘다', () => {
    expect(fillHeight({ ...base, natural: 865, shrinkTo: 360 })).toBe(612)
  })

  it('shrinkTo 가 없으면 줄이지 않는다', () => {
    expect(fillHeight({ ...base, natural: 865 })).toBeNull()
  })

  it('경계 — 남는 자리가 shrinkTo 와 같으면 맞추고, 1px 작으면 줄이지 않는다', () => {
    expect(fillHeight({ ...base, natural: 865, shrinkTo: 612 })).toBe(612)
    expect(fillHeight({ ...base, natural: 865, shrinkTo: 613 })).toBeNull()
  })

  it('내용이 남는 자리와 같으면 손대지 않는다', () => {
    expect(fillHeight({ ...base, natural: 612, shrinkTo: 360 })).toBeNull()
  })

  it('내용이 짧으면 shrinkTo 와 무관하게 늘린다', () => {
    expect(fillHeight({ ...base, natural: 300, shrinkTo: 360 })).toBe(612)
  })
})
