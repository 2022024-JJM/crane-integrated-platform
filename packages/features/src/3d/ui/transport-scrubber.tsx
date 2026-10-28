import {
  memo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { createTooltipHandle } from '@crane/ui/molecules/tooltip-handle';
import {
  PLAY3D_DWELL_BOX_CLASS,
  PLAY3D_DWELL_OPEN_CLASS,
  PLAY3D_EVENT_COLORS,
  bandPercent,
  markerPercent,
  markerSeekTargetMs,
  scrubKeyTargetMs,
  scrubPointerMs,
  type Play3dHoverPayload,
  type TransportMarks,
} from '../lib/play3d-format';
import { formatSimClock } from '../lib/sim-clock';
import {
  readPlay3dPositionMs,
  readPlay3dTransport,
} from '../model/play3d-transport';
import { useReplayPlayerStore } from '../model/use-replay-player-store';
import { Play3dHoverSummary } from './play3d-hover-summary';

/**
 * 재생바 스크럽 — 사건 표식 띠가 곧 재생 축이다. 띠는 세 겹(바닥: 트랙과
 * 지난 구간 채움, 가운데: 표식, 위: 재생선)이고, 바로 아래 삼각형을 잡아
 * 끈다. 띠의 빈 곳을 눌러도 그 시각으로 가고 누른 채 끌 수 있다. 표식을
 * 누르면 그 사건 시각으로 간다(끌기는 시작하지 않는다).
 *
 * 끄는 동안의 위치는 바 폴링(200ms)을 기다리지 않고 손을 따른다. 위치는
 * 렌더마다 러너·리플레이 스토어에서 직접 읽는다 — seek 가 동기라 끌기를 놓는
 * 순간에도 옛 위치로 튀지 않는다. 이동은 `onSeek`(트랜스포트 어댑터) 하나다.
 */
export function TransportScrubber({
  marks,
  axisMs,
  disabled,
  onSeek,
}: {
  marks: TransportMarks;
  axisMs: number;
  disabled: boolean;
  onSeek: (ms: number) => void;
}) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  // 같은 시각을 거듭 seek 하지 않는다 — 리플레이 seek 는 매번 프레임을 다시 적용한다.
  const lastSeekRef = useRef<number | null>(null);
  const [dragMs, setDragMs] = useState<number | null>(null);
  // 키보드 이동은 다음 폴링을 기다리지 않고 바로 다시 그린다.
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  const shownMs = dragMs ?? readPlay3dPositionMs();
  const percent = markerPercent(shownMs, axisMs);

  const seekToPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ms = scrubPointerMs(clientX, rect.left, rect.width, axisMs);
    if (ms === null) return;
    setDragMs(ms);
    if (lastSeekRef.current === ms) return;
    lastSeekRef.current = ms;
    onSeek(ms);
  };

  const dragHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) return;
      // 표식(버튼)은 자기 클릭으로 그 사건 시각에 간다 — 끌기를 시작하지 않는다.
      if ((event.target as HTMLElement).closest('button')) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      lastSeekRef.current = null;
      seekToPointer(event.clientX);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      seekToPointer(event.clientX);
    },
    onLostPointerCapture: () => {
      lastSeekRef.current = null;
      setDragMs(null);
    },
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = scrubKeyTargetMs(
      event.key,
      event.shiftKey,
      readPlay3dPositionMs(),
      axisMs,
    );
    if (target === null) return;
    event.preventDefault();
    onSeek(target);
    redraw();
  };

  return (
    <div className="relative flex flex-col">
      {/* 끄는 동안의 시각 — 재생선 바로 위(띠 밖, 눈금 줄 위에 겹친다). 폭을
          고정(w-12)하고 양 끝에서는 반 폭만큼 안쪽에 멈춰, 끝까지 끌어도 바
          밖으로 넘쳐 가로 스크롤을 만들지 않는다. */}
      {dragMs !== null ? (
        <span
          aria-hidden
          className="bg-muted text-foreground pointer-events-none absolute bottom-full z-20 mb-0.5 w-12 -translate-x-1/2 rounded-sm text-center text-[10px] leading-3.5"
          style={{
            left: `clamp(${BUBBLE_HALF_PX}px, ${percent}%, calc(100% - ${BUBBLE_HALF_PX}px))`,
          }}
        >
          {formatSimClock(dragMs)}
        </span>
      ) : null}
      <div
        ref={trackRef}
        className={cn(
          'bg-foreground/10 relative h-3 overflow-hidden',
          disabled ? 'opacity-40' : 'cursor-pointer',
        )}
        {...dragHandlers}
      >
        {/* 지난 구간 — 표식 아래에 깔린다. */}
        <div
          className="bg-foreground/10 pointer-events-none absolute inset-y-0 left-0"
          style={{ width: `${percent}%` }}
        />
        <TransportMarkStrip marks={marks} axisMs={axisMs} />
        <div
          className="bg-foreground pointer-events-none absolute inset-y-0 z-10 w-px -translate-x-1/2 ring-[0.5px] ring-black/40"
          style={{ left: `${percent}%` }}
        />
      </div>
      {/* 줄 높이는 삼각형(8px)만큼 — 잡는 영역(h-3.5)은 아래 간격으로 넘친다. */}
      <div className="relative h-2">
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={t('monitoring:play3d.seek')}
          aria-valuemin={0}
          aria-valuemax={axisMs}
          aria-valuenow={shownMs}
          aria-valuetext={formatSimClock(shownMs)}
          aria-disabled={disabled}
          className={cn(
            'group/handle focus-visible:ring-ring absolute top-0 flex h-3.5 w-5 -translate-x-1/2 justify-center rounded-sm outline-none focus-visible:ring-2',
            disabled
              ? 'opacity-40'
              : dragMs === null
                ? 'cursor-grab'
                : 'cursor-grabbing',
          )}
          style={{ left: `${percent}%` }}
          {...dragHandlers}
          onKeyDown={handleKeyDown}
        >
          <svg
            viewBox="0 0 12 8"
            aria-hidden
            className={cn(
              'h-2 w-3 origin-top overflow-visible drop-shadow transition-transform',
              !disabled && 'group-hover/handle:scale-125',
              dragMs !== null && 'scale-125',
            )}
          >
            <polygon points="6,0 12,8 0,8" className="fill-foreground" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** 끄는 동안의 시각 표시 반 폭(px) — 표시의 `w-12`(48px) 절반. */
const BUBBLE_HALF_PX = 24;

/** 세로 선의 hover·클릭 영역 폭(px)과 그 안에서 선이 놓이는 위치(px). */
const LINE_HIT_PX = 8;
const LINE_INSET_PX = 3;

/** 표식 클릭 — 누르는 순간의 어댑터 스냅샷으로 이동한다(prop 으로 받지 않아 memo 가 산다). */
function seekToMark(atMs: number) {
  const transport = readPlay3dTransport();
  const replay = useReplayPlayerStore.getState();
  transport.seek(
    markerSeekTargetMs(
      atMs,
      transport.source,
      transport.source === 'replay'
        ? replay.frameDurationsMs[replay.frameIndex]
        : undefined,
    ),
  );
}

/**
 * 사건 표식 겹 — 바는 위치 폴링으로 계속 리렌더되므로 표식은 memo 로 떼어
 * 바뀔 때만 다시 그린다. 배경은 투명(트랙·지난 구간은 아래 겹). 팝업 하나에
 * 트리거 여럿(분리 트리거).
 */
const TransportMarkStrip = memo(function TransportMarkStrip({
  marks,
  axisMs,
}: {
  marks: TransportMarks;
  axisMs: number;
}) {
  const { t } = useTranslation();
  const [hover] = useState(() => createTooltipHandle<Play3dHoverPayload>());
  return (
    <div className="absolute inset-0">
      {/* Root 를 트리거보다 먼저 렌더한다. */}
      <Tooltip handle={hover} trackCursorAxis="x" disableHoverablePopup>
        {({ payload }) => (
          <TooltipContent className="max-w-64 animate-none! flex-col items-start gap-0.5 px-2 py-1.5 text-[11px]">
            {payload ? <Play3dHoverSummary payload={payload} /> : null}
          </TooltipContent>
        )}
      </Tooltip>
      {marks.zones.map((mark) => {
        const { left, width } = bandPercent(
          mark.band.fromMs,
          mark.band.toMs,
          axisMs,
        );
        return (
          <TooltipTrigger
            key={mark.key}
            handle={hover}
            payload={mark.payload}
            delay={0}
            render={<button type="button" tabIndex={-1} />}
            aria-label={t('monitoring:play3d.timeline.zoneDwell')}
            // 선(inset-y-0)보다 낮게 — 체류 박스 위로 충돌 선이 드러난다.
            className={cn(
              'absolute inset-y-0.5 min-w-1.5 cursor-pointer',
              PLAY3D_DWELL_BOX_CLASS,
              mark.band.open && PLAY3D_DWELL_OPEN_CLASS,
              mark.dim && 'opacity-30',
            )}
            style={{ left: `${left}%`, width: `${width}%` }}
            onClick={() => seekToMark(mark.band.fromMs)}
          />
        );
      })}
      {marks.lines.map((mark) => (
        <TooltipTrigger
          key={mark.key}
          handle={hover}
          payload={mark.payload}
          delay={0}
          render={<button type="button" tabIndex={-1} />}
          aria-label={t(`monitoring:play3d.event.${mark.event.kind}`)}
          className={cn(
            'absolute inset-y-0 cursor-pointer',
            mark.dim && 'opacity-30',
          )}
          style={{
            width: LINE_HIT_PX,
            left: `clamp(0px, calc(${markerPercent(mark.event.atMs, axisMs)}% - ${LINE_INSET_PX}px), calc(100% - ${LINE_HIT_PX}px))`,
          }}
          onClick={() => seekToMark(mark.event.atMs)}
        >
          <span
            className={cn(
              'absolute inset-y-0 w-0.5',
              PLAY3D_EVENT_COLORS[mark.event.kind],
            )}
            style={{ left: LINE_INSET_PX }}
          />
        </TooltipTrigger>
      ))}
    </div>
  );
});
