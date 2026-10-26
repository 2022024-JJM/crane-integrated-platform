import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  VIRTUAL_TAG_BOOL_PATTERN_KINDS,
  VIRTUAL_TAG_CODE_MAX,
  VIRTUAL_TAG_DATA_TYPES,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  type VirtualTagDataType,
  type VirtualTagDefinition,
  type VirtualTagGroup,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
} from '@crane/domain/virtual-tag';
import { virtualTagRuntime } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Switch } from '@crane/ui/atoms/switch';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { TableCell, TableRow } from '@crane/ui/molecules/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import {
  formatVirtualValue,
  isBoolOn,
  sliderStep,
  valuePercent,
} from '../lib/virtual-tag-rows';
import {
  getTagCodeError,
  type TagCodeError,
} from '../lib/virtual-tag-validation';
import {
  CELL_INPUT,
  CELL_NUMBER_INPUT,
  CELL_NUMBER_WRAPPER,
  CELL_SELECT_TRIGGER,
} from './virtual-cell-styles';
import { WaveformIcon } from './waveform-icon';

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * 상세 표의 열 — 고정 폭이라 열이 흔들리지 않고 표는 가로로 스크롤한다.
 * 머리글(virtual-equipment-detail)과 행이 같은 목록을 쓴다.
 */
export const VIRTUAL_TAG_COLUMNS = [
  ['enabled', 'w-11'],
  ['code', 'w-40'],
  ['name', 'w-36'],
  ['group', 'w-32'],
  ['dataType', 'w-24'],
  ['unit', 'w-16'],
  ['min', 'w-20'],
  ['max', 'w-20'],
  ['initial', 'w-20'],
  ['pattern', 'w-28'],
  ['period', 'w-24'],
  ['maxSpeed', 'w-20'],
  ['maxAccel', 'w-20'],
  ['value', 'w-44'],
  ['actions', 'w-14'],
] as const;

const NONE_GROUP = '__none__';

function defaultPattern(kind: VirtualTagPatternKind): VirtualTagPattern {
  return kind === 'manual'
    ? { kind }
    : { kind, periodMs: VIRTUAL_TAG_PERIOD_DEFAULT };
}

function withPeriod(
  pattern: VirtualTagPattern,
  periodMs: number,
): VirtualTagPattern {
  return pattern.kind === 'manual' ? pattern : { ...pattern, periodMs };
}

/**
 * 태그 한 행 — 인라인 편집. 코드 입력은 비제어로 blur/Enter 에만 커밋하고
 * 거부되면 툴팁을 띄운 채 포커스를 돌려보낸다(Escape 가 탈출구). 불리언은
 * 범위·단위·한계 칸이 비활성이고 초기값·현재값은 토글이다.
 */
export function VirtualTagRow({
  tag,
  tagKey,
  groups,
  takenCodes,
  onUpdate,
  onDuplicate,
  onRemove,
  t,
}: {
  tag: VirtualTagDefinition;
  /** 값 버스 키 — 러너의 현재값·수동 입력이 이 키로 간다. */
  tagKey: string;
  groups: readonly VirtualTagGroup[];
  /** 장비 안 전체 코드 — 중복 판정용. */
  takenCodes: readonly string[];
  onUpdate: (patch: Partial<Omit<VirtualTagDefinition, 'id'>>) => boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  t: T;
}) {
  const [codeError, setCodeError] = useState<TagCodeError | null>(null);
  const value = virtualTagRuntime.getValue(tagKey);
  const isBool = tag.dataType === 'bool';
  const manual = tag.pattern.kind === 'manual';
  const patternKinds: readonly VirtualTagPatternKind[] = isBool
    ? VIRTUAL_TAG_BOOL_PATTERN_KINDS
    : VIRTUAL_TAG_PATTERN_KINDS;

  const commitCode = (input: HTMLInputElement): boolean => {
    const error = getTagCodeError(input.value, tag.code, takenCodes);
    if (error === null && input.value.trim() !== tag.code) {
      onUpdate({ code: input.value });
    }
    setCodeError(error);
    return error === null;
  };

  return (
    <TableRow className={cn(!tag.enabled && 'opacity-60')}>
      <TableCell>
        <Switch
          checked={tag.enabled}
          onCheckedChange={(enabled) => onUpdate({ enabled })}
        />
      </TableCell>
      <TableCell>
        <Tooltip open={codeError !== null}>
          <TooltipTrigger
            render={
              <Input
                key={tag.code}
                defaultValue={tag.code}
                aria-invalid={codeError !== null}
                className={cn(
                  CELL_INPUT,
                  codeError !== null && 'border-amber-500 text-amber-500',
                )}
                onChange={() => setCodeError(null)}
                onBlur={(event) => {
                  const input = event.currentTarget;
                  if (!commitCode(input)) {
                    // blur 처리 중 focus 는 무시될 수 있어 한 틱 뒤에 되돌린다.
                    queueMicrotask(() => input.focus());
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    event.currentTarget.value = tag.code;
                    setCodeError(null);
                    event.currentTarget.blur();
                  }
                }}
              />
            }
          />
          <TooltipContent side="bottom">
            {codeError
              ? t(`monitoring:virtualTags.errors.${codeError}`, {
                  codeMax: VIRTUAL_TAG_CODE_MAX,
                })
              : null}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Input
          value={tag.name}
          className={CELL_INPUT}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </TableCell>
      <TableCell>
        <Select
          value={tag.groupId ?? NONE_GROUP}
          onValueChange={(groupId: string) =>
            onUpdate({ groupId: groupId === NONE_GROUP ? undefined : groupId })
          }
        >
          <SelectTrigger
            aria-label={t('monitoring:virtualTags.columns.group')}
            className={CELL_SELECT_TRIGGER}
          >
            <span className="text-box-cap truncate">
              {groups.find((g) => g.id === tag.groupId)?.name ??
                t('monitoring:virtualTags.groups.ungrouped')}
            </span>
          </SelectTrigger>
          <SelectPopup align="start" className="min-w-40">
            <SelectItem value={NONE_GROUP}>
              {t('monitoring:virtualTags.groups.ungrouped')}
            </SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name || t('monitoring:virtualTags.groups.newName')}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={tag.dataType}
          onValueChange={(dataType: VirtualTagDataType) =>
            onUpdate({ dataType })
          }
        >
          <SelectTrigger
            aria-label={t('monitoring:virtualTags.columns.dataType')}
            className={CELL_SELECT_TRIGGER}
          >
            <span className="text-box-cap truncate">
              {t(`monitoring:virtualTags.dataTypes.${tag.dataType}`)}
            </span>
          </SelectTrigger>
          <SelectPopup align="start" className="min-w-28">
            {VIRTUAL_TAG_DATA_TYPES.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`monitoring:virtualTags.dataTypes.${kind}`)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </TableCell>
      <TableCell>
        {isBool ? (
          <Dash />
        ) : (
          <Input
            value={tag.unit ?? ''}
            className={CELL_INPUT}
            onChange={(event) => onUpdate({ unit: event.target.value })}
          />
        )}
      </TableCell>
      <TableCell>
        {isBool ? (
          <Dash />
        ) : (
          <InputNumber
            value={tag.min}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(min) => onUpdate({ min })}
          />
        )}
      </TableCell>
      <TableCell>
        {isBool ? (
          <Dash />
        ) : (
          <InputNumber
            value={tag.max}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(max) => onUpdate({ max })}
          />
        )}
      </TableCell>
      <TableCell>
        {isBool ? (
          <div className="flex justify-center">
            <Switch
              checked={isBoolOn(tag.initial)}
              aria-label={t('monitoring:virtualTags.columns.initial')}
              onCheckedChange={(on) => onUpdate({ initial: on ? 1 : 0 })}
            />
          </div>
        ) : (
          <InputNumber
            value={tag.initial}
            min={tag.min}
            max={tag.max}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(initial) => onUpdate({ initial })}
          />
        )}
      </TableCell>
      <TableCell>
        <Select
          value={tag.pattern.kind}
          onValueChange={(kind: VirtualTagPatternKind) =>
            onUpdate({ pattern: defaultPattern(kind) })
          }
        >
          <SelectTrigger
            aria-label={t('monitoring:virtualTags.columns.pattern')}
            className={CELL_SELECT_TRIGGER}
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="text-box-cap truncate">
                {t(`monitoring:virtualTags.patterns.${tag.pattern.kind}`)}
              </span>
              <WaveformIcon kind={tag.pattern.kind} />
            </span>
          </SelectTrigger>
          <SelectPopup align="start" className="min-w-40">
            {patternKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{t(`monitoring:virtualTags.patterns.${kind}`)}</span>
                  <WaveformIcon kind={kind} />
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </TableCell>
      <TableCell>
        {tag.pattern.kind === 'manual' ? (
          <Dash />
        ) : (
          <InputNumber
            value={tag.pattern.periodMs}
            step={100}
            title={t('monitoring:virtualTags.periodHint')}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(periodMs) =>
              onUpdate({ pattern: withPeriod(tag.pattern, periodMs) })
            }
          />
        )}
      </TableCell>
      {/* 속도·가속 한계(단위/s, 단위/s²) — 비우면 없음. 러너가 파형 목표값을
          향해 램프한다(lib/rate-limit). 불리언에는 없다. */}
      <TableCell>
        {isBool ? (
          <Dash />
        ) : (
          <InputNumber
            value={tag.limits?.maxSpeed ?? null}
            min={0}
            step={0.1}
            placeholder="—"
            title={t('monitoring:virtualTags.maxSpeedHint')}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(maxSpeed) =>
              onUpdate({ limits: { ...tag.limits, maxSpeed } })
            }
            onEmpty={() =>
              onUpdate({ limits: { ...tag.limits, maxSpeed: undefined } })
            }
          />
        )}
      </TableCell>
      <TableCell>
        {isBool ? (
          <Dash />
        ) : (
          <InputNumber
            value={tag.limits?.maxAccel ?? null}
            min={0}
            step={0.1}
            placeholder="—"
            title={t('monitoring:virtualTags.maxAccelHint')}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(maxAccel) =>
              onUpdate({ limits: { ...tag.limits, maxAccel } })
            }
            onEmpty={() =>
              onUpdate({ limits: { ...tag.limits, maxAccel: undefined } })
            }
          />
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {isBool ? (
            <>
              {manual ? (
                <Switch
                  checked={isBoolOn(value)}
                  aria-label={tagKey}
                  onCheckedChange={(on) =>
                    virtualTagRuntime.setManualValue(tagKey, on ? 1 : 0)
                  }
                />
              ) : (
                <span className="flex-1" />
              )}
              <Badge
                variant={isBoolOn(value) ? 'secondary' : 'outline'}
                className={cn(
                  'ml-auto min-w-9 justify-center text-[10px] tracking-wide',
                  !isBoolOn(value) && 'text-muted-foreground',
                )}
              >
                {t(
                  value === undefined
                    ? 'monitoring:tags.bool.off'
                    : isBoolOn(value)
                      ? 'monitoring:tags.bool.on'
                      : 'monitoring:tags.bool.off',
                )}
              </Badge>
            </>
          ) : (
            <>
              {manual ? (
                <input
                  type="range"
                  min={tag.min}
                  max={tag.max}
                  step={sliderStep(tag.min, tag.max)}
                  value={value ?? tag.min}
                  aria-label={tagKey}
                  className="accent-primary h-2 min-w-0 flex-1 cursor-pointer"
                  onChange={(event) =>
                    virtualTagRuntime.setManualValue(
                      tagKey,
                      Number(event.target.value),
                    )
                  }
                />
              ) : (
                <div className="bg-muted h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full"
                    style={{
                      width: `${valuePercent(value, tag.min, tag.max)}%`,
                    }}
                  />
                </div>
              )}
              <span className="w-16 shrink-0 text-right text-xs">
                {formatVirtualValue(value)}
              </span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={t('monitoring:virtualTags.duplicate')}
            title={t('monitoring:virtualTags.duplicate')}
            onClick={onDuplicate}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-red-300"
            aria-label={t('monitoring:virtualTags.remove')}
            title={t('monitoring:virtualTags.remove')}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function Dash() {
  return (
    <span className="text-muted-foreground block text-center text-xs">—</span>
  );
}
