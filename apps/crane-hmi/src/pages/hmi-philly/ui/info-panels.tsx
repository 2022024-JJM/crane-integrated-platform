import type { CSSProperties, ReactNode } from 'react';
import type { AxisState, PhillySnapshot } from '../model/types';
import { ArrowIcon } from './arrows';
import { usePhillyTheme } from './theme';
import type { PhillyTheme } from './theme';

function panelStyle(t: PhillyTheme): CSSProperties {
  return {
    background: t.panelBg,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    padding: '18px 22px',
  };
}

function captionStyle(t: PhillyTheme): CSSProperties {
  return {
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: 0.8,
    color: t.caption,
  };
}

function formatValue(v: number) {
  return v.toFixed(1);
}

/** MY CRANE — 크레인 번호 + 하중 */
export function MyCranePanel({ snap }: { snap: PhillySnapshot }) {
  const t = usePhillyTheme();
  return (
    <div style={panelStyle(t)}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={captionStyle(t)}>MY CRANE</span>
        <span style={captionStyle(t)}>LOAD</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginTop: 6,
        }}
      >
        <span style={{ fontSize: 38, fontWeight: 700, color: t.text }}>
          LLC-01
        </span>
        <span>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: t.text,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatValue(snap.load)}
          </span>
          <span style={{ fontSize: 18, color: t.caption, marginLeft: 7 }}>
            t
          </span>
        </span>
      </div>
    </div>
  );
}

/** 축 방향 화살표 쌍 — 이동 중인 방향만 파란색 */
function AxisArrows({
  orientation,
  dir,
}: {
  orientation: 'vertical' | 'horizontal';
  dir: number;
}) {
  const t = usePhillyTheme();
  const active = t.arrowActive;
  const idle = t.arrowIdle;
  if (orientation === 'horizontal') {
    // 선회: 증가(CCW) = 좌측 화살표
    return (
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <ArrowIcon direction="left" color={dir > 0 ? active : idle} />
        <ArrowIcon direction="right" color={dir < 0 ? active : idle} />
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <ArrowIcon direction="up" color={dir > 0 ? active : idle} />
      <ArrowIcon direction="down" color={dir < 0 ? active : idle} />
    </span>
  );
}

function AxisRow({
  label,
  axis,
  unit,
  orientation,
  divider = true,
}: {
  label: string;
  axis: AxisState;
  unit: string;
  orientation: 'vertical' | 'horizontal';
  divider?: boolean;
}) {
  const t = usePhillyTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '13px 0',
        borderBottom: divider ? `1px solid ${t.border}` : 'none',
      }}
    >
      <span
        style={{ fontSize: 24, fontWeight: 600, color: t.text, width: 132 }}
      >
        {label}
      </span>
      <AxisArrows orientation={orientation} dir={axis.dir} />
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: t.text,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatValue(axis.value)}
      </span>
      <span
        style={{
          fontSize: 18,
          color: t.caption,
          width: 26,
          textAlign: 'right',
        }}
      >
        {unit}
      </span>
    </div>
  );
}

/** Axis status — MY CRANE 3축 동작 상태 */
export function AxisStatusPanel({ snap }: { snap: PhillySnapshot }) {
  const t = usePhillyTheme();
  return (
    <div style={panelStyle(t)}>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: t.text,
          paddingBottom: 12,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        Axis status
      </div>
      <AxisRow
        label="Luffing"
        axis={snap.myCrane.luffing}
        unit="°"
        orientation="vertical"
      />
      <AxisRow
        label="Slewing"
        axis={snap.myCrane.slewing}
        unit="°"
        orientation="horizontal"
      />
      <AxisRow
        label="Travel"
        axis={snap.myCrane.travel}
        unit="m"
        orientation="vertical"
        divider={false}
      />
    </div>
  );
}

function ClearanceRow({
  label,
  orientation,
  dir,
  target,
  value,
  unit,
  tone,
}: {
  label: string;
  orientation: 'vertical' | 'horizontal';
  dir: number;
  target: ReactNode;
  value: ReactNode;
  unit?: string;
  tone: 'red' | 'orange' | 'none';
}) {
  const t = usePhillyTheme();
  const toneColor =
    tone === 'red' ? t.red : tone === 'orange' ? t.orange : t.caption;
  const toneBg =
    tone === 'red' ? t.redBg : tone === 'orange' ? t.orangeBg : t.panelBg;
  const toneBorder = tone === 'none' ? t.border : toneColor;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: `2px solid ${toneBorder}`,
        borderRadius: 8,
        background: toneBg,
        padding: '15px 18px',
        marginTop: 12,
      }}
    >
      <span
        style={{ fontSize: 24, fontWeight: 600, color: t.text, width: 126 }}
      >
        {label}
      </span>
      <AxisArrows orientation={orientation} dir={dir} />
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 24, fontWeight: 700, color: toneColor }}>
        {target}
      </span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: toneColor,
          width: 104,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 18,
          color: t.caption,
          width: 26,
          textAlign: 'right',
        }}
      >
        {unit ?? ''}
      </span>
    </div>
  );
}

/** Collision clearance — 축별 근접 대상 크레인 + 경고 단계 */
export function CollisionClearancePanel({ snap }: { snap: PhillySnapshot }) {
  const t = usePhillyTheme();
  return (
    <div style={panelStyle(t)}>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>
        Collision clearance
      </div>
      <ClearanceRow
        label="Luffing"
        orientation="vertical"
        dir={snap.myCrane.luffing.dir}
        target="LLC-01"
        value={formatValue(snap.myCrane.luffing.value)}
        tone="red"
      />
      <ClearanceRow
        label="Slewing"
        orientation="horizontal"
        dir={snap.myCrane.slewing.dir}
        target="GC-01"
        value={formatValue(snap.myCrane.slewing.value)}
        tone="orange"
      />
      <ClearanceRow
        label="Travel"
        orientation="vertical"
        dir={0}
        target="-"
        value="-"
        unit="m"
        tone="none"
      />
    </div>
  );
}
