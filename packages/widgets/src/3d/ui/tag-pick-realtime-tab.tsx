import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildCraneTagKey,
  getMonitoringTagMetadata,
} from '@crane/domain/monitoring';
import {
  BayChip,
  CraneLiveDot,
  TAG_CATEGORIES,
  buildTagRows,
  collectBays,
  formatTagNumber,
  resolveBoolDisplay,
  useCraneFeedConnection,
  useCraneSnapshotStore,
  type TagRow,
} from '@crane/features/3d';
import { useNow } from '@crane/core/lib/use-now';
import { cn } from '@crane/core/lib/utils';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { SearchField } from '@crane/ui/molecules/search-field';
import {
  filterPickCranes,
  filterPickTags,
  resolveSelectedCrane,
  selectedCodeForCrane,
} from '../lib/tag-pick';
import { useTagValueHistory } from '../model/use-tag-value-history';
import { TagSparkline } from './tag-sparkline';

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * 태그 연결 다이얼로그의 실시간 탭 — 검색창과 구역 칩 아래에 크레인 목록 ›
 * 그 크레인의 태그 목록 › 미리보기 세 단. 검색창·구역 칩은 태그 페이지의
 * 실시간 탭과 같은 부품(`SearchField`·`BayChip`)이다. 값은 다이얼로그가 켜 둔
 * 크레인 스냅샷 피드(스토어)에서 읽고, 고른 태그의 최근 60초는
 * `useTagValueHistory` 가 채운다.
 *
 * 선택은 초안(`value`)이 전부다 — 행을 누르면 `onChange` 로 키가 올라가고
 * 강조·미리보기는 그 키를 되읽는다. 크레인 선택만 이 탭의 상태이고, 검색·
 * 구역 칩으로 목록이 바뀌면 lib/tag-pick.ts 규칙으로 다시 고른다.
 */
export function TagPickRealtimeTab({
  value,
  onChange,
  modelCraneId,
}: {
  value: string | undefined;
  onChange: (key: string) => void;
  modelCraneId?: string;
}) {
  const { t } = useTranslation();
  const order = useCraneSnapshotStore((s) => s.order);
  const cranes = useCraneSnapshotStore((s) => s.cranes);
  const loadError = useCraneSnapshotStore((s) => s.loadError);
  const connection = useCraneFeedConnection();
  const connected = connection === 'open';
  const now = useNow(1000);
  const [query, setQuery] = useState('');
  const [bay, setBay] = useState<string>('all');
  const [picked, setPicked] = useState<string | null>(null);

  const bays = useMemo(() => collectBays(order, cranes), [order, cranes]);
  const craneFilter = useMemo(
    () => filterPickCranes(order, cranes, bay, query),
    [order, cranes, bay, query],
  );
  const selectedCrane = resolveSelectedCrane(
    picked,
    craneFilter.craneIds,
    modelCraneId,
    value,
  );
  const entry = selectedCrane ? cranes[selectedCrane] : undefined;
  const rows = useMemo(() => (entry ? buildTagRows(entry) : []), [entry]);
  const tagRows = useMemo(
    () => filterPickTags(rows, query, craneFilter.craneMatched),
    [rows, query, craneFilter.craneMatched],
  );
  const selectedCode = selectedCodeForCrane(value, selectedCrane);
  const selectedRow = selectedCode
    ? rows.find((row) => row.code === selectedCode)
    : undefined;
  const history = useTagValueHistory(
    selectedCrane,
    selectedCode,
    selectedRow !== undefined,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 px-3 py-2">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('monitoring:inspector.tagPick.search')}
          aria-label={t('monitoring:inspector.tagPick.search')}
        />
        <div
          role="group"
          aria-label={t('monitoring:tags.allBays')}
          className="flex flex-wrap gap-1"
        >
          <BayChip
            label={t('monitoring:tags.allBays')}
            count={order.length}
            pressed={bay === 'all'}
            onClick={() => setBay('all')}
          />
          {bays.map((option) => (
            <BayChip
              key={option.bay}
              label={option.bay}
              count={option.count}
              pressed={bay === option.bay}
              onClick={() => setBay(option.bay)}
            />
          ))}
        </div>
        {loadError ? (
          <p className="text-xs text-amber-500">
            {t('monitoring:tags.banner.loadError')}
          </p>
        ) : null}
      </div>
      <div className="border-border grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)_16rem] border-t">
        <aside className="border-border flex min-h-0 flex-col border-r">
          <p className="text-muted-foreground px-3.5 pt-2 pb-1 text-xs font-medium">
            {t('monitoring:inspector.tagPick.craneList')}
          </p>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="px-1.5 pb-2">
              {craneFilter.craneIds.map((id) => {
                const crane = cranes[id];
                if (!crane) return null;
                const selected = id === selectedCrane;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPicked(id)}
                      className={cn(
                        'hover:bg-muted flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                        selected && 'bg-primary/10 text-foreground',
                      )}
                    >
                      <CraneLiveDot
                        entry={crane}
                        now={now}
                        connected={connected}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{id}</span>
                        <span className="text-muted-foreground block truncate text-[10px]">
                          {crane.snapshot.bay ?? ''}
                        </span>
                      </span>
                      {!crane.snapshot.online ? (
                        <span className="text-muted-foreground text-[10px]">
                          {t('monitoring:tags.connection.off')}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
              {craneFilter.craneIds.length === 0 ? (
                <li className="text-muted-foreground px-2 py-6 text-center text-xs">
                  {t(
                    order.length === 0
                      ? 'monitoring:inspector.tagPick.noCranes'
                      : 'monitoring:tags.emptyCranes',
                  )}
                </li>
              ) : null}
            </ul>
          </ScrollArea>
        </aside>

        <section className="flex min-h-0 flex-col">
          {/* 머리글은 행과 같은 열 구성(이름 · 값 · 체크 자리)이라 "현재 값" 이
              체크 표시가 아니라 값 열 위에 선다. */}
          <div className="text-muted-foreground flex items-center gap-3 px-3.5 pt-2 pb-1 text-xs">
            <span className="min-w-0 flex-1">
              {t('monitoring:tags.columns.name')}
            </span>
            <span className="shrink-0">
              {t('monitoring:inspector.tagPick.currentValue')}
            </span>
            <span className="size-3.5 shrink-0" aria-hidden />
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-1.5 pb-2">
              {TAG_CATEGORIES.map((category) => {
                const group = tagRows.filter(
                  (row) => row.category === category,
                );
                if (group.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="text-muted-foreground px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide">
                      {t(`monitoring:tags.categories.${category}`)}
                    </p>
                    <ul>
                      {group.map((row) => (
                        <TagPickRow
                          key={row.code}
                          row={row}
                          selected={row.code === selectedCode}
                          onSelect={() => {
                            if (selectedCrane) {
                              onChange(
                                buildCraneTagKey(selectedCrane, row.code),
                              );
                            }
                          }}
                          t={t}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
              {tagRows.length === 0 ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                  {t('monitoring:inspector.tagPick.emptyTags')}
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </section>

        <aside className="border-border bg-muted/20 flex min-h-0 flex-col gap-3 overflow-y-auto border-l p-3 text-xs">
          <p className="text-muted-foreground font-medium">
            {t('monitoring:inspector.tagPick.preview')}
          </p>
          {selectedCrane && selectedRow ? (
            <>
              <div>
                <p className="text-base font-semibold">{selectedRow.name}</p>
                <p className="text-muted-foreground text-[11px]">
                  {buildCraneTagKey(selectedCrane, selectedRow.code)}
                </p>
              </div>
              <div className="border-border bg-background rounded-lg border p-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatRowValue(selectedRow, t)}{' '}
                  <span className="text-muted-foreground text-sm">
                    {selectedRow.unit ?? ''}
                  </span>
                </p>
                <TagSparkline samples={history.samples} className="mt-2" />
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {t('monitoring:inspector.tagPick.recent')}
                </p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.dataType')}
                </dt>
                <dd>
                  {getMonitoringTagMetadata(selectedRow.code).dataType ?? '—'}
                </dd>
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.category')}
                </dt>
                <dd>
                  {t(`monitoring:tags.categories.${selectedRow.category}`)}
                </dd>
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.bay')}
                </dt>
                <dd>{entry?.snapshot.bay ?? '—'}</dd>
              </dl>
            </>
          ) : (
            <p className="text-muted-foreground">
              {t('monitoring:inspector.tagPick.noSelection')}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/** 값 표기 — 불리언은 태그 페이지와 같은 글자(ON/OFF·OK/NG), 계측값은 천 단위. */
function formatRowValue(row: TagRow, t: T): string {
  if (typeof row.value === 'boolean') {
    return t(`monitoring:tags.bool.${resolveBoolDisplay(row, row.value).key}`);
  }
  return formatTagNumber(row.value, row.category === 'measurement');
}

function TagPickRow({
  row,
  selected,
  onSelect,
  t,
}: {
  row: TagRow;
  selected: boolean;
  onSelect: () => void;
  t: T;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          'hover:bg-muted flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs',
          selected && 'bg-primary/10',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted-foreground ml-1.5 text-[10px]">
            {row.code}
          </span>
        </span>
        <span className="shrink-0 tabular-nums">
          {formatRowValue(row, t)}{' '}
          <span className="text-muted-foreground">{row.unit ?? ''}</span>
        </span>
        <Check
          className={cn(
            'size-3.5 shrink-0',
            selected ? 'text-emerald-500' : 'invisible',
          )}
          aria-hidden
        />
      </button>
    </li>
  );
}
