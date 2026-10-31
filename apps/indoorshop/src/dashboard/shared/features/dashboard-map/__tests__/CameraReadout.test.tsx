import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { CameraReadout, type CameraReadoutHandle } from '../ui/CameraReadout'
import { cameraValuesOf } from '../lib/cameraValues'

/*
 * 지도 위 카메라 값 표시 — 기울기·회전·줌·위치를 보여 주고, 누르면 JSON 으로 복사한다.
 */
const VIEW = { centerLat: 34.8731162932, centerLon: 128.710665595, scale: 57105.06, pitch: 50, bearing: 312 }

describe('cameraValuesOf', () => {
  it('회전은 -180~180, 줌은 정수, 위치는 소수 여섯째 자리', () => {
    expect(cameraValuesOf(VIEW)).toEqual({
      pitch: 50,
      bearing: -48,
      scale: 57105,
      centerLat: 34.873116,
      centerLon: 128.710666,
    })
  })
})

describe('CameraReadout', () => {
  it('카메라 값이 오기 전에는 그리지 않고, 오면 기울기·회전을 보여 주며 누르면 그 둘을 JSON 으로 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const ref = createRef<CameraReadoutHandle>()
    renderWithProviders(<CameraReadout ref={ref} />)
    expect(screen.queryByRole('button')).toBeNull()

    act(() => ref.current!.updateView(VIEW))
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('기울기 50°')
    expect(button).toHaveTextContent('회전 -48°')
    /* 줌·위치는 적지 않는다 */
    expect(button).not.toHaveTextContent('줌')
    expect(button).not.toHaveTextContent('34.873116')

    await act(async () => {
      fireEvent.click(button)
    })
    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ pitch: 50, bearing: -48 }))
    expect(button).toHaveTextContent('복사됨')
  })
})
