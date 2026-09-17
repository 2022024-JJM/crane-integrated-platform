import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  usePlaybackStore,
  type PlaybackSource,
} from '../model/use-playback-store';

const SOURCES: readonly PlaybackSource[] = ['replay', 'simulation'];

/**
 * 플레이백 소스 탭 — 기록 리플레이 | 시뮬레이션. 화면 맨 위 한 줄이고
 * 전환은 usePlaybackStore.setSource(리마운트 없이 PlaybackView 가 떠나는
 * 소스만 정리). 공용 Tabs 컴포넌트가 없어 role=tablist 버튼으로 만든다.
 */
export function PlaybackSourceTabs({ className }: { className?: string }) {
  const { t } = useTranslation();
  const source = usePlaybackStore((s) => s.source);
  const setSource = usePlaybackStore((s) => s.setSource);
  return (
    <div
      role="tablist"
      aria-label={t('monitoring:playback.source')}
      className={cn(
        'bg-background border-border/60 flex shrink-0 items-end gap-1 border-b px-3',
        className,
      )}
    >
      {SOURCES.map((item) => {
        const selected = item === source;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              selected
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
            onClick={() => setSource(item)}
          >
            {t(
              item === 'replay'
                ? 'monitoring:playback.sourceReplay'
                : 'monitoring:playback.sourceSimulation',
            )}
          </button>
        );
      })}
    </div>
  );
}
