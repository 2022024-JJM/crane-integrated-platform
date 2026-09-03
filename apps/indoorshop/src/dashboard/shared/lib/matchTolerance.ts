import { useSyncExternalStore } from 'react'

/*
 * **실측 정합 판정 임계** — CAD 표면에서 몇 cm 안까지를 "그 블록의 점" 으로 볼 것인가.
 *
 * 왜 설정에 있나: 이 값은 뷰어의 조작이 아니라 **판정 기준**이다. 같은 스캔을 놓고
 * 5cm 로 보는 사람과 60cm 로 보는 사람은 다른 수치를 읽게 되므로, 화면마다 따로 잡는
 * 손잡이가 아니라 한 번 정해 두고 쓰는 값이어야 한다. 그래서 뷰어 도구줄에서 빼
 * 설정으로 옮기고(R23), 전역 저장(localStorage)한 뒤 뷰어가 **구독**한다.
 *
 * 저장·구독을 Context 대신 외부 스토어로 둔 이유: 이 값을 읽는 곳이 뷰어 하나뿐이라
 * 앱 루트에 Provider 를 한 겹 더 씌울 이유가 없고, `useSyncExternalStore` 는 탭 간
 * 동기화(`storage` 이벤트)까지 같은 경로로 처리한다.
 *
 * ⚠️ 상한(60cm)은 **자산이 담을 수 있는 한계**와 짝이다 — 점별 편차 bin 이 생성 시점의
 * 허용오차로 양자화돼 있어(`build-real-scan-assets.py` 의 SEG_TOLERANCE_M) 그보다 넓게는
 * 볼 수 없다. 자산이 더 좁은 기준으로 만들어졌다면 뷰어가 그 값으로 한 번 더 조인다.
 */

export const MATCH_TOLERANCE_MIN_CM = 5
export const MATCH_TOLERANCE_MAX_CM = 60
export const MATCH_TOLERANCE_DEFAULT_CM = 30
export const MATCH_TOLERANCE_STEP_CM = 1

const STORAGE_KEY = 'real-scan-match-tolerance-cm'

/**
 * 범위 밖·비수치는 기본값으로 — 손으로 고친 localStorage 가 화면을 깨뜨리지 않게.
 *
 * ⚠️ `null`·`undefined`·빈 문자열은 **값이 없는 것**이라 기본값으로 보낸다. `Number(null)`
 * 이 0 이라는 JS 사정 때문에 그냥 통과시키면 "저장된 적 없음" 이 조용히 하한(5cm)으로
 * 바뀐다 — 설정을 만진 적 없는 사람이 가장 빡빡한 기준을 보게 된다.
 */
export function clampToleranceCm(value: unknown): number {
  if (value == null || value === '') return MATCH_TOLERANCE_DEFAULT_CM
  const cm = Math.round(Number(value))
  if (!Number.isFinite(cm)) return MATCH_TOLERANCE_DEFAULT_CM
  return Math.min(MATCH_TOLERANCE_MAX_CM, Math.max(MATCH_TOLERANCE_MIN_CM, cm))
}

function read(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored == null) return MATCH_TOLERANCE_DEFAULT_CM
    return clampToleranceCm(stored)
  } catch {
    /* 사생활 보호 모드 등에서 접근이 막힐 수 있다 — 기본값으로 넘어간다 */
    return MATCH_TOLERANCE_DEFAULT_CM
  }
}

let current = read()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** 다른 탭에서 바꾼 값도 따라간다 — 같은 설정이 창마다 다르면 설정이 아니다 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    const next = read()
    if (next === current) return
    current = next
    emit()
  })
}

export function getMatchToleranceCm(): number {
  return current
}

export function setMatchToleranceCm(cm: number): void {
  const next = clampToleranceCm(cm)
  if (next === current) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    /* 저장에 실패해도 이번 세션 동작에는 영향이 없다(글자 크기 설정과 같은 규칙) */
  }
  emit()
}

export function subscribeMatchTolerance(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 설정 화면과 뷰어가 같은 값을 본다 — 저장하면 그 자리에서 반영된다 */
export function useMatchToleranceCm(): number {
  return useSyncExternalStore(subscribeMatchTolerance, getMatchToleranceCm, getMatchToleranceCm)
}

/** 테스트 격리용 — 앱 코드는 부르지 않는다 */
export function resetMatchToleranceForTest(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
  current = MATCH_TOLERANCE_DEFAULT_CM
  emit()
}
