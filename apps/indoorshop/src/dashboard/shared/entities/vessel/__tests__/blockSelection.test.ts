import { beforeEach, describe, expect, it } from 'vitest'
import {
  SELECTION_PARAMS,
  clearSelection,
  parseSelectionParams,
  performanceLinkFor,
  recallSelection,
  rememberSelection,
  resolveEntrySelection,
  selectionOfBlock,
  selectionQuery,
} from '../lib/blockSelection'

const params = (query: string) => new URLSearchParams(query)

/** 화면을 옮겨도 호선·블록 선택이 따라가는지 — "다시 지정해야 한다"를 없애는 계약 */
describe('선택 승계 — 직전 선택(sticky)', () => {
  beforeEach(clearSelection)

  it('남긴 선택을 그대로 돌려준다', () => {
    rememberSelection({ projNo: '7004', blocks: ['222', '310'] })
    expect(recallSelection()).toEqual({ projNo: '7004', blocks: ['222', '310'] })
  })

  it('읽어도 지워지지 않는다 — 여러 화면을 거쳐 돌아와도 살아 있다', () => {
    rememberSelection({ projNo: '7004', blocks: ['222'] })
    expect(recallSelection()).toBeTruthy()
    expect(recallSelection()).toBeTruthy()
    expect(recallSelection()).toEqual({ projNo: '7004', blocks: ['222'] })
  })

  it('나중 선택이 이전 것을 덮는다 (1칸 저장소)', () => {
    rememberSelection({ projNo: '7004', blocks: ['222'] })
    rememberSelection({ projNo: '8103', blocks: [] })
    expect(recallSelection()).toEqual({ projNo: '8103', blocks: [] })
  })

  it('초기화하면 비워진다', () => {
    rememberSelection({ projNo: '7004', blocks: ['222'] })
    clearSelection()
    expect(recallSelection()).toBeNull()
  })

  it('복사 격리 — 돌려받은 배열을 고쳐도 저장소가 오염되지 않는다', () => {
    rememberSelection({ projNo: '7004', blocks: ['222'] })
    recallSelection()!.blocks.push('310')
    expect(recallSelection()!.blocks).toEqual(['222'])
  })

  it('넘긴 배열을 나중에 고쳐도 저장된 값은 그대로다', () => {
    const blocks = ['222']
    rememberSelection({ projNo: '7004', blocks })
    blocks.push('310')
    expect(recallSelection()!.blocks).toEqual(['222'])
  })
})

describe('선택 승계 — 딥링크 파라미터', () => {
  beforeEach(clearSelection)

  it('호선+블록을 읽는다', () => {
    expect(parseSelectionParams(params('vessel=7004&block=222,310'))).toEqual({
      projNo: '7004',
      blocks: ['222', '310'],
    })
  })

  it('블록 없이 호선만이면 그 호선 전체(빈 배열)', () => {
    expect(parseSelectionParams(params('vessel=7004'))).toEqual({ projNo: '7004', blocks: [] })
  })

  it('없는 호선이면 null — 있지도 않은 조건으로 화면을 열지 않는다', () => {
    expect(parseSelectionParams(params('vessel=0000&block=222'))).toBeNull()
    expect(parseSelectionParams(params(''))).toBeNull()
  })

  it('그 호선의 블록이 아니면 버린다 (오래된 링크가 남의 블록을 끌고 오지 않는다)', () => {
    expect(parseSelectionParams(params('vessel=7004&block=222,999,105'))).toEqual({
      projNo: '7004',
      blocks: ['222'],
    })
  })

  it('블록이 하나도 안 남으면 호선 전체로 떨어진다 (빈 화면보다 낫다)', () => {
    expect(parseSelectionParams(params('vessel=7004&block=999'))).toEqual({
      projNo: '7004',
      blocks: [],
    })
  })

  it('중복·공백을 정리한다', () => {
    expect(parseSelectionParams(params('vessel=7004&block= 222 , 222 ,310'))).toEqual({
      projNo: '7004',
      blocks: ['222', '310'],
    })
  })

  it('CAD 실측 블록도 딥링크로 조회된다 — 대시보드 정반에서 넘어오는 자리', () => {
    expect(parseSelectionParams(params('vessel=2540&block=281'))).toEqual({
      projNo: '2540',
      blocks: ['281'],
    })
  })
})

describe('선택 승계 — 링크 만들기', () => {
  it('왕복한다 (만든 링크를 다시 읽으면 같은 선택)', () => {
    const selection = { projNo: '7004', blocks: ['222', '310'] }
    expect(parseSelectionParams(params(selectionQuery(selection)))).toEqual(selection)
  })

  it('블록이 없으면 호선만 싣는다', () => {
    expect(selectionQuery({ projNo: '7004', blocks: [] })).toBe(`${SELECTION_PARAMS.vessel}=7004`)
  })

  it('통합실적 경로에 붙는다', () => {
    expect(performanceLinkFor({ projNo: '2540', blocks: ['281'] })).toBe(
      '/performance?vessel=2540&block=281'
    )
  })

  it('로스터 블록 하나를 그대로 선택으로 (공정 화면 → 통합실적 링크의 재료)', () => {
    expect(selectionOfBlock({ projNo: '2540', blockNo: '281' })).toEqual({
      projNo: '2540',
      blocks: ['281'],
    })
  })
})

describe('선택 승계 — 진입 시 우선순위', () => {
  beforeEach(clearSelection)

  it('URL 이 직전 선택을 이긴다 (명시적 의사가 먼저)', () => {
    rememberSelection({ projNo: '8103', blocks: ['105'] })
    expect(resolveEntrySelection(params('vessel=7004&block=222'))).toEqual({
      projNo: '7004',
      blocks: ['222'],
    })
  })

  it('URL 이 없으면 직전 선택 — 사이드바로 그냥 들어와도 보던 것이 남는다', () => {
    rememberSelection({ projNo: '8103', blocks: ['105'] })
    expect(resolveEntrySelection(params(''))).toEqual({ projNo: '8103', blocks: ['105'] })
  })

  it('URL 의 호선이 로스터에 없으면 직전 선택으로 떨어진다', () => {
    rememberSelection({ projNo: '8103', blocks: ['105'] })
    expect(resolveEntrySelection(params('vessel=0000'))).toEqual({ projNo: '8103', blocks: ['105'] })
  })

  it('둘 다 없으면 null — 화면은 지금까지처럼 "호선을 먼저 고르세요" 자리에 선다', () => {
    expect(resolveEntrySelection(params(''))).toBeNull()
  })
})
