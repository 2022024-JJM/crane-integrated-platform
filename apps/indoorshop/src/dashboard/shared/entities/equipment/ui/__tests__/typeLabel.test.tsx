import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../lib/testing/renderWithProviders'
import { EQUIPMENT_TYPES } from '../..'
import { equipmentTypeFallback, equipmentTypeLabelKey } from '../typeLabel'
import { useEquipmentTypeLabel } from '../useEquipmentTypeLabel'

/**
 * 설비 종류의 **화면 이름** (W7-6D) — 도면 이름이 화면으로 새지 않는가.
 *
 * 같은 판을 지도 범례는 `Network Panel`, 목록 제목은 `캐비닛`, 상세는 `판넬` 이라 불렀다.
 * 라벨 층을 세운 목적은 그 셋을 하나로 만드는 것이고, 그 하나가 실제로 **그려지는지**는
 * 렌더까지 가 봐야 안다(문자열 계약만으로는 화면이 레지스트리를 직접 읽는 것을 못 막는다).
 */
function Probe({ typeIds }: { typeIds: readonly string[] }) {
  const labelOf = useEquipmentTypeLabel()
  return (
    <ul>
      {typeIds.map((id) => (
        <li key={id}>{labelOf(id)}</li>
      ))}
    </ul>
  )
}

describe('화면은 현장 호칭을 쓴다', () => {
  it("판넬은 '판넬' 로 그려진다 — 도면 이름 'Network Panel' 이 아니다", () => {
    renderWithProviders(<Probe typeIds={['PNL']} />)
    expect(screen.getByText('판넬')).toBeInTheDocument()
    expect(screen.queryByText('Network Panel')).not.toBeInTheDocument()
  })

  it("코드가 만든 개념어 '캐비닛' 은 어느 종류의 이름도 아니다", () => {
    renderWithProviders(<Probe typeIds={EQUIPMENT_TYPES.map((t) => t.id)} />)
    expect(screen.queryByText('캐비닛')).not.toBeInTheDocument()
  })

  it('이름이 정해진 종류는 전부 한글·현장 표기로 나온다', () => {
    renderWithProviders(<Probe typeIds={['PNL', 'HUB', 'PLC', 'CONV', 'VCAM', 'RFID']} />)
    for (const label of [
      '판넬',
      '스위치 허브',
      'PLC 제어반',
      'RS485 컨버터',
      '비전 카메라',
      'RFID 리더',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('이름이 정해지지 않은 종류는 레지스트리 이름 그대로 — 없는 이름을 지어내지 않는다', () => {
    /* 라이다·제습기·가스히터는 레지스트리 이름이 이미 현장 낱말이라 라벨을 따로 두지 않는다 */
    expect(equipmentTypeLabelKey('LIDAR')).toBeNull()
    renderWithProviders(<Probe typeIds={['LIDAR', 'DH', 'GH']} />)
    expect(screen.getByText('라이다')).toBeInTheDocument()
    expect(screen.getByText('제습기')).toBeInTheDocument()
    expect(screen.getByText('가스히터')).toBeInTheDocument()
  })

  it('모르는 종류ID 는 그 ID 를 그대로 낸다 — 빈 칸으로 두지 않는다', () => {
    renderWithProviders(<Probe typeIds={['NOPE']} />)
    expect(screen.getByText('NOPE')).toBeInTheDocument()
    expect(equipmentTypeFallback('NOPE')).toBe('NOPE')
  })
})

describe('라벨 층은 레지스트리를 덮기만 한다 — 데이터를 바꾸지 않는다', () => {
  it('레지스트리는 도면 이름을 그대로 지킨다 (도면 대조의 근거)', () => {
    const pnl = EQUIPMENT_TYPES.find((t) => t.id === 'PNL')!
    expect(pnl.name).toBe('Network Panel')
  })

  it('화면 이름이 정해진 종류는 전부 레지스트리에 실재한다', () => {
    const known = new Set(EQUIPMENT_TYPES.map((t) => t.id))
    for (const id of ['PNL', 'EDGE', 'HUB', 'PLC', 'CONV', 'VCAM', 'RFID']) {
      expect(`${id} 실재=${known.has(id)}`).toBe(`${id} 실재=true`)
    }
  })
})
