import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { SimulationScenario } from '@crane/domain/virtual-tag';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { Input } from '@crane/ui/atoms/input';
import { Dialog, DialogPopup, DialogTitle } from '@crane/ui/molecules/dialog';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { SearchField } from '@crane/ui/molecules/search-field';
import {
  groupSelectionState,
  setSelectedCodes,
  toggleSelectedCode,
} from '../lib/pick-selection';
import {
  buildScenarioTags,
  countSelection,
  existingPickKeys,
  filterPickableModels,
  listPickableModels,
  modelPickKeys,
  pickKey,
  type PickableModel,
} from '../lib/scenario-pick';
import { nodeLeafName } from '../lib/scenario-rows';
import type { ModelTagCode } from '@crane/domain/3d';
import { CELL_INPUT } from './scenario-cell-styles';

type T = (key: string, options?: Record<string, unknown>) => string;

export type ScenarioPickMode =
  | { kind: 'create' }
  /** 기존 시나리오에 태그 추가 — 모델 하나로 열면 그 모델만 펼쳐 보인다. */
  | { kind: 'add'; scenario: SimulationScenario; modelId?: string };

export interface ScenarioPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ScenarioPickMode;
  sceneInfo: SavedSceneInfo | null;
  /** 확정 — 새 시나리오면 이름과 태그, 추가면 태그만. */
  onConfirm: (result: {
    name: string;
    tags: ReturnType<typeof buildScenarioTags>;
  }) => void;
}

/**
 * 새 시나리오 · 태그 추가 다이얼로그 — 씬에서 맵핑·상태 태그가 있는 모델만
 * 나열한다. 모델 머리글 체크는 그 모델의 태그 전부, 펼치면 태그마다 고른다.
 * 이미 시나리오에 있는 태그는 체크된 채 비활성. 본문은 열려 있을 때만
 * 마운트해 열 때마다 선택이 빈다.
 */
export function ScenarioPickDialog(props: ScenarioPickDialogProps) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex h-[min(80vh,680px)] w-[min(96vw,44rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        {open ? <DialogBody {...props} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

function describeCode(code: ModelTagCode, t: T): string {
  if (code.source === 'status') {
    return t(`monitoring:inspector.statusTags.roles.${code.role}`);
  }
  if (code.source === 'hook') {
    return t('monitoring:scenario.row.hookTarget', { label: code.label });
  }
  if (code.target.kind === 'joint') {
    return `${t('monitoring:inspector.mapping.joint')} ${code.target.jointId}`;
  }
  const node =
    nodeLeafName(code.target.node) || t('monitoring:inspector.mapping.root');
  return `${node} · ${t(`monitoring:inspector.mapping.channels.${code.target.channel}`)} ${code.target.axis}`;
}

function DialogBody({
  mode,
  sceneInfo,
  onConfirm,
  onOpenChange,
}: ScenarioPickDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(mode.kind === 'add' && mode.modelId ? [mode.modelId] : []),
  );

  const allModels = useMemo(() => listPickableModels(sceneInfo), [sceneInfo]);
  const scopedModels = useMemo(
    () =>
      mode.kind === 'add' && mode.modelId
        ? allModels.filter((m) => m.modelId === mode.modelId)
        : allModels,
    [allModels, mode],
  );
  const models = useMemo(
    () => filterPickableModels(scopedModels, query),
    [scopedModels, query],
  );
  const existing = useMemo(
    () => existingPickKeys(mode.kind === 'add' ? mode.scenario : null),
    [mode],
  );
  const allKeys = useMemo(
    () => scopedModels.flatMap(modelPickKeys).filter((k) => !existing.has(k)),
    [scopedModels, existing],
  );
  const summary = countSelection(selected, scopedModels, existing);
  const canConfirm =
    summary.tags > 0 && (mode.kind === 'add' || name.trim().length > 0);

  const toggleExpanded = (modelId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });

  const title = t(
    mode.kind === 'create'
      ? 'monitoring:scenario.pick.createTitle'
      : 'monitoring:scenario.pick.addTitle',
  );

  return (
    <>
      <header className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
          {mode.kind === 'add' && mode.modelId ? (
            <span className="text-muted-foreground ml-2 font-normal">
              · {scopedModels[0]?.equipName ?? mode.modelId}
            </span>
          ) : null}
        </DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground shrink-0"
          aria-label={t('monitoring:scenario.pick.cancel')}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </header>

      {mode.kind === 'create' ? (
        <div className="flex items-center gap-2 px-3 pt-3 text-xs">
          <span className="text-muted-foreground shrink-0">
            {t('monitoring:scenario.name')}
          </span>
          <Input
            value={name}
            autoFocus
            placeholder={t('monitoring:scenario.namePlaceholder')}
            aria-label={t('monitoring:scenario.name')}
            className={cn(CELL_INPUT, 'h-8 text-sm')}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-3 py-2">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('monitoring:scenario.pick.search')}
          aria-label={t('monitoring:scenario.pick.search')}
          className="min-w-0 flex-1"
        />
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {t('monitoring:scenario.pick.selected', {
            selected: summary.tags,
            total: allKeys.length,
          })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSelected(new Set(allKeys))}
        >
          {t('monitoring:scenario.pick.selectAll')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSelected(new Set())}
        >
          {t('monitoring:scenario.pick.selectNone')}
        </Button>
      </div>

      <ScrollArea className="border-border min-h-0 flex-1 border-t">
        <div className="px-2 py-1.5 text-xs">
          {models.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center">
              {t(
                allModels.length === 0
                  ? 'monitoring:scenario.pick.noMappedModels'
                  : 'monitoring:scenario.pick.emptyFiltered',
              )}
            </p>
          ) : null}
          {models.map((model) => (
            <ModelRow
              key={model.modelId}
              model={model}
              selected={selected}
              existing={existing}
              expanded={expanded.has(model.modelId)}
              onToggleExpanded={() => toggleExpanded(model.modelId)}
              onToggleAll={(on) =>
                setSelected((prev) =>
                  setSelectedCodes(
                    prev,
                    allKeys,
                    modelPickKeys(model).filter((k) => !existing.has(k)),
                    on,
                  ),
                )
              }
              onToggleCode={(key) =>
                setSelected((prev) => toggleSelectedCode(prev, allKeys, key))
              }
              t={t}
            />
          ))}
        </div>
      </ScrollArea>

      <footer className="border-border flex items-center gap-3 border-t px-3 py-2 text-xs">
        <span className="text-muted-foreground min-w-0 flex-1 truncate">
          {t('monitoring:scenario.pick.summary', {
            models: summary.models,
            tags: summary.tags,
          })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          {t('monitoring:scenario.pick.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canConfirm}
          onClick={() =>
            onConfirm({
              name: name.trim(),
              tags: buildScenarioTags(selected, scopedModels, existing),
            })
          }
        >
          {t(
            mode.kind === 'create'
              ? 'monitoring:scenario.pick.create'
              : 'monitoring:scenario.pick.add',
          )}
        </Button>
      </footer>
    </>
  );
}

function ModelRow({
  model,
  selected,
  existing,
  expanded,
  onToggleExpanded,
  onToggleAll,
  onToggleCode,
  t,
}: {
  model: PickableModel;
  selected: ReadonlySet<string>;
  existing: ReadonlySet<string>;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleAll: (on: boolean) => void;
  onToggleCode: (key: string) => void;
  t: T;
}) {
  const keys = modelPickKeys(model).filter((k) => !existing.has(k));
  const state =
    keys.length === 0 ? 'none' : groupSelectionState(selected, keys);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <div className="rounded-md">
      <div className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5">
        <Checkbox
          checked={state === 'all'}
          indeterminate={state === 'some'}
          disabled={keys.length === 0}
          aria-label={model.equipName}
          onCheckedChange={(checked) => onToggleAll(checked === true)}
          className="size-3.5 cursor-pointer"
        />
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
        >
          <span className="font-semibold">{model.equipName}</span>
          <span
            className={cn(
              'text-[10px]',
              model.craneId ? 'text-muted-foreground' : 'text-amber-500',
            )}
          >
            {model.craneId ?? t('monitoring:inspector.crane.missing')}
            {' · '}
            {t('monitoring:scenario.pick.tagCount', {
              count: model.codes.length,
            })}
          </span>
          <span className="flex-1" />
          <Chevron className="text-muted-foreground size-3.5" aria-hidden />
        </button>
      </div>
      {expanded ? (
        <ul className="pb-1 pl-7">
          {model.codes.map((code) => {
            const key = pickKey(model.modelId, code.code);
            const already = existing.has(key);
            return (
              <li key={code.code}>
                <label
                  className={cn(
                    'hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1',
                    already && 'cursor-default opacity-50',
                  )}
                >
                  <Checkbox
                    checked={already || selected.has(key)}
                    disabled={already}
                    aria-label={code.code}
                    onCheckedChange={() => onToggleCode(key)}
                    className="size-3.5"
                  />
                  <span className="font-mono">{code.code}</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-[10px]">
                    {describeCode(code, t)}
                    {already
                      ? ` · ${t('monitoring:scenario.pick.alreadyAdded')}`
                      : ''}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
