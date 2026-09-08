/*
 * 통합 알람 레일의 상태 훅 — 원천 수집 + 문구 완성 + 세션 dismiss (W7-1).
 *
 * 판정은 전부 `derive.ts`(순수)가 하고, 여기는 원천을 모아 먹이고 결과를 화면 어휘
 * (`Alarm`)로 바꾸는 배선이다:
 *
 *   매칭 불일치  ← 로스터 조립 블록 × 통합실적 매칭 캐스케이드 (결정론 — 세션당 1회)
 *   설비 이상    ← 설비 상태 스냅샷 구독 (`useFactoriesEquipmentStatus` — 6초 갱신)
 *   배치/공백    ← 도장 일일 그레인(YPWG413M) 최신 실적일 + 공정별 최근 수집 경과
 *
 * dismiss 는 **세션 안에서만** 산다(sessionStorage) — 알람은 저장된 레코드가 아니라
 * 판정 결과라서, "지웠다"는 상태를 영구 보존하면 다음 날 같은 사정이 또 생겨도 조용히
 * 넘어가게 된다. 브라우저를 닫으면 판이 리셋되는 것이 맞다.
 */
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { blocksInZone, YARD_PROCESS_OF_ZONE, type ProcessZone } from '../../../entities/vessel'
import { YARD_EQUIPMENT } from '../../../entities/equipment'
import { useFactoriesEquipmentStatus } from '../../../entities/equipment/useEquipmentStatus'
import { loadYardParcels } from '../../../entities/yard-parcels'
import {
  generateAssyUnits,
  generatePaintingSteps,
} from '../../performance/api/performanceApi'
import { fetchFactoryOverviews } from '../../../model/processRegistry'
import { drilldownHref } from '../../../lib/drilldownUrl'
import { withEquipmentFocus } from '../../../lib/equipmentFocus'
import { useAsyncData } from '../../../lib/useAsyncData'
import { useClock } from '../../../lib/useClock'
import type { Alarm } from '../../../entities/alarm/model/types'
import {
  deriveCollectionGapAlarms,
  deriveEquipmentAlarms,
  deriveMismatchAlarms,
  derivePaintingBatchAlarm,
} from './derive'
import { byRailSeverityThenTime, type RailAlarm } from './types'

const DISMISS_STORAGE_KEY = 'alarm-rail-dismissed'

function loadDismissed(): ReadonlySet<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function todayString(now: Date): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/** 'HH:MM' → 그 시각 이후 경과(분). 지금보다 뒤면 어제 것으로 본다(자정 넘김) */
export function minutesSinceHHMM(hhmm: string, now: Date): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!match) return null
  const scanMinutes = Number(match[1]) * 60 + Number(match[2])
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const diff = nowMinutes - scanMinutes
  return diff >= 0 ? diff : diff + 24 * 60
}

/** 야드 공정 이름 → 설비 딥링크가 갈 공정존. 가공 라인(CAS·PAS)의 설비는 조립 지도에 선다 */
const MAP_ZONE_OF_PROCESS: Record<string, ProcessZone> = {
  [YARD_PROCESS_OF_ZONE.assembly]: 'assembly',
  [YARD_PROCESS_OF_ZONE.outfitting]: 'outfitting',
  [YARD_PROCESS_OF_ZONE.painting]: 'painting',
  [YARD_PROCESS_OF_ZONE.fabrication]: 'assembly',
}

/** 설비를 거느린 공장 전부 — 스냅샷 구독 대상 */
const EQUIPMENT_FACTORIES = [...new Set(YARD_EQUIPMENT.map((e) => e.factory))]

export interface RailAlarmsState {
  /** dismiss 를 뺀 활성 알람 — 심각도 → 시각 순 */
  alarms: Alarm[]
  counts: { critical: number; warning: number; total: number }
  dismiss: (id: string) => void
}

export function useRailAlarms(): RailAlarmsState {
  const { t } = useTranslation()
  /* 분 단위 시계 — 수집 공백 경과와 기준일이 이 시계를 따라 갱신된다 */
  const now = useClock(60_000)
  const baseDate = todayString(now)

  /* ── 원천 1: 매칭 불일치 — 결정론 생성이라 기준일이 바뀔 때만 다시 센다 ── */
  const mismatchAlarms = useMemo(() => {
    const blocks = blocksInZone('assembly').map((block) => ({
      projNo: block.projNo,
      blockNo: block.blockNo,
      assys: generateAssyUnits(block.projNo, block.blockNo, baseDate).assys,
    }))
    return deriveMismatchAlarms(blocks, baseDate)
  }, [baseDate])

  /* ── 원천 2: 설비 이상 — 스냅샷 구독 (같은 스토어를 보는 화면들과 폴링 공유) ── */
  const { snapshot } = useFactoriesEquipmentStatus(EQUIPMENT_FACTORIES)
  const { data: parcels } = useAsyncData(() => loadYardParcels(), [])
  const zoneOfFactory = useMemo(() => {
    const map = new Map<string, ProcessZone>()
    for (const factory of parcels?.factories ?? []) {
      const zone = MAP_ZONE_OF_PROCESS[factory.process]
      if (zone) map.set(factory.name, zone)
    }
    return map
  }, [parcels])
  const equipmentAlarms = useMemo(
    () =>
      deriveEquipmentAlarms(snapshot, (equipment) => {
        const zone = zoneOfFactory.get(equipment.factory)
        if (!zone) return null
        /* 드릴다운 URL 계약 — 베이 id 는 `{공장}#{베이}` (drilldownUrl.ts).
           **누구 때문에 왔는지도 함께 싣는다**(`?equip=`) — 도착 화면이 접는 규칙에
           가려 당사자를 못 세우는 일이 없게 (equipmentFocus.ts) */
        return withEquipmentFocus(
          drilldownHref(`/indoorshop/zones/${zone}`, '', {
            process: null,
            factory: equipment.factory,
            bay: equipment.bay ? `${equipment.factory}#${equipment.bay}` : null,
          }),
          equipment.id
        )
      }),
    [snapshot, zoneOfFactory]
  )

  /* ── 원천 3-a: 도장 일일 배치(YPWG413M) — 최신 실적일이 어제보다 오래됐는가 ── */
  const batchAlarm = useMemo(() => {
    let latest: string | null = null
    for (const block of blocksInZone('painting')) {
      const summary = generatePaintingSteps(block.projNo, block.blockNo, baseDate)
      for (const step of summary.steps) {
        if (step.progressAsOf && (latest == null || step.progressAsOf > latest)) {
          latest = step.progressAsOf
        }
      }
    }
    return derivePaintingBatchAlarm({ baseDate, latestActlDate: latest })
  }, [baseDate])

  /* ── 원천 3-b: 수집 이벤트 공백 — 공정별 최근 수집(공장 현황 제공분)의 경과 ── */
  const { data: overviews } = useAsyncData(() => fetchFactoryOverviews(), [])
  const gapAlarms = useMemo(() => {
    if (!overviews || overviews.length === 0) return []
    let latest: string | null = null
    for (const overview of overviews) {
      if (overview.lastScanAt && (latest == null || overview.lastScanAt > latest)) {
        latest = overview.lastScanAt
      }
    }
    return deriveCollectionGapAlarms(
      [
        {
          zone: 'assembly',
          minutesSinceLast: latest ? minutesSinceHHMM(latest, now) : null,
          lastLabel: latest,
          href: '/indoorshop/zones/assembly',
        },
      ],
      { nowIso: now.toISOString() }
    )
  }, [overviews, now])

  /* ── dismiss (세션) ── */
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(loadDismissed)
  const dismiss = useCallback((id: string) => {
    setDismissed((previous) => {
      const next = new Set(previous)
      next.add(id)
      try {
        sessionStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        /* 스토리지가 막혀 있으면 메모리로만 — 알람이 안 지워지는 것보다 낫다 */
      }
      return next
    })
  }, [])

  /* ── 합치기 + 문구 완성 ── */
  const alarms = useMemo(() => {
    const all: RailAlarm[] = [
      ...mismatchAlarms,
      ...equipmentAlarms,
      ...(batchAlarm ? [batchAlarm] : []),
      ...gapAlarms,
    ]
    return all
      .filter((alarm) => !dismissed.has(alarm.id))
      .sort(byRailSeverityThenTime)
      .map((alarm) => toAlarm(alarm, t))
  }, [mismatchAlarms, equipmentAlarms, batchAlarm, gapAlarms, dismissed, t])

  const counts = useMemo(() => {
    const critical = alarms.filter((alarm) => alarm.severity === 'critical').length
    return { critical, warning: alarms.length - critical, total: alarms.length }
  }, [alarms])

  return { alarms, counts, dismiss }
}

/** 판정 결과를 화면 어휘(`Alarm`)로 — 문장은 여기서 완성한다.
 * (파라미터 키까지는 타입이 못 지키므로 결과를 string 으로 굳힌다 — 키 자체는 ParseKeys) */
function toAlarm(alarm: RailAlarm, t: ReturnType<typeof useTranslation>['t']): Alarm {
  return {
    id: alarm.id,
    severity: alarm.severity,
    title: String(t(alarm.titleKey, resolveParams(alarm.titleParams, t as (key: string) => string) as never)),
    message: String(t(alarm.messageKey, resolveParams(alarm.messageParams, t as (key: string) => string) as never)),
    source: alarm.source,
    href: alarm.href ?? undefined,
    occurredAt: alarm.occurredAt,
    /* 레일에 '읽음' 개념은 없다(세션 dismiss 뿐) — 목록이 전부 굵게 서지 않도록 read 로 둔다 */
    read: true,
  }
}

/** `zoneKey` 파라미터는 공정 이름으로 번역해 `zone` 으로 바꿔 넣는다 (판정 함수는 i18n 을 모른다) */
function resolveParams(
  params: Record<string, string | number> | undefined,
  t: (key: string) => string
): Record<string, string | number> {
  if (!params) return {}
  if (typeof params.zoneKey !== 'string') return params
  const { zoneKey, ...rest } = params
  return { ...rest, zone: t(`performance.process.${zoneKey}`) }
}
