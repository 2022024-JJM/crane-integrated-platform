import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  getDrivenJointIds,
  getTagMappingUnit,
  modelObjectRegistry,
  TAG_MAPPING_CHANNELS,
  type RigDefinition,
  type SavedModelInfo,
  type TagMapping,
} from '@crane/domain/3d';
import {
  rigLiveReadouts,
  tagLiveValues,
  useRigLivePoll,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  buildModelNodeTree,
  listModelNodeOptions,
  type ModelNodeOption,
} from '../lib/model-node-tree';
import {
  computeAppliedValue,
  createTagMapping,
  findTagMappingConflicts,
  formatMappingValue,
  switchTargetKind,
  type TagMappingConflict,
} from '../lib/tag-mapping-editor';
import { FIELD_SELECT } from './inspector-field-classes';
import {
  AxisSegment,
  Field,
  NodeSelect,
  NumberField,
  SubHeader,
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
 */
export type TagMappingsUpdater = (mappings: TagMapping[]) => TagMapping[];

const NO_MAPPINGS: TagMapping[] = [];

export interface TagMappingSectionProps {
  model: SavedModelInfo;
  rigs: RigDefinition[];
  onUpdate: (updater: TagMappingsUpdater) => void;
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
  const jointOptions = (rig?.joints ?? []).filter(
    (j) => !drivenIds.has(j.id),
  );
  const unit = getTagMappingUnit(target, rig);
  const jointKnown =
    target.kind !== 'joint' || jointOptions.some((j) => j.id === target.jointId);

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
          <Field label={t('monitoring:inspector.mapping.node')}>
            <NodeSelect
              value={target.node}
              options={options}
              rootLabel={t('monitoring:inspector.mapping.root')}
              onChange={(node) => onChange({ target: { ...target, node } })}
              t={t}
            />
          </Field>
          <Field label={t('monitoring:inspector.mapping.channel')}>
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
        <Field label={t('monitoring:inspector.mapping.joint')}>
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

      <Field label={t('monitoring:inspector.mapping.tag')}>
        <TagKeyCombobox
          value={mapping.tagKey}
          onChange={(tagKey) => onChange({ tagKey })}
          className="h-6 rounded-sm text-[11px]"
          t={t}
        />
      </Field>

      {mapping.tagKey ? (
        <>
          <div className="ml-16 flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground w-8 shrink-0">
              {t('monitoring:inspector.mapping.scale')}
            </span>
            <NumberField
              value={mapping.scale}
              placeholder="1"
              step={0.01}
              onChange={(scale) => onChange({ scale })}
            />
            <span className="text-muted-foreground w-8 shrink-0">
              {t('monitoring:inspector.mapping.offset')}
            </span>
            <NumberField
              value={mapping.offset}
              placeholder="0"
              onChange={(offset) => onChange({ offset })}
            />
          </div>
          <p className="text-muted-foreground ml-16 font-mono text-[10px]">
            {tagValue === undefined
              ? t('monitoring:inspector.mapping.readoutIdle')
              : t('monitoring:inspector.mapping.readout', {
                  tag: formatMappingValue(tagValue),
                  applied: formatMappingValue(appliedValue),
                  unit,
                })}
          </p>
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

export function TagMappingSection({
  model,
  rigs,
  onUpdate,
  t,
}: TagMappingSectionProps) {
  useRigLivePoll();

  const rig = rigs.find((r) => r.id === model.rigId);
  const mappings = model.tagMappings ?? NO_MAPPINGS;
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
    onUpdate((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  return (
    <div className="space-y-2">
      <div className="text-foreground pb-1.5 text-[12px] font-medium">
        {t('monitoring:inspector.mapping.title')}
      </div>

      <SubHeader
        title={t('monitoring:inspector.mapping.list')}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={t('monitoring:inspector.mapping.add')}
            title={t('monitoring:inspector.mapping.add')}
            onClick={() => onUpdate((prev) => [...prev, createTagMapping()])}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      />

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
    </div>
  );
}
