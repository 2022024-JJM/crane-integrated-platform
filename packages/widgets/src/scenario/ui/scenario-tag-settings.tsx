import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  VIRTUAL_TAG_BOOL_PATTERN_KINDS,
  VIRTUAL_TAG_DATA_TYPES,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_MAX,
  VIRTUAL_TAG_PERIOD_MIN,
  type ScenarioTag,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
} from '@crane/domain/virtual-tag';
import { cn } from '@crane/core/lib/utils';
import { Input } from '@crane/ui/atoms/input';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import {
  describePatternSentence,
  nextPattern,
  showsInitialValue,
  type ScenarioRow,
} from '../lib/scenario-rows';
import {
  CELL_INPUT,
  CELL_NUMBER_INPUT,
  CELL_NUMBER_WRAPPER,
} from './scenario-cell-styles';
import { WaveformIcon } from './waveform-icon';

type T = (key: string, options?: Record<string, unknown>) => string;

const TOGGLE_ITEM = 'h-6 px-2 text-[11px]';

function withPeriod(
  pattern: VirtualTagPattern,
  periodSec: number,
): VirtualTagPattern {
  return pattern.kind === 'manual' ? pattern : { ...pattern, periodSec };
}

/**
 * 목록 행을 눌렀을 때 그 아래 펼쳐지는 태그 정의 — 라벨 열 + 입력. 동작(파형
 * 버튼), 주기(파형일 때, 옆에 동작 설명 문장), 범위·단위(숫자), 초기값(뜻이
 * 있는 파형만, `showsInitialValue`), 형식. 현재값 조작은 목록 행이 맡고 여기에는 없다. 행을 빼는 것은 묶음의
 * "태그 수정" 이라 제거 버튼도 없다.
 */
export function ScenarioTagSettings({
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
  const { tag, issue } = row;
  const { pattern } = tag;
  const isBool = tag.dataType === 'bool';
  const kinds: readonly VirtualTagPatternKind[] = isBool
    ? VIRTUAL_TAG_BOOL_PATTERN_KINDS
    : VIRTUAL_TAG_PATTERN_KINDS;
  const sentence = describePatternSentence(tag);

  return (
    <div className="bg-muted/30 border-border/60 grid gap-2 border-t border-dashed py-2.5 pr-3 pl-4">
      {issue ? (
        <p className="flex items-center gap-1 text-[11px] text-amber-500">
          <AlertTriangle className="size-3 shrink-0" />
          {t(`monitoring:scenario.issue.${issue}`)}
        </p>
      ) : null}

      <Field label={t('monitoring:scenario.row.pattern')}>
        <div
          role="group"
          aria-label={t('monitoring:scenario.row.pattern')}
          className={cn(
            'grid w-full auto-cols-fr grid-flow-col gap-1',
            isBool ? 'max-w-28' : 'max-w-72',
          )}
        >
          {kinds.map((kind) => {
            const pressed = pattern.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={pressed}
                title={t(`monitoring:scenario.patterns.${kind}`)}
                className={cn(
                  'grid cursor-pointer justify-items-center gap-1 rounded-md border pt-1.5 pb-1 text-[10px] transition-colors',
                  pressed
                    ? 'border-muted-foreground bg-muted text-foreground'
                    : 'border-border/60 text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  const next = nextPattern(pattern, kind);
                  if (next !== pattern) onUpdate({ pattern: next });
                }}
              >
                <WaveformIcon kind={kind} className="w-6" />
                <span>{t(`monitoring:scenario.patternsShort.${kind}`)}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {pattern.kind === 'manual' ? null : (
        <Field label={t('monitoring:scenario.row.periodLabel')}>
          <InputNumber
            value={pattern.periodSec}
            min={VIRTUAL_TAG_PERIOD_MIN}
            max={VIRTUAL_TAG_PERIOD_MAX}
            step={0.1}
            aria-label={t('monitoring:scenario.row.period')}
            title={t('monitoring:scenario.row.periodHint')}
            className={cn(CELL_NUMBER_WRAPPER, 'h-6 w-16')}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(periodSec) =>
              onUpdate({ pattern: withPeriod(pattern, periodSec) })
            }
          />
          <span className="text-muted-foreground">
            {t('monitoring:scenario.row.seconds')}
          </span>
          {sentence ? (
            <span className="text-muted-foreground ml-1">
              {t(`monitoring:scenario.sentence.${sentence.key}`, {
                ...sentence.values,
              })}
            </span>
          ) : null}
        </Field>
      )}

      {isBool ? null : (
        <Field label={t('monitoring:scenario.row.range')}>
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
          <span className="text-muted-foreground ml-2 text-[11px]">
            {t('monitoring:scenario.row.unit')}
          </span>
          <Input
            value={tag.unit ?? ''}
            aria-label={t('monitoring:scenario.row.unit')}
            className={cn(CELL_INPUT, 'h-6 w-14')}
            onChange={(event) => onUpdate({ unit: event.target.value })}
          />
        </Field>
      )}

      {showsInitialValue(pattern) ? (
        <Field label={t('monitoring:scenario.row.initial')}>
          <InputNumber
            value={tag.initial}
            min={tag.min}
            max={tag.max}
            aria-label={t('monitoring:scenario.row.initial')}
            className={cn(CELL_NUMBER_WRAPPER, 'h-6 w-16')}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(initial) => onUpdate({ initial })}
          />
          <span className="text-muted-foreground">
            {t('monitoring:scenario.row.initialHint')}
          </span>
        </Field>
      ) : null}

      <Field label={t('monitoring:scenario.row.dataType')}>
        <ToggleGroup
          value={[tag.dataType]}
          onValueChange={(next) => {
            const choice = next[0];
            if (choice === 'number' || choice === 'bool') {
              onUpdate({ dataType: choice });
            }
          }}
          variant="outline"
          size="sm"
          aria-label={t('monitoring:scenario.row.dataType')}
        >
          {VIRTUAL_TAG_DATA_TYPES.map((kind) => (
            <ToggleGroupItem key={kind} value={kind} className={TOGGLE_ITEM}>
              {t(`monitoring:scenario.dataTypes.${kind}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}
