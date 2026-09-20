import { useEffect, useRef, useState } from 'react';
import { cn } from '@crane/core/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { createTooltipHandle } from '@crane/ui/molecules/tooltip-handle';
import {
  PLAY3D_DWELL_BOX_CLASS,
  PLAY3D_DWELL_HATCH,
  PLAY3D_DWELL_TONE,
  PLAY3D_STATUS_FILL,
  bandPercent,
  markerPercent,
  msAtFraction,
  timelineContentWidth,
  timelineCursorInView,
  timelineFollowScroll,
  timelineTrackScale,
  timelineViewTicks,
  type Play3dHoverPayload,
  type TimelineEquipmentRow,
} from '../lib/play3d-format';
import type { ScannedInterval } from '../lib/play3d-stats';
import { Play3dHoverSummary } from './play3d-hover-summary';
import { Play3dTickRow } from './play3d-tick-row';

/**
 * 스윔레인 타임라인 — 장비마다 한 행이고 사건은 그 행에 겹쳐 그린다: 운전 상태
 * 막대 위에 영역 체류(대각선 박스), 그 위에 충돌(빨간 세로 선, 부딪힌 두 장비
 * 행 모두). 현재 위치 세로선, 클릭 = seek(Foxglove State Transitions 방식).
 * 표식에 마우스를 올리면 요약이 즉시 뜬다 — 팝업 하나에 트리거 여럿(분리
 * 트리거)이라 표식이 많아도 팝업은 하나다.
 *
 * 왼쪽 장비 이름 열은 고정이고 오른쪽 트랙 영역만 가로로 스크롤된다(스크롤바가
 * 이름 열 아래로 뻗지 않는다). 시간 눈금은 트랙 위. 축이 한 화면 분량
 * (TIMELINE_FIT_MS)을 넘으면 트랙이 배율만큼 넓어진다. 행·표식·배율·눈금·재생
 * 위치 따라가기 판단은 전부 lib(play3d-stats·play3d-format)에 있고 여기서는
 * DOM 치수를 읽어 넘기고 결과를 그리기만 한다.
 */

/** 눈금 행과 이름 열 스페이서가 함께 쓰는 높이 — 다르면 이름과 트랙이 어긋난다. */
const TICK_ROW_CLASS = 'h-4 leading-4';
/** 충돌 선의 hover 영역 폭(px)과 그 안에서 선이 놓이는 위치(px). */
const LINE_HIT_PX = 8;
const LINE_INSET_PX = 3;

export function Play3dReportTimeline({
  axisMs,
  windowEndMs,
  isPlaying,
  scanned,
  equipment,
  onSeek,
  className,
}: {
  axisMs: number;
  windowEndMs: number;
  /** 재생 중인지 — 재생 위치 따라가기 규칙이 갈린다. */
  isPlaying: boolean;
  scanned: readonly ScannedInterval[];
  equipment: readonly TimelineEquipmentRow[];
  /** 축 위 클릭 → 그 씬 시간으로 이동. */
  onSeek: (atMs: number) => void;
  className?: string;
}) {
  const cursor = markerPercent(windowEndMs, axisMs);
  const scale = timelineTrackScale(axisMs);
  const ticks = timelineViewTicks(axisMs);
  const [hover] = useState(() => createTooltipHandle<Play3dHoverPayload>());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 커서가 보이고 있는지 — 재생 중 사용자가 스크롤해 떠난 위치를 되돌리지 않는 근거.
  const inViewRef = useRef(true);

  // ▶ 를 누르면 따라가기를 다시 켠다. 아래 effect 보다 먼저 선언해 같은 커밋에서 먼저 돈다.
  useEffect(() => {
    if (isPlaying) inViewRef.current = true;
  }, [isPlaying]);

  // 재생 위치 따라가기 — 판단은 lib, 여기서는 치수를 읽고 scrollLeft 만 대입한다.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const next = timelineFollowScroll({
      cursorPercent: cursor,
      scrollLeft: scroller.scrollLeft,
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      wasInView: inViewRef.current,
      isPlaying,
    });
    if (next.scrollLeft !== null) scroller.scrollLeft = next.scrollLeft;
    inViewRef.current = next.inView;
  }, [cursor, isPlaying, scale]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget;
    inViewRef.current = timelineCursorInView({
      cursorPercent: cursor,
      scrollLeft: scroller.scrollLeft,
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
    });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    onSeek(msAtFraction((event.clientX - rect.left) / rect.width, axisMs));
  };

  return (
    <div className={cn('flex items-start', className)}>
      {/* Root 를 트리거보다 먼저 렌더한다 — 트리거가 이 핸들의 팝업 컨텍스트를 읽는다. */}
      <Tooltip handle={hover} trackCursorAxis="x" disableHoverablePopup>
        {({ payload }) => (
          <TooltipContent className="max-w-64 animate-none! flex-col items-start gap-0.5 px-2 py-1.5 text-[11px]">
            {payload ? <Play3dHoverSummary payload={payload} /> : null}
          </TooltipContent>
        )}
      </Tooltip>

      {/* 장비 이름 열 — 스크롤러 밖이라 가로 스크롤바가 이 아래로 뻗지 않는다. */}
      <div className="w-24 shrink-0">
        <div className={TICK_ROW_CLASS} />
        {equipment.map((row) => (
          <div
            key={row.modelId}
            className="text-muted-foreground h-5 truncate pr-1.5 text-[10px] leading-5"
            title={row.name}
          >
            {row.name}
          </div>
        ))}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
      >
        <div style={{ width: timelineContentWidth(scale) }}>
          <Play3dTickRow
            ticks={ticks}
            axisMs={axisMs}
            className={TICK_ROW_CLASS}
          />
          {equipment.map((row) => (
            // overflow-hidden 필수 — 축 끝의 표식이 scrollWidth 를 넓혀 확대가 없을 때도
            // 가로 스크롤바를 만든다.
            <div
              key={row.modelId}
              className="bg-foreground/10 relative h-5 cursor-pointer overflow-hidden"
              onClick={handleClick}
            >
              {/* 검사된 구간은 밝게 — 그 밖(감지가 없었던 곳)은 트랙 바탕색 그대로. */}
              {scanned.map((s, i) => (
                <span
                  key={i}
                  className="bg-background/80 absolute inset-y-0"
                  style={bandStyle(s.fromMs, s.toMs, axisMs)}
                />
              ))}
              {row.status.map((mark) => (
                <TooltipTrigger
                  key={mark.key}
                  handle={hover}
                  payload={mark.payload}
                  delay={0}
                  render={<span />}
                  className="absolute top-1 bottom-1"
                  style={{
                    ...bandStyle(mark.band.fromMs, mark.band.toMs, axisMs),
                    background:
                      PLAY3D_STATUS_FILL[mark.band.status] ?? undefined,
                  }}
                />
              ))}
              {row.zones.map((mark) => (
                <TooltipTrigger
                  key={mark.key}
                  handle={hover}
                  payload={mark.payload}
                  delay={0}
                  render={<span />}
                  className={cn(
                    'absolute top-0.5 bottom-0.5 min-w-1.5',
                    PLAY3D_DWELL_BOX_CLASS,
                    PLAY3D_DWELL_TONE[mark.band.level],
                    mark.band.open && '[border-right-style:dashed]',
                  )}
                  style={{
                    ...bandStyle(mark.band.fromMs, mark.band.toMs, axisMs),
                    backgroundImage: PLAY3D_DWELL_HATCH,
                  }}
                />
              ))}
              {row.collisions.map((mark) => (
                <TooltipTrigger
                  key={mark.key}
                  handle={hover}
                  payload={mark.payload}
                  delay={0}
                  render={<span />}
                  className="absolute inset-y-0"
                  style={lineHitStyle(markerPercent(mark.event.atMs, axisMs))}
                >
                  <span
                    className="absolute inset-y-0 w-0.5 bg-red-500"
                    style={{ left: LINE_INSET_PX }}
                  />
                </TooltipTrigger>
              ))}
              {/* pointer-events-none — 최신 충돌 선 위에 놓여 hover 를 가로채지 않게. */}
              <span
                aria-hidden
                className="bg-foreground/50 pointer-events-none absolute inset-y-0 w-px"
                style={{ left: `min(${cursor}%, calc(100% - 1px))` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function bandStyle(fromMs: number, toMs: number, axisMs: number) {
  const { left, width } = bandPercent(fromMs, toMs, axisMs);
  return { left: `${left}%`, width: `${width}%` };
}

/**
 * 세로 선의 hover 영역 — 선(2px)보다 넓게 잡아 올리기 쉽게 하고, 축 양 끝에서는
 * 트랙 안쪽으로 밀어 overflow-hidden 에 잘리지 않게 한다.
 */
function lineHitStyle(percent: number) {
  return {
    width: LINE_HIT_PX,
    left: `clamp(0px, calc(${percent}% - ${LINE_INSET_PX}px), calc(100% - ${LINE_HIT_PX}px))`,
  };
}
