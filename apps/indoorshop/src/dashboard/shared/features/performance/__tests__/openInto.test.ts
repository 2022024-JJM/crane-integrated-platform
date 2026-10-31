import { describe, expect, it } from 'vitest'
import { MAX_BLOCKS, openInto } from '../lib/useBlockQuery'

describe('openInto — 들어온 블록을 열린 탭에 합쳐 연다', () => {
  it('같은 호선이면 탭은 그대로 두고 없는 블록만 끝에 더해 그 탭으로 선다', () => {
    expect(openInto({ projNo: '7004', blocks: ['222', '310'] }, { projNo: '7004', blocks: ['612'] })).toEqual({
      query: { projNo: '7004', blocks: ['222', '310', '612'] },
      active: '612',
    })
  })

  it('이미 열린 블록이면 탭을 더하지 않고 그 탭으로 옮긴다', () => {
    expect(openInto({ projNo: '7004', blocks: ['222', '310'] }, { projNo: '7004', blocks: ['222'] })).toEqual({
      query: { projNo: '7004', blocks: ['222', '310'] },
      active: '222',
    })
  })

  it('호선이 다르면 들어온 블록으로 새로 선다', () => {
    expect(openInto({ projNo: '7004', blocks: ['222'] }, { projNo: '2540', blocks: ['286'] }).query).toEqual({
      projNo: '2540',
      blocks: ['286'],
    })
  })

  it('탭이 넘치면 들어온 블록은 남기고 오래된 탭부터 닫는다', () => {
    const full = Array.from({ length: MAX_BLOCKS }, (_, i) => String(100 + i))
    const { query, active } = openInto({ projNo: '7004', blocks: full }, { projNo: '7004', blocks: ['999'] })
    expect(query.blocks).toHaveLength(MAX_BLOCKS)
    expect(query.blocks[0]).toBe('101')
    expect(query.blocks.at(-1)).toBe('999')
    expect(active).toBe('999')
  })
})
