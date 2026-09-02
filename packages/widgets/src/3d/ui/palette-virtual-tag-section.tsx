import { Pause, Play, RotateCcw, Settings2 } from 'lucide-react';
import { memo, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  collectSceneTagKeys,
  tagLiveValues,
  useRigLivePoll,
  useVirtualTagStore,
  virtualTagRuntime,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Button } from '@crane/ui/atoms/button';

interface PaletteVirtualTagSectionProps {
  sceneInfo: SavedSceneInfo | null;
  /** 가상 태그 관리 페이지 경로(`/outdoor-work/:regionId/virtual-tags` 등). */
  managePath: string;
}

/**
 * 에디터 팔레트 "태그" 탭 — 시뮬레이션 재생 토글 + 이 씬이 참조하는 태그의
 * 현재값. manual 패턴 태그는 슬라이더로 밀 수 있어 3D 를 보면서 자세를
 * 확인한다. 태그의 생성·패턴 설정은 관리 페이지가 맡는다(링크).
 *
 * 값은 15Hz 폴링으로 tagLiveValues/virtualTagRuntime 을 읽는다 — 재생 중
 * 초당 수십 번 오는 값을 React 상태로 올리지 않는다.
 */
export const PaletteVirtualTagSection = memo(function PaletteVirtualTagSection({
  sceneInfo,
  managePath,
}: PaletteVirtualTagSectionProps) {
  const { t } = useTranslation();
  useRigLivePoll();
  const hydrate = useVirtualTagStore((s) => s.hydrate);
  const tags = useVirtualTagStore((s) => s.tags);
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const start = useVirtualTagStore((s) => s.start);
  const pause = useVirtualTagStore((s) => s.pause);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const sceneKeys = useMemo(() => collectSceneTagKeys(sceneInfo), [sceneInfo]);
  const tagByKey = useMemo(() => new Map(tags.map((tag) => [tag.key, tag])), [tags]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant={isRunning ? 'default' : 'outline'}
          size="sm"
          className="h-7 flex-1 gap-1.5 text-[11px]"
          aria-pressed={isRunning}
          onClick={() => (isRunning ? pause() : start())}
        >
          {isRunning ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {t(
            isRunning
              ? 'monitoring:editor.virtualTags.pause'
              : 'monitoring:editor.virtualTags.play',
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label={t('monitoring:editor.virtualTags.resetValues')}
          title={t('monitoring:editor.virtualTags.resetValues')}
          onClick={() => virtualTagRuntime.resetValues()}
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <AppLink
          to={managePath}
          className="text-muted-foreground hover:text-foreground inline-flex size-6 items-center justify-center rounded-md"
          aria-label={t('monitoring:editor.virtualTags.manage')}
          title={t('monitoring:editor.virtualTags.manage')}
        >
          <Settings2 className="size-3.5" />
        </AppLink>
      </div>
      <p className="text-muted-foreground text-[10px] leading-snug">
        {t('monitoring:editor.virtualTags.hint')}
      </p>

      <p className="text-muted-foreground pt-1 text-[10px] font-semibold tracking-[0.14em] uppercase">
        {t('monitoring:editor.virtualTags.sceneTags')}
      </p>
      {sceneKeys.length === 0 ? (
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:editor.virtualTags.noSceneTags')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {sceneKeys.map((key) => {
            const tag = tagByKey.get(key);
            const live = tagLiveValues.get(key)?.value;
            const manual = tag?.pattern.kind === 'manual';
            const value =
              (tag ? virtualTagRuntime.getValue(tag.id) : undefined) ?? live;
            return (
              <div
                key={key}
                className={cn(
                  'border-border bg-muted/30 space-y-1 rounded-md border p-2',
                  !tag && 'border-amber-500/60',
                )}
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="min-w-0 flex-1 truncate font-mono" title={key}>
                    {key}
                  </span>
                  {!tag ? (
                    <span className="shrink-0 text-[10px] text-amber-500">
                      {t('monitoring:editor.virtualTags.unregistered')}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground w-16 shrink-0 text-right font-mono text-[10px]">
                    {value !== undefined && Number.isFinite(value)
                      ? Number(value.toFixed(3))
                      : '—'}
                    {tag?.unit ? ` ${tag.unit}` : ''}
                  </span>
                </div>
                {tag && manual ? (
                  <input
                    type="range"
                    min={tag.min}
                    max={tag.max}
                    step={(tag.max - tag.min) / 200}
                    value={value ?? tag.min}
                    aria-label={key}
                    className="accent-primary h-2 w-full cursor-pointer"
                    onChange={(event) =>
                      virtualTagRuntime.setManualValue(
                        tag.id,
                        Number(event.target.value),
                      )
                    }
                  />
                ) : tag ? (
                  <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full"
                      style={{
                        width: `${
                          value === undefined
                            ? 0
                            : Math.min(
                                100,
                                Math.max(
                                  0,
                                  ((value - tag.min) / (tag.max - tag.min)) * 100,
                                ),
                              )
                        }%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
