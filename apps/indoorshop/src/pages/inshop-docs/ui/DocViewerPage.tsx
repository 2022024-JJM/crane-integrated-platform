import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../../../dashboard/shared/lib/i18n/useTranslation'
import { findDoc, listDocs } from '../../../dashboard/entities/doc/api/docsRegistry'
import { MarkdownView } from '../../../dashboard/features/doc-viewer/ui/MarkdownView'
import { extractHeadings } from '../../../dashboard/features/doc-viewer/lib/headings'
import { Card } from '../../../dashboard/shared/ui/atoms/Card'
import { LinkButton } from '../../../dashboard/shared/ui/atoms/Button'
import { ArrowLeftIcon } from '../../../dashboard/shared/ui/icons'
import { cn } from '../../../dashboard/shared/lib/utils'

export function DocViewerPage() {
  const { t } = useTranslation()
  const { docId } = useParams<{ docId: string }>()
  const doc = findDoc(docId)
  const headings = useMemo(() => (doc ? extractHeadings(doc.markdown) : []), [doc])
  /*
   * 문서의 `#` 제목은 화면 머리가 이미 내고 있다 — 본문에 한 번 더 그리면
   * 같은 제목이 위아래로 두 번 뜬다. 그래서 첫 H1 한 줄만 덜어내고 렌더링한다.
   */
  const body = useMemo(
    () => (doc ? doc.markdown.replace(/^#\s+.+\r?\n/, '') : ''),
    [doc]
  )

  if (!doc) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <h1 className="text-inshop-xl font-semibold text-foreground">{t('docs.notFound')}</h1>
        <p className="text-inshop-sm text-foreground/68">
          {t('docs.notFoundBody', { id: docId })}
        </p>
        <ul className="space-y-1.5">
          {listDocs().map((item) => (
            <li key={item.id}>
              <Link
                to={`/indoorshop/docs/${encodeURIComponent(item.id)}`}
                className="text-inshop-sm text-accent hover:underline"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
        <LinkButton to="/indoorshop/docs">{t('docs.goList')}</LinkButton>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link
        to="/indoorshop/docs"
        className="inline-flex items-center gap-1.5 text-inshop-xs text-foreground/63 transition-colors hover:text-accent"
      >
        <ArrowLeftIcon size={13} />
        {t('docs.list')}
      </Link>

      <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <article className="min-w-0 flex-1">
          <header className="mb-6 border-b border-border pb-4">
            <h1 className="text-inshop-xl font-semibold tracking-[-0.01em] text-foreground">
              {doc.heading ?? doc.title}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs text-foreground/54">
              <span>{doc.repoPath}</span>
              <span aria-hidden="true">·</span>
              <span>{t('common.minutes', { count: doc.readingMinutes })}</span>
            </p>
          </header>

          <MarkdownView markdown={body} />
        </article>

        {/*
          목차는 넓은 화면에서만 낸다 — 좁은 화면에서는 본문 위에 목차가 한 화면을
          다 먹어서, 문서를 읽으러 온 사람이 목차부터 스크롤로 넘겨야 한다.
        */}
        {headings.length > 2 && (
          <nav
            aria-label={t('docs.tocLabel')}
            className="hidden w-56 shrink-0 lg:sticky lg:top-20 lg:block"
          >
            <Card className="p-3.5">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
                {t('docs.toc')}
              </p>
              <ul className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto">
                {headings.map((heading, index) => (
                  <li key={`${heading.id}-${index}`}>
                    <a
                      href={`#${heading.id}`}
                      className={cn(
                        'block truncate rounded-inshop-xs py-0.5 text-inshop-xs transition-colors',
                        'hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        heading.level === 3 ? 'pl-3 text-foreground/58' : 'text-foreground/70',
                      )}
                      title={heading.text}
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          </nav>
        )}
      </div>
    </div>
  )
}
