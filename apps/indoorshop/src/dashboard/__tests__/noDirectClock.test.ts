import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * **화면 코드에 `new Date()` / `Date.now()` 금지** — 시계는 seam 뒤에만 있다.
 *
 * 이 규칙이 없으면 기준일 되감기가 조용히 반쪽이 된다. 통합실적은 `?date=` 로 사흘
 * 전을 말하는데 그 옆 화면이 제 시계를 읽어 오늘을 말하는 사고가, 코드 한 줄로 언제든
 * 다시 생긴다(연계 매트릭스 §2.3). 리뷰로 잡을 수 있는 종류가 아니라 — 새로 만드는
 * 화면마다 매번 같은 실수를 하기 때문에 — 검사로 세운다.
 *
 * 대신 `shared/lib/now` 의 `nowMs()`·`nowDate()` 를 쓴다. 그러면 테스트가 시계를 갈아
 * 끼울 수 있고(`setNowSource`), 기준일 되감기도 한 곳에서 먹는다.
 *
 * 주석·문자열 안의 언급은 세지 않는다 — 규칙을 설명하는 글까지 걸리면 아무도 규칙을
 * 적어 두지 않게 된다.
 */

const SRC = 'src/dashboard'

/**
 * 예외 — **여기서만** 기계 시계를 직접 읽는다.
 *
 * 목록을 늘릴 때는 "왜 이 파일은 seam 을 못 쓰는가"를 함께 적는다. 적을 말이 없으면
 * 그건 예외가 아니라 고쳐야 할 자리다.
 */
const ALLOWED = new Map<string, string>([
  ['src/dashboard/shared/lib/now.ts', '시계 seam 자체 — 앱의 유일한 직접 호출이 여기 있다'],
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|tsx)$/.test(path)) out.push(path)
  }
  return out
}

/** 주석·문자열 리터럴을 지운 소스 — 규칙을 설명하는 글이 규칙에 걸리지 않게 */
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

const CLOCK = /\bnew\s+Date\s*\(\s*\)|\bDate\s*\.\s*now\s*\(\s*\)/

describe('시계 seam 계약', () => {
  const files = walk(SRC)
    .map((path) => path.split('\\').join('/'))
    /* 테스트는 시계를 직접 다뤄도 된다 — 그것이 테스트가 하는 일이다 */
    .filter((path) => !/__tests__|\.test\.tsx?$/.test(path))

  it('훑을 파일이 실제로 있다 — 경로가 어긋나면 이 검사는 조용히 통과한다', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('예외 목록의 파일은 실제로 존재한다 — 죽은 예외를 남기지 않는다', () => {
    for (const path of ALLOWED.keys()) {
      expect(files, `${path} 가 목록에 있으나 소스에 없다`).toContain(path)
    }
  })

  it('화면·API·mock 어디에서도 시계를 직접 읽지 않는다', () => {
    const offenders = files
      .filter((path) => !ALLOWED.has(path))
      .filter((path) => CLOCK.test(stripCommentsAndStrings(readFileSync(path, 'utf8'))))

    expect(
      offenders,
      `시계는 shared/lib/now 의 nowMs()/nowDate() 로만 읽는다:\n  ${offenders.join('\n  ')}`
    ).toEqual([])
  })
})
