import { Crosshair } from 'lucide-react';
import {
  FLOODLIGHT_ANGLE_MAX,
  FLOODLIGHT_ANGLE_MIN,
  FLOODLIGHT_INTENSITY_MAX,
  FLOODLIGHT_INTENSITY_MIN,
  floodlightAimPoint,
  resolveFloodlightAngle,
  resolveFloodlightIntensity,
  type SavedFloodlightInfo,
} from '@crane/domain/3d';
import { Button } from '@crane/ui/atoms/button';
import {
  floodlightHeightUnits,
  floodlightUnitsToMeters,
  withFloodlightAimAxisMeters,
  withFloodlightAngle,
  withFloodlightHeightMeters,
  withFloodlightIntensity,
} from '../lib/floodlight-editor';
import { Field, NumberField, type InspectorT } from './inspector-fields';

/**
 * 인스펙터 "조명" 탭 — 놓은 뒤에 고치는 값. 기구 위치는 트랜스폼 탭과 기즈모,
 * 이름은 계층 목록이 맡는다. 편집은 전부 onChange(updater) 한 채널이라
 * undo/redo·dirty 에 잡히고, 값 갱신·검증은 lib/floodlight-editor 가 한다.
 *
 * 순서는 높이 → 콘 각도 → 세기 → 조준점(X/Z, 다시 찍기). "조준점 다시 찍기"
 * 는 캔버스 배치 모드(use-floodlight-place 의 `aim`)를 켜는 버튼이다 — 켜진
 * 동안 콘이 마우스를 따라가고 바닥 클릭 한 번이 조준점이 된다.
 */
export type FloodlightUpdater = (
  light: SavedFloodlightInfo,
) => SavedFloodlightInfo;

export interface FloodlightSectionProps {
  light: SavedFloodlightInfo;
  onChange: (updater: FloodlightUpdater) => void;
  /** 씬 unit → m 환산(높이·조준점 표시). 기본 1. */
  metersPerUnit?: number;
  /** 조준점 다시 찍기 모드가 이 조명에 켜져 있는지. */
  aiming?: boolean;
  onToggleAiming?: () => void;
  /** 동시 점등 슬롯 수 — 안내 문구에 들어간다. */
  slotCount?: number;
  t: InspectorT;
}

/** 입력 오른쪽의 허용 범위 — 한 줄에 붙인다(en dash 뒤에서 줄이 바뀌지 않게). */
const RANGE_CLASS =
  'text-muted-foreground shrink-0 text-[10px] whitespace-nowrap';

export function FloodlightSection({
  light,
  onChange,
  metersPerUnit = 1,
  aiming = false,
  onToggleAiming,
  slotCount = 0,
  t,
}: FloodlightSectionProps) {
  const aimPoint = floodlightAimPoint(light);

  return (
    <div className="space-y-2">
      <div className="text-foreground pb-1.5 text-[12px] font-medium">
        {t('monitoring:inspector.floodlight.title')}
      </div>
      <Field label={t('monitoring:inspector.floodlight.height')}>
        <NumberField
          value={floodlightUnitsToMeters(
            floodlightHeightUnits(light),
            metersPerUnit,
          )}
          step={1}
          unit="m"
          onChange={(value) => {
            if (value === undefined) return;
            onChange((prev) =>
              withFloodlightHeightMeters(prev, value, metersPerUnit),
            );
          }}
        />
      </Field>
      <Field label={t('monitoring:inspector.floodlight.angle')}>
        <NumberField
          value={resolveFloodlightAngle(light)}
          step={1}
          unit="°"
          onChange={(value) => {
            if (value === undefined) return;
            onChange((prev) => withFloodlightAngle(prev, value));
          }}
        />
        <span className={RANGE_CLASS}>
          {FLOODLIGHT_ANGLE_MIN}–{FLOODLIGHT_ANGLE_MAX}°
        </span>
      </Field>
      <Field label={t('monitoring:inspector.floodlight.intensity')}>
        <NumberField
          value={resolveFloodlightIntensity(light)}
          step={0.1}
          unit="×"
          onChange={(value) => {
            if (value === undefined) return;
            onChange((prev) => withFloodlightIntensity(prev, value));
          }}
        />
        <span className={RANGE_CLASS}>
          {FLOODLIGHT_INTENSITY_MIN}–{FLOODLIGHT_INTENSITY_MAX}
        </span>
      </Field>
      <Field label={t('monitoring:inspector.floodlight.aimPoint')}>
        <span className="text-muted-foreground text-[10px]">X</span>
        <NumberField
          value={floodlightUnitsToMeters(aimPoint[0], metersPerUnit)}
          step={1}
          unit="m"
          onChange={(value) => {
            if (value === undefined) return;
            onChange((prev) =>
              withFloodlightAimAxisMeters(prev, 'x', value, metersPerUnit),
            );
          }}
        />
        <span className="text-muted-foreground text-[10px]">Z</span>
        <NumberField
          value={floodlightUnitsToMeters(aimPoint[2], metersPerUnit)}
          step={1}
          unit="m"
          onChange={(value) => {
            if (value === undefined) return;
            onChange((prev) =>
              withFloodlightAimAxisMeters(prev, 'z', value, metersPerUnit),
            );
          }}
        />
      </Field>
      {onToggleAiming ? (
        <Button
          type="button"
          variant={aiming ? 'default' : 'outline'}
          size="xs"
          className="w-full"
          aria-pressed={aiming}
          onClick={onToggleAiming}
        >
          <Crosshair />
          {t(
            aiming
              ? 'monitoring:inspector.floodlight.reaimActive'
              : 'monitoring:inspector.floodlight.reaim',
          )}
        </Button>
      ) : null}
      <p className="text-muted-foreground text-[10px] leading-snug">
        {t('monitoring:inspector.floodlight.hint', { slots: slotCount })}
      </p>
    </div>
  );
}
