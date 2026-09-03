import { describe, expect, it } from 'vitest'
import { dragActionOf } from '../mapInteraction'
import { CAMERA_FLY_MS, CAMERA_NUDGE_MS, easeInOutCubic } from '../cameraMotion'

/*
 * 드래그 문법 단일 소스 (UX 감사 A4 → P3 재통일).
 *
 * 두 면이 서로 다른 1차 동작을 갖는다 — 지도는 이동, 뷰어는 회전. 그 대신 **오른쪽·
 * Shift 는 언제나 왼쪽의 반대 축**이라는 규칙은 공유한다. 여기가 깨지면 "화면마다
 * 회전 버튼이 다르다"가 다시 돌아오거나, 뷰어에서 점군이 돌지 않는다.
 */
describe('dragActionOf — 2D 지도: 왼쪽 이동 · 오른쪽/Shift 회전', () => {
  it('왼쪽 드래그 = 이동 (지도의 1차 동작)', () => {
    expect(dragActionOf(0)).toBe('pan')
    expect(dragActionOf(0, {}, 'map')).toBe('pan')
  })

  it('오른쪽 드래그 = 회전', () => {
    expect(dragActionOf(2, {}, 'map')).toBe('rotate')
  })

  it('Shift·Alt + 왼쪽 = 회전 (트랙패드·2버튼 마우스)', () => {
    expect(dragActionOf(0, { shiftKey: true }, 'map')).toBe('rotate')
    expect(dragActionOf(0, { altKey: true }, 'map')).toBe('rotate')
  })

  it('면을 주지 않으면 지도 문법이다 — 기존 호출부(YardMap)가 그대로 돈다', () => {
    expect(dragActionOf(0)).toBe(dragActionOf(0, {}, 'map'))
    expect(dragActionOf(2)).toBe(dragActionOf(2, {}, 'map'))
  })
})

describe('dragActionOf — 3D 뷰어: 왼쪽 회전 · 오른쪽/Shift 이동', () => {
  it('왼쪽 드래그 = 궤도 회전 (점군의 1차 동작은 돌려 보기다)', () => {
    expect(dragActionOf(0, {}, 'viewer')).toBe('rotate')
  })

  it('오른쪽 드래그 = 이동', () => {
    expect(dragActionOf(2, {}, 'viewer')).toBe('pan')
  })

  it('Shift·Alt + 왼쪽 = 이동 — 왼쪽의 반대 축이라는 규칙은 지도와 같다', () => {
    expect(dragActionOf(0, { shiftKey: true }, 'viewer')).toBe('pan')
    expect(dragActionOf(0, { altKey: true }, 'viewer')).toBe('pan')
  })

  it('두 면의 왼쪽·오른쪽은 정확히 뒤집혀 있다 — 한 면만 배우면 다른 면도 안다', () => {
    for (const button of [0, 2]) {
      expect(dragActionOf(button, {}, 'viewer')).not.toBe(dragActionOf(button, {}, 'map'))
    }
  })
})

describe('dragActionOf — 가운데 버튼은 면과 무관하다', () => {
  it('Blender 문법 보존: 기본 회전, Shift 이동, Ctrl/⌘ 줌', () => {
    for (const surface of ['map', 'viewer'] as const) {
      expect(dragActionOf(1, {}, surface)).toBe('rotate')
      expect(dragActionOf(1, { shiftKey: true }, surface)).toBe('pan')
      expect(dragActionOf(1, { ctrlKey: true }, surface)).toBe('zoom')
      expect(dragActionOf(1, { metaKey: true }, surface)).toBe('zoom')
    }
  })
})

describe('cameraMotion — 비행 리듬 단일 소스 (UX 감사 G1)', () => {
  it('비행은 600ms, 짧은 이동은 320ms — 화면마다 다른 숫자를 다시 만들지 않는다', () => {
    expect(CAMERA_FLY_MS).toBe(600)
    expect(CAMERA_NUDGE_MS).toBe(320)
    expect(CAMERA_NUDGE_MS).toBeLessThan(CAMERA_FLY_MS)
  })

  it('이징은 양끝 감속 — 0→0, 1→1, 중간이 절반', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
    /* 출발 직후가 등속(0.1)보다 느리다 — 감속 곡선의 증명 */
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1)
  })
})
