import { useTranslation } from 'react-i18next';
import type { GoliathCraneDetail } from '@crane/domain/goliath-crane';
import { GoliathCraneSvgDiagram } from '@crane/features/goliath-crane';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@crane/ui/molecules/card';

function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[11px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
        LIVE
      </span>
    </div>
  );
}

export function GoliathDiagramPanel({ crane }: { crane: GoliathCraneDetail }) {
  const { t } = useTranslation('goliath-crane');

  return (
    <Card className="border-border/90 bg-card/60 border shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle>{t('diagram.title')}</CardTitle>
        <CardAction>
          <LiveBadge />
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-[350px]">
        <GoliathCraneSvgDiagram crane={crane} />
      </CardContent>
    </Card>
  );
}
