import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import type { StatusLevel } from '@crane/core/types/status';
import { getStatusPalette, withAlpha } from '../model/region-map-types';

interface MarkerHoverCardShellProps {
  visible: boolean;
  statusLevel: StatusLevel;
  title: string;
  subtitle?: string;
  statusLabel: string;
  /** 계층 구분 (SITE / REGION) — 제목 위가 아니라 하단 액션 줄에 붙는다 */
  category: string;
  /** 클릭하면 무슨 일이 일어나는지 — 마커가 버튼임을 카드가 알려준다 */
  actionHint: string;
  /**
   * 제목 앞 배지. region 카드는 마커와 같은 도크 코드 칩을 넘겨 "이 카드가
   * 저 마커의 것" 임을 잇는다. 없으면 기본값인 상태 점을 쓴다.
   */
  leadingBadge?: ReactNode;
  /** 메인 KPI 블록 (대형 숫자 그리드 등) */
  children?: ReactNode;
}

/** 카드 폭. `w-72` 와 반드시 같아야 한다 (위치 보정 계산이 이 값을 쓴다) */
const CARD_WIDTH = 288;
/** 마커와 카드 사이 간격. `mb-3` / `mt-3` 과 같은 값 */
const CARD_GAP = 12;
/** 지도 가장자리에서 최소로 띄울 여백 */
const EDGE_PAD = 12;
/** 꼬리가 카드 밖으로 밀려나지 않도록 하는 좌우 이동 한계 */
const TAIL_SHIFT_LIMIT = CARD_WIDTH / 2 - 16;

/**
 * 오버레이·마커와 같은 유리 재질로 통일된 hover 카드.
 *
 * 예전에는 코너 브래킷 · uppercase 라벨 · 카드 뒤 상태색 외광(blur-2xl) 이
 * 붙어 있었다. 외광은 특히 문제였는데, 카드 하나 뜰 때마다 지도에 색안개가
 * 번져 아래 지형을 덮었다. 상태는 상단 스트라이프와 상태 칩이 이미 말하고
 * 있으므로 안개는 정보 없는 장식이었다.
 *
 * 반지름·글자 크기는 앱 반지름 토큰(4px)을 따른다 — 지도 위라고 더 둥글거나
 * 더 작을 이유가 없다. 폭도 288px 로 올렸다. 256px 에서는 KPI 세 칸이 두 자리
 * 숫자를 겨우 담아 숨이 막혔다.
 *
 * 지도 가장자리 마커에서 카드가 잘리지 않도록 위치를 보정한다. 보정값은
 * state 가 아니라 CSS 변수·data 속성으로 DOM 에 직접 쓴다 — hover 마다
 * 리렌더를 만들지 않고, effect 안 setState(`react-hooks/set-state-in-effect`)
 * 도 피하기 위해서다.
 */
export function MarkerHoverCardShell({
  visible,
  statusLevel,
  title,
  subtitle,
  statusLabel,
  category,
  actionHint,
  leadingBadge,
  children,
}: MarkerHoverCardShellProps) {
  const palette = getStatusPalette(statusLevel);
  const rootRef = useRef<HTMLDivElement>(null);

  useEdgeAwarePlacement(rootRef, visible);

  return (
    <div
      ref={rootRef}
      data-flip="false"
      aria-hidden={!visible}
      className={cn(
        'group/hovercard absolute left-1/2 z-30 w-72',
        'bottom-full mb-3',
        // 위쪽 공간이 부족하면 마커 아래로 뒤집는다
        'data-[flip=true]:top-full data-[flip=true]:bottom-auto data-[flip=true]:mt-3 data-[flip=true]:mb-0',
        // 떠 있는 동안만 포인터를 받는다. 카드는 마커 content 의 자손이라
        // 여기로 포인터가 들어와도 mouseleave 가 뜨지 않아 hover 가 유지되고,
        // 카드 클릭은 마커 클릭과 같은 이동을 탄다.
        // 숨어 있을 때까지 켜 두면 마커마다 보이지 않는 판이 지도 위에 남아
        // 드래그·클릭을 가로챈다.
        visible ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none',
      )}
      style={{
        transform:
          'translate(calc(-50% + var(--hover-shift-x, 0px)), var(--hover-shift-y, 0px))',
      }}
    >
      <div
        className={cn(
          'relative origin-bottom transition-all duration-200 ease-out',
          'group-data-[flip=true]/hovercard:origin-top',
          visible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'translate-y-2 scale-95 opacity-0',
        )}
      >
        <div
          className="border-border/70 bg-background/95 relative overflow-hidden rounded-lg border backdrop-blur-xl"
          style={{
            // 위성 영상처럼 복잡한 배경 위에서도 카드 윤곽이 끊기지 않도록
            // 상태색 1px 링을 그림자와 함께 두른다.
            boxShadow: `0 2px 4px rgb(0 0 0 / 0.16), 0 14px 34px -10px rgb(0 0 0 / 0.45), 0 0 0 1px ${withAlpha(palette, 0.4)}, inset 0 1px 0 color-mix(in oklab, var(--foreground) 8%, transparent)`,
          }}
        >
          {/* 상단 status stripe */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{
              backgroundImage: `linear-gradient(90deg, transparent 0%, ${palette.fillColor} 25%, ${palette.fillColorTo} 75%, transparent 100%)`,
            }}
          />

          {/* Header */}
          <div className="flex items-start gap-2.5 border-b border-black/[0.07] px-4 pt-4 pb-3.5 dark:border-white/[0.09]">
            {leadingBadge ? (
              <span className="mt-0.5 shrink-0">{leadingBadge}</span>
            ) : (
              <span
                aria-hidden
                className="relative mt-1 flex size-2 shrink-0 items-center justify-center"
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: palette.fillColor,
                    boxShadow: `0 0 8px 2px ${withAlpha(palette, 0.67)}`,
                  }}
                />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-[15px] font-semibold tracking-tight">
                {title}
              </p>
              {subtitle ? (
                <p className="text-muted-foreground mt-1 line-clamp-1 text-[12px] font-medium">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {/* Status pill */}
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold',
                palette.textClass,
              )}
              style={{
                backgroundColor: withAlpha(palette, 0.1),
                boxShadow: `inset 0 0 0 1px ${withAlpha(palette, 0.27)}`,
              }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{
                  backgroundColor: palette.fillColor,
                  boxShadow: `0 0 4px ${palette.fillColor}`,
                }}
              />
              {statusLabel}
            </span>
          </div>

          {/* Body */}
          {children ? <div className="px-4 py-3.5">{children}</div> : null}

          {/* Footer: 계층 + 이 마커를 누르면 어디로 가는지 */}
          <div className="text-foreground/55 flex items-center gap-2 border-t border-black/[0.07] px-4 py-3 dark:border-white/[0.09]">
            <span className="text-[12px] font-medium">{category}</span>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="text-foreground/80 truncate text-[12px] font-medium">
              {actionHint}
            </span>
            <ArrowUpRight
              aria-hidden
              className="text-foreground/60 ml-auto size-3.5 shrink-0"
              strokeWidth={2}
            />
          </div>
        </div>

        {/* 꼬리 — 카드가 좌우로 밀려도 마커 위에 남도록 반대로 되민다 */}
        <span
          aria-hidden
          className={cn(
            'absolute bottom-0 left-1/2 size-2.5 border-r border-b border-black/[0.14] bg-white/92 backdrop-blur-xl dark:border-white/[0.14] dark:bg-[rgb(18_20_24)]/90',
            'group-data-[flip=true]/hovercard:top-0 group-data-[flip=true]/hovercard:bottom-auto',
            'group-data-[flip=true]/hovercard:border-t group-data-[flip=true]/hovercard:border-r-0 group-data-[flip=true]/hovercard:border-b-0 group-data-[flip=true]/hovercard:border-l',
            '[--tail-y:50%] group-data-[flip=true]/hovercard:[--tail-y:-50%]',
          )}
          style={{
            transform: `translate(calc(-50% - clamp(${-TAIL_SHIFT_LIMIT}px, var(--hover-shift-x, 0px), ${TAIL_SHIFT_LIMIT}px)), var(--tail-y)) rotate(45deg)`,
            boxShadow: `0 6px 12px -4px ${withAlpha(palette, 0.2)}`,
          }}
        />
      </div>

      {/*
        마커와 카드 사이 간격(mb-3 / mt-3)을 덮는 투명한 다리.
        이 틈에는 아무 요소도 없어서, 카드로 마우스를 옮기는 순간 포인터가
        마커 밖으로 나가 mouseleave 가 떠 버린다. 다리도 마커 content 의
        자손이므로 지나가는 동안 hover 가 끊기지 않는다.
      */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 -bottom-3 h-3',
          'group-data-[flip=true]/hovercard:-top-3 group-data-[flip=true]/hovercard:bottom-auto',
        )}
      />
    </div>
  );
}

/**
 * 카드가 지도 밖으로 나가지 않도록 좌우 이동량과 위/아래 배치를 정해
 * DOM 에 직접 쓴다. 측정은 한 번만 하고 나머지는 계산으로 끝낸다 —
 * 클래스를 바꿔 가며 다시 재면 hover 마다 레이아웃이 두 번 돈다.
 */
function useEdgeAwarePlacement(
  rootRef: React.RefObject<HTMLDivElement | null>,
  visible: boolean,
) {
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node || !visible) return;

    const anchor = (node.offsetParent ??
      node.parentElement) as HTMLElement | null;
    if (!anchor) return;

    const boundsNode = node.closest('[data-map-bounds]');
    const bounds = (
      boundsNode ?? document.documentElement
    ).getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const cardHeight = node.offsetHeight;

    // ── 좌우: 마커 중앙 정렬을 기본으로 두고 지도 안쪽으로 밀어 넣는다
    const naturalLeft = anchorRect.left + anchorRect.width / 2 - CARD_WIDTH / 2;
    const minLeft = bounds.left + EDGE_PAD;
    const maxLeft = Math.max(minLeft, bounds.right - EDGE_PAD - CARD_WIDTH);
    const shiftX = clamp(naturalLeft, minLeft, maxLeft) - naturalLeft;

    // ── 위아래: 위가 좁으면 아래로 뒤집고, 그래도 안 되면 안쪽으로 당긴다
    let flip = false;
    let naturalTop = anchorRect.top - CARD_GAP - cardHeight;
    if (naturalTop < bounds.top + EDGE_PAD) {
      const belowTop = anchorRect.bottom + CARD_GAP;
      if (belowTop + cardHeight <= bounds.bottom - EDGE_PAD) {
        flip = true;
        naturalTop = belowTop;
      }
    }
    const minTop = bounds.top + EDGE_PAD;
    const maxTop = Math.max(minTop, bounds.bottom - EDGE_PAD - cardHeight);
    const shiftY = clamp(naturalTop, minTop, maxTop) - naturalTop;

    node.dataset.flip = flip ? 'true' : 'false';
    node.style.setProperty('--hover-shift-x', `${Math.round(shiftX)}px`);
    node.style.setProperty('--hover-shift-y', `${Math.round(shiftY)}px`);
  }, [rootRef, visible]);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/* ──────────────────────────────────────────────────────────────────────────
 * KPI 블록: hover summary 내 metric grid
 * ────────────────────────────────────────────────────────────────────────── */

export function HoverKpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

export function HoverKpiCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'warning' | 'critical';
}) {
  const active = tone !== 'neutral' && value > 0;
  const palette = getStatusPalette(
    tone === 'critical' ? 'critical' : 'warning',
  );

  const valueColor =
    tone === 'neutral'
      ? 'text-foreground'
      : active
        ? palette.textClass
        : 'text-muted-foreground/70';

  return (
    <div className="bg-foreground/[0.06] relative flex flex-col items-start gap-2 overflow-hidden rounded-sm px-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-px',
          !active && 'bg-foreground/15',
        )}
        style={active ? { backgroundColor: palette.fillColor } : undefined}
      />
      <span className="text-foreground/55 text-[11px] font-medium">
        {label}
      </span>
      <span
        className={cn(
          'text-xl leading-none font-bold tabular-nums',
          valueColor,
        )}
      >
        {value.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
