import { useSyncExternalStore } from 'react'

/*
 * ── 현황 보드 **보기 모드** (R40) ──
 *
 * 배치 그림과 설비 목록이 늘 절반씩 화면을 나눠 갖는다. 두 층이 함께 일하도록 나란히
 * 둔 것이지만(R29), 배치를 **읽는** 동안에는 그 절반이 모자란다 — 공장 하나에 50~90대가
 * 서고 베이가 여덟 칸이면 300px 짜리 그림에서는 칸 이름조차 지워진다. 반대로 목록으로
 * 훑는 동안에는 그림이 자리만 차지한다.
 *
 * 그래서 자리 배분을 **사람이 고르게** 한다: 절반절반(기본) / 배치 전용.
 *
 * 왜 접기(`birdviewOpen`)로 안 되나: 접기는 그림을 **지우는** 손잡이라 반대쪽(그림을
 * 크게)이 없다. 두 방향이 필요하면 토글이 아니라 모드다.
 *
 * 저장을 localStorage 로 두는 이유는 실측 정합 임계(`matchTolerance`)와 같다 — 이건
 * 화면의 일시적 상태가 아니라 **그 사람이 이 화면을 보는 방식**이라, 공장을 옮기거나
 * 새로고침했다고 원래대로 돌아가면 매번 다시 골라야 한다. 외부 스토어로 둔 것도 같은
 * 이유다(읽는 곳이 보드 하나뿐이라 Provider 를 한 겹 더 씌울 값이 아니고,
 * `useSyncExternalStore` 가 탭 간 동기화까지 같은 경로로 처리한다).
 */

/** 절반절반(그림+목록) / 배치 전용(그림만 크게) */
export type EquipmentBoardMode = 'split' | 'birdview'

export const EQUIPMENT_BOARD_MODE_DEFAULT: EquipmentBoardMode = 'split'

const STORAGE_KEY = 'equipment-board-mode'

/**
 * 모르는 값은 기본값으로 — 손으로 고친 localStorage 나 옛 철자가 화면을 빈 칸으로
 * 만들지 않게 한다(없는 모드를 지어내지 않는다).
 */
export function normalizeBoardMode(value: unknown): EquipmentBoardMode {
  return value === 'birdview' || value === 'split' ? value : EQUIPMENT_BOARD_MODE_DEFAULT
}

function read(): EquipmentBoardMode {
  try {
    return normalizeBoardMode(localStorage.getItem(STORAGE_KEY))
  } catch {
    /* 사생활 보호 모드 등에서 접근이 막힐 수 있다 — 기본값으로 넘어간다 */
    return EQUIPMENT_BOARD_MODE_DEFAULT
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

export function getEquipmentBoardMode(): EquipmentBoardMode {
  return current
}

export function setEquipmentBoardMode(mode: EquipmentBoardMode): void {
  const next = normalizeBoardMode(mode)
  if (next === current) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* 저장에 실패해도 이번 세션 동작에는 영향이 없다(글자 크기 설정과 같은 규칙) */
  }
  emit()
}

export function subscribeEquipmentBoardMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 세 공정의 현황 보드가 같은 값을 본다 — 한 번 고르면 그대로 남는다 */
export function useEquipmentBoardMode(): EquipmentBoardMode {
  return useSyncExternalStore(
    subscribeEquipmentBoardMode,
    getEquipmentBoardMode,
    getEquipmentBoardMode
  )
}

/** 테스트 격리용 — 앱 코드는 부르지 않는다 */
export function resetEquipmentBoardModeForTest(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
  current = EQUIPMENT_BOARD_MODE_DEFAULT
  emit()
}
