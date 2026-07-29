import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { TONE_BORDER, TONE_HOVER_TINT, TONE_SURFACE, TONE_TEXT, type Tone } from './tone';
import { FOCUS_RING } from './controls';

/**
 * 경고/알림 배너 — TONE_SURFACE 표면 + 톤 텍스트 타이틀 + 상세 행(children).
 * 점검 지연·긴급 수리·인증서 만료 배너의 공용 셸.
 *
 * collapsible=true면 헤더가 토글 버튼이 되어 기본 접힘 상태로 body를 여닫는다
 * (타이틀 행은 항상 표시). 미지정 시 기존 정적 배너와 동일하게 동작한다.
 */
export function AlertBanner({
  tone = 'critical',
  icon: Icon = AlertCircle,
  title,
  children,
  className,
  collapsible = false,
}: {
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (collapsible) {
    return (
      <div className={cn('rounded-lg border', TONE_SURFACE[tone], className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            FOCUS_RING,
            'flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold transition-colors',
            TONE_HOVER_TINT[tone],
            TONE_TEXT[tone],
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{title}</span>
          {open
            ? <ChevronUp className="h-4 w-4 shrink-0" />
            : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
        {open && children && (
          <div className={cn('space-y-2 border-t p-4', TONE_BORDER[tone])}>{children}</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border p-4 space-y-2', TONE_SURFACE[tone], className)}>
      <p className={cn('flex items-center gap-2 text-sm font-bold', TONE_TEXT[tone])}>
        <Icon className="w-4 h-4 shrink-0" />
        {title}
      </p>
      {children}
    </div>
  );
}
