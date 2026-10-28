import { AlertTriangle } from 'lucide-react';
import {
  VIRTUAL_TAG_BOOL_PATTERN_KINDS,
  VIRTUAL_TAG_DATA_TYPES,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  type ScenarioTag,
  type VirtualTagDataType,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
} from '@crane/domain/virtual-tag';
import { virtualTagRuntime } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Input } from '@crane/ui/atoms/input';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Switch } from '@crane/ui/atoms/switch';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import {
  formatVirtualValue,
  isBoolOn,
  nodeLeafName,
  sliderStep,
  valuePercent,
  type ScenarioRow,
} from '../lib/scenario-rows';
import {
  CELL_INPUT,
  CELL_NUMBER_INPUT,
  CELL_NUMBER_WRAPPER,
  CELL_SELECT_TRIGGER,
} from './scenario-cell-styles';
import { WaveformIcon } from './waveform-icon';

type T = (key: string, options?: Record<string, unknown>) => string;

function defaultPattern(kind: VirtualTagPatternKind): VirtualTagPattern {
  return kind === 'manual'
    ? { kind }
    : { kind, periodSec: VIRTUAL_TAG_PERIOD_DEFAULT };
}

function withPeriod(
  pattern: VirtualTagPattern,
  periodSec: number,
): VirtualTagPattern {
  return pattern.kind === 'manual' ? pattern : { ...pattern, periodSec };
}

/** 코드가 모델에서 가리키는 것 — `루트 · 위치 z`, `Trolley_01 · 위치 x`, `관절 luff`, `고장`. */
function describeTarget(row: ScenarioRow, t: T): string {
  const target = row.target;
  if (!target) return t('monitoring:scenario.row.targetMissing');
  if (target.source === 'status') {
    return t(`monitoring:inspector.statusTags.roles.${target.role}`);
  }
  if (target.target.kind === 'joint') {
    return `${t('monitoring:inspector.mapping.joint')} ${target.target.jointId}`;
  }
  const node =
    nodeLeafName(target.target.node) || t('monitoring:inspector.mapping.root');
  return `${node} · ${t(`monitoring:inspector.mapping.channels.${target.target.channel}`)} ${target.target.axis}`;
}

/**
 * 시나리오 태그 한 행 — 좁은 우측 패널에 맞춘 두 줄. 1줄은 코드·맵핑 대상·
 * 현재값 조작(수동이면 슬라이더·토글, 파형이면 진행 막대), 2줄은 형식·
 * 단위·범위·초기값·패턴·주기. 코드는 모델 맵핑에서 온 것이라 고치지 않고,
 * 행을 빼는 것은 묶음 머리줄의 "태그 수정" 다이얼로그다.
 * 키를 못 만드는 행(씬에 모델이 없거나 크레인이 없음)은 amber 이고 값 조작이
 * 없다 — 값이 어디에도 나가지 않는다.
 */
export function ScenarioTagRow({
  row,
  onUpdate,
  t,
}: {
  row: ScenarioRow;
  onUpdate: (
    patch: Partial<Omit<ScenarioTag, 'id' | 'modelId' | 'code'>>,
  ) => void;
  t: T;
}) {
  const { tag, key, issue } = row;
  const value = key ? virtualTagRuntime.getValue(key) : undefined;
  const isBool = tag.dataType === 'bool';
  const manual = tag.pattern.kind === 'manual';
  const patternKinds: readonly VirtualTagPatternKind[] = isBool
    ? VIRTUAL_TAG_BOOL_PATTERN_KINDS
    : VIRTUAL_TAG_PATTERN_KINDS;

  return (
    <div
      className={cn(
        'border-border/60 space-y-1 border-t border-dashed px-2 py-1.5',
        issue && 'bg-amber-500/10',
      )}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono font-semibold">{tag.code}</span>
        <span className="text-muted-foreground min-w-0 truncate text-[10px]">
          {describeTarget(row, t)}
        </span>
        <span className="flex-1" />
        {issue ? (
          <span className="flex items-center gap-1 text-[10px] text-amber-500">
            <AlertTriangle className="size-3" />
            {t('monitoring:scenario.row.noValue')}
          </span>
        ) : isBool ? (
          <>
            {manual && key ? (
              <Switch
                checked={isBoolOn(value)}
                aria-label={key}
                onCheckedChange={(on) =>
                  virtualTagRuntime.setManualValue(key, on ? 1 : 0)
                }
              />
            ) : null}
            <Badge
              variant={isBoolOn(value) ? 'secondary' : 'outline'}
              className={cn(
                'min-w-9 justify-center text-[10px] tracking-wide',
                !isBoolOn(value) && 'text-muted-foreground',
              )}
            >
              {t(
                isBoolOn(value)
                  ? 'monitoring:tags.bool.on'
                  : 'monitoring:tags.bool.off',
              )}
            </Badge>
          </>
        ) : (
          <>
            {manual && key ? (
              <input
                type="range"
                min={tag.min}
                max={tag.max}
                step={sliderStep(tag.min, tag.max)}
                value={value ?? tag.min}
                aria-label={key}
                className="accent-primary h-2 w-28 min-w-0 cursor-pointer"
                onChange={(event) =>
                  virtualTagRuntime.setManualValue(
                    key,
                    Number(event.target.value),
                  )
                }
              />
            ) : (
              <div className="bg-muted h-1.5 w-28 min-w-0 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full"
                  style={{ width: `${valuePercent(value, tag.min, tag.max)}%` }}
                />
              </div>
            )}
            <span className="w-14 shrink-0 text-right font-mono text-xs">
              {formatVirtualValue(value)}
            </span>
          </>
        )}
      </div>

      {issue ? (
        <p className="text-[10px] text-amber-500">
          {t(`monitoring:scenario.issue.${issue}`)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <Select
          value={tag.dataType}
          onValueChange={(dataType: VirtualTagDataType) =>
            onUpdate({ dataType })
          }
        >
          <SelectTrigger
            aria-label={t('monitoring:scenario.row.dataType')}
            className={cn(CELL_SELECT_TRIGGER, 'h-6 w-16')}
          >
            <span className="text-box-cap truncate">
              {t(`monitoring:scenario.dataTypes.${tag.dataType}`)}
            </span>
          </SelectTrigger>
          <SelectPopup align="start" className="min-w-24">
            {VIRTUAL_TAG_DATA_TYPES.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`monitoring:scenario.dataTypes.${kind}`)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        {isBool ? null : (
          <>
            <Input
              value={tag.unit ?? ''}
              placeholder={t('monitoring:scenario.row.unit')}
              aria-label={t('monitoring:scenario.row.unit')}
              className={cn(CELL_INPUT, 'h-6 w-12')}
              onChange={(event) => onUpdate({ unit: event.target.value })}
            />
            <InputNumber
              value={tag.min}
              aria-label={t('monitoring:scenario.row.min')}
              className={cn(CELL_NUMBER_WRAPPER, 'h-6 w-16')}
              inputClassName={CELL_NUMBER_INPUT}
              onChange={(min) => onUpdate({ min })}
            />
            <span className="text-muted-foreground">~</span>
            <InputNumber
              value={tag.max}
              aria-label={t('monitoring:scenario.row.max')}
              className={cn(CELL_NUMBER_WRAPPER, 'h-6 w-16')}
              inputClassName={CELL_NUMBER_INPUT}
              onChange={(max) => onUpdate({ max })}
            />
          </>
        )}
        <span className="text-muted-foreground">
          {t('monitoring:scenario.row.initial')}
        </span>
        {isBool ? (
          <Switch
            checked={isBoolOn(tag.initial)}
            aria-label={t('monitoring:scenario.row.initial')}
            onCheckedChange={(on) => onUpdate({ initial: on ? 1 : 0 })}
          />
        ) : (
          <InputNumber
            value={tag.initial}
            min={tag.min}
            max={tag.max}
            aria-label={t('monitoring:scenario.row.initial')}
            className={cn(CELL_NUMBER_WRAPPER, 'h-6 w-16')}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(initial) => onUpdate({ initial })}
          />
        )}
        <Select
          value={tag.pattern.kind}
          onValueChange={(kind: VirtualTagPatternKind) =>
            onUpdate({ pattern: defaultPattern(kind) })
          }
        >
          <SelectTrigger
            aria-label={t('monitoring:scenario.row.pattern')}
            className={cn(CELL_SELECT_TRIGGER, 'h-6 w-24')}
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-1">
              <span className="text-box-cap truncate">
                {t(`monitoring:scenario.patterns.${tag.pattern.kind}`)}
              </span>
              <WaveformIcon kind={tag.pattern.kind} className="w-6" />
            </span>
          </SelectTrigger>
          <SelectPopup align="start" className="min-w-36">
            {patternKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{t(`monitoring:scenario.patterns.${kind}`)}</span>
                  <WaveformIcon kind={kind} />
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        {tag.pattern.kind === 'manual' ? null : (
          <>
            <InputNumber
              value={tag.pattern.periodSec}
              min={VIRTUAL_TAG_PERIOD_MIN}
              max={VIRTUAL_TAG_PERIOD_MAX}
              step={0.1}
              aria-label={t('monitoring:scenario.row.period')}
              title={t('monitoring:scenario.row.periodHint')}
              className={cn(CELL_NUMBER_WRAPPER, 'h-6 w-14')}
              inputClassName={CELL_NUMBER_INPUT}
              onChange={(periodSec) =>
                onUpdate({ pattern: withPeriod(tag.pattern, periodSec) })
              }
            />
            <span className="text-muted-foreground">s</span>
          </>
        )}
      </div>
    </div>
  );
}
