import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DASHBOARD_TOUR } from '../model/dashboardTour'
import type { TourDefinition } from '../model/types'
import {
  isTourSeen,
  localStorageOrNull,
  markTourSeen,
  type TourStorage,
} from '../lib/tourStorage'
import { onStartTour } from '../lib/tourBus'
import { TourOverlay } from './TourOverlay'

/*
 * 투어의 지휘부 — 레이아웃(LayoutWrapper)에 한 번 서서:
 *  - 첫 방문 자동 1회: 투어의 시작 화면에 처음 들어오면 켠다. 닫으면(완주·건너뛰기·ESC)
 *    **영구 기억**(localStorage) — 다시는 저절로 뜨지 않는다.
 *  - 재실행: 헤더의 도움말(?) 버튼이 tourBus 로 신호를 보낸다. 다른 화면에 있었다면
 *    투어의 시작 화면으로 **기존 딥링크 문법 그대로** 이동한 뒤 켠다.
 *
 * 투어 목록은 데이터다 — 공정 화면용 투어가 생기면 이 배열에 정의 하나를 더한다.
 */
const TOURS: readonly TourDefinition[] = [DASHBOARD_TOUR]

export function TourController({
  storage,
}: {
  /** 저장소 주입구 — 테스트가 가짜 저장소를 끼운다. 기본은 localStorage */
  storage?: TourStorage | null
}) {
  const store = useMemo(
    () => (storage === undefined ? localStorageOrNull() : storage),
    [storage],
  )
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [active, setActive] = useState<TourDefinition | null>(null)

  /* 재실행 신호 — 시작 화면이 아니면 딥링크로 데려간 뒤 켠다 */
  useEffect(
    () =>
      onStartTour((tourId) => {
        const tour = TOURS.find((candidate) => candidate.id === tourId)
        if (!tour) return
        if (window.location.pathname !== tour.startPath) void navigate(tour.startPath)
        setActive(tour)
      }),
    [navigate],
  )

  /* 첫 방문 자동 1회 — 그 투어의 시작 화면에 들어왔고, 본 적이 없을 때만 */
  useEffect(() => {
    if (active) return
    const tour = TOURS.find((candidate) => candidate.startPath === pathname)
    if (tour && !isTourSeen(store, tour.id)) setActive(tour)
  }, [pathname, store, active])

  const close = useCallback(() => {
    if (active) markTourSeen(store, active.id)
    setActive(null)
  }, [active, store])

  if (!active) return null
  return <TourOverlay tour={active} onClose={close} />
}
