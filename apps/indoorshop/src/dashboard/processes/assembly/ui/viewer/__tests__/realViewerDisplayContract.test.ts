import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { showsCad, showsPoints } from '../../../../../shared/features/bay-viewer/lib/displayModes'
import type { ViewerDisplayMode } from '../../../../../shared/features/bay-viewer/lib/displayModes'

/**
 * **표시 토글 계약** — 실측 뷰어(P1·P2·P4, W9-0 진단 B1·B2·B4).
 *
 * 예전에는 단독(블록) 뷰에서 표시 모드를 무시하고 CAD 를 강제로 세웠다. 그래서 `점군`과
 * `겹쳐보기`의 렌더가 픽셀 단위로 같았고(진단에서 최대 차 0/255 로 실측), 사용자에게는
 * 버튼이 죽은 것으로 보였다. 규칙을 여기서 잠근다: **표시 모드가 언제나 이긴다.**
 *
 * 렌더 자체(WebGL)는 노드에서 세울 수 없으므로, 가시성을 정하는 **규칙 표현**을
 * 소스에서 직접 읽어 검사한다 — 이 계약이 깨지는 방식은 늘 "예외 분기를 다시 넣는 것"
 * 이었기 때문에, 그 분기의 부재를 보는 것이 가장 정확한 감시다.
 */
const SOURCE = readFileSync(resolve(__dirname, '../RealScanViewer.tsx'), 'utf8')

const MODES: ViewerDisplayMode[] = ['pcd', 'cad', 'overlay']

describe('표시 모드 어휘 — 세 모드가 뜻하는 것', () => {
  it('점군은 점만, 도면은 CAD 만, 겹쳐보기는 둘 다', () => {
    expect(MODES.map((m) => [m, showsPoints(m), showsCad(m)])).toEqual([
      ['pcd', true, false],
      ['cad', false, true],
      ['overlay', true, true],
    ])
  })
})

describe('실측 뷰어 — 표시 모드가 언제나 이긴다', () => {
  it('CAD 가시성에 focusView 예외가 없다 (P1 — 단독 뷰 점군 토글이 죽던 원인)', () => {
    expect(SOURCE).toContain('const cadVisible = showsCad(dm)')
    /* `showsCad(dm) || refs.focusView` 로 되돌아가면 여기서 걸린다 */
    expect(SOURCE).not.toMatch(/const cadVisible\s*=\s*showsCad\(dm\)\s*\|\|/)
  })

  it('윤곽 표시가 CAD 가시성에 묶여 있지 않다 (P2)', () => {
    expect(SOURCE).toMatch(/outline\.visible = so\b/)
    expect(SOURCE).not.toMatch(/outline\.visible = so && cadVisible/)
  })

  it('점 크기 슬라이더는 점군이 보이는 모드에서만 선다 (P4)', () => {
    expect(SOURCE).toContain('{showsPoints(displayMode) && (')
  })

  it('겹쳐보기 CAD 하한이 점군과 구분될 만큼 진하다 (P3)', () => {
    const match = SOURCE.match(/overviewCadMinOpacity: mode === 'factory' \? ([\d.]+) : ([\d.]+)/)
    expect(match, 'overviewCadMinOpacity 선언을 찾지 못했다').toBeTruthy()
    /* 베이 홀 뷰의 하한 — 0 이면 겹쳐보기 CAD 가 235만 점에 묻혀 토글이 안 보인다 */
    expect(Number(match![2])).toBeGreaterThanOrEqual(0.3)
    expect(Number(match![1])).toBeGreaterThanOrEqual(Number(match![2]))
  })
})

describe('목업 뷰어 — 씬 빌드가 rAF 하나에만 걸려 있지 않다', () => {
  it('rAF 가 발화하지 않는 환경을 위한 타이머 폴백이 있다 (견고성)', () => {
    const viewer = readFileSync(
      resolve(__dirname, '../../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer.tsx'),
      'utf8'
    )
    expect(viewer).toContain('window.setTimeout(build')
    /* 두 경로가 모두 열려도 씬은 한 번만 세운다 */
    expect(viewer).toMatch(/if \(done\) return/)
  })
})
