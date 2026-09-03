import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useDrilldown } from '../useDrilldown'
import { useDrilldownEscape } from '../useDrilldownEscape'

/*
 * 드릴다운 훅 — URL ↔ 상태 왕복과 **push 히스토리**(뒤로가기 = 드릴아웃)를 본다.
 * 규칙 자체(무엇이 하위를 버리는가)는 순수 테스트(drilldownUrl.test.ts)가 본다.
 */

function wrapperAt(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  }
}

/** 훅과 현재 URL 을 함께 꺼낸다 — 주소가 진짜 바뀌었는지 확인하는 눈.
 *  뒤로가기는 라우터의 navigate(-1) 로 흉내 낸다(MemoryRouter 는 window.history 를 안 쓴다) */
function useHarness() {
  return { drill: useDrilldown(), location: useLocation(), navigate: useNavigate() }
}

describe('useDrilldown — URL 이 원본', () => {
  it('URL 을 읽는다 (옛 철자 shop= 포함)', () => {
    const { result } = renderHook(useHarness, {
      wrapper: wrapperAt('/zones/assembly?shop=GBS&bay=GBS%233BAY'),
    })
    expect(result.current.drill.factory).toBe('GBS')
    expect(result.current.drill.bay).toBe('GBS#3BAY')
    expect(result.current.drill.level).toBe('bay')
  })

  it('go 가 주소를 바꾸고, 다른 쿼리는 그대로 남는다', () => {
    const { result } = renderHook(useHarness, {
      wrapper: wrapperAt('/zones/assembly?assy=X&date=2026-09-03'),
    })
    act(() => result.current.drill.go({ factory: 'GBS' }))
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('factory')).toBe('GBS')
    expect(params.get('assy')).toBe('X')
    expect(params.get('date')).toBe('2026-09-03')
  })

  it('드릴다운이 히스토리를 쌓는다 — 뒤로가기가 드릴아웃이다', () => {
    const { result } = renderHook(useHarness, { wrapper: wrapperAt('/zones/assembly') })

    act(() => result.current.drill.go({ factory: 'GBS' }))
    act(() => result.current.drill.go({ bay: 'GBS#3BAY' }))
    expect(result.current.drill.level).toBe('bay')

    /* 브라우저 뒤로가기 */
    act(() => void result.current.navigate(-1))
    expect(result.current.drill.level).toBe('factory')
    expect(result.current.drill.factory).toBe('GBS')

    act(() => void result.current.navigate(-1))
    expect(result.current.drill.level).toBe('yard')
  })

  it('up 은 한 단계 위로 — 앞으로 쌓으므로(push) 잘못 나왔으면 뒤로가기로 되돌아간다', () => {
    const { result } = renderHook(useHarness, {
      wrapper: wrapperAt('/zones/assembly?factory=GBS&bay=GBS%233BAY'),
    })
    act(() => result.current.drill.up())
    expect(result.current.drill.bay).toBeNull()
    expect(result.current.drill.factory).toBe('GBS')

    act(() => void result.current.navigate(-1))
    expect(result.current.drill.bay).toBe('GBS#3BAY')
  })

  it('최상위에서 up 은 아무 일도 하지 않는다 — 히스토리도 쌓지 않는다', () => {
    const { result } = renderHook(useHarness, { wrapper: wrapperAt('/zones/assembly') })
    const before = result.current.location.key
    act(() => result.current.drill.up())
    expect(result.current.location.key).toBe(before)
  })

  it('같은 자리로의 set 은 히스토리를 쌓지 않는다 — 뒤로가기가 제자리걸음이 되지 않게', () => {
    const { result } = renderHook(useHarness, { wrapper: wrapperAt('/zones/assembly?factory=GBS') })
    const before = result.current.location.key
    act(() => result.current.drill.go({ factory: 'GBS' }))
    expect(result.current.location.key).toBe(before)
  })

  it('reset 은 최상위로 — 자기 키만 지우고 남의 쿼리는 남긴다', () => {
    const { result } = renderHook(useHarness, {
      wrapper: wrapperAt('/zones/assembly?factory=GBS&bay=GBS%233BAY&assy=X'),
    })
    act(() => result.current.drill.reset())
    expect(result.current.location.search).toBe('?assy=X')
  })

  it('hrefFor 가 링크 주소를 낸다 — 브레드크럼 조각이 진짜 <a> 로 선다', () => {
    const { result } = renderHook(useHarness, {
      wrapper: wrapperAt('/zones/assembly?factory=GBS&bay=GBS%233BAY'),
    })
    expect(result.current.drill.hrefFor({ process: null, factory: 'GBS', bay: null })).toBe(
      '/zones/assembly?factory=GBS',
    )
  })
})

describe('useDrilldownEscape — ESC 는 한 단계 위', () => {
  function useEscHarness() {
    const h = useHarness()
    useDrilldownEscape(h.drill.up)
    return h
  }

  it('ESC 가 베이를 걷는다', () => {
    const { result } = renderHook(useEscHarness, {
      wrapper: wrapperAt('/zones/assembly?factory=GBS&bay=GBS%233BAY'),
    })
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(result.current.drill.bay).toBeNull()
    expect(result.current.drill.factory).toBe('GBS')
  })

  it('입력 필드에 포커스가 있으면 삼킨다 — 검색을 지우려던 ESC 가 화면을 접지 않게', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { result } = renderHook(useEscHarness, {
      wrapper: wrapperAt('/zones/assembly?factory=GBS'),
    })
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(result.current.drill.factory).toBe('GBS')
    input.remove()
  })

  it('이미 처리된(ESC 로 닫힌 모달 등) 이벤트는 건드리지 않는다', () => {
    const { result } = renderHook(useEscHarness, {
      wrapper: wrapperAt('/zones/assembly?factory=GBS'),
    })
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      event.preventDefault()
      document.dispatchEvent(event)
    })
    expect(result.current.drill.factory).toBe('GBS')
  })
})
