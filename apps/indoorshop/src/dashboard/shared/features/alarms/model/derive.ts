/*
 * 알람 판정 규칙 — 전부 **순수 함수**다 (W7-1).
 *
 * 원천 셋을 알람 한 줄로 접는다:
 *  1. 매칭 불일치 — 조립 매칭 캐스케이드의 `unmatched` ASSY (노티 대상 · 완료 처리 금지)
 *  2. 설비 이상 — 설비 상태 스냅샷(`EquipmentStatusSnapshot`)의 오류 축
 *  3. 배치/수집 공백 — 도장 일일 그레인(YPWG413M)의 등록 지연, 공정별 수집 이벤트 공백
 *
 * 시계·스토리지·i18n 을 모른다 — 시각과 딥링크 해석기는 인자로 받는다. 그래서 규칙마다
 * 단위 테스트가 선다(`__tests__/derive.test.ts`).
 */
import type { AssyUnit } from '../../performance/model/types'
import {
  equipmentTypeOf,
  yardEquipmentOf,
  type EquipmentStatusSnapshot,
  type YardEquipment,
} from '../../../entities/equipment'
import type { RailAlarm } from './types'

/* ── 1. 매칭 불일치 ─────────────────────────────────────────────
 * 인식 실적은 있는데(우리 판별 O) 레거시 W/O 가 없다(매칭 캐스케이드 ③) — ASM-F10 이
 * 완료 처리를 금지하는 상태다. ASSY 한 개가 알람 한 줄이다: 노티의 단위가 ASSY 이고,
 * 블록으로 뭉치면 "몇 건인지"가 사라진다.
 */

export interface MismatchBlockInput {
  projNo: string
  blockNo: string
  assys: readonly Pick<AssyUnit, 'assyNo' | 'match' | 'judgedDate'>[]
}

export function deriveMismatchAlarms(
  blocks: readonly MismatchBlockInput[],
  baseDate: string
): RailAlarm[] {
  const alarms: RailAlarm[] = []
  for (const block of blocks) {
    for (const assy of block.assys) {
      if (assy.match.state !== 'unmatched') continue
      alarms.push({
        /* assyNo 는 PROJ-BLK-STRC+SER 조합이라 그 자체로 전역 유일하다 */
        id: `mismatch:${assy.assyNo}`,
        severity: 'warning',
        kind: 'mismatch',
        titleKey: 'alarms.rail.mismatch.title',
        messageKey: 'alarms.rail.mismatch.message',
        messageParams: { block: `${block.projNo}-${block.blockNo}`, assy: assy.assyNo },
        source: assy.assyNo,
        /* 통합실적의 기존 딥링크 계약 — ?assy= 는 그 ASSY 가 든 블록을 조회·강조한다 */
        href: `/indoorshop/performance?vessel=${encodeURIComponent(block.projNo)}&block=${encodeURIComponent(block.blockNo)}&assy=${encodeURIComponent(assy.assyNo)}`,
        occurredAt: `${assy.judgedDate ?? baseDate}T00:00:00`,
      })
    }
  }
  return alarms
}

/* ── 2. 설비 이상 ───────────────────────────────────────────────
 * 스냅샷의 오류 축을 접는다. **설비 한 대에 알람은 최대 한 줄** — 같은 설비의 링크
 * 오류와 모터 알람을 두 줄로 내면 목록이 같은 사정을 두 번 말한다. 구체적인 규칙이
 * 이긴다(틸팅 모터 > Edge 수집 서비스 > 캐비닛 판정 > 일반 링크).
 *
 * 오프라인 라이다는 알람으로 세우지 않는다 — 점검·소등으로 꺼지는 일이 잦아 목록이
 * 배경 소음으로 가득 차면 정작 봐야 할 것이 묻힌다. 지도·목록 배지가 이미 그 축을
 * 말하고 있다. (Edge PC 오프라인은 예외 — 그 판이 꺼지면 물린 설비가 통째로 눈이 먼다.)
 */

/** 설비 → 공정 맵 딥링크. 공장의 소속 공정을 모르는 호출부(테스트)는 null 을 돌려도 된다 */
export type EquipmentHrefResolver = (equipment: YardEquipment) => string | null

export function deriveEquipmentAlarms(
  snapshot: EquipmentStatusSnapshot,
  hrefOf: EquipmentHrefResolver
): RailAlarm[] {
  const alarms: RailAlarm[] = []
  const at = new Date(snapshot.at).toISOString()

  for (const id of snapshot.ids) {
    const equipment = yardEquipmentOf(id)
    if (!equipment) continue
    const typeName = equipmentTypeOf(equipment.typeId)?.name ?? equipment.typeId
    const base = {
      kind: 'equipment' as const,
      source: id,
      href: hrefOf(equipment),
      occurredAt: at,
    }

    /* 틸팅 — 모터 알람으로 에러 모드. 페어 라이다가 엉뚱한 곳을 보게 된다 */
    const tilt = snapshot.tilt.get(id)
    if (tilt && tilt.mode === 'error') {
      alarms.push({
        ...base,
        id: `equip:tilt:${id}`,
        severity: 'critical',
        titleKey: 'alarms.rail.tiltMotor.title',
        messageKey: 'alarms.rail.tiltMotor.message',
        messageParams: { id, code: tilt.motorAlarm, lidar: tilt.pairedLidarId ?? '—' },
      })
      continue
    }

    /* Edge PC — 수집 서비스가 죽었거나(critical) 판 자체가 안 보인다(offline: warning) */
    const edge = snapshot.edgePc.get(id)
    if (edge) {
      if (edge.collector === 'exited' || edge.link === 'error') {
        alarms.push({
          ...base,
          id: `equip:edge:${id}`,
          severity: 'critical',
          titleKey: 'alarms.rail.edgeDown.title',
          messageKey: 'alarms.rail.edgeDown.message',
          messageParams: { id, restarts: edge.collectorRestarts },
        })
        continue
      }
      if (edge.link === 'offline') {
        const minutes = Math.max(0, Math.round((snapshot.at - edge.lastHeartbeatAt) / 60_000))
        alarms.push({
          ...base,
          id: `equip:edge:${id}`,
          severity: 'warning',
          titleKey: 'alarms.rail.edgeOffline.title',
          messageKey: 'alarms.rail.edgeOffline.message',
          messageParams: { id, minutes },
        })
        continue
      }
      continue /* Edge 는 캐비닛 판정으로 내려보내지 않는다 — 같은 판을 두 번 세지 않는다 */
    }

    /* 캐비닛(Network Panel) — 정지면 소속이 통째로 눈이 먼다 */
    const panel = snapshot.panel.get(id)
    if (panel) {
      if (panel.health === 'down') {
        alarms.push({
          ...base,
          id: `equip:panel:${id}`,
          severity: 'critical',
          titleKey: 'alarms.rail.panelDown.title',
          messageKey: 'alarms.rail.panelDown.message',
          messageParams: { id, count: panel.memberTotal },
        })
      } else if (panel.uplink === 'error') {
        alarms.push({
          ...base,
          id: `equip:panel:${id}`,
          severity: 'warning',
          titleKey: 'alarms.rail.panelUplink.title',
          messageKey: 'alarms.rail.panelUplink.message',
          messageParams: { id },
        })
      }
      continue
    }

    /* 그 밖의 설비(라이다 등) — 응답 오류만. 오프라인은 위 주석의 이유로 세우지 않는다 */
    if (snapshot.link.get(id) === 'error') {
      alarms.push({
        ...base,
        id: `equip:link:${id}`,
        severity: 'warning',
        titleKey: 'alarms.rail.linkError.title',
        messageKey: 'alarms.rail.linkError.message',
        messageParams: { id, type: typeName },
      })
    }
  }
  return alarms
}

/* ── 3-a. 도장 일일 배치 미도착 ──────────────────────────────────
 * YPWG413M 등록은 하루 1회 일괄이라 정상 상태의 최신 실적일은 **어제**다(D+1).
 * 어제 것도 없으면 배치가 안 돈 것이다 — D+2 부터 알람이 선다.
 */

/** 'YYYY-MM-DD' 두 날짜의 차이(일). a 가 뒤면 양수 */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86_400_000)
}

export function derivePaintingBatchAlarm(input: {
  baseDate: string
  /** 도장 전체에서 가장 최신인 413M 실적일 — 등록분이 하나도 없으면 null */
  latestActlDate: string | null
}): RailAlarm | null {
  const { baseDate, latestActlDate } = input
  /* 등록분이 아예 없는 것은 "늦었다"가 아니라 "판단 근거가 없다" — 지어내지 않는다 */
  if (latestActlDate == null) return null
  const lag = daysBetween(baseDate, latestActlDate)
  if (lag <= 1) return null /* 어제 등록분이 최신 = 정상 */
  return {
    id: 'batch:painting-413m',
    severity: lag >= 3 ? 'critical' : 'warning',
    kind: 'batch',
    titleKey: 'alarms.rail.batch.title',
    titleParams: { lag },
    messageKey: 'alarms.rail.batch.message',
    messageParams: { date: latestActlDate, lag },
    source: 'YPWG413M',
    href: '/indoorshop/performance',
    occurredAt: `${latestActlDate}T00:00:00`,
  }
}

/* ── 3-b. 수집 이벤트 공백 ──────────────────────────────────────
 * 공정 하나의 최근 수집이 임계를 넘도록 조용하다 — 설비 한 대의 문제가 아니라
 * 공정 전체의 흐름이 멎었다는 신호라서 배치 축과 같은 자리에 세운다.
 */

/** 이보다 오래 조용하면 공백으로 본다 (분) — 라이다 스캔 주기의 넉넉한 배수 */
export const COLLECTION_GAP_THRESHOLD_MINUTES = 240

export interface CollectionGapInput {
  /** 공정존 키 (`ProcessZone`) — 문구·딥링크의 재료 */
  zone: string
  /** 그 공정에서 가장 최근인 수집 이후 경과(분). 수집 이력이 아예 없으면 null */
  minutesSinceLast: number | null
  /** 최근 수집 시각 표기(HH:MM) — 문구용. null 이면 '—' */
  lastLabel: string | null
  /** 공정 화면 경로 — 딥링크 */
  href: string | null
}

export function deriveCollectionGapAlarms(
  entries: readonly CollectionGapInput[],
  options: { nowIso: string; thresholdMinutes?: number }
): RailAlarm[] {
  const threshold = options.thresholdMinutes ?? COLLECTION_GAP_THRESHOLD_MINUTES
  const alarms: RailAlarm[] = []
  for (const entry of entries) {
    /* 이력 없음은 공백이 아니라 근거 없음 — 배치 규칙과 같은 판단 */
    if (entry.minutesSinceLast == null) continue
    if (entry.minutesSinceLast < threshold) continue
    alarms.push({
      id: `gap:${entry.zone}`,
      severity: 'warning',
      kind: 'batch',
      titleKey: 'alarms.rail.gap.title',
      messageKey: 'alarms.rail.gap.message',
      /* zoneKey 는 UI 계층이 공정 이름으로 번역해 zone 파라미터로 바꿔 넣는다 */
      messageParams: {
        zoneKey: entry.zone,
        time: entry.lastLabel ?? '—',
        minutes: entry.minutesSinceLast,
      },
      source: `zone:${entry.zone}`,
      href: entry.href,
      occurredAt: options.nowIso,
    })
  }
  return alarms
}
