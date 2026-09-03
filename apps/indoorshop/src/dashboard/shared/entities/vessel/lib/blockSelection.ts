import { blocksOfVessel, findBlock, findVessel } from './roster'
import type { RosterBlock } from '../model/types'

/**
 * 호선·블록 선택의 화면 간 승계 — "옮길 때마다 다시 고르는" 일을 없앤다.
 *
 * 두 겹으로 잇는다:
 *
 *  1. **딥링크** `?vessel=7004&block=222,310` — 링크를 누르는 쪽이 무엇을 보고 있었는지
 *     URL 에 적는다. 북마크·새 탭·새로고침에도 살아 있는 **계약**이며, 야드·대시보드가
 *     이미 쓰는 `?shop=`·`?factory=` 문법과 같은 자리에 붙는다.
 *  2. **직전 선택(sticky)** — 사이드바로 그냥 `/performance` 를 눌러 들어오는 것처럼
 *     링크에 조건을 실을 수 없는 경로를 위해, 마지막으로 조회한 선택을 한 칸 기억한다.
 *
 * 우선순위는 **URL > 직전 선택 > 없음**. URL 이 있으면 그것이 사용자의 명시적 의사다.
 *
 * `cameraHandoff` 와 다른 점 — 카메라는 링크 클릭 ~ 다음 화면 마운트 사이만 사는
 * 1회성 TTL 슬롯이지만, 선택은 **세션 동안 계속 유효**하다(대시보드 → 조립 → 다시
 * 통합실적처럼 여러 화면을 거쳐 돌아와도 살아 있어야 한다). 그래서 TTL 도 1회성도 없다.
 * 모듈 상태이므로 새로고침하면 자연히 사라진다 — 그때는 URL 이 유일한 근거다.
 *
 * URL·히스토리를 이 모듈이 직접 건드리지 않는다 (`cameraHandoff` 와 같은 이유).
 */

export interface BlockSelection {
  projNo: string
  /** 고른 블록번호. **빈 배열이면 '그 호선 전체'** — 통합실적 필터의 규칙 그대로다 */
  blocks: string[]
  /**
   * 포커스할 ASSY_NO 들 — 통합실적이 조립 트리에서 이것들을 강조하고 첫 번째로 스크롤한다.
   * 지도 ASSY 마커처럼 **자리 하나에 여러 ASSY** 가 묶이는 자리가 있어서 배열이다.
   * 비면 블록 레벨 진입(종전 동작).
   */
  assys?: string[]
}

/** 딥링크 파라미터 이름 — 화면이 직접 문자열을 적지 않도록 여기서 정한다 */
export const SELECTION_PARAMS = { vessel: 'vessel', block: 'block', assy: 'assy' } as const

/**
 * ASSY_NO 조합식 해석 — `PROJ-BLK-STRC+SER` (예: `2543-642-G01`).
 *
 * 실적 생성기가 이 조합식으로 번호를 만들고 로스터의 ASSY 소재도 같은 문자열을 쓰므로,
 * ASSY 번호 하나만 있어도 **어느 호선 어느 블록인지**가 나온다 — `?assy=` 딥링크가
 * `?vessel=`·`?block=` 없이도 자립하는 근거다. 엔티티가 실적 생성기를 부를 수는 없으니
 * (모듈 경계) 검증은 조합식 + 로스터까지만 한다.
 */
export function parseAssyNo(assyNo: string): { projNo: string; blockNo: string } | null {
  const parts = assyNo.trim().split('-')
  if (parts.length < 3) return null
  const [projNo, blockNo] = parts
  if (!projNo || !blockNo || !parts.slice(2).join('-')) return null
  return { projNo, blockNo }
}

let sticky: BlockSelection | null = null

/**
 * 조회를 굳힌 화면이 그 선택을 남긴다.
 * ASSY 포커스는 **남기지 않는다** — 한 번 본 ASSY 가 다음 진입까지 따라오면 사용자가
 * 고르지도 않은 강조가 계속 살아난다. 포커스는 그 링크 한 번의 의사다.
 */
export function rememberSelection(selection: BlockSelection): void {
  sticky = { projNo: selection.projNo, blocks: [...selection.blocks] }
}

/** 마지막으로 남긴 선택 (없으면 null). 읽어도 지워지지 않는다 */
export function recallSelection(): BlockSelection | null {
  return sticky ? { projNo: sticky.projNo, blocks: [...sticky.blocks] } : null
}

/** 화면의 '초기화' + 테스트 격리 */
export function clearSelection(): void {
  sticky = null
}

/**
 * 딥링크 파라미터 해석 — **로스터에 없는 값은 버린다.**
 *
 * 없는 호선이면 통째로 null (있지도 않은 조건으로 화면을 열지 않는다). 블록은 그 호선에
 * 속한 것만 남기며, 하나도 안 남으면 '호선 전체'(빈 배열)로 떨어진다 — 오래된 링크가
 * 빈 화면 대신 그 호선 전체를 보여 주는 쪽이 낫다.
 */
export function parseSelectionParams(params: URLSearchParams): BlockSelection | null {
  /* `?assy=` 는 자립한다 — 조합식이 호선·블록을 품고 있어 vessel/block 없이도 열린다.
     여러 개면 **같은 블록의 것만** 남긴다(자리 하나에 묶인 ASSY 들이라 원래 같은 블록이다). */
  const assyParam = (params.get(SELECTION_PARAMS.assy) ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
  const assyHome = assyParam.map(parseAssyNo).find((h) => h != null && findBlock(h.projNo, h.blockNo))
  if (assyHome) {
    const assys = [
      ...new Set(
        assyParam.filter((a) => {
          const home = parseAssyNo(a)
          return home?.projNo === assyHome.projNo && home.blockNo === assyHome.blockNo
        })
      ),
    ]
    return { projNo: assyHome.projNo, blocks: [assyHome.blockNo], assys }
  }

  const projNo = params.get(SELECTION_PARAMS.vessel)?.trim()
  if (!projNo || !findVessel(projNo)) return null

  const known = new Set(blocksOfVessel(projNo).map((b) => b.blockNo))
  const blocks = (params.get(SELECTION_PARAMS.block) ?? '')
    .split(',')
    .map((b) => b.trim())
    .filter((b) => known.has(b))

  return { projNo, blocks: [...new Set(blocks)] }
}

/** 딥링크 쿼리 문자열 (앞의 `?` 없이) — 블록이 없으면 호선만 싣는다 */
export function selectionQuery(selection: BlockSelection): string {
  const params = new URLSearchParams({ [SELECTION_PARAMS.vessel]: selection.projNo })
  if (selection.blocks.length > 0) {
    params.set(SELECTION_PARAMS.block, selection.blocks.join(','))
  }
  if (selection.assys && selection.assys.length > 0) {
    params.set(SELECTION_PARAMS.assy, selection.assys.join(','))
  }
  return params.toString()
}

/**
 * **ASSY 포커스 딥링크** — "이 ASSY 의 실적 보기".
 *
 * 지도 ASSY 마커·검색 결과의 자리 줄이 나가는 자리다. 조합식에서 호선·블록을 뽑아
 * 블록 조회까지 함께 실으므로, 도착한 화면이 조회를 한 번 더 하지 않는다.
 * 로스터에 없는 블록의 ASSY 면 null — 갈 곳 없는 링크를 만들지 않는다.
 */
export function assyFocusLinkFor(assyNos: readonly string[]): string | null {
  const home = assyNos.map(parseAssyNo).find((h) => h != null && findBlock(h.projNo, h.blockNo))
  if (!home) return null
  return performanceLinkFor({ projNo: home.projNo, blocks: [home.blockNo], assys: [...assyNos] })
}

/** 통합실적 딥링크 — 대시보드·공정 화면이 "이 블록의 실적 보기"로 나가는 자리 */
export function performanceLinkFor(selection: BlockSelection): string {
  return `/performance?${selectionQuery(selection)}`
}

/** 로스터 블록 하나를 그대로 선택으로 (공정 화면 → 통합실적 링크의 재료) */
export function selectionOfBlock(block: Pick<RosterBlock, 'projNo' | 'blockNo'>): BlockSelection {
  return { projNo: block.projNo, blocks: [block.blockNo] }
}

/**
 * 화면 진입 시 무엇을 조회할지 — URL 이 있으면 URL, 없으면 직전 선택, 둘 다 없으면 null.
 *
 * 반환값이 null 이면 화면은 지금까지처럼 "호선을 먼저 고르세요" 자리에 선다.
 */
export function resolveEntrySelection(params: URLSearchParams): BlockSelection | null {
  return parseSelectionParams(params) ?? recallSelection()
}
