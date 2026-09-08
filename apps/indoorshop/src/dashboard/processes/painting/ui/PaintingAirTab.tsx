import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { fetchEquipmentByFactory } from '../api/paintingRepository'
import { usePolledEquipmentStatus } from '../lib/usePolledEquipmentStatus'
import { bayAirStatesOf } from '../lib/airEffect'
import { buildBayScene } from '../lib/bayScene'
import { loadPaintingFloorPlan, type PaintingFloorPlan } from '../lib/floorPlan'
import { paintingOccupantsByBay } from '../lib/collection'
import { PaintingAirViewer } from './PaintingAirViewer'

/*
 * 공장 현황의 **가동 뷰 탭** — 뷰어에 먹일 재료를 모으는 자리 (R24 · R38).
 *
 * 뷰어(`PaintingAirViewer`)는 받은 장면을 그리기만 하고, 규칙은 `lib/*` 가 갖는다.
 * 그 사이에 남는 일이 이 파일이다 — **네 갈래의 재료를 하나의 장면으로 접는 것**:
 *
 *   설비 배치(`paintingRepository`)  ┐
 *   SCADA 상태(`usePolledEquipmentStatus`) ├→ 대기(`bayAirStatesOf`)  ┐
 *   공장 바닥(`loadPaintingFloorPlan`)      ────────────────────────  ├→ 장면(`buildBayScene`)
 *   재실 블록(`paintingOccupantsByBay`)     ────────────────────────  ┘
 *
 * 화면(페이지)에 두면 공장 현황 페이지가 SCADA 폴링·지번 fixture 까지 알게 되고, 뷰어에
 * 두면 그리는 코드 안에 데이터 취득이 섞인다.
 *
 * 폴링은 공용 구독 스토어라 지도 진입 화면이 같은 설비를 보고 있어도 요청은 한 번만
 * 나간다 — 두 화면이 서로 다른 나이의 값을 말하지 않는다.
 *
 * 바닥 배치는 **비동기**다(지번 fixture 는 550건 폴리곤이라 dynamic import 로 온다).
 * 오기 전에는 빈 3D 를 세우지 않고 그렇다고 말한다 — 아무 것도 없는 3D 는 고장으로 읽힌다.
 */
export function PaintingAirTab({ factory }: { factory: string }) {
  const { t } = useTranslation()

  const equipment = useMemo(() => fetchEquipmentByFactory(factory), [factory])
  const ids = useMemo(() => equipment.map((item) => item.id), [equipment])
  const { byId } = usePolledEquipmentStatus(ids)

  /* 재료는 규칙이 접는다 — 이 파일에 세기 산식이 없는 이유다 */
  const bays = useMemo(() => bayAirStatesOf(equipment, byId), [equipment, byId])
  const bayNames = useMemo(
    () => [...new Set(equipment.map((item) => item.bay))].sort(),
    [equipment]
  )
  const bayKey = bayNames.join(',')

  const [floor, setFloor] = useState<PaintingFloorPlan | null>(null)
  useEffect(() => {
    if (bayNames.length === 0) {
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
  }, [factory, bayKey])

  const occupants = useMemo(() => paintingOccupantsByBay(factory), [factory])
  const scene = useMemo(
    () => (floor ? buildBayScene({ floor, air: bays, occupants }) : null),
    [floor, bays, occupants]
  )

  if (bayNames.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-inshop-lg border border-dashed border-border text-inshop-sm text-foreground/45">
        {t('painting.airView.empty')}
      </div>
    )
  }

  return (
    <section className="space-y-2">
      <p className="text-2xs leading-relaxed text-foreground/45">
        {t('painting.airView.subtitle')}
      </p>
      <div className="relative h-[72vh] min-h-[480px]">
        {scene ? (
          <PaintingAirViewer scene={scene} className="absolute inset-0" />
        ) : (
          <div
            role="status"
            className="absolute inset-0 flex items-center justify-center rounded-inshop-lg bg-[#0a0e13] text-inshop-sm text-white/45"
          >
            {t('painting.airView.loading')}
          </div>
        )}
      </div>
    </section>
  )
}
