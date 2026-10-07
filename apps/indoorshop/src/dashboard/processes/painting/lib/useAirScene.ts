import { useEffect, useMemo, useState } from 'react'
import { fetchEquipmentByFactory } from '../api/paintingRepository'
import { usePolledEquipmentStatus } from './usePolledEquipmentStatus'
import { bayAirStatesOf } from './airEffect'
import { buildBayScene, type BayScene } from './bayScene'
import { loadPaintingFloorPlan, type PaintingFloorPlan } from './floorPlan'
import { paintingOccupantsByBay } from './collection'

/*
 * 가동 뷰가 그릴 **장면 한 벌**을 모으는 훅 (R38 · R45).
 *
 * 네 갈래의 재료를 하나로 접는다:
 *
 *   설비 배치(`paintingRepository`)          ┐
 *   SCADA 상태(`usePolledEquipmentStatus`)   ├→ 대기(`bayAirStatesOf`)  ┐
 *   공장 바닥(`loadPaintingFloorPlan`)       ───────────────────────── ├→ 장면
 *   재실 블록(`paintingOccupantsByBay`)      ───────────────────────── ┘
 *
 * 이 접기가 한때 `PaintingAirTab` 안에 있었다. 그런데 R45 에서 **현황 탭의 배치도가
 * 제자리에서 3D 로 뒤집히게** 되면서, 같은 장면을 두 화면이 쓰게 됐다 — 탭 안에 두면
 * 현황 탭이 가동 뷰 탭을 import 하게 되고, 복사해 두면 두 화면이 언젠가 다른 장면을
 * 그린다. 그래서 재료를 접는 일만 여기로 내린다(`lib` 은 화면을 모른다).
 *
 * `enabled` 를 두는 이유: 현황 탭은 **3D 로 뒤집혔을 때만** 이 장면이 필요하다. 훅은
 * 조건부로 부를 수 없으므로(규칙), 꺼진 동안 아무 일도 하지 않는 스위치를 안에 둔다 —
 * 지번 fixture(550건 폴리곤)를 도면만 보는 사람에게까지 받게 하지 않는다.
 */
export interface PaintingAirScene {
  /** 다 모였을 때만 값이 선다 — 반쯤 모인 장면으로 빈 3D 를 세우지 않는다 */
  scene: BayScene | null
  /** 이 공장에 SCADA 설비가 하나도 없는가 (그리면 빈 화면이 된다) */
  empty: boolean
}

export function usePaintingAirScene(
  factory: string,
  { enabled = true }: { enabled?: boolean } = {}
): PaintingAirScene {
  const equipment = useMemo(
    () => (enabled ? fetchEquipmentByFactory(factory) : []),
    [factory, enabled]
  )
  const ids = useMemo(() => equipment.map((item) => item.id), [equipment])
  const { byId } = usePolledEquipmentStatus(ids)

  /* 재료는 규칙이 접는다 — 이 파일에 세기 산식이 없는 이유다 */
  const bays = useMemo(() => bayAirStatesOf(equipment, byId), [equipment, byId])
  const bayNames = useMemo(() => [...new Set(equipment.map((item) => item.bay))].sort(), [equipment])
  const bayKey = bayNames.join(',')

  const [floor, setFloor] = useState<PaintingFloorPlan | null>(null)
  useEffect(() => {
    if (!enabled || bayNames.length === 0) {
      setFloor(null)
      return
    }
    let alive = true
    /* 공장을 바꾸면 이전 배치를 그대로 두지 않는다 — 다른 공장의 바닥 위에 이 공장의
     * 설비를 세우면 화면이 조용히 거짓말을 한다 */
    setFloor(null)
    void loadPaintingFloorPlan(factory, bayNames).then((plan) => {
      if (alive) setFloor(plan)
    })
    return () => {
      alive = false
    }
    /* bayNames 는 매 렌더 새 배열이라 문자열 키로 비교한다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factory, bayKey, enabled])

  const occupants = useMemo(
    () => (enabled ? paintingOccupantsByBay(factory) : new Map()),
    [factory, enabled]
  )
  const scene = useMemo(
    () => (floor ? buildBayScene({ floor, air: bays, occupants }) : null),
    [floor, bays, occupants]
  )

  return { scene, empty: enabled && bayNames.length === 0 }
}

/**
 * 누르기 전에 **미리 받아 둔다** — 3D 로 뒤집을 문 앞에 손이 얹혔을 때.
 *
 * 바닥 배치는 지번 fixture(550건 폴리곤)를 dynamic import 로 받고 공장별로 캐시한다.
 * 누른 뒤에 받기 시작하면 도면과 3D 사이에 자리 표시자가 한 번 뜨고, 그 빈 화면이 끼면
 * "도면이 일어선다"는 이야기가 끊긴다 — 이어짐은 움직임이 아니라 **끊기지 않음**이다.
 */
export function warmPaintingAirScene(factory: string): void {
  const bays = [...new Set(fetchEquipmentByFactory(factory).map((item) => item.bay))].sort()
  if (bays.length > 0) void loadPaintingFloorPlan(factory, bays)
}
