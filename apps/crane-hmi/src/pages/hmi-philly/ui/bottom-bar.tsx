import type { CSSProperties } from 'react';
import { usePhillyTheme } from './theme';
import type { PhillyTheme } from './theme';

function buttonStyle(t: PhillyTheme): CSSProperties {
  return {
    height: 54,
    padding: '0 30px',
    fontSize: 18,
    fontWeight: 600,
    color: t.textSub,
    background: t.buttonBg,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

/** 하단 바 — System / Free Slew 토글 / Settings */
export function BottomBar({
  freeSlew,
  onToggleFreeSlew,
}: {
  freeSlew: boolean;
  onToggleFreeSlew: () => void;
}) {
  const t = usePhillyTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <button type="button" style={buttonStyle(t)}>
        System
      </button>
      <button
        type="button"
        onClick={onToggleFreeSlew}
        style={{
          ...buttonStyle(t),
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: t.greenText,
          background: t.greenBg,
          border: `1px solid ${t.greenBg}`,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: t.greenDot,
            flexShrink: 0,
          }}
        />
        Free Slew {freeSlew ? 'ON' : 'OFF'}
      </button>
      <span style={{ flex: 1 }} />
      <button type="button" style={buttonStyle(t)}>
        Settings
      </button>
    </div>
  );
}
