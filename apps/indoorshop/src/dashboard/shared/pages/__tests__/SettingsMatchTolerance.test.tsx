import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/dom'
import { renderWithProviders } from '../../lib/testing/renderWithProviders'
import {
  MATCH_TOLERANCE_MAX_CM,
  MATCH_TOLERANCE_MIN_CM,
  getMatchToleranceCm,
  resetMatchToleranceForTest,
  setMatchToleranceCm,
} from '../../lib/matchTolerance'

/*
 * 이 환경엔 localStorage 가 없는데(setupDom 참조) 테마·글자크기 Provider 는 그것을
 * 무방비로 읽는다 — 임계와 무관한 자리에서 터지므로 최소한의 가짜를 깔아 둔다.
 */
/* ⚠️ `'localStorage' in globalThis` 는 참이다 — 속성은 있고 **값이 undefined** 다 */
if (globalThis.localStorage == null) {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
    configurable: true,
  })
}

/* 설정 화면은 테마·글자크기 Provider 를 요구한다 — 임계 항목만 떼어 볼 수 없어 통째로 세운다 */
const { ThemeProvider } = await import('@crane/core/lib/theme-context')
const { FontScaleProvider } = await import('../../lib/font-scale/FontScaleProvider')
const { SettingsPage } = await import('../SettingsPage')

/**
 * **설정 → 뷰어 반영 계약** (R23 ②).
 *
 * 임계는 뷰어 도구줄에서 설정으로 옮겨졌다. 설정에서 바꾼 값이 전역 스토어에 실제로
 * 들어가야 뷰어(구독자)가 그 기준으로 다시 칠한다 — 슬라이더가 화면 안에서만 움직이고
 * 스토어를 못 건드리면, 사용자는 바꿨다고 믿는데 뷰어는 옛 숫자를 계속 말한다.
 */
function renderSettings() {
  return renderWithProviders(
    <ThemeProvider>
      <FontScaleProvider>
        <SettingsPage />
      </FontScaleProvider>
    </ThemeProvider>
  )
}

describe('설정 화면의 실측 정합 판별 임계', () => {
  beforeEach(() => resetMatchToleranceForTest())
  afterEach(() => resetMatchToleranceForTest())

  it('5 ~ 60cm 슬라이더가 서고 현재 값을 보여 준다', () => {
    renderSettings()
    const slider = screen.getByRole('slider', { name: '실측 정합 판별 임계' })
    expect(slider).toHaveAttribute('min', String(MATCH_TOLERANCE_MIN_CM))
    expect(slider).toHaveAttribute('max', String(MATCH_TOLERANCE_MAX_CM))
    expect(slider).toHaveValue(String(getMatchToleranceCm()))
  })

  it('슬라이더를 움직이면 전역 임계가 바뀐다 (저장 → 뷰어 반영의 앞단)', () => {
    renderSettings()
    const slider = screen.getByRole('slider', { name: '실측 정합 판별 임계' })

    fireEvent.change(slider, { target: { value: '55' } })
    expect(getMatchToleranceCm()).toBe(55)
    expect(screen.getAllByText('55cm').length).toBeGreaterThan(0)

    fireEvent.change(slider, { target: { value: '5' } })
    expect(getMatchToleranceCm()).toBe(5)
  })

  it('밖에서 바뀐 값도 화면이 따라온다 (다른 탭·다른 화면에서의 변경)', () => {
    renderSettings()
    /* React 밖에서 일어난 변경이라 act 로 감싸 flush 한다(구독 자체는 스토어가 한다) */
    act(() => setMatchToleranceCm(48))
    expect(screen.getByRole('slider', { name: '실측 정합 판별 임계' })).toHaveValue('48')
  })

  it('뷰어 도구줄의 임계 슬라이더는 사라졌다 — 손잡이가 두 곳에 있으면 안 된다', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../processes/assembly/ui/viewer/RealScanViewer.tsx'),
      'utf8'
    )
    expect(source).not.toContain('real-scan-tolerance')
    /* 뷰어는 설정을 구독만 한다 */
    expect(source).toContain('useMatchToleranceCm()')
  })
})
