import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { PanelSection } from '../../../shared/features/process-map-entry'
import {
  EquipmentSymbolChip,
  colorOfType,
} from '../../../shared/entities/equipment/ui/EquipmentSymbol'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import { cn } from '../../../shared/lib/utils'
import { useEquipmentTypeLabel } from '../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import type { PaintingEquipment } from '../model/equipment'
import type { PaintingEquipmentStatus } from '../model/equipmentStatus'
import {
  PAINTING_SCADA_TYPE_IDS,
  paintingEquipmentSections,
  paintingInventoryOf,
  type PaintingTransferredUnit,
} from '../lib/equipmentInventory'
import { ScadaRackBody } from './scada'
import { paintingPvTrend } from '../lib/equipmentCells'

/*
 * ① 설비 상태 단 — 공장 하나의 **설비 전부**를 한 목록 체계로 (W6-6).
 *
 * 조립·의장이 W6-5 에서 '센서 상태'와 '설비'를 한 단으로 합치고 종류를 구획(PanelSection)
 * 으로 가른 것과 **같은 문법**이다. 도장도 같은 겉테를 쓰고, 구획 순서는 같은 원칙을 따른다:
 * 가동 자산 먼저(제습기 → 가스히터), 수집·네트워크 나중(Edge PC → 캐비닛 → PLC → 허브).
 *
 * 다른 것은 구획의 **속살**뿐이다. 도장의 가동 자산은 SCADA 랙으로 읽는 것이 이미 굳은
 * 문법이라(설정값/실측값·LED·온습도) 그 랙을 그대로 구획 안에 넣는다 — 조립이 라이다
 * 진단값 목록을, 의장이 자기 줄을 각자 들고 있는 것과 같은 이유다.
 *
 * ⚠️ 대수·소속은 실데이터(설비 마스터), **상태는 mock** 이다.
 * ⚠️ 2026-09-03 현재 도장 5개 공장의 이관 설비(판넬·Edge PC·PLC·허브)는 0대다 — 그것이
 *    정상이고, 화면은 그 사실을 한 줄로 말한다(없는 설비를 지어내 세우지 않는다).
 */

/** 종류별 대수 — 아래 구획들의 목차이기도 하다 (조립 패널과 같은 자리) */
function TypeCountRow({
  rows,
}: {
  rows: readonly { typeId: string; name: string; count: number }[]
}) {
  if (rows.length === 0) return null
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 py-1">
      {rows.map((row) => (
        <li key={row.typeId} className="flex items-center gap-1.5">
          <EquipmentSymbolChip typeId={row.typeId} size={15} />
          <span className="text-2xs text-white/55">{row.name}</span>
          <span className="font-mono text-2xs tabular-nums text-white/85">{row.count}</span>
        </li>
      ))}
    </ul>
  )
}

/** 이관 설비 한 줄 — 판정 · 링크 · (캐비닛이면) 소속 대수 */
function TransferredRow({ unit }: { unit: PaintingTransferredUnit }) {
  const { t } = useTranslation()
  const down = unit.panelStatus ? unit.panelStatus.health === 'down' : unit.link === 'offline'
  const degraded = unit.panelStatus
    ? unit.panelStatus.health === 'degraded'
    : unit.link === 'error'
  return (
    <li
      className={cn(
        'rounded-inshop-md px-2 py-1.5',
        down
          ? 'bg-status-unhealthy/8 ring-1 ring-inset ring-status-unhealthy/35'
          : degraded
            ? 'ring-1 ring-inset ring-status-degraded/35'
            : 'hover:bg-white/[0.045]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <EquipmentSymbolChip typeId={unit.equipment.typeId} size={16} dim={down} />
        <span className="min-w-0 flex-1 truncate font-mono text-2xs font-semibold text-white/88">
          {unit.equipment.id}
        </span>
        {unit.equipment.bay && (
          <span className="shrink-0 font-mono text-2xs text-white/35">{unit.equipment.bay}</span>
        )}
        <span
          className={cn(
            'shrink-0 text-2xs font-medium',
            down
              ? 'text-status-unhealthy'
              : degraded
                ? 'text-status-degraded'
                : 'text-status-healthy'
          )}
        >
          {t(`painting.workspace.link.${unit.link}`)}
        </span>
      </div>
      {unit.panelStatus && (
        <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[22px] pt-0.5 text-2xs text-white/50">
          <div className="flex gap-1">
            <dt>{t('painting.mapEntry.equipment.members')}</dt>
            <dd className="font-mono tabular-nums">
              {unit.panelStatus.memberOnline}/{unit.panelStatus.memberTotal}
            </dd>
          </div>
        </dl>
      )}
    </li>
  )
}

/**
 * 공장 하나의 설비 인벤토리 + 상태.
 *
 * SCADA 값(제습기·가스히터)은 호출부가 폴링해 `statusById`·`polledAt` 로 준다. 이관 설비
 * (판넬·Edge PC)의 상태는 공용 설비 계약이라 **여기서 직접 구독**한다 — 도장 SCADA 와
 * 다른 계약이므로 한 통에 담지 않는다(`shared/entities/equipment/status.ts` 주석 참조).
 */
export function PaintingEquipmentPanel({
  factory,
  equipment,
  statusById,
  selectedId,
  polledAt,
  onSelect,
}: {
  factory: string
  equipment: readonly PaintingEquipment[]
  statusById: Map<string, PaintingEquipmentStatus>
  selectedId: string | null
  polledAt: number | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  /* 설비 종류의 화면 이름 — 레지스트리(도면 이름) 대신 라벨 층을 지난다 */
  const typeLabelOf = useEquipmentTypeLabel()
  const { snapshot } = useFactoryEquipmentStatus(factory)
  /* 구획 순서·대수는 lib 이 정한다 — 조립·의장과 같은 규칙임을 테스트가 지킨다 */
  const sections = paintingEquipmentSections(factory)
  const inventory = paintingInventoryOf(factory, snapshot)

  if (sections.length === 0) {
    return <p className="px-3 py-3 text-2xs text-white/45">{t('painting.mapEntry.equipment.empty')}</p>
  }

  const scadaSections = sections.filter((s) => PAINTING_SCADA_TYPE_IDS.includes(s.typeId))
  const scadaCount = scadaSections.reduce((sum, s) => sum + s.count, 0)
  /* 실측값 추이 — 같은 생성기를 과거 시각으로 되감은 값. 그리드가 이상·선택 셀에만 그린다 */
  const pvTrends = polledAt
    ? new Map(equipment.map((item) => [item.id, paintingPvTrend(item, polledAt)]))
    : undefined
  const transferredSections = sections.filter((s) => !PAINTING_SCADA_TYPE_IDS.includes(s.typeId))

  return (
    <div className="flex flex-col gap-2.5 px-2 py-2">
      <TypeCountRow rows={[...inventory.scada, ...inventory.transferred]} />

      {/* 판이 죽으면 아래가 통째로 눈이 먼다 — 종류 구획보다 먼저 말한다(조립과 같은 규칙) */}
      {inventory.transferredIssues > 0 && (
        <p
          className="rounded-inshop-md px-2 py-1.5 text-2xs leading-relaxed text-status-unhealthy"
          style={{ boxShadow: `inset 0 0 0 1px ${colorOfType('PNL')}55` }}
        >
          {t('painting.mapEntry.equipment.issueWarning', {
            count: inventory.transferredIssues,
          })}
        </p>
      )}

      {/* ── 가동 자산: 제습기·가스히터. SCADA 랙이 이미 두 종류를 한 화면에서 가르므로
             구획은 하나로 두고 랙의 종류 탭에 맡긴다(같은 것을 두 겹으로 나누지 않는다) ── */}
      {scadaCount > 0 && (
        <PanelSection title={t('painting.mapEntry.equipment.scadaHeading')} count={scadaCount}>
          <ScadaRackBody
            equipment={equipment}
            statusById={statusById}
            selectedId={selectedId}
            polledAt={polledAt}
            onSelect={onSelect}
            trendById={pvTrends}
          />
        </PanelSection>
      )}

      {/* ── 수집·네트워크: 이관 설비. 종류마다 제 구획을 갖는다 ── */}
      {transferredSections.map((section) => {
        const units = inventory.transferredUnits.filter(
          (u) => u.equipment.typeId === section.typeId
        )
        return (
          <PanelSection
            key={section.typeId}
            title={typeLabelOf(section.typeId)}
            count={section.count}
          >
            <ul className="flex flex-col gap-0.5">
              {units.map((unit) => (
                <TransferredRow key={unit.equipment.id} unit={unit} />
              ))}
            </ul>
          </PanelSection>
        )
      })}

      {inventory.transferredTotal === 0 && (
        <p className="px-1 text-2xs leading-relaxed text-white/45">
          {t('painting.mapEntry.equipment.noTransferred')}
        </p>
      )}
    </div>
  )
}
