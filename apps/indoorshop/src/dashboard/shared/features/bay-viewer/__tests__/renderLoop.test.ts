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
  const timers = new Map<number, () => void>()

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
    setTimer: (cb: () => void, _ms: number) => {
      const handle = nextHandle++
      timers.set(handle, cb)
      return handle
    },
    clearTimer: (handle: number) => {
      timers.delete(handle)
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
    /** 예약된 만회 타이머를 터뜨린다 (숨은 탭의 '한 장 갚기') */
    runTimers: () => {
      const due = [...timers.values()]
      timers.clear()
      for (const cb of due) cb()
    },
    timerCount: () => timers.size,
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

  it('숨은 채로 시작해도 첫 장은 갚는다 — rAF 루프는 돌리지 않는다 (P0)', () => {
    const h = harness()
    const v = visibilityHarness()
    v.setHidden(true)
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.visibility })

    /* 초당 60장 도는 루프는 여전히 없다 */
    expect(h.queuedCount()).toBe(0)
    expect(h.renders()).toBe(0)

    /* 대신 만회 타이머가 딱 한 장을 갚는다 — 캔버스가 검은 채로 남지 않는다 */
    expect(h.timerCount()).toBe(1)
    h.runTimers()
    expect(h.renders()).toBe(1)
    expect(h.queuedCount()).toBe(0)
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

/*
 * ── 상태 머신 (P0) ──
 *
 * 이 루프는 사실상 상태가 셋이다 — **돌고 있음**(rAF 예약 있음) · **잠듦**(예약 없음,
 * 아직 살아 있음) · **끝남**(stop). P0 의 검은 화면은 "잠듦에서 돌고 있음으로 가는 간선이
 * `visibilitychange` 하나뿐"이라 생긴 사고였다: 그 이벤트가 오지 않으면 씬도 자산도
 * 멀쩡한데 영영 한 장도 안 그려진다.
 *
 * 그래서 상태를 눈에 보이는 두 값(프레임 예약 수·그린 장수)으로 못 박고, **잠듦에서
 * 빠져나오는 모든 간선**을 하나씩 건다. 여기서 빠진 간선이 곧 검은 화면이다.
 */
describe('그리기 루프 — 상태 머신', () => {
  function visibility() {
    let hidden = false
    const listeners = new Set<() => void>()
    return {
      source: {
        isHidden: () => hidden,
        subscribe: (listener: () => void) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      },
      set: (value: boolean) => {
        hidden = value
        for (const listener of listeners) listener()
      },
    }
  }

  /** 보이는 채로 시작 → 곧장 '돌고 있음' */
  it('보이는 채로 시작하면 돌고 있음', () => {
    const h = harness()
    const v = visibility()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.source, graceMs: 0 })
    expect(h.queuedCount()).toBe(1)
    expect(h.renders()).toBe(1)
    loop.stop()
  })

  /** 잠듦 → 돌고 있음: 탭이 다시 보일 때 */
  it('잠듦 → (탭 활성) → 돌고 있음', () => {
    const h = harness()
    const v = visibility()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.source, graceMs: 0 })
    v.set(true)
    expect(h.queuedCount()).toBe(0) // 잠듦
    const asleep = h.renders()

    v.set(false)
    expect(h.queuedCount()).toBe(1) // 돌고 있음
    expect(h.renders()).toBe(asleep + 1) // 되돌리는 한 장
    loop.stop()
  })

  /**
   * 잠듦 → 돌고 있음: **requestRender 로도 깨어난다.** P0 이전에는 이 간선이 없어서
   * (`pending` 만 켜고 끝) 씬 준비·자산 도착·리사이즈가 아무 일도 일으키지 못했다.
   */
  it('잠듦 → (requestRender) → 돌고 있음 — 이 간선이 P0 의 검은 화면이었다', () => {
    const h = harness()
    const v = visibility()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.source, graceMs: 0 })
    /* 유예가 지나 rAF 는 돌지만 아무것도 안 그리는 상태로 만든다 */
    h.tick(3)
    const idle = h.renders()

    /* 탭을 숨겨 완전히 잠재운다 */
    v.set(true)
    expect(h.queuedCount()).toBe(0)

    /* 숨은 채로 온 요청은 타이머로 한 장 갚는다 */
    loop.requestRender()
    h.runTimers()
    expect(h.renders()).toBe(idle + 1)

    /* 다시 보이는 상태에서의 요청은 루프 자체를 되살린다 */
    v.set(false)
    h.tick(5) // 유예를 넘겨 다시 잠재운다
    const beforeWake = h.renders()
    loop.requestRender()
    h.tick(1)
    expect(h.renders()).toBe(beforeWake + 1)
    loop.stop()
  })

  /** 숨은 동안 요청이 몰려도 갚는 장수는 한 장 — 숨은 탭이 60fps 로 돌지 않는다 */
  it('숨은 동안의 요청 여러 건은 한 장으로 갚는다', () => {
    const h = harness()
    const v = visibility()
    v.set(true)
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.source })
    loop.requestRender()
    loop.requestRender()
    loop.requestRender()
    h.runTimers()
    expect(h.renders()).toBe(1)
    loop.stop()
  })

  /** 끝남은 흡수 상태 — 어떤 간선으로도 다시 그리지 않는다 */
  it('끝남에서는 어떤 계기로도 되살아나지 않는다', () => {
    const h = harness()
    const v = visibility()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.source })
    const drawn = h.renders()
    loop.stop()

    loop.requestRender()
    v.set(true)
    v.set(false)
    h.tick(5)
    h.runTimers()
    expect(h.renders()).toBe(drawn)
    expect(h.queuedCount()).toBe(0)
    expect(h.timerCount()).toBe(0)
  })

  /** stop() 은 만회 타이머도 함께 걷는다 — 언마운트 뒤 늦게 터지는 render 가 없다 */
  it('stop() 은 밀린 만회 타이머도 걷는다', () => {
    const h = harness()
    const v = visibility()
    v.set(true)
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.source })
    expect(h.timerCount()).toBe(1)
    loop.stop()
    expect(h.timerCount()).toBe(0)
  })
})

/*
 * ── 조작 중에는 절전하지 않는다 (P0 성능) ──
 *
 * 유휴 정지의 규칙 1은 "카메라가 움직인 프레임만 그린다"였다. 절전에는 맞지만
 * **드래그 중에도 카메라가 안 움직이는 프레임이 있다** — 극각·거리 한계에 걸린 순간,
 * 포인터가 잠깐 멎은 순간, 이벤트가 한 프레임 늦게 온 순간. 그 프레임을 건너뛰면
 * 손은 움직이는데 화면이 한 박자 늦는, 정확히 '끊긴다'고 느끼는 그림이 된다.
 *
 * 그래서 조작 중(`setInteracting(true)`)에는 유휴 판정을 아예 하지 않는다.
 */
describe('그리기 루프 — 조작 중에는 매 프레임 그린다', () => {
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
    }
  }

  it('조작 중이면 카메라가 멈춰 있어도 매 프레임 그린다', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 0 })
    h.tick(3) // 유예가 0 이므로 곧 유휴로 내려간다
    const idle = h.renders()
    h.tick(5)
    expect(h.renders()).toBe(idle) // 놀 때는 정말 안 그린다

    loop.setInteracting(true)
    h.tick(5)
    expect(h.renders()).toBe(idle + 5) // 손이 닿아 있는 동안은 빠짐없이

    loop.stop()
  })

  it('손을 떼면 유예가 다시 열리고 그 뒤 유휴로 내려간다', () => {
    const h = harness()
    /* 유예 40ms = 두 프레임(16·32ms)까지 — 관성 감쇠가 잦아드는 동안을 흉내낸다 */
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 40 })
    loop.setInteracting(true)
    h.tick(3)
    const drawn = h.renders()

    loop.setInteracting(false)
    /* 유예 안의 두 프레임은 계속 그린다 — 관성이 뚝 끊기지 않도록 */
    h.tick(2)
    expect(h.renders()).toBe(drawn + 2)

    /* 유예가 지나면 다시 0fps */
    const settled = h.renders()
    h.tick(5)
    expect(h.renders()).toBe(settled)

    loop.stop()
  })

  it('잠든 루프도 조작이 시작되면 깨어난다', () => {
    const h = harness()
    const v = visibilityHarness()
    const loop = startRenderLoop({ ...h.loopOptions, visibility: v.visibility, graceMs: 0 })
    v.setHidden(true)
    expect(h.queuedCount()).toBe(0) // 잠듦

    v.setHidden(false)
    h.tick(3) // 유예 0 이므로 다시 유휴
    const idle = h.renders()

    loop.setInteracting(true)
    h.tick(2)
    expect(h.renders()).toBe(idle + 2)

    loop.stop()
  })

  it('조작 중이라도 stop() 뒤에는 그리지 않는다', () => {
    const h = harness()
    const loop = startRenderLoop({ ...h.loopOptions, graceMs: 0 })
    loop.setInteracting(true)
    h.tick(2)
    const drawn = h.renders()
    loop.stop()
    h.tick(5)
    expect(h.renders()).toBe(drawn)
  })
})
