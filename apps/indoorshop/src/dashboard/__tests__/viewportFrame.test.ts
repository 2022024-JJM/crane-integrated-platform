import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * **3D 뷰포트의 가장자리 여백은 한 곳에서 정한다** (`viewport-frame` / `--vp-inset`).
 *
 * 페이지 안에서 볼 때 뷰포트는 본문 여백만큼 이미 안으로 들어와 있어, 도구줄이 뷰포트
 * 안쪽 16px 에 붙어도 화면 모서리와는 넉넉히 떨어진다. 전체 화면으로 키우면 그 바깥
 * 여백이 통째로 사라져 **같은 16px 이 모니터 모서리에 딱 붙는다** — 도구줄·범례·전체화면
 * 버튼이 베젤에 닿아, 방금까지 보던 그림과 다른 화면처럼 읽힌다.
 *
 * 고치는 방법은 오버레이마다 "전체 화면이면 32px" 을 적어 넣는 것이 아니라, 여백을
 * **액자가 내는 변수**로 만드는 것이다. 그래서 여기서 지키는 것도 두 가지다 —
 * 액자가 그 변수를 실제로 키우는가, 그리고 전체 화면이 되는 화면들이 액자를 쓰는가.
 *
 * 이 검사가 없으면 오버레이 하나를 새로 붙일 때 `left-4` 로 돌아가기 쉽고, 그 하나만
 * 전체 화면에서 모서리에 붙는다 — 눈으로 보기 전에는 아무도 모른다.
 */

const CSS = readFileSync('src/dashboard/shared/styles/globals.css', 'utf8')

/** 전체 화면이 되는 3D 화면들 — `useFullscreen` 을 쥔 파일 */
const FULLSCREEN_SCREENS = [
  ['조립 워크스페이스', 'src/dashboard/processes/assembly/ui/pages/AssemblyWorkspace.tsx'],
  ['의장 워크스페이스', 'src/dashboard/processes/outfitting/ui/pages/OutfittingWorkspace.tsx'],
  ['도장 가동 뷰', 'src/dashboard/processes/painting/ui/PaintingAirTab.tsx'],
] as const

/** 그 안에서 가장자리에 붙어 사는 오버레이들 */
const EDGE_OVERLAYS = [
  ['도구줄', 'src/dashboard/shared/features/bay-viewer/ui/ViewportToolbar.tsx'],
  ['축 기즈모', 'src/dashboard/shared/features/bay-viewer/ui/ViewportAxisGizmo.tsx'],
  ['조작 도움말', 'src/dashboard/shared/features/bay-viewer/ui/ViewportHelp.tsx'],
  ['점군 범례', 'src/dashboard/shared/features/bay-viewer/ui/PointCloudLegend.tsx'],
  ['실측 뷰어', 'src/dashboard/processes/assembly/ui/viewer/RealScanViewer.tsx'],
  ['도장 가동 뷰어', 'src/dashboard/processes/painting/ui/PaintingAirViewer.tsx'],
] as const

const read = (path: string) => readFileSync(path, 'utf8')

describe('뷰포트 액자 — 가장자리 여백', () => {
  const start = CSS.indexOf('@utility viewport-frame {')

  it('액자가 여백 변수를 내고, 전체 화면에서 키운다', () => {
    expect(start, '@utility viewport-frame 가 없다').toBeGreaterThan(-1)
    const body = CSS.slice(start, CSS.indexOf('\n}\n', start))

    expect(body).toContain('--vp-inset: 1rem')
    /* 표준 이름과 Safari 접두사 둘 다 — 한쪽만 두면 그 브라우저에서 조용히 안 먹는다 */
    expect(body).toContain('&:fullscreen')
    expect(body).toContain('&:-webkit-full-screen')
    expect(body.match(/--vp-inset: 2rem/g)?.length).toBe(2)
  })

  it.each(FULLSCREEN_SCREENS)('%s 는 전체 화면이 되는 칸에 액자를 두른다', (_name, path) => {
    const source = read(path)
    expect(source).toContain('useFullscreen')
    expect(source).toContain('viewport-frame')
  })

  it.each(EDGE_OVERLAYS)('%s 는 여백을 액자에서 받는다 — 값을 직접 박지 않는다', (_name, path) => {
    const source = read(path)

    /* `absolute` 로 뜨면서 가장자리 좌표를 고정값(left-4·top-3 …)으로 박은 자리 */
    const hardCoded = source
      .split('\n')
      .filter((line) => /\babsolute\b/.test(line))
      .filter((line) => /\b(left|right|top|bottom)-\d/.test(line))

    expect(hardCoded, `여백을 직접 박은 줄:\n${hardCoded.join('\n')}`).toEqual([])
    expect(source).toContain('--vp-inset')
  })
})

describe('뷰포트 안 나가는 문', () => {
  const WORKSPACES = [
    ['조립', 'src/dashboard/processes/assembly/ui/pages/AssemblyWorkspace.tsx'],
    ['의장', 'src/dashboard/processes/outfitting/ui/pages/OutfittingWorkspace.tsx'],
  ] as const

  /*
   * **나가는 문은 도구줄 안에 상시로 선다.**
   *
   * 한때 전체 화면일 때만 띄웠다 — 페이지에는 머리글 칩이 있으니 같은 문을 두 번 세우지
   * 않으려던 것이다. 그런데 3D 에 들어와 있는 사람의 눈은 뷰포트 안에 있고 머리글은 화면
   * 위쪽 다른 구역이라, 거기 문이 있다는 사실 자체를 못 찾았다. 조건을 되살리는 변경이
   * 조용히 들어오지 않게 계약으로 못 박는다.
   */
  it.each(WORKSPACES)('%s 워크스페이스는 도구줄에 물러나기를 상시로 건다', (_name, path) => {
    const source = read(path)

    /* 도구줄의 `back` 슬롯 — 조건부(전체화면일 때만)로 감싸지 않는다 */
    expect(source).toContain('back={')
    expect(source).not.toMatch(/\{isFullscreen && \([\s\S]{0,40}<Back(Link|Action)/)
  })

  it.each(WORKSPACES)('%s 공장 뷰의 물러나기는 화면을 떠나지 않는다 (카메라만)', (_name, path) => {
    const source = read(path)
    /*
     * 여기가 이미 그 공장의 '전체' 다 — `전체보기` 가 목록 화면으로 나가 버리면 이름과
     * 동작이 어긋나고, 하단 `전체 맞춤` 과 같은 낱말이 한 화면에 둘이 된다.
     */
    expect(source).toContain('<BackAction')
    expect(source).toContain("t('viewer.fit.all')")
    expect(source).toContain('fitAllRequest')
  })

  it.each(WORKSPACES)('%s 는 나가는 문이 전부 같은 목적지를 쓴다', (_name, path) => {
    const source = read(path)
    /* 목적지를 여러 곳에서 따로 지으면 한쪽만 고쳐져 두 문이 다른 데로 나가는 날이 온다 */
    expect(source).toContain('const backLink =')
    const doors = (source.match(/<BackLink/g) ?? []).length
    expect(doors).toBeGreaterThan(0)
    expect(source.match(/backLink\.to/g)?.length).toBe(doors)
  })

  it.each(WORKSPACES)('%s 는 되돌아가기 마크업을 손으로 다시 짓지 않는다', (_name, path) => {
    /* 두 자리(머리글·도구줄)가 각자 `<Link>` 를 그리던 시절에는 한쪽만 손보면 모양이 갈렸다 */
    expect(read(path)).toMatch(/from '[^']*\/shared\/ui\/atoms\/BackLink'/)
  })
})
