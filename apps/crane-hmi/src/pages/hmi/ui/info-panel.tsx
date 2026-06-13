import type { CSSProperties, ReactNode } from 'react';
import type {
  ArrowDir,
  AxisMeta,
  CollisionAxisInfo,
  HmiSnapshot,
} from '../model/types';
import { MASTER_AXES } from '../model/types';
import { IdleAxisArrows, MotionArrow } from './arrows';

const labelCell: CSSProperties = {
  width: 66,
  flexShrink: 0,
  background: '#262626',
  borderRight: '1px solid #4d4d4d',
  color: '#e9e9e9',
  fontSize: 19,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const rowBase: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  borderTop: '1px solid #4d4d4d',
  flex: 1,
  minHeight: 0,
};

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
  return (
    <div style={rowBase}>
      <div style={labelCell}>{label}</div>
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
              fontSize: 30,
              fontWeight: 800,
              color: moving ? '#35e83b' : '#fff',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
          <span
            style={{
              width: 18,
              fontSize: 15,
              fontWeight: 700,
              color: '#bdbdbd',
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
  const m = snap.master;
  const pair = (a: ArrowDir, b: ArrowDir, moving: boolean, dir: ArrowDir) => (
    <span style={{ display: 'flex', gap: 6 }}>
      <MotionArrow dir={a} active={moving && dir === a} />
      <MotionArrow dir={b} active={moving && dir === b} />
    </span>
  );

  return (
    <div
      style={{
        border: '2px solid #d40000',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        flex: 11,
        minHeight: 0,
      }}
    >
      <div style={{ padding: 5 }}>
        <div
          style={{
            border: '2px solid #e3e3e3',
            textAlign: 'center',
            padding: '7px 0',
            color: '#fff',
            fontSize: 31,
            fontWeight: 800,
            letterSpacing: 2,
          }}
        >
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
  const horizontal = meta.arrows[0] === 'left';
  const alarm = info.zone !== 'none';
  const color = info.zone === 'stop' ? '#ff2a2a' : '#ffe33c';

  return (
    <div style={rowBase}>
      <div style={labelCell}>{meta.label}</div>
      <div style={rowContent}>
        {info.targetId ? (
          <>
            <span
              style={{
                color: alarm ? color : '#fff',
                fontSize: 19,
                fontWeight: 800,
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
                color: alarm ? color : '#fff',
                fontSize: 28,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
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
  return (
    <div
      style={{
        border: '2px solid #bdbdbd',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        flex: 9,
        minHeight: 0,
      }}
    >
      <div style={{ padding: 5 }}>
        <div
          style={{
            border: '2px solid #e3e3e3',
            textAlign: 'center',
            padding: '5px 0',
            color: '#fff',
            fontSize: 25,
            fontWeight: 800,
            letterSpacing: 6,
          }}
        >
          충돌 정보
        </div>
      </div>
      {MASTER_AXES[snap.master.kind].map((meta, i) => (
        <CollisionRow key={meta.key} meta={meta} info={snap.axes[i]} />
      ))}
    </div>
  );
}
