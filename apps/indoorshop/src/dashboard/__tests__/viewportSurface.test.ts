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

  /*
   * 탭줄과 탭 본문은 이제 공통 부품이 판을 깐다(사용자 확정: 현황 하위 탭을 폴더 탭으로) —
   * 축 탭은 폴더 탭(`FolderTabs`), 그 아래 본문은 보드의
   * 내용 칸(`FolderPanel`). 그래서 워크스페이스가 그 부품을 쓰는지, 부품이 판을 까는지를 함께 지킨다.
   */
  it.each(WORKSPACES)('%s 워크스페이스의 탭줄과 탭 본문이 그 판 위에 선다', (_zone, path) => {
    const source = readFileSync(path, 'utf8')
    /* 맨 위 갈래 [현황 | 실적] 알약 탭은 걷었다(사용자 확정) — 헤더 메뉴 드롭다운이 고른다 */
    expect(source).not.toContain('<PillTabs')
    expect(source).toContain('<FolderTabs')
    /* 축 탭을 보드의 머리로 넘긴다 — 보드(`EquipmentStatusBoard`)가 그 아래 내용 칸(`FolderPanel`)을 판으로 깐다 */
    expect(source).toContain('mainHeader={axisTabs}')
  })

  it('공통 탭 부품이 판을 깐다 — 알약 탭 줄 · 고른 폴더 탭 · 내용 칸', () => {
    const pill = readFileSync('src/dashboard/shared/ui/atoms/PillTabs.tsx', 'utf8')
    const folder = readFileSync('src/dashboard/shared/ui/atoms/FolderTabs.tsx', 'utf8')
    const board = readFileSync('src/dashboard/shared/features/equipment-status-board/ui/EquipmentStatusBoard.tsx', 'utf8')
    expect(pill).toContain('viewport-surface')
    expect(pill).toContain('role="tablist"')
    /* 고른 탭은 내용 칸과 같은 판 색으로 칸의 윗변을 덮는다 — 줄만 밝으면 같은 반전이 작게 되풀이된다 */
    expect(folder).toContain('bg-[var(--viewport)]')
    expect(folder).toContain("surface && 'viewport-surface'")
    expect(folder).toMatch(/surface = true/)
    /* 보드의 내용 칸은 판을 끄지 않는다 */
    expect(board).toContain('<FolderPanel')
    expect(board).not.toMatch(/<FolderPanel[^>]*surface=\{false\}/)
  })
})
