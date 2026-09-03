import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  GLASS_STATUS_HEX,
  STATUS_HEX,
  STATUS_MEANINGS,
  STATUS_SHAPE,
  STATUS_STYLE,
  type StatusMeaning,
} from '../statusPalette'

/*
 * 팔레트 **계약** 테스트.
 *
 * 색이 화면마다 다른 뜻을 갖는 사고는 "누가 어디서 색을 하나 더 골랐다"에서 시작한다.
 * 그래서 여기서 보는 것은 예쁨이 아니라 계약이다 — 의미마다 색이 하나뿐인가, DOM 이
 * 쓰는 토큰과 캔버스가 쓰는 hex 가 같은가, 색을 못 보는 사람에게도 갈리는가.
 */

/* 토큰의 실물을 읽는다 — 값을 테스트에 베껴 두면 CSS 만 바뀌었을 때 통과해 버린다
 * (`?raw` 는 CSS 에서 빈 문자열이 온다 — 번들러가 스타일로 먼저 삼킨다) */
const CSS = readFileSync('src/dashboard/shared/styles/globals.css', 'utf8')

/** globals.css 에서 `:root`(라이트) / `.dark` 블록의 커스텀 속성을 읽는다 */
function cssVars(block: 'root' | 'dark'): Record<string, string> {
  const start = CSS.indexOf(block === 'root' ? '.inshop-root {' : '.dark .inshop-root,')
  expect(start).toBeGreaterThan(-1)
  const end = CSS.indexOf('\n}', start)
  const body = CSS.slice(start, end)
  const vars: Record<string, string> = {}
  for (const match of body.matchAll(/(--[a-z-]+):\s*([^;]+);/g)) {
    vars[match[1]] = match[2].trim()
  }
  return vars
}

/** 의미별 CSS 변수 이름 — idle 은 상태색이 아니라 중립이라 토큰이 없다 */
const TOKEN_OF: Record<Exclude<StatusMeaning, 'idle'>, string> = {
  done: '--status-healthy',
  inProgress: '--status-progress',
  warning: '--status-degraded',
  error: '--status-unhealthy',
}

describe('상태 팔레트 — 의미가 색을 정한다', () => {
  it('다섯 의미 전부가 스타일·모양·두 테마의 색을 갖는다', () => {
    expect(STATUS_MEANINGS).toEqual(['done', 'inProgress', 'warning', 'error', 'idle'])
    for (const meaning of STATUS_MEANINGS) {
      expect(STATUS_STYLE[meaning]).toBeDefined()
      expect(STATUS_SHAPE[meaning]).toBeDefined()
      expect(STATUS_HEX.light[meaning]).toMatch(/^#[0-9a-f]{6}$/)
      expect(STATUS_HEX.dark[meaning]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('한 의미에 색 하나 — 두 의미가 같은 색을 쓰지 않는다', () => {
    for (const theme of ['light', 'dark'] as const) {
      const colors = STATUS_MEANINGS.map((m) => STATUS_HEX[theme][m])
      expect(new Set(colors).size).toBe(colors.length)
    }
  })

  it('캔버스가 쓰는 hex 와 CSS 토큰이 같다 — 지도와 목록이 같은 색을 말한다', () => {
    const light = cssVars('root')
    const dark = cssVars('dark')
    for (const [meaning, token] of Object.entries(TOKEN_OF)) {
      expect(light[token]).toBe(STATUS_HEX.light[meaning as StatusMeaning])
      expect(dark[token]).toBe(STATUS_HEX.dark[meaning as StatusMeaning])
    }
  })

  it('유리(지도 오버레이) 색은 다크 램프를 쓴다 — 바탕이 두 테마 모두 어둡다', () => {
    const light = cssVars('root')
    expect(light['--glass-progress']).toBe(GLASS_STATUS_HEX.inProgress)
    expect(light['--glass-healthy']).toBe(GLASS_STATUS_HEX.done)
    expect(light['--glass-degraded']).toBe(GLASS_STATUS_HEX.warning)
    expect(light['--glass-unhealthy']).toBe(GLASS_STATUS_HEX.error)
  })

  it('색을 못 봐도 갈린다 — 의미마다 다른 모양', () => {
    const shapes = STATUS_MEANINGS.map((m) => STATUS_SHAPE[m])
    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('진행중은 파랑이고 이상은 빨강이다 — 돌고 있는 일에 경보색을 주지 않는다', () => {
    for (const theme of ['light', 'dark'] as const) {
      expect(hueOf(STATUS_HEX[theme].inProgress)).toBeGreaterThan(190)
      expect(hueOf(STATUS_HEX[theme].inProgress)).toBeLessThan(260)
      const errorHue = hueOf(STATUS_HEX[theme].error)
      expect(errorHue < 20 || errorHue > 340).toBe(true)
    }
  })

  it('상태 클래스는 상태 토큰만 쓴다 — 강조색(accent)을 상태로 재사용하지 않는다', () => {
    for (const meaning of STATUS_MEANINGS) {
      const style = STATUS_STYLE[meaning]
      for (const value of Object.values(style)) {
        expect(value).not.toContain('accent')
      }
    }
  })
})

/** 0~360 색상환 각도 */
function hueOf(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0
  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return (hue * 60 + 360) % 360
}
