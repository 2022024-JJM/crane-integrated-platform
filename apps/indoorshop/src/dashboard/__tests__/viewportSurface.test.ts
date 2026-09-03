import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * **3D 뷰어 옆의 탭은 같은 어둠 위에 선다** (UX 감사 A10).
 *
 * 조립·의장 워크스페이스는 한 탭줄 아래 ②뷰어·①센서·③블록을 둔다. 뷰어만 어둡고
 * 나머지가 흰 종이면 탭을 옮길 때마다 화면 안에서 명암이 뒤집힌다. 고치는 방법은
 * 컴포넌트를 다시 칠하는 것이 아니라 그 구획의 **바탕 토큰을 갈아 끼우는 것**이라,
 * 여기서 지키는 것도 두 가지다 — 판이 제대로 된 이름을 덮어쓰는가, 두 화면이 그 판을
 * 실제로 쓰는가.
 */

const CSS = readFileSync('src/dashboard/shared/styles/globals.css', 'utf8')

function utilityBody(name: string): string {
  const start = CSS.indexOf(`@utility ${name} {`)
  expect(start, `@utility ${name} 가 없다`).toBeGreaterThan(-1)
  const end = CSS.indexOf('\n}', start)
  return CSS.slice(start, end)
}

const WORKSPACES = [
  ['조립', 'src/dashboard/processes/assembly/ui/pages/AssemblyWorkspace.tsx'],
  ['의장', 'src/dashboard/processes/outfitting/ui/pages/OutfittingWorkspace.tsx'],
] as const

describe('뷰포트 표면', () => {
  const body = utilityBody('viewport-surface')

  /*
   * `--surface` 만 덮어써도 아무 일이 일어나지 않는다 — 유틸리티(`bg-surface`)가 읽는
   * 이름은 `--color-surface` 이고, 그 값은 `:root` 에서 이미 굳어 자식이 바꿔도 늦다.
   * 한 번 걸려 본 함정이라 검사로 남긴다.
   */
  it('유틸리티가 읽는 이름(--color-*)을 덮어쓴다 — 원본만 바꾸면 조용히 아무 일도 없다', () => {
    for (const token of [
      '--color-background',
      '--color-foreground',
      '--color-surface',
      '--color-surface-secondary',
      '--color-border',
    ]) {
      expect(body, `${token} 가 빠졌다`).toContain(token)
    }
  })

  it('상태색도 다크 램프로 바꾼다 — 라이트 상태색은 어두운 판 위에서 묻힌다', () => {
    for (const token of [
      '--color-status-healthy',
      '--color-status-progress',
      '--color-status-degraded',
      '--color-status-unhealthy',
    ]) {
      expect(body).toContain(token)
    }
  })

  it('바탕은 뷰어와 같은 판이다 — 별도 회색을 새로 만들지 않는다', () => {
    expect(body).toContain('--color-background: var(--viewport)')
  })

  it.each(WORKSPACES)('%s 워크스페이스의 탭줄과 탭 본문이 그 판 위에 선다', (_zone, path) => {
    const source = readFileSync(path, 'utf8')
    const uses = source.split('viewport-surface').length - 1
    /* 탭줄 하나 + 탭 본문 하나 — 줄만 밝으면 같은 반전이 작게 되풀이된다 */
    expect(uses).toBeGreaterThanOrEqual(2)
    expect(source).toContain('role="tablist"')
  })
})
