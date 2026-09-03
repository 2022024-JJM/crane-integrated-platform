import type { ReactNode } from 'react'
import type { StatusMeaning } from '../../../shared/ui/statusPalette'
import { worstMeaning, type EquipmentCell, type EquipmentLamp } from '../../../shared/features/equipment-grid'
import type { PaintingEquipment } from '../model/equipment'
import { statusUnit, type PaintingEquipmentStatus } from '../model/equipmentStatus'
import { mockEquipmentStatus } from './equipmentStatusMock'

/*
 * 도장 설비 → **그리드 셀** (조립·의장과 같은 규약).
 *
 * 도장은 이미 그리드형 SCADA 였지만 셀이 더 컸다 — LED 3 + `SP`/`PV` 리드아웃 2줄
 * (레퍼런스 §3.1·§3.4). 세 공정이 같은 셀을 쓰면 화면을 오갈 때 눈이 다시 적응하지
 * 않아도 되므로, 권고대로 **`PV` 한 줄만** 셀에 남기고 `SP`·가동시간·fault 는 펼침으로 내린다.
 *
 * 램프 자리는 도장의 어휘로 채운다 — [전원(가동) / 링크(Modbus) / 이상(fault)].
 *
 * ⚠️ 램프 톤(정상은 조용한 초록 — R18)은 그리드가 정한다 — 여기서는 색을 고르지 않고
 *    **뜻**만 고른다.
 * 예전 SCADA 는 정상 RUN 을 초록 LED 로, `SP` 를 시안으로 칠했다. 칸이 많아질수록
 * 그 초록·시안의 총량이 화면을 덮어 진짜 이상이 묻힌다.
 */

/** 종류 → 설비 레지스트리 종류ID (심볼·색의 근거) */
export function typeIdOfPaintingKind(kind: PaintingEquipment['kind']): string {
  return kind === '가스히터' ? 'GH' : 'DH'
}

function meaningOfLink(link: PaintingEquipmentStatus['modbusLink']): StatusMeaning {
  if (link === 'OK') return 'done'
  if (link === 'TIMEOUT') return 'warning'
  return 'error'
}

export interface PaintingCellOptions {
  statusOf: (equipment: PaintingEquipment) => PaintingEquipmentStatus | undefined
  /** PV 추이 — 이상·선택 셀에만 그려진다(그리드가 판단한다) */
  trendOf?: (equipment: PaintingEquipment) => readonly { label: string; value: number }[] | undefined
  detailOf?: (
    equipment: PaintingEquipment,
    status: PaintingEquipmentStatus | undefined
  ) => ReactNode
  /** 값을 아직 못 받은 설비의 문구 */
  pendingText: string
}

export function paintingCells(
  equipment: readonly PaintingEquipment[],
  options: PaintingCellOptions
): EquipmentCell[] {
  return equipment.map((item): EquipmentCell => {
    const status = options.statusOf(item)
    const unit = statusUnit(item.kind)
    const lamps: EquipmentLamp[] = [
      {
        label: '전원',
        meaning: status ? (status.operatingMode ? 'done' : 'idle') : 'idle',
        value: status ? (status.operatingMode ? '가동' : '정지') : undefined,
      },
      { label: '링크', meaning: status ? meaningOfLink(status.modbusLink) : 'idle', value: status?.modbusLink },
      { label: '이상', meaning: status && status.faultCode !== 0 ? 'error' : 'done' },
    ]

    /* 핵심 수치 한 개 = 실측값(PV). 통신이 끊겼으면 그 자리가 사유가 된다 */
    const metric: EquipmentCell['metric'] = !status
      ? { text: options.pendingText, meaning: 'idle' }
      : status.modbusLink === 'TIMEOUT'
        ? { text: '응답 없음', meaning: 'warning' }
        : status.modbusLink === 'CRC_ERROR'
          ? { text: '통신 오류', meaning: 'error' }
          : { text: `${status.actualValue}${unit}`, meaning: 'done' }

    return {
      id: item.id,
      typeId: typeIdOfPaintingKind(item.kind),
      label: item.id,
      group: item.bay,
      lamps,
      metric,
      severity: worstMeaning(lamps.map((lamp) => lamp.meaning)),
      /* 정지 중이면 그 사실만 한 줄 — 가동 중에는 아무 줄도 서지 않는다 */
      note: status && !status.operatingMode ? '정지' : undefined,
      trend: options.trendOf?.(item),
      detail: options.detailOf?.(item, status),
    }
  })
}

/**
 * 실측값(PV) 추이 — 같은 mock 을 **과거 시각으로 다시 부른 값**이다.
 *
 * `mockEquipmentStatus` 는 (설비ID, 시각)의 순수 함수라, 과거 시각으로 부르면 그때 폴링이
 * 보여 줬을 값이 그대로 나온다. 없는 계열을 지어내는 것이 아니라 같은 생성기를 되감는다.
 * 폴링 주기(6초)와 같은 간격으로 여섯 점 — 스파크라인이 뜻을 갖는 최소 길이다.
 */
export function paintingPvTrend(
  equipment: PaintingEquipment,
  at: number,
  stepMs = 6_000
): { label: string; value: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const when = at - (5 - i) * stepMs
    return {
      label: `${(5 - i) * (stepMs / 1000)}초 전`,
      value: mockEquipmentStatus(equipment, when).actualValue,
    }
  })
}
