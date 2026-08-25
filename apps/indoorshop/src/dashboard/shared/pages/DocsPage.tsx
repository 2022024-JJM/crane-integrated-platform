import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../lib/i18n/useTranslation'
import { listDocGroups } from '../entities/doc/api/docsRegistry'
import { Card, SectionHeading } from '../ui/atoms/Card'
import { DocsIcon, SearchIcon } from '../ui/icons'
import { cn } from '../lib/utils'

/**
 * 문서 목록.
 *
 * 링크가 아니라 **읽을 수 있는 문서**로 낸다 — 레포의 .md 를 그대로 번들에 담아
 * 화면 안에서 렌더링한다 (OT망에서는 GitHub 로 나갈 수 없다).
 */
export function DocsPage() {
  const { t } = useTranslation()
  const groups = useMemo(() => listDocGroups(), [])
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return groups
    return groups
      .map((group) => ({
        ...group,
        docs: group.docs.filter((doc) =>
          `${doc.title} ${doc.fileName} ${doc.summary}`.toLowerCase().includes(keyword)
        ),
      }))
      .filter((group) => group.docs.length > 0)
  }, [groups, query])

  const total = groups.reduce((count, group) => count + group.docs.length, 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div>
        <h1 className="text-inshop-xl font-semibold text-foreground">{t('docs.title')}</h1>
        <p className="mt-1 text-inshop-sm text-foreground/68">
          {t('docs.subtitle', { count: total })}
        </p>
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">{t('docs.search')}</span>
        <SearchIcon
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/45"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('docs.searchPlaceholder')}
          className={cn(
            'h-9 w-full rounded-inshop-md border border-border bg-surface pl-9 pr-3 text-inshop-sm text-foreground',
            'placeholder:text-foreground/45',
            'focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        />
      </label>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-inshop-sm text-foreground/58">
          {t('docs.noMatch', { query })}
        </p>
      ) : (
        filtered.map((group) => (
          <section key={group.titleKey}>
            <SectionHeading description={t('docs.countBadge', { count: group.docs.length })}>
              {t(group.titleKey)}
            </SectionHeading>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {group.docs.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/indoorshop/docs/${encodeURIComponent(doc.id)}`}
                  className="rounded-inshop-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Card interactive className="h-full">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-inshop-sm bg-accent/10 text-accent">
                        <DocsIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-inshop-sm font-semibold text-foreground">
                          {doc.title}
                        </h3>
                        {doc.heading && (
                          <p className="mt-0.5 truncate text-inshop-xs text-foreground/70">
                            {doc.heading}
                          </p>
                        )}
                        <p className="mt-1 line-clamp-2 text-inshop-xs leading-relaxed text-foreground/63">
                          {doc.summary}
                        </p>
                        <p className="mt-2 flex items-center gap-2 font-mono text-2xs text-foreground/50">
                          <span className="truncate">{doc.repoPath}</span>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0">{t('common.minutes', { count: doc.readingMinutes })}</span>
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
