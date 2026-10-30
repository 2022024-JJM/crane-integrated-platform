import { ArrowLeft, Copy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseIsoMs, type CraneScope } from '@crane/domain/monitoring';
import {
  CraneLiveDot,
  TAG_CATEGORIES,
  TAG_VALUE_NULL_TEXT,
  buildTagRows,
  countTagRowsByCategory,
  filterTagRows,
  formatClock,
  formatTagNumber,
  hasTagCategories,
  resolveBoolDisplay,
  selectCraneFeed,
  useCraneSnapshotStore,
  type BoolTone,
  type TagCategory,
  type TagRow,
} from '@crane/features/3d';
import { useNow } from '@crane/core/lib/use-now';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';
import { Card, CardContent } from '@crane/ui/molecules/card';
import { SearchField } from '@crane/ui/molecules/search-field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import { copyText } from '../lib/copy-text';
import { AgeText } from './age-text';

const COLUMNS = [
  ['code', ''],
  ['name', ''],
  ['value', 'text-right'],
  ['unit', ''],
  ['range', 'text-right'],
  ['changes', 'text-right'],
  ['lastChange', ''],
  ['timestamp', ''],
] as const;

const CATEGORY_OPTIONS: readonly (TagCategory | 'all')[] = [
  'all',
  ...TAG_CATEGORIES,
];

/** 값이 바뀐 셀을 잠깐 밝히는 창. 틱(500ms)보다 길어야 한 번은 보인다. */
const FLASH_MS = 700;
/** "마지막 변경" 을 강조색으로 두는 창. */
const RECENT_CHANGE_MS = 1_500;
const COPIED_MS = 1_200;

const BOOL_VARIANT: Record<
  BoolTone,
  'success' | 'destructive' | 'secondary' | 'outline'
> = {
  good: 'success',
  bad: 'destructive',
  neutral: 'secondary',
  none: 'outline',
};

/**
 * 크레인 상세 — 머리글(목록 버튼 · 상태 점 · ID · 구역 · 마지막 수신), 태그
 * 검색(목록과 같이 맨 왼쪽)·묶음 선택·JSON 복사, 태그 표. 값은 스토어의 그
 * 크레인 항목이 바뀔 때(스냅샷마다)와 벽시계 틱마다 다시 그린다. 카탈로그가
 * 없는 크레인(외업 — 원본 이름이 코드)은 묶음 선택·머리글·이름 열 없이 코드
 * 순 한 목록이다. 값 없음(null)은 `NULL` 로 보인다.
 */
export function CraneDetail({
  scope,
  craneId,
  connected,
  onBack,
}: {
  scope: CraneScope | null;
  craneId: string;
  connected: boolean;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const entry = useCraneSnapshotStore(
    (s) => selectCraneFeed(s, scope).cranes[craneId],
  );
  const now = useNow(500);
  const [category, setCategory] = useState<TagCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const rows = useMemo(() => (entry ? buildTagRows(entry) : []), [entry]);
  const categorized = hasTagCategories(rows);
  const visible = useMemo(
    () => filterTagRows(rows, categorized ? category : 'all', query),
    [rows, categorized, category, query],
  );
  const counts = countTagRowsByCategory(visible);
  const columns = categorized
    ? COLUMNS
    : COLUMNS.filter(([column]) => column !== 'name');

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [copied]);

  const handleCopy = async () => {
    if (!entry) return;
    if (await copyText(JSON.stringify(entry.snapshot, null, 2))) {
      setCopied(true);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft />
          {t('monitoring:tags.back')}
        </Button>
        {entry ? (
          <CraneLiveDot entry={entry} now={now} connected={connected} />
        ) : null}
        <span className="text-lg font-semibold tracking-wide">{craneId}</span>
        {entry?.snapshot.bay ? (
          <span className="text-muted-foreground text-xs">
            {entry.snapshot.bay}
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 px-1 text-xs">
          <span className="text-muted-foreground">
            {t('monitoring:tags.lastReceived')}
          </span>
          <span className="font-semibold">
            {entry ? formatClock(entry.receivedAt) : '—'}
          </span>
        </span>
      </div>

      {!entry ? (
        <p className="text-muted-foreground text-xs">
          {t('monitoring:tags.unknownCrane', { craneId })}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <SearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('monitoring:tags.searchTag')}
              aria-label={t('monitoring:tags.searchTag')}
              className="w-60 max-w-full flex-none"
            />
            {categorized ? (
              <ToggleGroup
                value={[category]}
                onValueChange={(next) => {
                  const picked = next[0] as TagCategory | 'all' | undefined;
                  if (picked) setCategory(picked);
                }}
                variant="outline"
                size="sm"
                aria-label={t('monitoring:tags.categories.all')}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="h-7 px-2.5 text-xs"
                  >
                    {t(`monitoring:tags.categories.${option}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}
            <span className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void handleCopy()}
            >
              <Copy />
              {t(
                copied ? 'monitoring:tags.copied' : 'monitoring:tags.copyJson',
              )}
            </Button>
          </div>

          <Card className="shrink-0 gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
              <Table className="min-w-[760px] text-xs">
                <TableHeader>
                  <TableRow>
                    {columns.map(([column, align]) => (
                      <TableHead
                        key={column}
                        className={cn(
                          'bg-card sticky top-0 h-8 text-[11px] whitespace-nowrap',
                          align,
                        )}
                      >
                        {t(`monitoring:tags.columns.${column}`)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TAG_CATEGORIES.map((group) =>
                    counts[group] === 0 ? null : (
                      <GroupRows
                        key={group}
                        group={group}
                        count={counts[group]}
                        rows={visible}
                        now={now}
                        t={t}
                      />
                    ),
                  )}
                  {visible.map((row) =>
                    row.category === null ? (
                      <TagTableRow
                        key={row.code}
                        row={row}
                        showName={categorized}
                        now={now}
                        t={t}
                      />
                    ) : null,
                  )}
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="text-muted-foreground py-6 text-center"
                      >
                        {t('monitoring:tags.emptyCranes')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function GroupRows({
  group,
  count,
  rows,
  now,
  t,
}: {
  group: TagCategory;
  count: number;
  rows: readonly TagRow[];
  now: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <>
      <TableRow className="hover:bg-muted bg-muted">
        <TableCell
          colSpan={COLUMNS.length}
          className="text-muted-foreground py-1 text-[11px] font-semibold tracking-wide"
        >
          {t(`monitoring:tags.categories.${group}`)} · {count}
        </TableCell>
      </TableRow>
      {rows.map((row) =>
        row.category === group ? (
          <TagTableRow key={row.code} row={row} showName now={now} t={t} />
        ) : null,
      )}
    </>
  );
}

/** 계측값만 천 단위 구분 — 연도(2026)·상태 비트는 그대로. */
function formatValue(row: TagRow, value: number): string {
  return formatTagNumber(value, row.category === 'measurement');
}

function formatRange(row: TagRow): string {
  const { min, max } = row.stat;
  if (min === null || max === null) return '';
  return min === max
    ? formatValue(row, min)
    : `${formatValue(row, min)} ~ ${formatValue(row, max)}`;
}

function TagTableRow({
  row,
  showName,
  now,
  t,
}: {
  row: TagRow;
  /** 이름 열을 그리는가 — 카탈로그가 없는 크레인은 열이 없다. */
  showName: boolean;
  now: number;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const changedAgo =
    row.stat.changedAt === null ? null : now - row.stat.changedAt;
  const flash = changedAgo !== null && changedAgo < FLASH_MS;
  const recent = changedAgo !== null && changedAgo < RECENT_CHANGE_MS;
  return (
    <TableRow>
      <TableCell className="text-[11.5px] whitespace-nowrap">
        {row.code}
      </TableCell>
      {showName ? (
        <TableCell className="whitespace-nowrap">{row.name}</TableCell>
      ) : null}
      <TableCell
        className={cn(
          'text-right font-medium whitespace-nowrap tabular-nums',
          flash ? 'bg-cyan-500/30' : 'transition-colors duration-700',
        )}
      >
        {row.value === null ? (
          <span className="text-amber-600 dark:text-amber-400">
            {TAG_VALUE_NULL_TEXT}
          </span>
        ) : typeof row.value === 'boolean' ? (
          <BoolBadge row={row} value={row.value} t={t} />
        ) : (
          formatValue(row, row.value)
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{row.unit ?? ''}</TableCell>
      <TableCell className="text-muted-foreground text-right text-[11px] whitespace-nowrap">
        {formatRange(row)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right">
        {row.stat.changeCount}
      </TableCell>
      <TableCell
        className={cn(
          'text-[11px] whitespace-nowrap',
          recent && 'font-medium text-cyan-700 dark:text-cyan-300',
        )}
      >
        {changedAgo === null ? '—' : <AgeText ageMs={changedAgo} />}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {formatClock(parseIsoMs(row.timestamp))}
      </TableCell>
    </TableRow>
  );
}

function BoolBadge({
  row,
  value,
  t,
}: {
  row: TagRow;
  value: boolean;
  t: (key: string) => string;
}) {
  const display = resolveBoolDisplay(row, value);
  return (
    <Badge
      variant={BOOL_VARIANT[display.tone]}
      className={cn(
        'min-w-9 justify-center text-[10px] tracking-wide',
        display.tone === 'none' && 'text-muted-foreground',
      )}
    >
      {t(`monitoring:tags.bool.${display.key}`)}
    </Badge>
  );
}
