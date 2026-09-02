import { AlertTriangle, Link2, Plus, RotateCcw, Tag, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  getDrivenJointIds,
  getRigJointUnit,
  modelObjectRegistry,
  RIG_HINGE_DEFAULT_RANGE,
  RIG_JOINT_TYPES,
  RIG_SLIDE_DEFAULT_RANGE,
  type RigDefinition,
  type RigJoint,
  type RigLinearConstraint,
  type SavedModelInfo,
} from '@crane/domain/3d';
import {
  makeJointAddress,
  manualJointSource,
  rigLiveReadouts,
  rigValueStore,
  useRigLivePoll,
  useVirtualTagStore,
  type RigModelReadout,
} from '@crane/features/3d';
import { createId } from '@crane/core/lib/create-id';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { Input } from '@crane/ui/atoms/input';
import { InputNumber } from '@crane/ui/atoms/input-number';
import {
  buildModelNodeTree,
  listModelNodeOptions,
  type ModelNodeOption,
} from '../lib/model-node-tree';
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_SELECT,
  NUMBER_INPUT,
  NUMBER_WRAPPER,
} from './inspector-field-classes';
import {
  AxisSegment,
  Field,
  NodeSelect,
  NumberField,
  SubHeader,
  type InspectorT,
} from './inspector-fields';

/**
 * 인스펙터 "리깅" 탭 — 컨셉 A(인스펙터 탭형).
 *
 * [리그 선택/생성] → [관절 카드: 노드·타입·축·한계·슬라이더] →
 * [선형 연동 카드: 입력 관절 × 계수 + 오프셋 → 출력 관절].
 * 관절 ← 태그 연결은 "태그 매핑" 탭(tag-mapping-section)이 맡고, 여기서는
 * 연결된 관절에 배지만 단다.
 *
 * 슬라이더 값은 씬 데이터가 아니다 — manualJointSource 로 값 저장소에 직행하고
 * 히스토리에도 남지 않는다. 정의 편집만 updateRig 를 거쳐 undo/redo 된다.
 * readout 은 15Hz 폴링(useRigLivePoll)으로 읽는다. 연동의 출력 관절(driven)은
 * 슬라이더가 잠기고 드라이버가 계산한 값만 보여 준다. 시뮬레이션 재생 중
 * 태그가 꽂힌 관절도 같은 이유로 잠긴다 — 슬라이더와 태그가 같은 주소를
 * 두고 매 틱 싸우면 손이 "안 먹는다".
 */

type T = InspectorT;

export type RigUpdater = (rig: RigDefinition) => RigDefinition;

export interface RiggingSectionProps {
  model: SavedModelInfo;
  rigs: RigDefinition[];
  onCreateRig: () => void;
  onAssignRig: (rigId: string | null) => void;
  onUpdateRig: (rigId: string, updater: RigUpdater) => void;
  onRemoveRig: (rigId: string) => void;
  t: T;
}

function jointRange(joint: RigJoint): { min: number; max: number } {
  const fallback =
    joint.type === 'hinge' ? RIG_HINGE_DEFAULT_RANGE : RIG_SLIDE_DEFAULT_RANGE;
  const min = joint.min ?? fallback.min;
  const max = joint.max ?? fallback.max;
  return min < max ? { min, max } : { min: fallback.min, max: fallback.max };
}

function fmt(value: number | undefined, digits = 2): string {
  return value !== undefined && Number.isFinite(value)
    ? value.toFixed(digits)
    : '—';
}

function jointName(joint: RigJoint | undefined, id: string): string {
  return joint?.label ?? joint?.id ?? id;
}

function JointCard({
  modelId,
  joint,
  options,
  unresolved,
  driven,
  appliedValue,
  taggedKey,
  simulating,
  onChange,
  onRemove,
  t,
}: {
  modelId: string;
  joint: RigJoint;
  options: ModelNodeOption[];
  unresolved: boolean;
  /** 선형 연동의 출력 관절 — 슬라이더가 잠기고 계산값만 보여 준다. */
  driven: boolean;
  /** 드라이버가 이번 프레임에 적용한 값(readout). */
  appliedValue: number | undefined;
  /** 태그 매핑 탭에서 이 관절에 연결한 태그 키(없으면 undefined). */
  taggedKey: string | undefined;
  /** 시뮬레이션 재생 중 — 태그가 꽂힌 관절은 슬라이더를 잠근다. */
  simulating: boolean;
  onChange: (patch: Partial<RigJoint>) => void;
  onRemove: () => void;
  t: T;
}) {
  const address = makeJointAddress(modelId, joint.id);
  const tagDriven = taggedKey !== undefined && simulating;
  const value =
    driven || tagDriven
      ? (appliedValue ?? 0)
      : rigValueStore.getTarget(address);
  const range = jointRange(joint);
  const unit = getRigJointUnit(joint.type);
  const step = joint.type === 'hinge' ? 0.5 : 0.05;
  const locked = unresolved || driven || tagDriven;

  return (
    <div className="border-border bg-muted/30 space-y-1.5 rounded-md border p-2">
      <div className="flex items-center gap-1.5">
        <Input
          value={joint.label ?? ''}
          placeholder={joint.id}
          aria-label={t('monitoring:inspector.rigging.label')}
          className={cn(FIELD_INPUT, 'h-6 flex-1 font-medium')}
          onChange={(event) => {
            const next = event.target.value;
            onChange({ label: next.trim() ? next : undefined });
          }}
        />
        {driven ? (
          <span
            className="flex shrink-0 items-center text-amber-500"
            aria-label={t('monitoring:inspector.rigging.driven')}
            title={t('monitoring:inspector.rigging.drivenHint')}
          >
            <Link2 className="size-3.5" />
          </span>
        ) : null}
        {taggedKey !== undefined ? (
          <span
            className="text-primary flex shrink-0 items-center"
            aria-label={t('monitoring:inspector.mapping.joinLabel', {
              tag: taggedKey,
            })}
            title={t('monitoring:inspector.mapping.joinLabel', {
              tag: taggedKey,
            })}
          >
            <Tag className="size-3.5" />
          </span>
        ) : null}
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
          aria-label={t('monitoring:inspector.rigging.removeJoint')}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <Field label={t('monitoring:inspector.rigging.node')}>
        <NodeSelect
          value={joint.node}
          options={options}
          onChange={(node) => onChange({ node })}
          t={t}
        />
      </Field>
      <div className="flex items-center gap-2">
        <span className={FIELD_LABEL}>
          {t('monitoring:inspector.rigging.type')}
        </span>
        <select
          className={FIELD_SELECT}
          value={joint.type}
          onChange={(event) =>
            onChange({ type: event.target.value as RigJoint['type'] })
          }
        >
          {RIG_JOINT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`monitoring:inspector.rigging.${type}`)}
            </option>
          ))}
        </select>
        <AxisSegment
          value={joint.axis}
          onChange={(axis) => onChange({ axis })}
          label={t('monitoring:inspector.rigging.axis')}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className={FIELD_LABEL}>
          {t('monitoring:inspector.rigging.limits')}
        </span>
        <NumberField
          value={joint.min}
          placeholder={t('monitoring:inspector.rigging.min')}
          onChange={(min) => onChange({ min })}
        />
        <NumberField
          value={joint.max}
          placeholder={t('monitoring:inspector.rigging.max')}
          onChange={(max) => onChange({ max })}
        />
        <label className="text-muted-foreground flex shrink-0 items-center gap-1 text-[10px]">
          <Checkbox
            checked={joint.sign === -1}
            onCheckedChange={(checked) =>
              onChange({ sign: checked ? -1 : undefined })
            }
          />
          {t('monitoring:inspector.rigging.invert')}
        </label>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={step}
          value={value}
          disabled={locked}
          aria-label={joint.label ?? joint.id}
          className="accent-primary h-2 min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          onChange={(event) =>
            manualJointSource.push(
              modelId,
              joint.id,
              Number(event.target.value),
            )
          }
        />
        <InputNumber
          value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
          step={step}
          min={range.min}
          max={range.max}
          disabled={locked}
          className={cn(NUMBER_WRAPPER, 'w-20 shrink-0')}
          inputClassName={cn(NUMBER_INPUT, 'text-right')}
          onChange={(next) => manualJointSource.push(modelId, joint.id, next)}
        />
        <span className="text-muted-foreground w-6 shrink-0 text-[10px]">
          {unit}
        </span>
      </div>
      {driven ? (
        <p className="text-muted-foreground text-[10px] whitespace-pre-line">
          {t('monitoring:inspector.rigging.drivenHint')}
        </p>
      ) : tagDriven ? (
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:inspector.mapping.sliderLockedByTag')}
        </p>
      ) : null}
    </div>
  );
}

function LinearCard({
  constraint,
  joints,
  drivenIds,
  readout,
  onChange,
  onRemove,
  t,
}: {
  constraint: RigLinearConstraint;
  joints: RigJoint[];
  drivenIds: Set<string>;
  readout: RigModelReadout | undefined;
  onChange: (patch: Partial<RigLinearConstraint>) => void;
  onRemove: () => void;
  t: T;
}) {
  const inputJoint = joints.find((j) => j.id === constraint.input);
  const outputJoint = joints.find((j) => j.id === constraint.output);
  const inputValue = readout?.jointValues.get(constraint.input);
  const outputValue = readout?.jointValues.get(constraint.output);
  const sameJoint = constraint.input === constraint.output;

  // 출력 후보: 입력 자신과 다른 연동의 출력은 뺀다(관절당 출력 하나).
  const outputOptions = joints.filter(
    (j) =>
      j.id !== constraint.input &&
      (j.id === constraint.output || !drivenIds.has(j.id)),
  );

  return (
    <div className="border-border bg-muted/30 space-y-1.5 rounded-md border p-2">
      <div className="flex items-center gap-1.5">
        {sameJoint ? (
          <p className="min-w-0 flex-1 truncate text-[10px] text-amber-500">
            {t('monitoring:inspector.rigging.sameJoint')}
          </p>
        ) : (
          <p
            className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] tabular-nums"
            title={`${jointName(inputJoint, constraint.input)} × ${constraint.factor}${
              constraint.offset ? ` + ${constraint.offset}` : ''
            } = ${jointName(outputJoint, constraint.output)}`}
          >
            <span className="text-foreground font-medium">
              {jointName(inputJoint, constraint.input)}
            </span>{' '}
            {fmt(inputValue)} × {constraint.factor}
            {constraint.offset ? ` + ${constraint.offset}` : ''} ={' '}
            <span className="text-foreground font-medium">
              {jointName(outputJoint, constraint.output)}
            </span>{' '}
            {fmt(outputValue)}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-red-300"
          aria-label={t('monitoring:inspector.rigging.removeConstraint')}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <Field label={t('monitoring:inspector.rigging.input')}>
        <select
          className={cn(
            FIELD_SELECT,
            !inputJoint && 'border-amber-500 text-amber-500',
          )}
          value={constraint.input}
          onChange={(event) => onChange({ input: event.target.value })}
        >
          {!inputJoint ? <option value={constraint.input}>—</option> : null}
          {joints.map((j) => (
            <option key={j.id} value={j.id}>
              {jointName(j, j.id)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('monitoring:inspector.rigging.output')}>
        <select
          className={cn(
            FIELD_SELECT,
            (!outputJoint || sameJoint) && 'border-amber-500 text-amber-500',
          )}
          value={constraint.output}
          onChange={(event) => onChange({ output: event.target.value })}
        >
          {!outputJoint ? <option value={constraint.output}>—</option> : null}
          {outputOptions.map((j) => (
            <option key={j.id} value={j.id}>
              {jointName(j, j.id)}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-center gap-2">
        <span className={FIELD_LABEL}>
          {t('monitoring:inspector.rigging.factor')}
        </span>
        <NumberField
          value={constraint.factor}
          placeholder="1"
          step={0.01}
          onChange={(factor) => onChange({ factor: factor ?? 1 })}
        />
        <span className={cn(FIELD_LABEL, 'w-auto')}>
          {t('monitoring:inspector.rigging.offset')}
        </span>
        <NumberField
          value={constraint.offset}
          placeholder="0"
          onChange={(offset) => onChange({ offset })}
        />
      </div>
    </div>
  );
}

export function RiggingSection({
  model,
  rigs,
  onCreateRig,
  onAssignRig,
  onUpdateRig,
  onRemoveRig,
  t,
}: RiggingSectionProps) {
  useRigLivePoll();
  const simulating = useVirtualTagStore((s) => s.isRunning);
  // 관절 id → 연결된 태그 키(태그 매핑 탭의 joint 대상).
  const taggedByJoint = useMemo(() => {
    const out = new Map<string, string>();
    for (const m of model.tagMappings ?? []) {
      if (m.target.kind === 'joint' && m.tagKey) {
        out.set(m.target.jointId, m.tagKey);
      }
    }
    return out;
  }, [model.tagMappings]);

  const rig = rigs.find((r) => r.id === model.rigId) ?? null;
  const candidates = rigs.filter((r) => r.modelPath === model.path);

  // registry 의 clone root 는 마운트 후 고정이라 useMemo 가 폴링 리렌더마다
  // 트리를 다시 만들지 않는다.
  const root = modelObjectRegistry.get(model.id) ?? null;
  const options = useMemo(
    () => (root ? listModelNodeOptions(buildModelNodeTree(root)) : []),
    [root],
  );
  const knownPaths = useMemo(
    () => new Set(options.map((o) => o.path)),
    [options],
  );
  const drivenIds = useMemo(
    () => (rig ? getDrivenJointIds(rig) : new Set<string>()),
    [rig],
  );
  const readout = rigLiveReadouts.get(model.id);

  const updateJoint = (jointId: string, patch: Partial<RigJoint>) => {
    if (!rig) return;
    onUpdateRig(rig.id, (prev) => ({
      ...prev,
      joints: prev.joints.map((j) =>
        j.id === jointId ? { ...j, ...patch } : j,
      ),
    }));
  };

  const addJoint = () => {
    if (!rig) return;
    const joint: RigJoint = {
      id: `joint-${createId().slice(0, 8)}`,
      node: options[0]?.path ?? '',
      type: 'hinge',
      axis: 'y',
    };
    onUpdateRig(rig.id, (prev) => ({
      ...prev,
      joints: [...prev.joints, joint],
    }));
  };

  const removeJoint = (jointId: string) => {
    if (!rig) return;
    manualJointSource.push(model.id, jointId, 0);
    onUpdateRig(rig.id, (prev) => ({
      ...prev,
      joints: prev.joints.filter((j) => j.id !== jointId),
      // 입력이나 출력을 잃은 연동은 같이 지운다 — sanitize 가 어차피 버린다.
      constraints: prev.constraints.filter(
        (c) => c.input !== jointId && c.output !== jointId,
      ),
    }));
  };

  const addLinear = () => {
    if (!rig || rig.joints.length < 2) return;
    const input = rig.joints.find((j) => !drivenIds.has(j.id)) ?? rig.joints[0];
    const output =
      rig.joints.find((j) => j.id !== input.id && !drivenIds.has(j.id)) ??
      rig.joints.find((j) => j.id !== input.id);
    if (!output) return;
    const constraint: RigLinearConstraint = {
      type: 'linear',
      id: `link-${createId().slice(0, 8)}`,
      input: input.id,
      output: output.id,
      factor: 1,
    };
    onUpdateRig(rig.id, (prev) => ({
      ...prev,
      constraints: [...prev.constraints, constraint],
    }));
  };

  const updateConstraint = (
    id: string,
    patch: Partial<RigLinearConstraint>,
  ) => {
    if (!rig) return;
    onUpdateRig(rig.id, (prev) => ({
      ...prev,
      constraints: prev.constraints.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }));
  };

  const removeConstraint = (id: string) => {
    if (!rig) return;
    onUpdateRig(rig.id, (prev) => ({
      ...prev,
      constraints: prev.constraints.filter((c) => c.id !== id),
    }));
  };

  return (
    <div className="space-y-2">
      <div className="text-foreground pb-1.5 text-[12px] font-medium">
        {t('monitoring:inspector.rigging.title')}
      </div>

      <div className="flex items-center gap-1.5">
        <select
          className={FIELD_SELECT}
          value={rig?.id ?? ''}
          aria-label={t('monitoring:inspector.rigging.assign')}
          onChange={(event) => onAssignRig(event.target.value || null)}
        >
          <option value="">{t('monitoring:inspector.rigging.none')}</option>
          {candidates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name || r.id}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={t('monitoring:inspector.rigging.create')}
          title={t('monitoring:inspector.rigging.create')}
          onClick={onCreateRig}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {!root ? (
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:inspector.rigging.nodesUnavailable')}
        </p>
      ) : null}

      {rig ? (
        <>
          <SubHeader title={t('monitoring:inspector.rigging.selectedRig')} />
          <div className="flex items-center gap-1.5">
            <Input
              value={rig.name}
              placeholder={t('monitoring:inspector.rigging.name')}
              aria-label={t('monitoring:inspector.rigging.name')}
              className={FIELD_INPUT}
              onChange={(event) =>
                onUpdateRig(rig.id, (prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-red-300"
              aria-label={t('monitoring:inspector.rigging.deleteRig')}
              title={t('monitoring:inspector.rigging.deleteRig')}
              onClick={() => onRemoveRig(rig.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          <SubHeader
            title={t('monitoring:inspector.rigging.joints')}
            action={
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label={t('monitoring:inspector.rigging.resetValues')}
                  title={t('monitoring:inspector.rigging.resetValues')}
                  onClick={() => manualJointSource.resetModel(model.id)}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label={t('monitoring:inspector.rigging.addJoint')}
                  title={t('monitoring:inspector.rigging.addJoint')}
                  onClick={addJoint}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            }
          />
          <div className="space-y-1.5">
            {rig.joints.map((joint) => (
              <JointCard
                key={joint.id}
                modelId={model.id}
                joint={joint}
                options={options}
                unresolved={
                  root !== null &&
                  (joint.node === '' ? false : !knownPaths.has(joint.node))
                }
                driven={drivenIds.has(joint.id)}
                appliedValue={readout?.jointValues.get(joint.id)}
                taggedKey={taggedByJoint.get(joint.id)}
                simulating={simulating}
                onChange={(patch) => updateJoint(joint.id, patch)}
                onRemove={() => removeJoint(joint.id)}
                t={t}
              />
            ))}
            {rig.joints.length === 0 ? (
              <p className="text-muted-foreground text-[10px]">
                {t('monitoring:inspector.rigging.noJoints')}
              </p>
            ) : null}
          </div>

          <SubHeader
            title={t('monitoring:inspector.rigging.constraints')}
            action={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                disabled={rig.joints.length < 2}
                aria-label={t('monitoring:inspector.rigging.addLinear')}
                title={
                  rig.joints.length < 2
                    ? t('monitoring:inspector.rigging.needTwoJoints')
                    : t('monitoring:inspector.rigging.addLinear')
                }
                onClick={addLinear}
              >
                <Plus className="size-3.5" />
              </Button>
            }
          />
          <div className="space-y-1.5">
            {rig.constraints.map((constraint) => (
              <LinearCard
                key={constraint.id}
                constraint={constraint}
                joints={rig.joints}
                drivenIds={drivenIds}
                readout={readout}
                onChange={(patch) => updateConstraint(constraint.id, patch)}
                onRemove={() => removeConstraint(constraint.id)}
                t={t}
              />
            ))}
          </div>

        </>
      ) : null}
    </div>
  );
}
