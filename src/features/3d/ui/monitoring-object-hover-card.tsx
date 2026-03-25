import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedModelInfo } from '@/entities/3d';
import type { ScreenPosition } from '../model/types';

interface MonitoringObjectHoverCardProps {
  model: SavedModelInfo;
  position: ScreenPosition;
  containerSize: {
    width: number;
    height: number;
  };
}

const DEFAULT_CARD_WIDTH = 220;
const DEFAULT_CARD_HEIGHT = 156;
const CARD_OFFSET = 12;
const VIEWER_EDGE_PADDING = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function humanizeModelPath(path: string) {
  const fileName = path.split('/').pop() ?? path;
  const stem = fileName.replace(/\.glb$/i, '');

  return stem
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatTuple(values: [number, number, number]) {
  return values.map((value) => value.toFixed(1)).join(' / ');
}

export function MonitoringObjectHoverCard({
  model,
  position,
  containerSize,
}: MonitoringObjectHoverCardProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardSize, setCardSize] = useState({
    width: DEFAULT_CARD_WIDTH,
    height: DEFAULT_CARD_HEIGHT,
  });
  useLayoutEffect(() => {
    const nextWidth = cardRef.current?.offsetWidth ?? DEFAULT_CARD_WIDTH;
    const nextHeight = cardRef.current?.offsetHeight ?? DEFAULT_CARD_HEIGHT;

    setCardSize((current) => {
      if (current.width === nextWidth && current.height === nextHeight) {
        return current;
      }

      return {
        width: nextWidth,
        height: nextHeight,
      };
    });
  }, [model.id]);
  const shouldPlaceLeft =
    position.x > containerSize.width * 0.68 ||
    position.x + CARD_OFFSET + cardSize.width >
      containerSize.width - VIEWER_EDGE_PADDING;
  const shouldPlaceAbove =
    position.y > containerSize.height * 0.55 ||
    position.y + CARD_OFFSET + cardSize.height >
      containerSize.height - VIEWER_EDGE_PADDING;
  const preferredLeft = shouldPlaceLeft
    ? position.x - cardSize.width - CARD_OFFSET
    : position.x + CARD_OFFSET;
  const preferredTop = shouldPlaceAbove
    ? position.y - cardSize.height - CARD_OFFSET
    : position.y + CARD_OFFSET;
  const left = clamp(
    preferredLeft,
    VIEWER_EDGE_PADDING,
    Math.max(
      VIEWER_EDGE_PADDING,
      containerSize.width - cardSize.width - VIEWER_EDGE_PADDING,
    ),
  );
  const top = clamp(
    preferredTop,
    VIEWER_EDGE_PADDING,
    Math.max(
      VIEWER_EDGE_PADDING,
      containerSize.height - cardSize.height - VIEWER_EDGE_PADDING,
    ),
  );
  const displayName = model.equipName.trim() || model.id;
  const modelType = humanizeModelPath(model.path);

  return (
    <div
      ref={cardRef}
      className="absolute"
      style={{
        left,
        top,
      }}
    >
      <div className="relative w-[220px] overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950/94 p-3 shadow-[0_16px_40px_rgba(2,6,23,0.46)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-12 bg-linear-to-b from-cyan-400/12 via-sky-400/6 to-transparent" />

        <div className="relative border-b border-white/8 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-medium tracking-[0.2em] text-cyan-200/80 uppercase">
                {t('monitoring:hover.model')}
              </p>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-white">
                {displayName}
              </p>
            </div>

            <div className="shrink-0 rounded-full border border-white/10 bg-white/6 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.14em] text-slate-200 uppercase">
              GLB
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-medium text-cyan-100">
              {modelType}
            </span>
          </div>
        </div>

        <div className="relative mt-2.5 grid gap-1.5">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">
              {t('monitoring:inspector.position')}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-100">
              {formatTuple(model.position)}
            </p>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">
              {t('monitoring:inspector.rotation')}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-100">
              {formatTuple(model.rotation)}
            </p>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
            <p className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">
              {t('monitoring:inspector.scale')}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-100">
              {formatTuple(model.scale)}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
