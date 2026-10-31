import { useEffect, useState, type RefObject } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { colorOfProcess } from '../../../entities/yard-parcels'
import { cn } from '../../../lib/utils'
import { OCCUPANT_GROUP_ORDER, type OccupantGroup } from '../lib/occupantProgress'
import { GROUP_TEXT } from '../lib/occupantGroupTone'
import type { FaultBay } from '../lib/bayEquipmentFaults'
import { FaultEquipmentChips } from './FaultEquipmentChips'
import { FaultMark } from './FaultMark'

/** hover 카드가 말하는 것 — 공장 하나 또는 베이 하나 */
export type MapHoverInfo =
  | {
      kind: 'factory'
      name: string
      process: string
      /**
       * 작업 상태별(작업 중 · 작업 전 · 작업 완료) 블록 수 — 베이 카드·베이 hover 카드와 같은 묶음.
       * 아직 못 읽었거나 베이 매핑이 없는 공장이면 undefined(수를 '–' 로)
       */
      groups?: Readonly<Record<OccupantGroup, number>>
      /** 점검이 필요한 베이 수 */
      faultBays: number
    }
  | {
      kind: 'bay'
      factory: string
      label: string
      process: string
      /** 작업 상태별(작업 중 · 작업 전 · 작업 완료) 블록 수 — 공장 카드와 같은 칸으로 적는다 */
      groups: Readonly<Record<OccupantGroup, number>>
      /** 점검이 필요한 장비 — 없으면 null */
      fault: FaultBay | null
    }

/** 카드 너비(px) — 오른쪽 끝에서 커서 왼쪽으로 뒤집는 기준 */
const WIDTH = 300

/**
 * 지도의 공장·베이에 손을 얹으면 커서 옆에 뜨는 정보 카드(사용자 확정) — 왼쪽 카드가
 * 펼쳐져 있어도 늘 뜬다.
 *
 * 공장 — 공정 · 이름 · 작업 상태별(작업 중 · 작업 전 · 작업 완료) 블록 수 · 점검 필요 베이 수.
 * 베이 — 공장 · 베이 이름 · 작업 상태별(작업 중 · 작업 전 · 작업 완료) 블록 수 · 점검이
 * 필요한 장비(작업 종류는 적지 않는다 — 베이 카드가 말한다). 묶음과 순서는 베이 카드의 작업 목록과 같다(`occupantGroupOf`).
 *
 * 커서는 지도 상자의 mousemove 를 직접 따라간다(React 를 거치면 손이 움직일 때마다 지도
 * 화면 전체가 다시 그려진다). 클릭을 막지 않는다(pointer-events-none).
 */
export function MapHoverCard({
  info,
  boxRef,
  initial,
}: {
  info: MapHoverInfo
  /** 지도 상자 — 좌표의 기준이자 mousemove 를 듣는 곳 */
  boxRef: RefObject<HTMLElement | null>
  /** 마지막으로 안 커서 자리(지도 상자 기준) — 첫 프레임부터 제자리에 서게 */
  initial: { x: number; y: number } | null
}) {
  const { t } = useTranslation()
  const [at, setAt] = useState(initial)
  const [boxWidth, setBoxWidth] = useState(() => boxRef.current?.clientWidth ?? 0)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onMove = (event: MouseEvent) => {
      const rect = box.getBoundingClientRect()
      setAt({ x: event.clientX - rect.left, y: event.clientY - rect.top })
      setBoxWidth(rect.width)
    }
    box.addEventListener('mousemove', onMove)
    return () => box.removeEventListener('mousemove', onMove)
  }, [boxRef])

  if (!at) return null
  const flip = at.x + 18 + WIDTH > boxWidth - 8
  const process = info.process
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 rounded-inshop-lg border border-white/15 bg-[#0b0e12]/95 p-3 text-white shadow-[0_14px_36px_rgba(0,0,0,0.45)]"
      style={{ left: flip ? at.x - 18 - WIDTH : at.x + 18, top: at.y + 18, width: WIDTH }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOfProcess(process) }} />
        {info.kind === 'factory' ? (
          <>
            <span className="shrink-0 text-inshop-xs text-white/60">{process}</span>
            <span className="min-w-0 truncate text-inshop-base font-semibold">{info.name}</span>
          </>
        ) : (
          <>
            <span className="min-w-0 truncate text-inshop-xs text-white/60">{info.factory}</span>
            <span className="shrink-0 text-inshop-base font-semibold">{info.label}</span>
            {info.fault && <FaultMark count={info.fault.equipment.length} />}
          </>
        )}
      </div>

      {info.kind === 'factory' ? (
        /* 작업 상태별 블록 수 + 점검 필요 베이 수 — 베이 수는 적지 않는다(사용자 확정) */
        <StatusStats groups={info.groups} fault={info.faultBays} />
      ) : (
        <>
          {/* 공장 카드와 같은 칸 — 작업 상태별 블록 수 + 점검이 필요한 장비 수(사용자 확정).
              작업 종류는 적지 않는다(베이 카드가 말한다) */}
          <StatusStats groups={info.groups} fault={info.fault?.equipment.length ?? 0} />
          {info.fault && (
            <>
              <p className="mt-2.5 text-2xs font-medium text-status-unhealthy">
                {t('dashboard.map.equipmentFault', { count: info.fault.equipment.length })}
              </p>
              <FaultEquipmentChips bay={info.fault} className="mt-1" />
            </>
          )}
        </>
      )}
    </div>
  )
}

/** 작업 중 · 작업 전 · 작업 완료 · 점검 필요 네 칸 — 공장·베이 카드가 같은 모양을 쓴다 */
function StatusStats({
  groups,
  fault,
}: {
  groups: Readonly<Record<OccupantGroup, number>> | undefined
  fault: number
}) {
  const { t } = useTranslation()
  return (
    <dl className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
      {OCCUPANT_GROUP_ORDER.map((group) => (
        <Stat
          key={group}
          label={t(`dashboard.map.occupant.group.${group}`)}
          value={groups?.[group]}
          tone={GROUP_TEXT[group]}
        />
      ))}
      <Stat label={t('dashboard.map.hoverCard.faultBays')} value={fault} alert={fault > 0} />
    </dl>
  )
}

function Stat({
  label,
  value,
  alert,
  tone,
}: {
  label: string
  value: number | undefined
  alert?: boolean
  /** 이름 글자색 — 작업 상태 묶음의 색 */
  tone?: string
}) {
  return (
    <div className="rounded-inshop-md bg-white/[0.06] px-1 py-1.5">
      <dd className={alert ? 'text-inshop-lg font-semibold tabular-nums text-status-unhealthy' : 'text-inshop-lg font-semibold tabular-nums'}>
        {value ?? '–'}
      </dd>
      <dt className={cn('whitespace-nowrap text-2xs', tone ?? 'text-white/55')}>{label}</dt>
    </div>
  )
}
