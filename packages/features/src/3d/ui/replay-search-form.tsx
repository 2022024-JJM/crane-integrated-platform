import { Search, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import { cn } from '@crane/core/lib/utils';

interface ReplaySearchFormProps {
  draftFrom: string;
  draftTo: string;
  onDraftFromChange: (v: string) => void;
  onDraftToChange: (v: string) => void;
  onSearch: () => void;
  canSearch: boolean;
  validationReason: string | null | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  className?: string;
}

export function ReplaySearchForm({
  draftFrom,
  draftTo,
  onDraftFromChange,
  onDraftToChange,
  onSearch,
  canSearch,
  validationReason,
  isLoading,
  isError,
  errorMessage,
  className,
}: ReplaySearchFormProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'bg-background/85 border-border/60 flex flex-col gap-2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      <p className="text-sm font-medium">{t('common:replay.searchForm')}</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="w-8 shrink-0">{t('common:from')}</span>
          <input
            type="datetime-local"
            value={draftFrom}
            onChange={(e) => onDraftFromChange(e.target.value)}
            className="bg-background border-input focus:ring-ring w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1"
          />
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="w-8 shrink-0">{t('common:to')}</span>
          <input
            type="datetime-local"
            value={draftTo}
            onChange={(e) => onDraftToChange(e.target.value)}
            className="bg-background border-input focus:ring-ring w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1"
          />
        </label>
      </div>

      {validationReason ? (
        <p className="text-destructive text-xs">{validationReason}</p>
      ) : null}

      {isError && errorMessage ? (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <AlertCircle className="size-3 shrink-0" />
          {errorMessage}
        </p>
      ) : null}

      <Button
        size="sm"
        disabled={!canSearch || isLoading}
        onClick={onSearch}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="mr-1 size-3 animate-spin" />
        ) : (
          <Search className="mr-1 size-3" />
        )}
        {isLoading ? t('common:replay.loading') : t('common:replay.fetch')}
      </Button>
    </div>
  );
}
