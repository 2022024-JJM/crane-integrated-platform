import {
  blocksOfVessel,
  findBlock,
  findVessel,
  parseSelectionParams,
  SELECTION_PARAMS,
  type RosterBlock,
} from '../../../entities/vessel'
import type { YardBackdropBlock } from '../../../model/yardMapBackdrop'

/*
 * 검색 결과 → **총괄 지도가 무엇을 비추는가**. 주소가 그 상태의 정본이다.
 *
 * 예전에는 지도의 검색 표시가 화면 안 `useState` 였다 — 그래서 팔레트(Cmd+K)에서 블록을
 * 골라도 지도까지 전달할 길이 없었고, 새로고침하면 표시가 사라졌으며, 링크로 건네면
 * 상대는 빈 지도를 봤다. 표시를 주소로 올리면 그 셋이 한꺼번에 풀린다.
 *
 * **철자는 통합실적의 선택 계약 그대로다**(`?vessel=&block=&assy=`) — 지도와 실적이 같은
 * 조회 조건을 같은 이름으로 말하므로, 두 화면을 오갈 때 조건이 살아 있고 새 문법을
 * 배울 것도 없다. 드릴다운(`?process=&factory=&bay=`)과는 키가 겹치지 않아 공존한다.
 *
 * 해석은 **2단**이다. 로스터가 아는 블록이면 로스터가 답하고(생애 단계를 알기 때문에
 * 자리를 여럿 찍을 수 있다), 모르는 블록이면 야드 BTS 색인으로 물러나 점 하나를 찍는다.
 * 야드 전용 파라미터를 따로 만들지 않은 이유다 — 같은 질문의 답을 두 원천이 나눠 가질
 * 뿐, 묻는 말은 하나다.
 */

/** 지도가 비추는 대상 — 마커·카메라·카드가 전부 이것 하나를 읽는다 */
export interface MapFocus {
  /** 자리를 찍을 재공 블록들. **호선 결과면 그 호선 전부**가 여기 담긴다 */
  blocks: readonly RosterBlock[]
  /** 로스터가 모르는 BTS 실측 위치 (야드 색인에서만 찾힌 블록) */
  yard: YardBackdropBlock | null
  /** ASSY 포커스 — 있으면 그 덩이의 자리만 비춘다 */
  assys: readonly string[]
  /** 카드·마커에 적는 이름 — `7004호` · `7004-222` */
  label: string
  /** 이 포커스가 어떤 결과에서 왔는가 — 카드가 문장을 고르는 근거 */
  kind: 'vessel' | 'block' | 'yard'
}

/** 이 포커스를 지우는 주소 (검색 표시만 걷고 드릴다운·기준일 등 나머지는 남긴다) */
export function clearMapFocusSearch(source: URLSearchParams | string): string {
  const next = new URLSearchParams(typeof source === 'string' ? source : source.toString())
  for (const key of Object.values(SELECTION_PARAMS)) next.delete(key)
  const query = next.toString()
  return query ? `?${query}` : ''
}

/**
 * 주소에서 지도 포커스를 읽는다. 아무것도 없으면 null — 지도는 평소 모습으로 선다.
 *
 * 야드 색인은 배경과 함께 늦게 오므로(`null` 인 동안), 로스터가 모르는 블록의 링크로
 * 들어오면 색인이 도착한 뒤에야 점이 선다. 그동안 빈 화면을 보이는 대신 그냥 포커스가
 * 없는 것으로 친다 — 잘못된 자리를 먼저 찍는 것보다 낫다.
 */
export function parseMapFocus(
  params: URLSearchParams,
  yardIndex: readonly YardBackdropBlock[] | null
): MapFocus | null {
  const selection = parseSelectionParams(params)

  if (selection) {
    /* 블록을 고르지 않았다 = 그 호선 전부 (선택 계약의 '빈 배열 = 호선 전체' 규칙) */
    if (selection.blocks.length === 0) {
      const blocks = blocksOfVessel(selection.projNo)
      if (blocks.length === 0) return null
      return {
        blocks,
        yard: null,
        assys: [],
        label: `${selection.projNo}호`,
        kind: 'vessel',
      }
    }

    const blocks = selection.blocks
      .map((blockNo) => findBlock(selection.projNo, blockNo))
      .filter((block): block is RosterBlock => block != null)
    if (blocks.length === 0) return null
    return {
      blocks,
      yard: null,
      assys: selection.assys ?? [],
      label:
        blocks.length === 1
          ? `${blocks[0].projNo}-${blocks[0].blockNo}`
          : `${selection.projNo}호`,
      kind: 'block',
    }
  }

  /* 로스터가 모르는 블록 — 야드 BTS 색인으로 물러난다 */
  const projNo = params.get(SELECTION_PARAMS.vessel)?.trim()
  const blkNo = params.get(SELECTION_PARAMS.block)?.trim()
  if (!projNo || !blkNo || findVessel(projNo)) return null
  const yard = yardIndex?.find((block) => block.projNo === projNo && block.blkNo === blkNo)
  if (!yard) return null
  return {
    blocks: [],
    yard,
    assys: [],
    label: `${yard.projNo}-${yard.blkNo}`,
    kind: 'yard',
  }
}
