import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import type { EquipmentLamp } from '../../../../shared/features/equipment-grid'
import { LampVitals, LidarVitals } from '../cellVitals'

/*
 * 칸에 세우는 램프 — **수치 자리가 말하지 못하는 것만**.
 *
 * 링크는 끊기면 수치 자리가 이미 사유를 말하고(“오프라인 · 21분 전”), 살아 있으면 경과가
 * 흐르는 것 자체가 그 증거다. 그 램프를 칸마다 세우면 수십 칸이 같은 초록 점을 되풀이하며
 * 진짜 상태 램프와 자리를 다툰다. 지도 카드는 여전히 램프 전부를 낸다 — 거기서는 한 대를
 * 들여다보는 중이라 다 적어야 한다.
 */

const EDGE_LAMPS: EquipmentLamp[] = [
  { label: '링크', meaning: 'done', value: 'online' },
  { label: 'MQTT', meaning: 'done' },
  { label: '수집', meaning: 'done', value: 'running' },
]

describe('조립 셀 활력 — 칸에 세우는 램프', () => {
  it('링크 램프는 칸에 서지 않는다 — 수치 자리의 몫이다', () => {
    renderWithProviders(<LampVitals lamps={EDGE_LAMPS} />)
    expect(screen.queryByLabelText(/^링크/)).toBeNull()
  })

  it('링크가 아닌 램프는 이름과 함께 선다 — 종류마다 뜻이 다르다', () => {
    renderWithProviders(<LampVitals lamps={EDGE_LAMPS} />)
    expect(screen.getByLabelText('MQTT')).toBeInTheDocument()
    expect(screen.getByLabelText('수집 running')).toBeInTheDocument()
  })

  it('링크가 끊겨도 칸에는 세우지 않는다 — 그때는 수치 자리가 더 크게 말한다', () => {
    renderWithProviders(
      <LampVitals lamps={[{ label: '링크', meaning: 'error', value: 'error' }, EDGE_LAMPS[1]]} />
    )
    expect(screen.queryByLabelText(/^링크/)).toBeNull()
    expect(screen.getByLabelText('MQTT')).toBeInTheDocument()
  })
})

describe('조립 셀 활력 — 라이다', () => {
  const tilt = {
    id: 'PT-P01',
    link: 'online' as const,
    mode: 'idle' as const,
    panDeg: -80,
    tiltDeg: -9,
    targetPanDeg: -80,
    targetTiltDeg: -9,
    atTarget: true,
    pairedLidarId: 'LD-P01',
    motorAlarm: 0,
    lastMovedAt: 0,
  }

  it('조준 다이얼 하나만 선다 — 방향은 그림이 말한다', () => {
    renderWithProviders(<LidarVitals link="online" tilt={tilt} />)
    expect(screen.getByRole('img', { name: /방위 -80도/ })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^링크/)).toBeNull()
  })

  /* 짝이 깨진 데이터가 들어와도 없는 자세를 지어내지 않는다 */
  it('짝이 없으면 다이얼 대신 그 사실을 적는다', () => {
    renderWithProviders(<LidarVitals link="online" tilt={null} />)
    expect(screen.getByLabelText('틸팅 짝 없음')).toBeInTheDocument()
  })

  it('목표와 어긋나 있으면 접근성 이름이 목표까지 말한다', () => {
    renderWithProviders(
      <LidarVitals
        link="online"
        tilt={{ ...tilt, mode: 'tilting', atTarget: false, targetPanDeg: 20, targetTiltDeg: 5 }}
      />
    )
    expect(screen.getByRole('img', { name: /목표 20도 5도/ })).toBeInTheDocument()
  })
})
