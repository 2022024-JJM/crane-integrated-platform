import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * ── 3D 뷰어의 **그리기 계기** 계약 (P0) ──
 *
 * 실브라우저에서 조립·의장 3D 뷰어와 도장 가동 뷰가 한꺼번에 **빈 캔버스**로 섰던 사고의
 * 재발 방지선이다. 그때 씬도 WebGL 도 콘솔도 멀쩡했다 — 모자란 것은 딱 하나, **그릴 계기**
 * 였다. 그리기 루프는 유휴에 쉬고 숨은 탭에 멈추는데(`lib/renderLoop`), 다시 그리라고 말할
 * 자리가 비면 그 절전이 그대로 검은 화면이 된다.
 *
 * 루프 **안쪽**의 상태 전이는 `bay-viewer/__tests__/renderLoop.test.ts` 가 잠근다. 여기서
 * 잠그는 것은 **바깥쪽 배선**이다 — 뷰어가 루프를 세우고, 그 손잡이를 내놓고, 창이
 * 바뀌면 한 장을 청하고, 떠날 때 치우는가. 이 넷 중 하나라도 빠지면 그 뷰어는 언젠가
 * 빈 화면으로 선다.
 *
 * 소스를 읽어 검사하는 이유: 세 뷰어는 WebGL·워커·수십 MB 자산에 얹혀 있어 jsdom 에서
 * 통째로 띄울 수 없다. 계약이 **눈에 보이는 한 줄**이므로 그 한 줄의 존재를 지킨다.
 * 새 뷰어를 만들면 이 목록에 추가한다.
 */

const VIEWERS = [
  'src/dashboard/shared/features/bay-viewer/ui/LidarPointCloudViewer.tsx',
  'src/dashboard/processes/assembly/ui/viewer/RealScanViewer.tsx',
  'src/dashboard/processes/painting/ui/PaintingAirViewer.tsx',
] as const

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('3D 뷰어 — 그리기 계기 계약', () => {
  it.each(VIEWERS)('%s 는 공용 그리기 루프를 쓴다 — 제 rAF 루프를 따로 돌리지 않는다', (path) => {
    const code = source(path)
    expect(code).toContain('startRenderLoop(')
  })

  it.each(VIEWERS)('%s 는 씬을 세운 **뒤에** 루프를 건다 — 첫 장에 그릴 것이 있어야 한다', (path) => {
    const code = source(path)
    /* 루프는 pending=true 로 시작해 첫 장을 반드시 그린다. 그 첫 장이 의미를 가지려면
     * 렌더러·씬이 이미 서 있어야 하므로, 배선 순서가 곧 계약이다. */
    expect(code.indexOf('new THREE.WebGLRenderer')).toBeGreaterThanOrEqual(0)
    expect(code.indexOf('startRenderLoop(')).toBeGreaterThan(code.indexOf('new THREE.WebGLRenderer'))
  })

  it.each(VIEWERS)('%s 는 requestRender 를 내놓는다 — 자산 도착·표시 변경이 한 장을 청할 수 있게', (path) => {
    const code = source(path)
    expect(code).toMatch(/requestRenderRef\.current\s*=\s*loop\.requestRender/)
  })

  it.each(VIEWERS)('%s 는 크기가 바뀌면 한 장 청한다 — 리사이즈 뒤 늘어진 화면이 남지 않게', (path) => {
    const code = source(path)
    const observer = code.slice(code.indexOf('new ResizeObserver'))
    expect(observer).toMatch(/(requestRenderRef\.current\?\.\(\)|loop\.requestRender\(\))/)
  })

  it.each(VIEWERS)('%s 는 떠날 때 루프를 멈춘다 — 언마운트 뒤 도는 프레임이 없다', (path) => {
    const code = source(path)
    expect(code).toMatch(/loop\.stop\(\)/)
  })
})

describe('그리기 루프 — 깨어날 문이 막혀 있지 않다', () => {
  /*
   * P0 의 핵심 회귀다. 예전 `requestRender` 는 `pending` 만 켜고 끝나서, 잠든 루프는
   * `visibilitychange` 없이는 영영 깨어나지 못했다. 그 한 줄이 다시 사라지면
   * 뷰어 배선이 아무리 옳아도 화면은 검게 남는다.
   */
  it('requestRender 가 wake 를 지난다', () => {
    const code = source('src/dashboard/shared/features/bay-viewer/lib/renderLoop.ts')
    /* 인터페이스 선언이 아니라 **구현**을 본다 (파일 끝의 반환 객체) */
    const requestRender = code.slice(code.lastIndexOf('requestRender: () => {'))
    expect(requestRender.slice(0, 200)).toContain('wake()')
  })

  it('숨어 있을 때도 갚을 길이 있다 — 타이머로 한 장', () => {
    const code = source('src/dashboard/shared/features/bay-viewer/lib/renderLoop.ts')
    expect(code).toContain('scheduleCatchUp')
    expect(code).toMatch(/setTimer\(/)
  })
})
