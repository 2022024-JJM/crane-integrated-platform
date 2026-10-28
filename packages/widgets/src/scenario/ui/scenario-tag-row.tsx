import { AlertTriangle } from 'lucide-react';
import { useReducer, type MouseEvent } from 'react';
import type { ScenarioTag } from '@crane/domain/virtual-tag';
import { useRigLivePoll, virtualTagRuntime } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import {
  formatVirtualValue,
  isBoolOn,
  nodeLeafName,
  resolveRowControl,
  sliderStep,
  valuePercent,
  type ScenarioRow,
  type ScenarioRowControl,
} from '../lib/scenario-rows';
import { ROW_PILL, ROW_PILL_OFF, ROW_PILL_ON } from './scenario-cell-styles';
import { ScenarioTagSettings } from './scenario-tag-settings';
import { WaveformIcon } from './waveform-icon';

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * 목록 행이 러너 값을 다시 읽는 주기(ms). 러너는 React 상태가 아니라
 * 폴링해야 파형 막대가 움직인다 — 값 자리만 이 주기로 다시 그리고 펼친
 * 설정은 다시 그리지 않는다.
 */
const LIVE_POLL_MS = 100;

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

/** 막대·ON/OFF 를 조작할 때 행이 펼쳐지지 않게 한다. */
function stopRowToggle(event: MouseEvent) {
  event.stopPropagation();
}

/**
 * 시나리오 태그 한 행 — 한 줄(동작 아이콘 · 코드 · 미니 막대 또는 ON/OFF ·
 * 값과 단위)이고, 누르면 그 아래 정의(`ScenarioTagSettings`)가 펼쳐진다.
 * 맵핑 대상은 행에 마우스를 올리면 보인다. 수동 숫자는 막대를 끌고 수동
 * 불리언은 ON/OFF 를 눌러 바꾸며(`virtualTagRuntime.setManualValue`), 파형은
 * 보기만 한다. 키를 못 만드는 행(씬에 모델이 없거나 크레인이 없음)은 amber
 * 이고 조작이 없다 — 값이 어디에도 나가지 않는다.
 */
export function ScenarioTagRow({
  row,
  expanded,
  onToggle,
  onUpdate,
  t,
}: {
  row: ScenarioRow;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (
    patch: Partial<Omit<ScenarioTag, 'id' | 'modelId' | 'code'>>,
  ) => void;
  t: T;
}) {
  const { tag, key } = row;
  const control = resolveRowControl(row);

  return (
    <div className="border-border/60 border-t">
      <div
        className={cn(
          'hover:bg-muted/30 flex h-8 cursor-pointer items-center gap-2 pr-2.5 pl-3',
          row.issue && 'bg-amber-500/10',
          // 펼친 행은 아래 정의와 같은 옅은 배경 — 둘이 한 덩어리로 읽힌다.
          // 진한 회색은 막대 트랙을 묻는다. issue 행은 amber 를 그대로 둔다.
          expanded && !row.issue && 'bg-muted/30',
        )}
        title={`${tag.code} · ${describeTarget(row, t)}`}
        onClick={onToggle}
      >
        <WaveformIcon
          kind={tag.pattern.kind}
          className="text-muted-foreground w-6"
        />
        <button
          type="button"
          aria-expanded={expanded}
          className="min-w-0 flex-1 cursor-pointer truncate text-left font-semibold"
        >
          {tag.code}
        </button>
        {control === 'none' || !key ? (
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-amber-500">
            <AlertTriangle className="size-3" />
            {t('monitoring:scenario.row.noValue')}
          </span>
        ) : (
          <ScenarioTagLive tag={tag} tagKey={key} control={control} t={t} />
        )}
      </div>
      {expanded ? (
        <ScenarioTagSettings row={row} onUpdate={onUpdate} t={t} />
      ) : null}
    </div>
  );
}

/** 행의 값 자리 — 미니 막대(숫자) 또는 ON/OFF(불리언)와 값·단위. */
function ScenarioTagLive({
  tag,
  tagKey,
  control,
  t,
}: {
  tag: ScenarioTag;
  tagKey: string;
  control: Exclude<ScenarioRowControl, 'none'>;
  t: T;
}) {
  useRigLivePoll(LIVE_POLL_MS);
  // 손으로 바꾼 값은 다음 폴링을 기다리지 않고 바로 다시 그린다.
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const value = virtualTagRuntime.getValue(tagKey);
  const setValue = (next: number) => {
    virtualTagRuntime.setManualValue(tagKey, next);
    redraw();
  };

  if (control === 'toggle' || control === 'pill') {
    const on = isBoolOn(value);
    const label = t(
      on ? 'monitoring:tags.bool.on' : 'monitoring:tags.bool.off',
    );
    const pill = cn(ROW_PILL, on ? ROW_PILL_ON : ROW_PILL_OFF);
    return (
      <>
        <span className="flex w-20 shrink-0 justify-end">
          {control === 'toggle' ? (
            <button
              type="button"
              aria-pressed={on}
              aria-label={`${tag.code} ${label}`}
              className={cn(
                pill,
                'hover:border-muted-foreground hover:text-foreground cursor-pointer',
              )}
              onClick={(event) => {
                event.stopPropagation();
                setValue(on ? 0 : 1);
              }}
            >
              <span className="text-box-cap">{label}</span>
            </button>
          ) : (
            <span className={pill}>
              <span className="text-box-cap">{label}</span>
            </span>
          )}
        </span>
        <span className="min-w-16 shrink-0" aria-hidden />
      </>
    );
  }

  const percent = valuePercent(value, tag.min, tag.max);
  return (
    <>
      {control === 'slider' ? (
        // 보이는 것은 막대와 (마우스를 올리면) 손잡이 점, 끄는 것은 위에 겹친 투명 range.
        <span
          className="group/bar relative flex h-4 w-20 shrink-0 items-center"
          onClick={stopRowToggle}
        >
          <ValueBar percent={percent} />
          <span
            aria-hidden
            className="bg-foreground ring-background pointer-events-none absolute size-2.5 -translate-x-1/2 rounded-full opacity-0 ring-2 transition-opacity group-focus-within/bar:opacity-100 group-hover/bar:opacity-100"
            style={{ left: `${percent}%` }}
          />
          <input
            type="range"
            min={tag.min}
            max={tag.max}
            step={sliderStep(tag.min, tag.max)}
            value={value ?? tag.min}
            aria-label={tag.code}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            onChange={(event) => setValue(Number(event.target.value))}
          />
        </span>
      ) : (
        <span className="flex w-20 shrink-0">
          <ValueBar percent={percent} />
        </span>
      )}
      <span className="min-w-16 shrink-0 text-right whitespace-nowrap">
        <span className="font-semibold">{formatVirtualValue(value)}</span>
        {tag.unit ? (
          <span className="text-muted-foreground ml-1 text-[10px]">
            {tag.unit}
          </span>
        ) : null}
      </span>
    </>
  );
}

/** 미니 막대 — 트랙은 반투명이라 행 배경(펼침·amber)이 무엇이든 보인다. */
function ValueBar({ percent }: { percent: number }) {
  return (
    <span className="bg-foreground/10 block h-1.5 w-full overflow-hidden rounded-full">
      <span
        className="bg-muted-foreground block h-full rounded-full"
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}
