import { AlertTriangle, Link2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  getDrivenJointIds,
  getRigJointUnit,
  modelObjectRegistry,
  RIG_AXES,
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
  type RigModelReadout,
} from '@crane/features/3d';
import { createId } from '@crane/core/lib/create-id';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { Input } from '@crane/ui/atoms/input';
import {
  buildModelNodeTree,
  listModelNodeOptions,
  type ModelNodeOption,
} from '../lib/model-node-tree';

/**
 * 인스펙터 "리깅" 탭 — 컨셉 A(인스펙터 탭형).
 *
 * [리그 선택/생성] → [관절 카드: 노드·타입·축·한계·슬라이더] →
 * [선형 연동 카드: 입력 관절 × 계수 + 오프셋 → 출력 관절] → [태그 바인딩(저장만)].
 *
 * 슬라이더 값은 씬 데이터가 아니다 — manualJointSource 로 값 저장소에 직행하고
 * 히스토리에도 남지 않는다. 정의 편집만 updateRig 를 거쳐 undo/redo 된다.
 * readout 은 15Hz 폴링(useRigLivePoll)으로 읽는다. 연동의 출력 관절(driven)은
 * 슬라이더가 잠기고 드라이버가 계산한 값만 보여 준다.
 */

type T = (key: string, options?: Record<string, unknown>) => string;

export type RigUpdater = (rig: RigDefinition) => RigDefinition;

export interface RiggingSectionProps {
  model: SavedModelInfo;
  rigs: RigDefinition[];
  onCreateRig: () => void;
  onAssignRig: (rigId: string | null) => void;
  onUpdateRig: (rigId: string, updater: RigUpdater) => void;
  onRemoveRig: (rigId: string) => void;
  onBindingChange: (
    jointId: string,
    key: string,
    scale?: number,
    offset?: number,
  ) => void;
  t: T;
}

const FIELD_INPUT =
  'border-border bg-muted text-foreground placeholder:text-muted-foreground h-6 w-full rounded-sm px-2 text-[11px]';
const FIELD_SELECT =
  'border-border bg-muted text-foreground h-6 w-full min-w-0 rounded-sm border px-1 text-[11px]';
const FIELD_LABEL = 'text-muted-foreground w-14 shrink-0 text-[10px]';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </div>
  );
}

function NodeSelect({
  value,
  options,
  onChange,
  t,
}: {
  value: string;
  options: ModelNodeOption[];
  onChange: (path: string) => void;
  t: T;
}) {
  const known = options.some((o) => o.path === value);
  return (
    <select
      className={cn(FIELD_SELECT, !known && 'border-amber-500 text-amber-500')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      title={value}
    >
      {!known ? (
        <option value={value}>
          {t('monitoring:inspector.rigging.unresolvedNode')}: {value || '—'}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.path} value={o.path}>
          {o.label.replace(/ /g, ' ')}
          {o.kind === 'mesh' ? ' ▪' : ''}
        </option>
      ))}
    </select>
  );
}

function NumberField({
  value,
  placeholder,
  onChange,
  step = 'any',
  className,
}: {
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  step?: number | 'any';
  className?: string;
}) {
  return (
    <Input
      type="number"
      step={step}
      value={value ?? ''}
      placeholder={placeholder}
      className={cn(FIELD_INPUT, className)}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw.trim() === '') {
          onChange(undefined);
          return;
        }
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
    />
  );
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
  onChange: (patch: Partial<RigJoint>) => void;
  onRemove: () => void;
  t: T;
}) {
  const address = makeJointAddress(modelId, joint.id);
  const value = driven ? (appliedValue ?? 0) : rigValueStore.getTarget(address);
  const range = jointRange(joint);
  const unit = getRigJointUnit(joint.type);
  const step = joint.type === 'hinge' ? 0.5 : 0.05;
  const locked = unresolved || driven;

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
        <div
          className="flex shrink-0 gap-0.5"
          role="group"
          aria-label={t('monitoring:inspector.rigging.axis')}
        >
          {RIG_AXES.map((axis) => (
            <button
              key={axis}
              type="button"
              aria-pressed={joint.axis === axis}
              className={cn(
                'h-6 w-6 cursor-pointer rounded-sm border font-mono text-[11px] uppercase',
                joint.axis === axis
                  ? 'border-primary/50 bg-primary/15 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
              onClick={() => onChange({ axis })}
            >
              {axis}
            </button>
          ))}
        </div>
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
        <Input
          type="number"
          step={step}
          value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
          disabled={locked}
          className={cn(FIELD_INPUT, 'w-16 shrink-0 text-right tabular-nums')}
          onChange={(event) => {
            const parsed = parseFloat(event.target.value);
            if (Number.isFinite(parsed)) {
              manualJointSource.push(modelId, joint.id, parsed);
            }
          }}
        />
        <span className="text-muted-foreground w-6 shrink-0 text-[10px]">
          {unit}
        </span>
      </div>
      {driven ? (
        <p className="text-muted-foreground text-[10px] whitespace-pre-line">
          {t('monitoring:inspector.rigging.drivenHint')}
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

function BindingRow({
  joint,
  binding,
  craneId,
  onChange,
  t,
}: {
  joint: RigJoint;
  binding: { key: string; scale?: number; offset?: number } | undefined;
  craneId?: string;
  onChange: (key: string, scale?: number, offset?: number) => void;
  t: T;
}) {
  const prefix = craneId ? `${craneId}:` : '';
  const key = binding?.key ?? '';
  const tagCode = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className="text-muted-foreground w-14 shrink-0 truncate"
          title={joint.id}
        >
          {joint.label ?? joint.id}
        </span>
        <Input
          value={tagCode}
          placeholder={t('monitoring:inspector.tagKeyPlaceholder')}
          className={FIELD_INPUT}
          onChange={(event) => {
            const code = event.target.value.trim();
            onChange(
              code ? `${prefix}${code}` : '',
              binding?.scale,
              binding?.offset,
            );
          }}
        />
      </div>
      {tagCode ? (
        <div className="ml-16 flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground w-8 shrink-0">scale</span>
          <NumberField
            value={binding?.scale ?? 1}
            onChange={(scale) => onChange(key, scale ?? 1, binding?.offset)}
          />
          <span className="text-muted-foreground w-8 shrink-0">offset</span>
          <NumberField
            value={binding?.offset ?? 0}
            onChange={(offset) => onChange(key, binding?.scale, offset ?? 0)}
          />
        </div>
      ) : null}
    </div>
  );
}

function SubHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </p>
      {action}
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
  onBindingChange,
  t,
}: RiggingSectionProps) {
  useRigLivePoll();

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

          {rig.joints.some((j) => !drivenIds.has(j.id)) ? (
            <>
              <SubHeader title={t('monitoring:inspector.rigging.bindings')} />
              <p className="text-muted-foreground text-[10px]">
                {t('monitoring:inspector.rigging.bindingHint')}
              </p>
              <div className="space-y-1.5">
                {rig.joints
                  .filter((joint) => !drivenIds.has(joint.id))
                  .map((joint) => (
                    <BindingRow
                      key={joint.id}
                      joint={joint}
                      binding={model.rigBindings?.find(
                        (b) => b.jointId === joint.id,
                      )}
                      craneId={model.craneId}
                      onChange={(key, scale, offset) =>
                        onBindingChange(joint.id, key, scale, offset)
                      }
                      t={t}
                    />
                  ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
