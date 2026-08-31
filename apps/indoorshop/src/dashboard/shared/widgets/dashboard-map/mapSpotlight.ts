/*
 * 대시보드 지도의 **계층 선택 상태**와 그로부터 나오는 지도 스포트라이트.
 *
 * 선택은 공정 → 공장 → 작업 위치 세 단계다
 * (`docs/PRD_전체현황_공정존_베이_드릴다운_개선.md` FR-2). 상위 선택이 바뀌면 그 아래
 * 선택은 즉시 사라져야 하는데, 그 규칙을 화면 여기저기의 setState 에 흩어 두면 한 곳만
 * 고치고 다른 곳을 잊는다. 그래서 전이를 전부 이 파일의 **순수 함수**로 모으고 화면은
 * 그것을 부르기만 한다 — 단위 테스트 대상.
 *
 * 스포트라이트는 조립공장뷰 PRD FR-5 의 강조 문법을 지도에 옮긴 것이다: 공장 하나를
 * 고르면 그 공장만 밝히고 나머지를 전부 가라앉히는 대신 **그 공장의 공정도 함께**
 * 켠다 — 고른 공장은 가장 진하게('selected'), 같은 공정의 다른 공장은 네온('on')으로
 * 남아 "동일 공정이 어디인지" 보이고, 무관 공정만 가라앉는다('dim').
 */

/**
 * 대시보드 지도의 선택.
 *
 * 공정 하나(카드 헤더 클릭) 또는 공장 하나(지도/목록 클릭)이며, 공장을 고른 상태에서
 * 그 공장 안의 작업 위치(조립: 베이·정반)를 고르면 `location` 으로 한 단계 더 들어간다.
 */
export type DashboardMapSelection =
  | {
      kind: 'factory'
      name: string
      location?: string | null
      /**
       * 지도에서 고른 **베이**(`YardParcelBay.id`). 작업 위치(`location`)와 형제다 —
       * 목록에서 정반을 고르는 것과 지도에서 베이를 누르는 것은 같은 깊이의 선택이라
       * 둘이 동시에 켜져 있으면 카드가 무엇을 말하는지 모호해진다. 그래서 서로를 끈다.
       */
      bay?: string | null
    }
  | { kind: 'process'; process: string }
  | null

export interface MapSpotlight {
  focusedFactory: string | null
  focusedProcess: string | null
}

export function mapSpotlight(
  selection: DashboardMapSelection,
  processOfFactory: (name: string) => string | null
): MapSpotlight {
  if (!selection) return { focusedFactory: null, focusedProcess: null }
  if (selection.kind === 'process') {
    return { focusedFactory: null, focusedProcess: selection.process }
  }
  return { focusedFactory: selection.name, focusedProcess: processOfFactory(selection.name) }
}

/**
 * 공정 카드 헤더 클릭 — 같은 공정을 다시 누르면 해제(토글).
 *
 * 공정을 고르면 그 아래 공장·작업 위치 선택은 남지 않는다: 이 전이는 언제나
 * `{kind:'process'}` 를 내므로 하위 선택을 **구조적으로** 들고 있을 수 없다 (FR-2).
 */
export function selectProcess(
  selection: DashboardMapSelection,
  process: string
): DashboardMapSelection {
  if (selection?.kind === 'process' && selection.process === process) return null
  return { kind: 'process', process }
}

/**
 * 공장 클릭(지도·목록 공통) — 공장이 바뀌면 이전 공장의 작업 위치 선택을 버린다.
 *
 * 같은 공장을 다시 누르는 것은 선택 유지다(작업 위치까지 골라 둔 상태에서 공장 이름을
 * 다시 눌렀다고 그 아래가 날아가면, 목록에서 위치를 훑는 동작이 매번 초기화된다).
 */
export function selectFactory(
  selection: DashboardMapSelection,
  name: string | null
): DashboardMapSelection {
  if (name == null) return null
  if (selection?.kind === 'factory' && selection.name === name) return selection
  return { kind: 'factory', name }
}

/**
 * 고른 공장 안의 작업 위치 선택 — 같은 것을 다시 누르면 해제(토글).
 * 공장 선택이 없으면(공정만 골랐거나 무선택) 작업 위치만 고를 수 없으므로 그대로 둔다.
 */
export function selectLocation(
  selection: DashboardMapSelection,
  locationId: string | null
): DashboardMapSelection {
  if (selection?.kind !== 'factory') return selection
  if (locationId == null || selection.location === locationId) {
    return { ...selection, location: null, bay: null }
  }
  return { ...selection, location: locationId, bay: null }
}

/**
 * 지도에서 고른 공장 안의 **베이** 선택 — 같은 베이를 다시 누르면 해제(토글).
 *
 * 이 전이는 **화면 이동을 부르지 않는다.** 지도의 베이를 한 번 누르는 것은 "이걸 보겠다"
 * 이지 "여기서 나가겠다"가 아니다 — 베이의 지번·설명이 카드에 펼쳐지고, 공정 상세로
 * 들어가는 것은 카드 안의 명시적인 링크와 **같은 베이의 재클릭**(`bayClickIntent`)이 맡는다.
 *
 * 공장 선택이 없으면(공정만 골랐거나 무선택) 베이만 고를 수 없으므로 그대로 둔다.
 */
export function selectBay(
  selection: DashboardMapSelection,
  bayId: string | null
): DashboardMapSelection {
  if (selection?.kind !== 'factory') return selection
  if (bayId == null || selection.bay === bayId) return { ...selection, bay: null }
  return { ...selection, bay: bayId, location: null }
}

/**
 * 지도의 베이 클릭 한 번이 무엇을 뜻하는가 — **고르기**인가 **들어가기**인가.
 *
 * 첫 클릭은 고르기다(카드가 열린다). 이미 고른 베이를 **한 번 더** 누르는 것은 "이걸
 * 보겠다"를 넘어 "여기로 가겠다"이므로 그때는 공정 상세로 들어간다 — 카드 안의 링크를
 * 찾아 누르지 않아도 되고, 지도에서 훑어보는 동작(첫 클릭)은 그대로 남는다
 * (PRD §5.3 "1회 클릭은 선택, 재활성화로 이동").
 *
 * 갈 곳이 없는 베이(지번이 겹치는 작업 위치가 없어 `detailPath` 가 null)는 두 번째
 * 클릭이 지금까지처럼 선택 해제다 — 아무 일도 일어나지 않는 클릭을 만들지 않는다.
 */
export type BayClickIntent =
  /** 선택 상태만 바꾼다 (첫 클릭, 또는 갈 곳 없는 베이의 재클릭 = 해제) */
  | { kind: 'select'; selection: DashboardMapSelection }
  /** 이미 고른 베이의 재클릭 — 공정 모듈이 준 경로로 나간다 */
  | { kind: 'open'; path: string }

export function bayClickIntent(
  selection: DashboardMapSelection,
  bayId: string,
  /** 이 베이와 지번이 겹치는 작업 위치의 상세 경로. 없으면 null */
  detailPath: string | null
): BayClickIntent {
  if (
    detailPath &&
    selection?.kind === 'factory' &&
    selection.bay === bayId
  ) {
    return { kind: 'open', path: detailPath }
  }
  return { kind: 'select', selection: selectBay(selection, bayId) }
}
