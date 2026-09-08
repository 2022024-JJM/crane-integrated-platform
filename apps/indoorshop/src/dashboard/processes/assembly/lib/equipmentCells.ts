import type { ReactNode } from 'react'
import {
  linkIn,
  pairOf,
  tiltStatusIn,
  type EdgePcStatus,
  type EquipmentStatusSnapshot,
  type LinkState,
  type TiltModuleStatus,
  type YardEquipment,
} from '../../../shared/entities/equipment'
import type { StatusMeaning } from '../../../shared/ui/statusPalette'
import { worstMeaning, type EquipmentCell, type EquipmentLamp } from '../../../shared/features/equipment-grid'

/*
 * 설비 → **그리드 셀** 변환 (조립 몫).
 *
 * 그리드는 공정을 모른다 — 무엇이 램프가 되고 무엇이 핵심 수치가 되는지는 공정이 정한다.
 * 여기서 정하는 규약(레퍼런스 §3.2·§3.4):
 *
 *  · **라이다 + 틸팅 = 한 칸.** 물리적으로 1.7m 안에 한 자리로 서서 한 몫을 한다.
 *    두 칸으로 가르면 337 → 674칸이 되어 스케일 문제를 두 배로 만든다.
 *    램프 셋 중 **둘째가 틸팅**이고, 틸팅이 에러면 그 램프만 붉어진다.
 *  · **핵심 수치는 신선도 하나.** 이상이면 그 자리가 사유가 된다("오프라인").
 *  · 각도·자원 지표는 셀에 넣지 않고 펼침 상세로 내린다 — 다만 **틸팅이 대기가 아닐 때**
 *    (틸팅중·에러·목표 미도달)는 한 줄로 부기한다: 클릭 없이 보여야 한다는 것이 R13 의
 *    완료 기준이고, 대기 상태에서는 그 줄이 서지 않아 소음이 되지 않는다.
 *
 * 순수 함수다 — 상태는 **구독 스냅샷**을 인자로 받는다. 여기서 mock 을 다시 부르면
 * 같은 설비가 그리드와 마커에서 다른 값을 말하게 된다(연계 매트릭스가 잡아낸 그 병).
 */

/** 링크 3분류 → 상태 의미. 색이 아니라 뜻을 고른다 */
export function meaningOfLink(link: LinkState): StatusMeaning {
  if (link === 'online') return 'done'
  if (link === 'error') return 'error'
  return 'warning'
}

/** 링크 3분류의 우리말 — 캐비닛 대표값 자리에 그대로 선다 */
const LINK_TEXT: Record<LinkState, string> = {
  online: '온라인',
  offline: '오프라인',
  error: '통신 오류',
}

/** 틸팅 모드 → 상태 의미 — 대기·틸팅중은 이상이 아니다 */
function meaningOfTiltMode(mode: TiltModuleStatus['mode']): StatusMeaning {
  if (mode === 'error') return 'error'
  if (mode === 'tilting') return 'inProgress'
  return 'done'
}

/**
 * 신선도 문구 — 이상이면 수치 자리가 사유를 말한다.
 *
 * `at`(마지막 수신 시각)을 넘기면 셀이 경과를 **스스로 흘린다**(R19 실시간감) — 이 값이
 * 없으면 화면은 멈춘 문구만 보여 주고, 멈춘 것인지 조용한 것인지 구분되지 않는다.
 */
function metricOf(link: LinkState, freshText: string, at?: number): EquipmentCell['metric'] {
  if (link === 'offline') return { text: '오프라인', meaning: 'warning', at }
  if (link === 'error') return { text: '통신 오류', meaning: 'error', at }
  return { text: freshText, meaning: 'done', at }
}

/** 라이다-틸팅 페어 한 칸 */
export function lidarPairCell(
  lidar: YardEquipment,
  snapshot: EquipmentStatusSnapshot,
  options: {
    freshText: string
    /** 마지막 스캔/하트비트 시각 — 주면 셀이 경과를 흘린다 */
    at?: number
    group?: string
    detail?: (tilt: TiltModuleStatus | null) => ReactNode
  }
): EquipmentCell {
  const tilt = pairOf(lidar)
  const tiltStatus = tilt ? tiltStatusIn(snapshot, tilt.id) : null
  const lidarLink = linkIn(snapshot, lidar.id) ?? 'offline'

  const lamps: EquipmentLamp[] = [
    { label: '링크', meaning: meaningOfLink(lidarLink), value: lidarLink },
    {
      label: '틸팅',
      meaning: tiltStatus ? meaningOfTiltMode(tiltStatus.mode) : 'idle',
      value: tiltStatus?.mode,
    },
    {
      label: '이상',
      meaning:
        lidarLink !== 'online' || tiltStatus?.mode === 'error' || (tiltStatus?.motorAlarm ?? 0) > 0
          ? 'error'
          : 'done',
    },
  ]

  /*
   * R19 — 종류별 **대표값이 한눈에**. 틸팅의 대표값은 각도이므로 대기 상태에서도 적는다:
   * 각도를 보려고 클릭해야 한다면 그 화면은 각도를 보여 주지 않는 것과 같다.
   * 목표와 어긋나 있을 때만 목표를 덧붙이고, 모드가 대기가 아닐 때만 모드를 덧붙인다 —
   * 늘 서는 줄이므로 덧붙는 말은 이상할 때만 붙어야 눈에 띈다.
   */
  const note = tiltStatus
    ? [
        `${tiltStatus.panDeg}°/${tiltStatus.tiltDeg}°`,
        tiltStatus.atTarget ? '' : `→ ${tiltStatus.targetPanDeg}°/${tiltStatus.targetTiltDeg}°`,
        tiltStatus.mode === 'error' ? '에러' : tiltStatus.mode === 'tilting' ? '틸팅중' : '',
      ]
        .filter(Boolean)
        .join(' ')
    : undefined

  return {
    id: lidar.id,
    typeId: 'LIDAR',
    label: lidar.id,
    group: options.group,
    lamps,
    metric: metricOf(lidarLink, options.freshText, options.at),
    severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
    note,
    detail: options.detail?.(tiltStatus),
  }
}

/** Edge PC 한 칸 — 램프 [링크 / MQTT / 수집 컨테이너] */
export function edgePcCell(
  equipment: YardEquipment,
  status: EdgePcStatus,
  options: { freshText: string; detail?: (status: EdgePcStatus) => ReactNode; trend?: readonly { label: string; value: number }[] }
): EquipmentCell {
  const lamps: EquipmentLamp[] = [
    { label: '링크', meaning: meaningOfLink(status.link), value: status.link },
    { label: 'MQTT', meaning: status.mqttConnected ? 'done' : 'error' },
    {
      label: '수집',
      meaning: status.collector === 'running' ? 'done' : status.collector === 'restarting' ? 'warning' : 'error',
      value: status.collector,
    },
  ]
  /*
   * R19 — Edge PC 의 대표값은 **온도·CPU** 다. 이 둘은 임계 아래에서도 적는다(열이
   * 올라가는 중인지 아닌지는 넘고 나서 알면 늦다). 임계를 넘은 나머지 자원은 뒤에
   * 덧붙는다 — Zabbix Thresholds 방식으로, 정상값에는 색을 쓰지 않는다.
   */
  const hot: string[] = [`${status.temperatureC}°C`, `CPU ${status.cpuPercent}%`]
  if (status.diskPercent > 85) hot.push(`DISK ${status.diskPercent}%`)
  if (Math.abs(status.ntpOffsetMs) > 200) hot.push(`NTP ${status.ntpOffsetMs}ms`)
  if (status.collectorRestarts > 0) hot.push(`재시작 ${status.collectorRestarts}`)

  return {
    id: equipment.id,
    typeId: 'EDGE',
    label: equipment.id,
    lamps,
    metric: metricOf(status.link, options.freshText, status.lastHeartbeatAt),
    severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
    note: hot.join(' · '),
    trend: options.trend,
    detail: options.detail?.(status),
  }
}

/** 캐비닛 한 칸 — 램프 [전원 / 업링크 / 소속 설비] */
export function panelCell(input: {
  id: string
  typeId: string
  powered: boolean
  uplink: LinkState
  memberOnline: number
  memberTotal: number
  lidarPairs: number
  detail?: ReactNode
}): EquipmentCell {
  const faulty = input.memberTotal - input.memberOnline
  const lamps: EquipmentLamp[] = [
    { label: '전원', meaning: input.powered ? 'done' : 'error' },
    { label: '업링크', meaning: meaningOfLink(input.uplink), value: input.uplink },
    { label: '소속', meaning: faulty > 0 ? 'warning' : 'done', value: `${input.memberOnline}/${input.memberTotal}` },
  ]
  return {
    id: input.id,
    typeId: input.typeId,
    label: input.id,
    lamps,
    /* R19 — 캐비닛의 대표값은 **업링크**다. 전원이 살아도 업링크가 끊기면 그 안의
       설비가 통째로 말이 없어진다. 대수는 아래 줄로 내린다. */
    metric: {
      text: LINK_TEXT[input.uplink],
      meaning: meaningOfLink(input.uplink),
    },
    severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
    note: [`소속 ${input.memberOnline}/${input.memberTotal}`, input.lidarPairs > 0 ? `라이다 ${input.lidarPairs}쌍` : '']
      .filter(Boolean)
      .join(' · '),
    detail: input.detail,
  }
}

/**
 * 짝 잃은 틸팅 한 칸.
 *
 * 도면대로면 틸팅은 늘 라이다와 한 자리에 서므로 이 칸은 서지 않는다. 그래도 만드는
 * 이유는, 페어가 깨진 데이터가 들어왔을 때 그 설비가 **조용히 사라지지 않게** 하려는
 * 것이다 — 버드뷰는 짝 없는 틸팅을 제 점으로 찍으므로, 그리드에 칸이 없으면 점을 눌러도
 * 따라올 셀이 없다(링킹이 끊긴다).
 */
export function tiltCell(
  equipment: YardEquipment,
  status: TiltModuleStatus | null,
  options: { freshText: string; group?: string }
): EquipmentCell {
  const link = status?.link ?? 'offline'
  const lamps: EquipmentLamp[] = [
    { label: '링크', meaning: meaningOfLink(link), value: link },
    { label: '틸팅', meaning: status ? meaningOfTiltMode(status.mode) : 'idle', value: status?.mode },
    { label: '페어', meaning: 'warning', value: '없음' },
  ]
  return {
    id: equipment.id,
    typeId: 'TILT',
    label: equipment.id,
    group: options.group,
    lamps,
    metric: metricOf(link, options.freshText, status?.lastMovedAt),
    severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
    note: status ? `${status.panDeg}°/${status.tiltDeg}°` : undefined,
  }
}
