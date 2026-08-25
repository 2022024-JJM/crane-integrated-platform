import { Link } from 'react-router-dom'
import { useTranslation } from '../lib/i18n/useTranslation'
import { ArrowLeftIcon } from '../ui/icons'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <p className="font-mono text-2xs text-foreground/50">404</p>
        <h1 className="mt-1 text-inshop-xl font-semibold text-foreground">{t('notFound.title')}</h1>
        <p className="mt-1 text-inshop-sm text-foreground/68">{t('notFound.description')}</p>
      </div>
      <Link
        to="/indoorshop"
        className="inline-flex items-center gap-1.5 rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
      >
        <ArrowLeftIcon size={14} />
        {t('notFound.goHome')}
      </Link>
    </div>
  )
}
