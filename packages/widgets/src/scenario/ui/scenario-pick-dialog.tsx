import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelTagCode, SavedSceneInfo } from '@crane/domain/3d';
import type {
  ScenarioTag,
  SimulationScenario,
} from '@crane/domain/virtual-tag';
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
  diffPickSelection,
  existingPickKeys,
  filterModelsNotInScenario,
  filterPickableModels,
  listPickableModels,
  modelPickKeys,
  pickKey,
  type PickableModel,
} from '../lib/scenario-pick';
import { nodeLeafName } from '../lib/scenario-rows';
import { CELL_INPUT } from './scenario-cell-styles';

type T = (key: string, options?: Record<string, unknown>) => string;

export type ScenarioPickMode =
  | { kind: 'create' }
  /** 모델 추가 — 시나리오에 아직 없는 모델만 나열하고 고른 태그를 넣는다. */
  | { kind: 'add'; scenario: SimulationScenario }
  /** 태그 수정 — 모델 하나, 기존 태그가 체크된 채 열리고 차집합을 적용한다. */
  | { kind: 'edit'; scenario: SimulationScenario; modelId: string };

export interface ScenarioPickResult {
  /** create 만 — 그 밖은 빈 문자열. */
  name: string;
  /** 새로 넣을 태그(id 없음). */
  tags: Omit<ScenarioTag, 'id'>[];
  /** edit 만 — 체크를 푼 기존 태그의 키(`scenarioTagKey`). */
  removeKeys: string[];
}

export interface ScenarioPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ScenarioPickMode;
  sceneInfo: SavedSceneInfo | null;
  onConfirm: (result: ScenarioPickResult) => void;
}

/**
 * 새 시나리오 · 모델 추가 · 태그 수정 다이얼로그 — 씬에서 맵핑·상태 태그가
 * 있는 모델만 나열한다. 모델 머리글 체크는 그 모델의 태그 전부, 펼치면
 * 태그마다 고른다. 본문은 열려 있을 때만 마운트해 열 때마다 선택이 다시
 * 선다(create·add 는 빈 선택, edit 는 기존 태그).
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

const TITLE_KEY: Record<ScenarioPickMode['kind'], string> = {
  create: 'monitoring:scenario.pick.createTitle',
  add: 'monitoring:scenario.pick.addModelTitle',
  edit: 'monitoring:scenario.pick.editTitle',
};
const CONFIRM_KEY: Record<ScenarioPickMode['kind'], string> = {
  create: 'monitoring:scenario.pick.create',
  add: 'monitoring:scenario.pick.add',
  edit: 'monitoring:scenario.pick.apply',
};

function DialogBody({
  mode,
  sceneInfo,
  onConfirm,
  onOpenChange,
}: ScenarioPickDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');

  const allModels = useMemo(() => listPickableModels(sceneInfo), [sceneInfo]);
  const scopedModels = useMemo(() => {
    if (mode.kind === 'add')
      return filterModelsNotInScenario(allModels, mode.scenario);
    if (mode.kind === 'edit')
      return allModels.filter((m) => m.modelId === mode.modelId);
    return allModels;
  }, [allModels, mode]);
  const existing = useMemo(
    () => existingPickKeys(mode.kind === 'edit' ? mode.scenario : null),
    [mode],
  );
  const allKeys = useMemo(
    () => scopedModels.flatMap(modelPickKeys),
    [scopedModels],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(allKeys.filter((key) => existing.has(key))),
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(mode.kind === 'edit' ? [mode.modelId] : []),
  );

  const models = useMemo(
    () => filterPickableModels(scopedModels, query),
    [scopedModels, query],
  );
  const summary = countSelection(selected, scopedModels);
  const diff = useMemo(
    () =>
      mode.kind === 'edit'
        ? diffPickSelection(selected, existing, allKeys)
        : null,
    [allKeys, existing, mode.kind, selected],
  );
  const canConfirm = diff
    ? diff.addKeys.length + diff.removeKeys.length > 0
    : summary.tags > 0 && (mode.kind === 'add' || name.trim().length > 0);

  const toggleExpanded = (modelId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });

  const emptyKey =
    allModels.length === 0 || mode.kind === 'edit'
      ? 'monitoring:scenario.pick.noMappedModels'
      : scopedModels.length === 0
        ? 'monitoring:scenario.pick.noModelsLeft'
        : 'monitoring:scenario.pick.emptyFiltered';

  return (
    <>
      <header className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t(TITLE_KEY[mode.kind])}
          {mode.kind === 'edit' ? (
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
              {t(emptyKey)}
            </p>
          ) : null}
          {models.map((model) => (
            <ModelRow
              key={model.modelId}
              model={model}
              selected={selected}
              expanded={expanded.has(model.modelId)}
              onToggleExpanded={() => toggleExpanded(model.modelId)}
              onToggleAll={(on) =>
                setSelected((prev) =>
                  setSelectedCodes(prev, allKeys, modelPickKeys(model), on),
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
        <span className="text-muted-foreground min-w-0 flex-1 truncate tabular-nums">
          {t('monitoring:scenario.pick.summary', {
            models: summary.models,
            tags: summary.tags,
          })}
          {diff
            ? ` · ${t('monitoring:scenario.pick.changes', {
                added: diff.addKeys.length,
                removed: diff.removeKeys.length,
              })}`
            : ''}
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
              tags: buildScenarioTags(
                diff ? new Set(diff.addKeys) : selected,
                scopedModels,
              ),
              removeKeys: diff?.removeKeys ?? [],
            })
          }
        >
          {t(CONFIRM_KEY[mode.kind])}
        </Button>
      </footer>
    </>
  );
}

function ModelRow({
  model,
  selected,
  expanded,
  onToggleExpanded,
  onToggleAll,
  onToggleCode,
  t,
}: {
  model: PickableModel;
  selected: ReadonlySet<string>;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleAll: (on: boolean) => void;
  onToggleCode: (key: string) => void;
  t: T;
}) {
  const keys = modelPickKeys(model);
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
            return (
              <li key={code.code}>
                <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1">
                  <Checkbox
                    checked={selected.has(key)}
                    aria-label={code.code}
                    onCheckedChange={() => onToggleCode(key)}
                    className="size-3.5"
                  />
                  <span className="font-mono">{code.code}</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-[10px]">
                    {describeCode(code, t)}
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
