/*
 * 실측 블록이 **스캔에서 얻을 수 없는 기준정보** — 송선기호와 하위 구성(소조·부재 수).
 *
 * 스캔은 "지금 이 형상이 거기 있다"까지만 말한다. 송선기호(WSTG_CODE)는 레거시 기준정보의
 * 값이고, 소조 계층·부재 수는 FBX 노드 트리에서 나오는 값인데 실측 자산은 블록당 메시
 * 하나로 구워져 있어 트리가 없다(W9-0 진단 §5 — 자산 재생성 없이는 진짜 계층을 못 만든다).
 *
 * 그 두 축이 비면 상세 카드에서 송선 줄과 구성 목록이 통째로 사라져, 같은 화면의 목업
 * 블록과 **다른 문법**이 된다. 그래서 목업과 같은 결정론 해시로 채운다 — 값은 mock 이지만
 * 축의 존재는 계약이다(진척·계획을 mock 으로 채운 것과 같은 판단).
 *
 * 실연동 시 이 파일의 두 함수만 레거시 조회로 갈아끼우면 되고, 화면은 손대지 않는다.
 */

/** 문자열 결정론 해시 — 목업(`mockDetections`)·실측 씬과 같은 문법 */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 송선기호 4자리 — 앞 2자리가 현공정, 뒤 2자리가 다음공정이다(`parseWstgCode` 계약).
 *
 * 실제 CAD 매니페스트에서 관측되는 표기를 그대로 쓴다: 현공정은 부재 계열
 * (`C1`·`S6`·`P1`·`P2`·`B3`·`D2`), 다음공정은 조립 데모 블록이 전부 `G9`(대조립) 이다.
 * 없는 기호를 지어내면 화면이 파싱은 하되 현장에서 읽을 수 없는 값이 된다.
 */
const CURRENT_STAGE_CODES = ['C1', 'S6', 'P1', 'P2', 'B3', 'D2'] as const
const NEXT_STAGE_CODE = 'G9'

export function realWstgCode(blockName: string): string {
  const stage = CURRENT_STAGE_CODES[hashOf(`${blockName}-wstg`) % CURRENT_STAGE_CODES.length]
  return `${stage}${NEXT_STAGE_CODE}`
}

/** 하위 구성 한 줄 — 화면이 소조 id·송선·부재 수로 읽는다 */
export interface RealBlockPart {
  id: string
  wstgCode: string
  partCount: number
}

/**
 * 하위 구성(소조) — 블록당 3~6건, 각 4~21 부재.
 *
 * id 는 블록의 조립번호에 순번을 붙여 만든다(`FR103C-S1`) — 목업의 소조 id(`BL31A`)처럼
 * 그 블록 안에서만 뜻이 있는 이름이라, 블록 이름을 접두사로 두면 목록에서 어느 블록의
 * 것인지 읽힌다.
 */
export function realBlockParts(blockName: string): RealBlockPart[] {
  const tail = blockName.split('_').slice(2).join('_') || blockName
  const count = 3 + (hashOf(`${blockName}-parts`) % 4)
  return Array.from({ length: count }, (_, index) => ({
    id: `${tail}-S${index + 1}`,
    wstgCode: realWstgCode(`${blockName}-${index}`),
    partCount: 4 + (hashOf(`${blockName}-${index}-cnt`) % 18),
  }))
}
