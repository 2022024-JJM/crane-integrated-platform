import { describe, expect, it } from 'vitest'
import { dragActionOf } from '../mapInteraction'
import { CAMERA_FLY_MS, CAMERA_NUDGE_MS, easeInOutCubic } from '../cameraMotion'

/*
 * 전 화면 공통 드래그 문법 (UX 감사 A4) — 지도(YardMap)와 3D 뷰어(blenderControls)가
 * 같은 답을 쓰는 단일 소스. 여기가 깨지면 "화면마다 회전 버튼이 다르다"가 돌아온다.
 */
describe('dragActionOf — 왼쪽 이동 · 오른쪽/Shift 회전', () => {
  it('왼쪽 드래그 = 이동', () => {
    expect(dragActionOf(0)).toBe('pan')
  })

  it('오른쪽 드래그 = 회전', () => {
    expect(dragActionOf(2)).toBe('rotate')
  })

  it('Shift + 드래그 = 회전 (트랙패드·2버튼 마우스)', () => {
    expect(dragActionOf(0, { shiftKey: true })).toBe('rotate')
  })

  it('Alt + 왼쪽 = 회전 (Blender 3버튼 에뮬레이션 습관 보존)', () => {
    expect(dragActionOf(0, { altKey: true })).toBe('rotate')
  })

  it('가운데 버튼 — Blender 문법 보존: 기본 회전, Shift 이동, Ctrl/⌘ 줌', () => {
    expect(dragActionOf(1)).toBe('rotate')
    expect(dragActionOf(1, { shiftKey: true })).toBe('pan')
    expect(dragActionOf(1, { ctrlKey: true })).toBe('zoom')
    expect(dragActionOf(1, { metaKey: true })).toBe('zoom')
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
