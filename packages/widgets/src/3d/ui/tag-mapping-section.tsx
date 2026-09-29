import { AlertTriangle, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getDrivenJointIds,
  getTagMappingUnit,
  LABEL_STATUS_TAG_ROLES,
  modelObjectRegistry,
  OUTLINE_STATUS_TAG_ROLES,
  TAG_MAPPING_CAPTION_MAX,
  TAG_MAPPING_CHANNELS,
  type ModelStatusTags,
  type RigDefinition,
  type SavedModelInfo,
  type StatusTagRole,
  type TagMapping,
} from '@crane/domain/3d';
import {
  rigLiveReadouts,
  tagLiveValues,
  useLabelPreview,
  useLabelPreviewState,
  useLabelPreviewStore,
  useOutlinePreviewState,
  useRigLivePoll,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import type { EquipmentLabelState } from '@crane/core/types/status';
import { Button } from '@crane/ui/atoms/button';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { Input } from '@crane/ui/atoms/input';
import {
  buildModelNodeTree,
  listModelNodeOptions,
  type ModelNodeOption,
} from '../lib/model-node-tree';
import {
  PREVIEW_CHOICES,
  describeLabelState,
  fromPreviewChoice,
  setStatusTag,
  toPreviewChoice,
} from '../lib/status-tag-editor';
import {
  computeAppliedValue,
  createTagMapping,
  findTagMappingConflicts,
  formatMappingValue,
  switchTargetKind,
  type TagMappingConflict,
} from '../lib/tag-mapping-editor';
import {
  FIELD_INDENT_COMPACT,
  FIELD_INPUT,
  FIELD_LABEL_COMPACT,
  FIELD_SELECT,
} from './inspector-field-classes';
import {
  AxisSegment,
  ChoiceSegment,
  CollapsibleSection,
  Field,
  NodeSelect,
  NumberField,
  type InspectorT,
} from './inspector-fields';
import { TagKeyCombobox } from './tag-key-combobox';

/**
 * 인스펙터 "태그 매핑" 탭 — 맵핑을 하나씩 추가하는 목록.
 *
 * 관절 카드와 같은 문법이다: `+` 가 기본값 카드(모델 루트·위치·x·태그 없음)를
 * 만들고, 카드 안에서 위→아래 순서로 노드 → 타입 → 축 → 태그를 고른다.
 * 리그가 할당된 모델은 대상을 "관절"로 바꿔 관절에 직접 꽂을 수 있다(구속조건
 * 체인을 탄다).
 *
 * 편집은 전부 onUpdate(updater) 한 채널 — undo/redo·dirty 에 잡힌다. 라이브
 * readout(태그값 → 적용값)은 15Hz 폴링으로 tagLiveValues/rigLiveReadouts 를
 * 읽는다. 중복·리그 충돌 판정은 lib/tag-mapping-editor 가 한다.
 *
 * 목록 아래 "상태 태그"는 역할(운전 전원·고장·Bypass·Free Swing)마다 태그
 * 하나를 잇는 고정 네 줄이다 — 노드를 움직이지 않고 라벨의 색·아이콘을
 * 정한다. 편집 채널은 onUpdateStatusTags 로 따로지만 규칙은 같다.
 *
 * 역할마다 카드 하나다 — 머리줄에 역할 이름과 미리보기 값(없음·Off·On),
 * 아랫줄에 태그 선택. 카드 위 한 줄에 지금 라벨이 그려지는 모양(왼쪽)과
 * 미리보기 초기화(오른쪽, 항상 보인다)를 둔다. 값을 고르면 캔버스의 라벨이
 * 그 값으로 바로 그려진다 — 에디터에는 값 생산자가 없어 연결만으로는 모양을
 * 볼 수 없다. 미리보기는 세션 상태(features useLabelPreviewStore)라 저장되지
 * 않고, 구역을 접거나 다른 모델을 고르면 지워진다.
 *
 * 화면에서 두 구역의 이름은 "트랜스폼"(맵핑 목록)·"상태"(상태 태그)다. 각각
 * 접고 펼 수 있고 접힌 채 연다.
 */
export type TagMappingsUpdater = (mappings: TagMapping[]) => TagMapping[];
export type StatusTagsUpdater = (tags: ModelStatusTags) => ModelStatusTags;

const NO_MAPPINGS: TagMapping[] = [];
const NO_STATUS_TAGS: ModelStatusTags = {};

export interface TagMappingSectionProps {
  model: SavedModelInfo;
  rigs: RigDefinition[];
  onUpdate: (updater: TagMappingsUpdater) => void;
  onUpdateStatusTags: (updater: StatusTagsUpdater) => void;
  t: InspectorT;
}

function ConflictNote({
  conflict,
  t,
}: {
  conflict: TagMappingConflict;
  t: InspectorT;
}) {
  return (
    <p className="flex items-start gap-1 text-[10px] text-amber-500">
      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
      <span>
        {t(
          conflict === 'duplicate'
            ? 'monitoring:inspector.mapping.conflictDuplicate'
            : 'monitoring:inspector.mapping.conflictRig',
        )}
      </span>
    </p>
  );
}

function MappingCard({
  mapping,
  rig,
  options,
  nodesReady,
  conflict,
  unresolved,
  tagValue,
  appliedValue,
  onChange,
  onRemove,
  t,
}: {
  mapping: TagMapping;
  rig: RigDefinition | undefined;
  options: ModelNodeOption[];
  nodesReady: boolean;
  conflict: TagMappingConflict | undefined;
  unresolved: boolean;
  tagValue: number | undefined;
  appliedValue: number | undefined;
  onChange: (patch: Partial<TagMapping>) => void;
  onRemove: () => void;
  t: InspectorT;
}) {
  const { target } = mapping;
  const drivenIds = useMemo(
    () => (rig ? getDrivenJointIds(rig) : new Set<string>()),
    [rig],
  );
  const jointOptions = (rig?.joints ?? []).filter((j) => !drivenIds.has(j.id));
  const unit = getTagMappingUnit(target, rig);
  const jointKnown =
    target.kind !== 'joint' ||
    jointOptions.some((j) => j.id === target.jointId);

  return (
    <div
      className={cn(
        'border-border bg-muted/30 space-y-1.5 rounded-md border p-2',
        conflict && 'border-amber-500/60',
      )}
    >
      <div className="flex items-center gap-1.5">
        {rig ? (
          <div
            className="flex flex-1 gap-0.5"
            role="group"
            aria-label={t('monitoring:inspector.mapping.targetKind')}
          >
            {(['node', 'joint'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={target.kind === kind}
                className={cn(
                  'h-6 flex-1 cursor-pointer rounded-sm border text-[10px]',
                  target.kind === kind
                    ? 'border-primary/50 bg-primary/15 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
                onClick={() =>
                  onChange({ target: switchTargetKind(target, kind, rig) })
                }
              >
                {t(
                  kind === 'node'
                    ? 'monitoring:inspector.mapping.targetNode'
                    : 'monitoring:inspector.mapping.targetJoint',
                )}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground flex-1 text-[10px]">
            {t('monitoring:inspector.mapping.targetNode')}
          </span>
        )}
        {unresolved ? (
          <AlertTriangle
            className="size-3.5 shrink-0 text-amber-500"
            aria-label={t('monitoring:inspector.rigging.unresolvedNode')}
          />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-red-300"
          aria-label={t('monitoring:inspector.mapping.remove')}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {target.kind === 'node' ? (
        <>
          <Field compact label={t('monitoring:inspector.mapping.node')}>
            <NodeSelect
              value={target.node}
              options={options}
              rootLabel={t('monitoring:inspector.mapping.root')}
              onChange={(node) => onChange({ target: { ...target, node } })}
              t={t}
            />
          </Field>
          <Field compact label={t('monitoring:inspector.mapping.channel')}>
            <select
              className={FIELD_SELECT}
              value={target.channel}
              onChange={(event) =>
                onChange({
                  target: {
                    ...target,
                    channel: event.target
                      .value as (typeof TAG_MAPPING_CHANNELS)[number],
                  },
                })
              }
            >
              {TAG_MAPPING_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {t(`monitoring:inspector.mapping.channels.${channel}`)}
                </option>
              ))}
            </select>
            <AxisSegment
              value={target.axis}
              onChange={(axis) => onChange({ target: { ...target, axis } })}
              label={t('monitoring:inspector.mapping.axis')}
            />
          </Field>
          {!nodesReady ? (
            <p className="text-muted-foreground text-[10px]">
              {t('monitoring:inspector.rigging.nodesUnavailable')}
            </p>
          ) : null}
        </>
      ) : (
        <Field compact label={t('monitoring:inspector.mapping.joint')}>
          <select
            className={cn(
              FIELD_SELECT,
              !jointKnown && 'border-amber-500 text-amber-500',
            )}
            value={target.jointId}
            onChange={(event) =>
              onChange({
                target: { kind: 'joint', jointId: event.target.value },
              })
            }
          >
            {!jointKnown ? (
              <option value={target.jointId}>
                {t('monitoring:inspector.rigging.unresolvedNode')}:{' '}
                {target.jointId || '—'}
              </option>
            ) : null}
            {jointOptions.map((joint) => (
              <option key={joint.id} value={joint.id}>
                {joint.label ?? joint.id}
              </option>
            ))}
          </select>
          {jointOptions.length === 0 ? (
            <span className="text-muted-foreground shrink-0 text-[10px]">
              {t('monitoring:inspector.mapping.noJoints')}
            </span>
          ) : null}
        </Field>
      )}

      <Field compact label={t('monitoring:inspector.mapping.tag')}>
        <TagKeyCombobox
          value={mapping.tagKey}
          onChange={(tagKey) => onChange({ tagKey })}
          className="h-6 rounded-sm text-[11px]"
          t={t}
        />
      </Field>

      {mapping.tagKey ? (
        <>
          {/* scale·offset 은 한 줄이다. scale 라벨을 라벨 열에 두어 첫 입력이
              위 줄들의 입력과 같은 자리에서 시작하고, 두 입력이 남는 폭을
              반씩 나눠 오른쪽 끝까지 채운다. */}
          <Field compact label={t('monitoring:inspector.mapping.scale')}>
            <NumberField
              value={mapping.scale}
              placeholder="1"
              step={0.01}
              onChange={(scale) => onChange({ scale })}
            />
            <span className={FIELD_LABEL_COMPACT}>
              {t('monitoring:inspector.mapping.offset')}
            </span>
            <NumberField
              value={mapping.offset}
              placeholder="0"
              onChange={(offset) => onChange({ offset })}
            />
          </Field>
          {/* 값이 들어올 때만 보인다 — 에디터처럼 값 생산자가 없는 화면에서는
              줄 자체가 없다. */}
          {tagValue === undefined ? null : (
            <p
              className={cn(
                FIELD_INDENT_COMPACT,
                'text-muted-foreground font-mono text-[10px]',
              )}
            >
              {t('monitoring:inspector.mapping.readout', {
                tag: formatMappingValue(tagValue),
                applied: formatMappingValue(appliedValue),
                unit,
              })}
            </p>
          )}
          {/* 라벨 표시 — 모델 라벨 위에 이 태그의 원시값을 보인다. 끄면
              필드를 지워 저장본에 남기지 않는다(이름은 보존). */}
          <div
            className={cn(
              FIELD_INDENT_COMPACT,
              'flex min-h-6 items-center gap-2',
            )}
          >
            <label className="text-muted-foreground hover:text-foreground flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] transition-colors">
              <Checkbox
                checked={mapping.showOnLabel === true}
                onCheckedChange={(checked) =>
                  onChange({ showOnLabel: checked ? true : undefined })
                }
                className="size-3.5 cursor-pointer [&>[data-slot=checkbox-indicator]>svg]:size-3"
              />
              {t('monitoring:inspector.mapping.showOnLabel')}
            </label>
            {mapping.showOnLabel === true ? (
              <Input
                value={mapping.caption ?? ''}
                maxLength={TAG_MAPPING_CAPTION_MAX}
                placeholder={t(
                  'monitoring:inspector.mapping.captionPlaceholder',
                )}
                aria-label={t('monitoring:inspector.mapping.caption')}
                className={cn(FIELD_INPUT, 'min-w-0 flex-1')}
                onChange={(event) =>
                  onChange({ caption: event.target.value || undefined })
                }
              />
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:inspector.mapping.tagMissing')}
        </p>
      )}

      {conflict ? <ConflictNote conflict={conflict} t={t} /> : null}
    </div>
  );
}

/** 카드 머리줄의 값 선택 폭 — 카드마다 같은 자리에 선다. */
const PREVIEW_COLUMN = 'flex w-32 shrink-0';

/** 고른 값이 없을 때 에디터 라벨의 모양 — 값 생산자가 없어 늘 상태 미확인이다. */
const NO_PREVIEW_STATE: EquipmentLabelState = {
  tone: 'unknown',
  bypass: false,
  freeSwing: false,
};

/** 상태 역할의 두 묶음 — 그리는 곳(라벨·외곽선)으로 나눈다. */
const STATUS_TAG_GROUPS: readonly {
  id: 'label' | 'outline';
  roles: readonly StatusTagRole[];
}[] = [
  { id: 'label', roles: LABEL_STATUS_TAG_ROLES },
  { id: 'outline', roles: OUTLINE_STATUS_TAG_ROLES },
];

/** 묶음 하나 — 작은 제목 아래에 역할 카드를 쌓는다. */
function StatusTagGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground px-2 pt-1 text-[10px] font-medium">
        {title}
      </p>
      {children}
    </div>
  );
}

/** 역할 하나의 묶음 — 맵핑 카드와 같은 테두리. 연결된 역할은 테두리를 강조한다. */
function StatusTagCard({
  linked,
  children,
}: {
  linked: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-muted/30 space-y-1.5 rounded-md border p-2',
        linked ? 'border-primary/40' : 'border-border',
      )}
    >
      {children}
    </div>
  );
}

function StatusTagRows({
  modelId,
  tags,
  onUpdate,
  t,
}: {
  modelId: string;
  tags: ModelStatusTags;
  onUpdate: (updater: StatusTagsUpdater) => void;
  t: InspectorT;
}) {
  const preview = useLabelPreview(modelId);
  const previewState = useLabelPreviewState(modelId);
  const previewOutline = useOutlinePreviewState(modelId);
  const setBit = useLabelPreviewStore((s) => s.setBit);
  const setMoving = useLabelPreviewStore((s) => s.setMoving);
  const clearPreview = useLabelPreviewStore((s) => s.clear);

  // 미리보기는 이 구역이 떠 있는 동안, 이 모델에만 — 남아 있으면 라벨이
  // 저장된 상태처럼 보인다.
  useEffect(() => clearPreview, [clearPreview, modelId]);

  const bitChoices = PREVIEW_CHOICES.map((value) => ({
    value,
    label: t(`monitoring:inspector.statusTags.previewChoices.${value}`),
  }));
  const motionChoices = PREVIEW_CHOICES.map((value) => ({
    value,
    label: t(`monitoring:inspector.statusTags.motionChoices.${value}`),
  }));
  const previewLabel = t('monitoring:inspector.statusTags.preview');
  const motionLabel = t('monitoring:inspector.statusTags.motion');

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[10px]">
        {t('monitoring:inspector.statusTags.hint')}
      </p>

      {/* 지금 라벨·외곽선이 그려지는 모양(왼쪽)과 미리보기 초기화(오른쪽). 고른
          값이 없으면 에디터의 라벨은 상태 미확인이고 외곽선은 없다. */}
      <div className="flex min-h-6 items-center gap-1.5 px-2">
        <p className="text-foreground min-w-0 flex-1 truncate text-left text-[10px]">
          {t('monitoring:inspector.statusTags.previewResult', {
            state: describeLabelState(
              previewState ?? NO_PREVIEW_STATE,
              {
                tone: {
                  fault: t('monitoring:runtimeStatus.fault'),
                  running: t('monitoring:runtimeStatus.running'),
                  standby: t('monitoring:runtimeStatus.standby'),
                  off: t('monitoring:runtimeStatus.off'),
                  offline: t('monitoring:runtimeStatus.offline'),
                  unknown: t('monitoring:runtimeStatus.unknown'),
                },
                bypass: t('monitoring:labelState.bypass'),
                freeSwing: t('monitoring:labelState.freeSwing'),
                outline: {
                  commError: t('monitoring:outlineState.commError'),
                  slowdown: t('monitoring:outlineState.slowdown'),
                  endstop: t('monitoring:outlineState.endstop'),
                },
              },
              previewOutline,
            ),
          })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground shrink-0"
          aria-label={t('monitoring:inspector.statusTags.previewReset')}
          title={t('monitoring:inspector.statusTags.previewReset')}
          onClick={clearPreview}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      {STATUS_TAG_GROUPS.map((group) => (
        <StatusTagGroup
          key={group.id}
          title={t(`monitoring:inspector.statusTags.groups.${group.id}`)}
        >
          {group.roles.map((role) => {
            const key = tags[role] ?? '';
            const roleLabel = t(
              `monitoring:inspector.statusTags.roles.${role}`,
            );
            return (
              <StatusTagCard key={role} linked={key !== ''}>
                <div className="flex items-center gap-2">
                  <span className="text-foreground min-w-0 flex-1 truncate text-[11px] font-medium">
                    {roleLabel}
                  </span>
                  <div className={PREVIEW_COLUMN}>
                    <ChoiceSegment
                      value={toPreviewChoice(preview.bits[role])}
                      options={bitChoices}
                      onChange={(choice) =>
                        setBit(modelId, role, fromPreviewChoice(choice))
                      }
                      label={`${roleLabel} ${previewLabel}`}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <TagKeyCombobox
                    value={key}
                    onChange={(next) =>
                      onUpdate((prev) => setStatusTag(prev, role, next))
                    }
                    className="h-6 rounded-sm text-[11px]"
                    t={t}
                  />
                  {key ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground shrink-0"
                      aria-label={t('monitoring:inspector.statusTags.clear')}
                      title={t('monitoring:inspector.statusTags.clear')}
                      onClick={() =>
                        onUpdate((prev) => setStatusTag(prev, role, ''))
                      }
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </StatusTagCard>
            );
          })}
          {/* 움직임은 라벨의 색을 정하는 값이라 라벨 묶음 끝에 둔다. 태그가
              아니라 축 값의 변화라 연결할 것이 없어 값만 고른다. */}
          {group.id === 'label' ? (
            <StatusTagCard linked={false}>
              <div className="flex items-center gap-2">
                <span className="text-foreground min-w-0 flex-1 truncate text-[11px] font-medium">
                  {motionLabel}
                </span>
                <div className={PREVIEW_COLUMN}>
                  <ChoiceSegment
                    value={toPreviewChoice(preview.moving)}
                    options={motionChoices}
                    onChange={(choice) =>
                      setMoving(modelId, fromPreviewChoice(choice))
                    }
                    label={`${motionLabel} ${previewLabel}`}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-[10px]">
                {t('monitoring:inspector.statusTags.motionHint')}
              </p>
            </StatusTagCard>
          ) : null}
        </StatusTagGroup>
      ))}
    </div>
  );
}

export function TagMappingSection({
  model,
  rigs,
  onUpdate,
  onUpdateStatusTags,
  t,
}: TagMappingSectionProps) {
  useRigLivePoll();
  // 두 구역 모두 접힌 채 연다 — 제목 옆 개수로 내용 유무를 알린다.
  const [mappingsOpen, setMappingsOpen] = useState(false);
  const [statusTagsOpen, setStatusTagsOpen] = useState(false);

  const rig = rigs.find((r) => r.id === model.rigId);
  const mappings = model.tagMappings ?? NO_MAPPINGS;
  const statusTags = model.statusTags ?? NO_STATUS_TAGS;
  const root = modelObjectRegistry.get(model.id) ?? null;
  const options = useMemo(
    () => (root ? listModelNodeOptions(buildModelNodeTree(root)) : []),
    [root],
  );
  const knownPaths = useMemo(
    () => new Set(options.map((o) => o.path)),
    [options],
  );
  const conflicts = useMemo(
    () => findTagMappingConflicts(mappings, rig),
    [mappings, rig],
  );
  const readout = rigLiveReadouts.get(model.id);

  const updateMapping = (id: string, patch: Partial<TagMapping>) => {
    onUpdate((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  return (
    <div className="space-y-2">
      <div className="text-foreground pb-1.5 text-[12px] font-medium">
        {t('monitoring:inspector.mapping.title')}
      </div>

      <CollapsibleSection
        title={t('monitoring:inspector.mapping.list')}
        count={mappings.length}
        open={mappingsOpen}
        onOpenChange={setMappingsOpen}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={t('monitoring:inspector.mapping.add')}
            title={t('monitoring:inspector.mapping.add')}
            onClick={() => {
              onUpdate((prev) => [...prev, createTagMapping()]);
              // 접힌 채 추가하면 새 카드가 보이지 않는다.
              setMappingsOpen(true);
            }}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      >
        <div className="space-y-1.5">
          {mappings.map((mapping) => {
            const nodeUnresolved =
              mapping.target.kind === 'node' &&
              root !== null &&
              mapping.target.node !== '' &&
              !knownPaths.has(mapping.target.node);
            const tagValue = mapping.tagKey
              ? tagLiveValues.get(mapping.tagKey)?.value
              : undefined;
            const applied =
              mapping.target.kind === 'joint'
                ? readout?.jointValues.get(mapping.target.jointId)
                : (readout?.mappingValues.get(mapping.id) ??
                  computeAppliedValue(mapping, tagValue));
            return (
              <MappingCard
                key={mapping.id}
                mapping={mapping}
                rig={rig}
                options={options}
                nodesReady={root !== null}
                conflict={conflicts.get(mapping.id)}
                unresolved={
                  nodeUnresolved ||
                  (readout?.unresolvedMappings.includes(mapping.id) ?? false)
                }
                tagValue={tagValue}
                appliedValue={applied}
                onChange={(patch) => updateMapping(mapping.id, patch)}
                onRemove={() =>
                  onUpdate((prev) => prev.filter((m) => m.id !== mapping.id))
                }
                t={t}
              />
            );
          })}
          {mappings.length === 0 ? (
            <p className="text-muted-foreground text-[10px]">
              {t('monitoring:inspector.mapping.empty')}
            </p>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('monitoring:inspector.statusTags.title')}
        count={Object.keys(statusTags).length}
        open={statusTagsOpen}
        onOpenChange={setStatusTagsOpen}
      >
        <StatusTagRows
          modelId={model.id}
          tags={statusTags}
          onUpdate={onUpdateStatusTags}
          t={t}
        />
      </CollapsibleSection>
    </div>
  );
}
