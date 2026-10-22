import { cn } from '@crane/core/lib/utils';

/**
 * 관제 HUD 등급 글리프 — 경고(danger)는 붉은 원판에 흰 느낌표, 주의(caution)는
 * 호박색 삼각형에 짙은 느낌표. HUD 알람 요약 버튼과 펼침 목록 행이 같은
 * 모양을 쓴다. 장식이라 aria-hidden 이고 뜻은 옆 글자가 전한다.
 */
export function DangerGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-3 shrink-0', className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="11" className="fill-red-500" />
      <path
        d="M12 6.5v6.5"
        className="stroke-white"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.5" className="fill-white" />
    </svg>
  );
}

export function CautionGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-3 shrink-0', className)}
      aria-hidden
    >
      <path
        d="M10.3 3.2a2 2 0 0 1 3.4 0l8.6 15a2 2 0 0 1-1.7 3H3.4a2 2 0 0 1-1.7-3Z"
        className="fill-amber-500"
      />
      <path
        d="M12 9v4.5"
        className="stroke-neutral-900"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.8" r="1.3" className="fill-neutral-900" />
    </svg>
  );
}
