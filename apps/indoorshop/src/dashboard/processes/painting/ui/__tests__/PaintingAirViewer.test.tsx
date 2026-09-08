import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import { addProcessMessages } from '../../../../shared/lib/testing/processMessages'
import { paintingKo } from '../../i18n/ko'
import { paintingEn } from '../../i18n/en'
import type { BayAirState } from '../../lib/airEffect'
import { buildBayScene, estimateDrawCalls, type BayScene } from '../../lib/bayScene'
import { gridFloorPlan } from '../../lib/floorPlan'
import { PaintingAirViewer } from '../PaintingAirViewer'

/* 공정 문구는 부트스트랩이 얹는다 — 컴포넌트 하나만 그리는 테스트는 직접 얹어야 한다 */
addProcessMessages(paintingKo, paintingEn)

/**
 * 가동 뷰의 **껍데기와 계기** 계약 (P5 · R38).
 *
 * 3D 로 그린 공기·형상·배치 자체는 jsdom 이 볼 수 없다 — WebGL 컨텍스트가 없기 때문이다.
 * 그래서 여기서 보는 것은 둘이다:
 *  ① 껍데기 — 그릴 수 없는 환경에서도 **왜 못 그리는지 말하는가**, 범례가 색만으로 말하지
 *     않는가.
 *  ② 계기(計器) — 화면이 **제가 무엇을 세웠는지** 말하는가(베이 수·설비 수·배치 출처·
 *     그리기 콜 어림수). 그림을 못 봐도 이 숫자는 볼 수 있다.
 *
 * 배치·자리·라벨 문구의 규칙은 `lib/__tests__/*`·`ui/__tests__/bayLabel.test.ts` 가 본다 —
 * 렌더 코드 밖에 둔 이유가 그것이다.
 */
function unit(
  id: string,
  kind: BayAirState['units'][number]['kind'],
  running: boolean
): BayAirState['units'][number] {
  return {
    id,
    kind,
    x: 0,
    y: 0,
    running,
    intensity: running ? 0.6 : 0,
    value: running ? 21 : null,
    setpoint: running ? 26 : null,
  }
}

function bay(over: Partial<BayAirState> = {}): BayAirState {
  const units = over.units ?? [unit('H1', '가스히터', true), unit('D1', '제습기', false)]
  return {
    bay: 'B1',
    mode: 'heating',
    hazeIntensity: 0.6,
    streakIntensity: 0,
    runningCount: units.filter((u) => u.running).length,
    env: { tempC: 21, tempSetpoint: 26, humidityRh: null, humiditySetpoint: null },
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    ...over,
    units,
  }
}

function scene(air: BayAirState[], bays = air.map((state) => state.bay)): BayScene {
  return buildBayScene({ floor: gridFloorPlan('테스트 도장공장', bays), air })
}

describe('뷰포트 껍데기', () => {
  it('뷰포트 자리가 선다', () => {
    renderWithProviders(<PaintingAirViewer scene={scene([bay()])} />)
    expect(screen.getByTestId('painting-air-viewport')).toBeInTheDocument()
  })

  it('WebGL 이 없으면 이유를 말하고 물러선다 — 빈 검은 화면으로 두지 않는다', () => {
    renderWithProviders(<PaintingAirViewer scene={scene([bay()])} />)
    expect(screen.getByRole('status')).toHaveTextContent(/WebGL/)
  })

  it('그릴 수 없어도 범례는 남는다 — 이 뷰가 무엇인지는 여전히 말한다', () => {
    renderWithProviders(<PaintingAirViewer scene={scene([bay()])} />)
    expect(screen.getByText('가스히터 가동 — 열 헤이즈')).toBeInTheDocument()
  })
})

describe('범례 — 색만으로 말하지 않는다', () => {
  it('세 상태를 글자로 적는다', () => {
    renderWithProviders(<PaintingAirViewer scene={scene([bay()])} />)
    expect(screen.getByText('가스히터 가동 — 열 헤이즈')).toBeInTheDocument()
    expect(screen.getByText('제습기 가동 — 제습 기류')).toBeInTheDocument()
    expect(screen.getByText('정지 — 자리만 남김')).toBeInTheDocument()
  })

  it('세기가 무엇을 뜻하는지 적는다 — 진하기가 값이라는 사실', () => {
    renderWithProviders(<PaintingAirViewer scene={scene([bay()])} />)
    expect(
      screen.getByText('진하기·속도 = 목표와의 차이 (온도 미달·습도 초과)')
    ).toBeInTheDocument()
  })
})

describe('계기 — 화면이 제가 세운 것을 말한다', () => {
  it('베이 수·설비 수를 글자로 적는다', () => {
    const built = scene([bay(), bay({ bay: 'B2' })])
    renderWithProviders(<PaintingAirViewer scene={built} />)
    expect(screen.getByText(/2개 베이/)).toBeInTheDocument()
    expect(screen.getByText(/설비 4대/)).toBeInTheDocument()
    expect(screen.getByText('가동 2대')).toBeInTheDocument()
  })

  it('뷰포트가 세운 장면을 속성으로 남긴다 — 그림을 못 봐도 검사할 수 있게', () => {
    const built = scene([bay(), bay({ bay: 'B2' })], ['B1', 'B2', 'B3'])
    renderWithProviders(<PaintingAirViewer scene={built} />)
    const viewport = screen.getByTestId('painting-air-viewport')
    expect(viewport).toHaveAttribute('data-bay-count', '3')
    expect(viewport).toHaveAttribute('data-active-bays', '2')
    expect(viewport).toHaveAttribute('data-unit-count', '4')
    expect(viewport).toHaveAttribute('data-draw-calls', String(estimateDrawCalls(built)))
  })

  it('실형상 배치가 아니면 그렇다고 말한다 — 격자를 실측인 척하지 않는다', () => {
    renderWithProviders(<PaintingAirViewer scene={scene([bay()])} />)
    expect(screen.getByText('실형상 배치 없음 — 격자로 갈음')).toBeInTheDocument()
    expect(screen.getByTestId('painting-air-viewport')).toHaveAttribute(
      'data-layout-source',
      'grid'
    )
  })
})

describe('마운트·언마운트', () => {
  it('베이가 여럿이어도 한 번에 선다', () => {
    renderWithProviders(
      <PaintingAirViewer
        scene={scene([bay(), bay({ bay: 'B2', mode: 'drying', hazeIntensity: 0, streakIntensity: 0.8 })])}
      />
    )
    expect(screen.getByTestId('painting-air-viewport')).toBeInTheDocument()
  })

  it('전부 정지여도 터지지 않는다 — 정지 화면이 정상이다', () => {
    renderWithProviders(
      <PaintingAirViewer
        scene={scene([
          bay({
            mode: 'idle',
            hazeIntensity: 0,
            streakIntensity: 0,
            units: [unit('H1', '가스히터', false)],
          }),
        ])}
      />
    )
    expect(screen.getByTestId('painting-air-viewport')).toBeInTheDocument()
  })

  /* three 는 WebGL 컨텍스트 생성 실패를 스스로 console.error 로 알린다(이 환경에선 늘
     찍힌다). 그래서 콘솔이 아니라 **정리가 끝났는가**를 본다. */
  it('언마운트가 터지지 않고 자리를 걷는다', () => {
    const { unmount } = renderWithProviders(<PaintingAirViewer scene={scene([bay()])} />)
    expect(() => unmount()).not.toThrow()
    expect(screen.queryByTestId('painting-air-viewport')).not.toBeInTheDocument()
  })
})
