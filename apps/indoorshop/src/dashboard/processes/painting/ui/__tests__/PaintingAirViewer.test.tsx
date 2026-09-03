import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../shared/lib/testing/renderWithProviders'
import { addProcessMessages } from '../../../../shared/lib/testing/processMessages'
import { paintingKo } from '../../i18n/ko'
import { paintingEn } from '../../i18n/en'
import type { BayAirState } from '../../lib/airEffect'
import { PaintingAirViewer } from '../PaintingAirViewer'

/* 공정 문구는 부트스트랩이 얹는다 — 컴포넌트 하나만 그리는 테스트는 직접 얹어야 한다 */
addProcessMessages(paintingKo, paintingEn)

/**
 * 가동 뷰의 **껍데기** 계약 (P5).
 *
 * 3D 로 그린 공기 자체는 jsdom 이 볼 수 없다 — WebGL 컨텍스트가 없기 때문이다. 그래서
 * 여기서 보는 것은 껍데기이고, 마침 그 '없는 환경' 이 검사 대상이기도 하다: 원격
 * 데스크톱·GPU 차단 정책에서도 화면이 통째로 죽지 않고 **왜 못 그리는지 말하는가**.
 *
 * 그 밖에 보는 것은 셋 — 뷰포트 자리가 서는가, 조작 도움말이 조립·의장과 같은 부품인가,
 * 그리고 **색만으로 말하지 않는가**(범례가 무엇이 무엇인지 글자로 적는가).
 *
 * 세기 규칙은 `lib/__tests__/airEffect.test.ts` 가 본다 — 렌더 코드 밖에 둔 이유가 이것이다.
 */
function bay(over: Partial<BayAirState> = {}): BayAirState {
  return {
    bay: 'B1',
    mode: 'heating',
    hazeIntensity: 0.6,
    streakIntensity: 0,
    units: [
      { id: 'H1', kind: '가스히터', x: 0, y: 0, running: true, intensity: 0.6 },
      { id: 'D1', kind: '제습기', x: 10, y: 10, running: false, intensity: 0 },
    ],
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    ...over,
  }
}

describe('뷰포트 껍데기', () => {
  it('뷰포트 자리가 선다', () => {
    renderWithProviders(<PaintingAirViewer bays={[bay()]} />)
    expect(screen.getByTestId('painting-air-viewport')).toBeInTheDocument()
  })

  it('WebGL 이 없으면 이유를 말하고 물러선다 — 빈 검은 화면으로 두지 않는다', () => {
    renderWithProviders(<PaintingAirViewer bays={[bay()]} />)
    expect(screen.getByRole('status')).toHaveTextContent(/WebGL/)
  })

  it('그릴 수 없어도 범례는 남는다 — 이 뷰가 무엇인지는 여전히 말한다', () => {
    renderWithProviders(<PaintingAirViewer bays={[bay()]} />)
    expect(screen.getByText('가스히터 가동 — 열 헤이즈')).toBeInTheDocument()
  })
})

describe('범례 — 색만으로 말하지 않는다', () => {
  it('세 상태를 글자로 적는다', () => {
    renderWithProviders(<PaintingAirViewer bays={[bay()]} />)
    expect(screen.getByText('가스히터 가동 — 열 헤이즈')).toBeInTheDocument()
    expect(screen.getByText('제습기 가동 — 제습 기류')).toBeInTheDocument()
    expect(screen.getByText('정지 — 자리만 남김')).toBeInTheDocument()
  })

  it('세기가 무엇을 뜻하는지 적는다 — 진하기가 값이라는 사실', () => {
    renderWithProviders(<PaintingAirViewer bays={[bay()]} />)
    expect(
      screen.getByText('진하기·속도 = 목표와의 차이 (온도 미달·습도 초과)')
    ).toBeInTheDocument()
  })
})

describe('마운트·언마운트', () => {
  it('베이가 여럿이어도 한 번에 선다', () => {
    renderWithProviders(
      <PaintingAirViewer
        bays={[bay(), bay({ bay: 'B2', mode: 'drying', hazeIntensity: 0, streakIntensity: 0.8 })]}
      />
    )
    expect(screen.getByTestId('painting-air-viewport')).toBeInTheDocument()
  })

  it('전부 정지여도 터지지 않는다 — 정지 화면이 정상이다', () => {
    renderWithProviders(
      <PaintingAirViewer
        bays={[
          bay({
            mode: 'idle',
            hazeIntensity: 0,
            streakIntensity: 0,
            units: [{ id: 'H1', kind: '가스히터', x: 0, y: 0, running: false, intensity: 0 }],
          }),
        ]}
      />
    )
    expect(screen.getByTestId('painting-air-viewport')).toBeInTheDocument()
  })

  /* three 는 WebGL 컨텍스트 생성 실패를 스스로 console.error 로 알린다(이 환경에선 늘
     찍힌다). 그래서 콘솔이 아니라 **정리가 끝났는가**를 본다. */
  it('언마운트가 터지지 않고 자리를 걷는다', () => {
    const { unmount } = renderWithProviders(<PaintingAirViewer bays={[bay()]} />)
    expect(() => unmount()).not.toThrow()
    expect(screen.queryByTestId('painting-air-viewport')).not.toBeInTheDocument()
  })
})
