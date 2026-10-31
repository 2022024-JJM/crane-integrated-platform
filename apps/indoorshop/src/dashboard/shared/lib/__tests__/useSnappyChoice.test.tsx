import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSnappyChoice } from '../useSnappyChoice'

describe('useSnappyChoice', () => {
  it('누른 값이 곧바로 선택으로 서고, 내용 값도 그 값을 따라간다', () => {
    const { result } = renderHook(({ url }) => useSnappyChoice(url), { initialProps: { url: 'status' } })
    act(() => result.current.choose('performance'))
    expect(result.current.selected).toBe('performance')
    expect(result.current.shown).toBe('performance')
  })

  it('주소가 바뀌면(뒤로가기·링크) 들고 있던 값을 버리고 주소를 따른다', () => {
    const { result, rerender } = renderHook(({ url }) => useSnappyChoice(url), { initialProps: { url: 'status' } })
    act(() => result.current.choose('performance'))
    rerender({ url: 'blocks' })
    expect(result.current.selected).toBe('blocks')
  })
})
