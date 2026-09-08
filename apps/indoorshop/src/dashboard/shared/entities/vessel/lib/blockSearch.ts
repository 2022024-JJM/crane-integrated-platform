import { BLOCKS } from '../model/roster'
import type { RosterBlock } from '../model/types'

/**
 * 로스터 블록 검색 — 대시보드 블록 검색창이 mock 우주를 뒤지는 문법.
 *
 * 질의 정규화는 야드 색인 검색(`filterBlockIndex`)과 **같은 규칙**이다: 공백·대소문자
 * 무시, `-`·`_`·공백을 하나로 본다. 두 색인이 한 입력창을 나눠 쓰므로 규칙이 달라지면
 * 같은 글자에 다른 결과가 나온다.
 *
 * **ASSY_NO 로도 걸린다.** 야드 BTS 위치 색인에는 ASSY 열이 없어 지금까지 지원하지
 * 못했지만, 로스터는 ASSY 소재를 들고 있다 — `222-M02` 로 찾으면 그 ASSY 가 붙은
 * 블록(7004-222)이 나온다. 조립 중인 블록을 찾는 실제 단서가 ASSY 번호일 때가 많다.
 */

/** 질의·색인을 같은 모양으로 — `2540-281` · `2540_281` · `2540 281` 이 같은 말이 된다 */
export function normalizeBlockQuery(text: string): string {
  return text.trim().toLowerCase().replace(/[-_\s]+/g, '_')
}

/** 이 블록이 걸리는 모든 표기 — 호선, 블록, 호선_블록, 그리고 ASSY_NO 들 */
function haystackOf(block: RosterBlock): string[] {
  const keys = [`${block.projNo}_${block.blockNo}`]
  for (const unit of block.assyUnits ?? []) keys.push(normalizeBlockQuery(unit.assyNo))
  return keys
}

/**
 * 로스터에서 질의에 걸리는 블록 — 부분일치, 로스터 순서 그대로(호선 순).
 * 빈 질의는 빈 결과다(입력 전에 목록을 펼치지 않는다).
 */
export function searchRosterBlocks(query: string, limit = 12): RosterBlock[] {
  const q = normalizeBlockQuery(query)
  if (!q) return []
  const hits: RosterBlock[] = []
  for (const block of BLOCKS) {
    if (haystackOf(block).some((key) => key.includes(q))) {
      hits.push(block)
      if (hits.length >= limit) break
    }
  }
  return hits
}

/**
 * 질의에 걸린 ASSY_NO 들 — 결과 줄이 "왜 이 블록이 나왔나"를 말할 수 있게.
 *
 * **호선-블록으로 이미 걸린 질의에는 빈 배열을 낸다.** `7004-222` 로 찾으면 그 블록의
 * ASSY 가 전부 형식상 일치하지만, 그건 나온 이유가 아니라 당연한 부수효과다 — 근거로
 * 내밀면 줄이 노이즈가 된다. ASSY 번호가 **실제 단서였을 때만** 말한다.
 */
export function matchedAssyNos(block: RosterBlock, query: string): string[] {
  const q = normalizeBlockQuery(query)
  if (!q) return []
  if (`${block.projNo}_${block.blockNo}`.includes(q)) return []
  return (block.assyUnits ?? [])
    .filter((unit) => normalizeBlockQuery(unit.assyNo).includes(q))
    .map((unit) => unit.assyNo)
}
