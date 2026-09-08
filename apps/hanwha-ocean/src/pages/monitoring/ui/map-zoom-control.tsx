import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { ZOOM_KEY_STEP, pointerRatio } from '../lib/zoom-scale';
import { GlassSurface } from './glass-surface';

interface MapZoomControlProps {
  /** 현재 줌의 트랙 위 위치(0~1). null 이면 아직 지도가 값을 주지 않은 상태 */
  ratio: number | null;
  /** 사이트 자동 진입 임계 줌의 트랙 위 위치(0~1) */
  enterThresholdRatio: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSeek: (ratio: number) => void;
  /** 현재 레벨의 기본 화면으로 되돌린다 */
  onReset: () => void;
}

/**
 * 확대/축소 컨트롤 — 판 안에 [+] · 드래그 트랙 · [−].
 *
 * 구글맵 기본 zoomControl 을 끄고 직접 그린다. 기본 컨트롤은 흰 사각형이
 * 고정이라 다크 테마·위성 배경에서 혼자 튀고, 나머지 오버레이와 재질이
 * 전혀 달랐다.
 *
 * 트랙은 잡아끌 수 있다. 세계에서 부두까지 줌 폭이 열여섯 단계라 버튼만으로는
 * 열몇 번을 눌러야 했다. 트랙 위 눈금은 "여기를 넘으면 가장 가까운 사이트로
 * 자동 전환된다"는 지점으로, 그 전환이 예고 없이 일어나지 않게 한다.
 */
export function MapZoomControl({
  ratio,
  enterThresholdRatio,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onSeek,
  onReset,
}: MapZoomControlProps) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const fill = ratio === null ? 0 : ratio * 100;

  const seekFromPointer = useCallback(
    (clientY: number) => {
      const node = trackRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      onSeek(pointerRatio(clientY, rect.top, rect.height));
    },
    [onSeek],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      seekFromPointer(event.clientY);
    },
    [seekFromPointer],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      seekFromPointer(event.clientY);
    },
    [seekFromPointer],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (ratio === null) return;
      const delta =
        event.key === 'ArrowUp' || event.key === 'ArrowRight'
          ? ZOOM_KEY_STEP
          : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
            ? -ZOOM_KEY_STEP
            : 0;
      if (delta === 0) {
        if (event.key === 'Home') onSeek(0);
        else if (event.key === 'End') onSeek(1);
        else return;
      } else {
        onSeek(ratio + delta / 10);
      }
      event.preventDefault();
    },
    [ratio, onSeek],
  );

  return (
    <GlassSurface className="pointer-events-auto w-11">
      <div className="flex w-full flex-col items-center py-1.5">
        {/*
          원위치 — 지금 보고 있는 레벨의 기본 화면으로 되돌린다(세계 레벨이면
          세계 전체, 사이트 안이면 그 사이트의 기본 뷰). 드래그·줌으로 엉뚱한
          바다 한가운데로 나가 버렸을 때 돌아오는 길이 없으면 새로고침 말고는
          방법이 없다. 확대·축소 위에 두고 헤어라인으로 갈라 "이동" 과 "배율" 을
          같은 판 안에서 구분한다.
        */}
        <ZoomButton
          label={t('monitoring-overview:map.zoom.reset')}
          disabled={false}
          onClick={onReset}
        >
          <LocateFixed className="size-[18px]" strokeWidth={2} />
        </ZoomButton>

        <span aria-hidden className="bg-foreground/15 my-1 h-px w-5 shrink-0" />

        <ZoomButton
          label={t('monitoring-overview:map.zoom.in')}
          disabled={!canZoomIn}
          onClick={onZoomIn}
        >
          <Plus className="size-[18px]" strokeWidth={2.25} />
        </ZoomButton>

        {/* 드래그 트랙 — 잡는 영역은 넓게, 보이는 선은 가늘게 */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={t('monitoring-overview:map.zoom.sliderAriaLabel')}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onKeyDown={handleKeyDown}
          className={cn(
            'group/track relative flex w-full cursor-grab touch-none justify-center py-2',
            'active:cursor-grabbing',
            'focus-visible:outline-none',
          )}
        >
          <span className="bg-foreground/20 relative h-20 w-[3px] rounded-sm">
            <span
              className="bg-foreground/60 absolute inset-x-0 bottom-0 rounded-sm"
              style={{ height: `${fill}%` }}
            />
            {/* 사이트 자동 진입 눈금 */}
            <span
              aria-hidden
              className="bg-foreground/35 absolute -inset-x-[4px] h-px"
              style={{ bottom: `${enterThresholdRatio * 100}%` }}
            />
            {/* 노브 — 트랙보다 넓은 가로 손잡이. 잡는 곳이 어디인지 형태로 말한다 */}
            <span
              aria-hidden
              className={cn(
                'absolute left-1/2 h-2 w-4 -translate-x-1/2 translate-y-1/2 rounded-sm',
                'bg-white shadow-[0_1px_2px_rgb(0_0_0/0.35),0_0_0_1px_rgb(0_0_0/0.14)]',
                'dark:bg-white/90',
                'transition-transform duration-150',
                'group-hover/track:scale-x-110 group-focus-visible/track:scale-x-110',
              )}
              style={{ bottom: `${fill}%` }}
            />
          </span>
        </div>

        <ZoomButton
          label={t('monitoring-overview:map.zoom.out')}
          disabled={!canZoomOut}
          onClick={onZoomOut}
        >
          <Minus className="size-[18px]" strokeWidth={2.25} />
        </ZoomButton>
      </div>
    </GlassSurface>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-foreground/80 flex size-9 items-center justify-center rounded-sm',
        'hover:bg-foreground/10 hover:text-foreground cursor-pointer',
        'transition-colors duration-150',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
        'disabled:text-foreground/25 disabled:cursor-not-allowed disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}
