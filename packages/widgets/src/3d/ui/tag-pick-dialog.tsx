import { Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeCraneKey } from '@crane/core/lib/crane-tag-key';
import { getMonitoringTagMetadata } from '@crane/domain/monitoring';
import {
  TAG_CATEGORIES,
  TAG_VALUE_NULL_TEXT,
  buildTagRows,
  formatTagNumber,
  resolveBoolDisplay,
  selectCraneFeed,
  useCraneScope,
  useCraneSnapshotFeed,
  useCraneSnapshotStore,
  type TagRow,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Dialog, DialogPopup, DialogTitle } from '@crane/ui/molecules/dialog';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { SearchField } from '@crane/ui/molecules/search-field';
import { filterPickTags, findSnapshotEntry } from '../lib/tag-pick';
import { useTagValueHistory } from '../model/use-tag-value-history';
import { TagSparkline } from './tag-sparkline';

type T = (key: string, options?: Record<string, unknown>) => string;

export interface TagPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 지금 연결된 코드(없으면 빈 문자열). */
  value: string;
  /** 모델의 craneId — 이 크레인의 서버 태그만 보인다. 없으면 고를 수 없다. */
  modelCraneId?: string;
  /** "연결" — 고른 코드를 넘긴다. */
  onApply: (code: string) => void;
}

/**
 * 태그 연결 다이얼로그 — 모델의 크레인이 머리줄에 고정되고, 서버에서 받은 그
 * 크레인의 태그 목록(분류 묶음·현재 값)과 미리보기(큰 현재 값·최근 60초
 * 스파크라인·형식·분류)만 있다. 행을 누르면 코드가 초안이 되고 "연결" 이
 * 넘긴다. 크레인·구역 단계는 없다 — 크레인은 인스펙터의 크레인 칸 한 곳에서
 * 정한다.
 *
 * 데이터는 본문이 켠 `useCraneSnapshotFeed(scope)`(REST 전체 + STOMP, 범위는
 * 화면이 내린 `useCraneScope()`) — 에디터에는 다른 참조자가 없어 닫으면 소켓이
 * 닫히고, 브리지가 없어 버스로는 가지 않는다(모델이 움직이지 않는다). 카탈로그가
 * 없는 크레인(외업)은 묶음 없이 원본 이름(코드) 순 한 목록이다. 본문은 열려 있을 때만 마운트해 열 때마다
 * `value` 로 돌아온다. 모델에 craneId 가 없거나 서버에 그 크레인이 없으면
 * 목록 대신 안내만 보이고 연결할 수 없다.
 */
export function TagPickDialog(props: TagPickDialogProps) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex h-[min(82vh,760px)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        {open ? <TagPickDialogBody {...props} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

function TagPickDialogBody({
  value,
  modelCraneId,
  onApply,
  onOpenChange,
}: TagPickDialogProps) {
  const { t } = useTranslation();
  const scope = useCraneScope();
  useCraneSnapshotFeed(scope);
  const cranes = useCraneSnapshotStore((s) => selectCraneFeed(s, scope).cranes);
  const loadError = useCraneSnapshotStore(
    (s) => selectCraneFeed(s, scope).loadError,
  );
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;

  const found = useMemo(
    () => findSnapshotEntry(cranes, modelCraneId),
    [cranes, modelCraneId],
  );
  const rows = useMemo(() => (found ? buildTagRows(found.entry) : []), [found]);
  const tagRows = useMemo(() => filterPickTags(rows, query), [rows, query]);
  const selectedRow = draft
    ? rows.find((row) => row.code === draft)
    : undefined;
  const history = useTagValueHistory(
    scope,
    found?.craneId ?? null,
    draft || null,
    selectedRow !== undefined,
  );
  const craneKey = modelCraneId ? normalizeCraneKey(modelCraneId) : null;

  return (
    <>
      <header className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t('monitoring:inspector.tagPick.title')}
          {modelCraneId ? (
            <span className="text-muted-foreground ml-2 font-normal">
              {modelCraneId}
            </span>
          ) : null}
        </DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground shrink-0"
          aria-label={t('monitoring:inspector.tagPick.cancel')}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </header>

      {!modelCraneId ? (
        <Notice tone="amber">
          {t('monitoring:inspector.tagPick.craneMissing')}
        </Notice>
      ) : !found ? (
        <Notice>
          {t('monitoring:inspector.tagPick.noServerTags', {
            craneId: modelCraneId,
          })}
          {loadError ? (
            <span className="mt-1 block text-amber-500">
              {t('monitoring:tags.banner.loadError')}
            </span>
          ) : null}
        </Notice>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-3 py-2">
            <SearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('monitoring:inspector.tagPick.search')}
              aria-label={t('monitoring:inspector.tagPick.search')}
            />
          </div>
          <div className="border-border grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_16rem] border-t">
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
                  {[...TAG_CATEGORIES, null].map((category) => {
                    const group = tagRows.filter(
                      (row) => row.category === category,
                    );
                    if (group.length === 0) return null;
                    return (
                      <div key={category ?? 'none'}>
                        {category === null ? null : (
                          <p className="text-muted-foreground px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide">
                            {t(`monitoring:tags.categories.${category}`)}
                          </p>
                        )}
                        <ul>
                          {group.map((row) => (
                            <TagPickRow
                              key={row.code}
                              row={row}
                              selected={row.code === draft}
                              onSelect={() => setDraft(row.code)}
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
              {selectedRow ? (
                <>
                  <div>
                    <p className="text-base font-semibold break-all">
                      {selectedRow.name ?? selectedRow.code}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {craneKey}.{selectedRow.code}
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
                      {(selectedRow.category !== null &&
                        getMonitoringTagMetadata(selectedRow.code).dataType) ||
                        '—'}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('monitoring:inspector.tagPick.category')}
                    </dt>
                    <dd>
                      {selectedRow.category === null
                        ? '—'
                        : t(
                            `monitoring:tags.categories.${selectedRow.category}`,
                          )}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('monitoring:inspector.tagPick.bay')}
                    </dt>
                    <dd>{found.entry.snapshot.bay ?? '—'}</dd>
                  </dl>
                </>
              ) : (
                <p className="text-muted-foreground">
                  {draft
                    ? t('monitoring:inspector.tagPick.draftNotOnServer', {
                        code: draft,
                      })
                    : t('monitoring:inspector.tagPick.noSelection')}
                </p>
              )}
            </aside>
          </div>
        </div>
      )}

      <footer className="border-border flex items-center gap-3 border-t px-3 py-2 text-xs">
        <span className="min-w-0 flex-1 truncate">
          {draft ? (
            <>
              <span className="text-orange-400">{draft}</span>
              {craneKey ? (
                <span className="text-muted-foreground">
                  {' '}
                  → {craneKey}.{draft}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          {t('monitoring:inspector.tagPick.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!dirty || !found}
          onClick={() => onApply(draft)}
        >
          {t('monitoring:inspector.tagPick.apply')}
        </Button>
      </footer>
    </>
  );
}

function Notice({
  tone,
  children,
}: {
  tone?: 'amber';
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs">
      <p
        className={cn(
          tone === 'amber' ? 'text-amber-500' : 'text-muted-foreground',
        )}
      >
        {children}
      </p>
    </div>
  );
}

/**
 * 값 표기 — 불리언은 태그 페이지와 같은 글자(ON/OFF·OK/NG), 계측값은 천 단위,
 * 값 없음은 `NULL`.
 */
function formatRowValue(row: TagRow, t: T): string {
  if (row.value === null) return TAG_VALUE_NULL_TEXT;
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
          {row.name === null ? (
            <span className="font-medium">{row.code}</span>
          ) : (
            <>
              <span className="font-medium">{row.name}</span>
              <span className="text-muted-foreground ml-1.5 text-[10px]">
                {row.code}
              </span>
            </>
          )}
        </span>
        <span className="shrink-0 tabular-nums">
          {formatRowValue(row, t)}{' '}
          <span className="text-muted-foreground">{row.unit ?? ''}</span>
        </span>
        <Check
          className={cn(
            'size-3.5 shrink-0',
            selected ? 'text-primary' : 'opacity-0',
          )}
          aria-hidden
        />
      </button>
    </li>
  );
}
