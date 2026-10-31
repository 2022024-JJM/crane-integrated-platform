/*
 * 공정 색 **시안** — 야드 맵의 공정 색(조립·도장·의장·가공)을 여러 벌로 갈아 보며 비교하는
 * 저장소(사용자 요청: 상단 버튼으로 시안 전환). `colorOfProcess` 가 지금 고른 시안을 먼저
 * 읽으므로, 시안을 바꾸면 지도·카드·목록의 공정 색이 함께 바뀐다.
 *
 * 고른 시안은 이 브라우저에 남긴다(localStorage) — 새로 고쳐도 보던 시안 그대로다. 저장소를
 * 못 쓰면 이 탭의 메모리로만 기억한다. 시안에 없는 공정(PE·탑재 등)은 기본 색표를 쓴다.
 */

export interface ProcessPalette {
  id: string
  /** 버튼에 적는 짧은 이름 */
  label: string
  /** 시안 설명 — 툴팁 */
  description: string
  colors: Readonly<Record<'조립' | '도장' | '의장' | '가공', string>>
}

export const PROCESS_PALETTES: readonly ProcessPalette[] = [
  {
    id: 'base',
    label: '기본',
    description: '현재 배색 (painting 뷰어 원본)',
    colors: { 조립: '#2a78d6', 도장: '#e87ba4', 의장: '#eb6834', 가공: '#1baf7a' },
  },
  /* 옅은 시안(사용자 요청: 진한 공정색이 어두운 지도 위에서 눈이 아프다) — 채도를 낮추고 밝기를
     올려 지도 위에서 덜 쏘게 하되, 네 공정은 색상환에서 떨어뜨려 서로는 갈리게 한다 */
  {
    id: 'softpop',
    label: '시안1',
    description: '팝 배색을 옅게 — 라벤더 · 연하늘 · 피치 · 연두. 공정끼리 가장 잘 갈린다',
    colors: { 조립: '#c4a6f5', 도장: '#9fe3ef', 의장: '#f9b98a', 가공: '#c2e59a' },
  },
  /* 현장에서 실제로 보이는 색을 따온 시안 — 업계 표준 공정색은 없으므로 현장 사람이 바로 떠올릴
     색을 고른다. 도장 적갈은 경보 빨강과 겹치지 않게 채도를 눌렀다 */
  {
    id: 'field',
    label: '시안2',
    description: '현장 실물 색 — 용접 아크 · 방오도료 적갈 · 해수 배관 · 숍프라이머',
    colors: { 조립: '#6fa8dc', 도장: '#c98466', 의장: '#6cbf8a', 가공: '#9aa8b6' },
  },
  /* 현장색을 네 색 모두 채도 40%(HSL)로 맞춘 시안 — 숍프라이머 적갈 · 용접 아크 청백 · 배관 초록 ·
     밸러스트 도료 베이지. 한 색만 튀지 않게 한다. 베이지는 흰 하이라이트 테와 붙어 보여 밝기를
     58%로 눌러 모래색 쪽으로 옮겼다 */
  {
    id: 'field-even',
    label: '시안3',
    description: '채도를 맞춘 현장색 — 적갈 · 청백 · 초록 · 베이지',
    colors: { 조립: '#9bb8d4', 도장: '#bfa269', 의장: '#77c598', 가공: '#c58b77' },
  },
]

const STORAGE_KEY = 'otd:process-palette'

/*
 * 시안을 고르는 버튼(야드 맵 오른쪽 위)은 걷었다(사용자 확정) — 이제 모두 **기본 시안**으로 선다.
 * 예전에 이 브라우저에 남긴 선택은 읽지 않는다. 고를 문이 없는데 옛 선택이 남아 있으면 사람마다
 * 다른 색을 보게 되고 되돌릴 방법도 없다. 시안 목록 · `setProcessPalette` 는 남겨 둔다(다시 열 때 쓴다).
 */
let activeId: string = 'base'
const listeners = new Set<() => void>()

/** 지금 고른 시안 */
export function activeProcessPalette(): ProcessPalette {
  return PROCESS_PALETTES.find((p) => p.id === activeId) ?? PROCESS_PALETTES[0]
}

/** 지금 고른 시안의 id — 구독용 */
export function activeProcessPaletteId(): string {
  return activeProcessPalette().id
}

/** 시안을 고른다 — 구독자(지도 등)가 다시 그린다 */
export function setProcessPalette(id: string): void {
  if (id === activeId || !PROCESS_PALETTES.some((p) => p.id === id)) return
  activeId = id
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* 저장소를 못 쓰면 이 탭의 메모리로만 기억한다 */
  }
  for (const listener of listeners) listener()
}

export function subscribeProcessPalette(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
