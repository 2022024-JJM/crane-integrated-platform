export interface DocHeading {
  /** 2 또는 3 — 목차에 담는 깊이는 여기까지다 (그 아래는 목차가 본문보다 길어진다) */
  level: 2 | 3
  text: string
  id: string
}

/**
 * 제목 → 앵커 id.
 *
 * 한글을 로마자로 바꾸지 않는다 — 바꿀 방법이 없고(음차 규칙이 여러 개다), id 에
 * 한글을 쓰는 것은 HTML5 에서 유효하다. 대신 공백·기호만 하이픈으로 눕힌다.
 */
export function slugifyHeading(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  )
}

/** react-markdown 이 넘기는 children 에서 순수 텍스트만 뽑는다 */
export function headingText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(headingText).join('')
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props
    return headingText(props?.children)
  }
  return ''
}

/**
 * 마크다운 원문에서 목차를 뽑는다.
 * 코드펜스 안의 `#` 주석을 제목으로 오인하지 않도록 펜스 구간은 건너뛴다.
 */
export function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = []
  let inFence = false

  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = line.match(/^(#{2,3})\s+(.+?)\s*$/)
    if (!match) continue

    const text = match[2].replace(/[*`_]/g, '').trim()
    headings.push({
      level: match[1].length === 2 ? 2 : 3,
      text,
      id: slugifyHeading(text),
    })
  }

  return headings
}
