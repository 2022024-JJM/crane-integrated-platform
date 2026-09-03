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

/** 틸팅 모드 → 상태 의미 — 대기·틸팅중은 이상이 아니다 */
function meaningOfTiltMode(mode: TiltModuleStatus['mode']): StatusMeaning {
  if (mode === 'error') return 'error'
  if (mode === 'tilting') return 'inProgress'
  return 'done'
}

/** 신선도 문구 — 이상이면 수치 자리가 사유를 말한다 */
function metricOf(link: LinkState, freshText: string): EquipmentCell['metric'] {
  if (link === 'offline') return { text: '오프라인', meaning: 'warning' }
  if (link === 'error') return { text: '통신 오류', meaning: 'error' }
  return { text: freshText, meaning: 'done' }
}

/** 라이다-틸팅 페어 한 칸 */
export function lidarPairCell(
  lidar: YardEquipment,
  snapshot: EquipmentStatusSnapshot,
  options: { freshText: string; group?: string; detail?: (tilt: TiltModuleStatus | null) => ReactNode }
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

  /* 틸팅이 대기가 아닐 때만 한 줄 — 대기 상태의 337칸에 각도를 적으면 그게 소음이다 */
  const note =
    tiltStatus && (tiltStatus.mode !== 'idle' || !tiltStatus.atTarget)
      ? `${tiltStatus.mode === 'error' ? '틸팅 에러' : '틸팅중'} ${tiltStatus.panDeg}°/${tiltStatus.tiltDeg}°`
      : undefined

  return {
    id: lidar.id,
    typeId: 'LIDAR',
    label: lidar.id,
    group: options.group,
    lamps,
    metric: metricOf(lidarLink, options.freshText),
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
  /* 임계를 넘은 자원만 한 줄로 — Zabbix Thresholds 방식(정상값에는 색도 글자도 쓰지 않는다) */
  const hot: string[] = []
  if (status.diskPercent > 85) hot.push(`DISK ${status.diskPercent}%`)
  if (status.cpuPercent > 85) hot.push(`CPU ${status.cpuPercent}%`)
  if (Math.abs(status.ntpOffsetMs) > 200) hot.push(`NTP ${status.ntpOffsetMs}ms`)
  if (status.collectorRestarts > 0) hot.push(`재시작 ${status.collectorRestarts}`)

  return {
    id: equipment.id,
    typeId: 'EDGE',
    label: equipment.id,
    lamps,
    metric: metricOf(status.link, options.freshText),
    severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
    note: hot.length > 0 ? hot.join(' · ') : undefined,
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
    metric: {
      text: `${input.memberOnline}/${input.memberTotal}`,
      meaning: faulty > 0 ? 'warning' : 'done',
    },
    severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
    note: input.lidarPairs > 0 ? `라이다 ${input.lidarPairs}쌍` : undefined,
    detail: input.detail,
  }
}
