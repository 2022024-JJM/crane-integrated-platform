import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAsyncData } from '../useAsyncData'
import { createLiveStore, useLiveStore, type LivePublisher } from '../liveStore'

const calls = (() => {
  const counts = new WeakMap<object, number>()
  return {
    next(key: object): number {
      const n = counts.get(key) ?? 0
      counts.set(key, n + 1)
      return n
    },
  }
})()

/**
 * 실패 채널의 **React 쪽 계약** — `error: Error | null` + 재시도 콜백.
 *
 * 상태 UI(로딩·빈·실패 컴포넌트)는 이 두 값만 받는다. 여기서는 그 두 값이 화면 흐름에서
 * 실제로 동작하는지를 지킨다: 실패가 error 로 나오고, 재시도를 부르면 다시 받아 회복하고,
 * 그동안 마지막 성공 값이 남는다.
 */

function AsyncProbe({ loads }: { loads: (() => Promise<string>)[] }) {
  /* n번째 시도는 loads[n] — 실패 후 재시도가 성공하는 흐름을 짠다.
     (카운터는 렌더 밖에 있어야 한다 — 컴포넌트 지역변수는 렌더마다 0으로 돌아간다) */
  const { data, loading, error, retry } = useAsyncData(() => {
    const load = loads[Math.min(calls.next(loads), loads.length - 1)]
    return load()
  }, [])
  return (
    <div>
      <output aria-label="data">{data ?? '-'}</output>
      <output aria-label="state">{loading ? 'loading' : error ? `error:${error.message}` : 'ok'}</output>
      <button onClick={retry}>다시 시도</button>
    </div>
  )
}

describe('useAsyncData 의 실패 채널', () => {
  it('실패 → error 로 나오고, retry 로 같은 deps 를 다시 받아 회복한다', async () => {
    const user = userEvent.setup()
    render(
      <AsyncProbe
        loads={[async () => Promise.reject(new Error('연결 거부')), async () => '회복값']}
      />
    )

    expect(await screen.findByText('error:연결 거부')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('ok')).toBeInTheDocument()
    expect(screen.getByLabelText('data')).toHaveTextContent('회복값')
  })

  it('Error 아닌 던짐도 Error 로 접는다', async () => {
    render(<AsyncProbe loads={[async () => Promise.reject('문자열')]} />)
    expect(await screen.findByText('error:문자열')).toBeInTheDocument()
  })
})

describe('useLiveStore 의 실패 채널', () => {
  it('실패해도 마지막 성공 값·시각이 화면에 남는다 — "언제까지는 받았다"를 말할 근거', () => {
    let publisher: LivePublisher<string> | null = null
    const store = createLiveStore<string>((p) => {
      publisher = p
      return { stop() {}, refresh() {} }
    })

    function LiveProbe() {
      const live = useLiveStore(store)
      return (
        <div>
          <output aria-label="data">{live.data ?? '-'}</output>
          <output aria-label="state">{live.status}</output>
          <output aria-label="last">{live.lastSuccessAt ?? '-'}</output>
        </div>
      )
    }
    render(<LiveProbe />)
    expect(screen.getByLabelText('state')).toHaveTextContent('loading')

    act(() => publisher!.publish('첫값', 1_000))
    expect(screen.getByLabelText('data')).toHaveTextContent('첫값')
    expect(screen.getByLabelText('state')).toHaveTextContent('ready')

    act(() => publisher!.fail(new Error('망 끊김'), 2_000))
    expect(screen.getByLabelText('state')).toHaveTextContent('error')
    /* 값과 마지막 성공 시각은 지워지지 않는다 */
    expect(screen.getByLabelText('data')).toHaveTextContent('첫값')
    expect(screen.getByLabelText('last')).toHaveTextContent('1000')
  })
})
