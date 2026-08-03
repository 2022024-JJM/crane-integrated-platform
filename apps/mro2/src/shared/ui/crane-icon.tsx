import type { CraneType } from '@crane/domain/asset';

/** 크레인 유형별 라인 픽토그램 (매뉴얼의 자산 카드 아이콘 스타일) */
export function CraneIcon({ type, size = 22, color = 'var(--kc-ink)' }: { type: CraneType; size?: number; color?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { stroke: color },
  };
  if (type === 'goliath' || type === 'gantry' || type === 'overhead') {
    // 문형(포탈) 프레임 + 호이스트
    return (
      <svg {...common} aria-hidden>
        <path d="M4 20V7h16v13" />
        <path d="M2 7h20" />
        <path d="M12 7v5" />
        <circle cx="12" cy="14" r="1.4" />
      </svg>
    );
  }
  // 지브/러핑 — 마스트 + 붐 + 훅
  return (
    <svg {...common} aria-hidden>
      <path d="M6 21V5" />
      <path d="M3 21h7" />
      <path d="M6 5l12 4" />
      <path d="M18 9v5" />
      <circle cx="18" cy="16" r="1.4" />
      <path d="M6 9l6 1.9" />
    </svg>
  );
}
