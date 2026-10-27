import { Loader2, Pause, Play, RotateCcw, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
} from '@crane/domain/virtual-tag';
import { useVirtualTagStore, virtualTagRuntime } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { CELL_NUMBER_INPUT, CELL_NUMBER_WRAPPER } from './virtual-cell-styles';

/**
 * 가상 태그 탭 공통 바 — 저장, 전체 재생/일시정지, 값 초기화, 갱신 주기(초).
 * 목록과 상세 어디서든 같은 자리에 있다. 재생은 전역(모든 장비)이다.
 *
 * 저장 상태는 버튼 자체가 나타낸다 — 씬 편집 헤더 바와 같은 규칙. 미저장이면
 * 붉은 점과 진한 글자, 저장되면 흐린 글자, 저장 중엔 스피너. 점은 글자와
 * 겹치지 않게 테두리 우상단 모서리에 걸친다.
 */
export function VirtualSimulationBar({
  isDirty,
  isSaving,
  onSave,
}: {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const start = useVirtualTagStore((s) => s.start);
  const pause = useVirtualTagStore((s) => s.pause);
  const tickSec = useVirtualTagStore((s) => s.tickSec);
  const setTickSec = useVirtualTagStore((s) => s.setTickSec);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <label className="text-muted-foreground mr-2 flex items-center gap-1.5 text-[11px]">
        {t('monitoring:virtualTags.tick')}
        <InputNumber
          value={tickSec}
          min={VIRTUAL_TAG_TICK_MIN}
          max={VIRTUAL_TAG_TICK_MAX}
          step={0.01}
          className={cn(CELL_NUMBER_WRAPPER, 'w-20')}
          inputClassName={CELL_NUMBER_INPUT}
          onChange={setTickSec}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isSaving}
        className={cn(
          'relative',
          isDirty ? 'text-foreground' : 'text-muted-foreground',
        )}
        onClick={onSave}
      >
        {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
        {t('monitoring:virtualTags.save')}
        {isDirty && !isSaving ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-red-500"
          />
        ) : null}
      </Button>
      <Button
        type="button"
        variant={isRunning ? 'default' : 'outline'}
        size="sm"
        aria-pressed={isRunning}
        onClick={() => (isRunning ? pause() : start())}
      >
        {isRunning ? <Pause /> : <Play />}
        {t(
          isRunning
            ? 'monitoring:virtualTags.pause'
            : 'monitoring:virtualTags.play',
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => virtualTagRuntime.resetValues()}
      >
        <RotateCcw />
        {t('monitoring:virtualTags.resetValues')}
      </Button>
    </div>
  );
}
