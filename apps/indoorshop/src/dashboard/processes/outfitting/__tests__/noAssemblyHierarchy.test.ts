import { describe, expect, it } from 'vitest'
import { outfittingKo } from '../i18n/ko'
import { outfittingEn } from '../i18n/en'

/**
 * **의장에는 조립식 계층이 없다** — 소스와 문구가 그것을 흉내내지 않는가.
 *
 * 조립은 블록 아래 중조립품·소조립 계층이 있고 화면이 그 계층을 드러낸다. 의장은 블록
 * 하나가 곧 작업 단위다. 그런데 의장 화면은 조립 뷰어·조립 mock 을 빌려 쓰기 때문에,
 * 손이 가는 대로 두면 조립의 낱말이 계속 흘러든다(실제로 '조립체 FR755'·'중조립품'
 * 인식이 의장 뷰어에 서 있었다).
 *
 * 그래서 데이터 계약(`api/__tests__/blockUnitContract`)과 별개로 **문구까지** 못 박는다.
 * 낱말은 규칙이 무너지는 첫 신호이고, 눈으로 훑어 잡기에는 파일이 너무 많다.
 */

/*
 * 의장 모듈의 소스를 **글자 그대로** 읽는다(Vite 의 `?raw`). 노드 fs 를 쓰지 않는 것은
 * 앱 tsconfig 가 노드 타입을 들지 않기 때문이고, 그 편이 번들러가 아는 경로와도 같다.
 */
const SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** 검사 대상 — 테스트 자신은 뺀다(규칙을 설명하려면 그 낱말을 써야 한다) */
const ZONE_SOURCES = Object.entries(SOURCES).filter(([path]) => !path.includes('__tests__'))

/** 조립 계층을 가리키는 낱말 — 의장 소스에 코드로 남아 있으면 안 된다 */
const ASSEMBLY_HIERARCHY_WORDS = ['중조립', '소조립', '대조립', '조립체', '조립품', 'assySerNo']

/** 규칙을 설명하는 주석은 그 낱말을 쓸 수밖에 없다 — 설명 줄만 허용한다 */
const COMMENT_PREFIXES = ['*', '//', '/*']

describe('의장 소스 — 조립 계층 낱말이 코드에 남지 않는다', () => {
  it('실행되는 줄(주석 아님)에 중조립·소조립·조립체·assySerNo 가 없다', () => {
    const offenders: string[] = []
    for (const [path, source] of ZONE_SOURCES) {
      source.split('\n').forEach((line, index) => {
        const trimmed = line.trim()
        if (COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return
        for (const word of ASSEMBLY_HIERARCHY_WORDS) {
          if (line.includes(word)) offenders.push(`${path}:${index + 1} "${word}" — ${trimmed}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it('조립 계층 단위(unitLevel) 를 고르는 코드가 없다 — 의장은 고를 계층이 없다', () => {
    const offenders = ZONE_SOURCES.filter(([, source]) => /unitLevel\s*[:=]/.test(source))
    expect(offenders.map(([path]) => path)).toEqual([])
  })
})

describe('의장 문구 — 블록 단위로만 말한다', () => {
  const flatten = (value: unknown, path = ''): [string, string][] => {
    if (typeof value === 'string') return [[path, value]]
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, path ? `${path}.${key}` : key)
      )
    }
    return []
  }

  it('한국어 문구에 조립 계층 낱말이 없다', () => {
    const offenders = flatten(outfittingKo).filter(([, text]) =>
      ASSEMBLY_HIERARCHY_WORDS.some((word) => text.includes(word))
    )
    expect(offenders).toEqual([])
  })

  it('영어 문구에 조립 계층 낱말이 없다', () => {
    const words = ['sub-assembly', 'Sub-assembly', 'subassembly', 'ASSY']
    const offenders = flatten(outfittingEn).filter(([, text]) =>
      words.some((word) => text.includes(word))
    )
    expect(offenders).toEqual([])
  })

  it("의장이 '블록'을 작업 단위로 부른다 — 문구가 그 사실을 말한다", () => {
    const texts = flatten(outfittingKo).map(([, text]) => text)
    expect(texts.some((text) => text.includes('블록'))).toBe(true)
  })
})
