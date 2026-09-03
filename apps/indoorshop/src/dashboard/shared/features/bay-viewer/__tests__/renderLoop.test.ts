import { describe, expect, it } from 'vitest'
import { startRenderLoop } from '../lib/renderLoop'

/**
 * 그리기 루프가 **놀 때 쉬는가**, 그리고 **쉬느라 놓치지는 않는가**.
 *
 * 성능 작업의 위험은 늘 한쪽이다 — 덜 그려서 빨라졌는데 화면이 한 박자 늦는다. 그래서
 * "언제 그리지 않는가"만큼 "언제 반드시 그리는가"를 같은 무게로 못 박는다.
 */

/** 손으로 돌리는 rAF·시계 — 브라우저 없이 프레임을 한 장씩 진행시킨다 */
function harness() {
  let time = 0
  let nextHandle = 1
  const queued = new Map<number, () => void>()
  let moved = false
  let renders = 0

  const loopOptions = {
    controls: { update: () => moved },
    render: () => {
      renders += 1
    },
    now: () => time,
    requestFrame: (cb: () => void) => {
      const handle = nextHandle++
      queued.set(handle, cb)
      return handle
    },
    cancelFrame: (handle: number) => {
      queued.delete(handle)
    },
  }

  /** 프레임 한 장 진행 (16ms) */
  const tick = (frames = 1) => {
    for (let i = 0; i < frames; i += 1) {
      time += 16
      const pendingCallbacks = [...queued.values()]
      queued.clear()
      for (const cb of pendingCallbacks) cb()
    }
  }

  return {
    loopOptions,
    tick,
    setMoved: (value: boolean) => {
      moved = value
    },
    renders: () => renders,
    queuedCount: () => queued.size,
  }
}

describe('그리기 루프 — 놀 때 쉰다', () => {
  it('아무 일도 없으면 유예 시간이 지난 뒤 그리기를 멈춘다', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 100 })

    h.tick(4) // 64ms — 아직 유예 안
    expect(h.renders()).toBeGreaterThan(1)

    h.tick(20) // 유예를 한참 넘김
    const after = h.renders()
    h.tick(20)
    /* 더 그리지 않는다 — 정지 화면은 0fps */
    expect(h.renders()).toBe(after)
    loop.stop()
  })

  it('쉬는 동안에도 루프는 살아 있다 — 다음 변화를 놓치지 않는다', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 50 })
    h.tick(20)
    expect(h.queuedCount()).toBe(1) // 다음 프레임이 예약돼 있다
    loop.stop()
  })
})

describe('그리기 루프 — 반드시 그리는 경우', () => {
  it('카메라가 움직이면 그린다 (댐핑이 잦아드는 동안도)', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 50 })
    h.tick(20)
    const idle = h.renders()

    h.setMoved(true)
    h.tick(3)
    expect(h.renders()).toBe(idle + 3)
    loop.stop()
  })

  it('requestRender() 를 부르면 다음 프레임에 그린다', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 50 })
    h.tick(20)
    const idle = h.renders()

    loop.requestRender()
    h.tick(1)
    expect(h.renders()).toBe(idle + 1)
    loop.stop()
  })

  it('첫 장은 무조건 그린다 — 빈 화면으로 서 있지 않는다', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 0 })
    expect(h.renders()).toBe(1)
    loop.stop()
  })

  it('유예 시간 안에서는 계속 그린다 — 표시 못 한 변경의 안전망', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 200 })
    h.tick(5) // 80ms — 아직 유예 안
    expect(h.renders()).toBe(6) // 첫 장 + 5프레임
    loop.stop()
  })

  it('그리지 않는 프레임에도 controls.update() 는 부른다 — 댐핑이 얼지 않게', () => {
    let updates = 0
    const h = harness()
    const loop = startRenderLoop({
      ...h.loopOptions,
      controls: {
        update: () => {
          updates += 1
          return false
        },
      },
      graceMs: 0,
    })
    h.tick(10)
    expect(updates).toBe(11) // 첫 프레임 + 10
    loop.stop()
  })
})

describe('그리기 루프 — 안 보이면 멈춘다', () => {
  function visibilityHarness() {
    let hidden = false
    const listeners = new Set<() => void>()
    return {
      visibility: {
        isHidden: () => hidden,
        subscribe: (listener: () => void) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      },
      setHidden: (value: boolean) => {
        hidden = value
        for (const listener of listeners) listener()
      },
      listenerCount: () => listeners.size,
    }
  }

  it('탭이 숨으면 프레임 예약 자체를 끊는다', () => {
    const h = harness()
    const v = visibilityHarness()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.visibility, graceMs: 1000 })
    h.tick(2)
    const before = h.renders()

    v.setHidden(true)
    h.tick(5)
    expect(h.renders()).toBe(before)
    expect(h.queuedCount()).toBe(0)
    loop.stop()
  })

  it('다시 보이면 한 장 그려서 되돌린다', () => {
    const h = harness()
    const v = visibilityHarness()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.visibility, graceMs: 0 })
    v.setHidden(true)
    h.tick(3)
    const hiddenRenders = h.renders()

    v.setHidden(false)
    expect(h.renders()).toBeGreaterThan(hiddenRenders)
    loop.stop()
  })

  it('숨은 채로 시작하면 프레임을 예약하지 않는다', () => {
    const h = harness()
    const v = visibilityHarness()
    v.setHidden(true)
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.visibility })
    expect(h.queuedCount()).toBe(0)
    expect(h.renders()).toBe(0)
    loop.stop()
  })

  it('stop() 은 프레임과 가시성 구독을 함께 끊는다 — 언마운트 뒤 도는 루프가 없다', () => {
    const h = harness()
    const v = visibilityHarness()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.visibility })
    h.tick(2)
    loop.stop()
    const after = h.renders()

    h.tick(5)
    expect(h.renders()).toBe(after)
    expect(h.queuedCount()).toBe(0)
    expect(v.listenerCount()).toBe(0)
  })
})
