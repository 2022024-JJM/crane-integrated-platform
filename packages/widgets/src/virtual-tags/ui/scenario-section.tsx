import { Copy, Play, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCENARIO_EASES,
  SCENARIO_NAME_MAX,
  SCENARIOS_MAX,
  evaluateScenarioTrack,
  scenarioDurationMs,
  type ScenarioEase,
  type ScenarioKeyframe,
  type ScenarioTrack,
  type VirtualScenario,
  type VirtualTagDefinition,
} from '@crane/domain/virtual-tag';
import { useVirtualTagStore } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Switch } from '@crane/ui/atoms/switch';
import { Card, CardContent } from '@crane/ui/molecules/card';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';

/**
 * 시나리오 편집 — 가상 태그 관리 페이지의 아래 절. 시나리오 목록(선택·추가·
 * 복제·삭제·이름·반복)과 선택 시나리오의 트랙(태그 키별 키프레임 표 + 미리보기
 * 곡선). 편집은 전부 스토어를 지나 태그와 같은 저장 버튼·dirty 로 묶인다.
 * 시각 입력은 초 단위(저장은 ms), 값은 태그 단위 그대로다.
 *
 * "실행" 은 그 시나리오를 활성으로 두고 재생을 켠다 — 모니터링 독의 시뮬레이션
 * 시계 팝업과 같은 스토어 상태라 3D 화면으로 가면 그대로 돌고 있다.
 */
const NONE = '__none__';
const CELL_NUMBER_WRAPPER =
  'border-border bg-muted h-7 w-full min-w-0 rounded-sm';
const CELL_NUMBER_INPUT = 'px-2 text-xs';

export function ScenarioSection() {
  const { t } = useTranslation();
  const tags = useVirtualTagStore((s) => s.tags);
  const scenarios = useVirtualTagStore((s) => s.scenarios);
  const activeScenarioId = useVirtualTagStore((s) => s.activeScenarioId);
  const setActiveScenario = useVirtualTagStore((s) => s.setActiveScenario);
  const addScenario = useVirtualTagStore((s) => s.addScenario);
  const updateScenario = useVirtualTagStore((s) => s.updateScenario);
  const removeScenario = useVirtualTagStore((s) => s.removeScenario);
  const duplicateScenario = useVirtualTagStore((s) => s.duplicateScenario);
  const addScenarioTrack = useVirtualTagStore((s) => s.addScenarioTrack);
  const setScenarioTrackKeyframes = useVirtualTagStore(
    (s) => s.setScenarioTrackKeyframes,
  );
  const removeScenarioTrack = useVirtualTagStore((s) => s.removeScenarioTrack);
  const start = useVirtualTagStore((s) => s.start);
  const seek = useVirtualTagStore((s) => s.seek);

  // 편집 대상은 활성 시나리오와 별개다 — 실행 중인 시나리오를 바꾸지 않고
  // 다른 것을 고칠 수 있게. 처음엔 활성(또는 첫 항목)을 고른다.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    scenarios.find((s) => s.id === selectedId) ??
    scenarios.find((s) => s.id === activeScenarioId) ??
    scenarios[0] ??
    null;
  const tagByKey = useMemo(
    () => new Map(tags.map((tag) => [tag.key, tag])),
    [tags],
  );
  const availableKeys = useMemo(
    () =>
      tags
        .map((tag) => tag.key)
        .filter((key) => !selected?.tracks.some((track) => track.key === key)),
    [tags, selected],
  );
  const [trackKeyToAdd, setTrackKeyToAdd] = useState<string>(NONE);

  const handleAdd = () => {
    const id = addScenario(t('monitoring:virtualTags.scenarios.newName'));
    if (id) setSelectedId(id);
  };
  const handleRun = (scenario: VirtualScenario) => {
    setActiveScenario(scenario.id);
    seek(0);
    start();
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-foreground mr-2 text-sm font-semibold">
            {t('monitoring:virtualTags.scenarios.title')}
          </h2>
          <Select
            value={selected?.id ?? NONE}
            onValueChange={(value: string) =>
              setSelectedId(value === NONE ? null : value)
            }
          >
            <SelectTrigger
              aria-label={t('monitoring:virtualTags.scenarios.title')}
              className="bg-muted h-7 w-48 rounded-sm px-2 text-xs font-normal"
            >
              <span className="truncate">
                {selected
                  ? selected.name || t('monitoring:simulation.unnamed')
                  : t('monitoring:virtualTags.scenarios.empty')}
              </span>
            </SelectTrigger>
            <SelectPopup align="start" className="min-w-48">
              {scenarios.length === 0 ? (
                <SelectItem value={NONE} disabled>
                  {t('monitoring:virtualTags.scenarios.empty')}
                </SelectItem>
              ) : (
                scenarios.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name || t('monitoring:simulation.unnamed')}
                    {item.id === activeScenarioId ? ' ●' : ''}
                  </SelectItem>
                ))
              )}
            </SelectPopup>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={scenarios.length >= SCENARIOS_MAX}
            onClick={handleAdd}
          >
            <Plus />
            {t('monitoring:virtualTags.scenarios.add')}
          </Button>
          {selected ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const id = duplicateScenario(selected.id);
                  if (id) setSelectedId(id);
                }}
              >
                <Copy />
                {t('monitoring:virtualTags.scenarios.duplicate')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  removeScenario(selected.id);
                  setSelectedId(null);
                }}
              >
                <Trash2 />
                {t('monitoring:virtualTags.scenarios.remove')}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => handleRun(selected)}
              >
                <Play />
                {t('monitoring:virtualTags.scenarios.run')}
              </Button>
            </>
          ) : null}
          <span className="text-muted-foreground ml-auto text-[11px]">
            {t('monitoring:virtualTags.count', {
              count: scenarios.length,
              max: SCENARIOS_MAX,
            })}
          </span>
        </div>

        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">
                  {t('monitoring:virtualTags.scenarios.name')}
                </span>
                <Input
                  value={selected.name}
                  maxLength={SCENARIO_NAME_MAX}
                  className="border-border bg-muted h-7 w-48 rounded-sm px-2 text-xs"
                  onChange={(event) =>
                    updateScenario(selected.id, { name: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">
                  {t('monitoring:virtualTags.scenarios.loop')}
                </span>
                <Switch
                  checked={selected.loop}
                  onCheckedChange={(loop) =>
                    updateScenario(selected.id, { loop })
                  }
                />
              </label>
              <span className="text-muted-foreground font-mono tabular-nums">
                {t('monitoring:virtualTags.scenarios.duration', {
                  seconds: (scenarioDurationMs(selected) / 1000).toFixed(1),
                })}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Select
                  value={trackKeyToAdd}
                  onValueChange={(value: string) => setTrackKeyToAdd(value)}
                >
                  <SelectTrigger
                    aria-label={t('monitoring:virtualTags.scenarios.selectTag')}
                    className="bg-muted h-7 w-56 rounded-sm px-2 font-mono text-xs font-normal"
                  >
                    <span className="truncate">
                      {trackKeyToAdd === NONE
                        ? t('monitoring:virtualTags.scenarios.selectTag')
                        : trackKeyToAdd}
                    </span>
                  </SelectTrigger>
                  <SelectPopup align="end" className="min-w-56">
                    {availableKeys.length === 0 ? (
                      <SelectItem value={NONE} disabled>
                        {t('monitoring:virtualTags.scenarios.noMoreTags')}
                      </SelectItem>
                    ) : (
                      availableKeys.map((key) => (
                        <SelectItem key={key} value={key}>
                          <span className="font-mono">{key}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectPopup>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={trackKeyToAdd === NONE}
                  onClick={() => {
                    if (addScenarioTrack(selected.id, trackKeyToAdd)) {
                      setTrackKeyToAdd(NONE);
                    }
                  }}
                >
                  <Plus />
                  {t('monitoring:virtualTags.scenarios.addTrack')}
                </Button>
              </div>
            </div>

            {selected.tracks.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {t('monitoring:virtualTags.scenarios.noTracks')}
              </p>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {selected.tracks.map((track) => (
                  <TrackCard
                    key={track.key}
                    track={track}
                    tag={tagByKey.get(track.key)}
                    durationMs={scenarioDurationMs(selected)}
                    onChange={(keyframes) =>
                      setScenarioTrackKeyframes(
                        selected.id,
                        track.key,
                        keyframes,
                      )
                    }
                    onRemove={() => removeScenarioTrack(selected.id, track.key)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            {t('monitoring:virtualTags.scenarios.hint')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TrackCard({
  track,
  tag,
  durationMs,
  onChange,
  onRemove,
}: {
  track: ScenarioTrack;
  tag: VirtualTagDefinition | undefined;
  durationMs: number;
  onChange: (keyframes: ScenarioKeyframe[]) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<ScenarioKeyframe>) => {
    const next = track.keyframes.map((frame, i) =>
      i === index ? { ...frame, ...patch } : frame,
    );
    onChange(next);
  };
  const remove = (index: number) =>
    onChange(track.keyframes.filter((_, i) => i !== index));
  const append = () => {
    const last = track.keyframes[track.keyframes.length - 1];
    onChange([
      ...track.keyframes,
      { atMs: (last?.atMs ?? 0) + 5000, value: last?.value ?? 0 },
    ]);
  };

  return (
    <div
      className={cn(
        'border-border bg-muted/30 space-y-2 rounded-md border p-2',
        !tag && 'border-amber-500/60',
      )}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="min-w-0 flex-1 truncate font-mono" title={track.key}>
          {track.key}
        </span>
        {tag ? (
          <span className="text-muted-foreground shrink-0 truncate">
            {tag.name}
            {tag.unit ? ` (${tag.unit})` : ''}
            {tag.limits?.maxSpeed !== undefined
              ? ` · ≤${tag.limits.maxSpeed}${tag.unit ?? ''}/s`
              : ''}
          </span>
        ) : (
          <span className="shrink-0 text-[10px] text-amber-500">
            {t('monitoring:editor.virtualTags.unregistered')}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-red-300"
          aria-label={t('monitoring:virtualTags.scenarios.removeTrack')}
          title={t('monitoring:virtualTags.scenarios.removeTrack')}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <TrackPreview track={track} tag={tag} durationMs={durationMs} />
      <table className="w-full table-fixed text-[11px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="w-[28%] text-left font-medium">
              {t('monitoring:virtualTags.scenarios.time')}
            </th>
            <th className="w-[32%] text-left font-medium">
              {t('monitoring:virtualTags.scenarios.value')}
            </th>
            <th className="w-[30%] text-left font-medium">
              {t('monitoring:virtualTags.scenarios.ease')}
            </th>
            <th className="w-[10%]" />
          </tr>
        </thead>
        <tbody>
          {track.keyframes.map((frame, index) => (
            <tr key={`${index}-${frame.atMs}`}>
              <td className="pr-1 pb-1">
                <InputNumber
                  value={frame.atMs / 1000}
                  min={0}
                  step={0.5}
                  unit=" s"
                  editPreview
                  className={CELL_NUMBER_WRAPPER}
                  inputClassName={CELL_NUMBER_INPUT}
                  onChange={(seconds) =>
                    update(index, { atMs: Math.round(seconds * 1000) })
                  }
                />
              </td>
              <td className="pr-1 pb-1">
                <InputNumber
                  value={frame.value}
                  min={tag?.min}
                  max={tag?.max}
                  step={tag ? (tag.max - tag.min) / 100 : 1}
                  unit={tag?.unit ? ` ${tag.unit}` : undefined}
                  editPreview
                  className={CELL_NUMBER_WRAPPER}
                  inputClassName={CELL_NUMBER_INPUT}
                  onChange={(value) => update(index, { value })}
                />
              </td>
              <td className="pr-1 pb-1">
                <Select
                  value={frame.ease ?? 'linear'}
                  onValueChange={(ease: ScenarioEase) =>
                    update(index, {
                      ease: ease === 'linear' ? undefined : ease,
                    })
                  }
                >
                  <SelectTrigger
                    aria-label={t('monitoring:virtualTags.scenarios.ease')}
                    className="bg-muted h-7 w-full min-w-0 rounded-sm px-2 text-xs font-normal"
                  >
                    <span className="truncate">
                      {t(
                        `monitoring:virtualTags.scenarios.eases.${frame.ease ?? 'linear'}`,
                      )}
                    </span>
                  </SelectTrigger>
                  <SelectPopup align="start" className="min-w-28">
                    {SCENARIO_EASES.map((ease) => (
                      <SelectItem key={ease} value={ease}>
                        {t(`monitoring:virtualTags.scenarios.eases.${ease}`)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </td>
              <td className="pb-1 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-red-300"
                  aria-label={t(
                    'monitoring:virtualTags.scenarios.removeKeyframe',
                  )}
                  title={t('monitoring:virtualTags.scenarios.removeKeyframe')}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-[11px]"
        onClick={append}
      >
        <Plus className="size-3.5" />
        {t('monitoring:virtualTags.scenarios.addKeyframe')}
      </Button>
    </div>
  );
}

/** 트랙 곡선 미리보기 — 시나리오 길이 전체를 100 점으로 샘플링한 SVG. */
function TrackPreview({
  track,
  tag,
  durationMs,
}: {
  track: ScenarioTrack;
  tag: VirtualTagDefinition | undefined;
  durationMs: number;
}) {
  const width = 240;
  const height = 40;
  const points = useMemo(() => {
    const values = track.keyframes.map((k) => k.value);
    const min = tag ? tag.min : Math.min(...values);
    const max = tag ? tag.max : Math.max(...values);
    const range = max - min || 1;
    const span = Math.max(durationMs, 1);
    const out: string[] = [];
    for (let i = 0; i <= 100; i += 1) {
      const tMs = (span * i) / 100;
      const value = evaluateScenarioTrack(track, tMs) ?? min;
      const x = (i / 100) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return out.join(' ');
  }, [track, tag, durationMs]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="bg-muted/50 h-10 w-full rounded-sm"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-primary"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
