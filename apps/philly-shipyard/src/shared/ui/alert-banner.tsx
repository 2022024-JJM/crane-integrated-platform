import { AlertCircle } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { TONE_SURFACE, TONE_TEXT, type Tone } from './tone';

/**
 * 경고/알림 배너 — TONE_SURFACE 표면 + 톤 텍스트 타이틀 + 상세 행(children).
 * 점검 지연·긴급 수리·인증서 만료 배너의 공용 셸.
 */
export function AlertBanner({
  tone = 'critical',
  icon: Icon = AlertCircle,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded border p-4 space-y-2', TONE_SURFACE[tone], className)}>
      <p className={cn('flex items-center gap-2 text-sm font-bold', TONE_TEXT[tone])}>
        <Icon className="w-4 h-4 shrink-0" />
        {title}
      </p>
      {children}
    </div>
  );
}
