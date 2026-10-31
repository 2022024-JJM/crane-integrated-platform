import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  activeOf,
  clearSelection,
  parseSelectionParams,
  recallSelection,
  rememberSelection,
  type BlockSelection,
} from '../../../entities/vessel'
import { recordView, setCurrentView, type HistoryZone } from '../../view-history'
import { fetchBlocks, fetchVessels } from '../api/performanceApi'
import type { BlockOption, Vessel } from '../model/types'

/** 한 번에 고를 수 있는 블록 수 — 블록마다 탭이 서므로 그 이상은 탭 줄이 읽히지 않는다(사용자 확정) */
export const MAX_BLOCKS = 10

/** 지금 조회된 조건 — 블록 선택 창에서 '확인' 을 누르는 순간 굳는다 */
export interface BlockQuery {
  projNo: string
  blocks: string[]
}

/**
 * 주소로 들어온 블록을 **지금 열린 탭에 합쳐 연다**(사용자 확정: 히스토리·링크로 온 블록의 탭이 없으면 새로).
 *
 * 같은 호선이면 열린 탭은 그대로 두고 없는 블록만 끝에 더한다. 탭이 `MAX_BLOCKS` 를 넘으면 들어온 블록은
 * 남기고 앞의(오래된) 탭부터 닫는다. 호선이 다르면 들어온 블록들로 새로 선다. 보는 탭은 들어온 쪽이다.
 */
export function openInto(
  base: BlockQuery | null,
  incoming: BlockSelection
): { query: BlockQuery; active: string | null } {
  const blocks = incoming.blocks.slice(0, MAX_BLOCKS)
  const active = activeOf({ blocks, active: incoming.active }) ?? null
  if (!base || base.projNo !== incoming.projNo || base.blocks.length === 0) {
    return { query: { projNo: incoming.projNo, blocks }, active }
  }
  const merged = [...base.blocks]
  for (const b of blocks) if (!merged.includes(b)) merged.push(b)
  while (merged.length > MAX_BLOCKS) {
    const drop = merged.findIndex((b) => !blocks.includes(b))
    if (drop < 0) break
    merged.splice(drop, 1)
  }
  return { query: { projNo: incoming.projNo, blocks: merged }, active }
}

/** 화면이 들어설 때 — 주소에 블록이 있으면 직전 탭에 합쳐 열고, 없으면 주소(호선만) → 직전 선택 */
function entryOf(params: URLSearchParams): { vessel: string; query: BlockQuery | null; active: string | null } {
  const fromUrl = parseSelectionParams(params)
  const sticky = recallSelection()
  if (fromUrl && fromUrl.blocks.length > 0) {
    const base = sticky && sticky.blocks.length > 0 ? { projNo: sticky.projNo, blocks: sticky.blocks } : null
    const opened = openInto(base, fromUrl)
    return { vessel: fromUrl.projNo, ...opened }
  }
  const entry = fromUrl ?? sticky
  if (!entry) return { vessel: '', query: null, active: null }
  /* 블록 없이 호선만 실려 왔으면 호선만 골라 두고 조회는 블록을 고를 때까지 미룬다 */
  if (entry.blocks.length === 0) return { vessel: entry.projNo, query: null, active: null }
  const blocks = entry.blocks.slice(0, MAX_BLOCKS)
  return { vessel: entry.projNo, query: { projNo: entry.projNo, blocks }, active: activeOf({ blocks, active: entry.active }) ?? null }
}

/**
 * 통합실적·공정 [실적] 화면이 함께 쓰는 조회 조건 — 호선 · 블록(복수) · 보고 있는 블록 탭.
 *
 * - 호선을 고르면 블록은 **아무것도 골라져 있지 않다**(사용자 확정) — '블록 선택' 창에서 골라야 조회된다.
 * - 블록은 조회 조건 바의 '블록 선택' 창에서 누를 때마다 탭으로 하나씩 더해진다(최대 `MAX_BLOCKS`).
 * - 고른 블록마다 탭이 서고, 화면은 **지금 탭의 블록 하나만** 그린다(사용자 확정).
 * - 조건과 탭은 `rememberSelection` 한 자리에 남긴다 — 통합실적·가공·조립·의장·도장 어느 화면으로
 *   건너가도 같은 블록들, 같은 탭으로 선다(사용자 확정: 권역 화면 간 블록 탭 싱크).
 *
 * 진입 조건은 주소 → 직전 선택이고, 주소에 블록이 실려 오면 직전 탭에 **합쳐 연다**(`openInto`). 화면에 서 있는
 * 동안 주소가 바뀌어도(같은 화면으로 가는 히스토리·링크) 같은 규칙으로 탭을 더한다.
 */
export function useBlockQuery(
  /** 이 화면의 이름 — 열어 본 블록을 히스토리에 남긴다(헤더의 히스토리 버튼) */
  historyZone?: HistoryZone
) {
  const [searchParams] = useSearchParams()
  /* 진입 시점에 한 번 읽는다 — 이후 조작이 주소에 되밀려 조회를 되돌리지 않도록(주소는 이 훅이 쓰지 않는다) */
  const [entry] = useState(() => entryOf(searchParams))

  const [vessels, setVessels] = useState<Vessel[]>([])
  const [vessel, setVessel] = useState(entry.vessel)
  const [blockOptions, setBlockOptions] = useState<BlockOption[]>([])
  const [query, setQuery] = useState<BlockQuery | null>(entry.query)
  const [activeBlock, setActiveBlock] = useState<string | null>(entry.active)

  /*
   * 화면에 서 있는 동안 주소가 바뀌면(같은 화면으로 가는 히스토리·링크) 그 블록을 탭에 합쳐 연다.
   * 이 훅은 주소를 쓰지 않으므로, 주소가 바뀌었다는 것은 바깥에서 온 이동이다.
   */
  const queryRef = useRef(query)
  queryRef.current = query
  const selectionKey = ['vessel', 'block', 'active', 'assy'].map((k) => searchParams.get(k) ?? '').join('|')
  const lastKey = useRef(selectionKey)
  useEffect(() => {
    if (lastKey.current === selectionKey) return
    lastKey.current = selectionKey
    const incoming = parseSelectionParams(searchParams)
    if (!incoming || incoming.blocks.length === 0) return
    const opened = openInto(queryRef.current, incoming)
    setVessel(incoming.projNo)
    setQuery(opened.query)
    setActiveBlock(opened.active)
    // searchParams 는 렌더마다 새 객체 — 값이 바뀌었는지는 selectionKey 가 말한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey])

  useEffect(() => {
    fetchVessels().then(setVessels)
  }, [])

  useEffect(() => {
    if (!vessel) {
      setBlockOptions([])
      return
    }
    let cancelled = false
    fetchBlocks(vessel).then((blocks) => {
      if (!cancelled) setBlockOptions(blocks)
    })
    return () => {
      cancelled = true
    }
  }, [vessel])

  /* 블록을 열어 보면 히스토리에 남긴다 — 같은 화면·같은 블록은 맨 위로만 올린다 */
  const historyProjNo = query?.projNo
  useEffect(() => {
    if (historyZone && historyProjNo && activeBlock) recordView(historyZone, historyProjNo, activeBlock)
  }, [historyZone, historyProjNo, activeBlock])

  /* 지금 보고 있는 것은 히스토리 목록에서 뺀다 — 탭이 바뀌면 다시 알리고, 화면을 떠나면 지운다 */
  useEffect(() => {
    if (!historyZone) return
    setCurrentView(historyProjNo && activeBlock ? { zone: historyZone, projNo: historyProjNo, blockNo: activeBlock } : null)
    return () => setCurrentView(null)
  }, [historyZone, historyProjNo, activeBlock])

  /* 조건·탭이 바뀔 때마다 남긴다 — 다른 공정 화면으로 건너가도 같은 탭이 선다 */
  useEffect(() => {
    if (query) rememberSelection({ ...query, ...(activeBlock ? { active: activeBlock } : {}) })
  }, [query, activeBlock])

  /* 호선을 고르면 블록 선택을 비운다 — 다른 화면으로 건너가도 호선은 골라진 채로 선다 */
  const onVesselChange = (projNo: string) => {
    setVessel(projNo)
    setQuery(null)
    setActiveBlock(null)
    if (projNo) rememberSelection({ projNo, blocks: [] })
    else clearSelection()
  }

  /**
   * 블록 선택 창의 **확인** — 체크한 블록들이 곧 탭이다(사용자 확정: 체크박스로 고른다). 보던 탭이 남아 있으면
   * 그 탭을 그대로, 빠졌으면 새로 더한 블록 중 첫째(없으면 맨 앞 탭)로 옮긴다. `MAX_BLOCKS` 개까지만 받는다.
   */
  const onBlocksApply = (blocks: string[]) => {
    if (!vessel || blocks.length === 0) return
    const next = blocks.slice(0, MAX_BLOCKS)
    const before = query && query.projNo === vessel ? query.blocks : []
    setQuery({ projNo: vessel, blocks: next })
    setActiveBlock((prev) =>
      prev && next.includes(prev) ? prev : (next.find((b) => !before.includes(b)) ?? next[0])
    )
  }

  /** 블록 탭의 × — 그 블록을 조건에서 뺀다. 보던 탭이면 옆 탭으로, 마지막이면 블록 선택이 빈다 */
  const onBlockClose = (blockNo: string) => {
    if (!query) return
    const index = query.blocks.indexOf(blockNo)
    const blocks = query.blocks.filter((b) => b !== blockNo)
    if (blocks.length === 0) {
      setQuery(null)
      setActiveBlock(null)
      rememberSelection({ projNo: query.projNo, blocks: [] })
      return
    }
    setQuery({ projNo: query.projNo, blocks })
    setActiveBlock((prev) => (prev && prev !== blockNo ? prev : blocks[Math.min(index, blocks.length - 1)]))
  }

  const onReset = () => {
    clearSelection()
    setVessel('')
    setQuery(null)
    setActiveBlock(null)
  }

  return {
    /** 이 화면 — 블록 탭의 즐겨찾기(☆)가 쓴다 */
    zone: historyZone,
    vessels,
    vessel,
    blockOptions,
    query,
    activeBlock,
    setActiveBlock,
    onVesselChange,
    onBlocksApply,
    onBlockClose,
    onReset,
  }
}
