import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLiveStore,
  createLiveStoreFamily,
  pollingDriver,
  type LivePublisher,
} from '../liveStore'

/**
 * 구독 스토어 — 실시간 값의 공용 통로.
 *
 * 지키는 것: (1) 실패해도 마지막 성공 값·시각을 잃지 않는다(실패 UI 의 근거).
 * (2) 구독자가 없으면 흐름이 멈춘다(떠난 화면의 타이머가 살아남지 않는다).
 * (3) 지난 요청의 늦은 응답이 새 값을 덮지 않는다.
 */

describe('createLiveStore', () => {
  function manualDriver() {
    let publisher: LivePublisher<string> | null = null
    const handle = { stop: vi.fn(), refresh: vi.fn() }
    return {
      driver: (p: LivePublisher<string>) => {
        publisher = p
        return handle
      },
      publish: (v: string, at: number) => publisher!.publish(v, at),
      fail: (e: unknown, at: number) => publisher!.fail(e, at),
      handle,
    }
  }

  it('구독 전에는 idle, 첫 구독에 드라이버가 붙고 loading 이 된다', () => {
    const { driver } = manualDriver()
    const store = createLiveStore(driver)
    expect(store.getSnapshot().status).toBe('idle')

    store.subscribe(() => {})
    expect(store.getSnapshot().status).toBe('loading')
  })

  it('publish 로 값·시각이 서고, fail 은 값을 지우지 않는다 — 마지막 성공이 남는다', () => {
    const { driver, publish, fail } = manualDriver()
    const store = createLiveStore(driver)
    store.subscribe(() => {})

    publish('첫값', 1_000)
    expect(store.getSnapshot()).toMatchObject({
      data: '첫값',
      status: 'ready',
      error: null,
      lastSuccessAt: 1_000,
    })

    fail(new Error('망 끊김'), 2_000)
    const after = store.getSnapshot()
    expect(after.status).toBe('error')
    expect(after.error?.message).toBe('망 끊김')
    /* 실패 UI 가 "10:04 이후로 못 받고 있음"을 말할 근거 — 값과 시각은 남는다 */
    expect(after.data).toBe('첫값')
    expect(after.lastSuccessAt).toBe(1_000)

    publish('회복', 3_000)
    expect(store.getSnapshot()).toMatchObject({ data: '회복', status: 'ready', error: null })
  })

  it('Error 아닌 던짐도 Error 로 접는다 — 실패 채널의 모양은 하나다', () => {
    const { driver, fail } = manualDriver()
    const store = createLiveStore(driver)
    store.subscribe(() => {})
    fail('문자열 오류', 1_000)
    expect(store.getSnapshot().error).toBeInstanceOf(Error)
  })

  it('마지막 구독 해지에 드라이버가 멈춘다 — 떠난 화면의 폴링이 살아남지 않는다', () => {
    const { driver, handle } = manualDriver()
    const store = createLiveStore(driver)
    const a = store.subscribe(() => {})
    const b = store.subscribe(() => {})
    a()
    expect(handle.stop).not.toHaveBeenCalled()
    b()
    expect(handle.stop).toHaveBeenCalledTimes(1)
  })

  it('재구독해도 값이 남아 있으면 loading 으로 되돌리지 않는다 — 화면이 깜박이지 않는다', () => {
    const { driver, publish } = manualDriver()
    const store = createLiveStore(driver)
    const a = store.subscribe(() => {})
    publish('값', 1_000)
    a()
    store.subscribe(() => {})
    expect(store.getSnapshot().status).toBe('ready')
  })

  it('refresh 는 드라이버에 위임한다 — 구독자가 없으면 아무 일도 없다', () => {
    const { driver, handle } = manualDriver()
    const store = createLiveStore(driver)
    store.refresh()
    expect(handle.refresh).not.toHaveBeenCalled()
    store.subscribe(() => {})
    store.refresh()
    expect(handle.refresh).toHaveBeenCalledTimes(1)
  })

  it('getSnapshot 은 값이 안 바뀌면 같은 객체다 — useSyncExternalStore 의 전제', () => {
    const { driver, publish } = manualDriver()
    const store = createLiveStore(driver)
    store.subscribe(() => {})
    publish('값', 1_000)
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })
})

describe('createLiveStoreFamily', () => {
  it('같은 키는 같은 스토어 — 두 화면이 폴링을 두 번 돌리지 않는다', () => {
    const family = createLiveStoreFamily<string>(() => () => ({
      stop() {},
      refresh() {},
    }))
    expect(family.of('PBS')).toBe(family.of('PBS'))
    expect(family.of('PBS')).not.toBe(family.of('GBS'))
  })
})

describe('pollingDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function collect() {
    const events: string[] = []
    const publisher: LivePublisher<string> = {
      publish: (v) => events.push(`ok:${v}`),
      fail: (e) => events.push(`err:${(e as Error).message}`),
    }
    return { events, publisher }
  }

  it('즉시 한 번 받고, 주기마다 다시 받는다', async () => {
    const { events, publisher } = collect()
    let n = 0
    const driver = pollingDriver(async () => `v${++n}`, { intervalMs: 1_000, now: () => 0 })
    const handle = driver(publisher)

    await vi.advanceTimersByTimeAsync(0)
    expect(events).toEqual(['ok:v1'])
    await vi.advanceTimersByTimeAsync(2_000)
    expect(events).toEqual(['ok:v1', 'ok:v2', 'ok:v3'])
    handle.stop()
  })

  it('stop 뒤에는 받지도, 흘리지도 않는다', async () => {
    const { events, publisher } = collect()
    const driver = pollingDriver(async () => '값', { intervalMs: 1_000, now: () => 0 })
    const handle = driver(publisher)
    await vi.advanceTimersByTimeAsync(0)
    handle.stop()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(events).toEqual(['ok:값'])
  })

  it('refresh 는 다음 주기를 기다리지 않는다', async () => {
    const { events, publisher } = collect()
    let n = 0
    const driver = pollingDriver(async () => `v${++n}`, { intervalMs: 60_000, now: () => 0 })
    const handle = driver(publisher)
    await vi.advanceTimersByTimeAsync(0)
    handle.refresh()
    await vi.advanceTimersByTimeAsync(0)
    expect(events).toEqual(['ok:v1', 'ok:v2'])
    handle.stop()
  })

  it('지난 요청의 늦은 응답은 버린다 — 새 값을 낡은 값이 덮지 않는다', async () => {
    const { events, publisher } = collect()
    let call = 0
    const driver = pollingDriver(
      () =>
        new Promise<string>((resolve) => {
          const mine = ++call
          /* 첫 요청만 오래 걸린다 — 두 번째 응답이 먼저 도착하는 상황 */
          setTimeout(() => resolve(`v${mine}`), mine === 1 ? 5_000 : 10)
        }),
      { intervalMs: 1_000, now: () => 0 }
    )
    const handle = driver(publisher)
    await vi.advanceTimersByTimeAsync(1_100)
    expect(events).toEqual(['ok:v2'])
    await vi.advanceTimersByTimeAsync(4_000)
    expect(events).not.toContain('ok:v1')
    handle.stop()
  })

  it('실패도 채널로 나온다 — 조용히 사라지지 않는다', async () => {
    const { events, publisher } = collect()
    const driver = pollingDriver(async () => {
      throw new Error('연결 거부')
    }, { intervalMs: 1_000, now: () => 0 })
    const handle = driver(publisher)
    await vi.advanceTimersByTimeAsync(0)
    expect(events).toEqual(['err:연결 거부'])
    handle.stop()
  })
})
