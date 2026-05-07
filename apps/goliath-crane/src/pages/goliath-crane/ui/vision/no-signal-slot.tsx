import { VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';

export function NoSignalSlot({ className }: { className?: string }) {
  const { t } = useTranslation('goliath-crane');
  return (
    <div
      className={cn(
        'border-border/30 bg-muted/30 relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg,transparent,transparent 6px,currentColor 6px,currentColor 7px)',
        }}
      />
      <VideoOff className="text-muted-foreground/50 size-6" />
      <span className="text-muted-foreground/70 font-mono text-[10px] font-bold tracking-[0.2em]">
        {t('vision.noSignal')}
      </span>
    </div>
  );
}
