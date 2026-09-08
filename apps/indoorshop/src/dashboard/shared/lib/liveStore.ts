/*
 * ── 실시간 값을 담는 얇은 스토어 ──
 *
 * 화면이 "계속 흐르는 값"(설비 상태·수집 실적)을 보는 방식이 지금은 훅마다 제각각이다 —
 * 어떤 곳은 `useAsyncData`(1회), 어떤 곳은 컴포넌트 안 `setInterval`. 그 상태로 실연동
 * (WS/SSE push)이 오면 **훅마다 따로 뜯어고쳐야 하고**, 같은 값을 보는 두 화면이 각자
 * 폴링을 돌려 서버에 두 번 묻는다.
 *
 * 그래서 값의 흐름을 컴포넌트 밖 스토어로 한 겹 내린다:
 *
 *     드라이버(값을 흘려 넣는 쪽)  →  스토어(마지막 스냅샷 보관)  →  useSyncExternalStore
 *
 * ⚠️ **실연동 시 바꾸는 것은 드라이버 하나다.** `pollingDriver` 를 `websocketDriver` 로
 *    갈아끼우면 스토어·훅·화면은 손대지 않는다 — 스토어가 보는 것은 "누가 publish 했다"
 *    뿐이고, 그것이 폴링 응답인지 WS 프레임인지 알지 못한다.
 *
 * ── 스토어가 지키는 세 가지 ──
 *
 *  1. **다시 받는 동안 이전 값을 지우지 않는다.** 지우면 폴링마다 화면이 깜박인다
 *     (`useAsyncData` 와 같은 규칙).
 *  2. **실패해도 마지막 성공을 잊지 않는다.** `lastSuccessAt` 이 남아야 실패 UI 가
 *     "10:04 이후로 못 받고 있음"이라고 말할 수 있다. 실패를 그냥 빈 화면으로 그리면
 *     사용자는 값이 없는 것인지 못 받은 것인지 구분하지 못한다.
 *  3. **구독자가 없으면 흐름을 멈춘다.** 화면을 떠난 뒤에도 타이머가 도는 일을 없앤다
 *     (참조 계수로 첫 구독에 시작, 마지막 해지에 정지).
 */
import { useSyncExternalStore } from 'react'

/** 값의 현재 처지 — 화면의 로딩·빈·실패 갈래가 여기서 갈린다 */
export type LiveStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface LiveSnapshot<T> {
  /** 마지막으로 성공한 값 — 실패해도 지우지 않는다(2번 규칙) */
  data: T | null
  status: LiveStatus
  /** 마지막 실패 — 성공하면 지운다 */
  error: Error | null
  /** 마지막 성공 시각 (epoch ms) — "갱신됨" 표기와 실패 UI 의 근거 */
  lastSuccessAt: number | null
}

/** 드라이버가 스토어에 값을 흘려 넣는 창구 */
export interface LivePublisher<T> {
  publish(data: T, at: number): void
  fail(error: unknown, at: number): void
}

/** 드라이버 — 값을 흘리기 시작하고, 멈추는 법과 즉시 다시 받는 법을 낸다 */
export interface LiveDriverHandle {
  stop(): void
  /** 사용자가 '다시 시도'를 눌렀을 때 — 다음 주기를 기다리지 않는다 */
  refresh(): void
}

export type LiveDriver<T> = (publisher: LivePublisher<T>) => LiveDriverHandle

export interface LiveStore<T> {
  subscribe(listener: () => void): () => void
  getSnapshot(): LiveSnapshot<T>
  /** 즉시 다시 받기 — 실패 UI 의 재시도 버튼이 부른다 */
  refresh(): void
}

const IDLE: LiveSnapshot<never> = {
  data: null,
  status: 'idle',
  error: null,
  lastSuccessAt: null,
}

/**
 * 스토어 하나 — 드라이버 하나에 붙는다.
 *
 * `getSnapshot` 은 **같은 객체를 돌려준다**(값이 바뀔 때만 새 객체로 교체) —
 * `useSyncExternalStore` 는 렌더마다 이 값을 참조로 비교하므로, 매번 새 객체를 지어
 * 내면 무한 렌더에 빠진다.
 */
export function createLiveStore<T>(driver: LiveDriver<T>): LiveStore<T> {
  let snapshot: LiveSnapshot<T> = IDLE as LiveSnapshot<T>
  let handle: LiveDriverHandle | null = null
  const listeners = new Set<() => void>()

  const emit = (next: LiveSnapshot<T>) => {
    snapshot = next
    for (const listener of listeners) listener()
  }

  const publisher: LivePublisher<T> = {
    publish(data, at) {
      emit({ data, status: 'ready', error: null, lastSuccessAt: at })
    },
    fail(error) {
      emit({
        /* 값은 남긴다 — 낡았음은 `lastSuccessAt` 이 말한다 */
        data: snapshot.data,
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        lastSuccessAt: snapshot.lastSuccessAt,
      })
    },
  }

  const start = () => {
    if (handle) return
    /* 값이 이미 있으면 'loading' 으로 되돌리지 않는다 — 재구독마다 깜박이지 않도록 */
    if (snapshot.status === 'idle') {
      emit({ ...snapshot, status: 'loading' })
    }
    handle = driver(publisher)
  }

  const stop = () => {
    handle?.stop()
    handle = null
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stop()
      }
    },
    getSnapshot: () => snapshot,
    refresh() {
      /* 구독자가 없으면 흐름도 없다 — 아무도 안 보는 값을 되받지 않는다 */
      handle?.refresh()
    },
  }
}

/**
 * 같은 계약을 **키마다** 하나씩 — 공장별 설비 상태처럼 대상이 갈리는 값을 위한 것.
 *
 * 키가 같으면 같은 스토어를 돌려주므로, 한 화면 안의 두 컴포넌트가 같은 공장을 보면
 * 폴링은 한 번만 돈다.
 */
export function createLiveStoreFamily<T>(
  makeDriver: (key: string) => LiveDriver<T>
): { of(key: string): LiveStore<T> } {
  const stores = new Map<string, LiveStore<T>>()
  return {
    of(key) {
      const existing = stores.get(key)
      if (existing) return existing
      const store = createLiveStore(makeDriver(key))
      stores.set(key, store)
      return store
    },
  }
}

/* ── 드라이버 구현 ──────────────────────────────────────────────── */

export interface PollingDriverOptions {
  /** 폴링 주기 (ms) */
  intervalMs?: number
  /** 시계 — 테스트가 시각을 고정할 수 있도록 주입 가능하게 둔다 */
  now?: () => number
}

/**
 * 주기 폴링 드라이버 — **실연동 전까지의 구현**.
 *
 * 즉시 한 번 받고, 그 뒤 `intervalMs` 마다 다시 받는다. 앞선 요청이 늦게 도착해
 * 새 값을 덮어쓰는 일이 없도록 세대(generation)를 세어 지난 응답은 버린다.
 *
 * ⚠️ 실연동(WS/SSE)에서는 이 함수 대신 `websocketDriver` 를 쓴다 — 형태는 같다:
 *    소켓을 열고 프레임마다 `publish`, 끊기면 `fail`, `stop` 에서 소켓을 닫고,
 *    `refresh` 에서 재연결(또는 스냅샷 요청)을 보낸다. 스토어·훅·화면은 그대로다.
 */
export function pollingDriver<T>(
  load: (now: number) => Promise<T>,
  options: PollingDriverOptions = {}
): LiveDriver<T> {
  const intervalMs = options.intervalMs ?? 6_000
  const clock = options.now ?? Date.now

  return (publisher) => {
    let generation = 0
    let stopped = false

    const tick = () => {
      const mine = ++generation
      const at = clock()
      load(at).then(
        (data) => {
          if (stopped || mine !== generation) return
          publisher.publish(data, at)
        },
        (error: unknown) => {
          if (stopped || mine !== generation) return
          publisher.fail(error, at)
        }
      )
    }

    tick()
    const timer = setInterval(tick, intervalMs)

    return {
      stop() {
        stopped = true
        clearInterval(timer)
      },
      refresh: tick,
    }
  }
}

/* ── React 결합 ─────────────────────────────────────────────────── */

/**
 * 스토어를 구독해 현재 스냅샷을 읽는다.
 *
 * `useState` + `useEffect` 로 손수 구독하면 마운트와 첫 렌더 사이에 들어온 값을
 * 놓친다(tearing). `useSyncExternalStore` 는 React 가 그 틈을 막아 준다.
 */
export function useLiveStore<T>(store: LiveStore<T>): LiveSnapshot<T> {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
