import type { ReactNode } from 'react'
import type { StatusMeaning } from '../../../shared/ui/statusPalette'
import { worstMeaning, type EquipmentCell, type EquipmentLamp } from '../../../shared/features/equipment-grid'
import type { TiltModuleStatus } from '../../../shared/entities/equipment'
import type { OutfittingDevice } from '../model/equipment'

/*
 * 의장 설비 → **그리드 셀** (조립과 같은 규약).
 *
 * 같은 설비군(라이다·틸팅·Edge PC·판넬)이므로 셀 문법을 갈라 둘 이유가 없다
 * (레퍼런스 §3.4 — "의장 : 조립과 같은 셀"). 조립과 다른 것은 **입력 모양**뿐이라
 * (의장은 `OutfittingDevice` 한 벌로 네 종류를 다룬다) 그 변환만 여기서 한다.
 *
 * ⚠️ **라이다 + 틸팅은 한 칸**이다. 짝이 목록 안에 함께 있으면 합치고, 한쪽만 있으면
 * 그 한 대로 선다(종류별 구획처럼 한쪽만 오는 목록도 있다).
 */

const STATUS_MEANING: Record<OutfittingDevice['status'], StatusMeaning> = {
  online: 'done',
  offline: 'warning',
  error: 'error',
  calibrating: 'inProgress',
}

function meaningOfTiltMode(mode: TiltModuleStatus['mode']): StatusMeaning {
  if (mode === 'error') return 'error'
  if (mode === 'tilting') return 'inProgress'
  return 'done'
}

/** 이상이면 수치 자리가 사유를 말한다 — "왜"를 툴팁이 아니라 셀 안에 */
function metricOf(device: OutfittingDevice, freshText: string): EquipmentCell['metric'] {
  if (device.status === 'offline') return { text: '오프라인', meaning: 'warning' }
  if (device.status === 'error') return { text: '통신 오류', meaning: 'error' }
  return { text: freshText, meaning: 'done' }
}

export interface OutfittingCellOptions {
  /** 신선도 문구 — 화면이 시계를 들고 만든다(이 함수는 시각을 모른다) */
  freshTextOf: (device: OutfittingDevice) => string
  /** 이 틸팅의 상세 상태 — 페어 램프·부기의 재료 */
  tiltOf: (device: OutfittingDevice) => TiltModuleStatus | null
  detailOf?: (device: OutfittingDevice, tilt: TiltModuleStatus | null) => ReactNode
}

/**
 * 설비 목록 → 셀 목록. 라이다-틸팅 짝은 한 칸으로 접는다.
 *
 * 짝짓기 근거는 설비ID 규칙(`LD-*` ↔ 같은 꼬리의 `PT-*`)이다 — 설비 엔티티가 그 규칙으로
 * 페어를 잠그고 있고(생성기가 검사한다), 여기서 다시 지어내지 않는다.
 */
export function outfittingCells(
  devices: readonly OutfittingDevice[],
  options: OutfittingCellOptions
): EquipmentCell[] {
  const tiltById = new Map(devices.filter((d) => d.kind === 'TILT').map((d) => [d.id, d]))
  const pairedTiltIds = new Set<string>()
  const cells: EquipmentCell[] = []

  for (const device of devices) {
    if (device.kind === 'TILT') continue // 라이다 쪽에서 합쳐 세운다(남은 것만 뒤에)

    if (device.kind === 'LIDAR') {
      const mate = tiltById.get(`PT-${device.id.slice(3)}`)
      if (mate) pairedTiltIds.add(mate.id)
      const tilt = mate ? options.tiltOf(mate) : null
      const lamps: EquipmentLamp[] = [
        { label: '링크', meaning: STATUS_MEANING[device.status], value: device.status },
        {
          label: '틸팅',
          meaning: tilt ? meaningOfTiltMode(tilt.mode) : mate ? STATUS_MEANING[mate.status] : 'idle',
          value: tilt?.mode,
        },
        {
          label: '이상',
          meaning:
            device.status !== 'online' || tilt?.mode === 'error' || (tilt?.motorAlarm ?? 0) > 0
              ? 'error'
              : 'done',
        },
      ]
      cells.push({
        id: device.id,
        typeId: 'LIDAR',
        label: device.id,
        group: device.bay,
        lamps,
        metric: metricOf(device, options.freshTextOf(device)),
        severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
        /* 대기가 아닐 때만 한 줄 — 클릭 없이 보이되, 대기 337칸에 각도를 적지 않는다 */
        note:
          tilt && (tilt.mode !== 'idle' || !tilt.atTarget)
            ? `${tilt.mode === 'error' ? '틸팅 에러' : '틸팅중'} ${tilt.panDeg}°/${tilt.tiltDeg}°`
            : undefined,
        detail: options.detailOf?.(device, tilt),
      })
      continue
    }

    /* Edge PC · 판넬 — 램프는 [링크 / 관측 / 이상] 자리를 종류에 맞게 채운다 */
    const lamps: EquipmentLamp[] = [
      { label: '링크', meaning: STATUS_MEANING[device.status], value: device.status },
      { label: '수집', meaning: device.kind === 'EDGE' ? STATUS_MEANING[device.status] : 'idle' },
      { label: '이상', meaning: device.status === 'online' ? 'done' : 'error' },
    ]
    cells.push({
      id: device.id,
      typeId: device.kind,
      label: device.id,
      group: device.bay,
      lamps,
      metric: metricOf(device, options.freshTextOf(device)),
      severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
      detail: options.detailOf?.(device, null),
    })
  }

  /* 짝을 못 만난 틸팅 — 종류별 구획처럼 틸팅만 오는 목록에서는 한 대로 선다 */
  for (const device of devices) {
    if (device.kind !== 'TILT' || pairedTiltIds.has(device.id)) continue
    const tilt = options.tiltOf(device)
    const lamps: EquipmentLamp[] = [
      { label: '링크', meaning: STATUS_MEANING[device.status], value: device.status },
      { label: '모드', meaning: tilt ? meaningOfTiltMode(tilt.mode) : 'idle', value: tilt?.mode },
      { label: '이상', meaning: tilt?.mode === 'error' || device.status !== 'online' ? 'error' : 'done' },
    ]
    cells.push({
      id: device.id,
      typeId: 'TILT',
      label: device.id,
      group: device.bay,
      lamps,
      metric: metricOf(device, options.freshTextOf(device)),
      severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
      note: tilt ? `${tilt.panDeg}°/${tilt.tiltDeg}°` : undefined,
      detail: options.detailOf?.(device, tilt),
    })
  }

  return cells
}
