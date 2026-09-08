import { listBlocks } from '../../../entities/vessel'
import {
  generateAssyUnits,
  generatePaintingSteps,
} from '../../performance/api/performanceApi'
import { nowDate } from '../../../lib/now'

/*
 * W/O 번호 → 블록 색인 — "이 작업지시가 어느 블록 것인가"를 거꾸로 찾는다.
 *
 * W/O 번호는 어디에도 표로 적혀 있지 않다 — 통합실적 mock 이 블록·스텝 시드에서
 * **결정론적으로** 만들어 낸다(같은 블록·같은 기준일이면 언제나 같은 번호). 그래서
 * 로스터 전 블록의 조립·도장 실적을 한 번 생성해 번호를 긁어모으면, 화면이 보여 줄
 * 번호와 정확히 같은 집합이 된다. 생성기를 **읽기만** 하고 손대지 않는다.
 *
 * 실연동 시 이 파일은 W/O 검색 API 호출로 몸통만 바뀐다 — 소비자(검색)는 그대로다.
 *
 * 비용: 로스터 30여 블록 × 해시 생성이라 수십 ms 다. 그래도 팔레트가 뜰 때마다 낼
 * 값은 아니라서 기준일 단위로 캐시한다(기준일이 바뀌면 번호도 바뀐다 — 캐시 키).
 */

export interface WoEntry {
  /** 작업지시 번호 (WO-#####) */
  woNo: string
  projNo: string
  blockNo: string
  /** 이 번호가 나온 실적 축 — 결과 줄이 "어느 공정의 W/O 인지" 말할 수 있게 */
  source: 'assembly' | 'painting'
}

/** 통합실적 화면과 같은 기준일 문법 (PerformancePage 의 것과 동일 — 로컬 자정 기준) */
export function todayString(now: Date = nowDate()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

let cache: { baseDate: string; entries: WoEntry[] } | null = null

/**
 * 기준일의 W/O 전체 — 로스터 블록의 조립 W/O(매칭 캐스케이드가 붙인 것)와
 * 도장 스텝 대표 W/O. 같은 (번호, 블록, 축) 조합은 한 번만 남긴다.
 */
export function woEntriesOf(baseDate: string): readonly WoEntry[] {
  if (cache?.baseDate === baseDate) return cache.entries

  const entries: WoEntry[] = []
  const seen = new Set<string>()
  const push = (entry: WoEntry) => {
    const key = `${entry.woNo}|${entry.projNo}-${entry.blockNo}|${entry.source}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push(entry)
  }

  for (const block of listBlocks()) {
    const assembly = generateAssyUnits(block.projNo, block.blockNo, baseDate)
    for (const assy of assembly.assys) {
      for (const wo of assy.match.wos) {
        push({ woNo: wo.woNo, projNo: block.projNo, blockNo: block.blockNo, source: 'assembly' })
      }
    }
    const painting = generatePaintingSteps(block.projNo, block.blockNo, baseDate)
    for (const step of painting.steps) {
      push({ woNo: step.woNo, projNo: block.projNo, blockNo: block.blockNo, source: 'painting' })
    }
  }

  cache = { baseDate, entries }
  return entries
}
