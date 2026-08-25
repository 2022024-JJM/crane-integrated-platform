import type { InshopKey } from '../../../lib/i18n/keys'
import type { DocContent, DocMeta } from '../model/types'

/*
 * 레포 안의 마크다운 문서를 그대로 읽어 온다.
 *
 * 링크만 걸어 두면 클릭했을 때 파일을 내려받거나 GitHub 로 나가야 하는데, OT망
 * 현황판에서는 둘 다 막혀 있다 — 그래서 문서를 **번들에 담아 화면 안에서** 읽는다.
 * 문서가 늘거나 이름이 바뀌어도 이 파일을 고칠 필요는 없다 (glob 이 잡는다).
 *
 * 본문을 eager 로 담는 이유: 제목·요약을 문서 첫 줄에서 뽑기 때문에 목록을 그리려면
 * 어차피 내용이 필요하다. 문서 전체가 80KB 남짓이라 청크 하나로 들고 가는 편이
 * 문서마다 동적 import 를 거는 것보다 단순하고 빠르다. (문서가 몇 배로 늘면
 * 메타만 빌드 시점에 뽑아 두고 본문은 lazy 로 돌리는 편이 낫다.)
 */
const rawDocs: Record<string, string> = import.meta.glob('../content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * glob 키를 원본 레포(ocean-inshop-process) 기준 경로로 되돌린다.
 *
 * 원본은 레포 루트의 `docs/*.md` 와 `AGENTS.md` 를 직접 glob 했다. 이식 후에는
 * 그 파일들이 이 패키지의 `entities/doc/content/` 로 함께 들어와 있으므로 —
 * 셸 레포의 `docs/` 는 크레인 쪽 문서라 여기서 읽을 것이 아니다 — glob 은
 * 그 폴더만 보고, 표시용 경로는 파일 이름으로 원래 위치를 되살린다.
 */
const WEB_DASHBOARD_DOCS = new Set(['ROUTING.md'])
const REPO_ROOT_DOCS = new Set(['AGENTS.md'])

function toRepoPath(globKey: string): string {
  const name = fileNameOf(globKey)
  if (REPO_ROOT_DOCS.has(name)) return name
  if (WEB_DASHBOARD_DOCS.has(name)) return `web-dashboard/${name}`
  return `docs/${name}`
}

function fileNameOf(globKey: string): string {
  return globKey.slice(globKey.lastIndexOf('/') + 1)
}

/** 문서 묶음 — 목록에서 이 이름으로 나눈다 (이름 자체는 화면이 번역한다) */
function groupKeyOf(repoPath: string): InshopKey {
  if (repoPath.startsWith('docs/')) return 'docs.groups.design'
  if (repoPath.startsWith('web-dashboard/')) return 'docs.groups.frontend'
  return 'docs.groups.convention'
}

/** 문서의 첫 `#` 제목 — 없으면 빈 문자열 */
function headingOf(markdown: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)
  return heading ? heading[1].trim() : ''
}

/**
 * 목록에 낼 한 줄 설명.
 *
 * "제목 다음 첫 줄"을 그냥 집으면 목차(`1. [개요](#1-개요)`)나 코드펜스 안의
 * 경로가 잡힌다 — 설계 문서 대부분이 목차로 시작하기 때문이다. 그래서 문장으로
 * 읽히지 않는 줄(표·인용·목록·링크·코드)은 전부 건너뛰고 첫 **산문**을 찾는다.
 */
function summaryOf(markdown: string): string {
  let inFence = false
  let seenHeading = false

  for (const line of markdown.split('\n')) {
    const text = line.trim()
    if (/^```/.test(text)) {
      inFence = !inFence
      continue
    }
    if (inFence || !text) continue
    if (text.startsWith('#')) {
      seenHeading = true
      continue
    }
    if (!seenHeading) continue
    // 표·인용·목록·목차 항목·이미지·링크로 시작하는 줄은 설명이 아니다
    if (/^([|>\-*+[!]|\d+[.)]\s)/.test(text)) continue

    const plain = text.replace(/[*`_]/g, '').trim()
    if (plain.length < 10) continue
    return plain.slice(0, 140)
  }

  // 설명을 못 찾으면 빈 값으로 둔다 — 대체 문구는 언어를 아는 화면이 채운다
  return ''
}

/** 한글 기준 분당 500자 정도로 잡는다 */
function readingMinutesOf(markdown: string): number {
  return Math.max(1, Math.round(markdown.length / 500))
}

export interface DocGroup {
  titleKey: InshopKey
  docs: DocMeta[]
}

const docs: DocContent[] = Object.entries(rawDocs)
  .map(([globKey, markdown]) => {
    const fileName = fileNameOf(globKey)
    const repoPath = toRepoPath(globKey)
    const id = fileName.replace(/\.md$/i, '')
    const heading = headingOf(markdown)

    return {
      id,
      fileName,
      repoPath,
      /*
       * 제목은 문서의 `#` 이 아니라 **파일 이름**이다.
       * 설계 문서 여러 개가 같은 `# 내업 공정실적 자동수집 시스템` 으로 시작해서,
       * 첫 제목을 쓰면 목록에 같은 이름의 카드가 세 장 뜬다. 사람들도 이 문서들을
       * 파일 이름으로 부른다.
       */
      title: id,
      heading: heading && heading !== id ? heading : undefined,
      summary: summaryOf(markdown),
      readingMinutes: readingMinutesOf(markdown),
      markdown,
    }
  })
  .sort((a, b) => a.repoPath.localeCompare(b.repoPath, 'ko'))

export function listDocs(): DocMeta[] {
  // 본문(markdown)은 목록에 흘리지 않는다 — 목록이 쓰는 것은 메타뿐이다
  return docs.map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 나머지만 남기려고 구조분해로 덜어낸다
    ({ markdown: _markdown, ...meta }) => meta,
  )
}

export function listDocGroups(): DocGroup[] {
  const groups = new Map<InshopKey, DocMeta[]>()
  for (const doc of listDocs()) {
    const group = groupKeyOf(doc.repoPath)
    const bucket = groups.get(group)
    if (bucket) bucket.push(doc)
    else groups.set(group, [doc])
  }
  return [...groups].map(([titleKey, groupDocs]) => ({ titleKey, docs: groupDocs }))
}

export function findDoc(id: string | undefined): DocContent | undefined {
  if (!id) return undefined
  return docs.find((doc) => doc.id === id)
}
