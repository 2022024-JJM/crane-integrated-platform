import type { CSSProperties, ReactNode } from 'react';
import type {
  ArrowDir,
  AxisMeta,
  CollisionAxisInfo,
  HmiSnapshot,
} from '../model/types';
import { MASTER_AXES } from '../model/types';
import { IdleAxisArrows, MotionArrow } from './arrows';
import { useHmiTheme } from './theme';
import type { HmiTheme } from './theme';

const rowContent: CSSProperties = {
  flex: 1,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
};

const centerAbsolute: CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
};

const labelCellStyle = (theme: HmiTheme): CSSProperties => ({
  width: 66,
  flexShrink: 0,
  background: theme.row.labelBg,
  borderRight: theme.row.labelBorder,
  color: theme.row.labelText,
  fontSize: 19,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const rowBaseStyle = (theme: HmiTheme): CSSProperties => ({
  display: 'flex',
  alignItems: 'stretch',
  borderTop: theme.row.border,
  flex: 1,
  minHeight: 0,
});

const panelStyle = (
  theme: HmiTheme,
  border: string,
  flex: number,
): CSSProperties => ({
  border,
  background: theme.panel.bg,
  borderRadius: theme.panel.radius,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  flex,
  minHeight: 0,
});

const headerBoxStyle = (
  theme: HmiTheme,
  fontSize: number,
  letterSpacing: number,
): CSSProperties => ({
  border: theme.panel.headerBorder,
  background: theme.panel.headerBg,
  borderRadius: Math.max(0, theme.panel.radius - 4),
  textAlign: 'center',
  color: theme.panel.headerText,
  fontSize,
  fontWeight: 800,
  letterSpacing,
});

interface StatusRowProps {
  label: string;
  arrows?: ReactNode;
  value: string;
  unit: string;
  moving?: boolean;
}

function StatusRow({
  label,
  arrows,
  value,
  unit,
  moving = false,
}: StatusRowProps) {
  const theme = useHmiTheme();
  return (
    <div style={rowBaseStyle(theme)}>
      <div style={labelCellStyle(theme)}>{label}</div>
      <div style={rowContent}>
        {arrows && <span style={centerAbsolute}>{arrows}</span>}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'baseline',
            gap: 5,
          }}
        >
          <span
            style={{
              width: 102,
              textAlign: 'right',
              fontSize: 28,
              fontWeight: 700,
              fontFamily: theme.valueFont,
              color: moving ? theme.text.valueMoving : theme.text.value,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 0.25s',
            }}
          >
            {value}
          </span>
          <span
            style={{
              width: 18,
              fontSize: 14,
              fontWeight: 700,
              color: theme.text.unit,
            }}
          >
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 우측 상단 — Master Crane 번호 및 종류별 동작상태 (매뉴얼 2.2 ⓑ) */
export function MasterPanel({ snap }: { snap: HmiSnapshot }) {
  const theme = useHmiTheme();
  const m = snap.master;
  const pair = (a: ArrowDir, b: ArrowDir, moving: boolean, dir: ArrowDir) => (
    <span style={{ display: 'flex', gap: 6 }}>
      <MotionArrow dir={a} active={moving && dir === a} />
      <MotionArrow dir={b} active={moving && dir === b} />
    </span>
  );

  return (
    <div style={panelStyle(theme, theme.panel.masterBorder, 11)}>
      <div style={{ padding: 5 }}>
        <div style={{ ...headerBoxStyle(theme, 31, 2), padding: '7px 0' }}>
          {m.id}
        </div>
      </div>
      <StatusRow label="하중" value={m.load.toFixed(1)} unit="t" />
      {MASTER_AXES[m.kind].map((meta, i) => {
        const st = m.status[i];
        return (
          <StatusRow
            key={meta.key}
            label={meta.label}
            arrows={pair(meta.arrows[0], meta.arrows[1], st.moving, st.dir)}
            value={st.value.toFixed(1)}
            unit={meta.unit}
            moving={st.moving}
          />
        );
      })}
    </div>
  );
}

function CollisionRow({
  meta,
  info,
}: {
  meta: AxisMeta;
  info: CollisionAxisInfo;
}) {
  const theme = useHmiTheme();
  const horizontal = meta.arrows[0] === 'left';
  const alarm = info.zone !== 'none';
  const color =
    info.zone === 'stop' ? theme.alarm.stopText : theme.alarm.warnText;

  return (
    <div style={rowBaseStyle(theme)}>
      <div style={labelCellStyle(theme)}>{meta.label}</div>
      <div style={rowContent}>
        {info.targetId ? (
          <>
            <span
              style={{
                color: alarm ? color : theme.text.value,
                fontSize: 18,
                fontWeight: 800,
                transition: 'color 0.25s',
              }}
            >
              {info.targetId}
            </span>
            <span style={centerAbsolute}>
              {alarm ? (
                <MotionArrow
                  dir={info.direction ?? 'down'}
                  active
                  activeColor={color}
                  size={24}
                />
              ) : (
                <IdleAxisArrows horizontal={horizontal} />
              )}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                width: 104,
                textAlign: 'right',
                color: alarm ? color : theme.text.value,
                fontSize: 26,
                fontWeight: 700,
                fontFamily: theme.valueFont,
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 0.25s',
              }}
            >
              {info.distance?.toFixed(1)}m
            </span>
          </>
        ) : (
          <span style={centerAbsolute}>
            <IdleAxisArrows horizontal={horizontal} />
          </span>
        )}
      </div>
    </div>
  );
}

/** 우측 하단 — 충돌 정보 (매뉴얼 2.3 ⓒ). 무알람이어도 표시 범위 내 최근접 대상은 흰색으로 표시 */
export function CollisionPanel({ snap }: { snap: HmiSnapshot }) {
  const theme = useHmiTheme();
  return (
    <div style={panelStyle(theme, theme.panel.border, 9)}>
      <div style={{ padding: 5 }}>
        <div style={{ ...headerBoxStyle(theme, 25, 6), padding: '5px 0' }}>
          충돌 정보
        </div>
      </div>
      {MASTER_AXES[snap.master.kind].map((meta, i) => (
        <CollisionRow key={meta.key} meta={meta} info={snap.axes[i]} />
      ))}
    </div>
  );
}
