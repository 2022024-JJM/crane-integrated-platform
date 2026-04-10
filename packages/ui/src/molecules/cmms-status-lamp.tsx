import type { OnOff, OkNg } from '@crane/core/types/status';

interface CmmsStatusLampProps {
  label: string;
  status: OnOff | OkNg;
  variant?: 'on-off' | 'ok-ng';
}

export function CmmsStatusLamp({ label, status, variant = 'on-off' }: CmmsStatusLampProps) {
  const isActive = variant === 'ok-ng' ? status === 'OK' : status === 'ON';

  return (
    <div className="flex items-center gap-2 py-0.5 border-b border-border last:border-0">
      <span
        className={`shrink-0 inline-block w-9 text-center text-[10px] font-bold rounded py-px ${
          isActive
            ? 'bg-emerald-500 text-white'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        {status}
      </span>
      <span className="text-xs text-foreground">{label}</span>
    </div>
  );
}
