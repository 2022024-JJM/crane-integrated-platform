import { describe, expect, it } from 'vitest'
import { matchedAssyNos, normalizeBlockQuery, searchRosterBlocks } from '../lib/blockSearch'
import { findBlock } from '../lib/roster'

const keys = (query: string) => searchRosterBlocks(query).map((b) => `${b.projNo}-${b.blockNo}`)

describe('로스터 블록 검색 — 질의 정규화', () => {
  it('공백·대소문자·구분자를 같은 말로 본다 (야드 색인 검색과 같은 규칙)', () => {
    expect(normalizeBlockQuery(' 2540-281 ')).toBe('2540_281')
    expect(normalizeBlockQuery('2540_281')).toBe('2540_281')
    expect(normalizeBlockQuery('2540 281')).toBe('2540_281')
    expect(normalizeBlockQuery('7004-222-G01')).toBe('7004_222_g01')
  })

  it('빈 질의는 빈 결과 — 입력 전에 목록을 펼치지 않는다', () => {
    expect(searchRosterBlocks('')).toEqual([])
    expect(searchRosterBlocks('   ')).toEqual([])
  })
})

describe('로스터 블록 검색 — 걸리는 방식', () => {
  it('호선으로 그 호선의 블록이 걸린다', () => {
    const hits = keys('2540')
    expect(hits.length).toBeGreaterThan(1)
    expect(hits.every((k) => k.startsWith('2540-'))).toBe(true)
  })

  it('호선-블록으로 정확히 한 블록', () => {
    expect(keys('2540-281')).toEqual(['2540-281'])
    expect(keys('2540_281')).toEqual(['2540-281'])
  })

  it('ASSY_NO 로도 걸린다 — 조립 중인 블록을 찾는 단서가 ASSY 번호일 때가 많다', () => {
    expect(keys('7004-222-M02')).toEqual(['7004-222'])
    expect(keys('222-M02')).toEqual(['7004-222'])
  })

  it('걸린 ASSY 를 되돌려 준다 — 결과 줄이 "왜 나왔나"를 말할 수 있게', () => {
    const block = findBlock('7004', '222')!
    expect(matchedAssyNos(block, '222-S0')).toEqual([
      '7004-222-S01',
      '7004-222-S02',
      '7004-222-S03',
      '7004-222-S04',
    ])
    expect(matchedAssyNos(block, '222-M02')).toEqual(['7004-222-M02'])
    /* 호선-블록으로 이미 걸린 질의는 ASSY 를 근거로 내밀지 않는다 (당연한 부수효과다) */
    expect(matchedAssyNos(block, '7004-222')).toEqual([])
    expect(matchedAssyNos(block, '222')).toEqual([])
  })

  it('ASSY 소재가 없는 블록은 걸린 ASSY 도 없다 (없는 근거를 지어내지 않는다)', () => {
    expect(matchedAssyNos(findBlock('2540', '286')!, '286')).toEqual([])
  })

  it('없는 블록은 빈 결과', () => {
    expect(keys('9999')).toEqual([])
  })

  it('결과 수를 넘기지 않는다 (드롭다운이 화면을 넘지 않게)', () => {
    expect(searchRosterBlocks('-', 3)).toHaveLength(3)
  })

  it('가공 중인 블록도 검색으로 찾힌다 — 위치가 없다고 없는 블록은 아니다', () => {
    expect(keys('7004-612')).toEqual(['7004-612'])
  })

  it('도장 중인 블록도 찾힌다', () => {
    expect(keys('7012-117')).toEqual(['7012-117'])
  })
})
