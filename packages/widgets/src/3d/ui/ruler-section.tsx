import {
  RULER_GUIDE_OPACITY_DEFAULT,
  RULER_GUIDE_OPACITY_MIN,
  RULER_GUIDE_SIDE_DEFAULT,
  RULER_GUIDE_SIDES,
  RULER_INTERVALS,
  RULER_SIZE_DEFAULT,
  RULER_SIZES,
  type SavedRulerInfo,
  type SceneRulerSize,
} from '@crane/domain/3d';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import {
  rulerUnitsToMeters,
  withRulerDotColor,
  withRulerDotSize,
  withRulerGuideColor,
  withRulerGuideEnabled,
  withRulerGuideLengthMeters,
  withRulerGuideOpacity,
  withRulerGuideSide,
  withRulerInterval,
  withRulerLengthMeters,
  withRulerStartValue,
  withRulerTextColor,
  withRulerTextSize,
  withRulerUnitHidden,
} from '../lib/ruler-editor';
import {
  ChoiceSegment,
  Field,
  NumberField,
  SubHeader,
  type InspectorT,
} from './inspector-fields';

/**
 * 인스펙터 "눈금" 탭 — 그린 뒤에 고치는 표시 옵션. 배치(시작점·방향)는
 * 트랜스폼 탭과 기즈모가, 이름은 계층 목록이 맡는다.
 *
 * 편집은 전부 onChange(updater) 한 채널이라 undo/redo·dirty 에 잡힌다. 값
 * 갱신·검증은 lib/ruler-editor 가 하고, 잘못된 입력(비움·0 이하)은 같은
 * 참조를 돌려받아 아무 일도 일어나지 않는다.
 */
export type RulerUpdater = (ruler: SavedRulerInfo) => SavedRulerInfo;

type UnitChoice = 'shown' | 'hidden';

export interface RulerSectionProps {
  ruler: SavedRulerInfo;
  onChange: (updater: RulerUpdater) => void;
  /** 씬 unit → m 환산(길이·보조선 길이 표시). 기본 1. */
  metersPerUnit?: number;
  t: InspectorT;
}

/** 크기 선택지 — 글자는 번역하지 않는다(S·M·L). */
const SIZE_OPTIONS = RULER_SIZES.map((size) => ({
  value: size,
  label: size.toUpperCase(),
}));

/**
 * 색 한 줄 — 색 입력과 hex 값. `size` 를 주면 hex 값 오른쪽, 줄 끝에 크기
 * (S·M·L)를 고르는 세그먼트가 붙는다(점·글자). 보조선은 색만이다.
 */
function ColorField({
  label,
  value,
  onChange,
  size,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  size?: {
    label: string;
    value: SceneRulerSize;
    onChange: (size: SceneRulerSize) => void;
  };
}) {
  return (
    <Field label={label}>
      <input
        type="color"
        value={value}
        aria-label={label}
        title={value}
        className="border-border h-6 w-7 shrink-0 cursor-pointer rounded-sm border bg-transparent p-0"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-muted-foreground font-mono text-[10px]">
        {value}
      </span>
      {size ? (
        <ChoiceSegment
          compact
          value={size.value}
          options={SIZE_OPTIONS}
          label={size.label}
          onChange={size.onChange}
        />
      ) : null}
    </Field>
  );
}

export function RulerSection({
  ruler,
  onChange,
  metersPerUnit = 1,
  t,
}: RulerSectionProps) {
  const { guide } = ruler;
  // ChoiceSegment 는 문자열 값을 받는다 — 간격은 문자열로 바꿔 넘긴다.
  const intervalOptions = RULER_INTERVALS.map((interval) => ({
    value: String(interval),
    label: `${interval} m`,
  }));
  const unitOptions: { value: UnitChoice; label: string }[] = [
    { value: 'shown', label: t('monitoring:inspector.ruler.unitShown') },
    { value: 'hidden', label: t('monitoring:inspector.ruler.unitHidden') },
  ];
  const sideOptions = RULER_GUIDE_SIDES.map((side) => ({
    value: side,
    label: t(`monitoring:inspector.ruler.guideSides.${side}`),
  }));
  const guideOpacity = guide?.opacity ?? RULER_GUIDE_OPACITY_DEFAULT;
  const sizeLabel = t('monitoring:inspector.ruler.size');
  const dotLabel = t('monitoring:inspector.ruler.dot');
  const textLabel = t('monitoring:inspector.ruler.text');

  return (
    <div className="space-y-2">
      <div className="text-foreground pb-1.5 text-[12px] font-medium">
        {t('monitoring:inspector.ruler.title')}
      </div>
      <Field label={t('monitoring:inspector.ruler.interval')}>
        <ChoiceSegment
          value={String(ruler.interval)}
          options={intervalOptions}
          label={t('monitoring:inspector.ruler.interval')}
          onChange={(next) =>
            onChange((r) => withRulerInterval(r, Number(next)))
          }
        />
      </Field>
      <Field label={t('monitoring:inspector.ruler.unit')}>
        <ChoiceSegment
          value={ruler.unitHidden === true ? 'hidden' : 'shown'}
          options={unitOptions}
          label={t('monitoring:inspector.ruler.unit')}
          onChange={(next) =>
            onChange((r) => withRulerUnitHidden(r, next === 'hidden'))
          }
        />
      </Field>
      <Field label={t('monitoring:inspector.ruler.startValue')}>
        <NumberField
          value={ruler.startValue ?? 0}
          step={1}
          unit=" m"
          onChange={(startValue) => {
            if (startValue === undefined) return;
            onChange((r) => withRulerStartValue(r, startValue));
          }}
        />
      </Field>
      <Field label={t('monitoring:inspector.ruler.length')}>
        <NumberField
          value={rulerUnitsToMeters(ruler.length, metersPerUnit)}
          step={1}
          unit=" m"
          onChange={(lengthM) => {
            if (lengthM === undefined) return;
            onChange((r) => withRulerLengthMeters(r, lengthM, metersPerUnit));
          }}
        />
      </Field>
      <ColorField
        label={dotLabel}
        value={ruler.dotColor}
        onChange={(color) => onChange((r) => withRulerDotColor(r, color))}
        size={{
          label: `${dotLabel} ${sizeLabel}`,
          value: ruler.dotSize ?? RULER_SIZE_DEFAULT,
          onChange: (size) => onChange((r) => withRulerDotSize(r, size)),
        }}
      />
      <ColorField
        label={textLabel}
        value={ruler.textColor}
        onChange={(color) => onChange((r) => withRulerTextColor(r, color))}
        size={{
          label: `${textLabel} ${sizeLabel}`,
          value: ruler.textSize ?? RULER_SIZE_DEFAULT,
          onChange: (size) => onChange((r) => withRulerTextSize(r, size)),
        }}
      />

      <SubHeader
        title={t('monitoring:inspector.ruler.guide')}
        action={
          <Checkbox
            checked={guide !== undefined}
            aria-label={t('monitoring:inspector.ruler.guide')}
            onCheckedChange={(checked) =>
              onChange((r) =>
                withRulerGuideEnabled(r, checked === true, metersPerUnit),
              )
            }
            className="size-3.5 cursor-pointer [&>[data-slot=checkbox-indicator]>svg]:size-3"
          />
        }
      />
      {guide ? (
        <>
          <Field label={t('monitoring:inspector.ruler.guideLength')}>
            <NumberField
              value={rulerUnitsToMeters(guide.length, metersPerUnit)}
              step={1}
              unit=" m"
              onChange={(lengthM) => {
                if (lengthM === undefined) return;
                onChange((r) =>
                  withRulerGuideLengthMeters(r, lengthM, metersPerUnit),
                );
              }}
            />
          </Field>
          <Field label={t('monitoring:inspector.ruler.guideSide')}>
            <ChoiceSegment
              value={guide.side ?? RULER_GUIDE_SIDE_DEFAULT}
              options={sideOptions}
              label={t('monitoring:inspector.ruler.guideSide')}
              onChange={(next) => onChange((r) => withRulerGuideSide(r, next))}
            />
          </Field>
          <ColorField
            label={t('monitoring:inspector.ruler.guideColor')}
            value={guide.color}
            onChange={(color) => onChange((r) => withRulerGuideColor(r, color))}
          />
          <Field label={t('monitoring:inspector.opacity')}>
            <input
              type="range"
              min={RULER_GUIDE_OPACITY_MIN}
              max={1}
              step={0.1}
              value={guideOpacity}
              aria-label={t('monitoring:inspector.opacity')}
              className="accent-primary h-2 w-full cursor-pointer"
              onChange={(event) =>
                onChange((r) =>
                  withRulerGuideOpacity(r, Number(event.target.value)),
                )
              }
            />
            <span className="text-muted-foreground w-8 shrink-0 text-right text-[12px] tabular-nums">
              {guideOpacity.toFixed(1)}
            </span>
          </Field>
        </>
      ) : null}
    </div>
  );
}
