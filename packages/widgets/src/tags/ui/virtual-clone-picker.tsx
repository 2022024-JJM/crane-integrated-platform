import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CraneLiveDot,
  TAG_CATEGORIES,
  buildTagRows,
  formatTagNumber,
  resolveBoolDisplay,
  useCraneFeedConnection,
  useCraneSnapshotStore,
  type TagRow,
} from '@crane/features/3d';
import { useNow } from '@crane/core/lib/use-now';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import {
  groupSelectionState,
  resolveSelectedCodes,
  setSelectedCodes,
  toggleSelectedCode,
} from '../lib/clone-selection';

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * 실시간 복제 선택기 — 왼쪽 크레인 목록(맨 위 "복제하지 않음"), 오른쪽 고른
 * 크레인의 태그 체크 목록(실시간 묶음 머리글마다 전체 체크). 기본은 전부
 * 선택이고 크레인을 바꾸면 다시 전부 선택이다. 피드가 없으면 안내만 보인다.
 * 데이터는 호출자(다이얼로그)가 켜 둔 크레인 스냅샷 피드의 스토어다.
 */
export function VirtualClonePicker({
  value,
  onChange,
  selectedCodes,
  onSelectedCodesChange,
}: {
  value: string | null;
  onChange: (craneId: string | null) => void;
  /** null = 전부 선택. */
  selectedCodes: Set<string> | null;
  onSelectedCodesChange: (next: Set<string> | null) => void;
}) {
  const { t } = useTranslation();
  const order = useCraneSnapshotStore((s) => s.order);
  const cranes = useCraneSnapshotStore((s) => s.cranes);
  const connection = useCraneFeedConnection();
  const connected = connection === 'open';
  const now = useNow(1000);
  const entry = value ? cranes[value] : undefined;
  const rows = useMemo(() => (entry ? buildTagRows(entry) : []), [entry]);
  const allCodes = useMemo(() => rows.map((row) => row.code), [rows]);
  const selected = useMemo(
    () => resolveSelectedCodes(selectedCodes, allCodes),
    [selectedCodes, allCodes],
  );

  return (
    <div className="border-border grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] border-t">
      <aside className="border-border flex min-h-0 flex-col border-r">
        <ScrollArea className="min-h-0 flex-1">
          <ul className="px-1.5 py-2">
            <li>
              <button
                type="button"
                aria-pressed={value === null}
                onClick={() => onChange(null)}
                className={cn(
                  'hover:bg-muted text-muted-foreground flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-xs',
                  value === null && 'bg-primary/10 text-foreground',
                )}
              >
                {t('monitoring:virtualTags.dialog.noClone')}
              </button>
            </li>
            {order.map((id) => {
              const crane = cranes[id];
              if (!crane) return null;
              const pressed = id === value;
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onChange(id)}
                    className={cn(
                      'hover:bg-muted flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                      pressed && 'bg-primary/10 text-foreground',
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
                  </button>
                </li>
              );
            })}
            {order.length === 0 ? (
              <li className="text-muted-foreground px-2 py-6 text-center text-xs">
                {t('monitoring:virtualTags.dialog.noFeed')}
              </li>
            ) : null}
          </ul>
        </ScrollArea>
      </aside>

      <section className="flex min-h-0 flex-col">
        {entry ? (
          <>
            <div className="text-muted-foreground flex items-center gap-2 px-3.5 pt-2 pb-1 text-xs">
              <span className="min-w-0 flex-1">
                {t('monitoring:virtualTags.dialog.selected', {
                  selected: selected.size,
                  total: allCodes.length,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelectedCodesChange(null)}
              >
                {t('monitoring:virtualTags.dialog.selectAll')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSelectedCodesChange(new Set())}
              >
                {t('monitoring:virtualTags.dialog.selectNone')}
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-1.5 pb-2">
                {TAG_CATEGORIES.map((category) => {
                  const group = rows.filter((row) => row.category === category);
                  if (group.length === 0) return null;
                  const codes = group.map((row) => row.code);
                  const state = groupSelectionState(selected, codes);
                  return (
                    <div key={category}>
                      <label className="flex cursor-pointer items-center gap-2 px-2 pt-2 pb-1">
                        <Checkbox
                          checked={state === 'all'}
                          indeterminate={state === 'some'}
                          onCheckedChange={(checked) =>
                            onSelectedCodesChange(
                              setSelectedCodes(
                                selectedCodes,
                                allCodes,
                                codes,
                                checked === true,
                              ),
                            )
                          }
                        />
                        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide">
                          {t(`monitoring:tags.categories.${category}`)} ·{' '}
                          {group.length}
                        </span>
                      </label>
                      <ul>
                        {group.map((row) => (
                          <CloneRow
                            key={row.code}
                            row={row}
                            checked={selected.has(row.code)}
                            onToggle={() =>
                              onSelectedCodesChange(
                                toggleSelectedCode(
                                  selectedCodes,
                                  allCodes,
                                  row.code,
                                ),
                              )
                            }
                            t={t}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        ) : (
          <p className="text-muted-foreground px-4 py-6 text-center text-xs">
            {value
              ? t('monitoring:tags.unknownCrane', { craneId: value })
              : t('monitoring:virtualTags.dialog.pickCrane')}
          </p>
        )}
      </section>
    </div>
  );
}

function formatRowValue(row: TagRow, t: T): string {
  if (typeof row.value === 'boolean') {
    return t(`monitoring:tags.bool.${resolveBoolDisplay(row, row.value).key}`);
  }
  return formatTagNumber(row.value, row.category === 'measurement');
}

function CloneRow({
  row,
  checked,
  onToggle,
  t,
}: {
  row: TagRow;
  checked: boolean;
  onToggle: () => void;
  t: T;
}) {
  return (
    <li>
      <label
        className={cn(
          'hover:bg-muted flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-xs',
          checked && 'bg-primary/5',
        )}
      >
        <Checkbox checked={checked} onCheckedChange={onToggle} />
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
      </label>
    </li>
  );
}
