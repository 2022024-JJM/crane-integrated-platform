import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  readTagLiveValue,
  useRigLivePoll,
  useTagCatalog,
  type TagCatalogEntry,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { SearchField } from '@crane/ui/molecules/search-field';
import { formatMappingValue } from '../lib/tag-mapping-editor';
import { filterTagCatalog } from '../lib/tag-pick';

/**
 * 태그 연결 다이얼로그의 가상 태그 탭 — 가상 태그 목록(검색)에서 하나를 고른다.
 * 가상 태그가 실시간 태그 모양으로 재편되기 전까지의 목록형 선택이다.
 *
 * 지금 연결된 키가 목록에 없으면(지운 태그·옛 씬) amber 항목으로 보존한다 —
 * 사용자가 다시 고르기 전까지는 지우지 않는다(콤보박스 시절과 같은 규칙).
 */
export function TagPickVirtualTab({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (key: string) => void;
}) {
  const { t } = useTranslation();
  const catalog = useTagCatalog();
  // 현재값은 버스 캐시(readTagLiveValue)에서 — 폴링으로 다시 그린다.
  useRigLivePoll();
  const [query, setQuery] = useState('');
  const list = useMemo(
    () => filterTagCatalog(catalog, query),
    [catalog, query],
  );
  const selected = value
    ? catalog.find((entry) => entry.key === value)
    : undefined;
  const unknown = Boolean(value) && !selected;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 py-2">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('monitoring:inspector.mapping.tagSearch')}
          aria-label={t('monitoring:inspector.mapping.tagSearch')}
        />
      </div>
      <div className="border-border grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_16rem] border-t">
        <ScrollArea className="min-h-0">
          <ul className="px-1.5 py-2">
            {unknown && value ? (
              <VirtualRow
                tagKey={value}
                name={t('monitoring:inspector.mapping.tagUnknown')}
                description=""
                selected
                unknown
                onSelect={() => onChange(value)}
              />
            ) : null}
            {list.map((entry) => (
              <VirtualRow
                key={entry.key}
                tagKey={entry.key}
                name={entry.name !== entry.key ? entry.name : ''}
                description={describeEntry(entry)}
                selected={entry.key === value}
                onSelect={() => onChange(entry.key)}
              />
            ))}
            {catalog.length === 0 ? (
              <li className="text-muted-foreground px-2 py-6 text-center text-xs">
                {t('monitoring:inspector.mapping.tagEmpty')}
              </li>
            ) : list.length === 0 ? (
              <li className="text-muted-foreground px-2 py-6 text-center text-xs">
                {t('monitoring:inspector.tagPick.emptyTags')}
              </li>
            ) : null}
          </ul>
        </ScrollArea>

        <aside className="border-border bg-muted/20 flex min-h-0 flex-col gap-3 overflow-y-auto border-l p-3 text-xs">
          <p className="text-muted-foreground font-medium">
            {t('monitoring:inspector.tagPick.preview')}
          </p>
          {selected ? (
            <>
              <div>
                <p className="text-base font-semibold">{selected.name}</p>
                <p className="text-muted-foreground text-[11px]">
                  {selected.key}
                </p>
              </div>
              <div className="border-border bg-background rounded-lg border p-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMappingValue(readTagLiveValue(selected.key))}{' '}
                  <span className="text-muted-foreground text-sm">
                    {selected.unit ?? ''}
                  </span>
                </p>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {t('monitoring:inspector.tagPick.currentValue')}
                </p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.unit')}
                </dt>
                <dd>{selected.unit ?? '—'}</dd>
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.range')}
                </dt>
                <dd>{describeRange(selected) || '—'}</dd>
              </dl>
            </>
          ) : (
            <p className="text-muted-foreground">
              {unknown && value
                ? t('monitoring:inspector.mapping.tagUnknown')
                : t('monitoring:inspector.tagPick.noSelection')}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function describeRange(entry: TagCatalogEntry): string {
  return entry.min !== undefined && entry.max !== undefined
    ? `${entry.min} ~ ${entry.max}`
    : '';
}

function describeEntry(entry: TagCatalogEntry): string {
  return [entry.unit ?? '', describeRange(entry)].filter(Boolean).join(' · ');
}

function VirtualRow({
  tagKey,
  name,
  description,
  selected,
  unknown = false,
  onSelect,
}: {
  tagKey: string;
  name: string;
  description: string;
  selected: boolean;
  unknown?: boolean;
  onSelect: () => void;
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
          unknown && 'text-amber-500',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{tagKey}</span>
          {name ? (
            <span className="text-muted-foreground ml-1.5 text-[10px]">
              {name}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {description}
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
