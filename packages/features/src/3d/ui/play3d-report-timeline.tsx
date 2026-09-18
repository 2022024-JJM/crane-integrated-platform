import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import {
  PLAY3D_STATUS_FILL,
  TIMELINE_LABEL_REM,
  bandPercent,
  markerPercent,
  msAtFraction,
  timelineContentWidth,
  timelineCursorInView,
  timelineFollowScroll,
  timelineTickTimes,
  timelineTrackScale,
} from '../lib/play3d-format';
import type {
  Play3dEvent,
  ScannedInterval,
  StatusBand,
  ZoneBand,
} from '../lib/play3d-stats';
import { formatSimClock } from '../lib/sim-clock';

/**
 * 스윔레인 타임라인 — 첫 행은 사건(충돌·영역 진입을 같은 모양의 세로 선으로,
 * 영역은 그 체류 띠와 같은 등급 색), 그 아래 장비마다 한 행: 운전 상태 밴드 +
 * 그 장비가 영역에 머문 구간의 얇은 띠(아래쪽). 현재 위치 세로선, 클릭 =
 * seek(Foxglove State Transitions 방식). 검사되지 않은 구간은 배경 빗금이다.
 *
 * 축이 한 화면 분량(TIMELINE_FIT_MS)을 넘으면 트랙이 배율만큼 넓어지고 한
 * 스크롤 컨테이너가 세로·가로를 함께 맡는다 — 장비 이름 열은 sticky-left,
 * 눈금 행은 sticky-bottom. 밴드·배율·눈금·재생 위치 따라가기 판단은 전부
 * lib(play3d-stats·play3d-format)에 있고 여기서는 DOM 치수를 읽어 넘기고
 * 결과를 그리기만 한다.
 */

export interface TimelineEquipmentRow {
  modelId: string;
  name: string;
  bands: StatusBand[];
  /** 이 장비 행에 배정된 영역 체류 밴드. */
  zoneBands: ZoneBand[];
}

const LABEL_STYLE = { width: `${TIMELINE_LABEL_REM}rem` };

export function Play3dReportTimeline({
  axisMs,
  windowEndMs,
  isPlaying,
  scanned,
  collisions,
  zoneEnters,
  equipment,
  onSeek,
  className,
}: {
  axisMs: number;
  windowEndMs: number;
  /** 재생 중인지 — 재생 위치 따라가기 규칙이 갈린다. */
  isPlaying: boolean;
  scanned: readonly ScannedInterval[];
  collisions: readonly Play3dEvent[];
  zoneEnters: readonly Play3dEvent[];
  equipment: readonly TimelineEquipmentRow[];
  /** 축 위 클릭 → 그 씬 시간으로 이동. */
  onSeek: (atMs: number) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const cursor = markerPercent(windowEndMs, axisMs);
  const scale = timelineTrackScale(axisMs);
  const ticks = timelineTickTimes(axisMs);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
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
      labelPx: labelRef.current?.offsetWidth ?? 0,
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
      labelPx: labelRef.current?.offsetWidth ?? 0,
    });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    onSeek(msAtFraction((event.clientX - rect.left) / rect.width, axisMs));
  };

  const rows: { key: string; label: string; content: React.ReactNode }[] = [
    {
      key: '__events',
      label: t('monitoring:play3d.timeline.events'),
      content: (
        <>
          {zoneEnters.map((e) => (
            <span
              key={e.id}
              title={`${formatSimClock(e.atMs)} · ${e.label}`}
              className={cn(
                'absolute inset-y-0 w-0.5',
                e.level === 'stop' ? 'bg-red-500' : 'bg-amber-400',
              )}
              style={{ left: edgeLeft(markerPercent(e.atMs, axisMs), 2) }}
            />
          ))}
          {collisions.map((e) => (
            <span
              key={e.id}
              title={`${formatSimClock(e.atMs)} · ${e.label}`}
              className="absolute inset-y-0 w-0.5 bg-red-500"
              style={{ left: edgeLeft(markerPercent(e.atMs, axisMs), 2) }}
            />
          ))}
        </>
      ),
    },
    ...equipment.map((row) => ({
      key: row.modelId,
      label: row.name,
      content: (
        <>
          {row.bands.map((b, i) => {
            const fill = PLAY3D_STATUS_FILL[b.status];
            if (!fill) return null;
            return (
              <span
                key={`s${i}`}
                title={`${t(`monitoring:runtimeStatus.${b.status}`)} ${formatSimClock(b.fromMs)}~${formatSimClock(b.toMs)}`}
                className="absolute top-1 bottom-2"
                style={{
                  ...bandStyle(b.fromMs, b.toMs, axisMs),
                  background: fill,
                }}
              />
            );
          })}
          {row.zoneBands.map((b, i) => (
            <span
              key={`z${i}`}
              title={`${b.zoneName} ← ${b.intruderName} ${formatSimClock(b.fromMs)}~${formatSimClock(b.toMs)}`}
              className={cn(
                'absolute bottom-0.5 h-1 min-w-[2px]',
                b.level === 'stop' ? 'bg-red-500/90' : 'bg-amber-400/90',
                b.open && 'border-r border-dashed border-white/70',
              )}
              style={bandStyle(b.fromMs, b.toMs, axisMs)}
            />
          ))}
        </>
      ),
    })),
  ];

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn('max-h-48 overflow-auto overscroll-x-contain', className)}
    >
      {/* 이 래퍼와 행에는 overflow 를 두지 않는다 — sticky 의 기준이 스크롤러여야 한다. */}
      <div
        className="min-w-full"
        style={{ width: timelineContentWidth(scale, TIMELINE_LABEL_REM) }}
      >
        {rows.map((row) => (
          <div key={row.key} className="flex h-5">
            <span
              className="bg-background text-muted-foreground sticky left-0 z-10 shrink-0 truncate pr-1.5 text-[10px] leading-5"
              style={LABEL_STYLE}
              title={row.label}
            >
              {row.label}
            </span>
            {/* overflow-hidden 필수 — 100% 지점의 표식이 scrollWidth 를 넓혀 가짜 가로 스크롤바를 만든다. */}
            <div
              className="bg-muted/60 relative h-full min-w-0 flex-1 cursor-pointer overflow-hidden"
              onClick={handleClick}
            >
              {/* 검사된 구간 — 그 밖은 빗금(감지 없음). */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(120,120,120,0.18)_3px_4px)]" />
              {scanned.map((s, i) => (
                <span
                  key={i}
                  className="bg-background/70 absolute inset-y-0"
                  style={bandStyle(s.fromMs, s.toMs, axisMs)}
                />
              ))}
              {row.content}
              <span
                aria-hidden
                className="bg-foreground/50 absolute inset-y-0 w-px"
                style={{ left: edgeLeft(cursor, 1) }}
              />
            </div>
          </div>
        ))}
        <div className="bg-background sticky bottom-0 z-10 flex pt-0.5">
          <span
            ref={labelRef}
            className="bg-background sticky left-0 z-10 shrink-0"
            style={LABEL_STYLE}
          />
          <div className="text-muted-foreground relative h-3 min-w-0 flex-1 font-mono text-[9px] tabular-nums">
            {ticks.map((tick, i) => {
              const atStart = i === 0;
              const atEnd = tick >= axisMs;
              return (
                <span
                  key={tick}
                  className={cn(
                    'absolute top-0',
                    atStart && 'left-0',
                    atEnd && 'right-0',
                    !atStart && !atEnd && '-translate-x-1/2',
                  )}
                  style={
                    !atStart && !atEnd
                      ? { left: `${markerPercent(tick, axisMs)}%` }
                      : undefined
                  }
                >
                  {formatSimClock(tick)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function bandStyle(fromMs: number, toMs: number, axisMs: number) {
  const { left, width } = bandPercent(fromMs, toMs, axisMs);
  return { left: `${left}%`, width: `${width}%` };
}

/** 축 끝(100%)의 표식도 자기 폭만큼 안쪽에 그려 overflow-hidden 에 잘리지 않게 한다. */
function edgeLeft(percent: number, widthPx: number) {
  return `min(${percent}%, calc(100% - ${widthPx}px))`;
}
