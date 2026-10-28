import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Pencil,
  PencilLine,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { scenariosOfSceneFile, useScenarioStore } from '@crane/features/3d';
import {
  isImeComposing,
  useImeSafeBlur,
} from '@crane/core/lib/use-ime-safe-blur';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Spinner } from '@crane/ui/atoms/spinner';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import {
  filterModelsNotInScenario,
  listPickableModels,
} from '../lib/scenario-pick';
import {
  groupScenarioRows,
  type ScenarioModelGroup,
} from '../lib/scenario-rows';
import {
  CELL_INPUT,
  CELL_NUMBER_INPUT,
  CELL_NUMBER_WRAPPER,
} from './scenario-cell-styles';
import {
  ScenarioPickDialog,
  type ScenarioPickMode,
} from './scenario-pick-dialog';
import { ScenarioTagRow } from './scenario-tag-row';

type T = (key: string, options?: Record<string, unknown>) => string;

const SELECT_CLASS =
  'border-border bg-background h-7 min-w-0 flex-1 rounded-md border px-2 text-xs';

/** 펼친 모델 묶음 — 시나리오별이라 활성이 바뀌면 전부 접힌다. */
interface ExpandedGroups {
  scenarioId: string | null;
  ids: ReadonlySet<string>;
}
const NONE_EXPANDED: ExpandedGroups = { scenarioId: null, ids: new Set() };

/** 정의를 펼친 태그 행 — 한 번에 하나. 묶음처럼 시나리오가 바뀌면 접힌다. */
interface OpenTag {
  scenarioId: string | null;
  tagId: string | null;
}
const NO_OPEN_TAG: OpenTag = { scenarioId: null, tagId: null };

export interface ScenarioPanelProps {
  className?: string;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => Promise<boolean>;
}

/**
 * 3D 플레이 우측 "시나리오" 탭 — 붙어 있는 씬 파일의 시나리오를 고르고 만들고
 * 고친다. 머리줄(시나리오 선택 · 새로 · 복제 · 삭제 · 저장), 이름 줄(이름 ·
 * 갱신 주기 · 모델 추가), 본문은 모델별 묶음(접고 펼침, 처음엔 전부 접힘)
 * 아래 태그 행, 바닥 줄은 태그·모델 수와 안내. 씬과 어긋난 행(모델 없음·
 * 크레인 없음·키 중복)은 amber 로 남기고 값은 나가지 않는다.
 *
 * 편집은 스토어(메모리)를 지나고 저장·dirty·이탈 가드·폐기는 사이드 패널의
 * `useScenarioDraft` 가 든다 — 이 패널은 저장 버튼만 그린다.
 */
export function ScenarioPanel({
  className,
  isDirty,
  isSaving,
  onSave,
}: ScenarioPanelProps) {
  const { t } = useTranslation();
  const scenarios = useScenarioStore((s) => s.scenarios);
  const sceneFile = useScenarioStore((s) => s.sceneFile);
  const sceneInfo = useScenarioStore((s) => s.sceneInfo);
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
  const entries = useScenarioStore((s) => s.entries);
  const issues = useScenarioStore((s) => s.issues);
  const tickSec = useScenarioStore((s) => s.tickSec);
  const setTickSec = useScenarioStore((s) => s.setTickSec);
  const setActiveScenario = useScenarioStore((s) => s.setActiveScenario);
  const addScenario = useScenarioStore((s) => s.addScenario);
  const renameScenario = useScenarioStore((s) => s.renameScenario);
  const removeScenario = useScenarioStore((s) => s.removeScenario);
  const duplicateScenario = useScenarioStore((s) => s.duplicateScenario);
  const addTags = useScenarioStore((s) => s.addTags);
  const editTags = useScenarioStore((s) => s.editTags);
  const updateTag = useScenarioStore((s) => s.updateTag);
  const removeModelTags = useScenarioStore((s) => s.removeModelTags);

  const [pick, setPick] = useState<ScenarioPickMode | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [expandedGroups, setExpandedGroups] =
    useState<ExpandedGroups>(NONE_EXPANDED);
  const [openTag, setOpenTag] = useState<OpenTag>(NO_OPEN_TAG);

  const candidates = useMemo(
    () => scenariosOfSceneFile(scenarios, sceneFile),
    [scenarios, sceneFile],
  );
  const active = scenarios.find((s) => s.id === activeScenarioId) ?? null;
  const groups = useMemo(
    () => groupScenarioRows(active, sceneInfo, entries, issues),
    [active, sceneInfo, entries, issues],
  );
  // 시나리오에 없는 맵핑 모델이 남아 있을 때만 "모델 추가" 가 산다.
  const canAddModel = useMemo(
    () =>
      filterModelsNotInScenario(listPickableModels(sceneInfo), active).length >
      0,
    [sceneInfo, active],
  );
  const expanded =
    active && expandedGroups.scenarioId === active.id
      ? expandedGroups.ids
      : NONE_EXPANDED.ids;

  const toggleExpanded = (modelId: string) => {
    if (!active) return;
    setExpandedGroups((prev) => {
      const ids = new Set(prev.scenarioId === active.id ? prev.ids : []);
      if (ids.has(modelId)) ids.delete(modelId);
      else ids.add(modelId);
      return { scenarioId: active.id, ids };
    });
  };

  const openTagId =
    active && openTag.scenarioId === active.id ? openTag.tagId : null;
  const toggleTag = (tagId: string) => {
    if (!active) return;
    setOpenTag((prev) => ({
      scenarioId: active.id,
      tagId:
        prev.scenarioId === active.id && prev.tagId === tagId ? null : tagId,
    }));
  };

  const openAddModel = () => {
    if (active) setPick({ kind: 'add', scenario: active });
  };

  // 이름 수정은 머리줄의 선택 상자 자리에서 한다. 거부(빈 이름·너무 김)되면
  // 입력을 열어 둔다.
  const editingName = renaming && active !== null;
  const commitName = (value: string): boolean => {
    if (!active) return true;
    const ok = renameScenario(active.id, value);
    if (ok) setRenaming(false);
    return ok;
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col text-xs', className)}>
      {pick ? (
        <ScenarioPickDialog
          open
          onOpenChange={(open) => {
            if (!open) setPick(null);
          }}
          mode={pick}
          sceneInfo={sceneInfo}
          onConfirm={({ name, tags, removeKeys }) => {
            if (pick.kind === 'create') {
              if (!sceneFile) return;
              const result = addScenario({ name, sceneFile, tags });
              if (!result.ok) {
                toast.error(t(`monitoring:scenario.errors.${result.reason}`));
                return;
              }
            } else if (pick.kind === 'add') {
              addTags(pick.scenario.id, tags);
            } else {
              editTags(pick.scenario.id, { add: tags, removeKeys });
            }
            setPick(null);
          }}
        />
      ) : null}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogPopup>
          <AlertDialogTitle>
            {t('monitoring:scenario.removeTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {active
              ? t('monitoring:scenario.removeDescription', {
                  name: active.name,
                  count: active.tags.length,
                })
              : null}
          </AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogClose
              render={<Button type="button" variant="outline" size="sm" />}
            >
              {t('monitoring:scenario.pick.cancel')}
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (active) removeScenario(active.id);
                setConfirmRemove(false);
              }}
            >
              {t('monitoring:scenario.confirmRemove')}
            </Button>
          </div>
        </AlertDialogPopup>
      </AlertDialog>

      {/* 머리줄 — 새 시나리오 · 시나리오 선택(이름 수정 중엔 이름 입력)과 목록 조작. */}
      <div className="border-border flex items-center gap-1 border-b px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('monitoring:scenario.add')}
          title={t('monitoring:scenario.add')}
          disabled={!sceneFile}
          onClick={() => setPick({ kind: 'create' })}
        >
          <Plus className="size-3.5" />
        </Button>
        {editingName && active ? (
          <ScenarioNameInput
            key={active.id}
            name={active.name}
            onCommit={commitName}
            onCancel={() => setRenaming(false)}
            t={t}
          />
        ) : candidates.length > 0 ? (
          <select
            className={SELECT_CLASS}
            value={activeScenarioId ?? ''}
            aria-label={t('monitoring:scenario.select')}
            onChange={(event) => setActiveScenario(event.target.value || null)}
          >
            {candidates.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-muted-foreground min-w-0 flex-1 truncate">
            {t('monitoring:scenario.none')}
          </span>
        )}
        {editingName ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('monitoring:scenario.rename')}
            title={t('monitoring:scenario.rename')}
            disabled={!active}
            onClick={() => setRenaming(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('monitoring:scenario.duplicate')}
          title={t('monitoring:scenario.duplicate')}
          disabled={!active}
          onClick={() => {
            if (active) duplicateScenario(active.id);
          }}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="hover:text-red-300"
          aria-label={t('monitoring:scenario.remove')}
          title={t('monitoring:scenario.remove')}
          disabled={!active}
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={isDirty ? 'default' : 'outline'}
          size="sm"
          className="h-7 gap-1 px-2"
          disabled={!isDirty || isSaving}
          onClick={() => void onSave()}
        >
          {isSaving ? (
            <Spinner className="size-3" />
          ) : (
            // 미저장 표시 — 씬 편집 저장 버튼과 같은 붉은 점을 아이콘 우측 위에.
            <span className="relative flex">
              <Save className="size-3.5" />
              {isDirty ? (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-red-500"
                />
              ) : null}
            </span>
          )}
          {t('monitoring:scenario.save')}
        </Button>
      </div>

      {!sceneFile ? (
        <Empty>{t('monitoring:scenario.noScene')}</Empty>
      ) : !active ? (
        <Empty>
          {t('monitoring:scenario.noneHint')}
          <Button
            type="button"
            size="sm"
            className="mt-2"
            onClick={() => setPick({ kind: 'create' })}
          >
            <Plus className="size-3.5" />
            {t('monitoring:scenario.add')}
          </Button>
        </Empty>
      ) : (
        <>
          {/* 설정 줄 — 갱신 주기 · 크레인(모델) 추가. */}
          <div className="border-border flex items-center gap-2 border-b px-2 py-1">
            <span className="text-muted-foreground shrink-0">
              {t('monitoring:scenario.tick')}
            </span>
            <InputNumber
              value={tickSec}
              min={0.016}
              max={5}
              step={0.01}
              aria-label={t('monitoring:scenario.tick')}
              className={cn(CELL_NUMBER_WRAPPER, 'h-5 w-16')}
              inputClassName={cn(CELL_NUMBER_INPUT, 'text-[11px]')}
              onChange={setTickSec}
            />
            <span className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!canAddModel}
              aria-label={t('monitoring:scenario.addModel')}
              title={t(
                canAddModel
                  ? 'monitoring:scenario.addModel'
                  : 'monitoring:scenario.pick.noModelsLeft',
              )}
              onClick={openAddModel}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {groups.length === 0 ? (
              <Empty>
                {t('monitoring:scenario.emptyTags')}
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  disabled={!canAddModel}
                  onClick={openAddModel}
                >
                  <Plus className="size-3.5" />
                  {t('monitoring:scenario.addModel')}
                </Button>
              </Empty>
            ) : (
              <div className="pb-2">
                {groups.map((group) => (
                  <ModelGroup
                    key={group.modelId}
                    group={group}
                    expanded={expanded.has(group.modelId)}
                    onToggle={() => toggleExpanded(group.modelId)}
                    openTagId={openTagId}
                    onToggleTag={toggleTag}
                    onEditTags={() =>
                      setPick({
                        kind: 'edit',
                        scenario: active,
                        modelId: group.modelId,
                      })
                    }
                    onRemoveModel={() =>
                      removeModelTags(active.id, group.modelId)
                    }
                    onUpdateTag={(tagId, patch) =>
                      updateTag(active.id, tagId, patch)
                    }
                    t={t}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-border text-muted-foreground flex items-center gap-2 border-t px-2 py-1.5 text-[10px]">
            <span className="shrink-0 tabular-nums">
              {t('monitoring:scenario.count', {
                tags: active.tags.length,
                models: groups.length,
              })}
            </span>
            <span className="flex-1" />
            <span className="truncate">{t('monitoring:scenario.hint')}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 머리줄의 시나리오 이름 입력 — 연필 버튼으로 열리고 선택 상자 자리를 쓴다.
 * blur/Enter 로 확정(한글 조합이 끝난 뒤), Escape 로 취소. 거부되면 amber 로
 * 남기고 포커스를 되돌린다.
 */
function ScenarioNameInput({
  name,
  onCommit,
  onCancel,
  t,
}: {
  name: string;
  onCommit: (value: string) => boolean;
  onCancel: () => void;
  t: T;
}) {
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape 로 닫힐 때 뒤따르는 blur 가 확정하지 않게 한다.
  const cancelledRef = useRef(false);
  const blurHandlers = useImeSafeBlur<HTMLInputElement>(({ value }) => {
    if (cancelledRef.current || onCommit(value)) return;
    setInvalid(true);
    queueMicrotask(() => inputRef.current?.focus());
  });

  return (
    <Input
      ref={inputRef}
      autoFocus
      defaultValue={name}
      aria-label={t('monitoring:scenario.name')}
      aria-invalid={invalid}
      className={cn(
        CELL_INPUT,
        'h-7 min-w-0 flex-1 font-semibold',
        invalid && 'border-amber-500 text-amber-500',
      )}
      onChange={() => setInvalid(false)}
      {...blurHandlers}
      onFocus={(event) => {
        blurHandlers.onFocus();
        event.currentTarget.select();
      }}
      onKeyDown={(event) => {
        // 조합을 끝내는 Enter·Esc 는 확정·취소가 아니다 — 뒤에 한 번 더 온다.
        if (isImeComposing(event.nativeEvent)) return;
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          cancelledRef.current = true;
          onCancel();
        }
      }}
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 py-8 text-center">
      {children}
    </div>
  );
}

function ModelGroup({
  group,
  expanded,
  onToggle,
  openTagId,
  onToggleTag,
  onEditTags,
  onRemoveModel,
  onUpdateTag,
  t,
}: {
  group: ScenarioModelGroup;
  expanded: boolean;
  onToggle: () => void;
  openTagId: string | null;
  onToggleTag: (tagId: string) => void;
  onEditTags: () => void;
  onRemoveModel: () => void;
  onUpdateTag: (
    tagId: string,
    patch: Parameters<
      ReturnType<typeof useScenarioStore.getState>['updateTag']
    >[2],
  ) => void;
  t: T;
}) {
  const problem = !group.present || !group.craneId;
  return (
    <div className="border-border border-t">
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1.5',
          problem ? 'bg-amber-500/10 text-amber-500' : 'bg-muted/40',
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <ChevronRight
            className={cn(
              'size-3 shrink-0 transition-transform',
              expanded && 'rotate-90',
            )}
            aria-hidden
          />
          <span className="font-semibold">{group.modelName}</span>
          <span className="min-w-0 truncate font-mono text-[10px] opacity-80">
            {!group.present
              ? t('monitoring:scenario.issue.model-missing-short')
              : (group.craneId ?? t('monitoring:inspector.crane.missing'))}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums opacity-80">
            {t('monitoring:scenario.pick.tagCount', {
              count: group.rows.length,
            })}
          </span>
          {/* 묶음 자체가 amber 면 행마다 같은 문제라 따로 알리지 않는다. */}
          {!problem && group.issueCount > 0 ? (
            <span
              className="flex shrink-0 text-amber-500"
              title={t('monitoring:scenario.row.noValue')}
            >
              <AlertTriangle className="size-3" aria-hidden />
            </span>
          ) : null}
        </button>
        {group.present ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={t('monitoring:scenario.editTags')}
            title={t('monitoring:scenario.editTags')}
            onClick={onEditTags}
          >
            <PencilLine className="size-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-red-300"
          aria-label={t('monitoring:scenario.removeModel')}
          title={t('monitoring:scenario.removeModel')}
          onClick={onRemoveModel}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {expanded
        ? group.rows.map((row) => (
            <ScenarioTagRow
              key={row.tag.id}
              row={row}
              expanded={openTagId === row.tag.id}
              onToggle={() => onToggleTag(row.tag.id)}
              onUpdate={(patch) => onUpdateTag(row.tag.id, patch)}
              t={t}
            />
          ))
        : null}
    </div>
  );
}
