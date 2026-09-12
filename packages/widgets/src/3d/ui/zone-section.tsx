import { Plus, Trash2 } from 'lucide-react';
import {
  modelObjectRegistry,
  normalizeZoneColor,
  type SavedModelInfo,
  type SavedModelZone,
} from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { Input } from '@crane/ui/atoms/input';
import {
  createModelZone,
  measureModelFootprintRadius,
  withZoneOffsetAxis,
} from '../lib/zone-editor';
import { FIELD_INPUT } from './inspector-field-classes';
import {
  Field,
  NumberField,
  SubHeader,
  type InspectorT,
} from './inspector-fields';

/**
 * 인스펙터 "영역" 탭 — 모델 기준 원형 영역 목록. 태그 매핑 탭과 같은 문법:
 * `+` 가 기본값 카드(반경 = 모델 가로 크기·미사용 프리셋 색·빈 이름)를 만들고
 * 카드 안에서 이름·색·반경·오프셋을 고친다. 단위 표기 " m" 는 트랜스폼 위치
 * 입력과 같다(실제 단위는 씬 unit — position 과 동일). 편집은 전부 onUpdate(updater) 한 채널 —
 * undo/redo·dirty 에 잡힌다. 중심은 모델 루트(+오프셋)라 카드에 위치 입력이
 * 없다. 링은 캔버스가 선택 모델에 대해 토글과 무관하게 그린다.
 */
export type ZonesUpdater = (zones: SavedModelZone[]) => SavedModelZone[];

const NO_ZONES: SavedModelZone[] = [];

export interface ZoneSectionProps {
  model: SavedModelInfo;
  onUpdate: (updater: ZonesUpdater) => void;
  /** "다른 영역 감지에서 제외"(zoneExempt) 토글. */
  onExemptChange: (exempt: boolean) => void;
  t: InspectorT;
}

/**
 * 축 표시 + 숫자 입력 한 묶음 — 값이 채워지면 placeholder 가 보이지 않아
 * 축 글자를 따로 둔다. Field 의 gap-2 는 묶음 사이에만 걸리고, 글자와 입력은
 * 더 좁게(gap-1) 붙인다.
 */
function AxisNumber({
  axis,
  value,
  onChange,
}: {
  axis: 'x' | 'z';
  value: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <span className="text-muted-foreground shrink-0 font-mono text-[10px] uppercase">
        {axis}
      </span>
      <NumberField value={value} step={0.5} unit=" m" onChange={onChange} />
    </div>
  );
}

function ZoneCard({
  zone,
  index,
  onChange,
  onRemove,
  t,
}: {
  zone: SavedModelZone;
  index: number;
  onChange: (next: SavedModelZone) => void;
  onRemove: () => void;
  t: InspectorT;
}) {
  const [dx, dz] = zone.offset ?? [0, 0];
  const placeholder = t('monitoring:sceneZone.unnamed', { index: index + 1 });
  return (
    <div className="border-border bg-muted/30 space-y-1.5 rounded-md border p-2">
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={zone.color}
          aria-label={t('monitoring:inspector.zones.color')}
          title={zone.color}
          className="border-border h-6 w-7 shrink-0 cursor-pointer rounded-sm border bg-transparent p-0"
          onChange={(event) => {
            const color = normalizeZoneColor(event.target.value);
            if (color) onChange({ ...zone, color });
          }}
        />
        <Input
          value={zone.name}
          placeholder={placeholder}
          aria-label={t('monitoring:inspector.zones.name')}
          className={cn(FIELD_INPUT, 'h-6 flex-1 font-medium')}
          onChange={(event) => onChange({ ...zone, name: event.target.value })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-red-300"
          aria-label={t('monitoring:inspector.zones.remove')}
          title={t('monitoring:inspector.zones.remove')}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <Field label={t('monitoring:inspector.zones.radius')}>
        <NumberField
          value={zone.radius}
          step={0.5}
          unit=" m"
          onChange={(value) => {
            // 비우거나 0 이하는 무시 — sanitize 가 그 항목을 버리므로 여기서 막는다.
            if (value === undefined || !Number.isFinite(value) || value <= 0)
              return;
            onChange({ ...zone, radius: value });
          }}
        />
      </Field>
      <Field label={t('monitoring:inspector.zones.offset')}>
        <AxisNumber
          axis="x"
          value={dx}
          onChange={(value) => onChange(withZoneOffsetAxis(zone, 'x', value))}
        />
        <AxisNumber
          axis="z"
          value={dz}
          onChange={(value) => onChange(withZoneOffsetAxis(zone, 'z', value))}
        />
      </Field>
    </div>
  );
}

export function ZoneSection({
  model,
  onUpdate,
  onExemptChange,
  t,
}: ZoneSectionProps) {
  const zones = model.zones ?? NO_ZONES;
  const exempt = model.zoneExempt === true;

  return (
    <div className="space-y-2">
      <div className="text-foreground pb-1.5 text-[12px] font-medium">
        {t('monitoring:inspector.zones.title')}
      </div>
      <p className="text-muted-foreground text-[10px] leading-snug whitespace-pre-line">
        {t('monitoring:inspector.zones.hint')}
      </p>
      <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-[10px] transition-colors">
        <Checkbox
          checked={exempt}
          onCheckedChange={(checked) => onExemptChange(checked === true)}
          className="size-3.5 cursor-pointer [&>[data-slot=checkbox-indicator]>svg]:size-3"
        />
        {t('monitoring:inspector.zones.exempt')}
      </label>

      <SubHeader
        title={t('monitoring:inspector.zones.list')}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={t('monitoring:inspector.zones.add')}
            title={t('monitoring:inspector.zones.add')}
            onClick={() => {
              // 클릭 시점에 잰다 — 모델이 아직 로드 전이면 기본 반경.
              const radius = measureModelFootprintRadius(
                modelObjectRegistry.get(model.id) ?? null,
              );
              onUpdate((prev) => [
                ...prev,
                createModelZone(
                  prev,
                  radius,
                  t('monitoring:sceneZone.unnamed', { index: prev.length + 1 }),
                ),
              ]);
            }}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      />

      <div className="space-y-1.5">
        {zones.map((zone, index) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            index={index}
            onChange={(next) =>
              onUpdate((prev) => prev.map((z) => (z.id === zone.id ? next : z)))
            }
            onRemove={() =>
              onUpdate((prev) => prev.filter((z) => z.id !== zone.id))
            }
            t={t}
          />
        ))}
        {zones.length === 0 ? (
          <p className="text-muted-foreground text-[10px]">
            {t('monitoring:inspector.zones.empty')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
