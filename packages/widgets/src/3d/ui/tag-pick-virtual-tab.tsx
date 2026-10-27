import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  readTagLiveValue,
  useRigLivePoll,
  useTagCatalogEquipments,
  virtualTagRuntime,
  type TagCatalogEntry,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { SearchField } from '@crane/ui/molecules/search-field';
import { formatMappingValue } from '../lib/tag-mapping-editor';
import {
  filterPickEquipments,
  filterPickVirtualTags,
  resolveSelectedEquipment,
} from '../lib/tag-pick';

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * 태그 연결 다이얼로그의 가상 태그 탭 — 실시간 탭과 같은 세 단. 검색창 아래
 * 장비 목록 › 그 장비의 태그 › 미리보기. 검색창 하나가 두 목록을 겨눈다 —
 * 장비(ID·구역)에 맞으면 장비를 거르고, 아니면 태그(코드·이름)를 거른다
 * (`lib/tag-pick.ts`). 처음 고르는 장비는 연결된 키의 장비 › 모델 craneId ›
 * 첫 장비.
 *
 * 값은 러너의 현재 상태(정지 중이면 initial)를 우선 보이고, 없으면 버스
 * 캐시. 지금 연결된 키가 카탈로그에 없으면(지운 장비·옛 씬) amber 항목으로
 * 보존한다 — 사용자가 다시 고르기 전까지는 지우지 않는다.
 */
export function TagPickVirtualTab({
  value,
  onChange,
  modelCraneId,
}: {
  value: string | undefined;
  onChange: (key: string) => void;
  modelCraneId?: string;
}) {
  const { t } = useTranslation();
  const equipments = useTagCatalogEquipments();
  useRigLivePoll();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const filter = useMemo(
    () => filterPickEquipments(equipments, query),
    [equipments, query],
  );
  const selected = resolveSelectedEquipment(
    picked,
    filter.equipments,
    modelCraneId,
    value,
  );
  const entries = useMemo(
    () =>
      selected
        ? filterPickVirtualTags(
            selected.entries,
            query,
            filter.equipmentMatched,
          )
        : [],
    [selected, query, filter.equipmentMatched],
  );
  const selectedEntry = value
    ? equipments.flatMap((e) => e.entries).find((e) => e.key === value)
    : undefined;
  const unknown = Boolean(value) && !selectedEntry;

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
      <div className="border-border grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)_16rem] border-t">
        <aside className="border-border flex min-h-0 flex-col border-r">
          <p className="text-muted-foreground px-3.5 pt-2 pb-1 text-xs font-medium">
            {t('monitoring:inspector.tagPick.equipmentList')}
          </p>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="px-1.5 pb-2">
              {filter.equipments.map((equipment) => {
                const isSelected = equipment.id === selected?.id;
                return (
                  <li key={equipment.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setPicked(equipment.id)}
                      className={cn(
                        'hover:bg-muted flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                        isSelected && 'bg-primary/10 text-foreground',
                        !equipment.enabled && 'opacity-60',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {equipment.craneId}
                        </span>
                        <span className="text-muted-foreground block truncate text-[10px]">
                          {equipment.bay ?? ''}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {equipment.entries.length}
                      </span>
                    </button>
                  </li>
                );
              })}
              {equipments.length === 0 ? (
                <li className="text-muted-foreground px-2 py-6 text-center text-xs">
                  {t('monitoring:inspector.tagPick.noEquipments')}
                </li>
              ) : filter.equipments.length === 0 ? (
                <li className="text-muted-foreground px-2 py-6 text-center text-xs">
                  {t('monitoring:virtualTags.equipment.emptyFiltered')}
                </li>
              ) : null}
            </ul>
          </ScrollArea>
        </aside>

        <section className="flex min-h-0 flex-col">
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
              {unknown && value ? (
                <ul>
                  <VirtualRow
                    label={value}
                    description={t('monitoring:inspector.mapping.tagUnknown')}
                    valueText=""
                    selected
                    unknown
                    onSelect={() => onChange(value)}
                  />
                </ul>
              ) : null}
              <ul>
                {entries.map((entry) => (
                  <VirtualRow
                    key={entry.key}
                    label={entry.name}
                    description={entry.code}
                    valueText={formatEntryValue(entry, t)}
                    unit={entry.unit}
                    selected={entry.key === value}
                    dimmed={!entry.enabled}
                    onSelect={() => onChange(entry.key)}
                  />
                ))}
              </ul>
              {selected && entries.length === 0 ? (
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
          {selectedEntry ? (
            <>
              <div>
                <p className="text-base font-semibold">{selectedEntry.name}</p>
                <p className="text-muted-foreground text-[11px]">
                  {selectedEntry.key}
                </p>
              </div>
              <div className="border-border bg-background rounded-lg border p-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatEntryValue(selectedEntry, t)}{' '}
                  <span className="text-muted-foreground text-sm">
                    {selectedEntry.unit ?? ''}
                  </span>
                </p>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {t('monitoring:inspector.tagPick.currentValue')}
                </p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.dataType')}
                </dt>
                <dd>
                  {t(
                    `monitoring:virtualTags.dataTypes.${selectedEntry.dataType}`,
                  )}
                </dd>
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.unit')}
                </dt>
                <dd>{selectedEntry.unit ?? '—'}</dd>
                <dt className="text-muted-foreground">
                  {t('monitoring:inspector.tagPick.range')}
                </dt>
                <dd>
                  {selectedEntry.dataType === 'bool'
                    ? '0 ~ 1'
                    : `${selectedEntry.min} ~ ${selectedEntry.max}`}
                </dd>
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

/** 현재값 — 러너 상태(정지 중이면 initial) › 버스 캐시. 불리언은 ON/OFF. */
function formatEntryValue(entry: TagCatalogEntry, t: T): string {
  const value =
    virtualTagRuntime.getValue(entry.key) ?? readTagLiveValue(entry.key);
  if (entry.dataType === 'bool') {
    if (value === undefined) return '—';
    return t(
      value >= 0.5 ? 'monitoring:tags.bool.on' : 'monitoring:tags.bool.off',
    );
  }
  return formatMappingValue(value);
}

function VirtualRow({
  label,
  description,
  valueText,
  unit,
  selected,
  unknown = false,
  dimmed = false,
  onSelect,
}: {
  label: string;
  description: string;
  valueText: string;
  unit?: string;
  selected: boolean;
  unknown?: boolean;
  dimmed?: boolean;
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
          dimmed && 'opacity-60',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{label}</span>
          {description ? (
            <span className="text-muted-foreground ml-1.5 text-[10px]">
              {description}
            </span>
          ) : null}
        </span>
        {valueText ? (
          <span className="shrink-0 tabular-nums">
            {valueText}{' '}
            <span className="text-muted-foreground">{unit ?? ''}</span>
          </span>
        ) : null}
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
