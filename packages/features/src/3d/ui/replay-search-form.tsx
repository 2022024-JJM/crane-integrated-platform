import { AlertCircle, Info, Loader2, RotateCcw, Search } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  formatReplayTimestamp,
  getReplayStartMax,
  isReplayDuration,
  type ReplayDuration,
  type ReplayValidationReason,
} from '@crane/domain/monitoring';
import { Button } from '@crane/ui/atoms/button';
import { DateTimePicker } from '@crane/ui/molecules/date-time-picker';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';

interface ReplaySearchFormProps {
  draftStart: string;
  onDraftStartChange: (value: string) => void;
  /** 시작 시각을 기본값으로 되돌린다. 참조가 바뀌지 않아야 memo 가 산다. */
  onResetDraftStart: () => void;
  draftEnd: string;
  duration: ReplayDuration;
  durations: readonly ReplayDuration[];
  onDurationChange: (value: ReplayDuration) => void;
  onSearch: () => void;
  canSearch: boolean;
  validationReason: ReplayValidationReason | null | undefined;
  isLoading: boolean;
  isError: boolean;
  /** 조회는 됐는데 구간에 데이터가 없음 — 폼에 그렇다고 알린다. */
  isEmpty: boolean;
  errorMessage: string | null;
  className?: string;
  bare?: boolean;
}

/**
 * 리플레이 구간 검색 — 시작 시각 하나(달력 연·월 드롭다운 + 오전/오후·시·분·초
 * 스크롤)와 길이(10분·30분·1시간)를 고르면 종료가 따라온다.
 *
 * memo — 트랜스포트 바가 위치 폴링으로 200ms 마다 다시 그려지는데, 입력값이
 * 그대로면 폼(달력·스크롤 열)까지 따라 그릴 이유가 없다.
 */
export const ReplaySearchForm = memo(function ReplaySearchForm({
  draftStart,
  onDraftStartChange,
  onResetDraftStart,
  draftEnd,
  duration,
  durations,
  onDurationChange,
  onSearch,
  canSearch,
  validationReason,
  isLoading,
  isError,
  isEmpty,
  errorMessage,
  className,
  bare = false,
}: ReplaySearchFormProps) {
  const { t } = useTranslation();
  // 팝오버를 열 때마다 마운트되므로 그때의 지금이면 충분하다.
  const startMax = useMemo(() => getReplayStartMax(), []);
  const validationMessage = validationReason
    ? t(`common:replay.validation.${validationReason}`)
    : null;
  const queryTimeLabel =
    draftStart && draftEnd
      ? `${formatReplayTimestamp(draftStart, 'time')} ~ ${formatReplayTimestamp(draftEnd, 'time')}`
      : null;

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        !bare &&
          'bg-background/85 border-border/60 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      {!bare ? (
        <p className="text-sm font-medium">{t('common:replay.searchForm')}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">
            {t('common:replay.startAt')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onResetDraftStart}
            aria-label={t('common:replay.resetStartLabel')}
            title={t('common:replay.resetStartLabel')}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw data-icon="inline-start" />
            {t('common:replay.resetStart')}
          </Button>
        </div>
        <DateTimePicker
          size="sm"
          withSeconds
          captionLayout="dropdown"
          timeInput="scroll"
          max={startMax}
          timeHint={
            validationMessage ? (
              <>
                <AlertCircle className="text-destructive size-3.5 shrink-0" />
                {validationMessage}
              </>
            ) : null
          }
          value={draftStart}
          onChange={onDraftStartChange}
          error={Boolean(validationReason)}
          ariaLabel={t('common:replay.startAt')}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <ToggleGroup
          value={[duration]}
          onValueChange={(next) => {
            const choice = next[0];
            if (isReplayDuration(choice)) onDurationChange(choice);
          }}
          variant="outline"
          size="sm"
          className="w-full"
          aria-label={t('common:replay.durationLabel')}
        >
          {durations.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className="h-7 flex-1 text-xs"
            >
              {t(`common:replay.duration.${option}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {queryTimeLabel ? (
          <p className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
            <span>{t('common:replay.queryTime')}</span>
            <span className="text-foreground ml-auto text-right text-[11px] tabular-nums">
              {queryTimeLabel}
            </span>
          </p>
        ) : null}
      </div>

      {validationMessage ? (
        <p className="text-destructive text-xs">{validationMessage}</p>
      ) : null}

      {isError && errorMessage ? (
        <p className="text-destructive flex items-center gap-1 text-xs">
          <AlertCircle className="size-3 shrink-0" />
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !isError && isEmpty ? (
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-1 text-xs"
        >
          <Info className="size-3 shrink-0" />
          {t('common:replay.emptyResult')}
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
});
