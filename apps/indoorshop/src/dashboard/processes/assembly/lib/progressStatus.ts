/**
 * 진척 표현의 색과, 시뮬레이션에서 "어디까지 만들어졌는가"를 정하는 규칙.
 *
 * 중요한 분리:
 *  - `selectCompletedParts` 는 **데이터 쪽**이다. mock 점군을 만들 때 어느 부재까지
 *    실제로 존재하는지(= 정답)를 정한다.
 *  - 뷰어는 이 값을 보지 않는다. 점군과 도면을 대조해 스스로 판정한다(`cadPointMatch`).
 *
 * 이렇게 갈라 두었기 때문에 실측 PCD가 연결되면 판정 코드는 손대지 않는다.
 */

/** 부재 단위 대조 결과 */
export type PartPresence =
  /** 대응 점이 충분하다 — 도면 그대로 그린다 */
  | 'present'
  /** 대응 점이 없거나 형상이 다르다 — 빨강 */
  | 'missing'
  /** 어느 센서에서도 관측되지 않아 판정할 수 없다 — 색을 입히지 않는다 */
  | 'unobservable'

/** 미확인 부재 표시색 — 예약된 위험 색이며 다른 용도로 쓰지 않는다 */
export const MISSING_COLOR_HEX = '#dc2626'
export const MISSING_COLOR = 0xdc2626

/** 미확인 채움 불투명도 (표시 모드별) */
export const MISSING_FILL_OPACITY = {
  cad: 0.45,
  overlay: 0.32,
} as const

/**
 * 시뮬레이션 정답 — 진척률만큼의 부재가 만들어졌다고 본다.
 *
 * 부재를 면적 내림차순으로 정렬한 뒤 앞에서부터 채운다. 큰 판재가 먼저 서고
 * 작은 보강재가 나중에 붙는 실제 조립 순서와 대체로 맞고, 무엇보다 **결정적**이라
 * 씬을 다시 만들어도 같은 정답이 나온다(판정 정확도를 수치로 비교하려면 필수).
 *
 * @param areas 부재별 표면적 (부재 index 순)
 * @param progress 0..1
 * @returns 만들어진 부재 index 집합
 */
export function selectCompletedParts(areas: Float64Array | number[], progress: number): Set<number> {
  const n = areas.length
  const built = new Set<number>()
  if (n === 0) return built

  const ratio = Math.min(1, Math.max(0, progress))
  if (ratio >= 1) {
    for (let i = 0; i < n; i++) built.add(i)
    return built
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => areas[b] - areas[a])
  const take = Math.round(n * ratio)
  for (let i = 0; i < take; i++) built.add(order[i])
  return built
}

/**
 * detection 의 진척률(0..1).
 * 하위 구성(소조)이 있으면 그 작업 상태로, 없으면 인식 히스토리의 마지막 진척률로 본다.
 */
export function detectionProgress(block: {
  subAssemblies?: { workStatus: string; progress?: number }[]
  history?: { progress?: number }[]
}): number {
  const subs = block.subAssemblies
  if (subs && subs.length > 0) {
    const total = subs.reduce((sum, s) => {
      if (s.workStatus === 'completed') return sum + 1
      if (s.workStatus === 'in_progress') return sum + (s.progress ?? 0) / 100
      return sum
    }, 0)
    return total / subs.length
  }

  const withProgress = block.history?.filter((h) => typeof h.progress === 'number') ?? []
  if (withProgress.length > 0) {
    return (withProgress[0].progress ?? 0) / 100
  }
  return 1
}

/**
 * 진척률을 **말할 근거가 있는가** — 하위 구성도 히스토리 진척치도 없는 detection
 * (실측 스캔처럼 인식만 된 경우)에 기본값 100%를 내보이면 완료로 오독된다.
 * 그런 화면은 게이지를 아예 내리는 게 맞다.
 */
export function hasProgressData(block: {
  subAssemblies?: { workStatus: string; progress?: number }[]
  history?: { progress?: number }[]
}): boolean {
  if (block.subAssemblies && block.subAssemblies.length > 0) return true
  return (block.history ?? []).some((h) => typeof h.progress === 'number')
}
