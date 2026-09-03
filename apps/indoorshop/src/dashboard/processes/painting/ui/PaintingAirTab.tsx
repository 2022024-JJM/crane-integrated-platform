import { useMemo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { fetchEquipmentByFactory } from '../api/paintingRepository'
import { usePolledEquipmentStatus } from '../lib/usePolledEquipmentStatus'
import { bayAirStatesOf } from '../lib/airEffect'
import { PaintingAirViewer } from './PaintingAirViewer'

/*
 * 공장 현황의 **가동 뷰 탭** — 뷰어에 먹일 재료를 모으는 자리 (R24).
 *
 * 뷰어(`PaintingAirViewer`)는 받은 대기를 그리기만 하고, 규칙은 `lib/airEffect` 가 갖는다.
 * 그 사이에 남는 일이 하나 있다 — **어느 설비의 상태를 물어서 누구의 대기로 접을 것인가**.
 * 그것이 이 파일이다. 화면(페이지)에 두면 공장 현황 페이지가 SCADA 폴링까지 알게 되고,
 * 뷰어에 두면 그리는 코드 안에 데이터 취득이 섞인다.
 *
 * 폴링은 공용 구독 스토어(`usePolledEquipmentStatus`)라 지도 진입 화면이 같은 설비를 보고
 * 있어도 요청은 한 번만 나간다 — 두 화면이 서로 다른 나이의 값을 말하지 않는다.
 *
 * 설비가 없는 공장이면 빈 판을 그냥 두지 않고 그렇다고 말한다(아무 것도 없는 3D 는
 * 고장으로 읽힌다).
 */
export function PaintingAirTab({ factory }: { factory: string }) {
  const { t } = useTranslation()

  const equipment = useMemo(() => fetchEquipmentByFactory(factory), [factory])
  const ids = useMemo(() => equipment.map((item) => item.id), [equipment])
  const { byId } = usePolledEquipmentStatus(ids)

  /* 재료는 규칙이 접는다 — 이 파일에 세기 산식이 없는 이유다 */
  const bays = useMemo(() => bayAirStatesOf(equipment, byId), [equipment, byId])

  if (bays.length === 0) {
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
        <PaintingAirViewer bays={bays} className="absolute inset-0" />
      </div>
    </section>
  )
}
