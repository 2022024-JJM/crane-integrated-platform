import type { CSSProperties } from 'react';
import { useHmiTheme } from './theme';

interface TitleBarProps {
  clock: string;
  /** 현재 화면 이름 (매뉴얼 2.1 ⓐ — 타이틀 바 중간은 현재 화면명) */
  screenName: string;
  controlOn: boolean;
  bypassOn: boolean;
  commError: boolean;
  onToggleControl: () => void;
  onToggleBypass: () => void;
  onToggleComm: () => void;
  showIcons?: boolean;
}

const iconBox = (activeBg: string | null, radius: number): CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: Math.max(7, radius),
  border: '1px solid #6a6a6a44',
  background: activeBg ?? '#ffffff0a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.2s',
});

/** 상단 타이틀 바 — 좌: 모드 상태 아이콘 / 중: 충돌 방지 시스템 + 화면명 / 우: 현재 시각 */
export function TitleBar({
  clock,
  screenName,
  controlOn,
  bypassOn,
  commError,
  onToggleControl,
  onToggleBypass,
  onToggleComm,
  showIcons = true,
}: TitleBarProps) {
  const theme = useHmiTheme();
  return (
    <div
      style={{
        height: 50,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        background: theme.titleBar.bg,
        borderBottom: theme.titleBar.border,
        position: 'relative',
      }}
    >
      {showIcons && (
        <div style={{ display: 'flex', gap: 6 }}>
          {/* 컨트롤 온/오프 */}
          <button
            type="button"
            style={iconBox(controlOn ? '#13a313' : null, theme.button.radius)}
            onClick={onToggleControl}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="13"
                r="7"
                fill="none"
                stroke={controlOn ? '#eaffea' : '#9a9a9a'}
                strokeWidth="2"
              />
              <line
                x1="12"
                y1="3"
                x2="12"
                y2="11"
                stroke={controlOn ? '#eaffea' : '#9a9a9a'}
                strokeWidth="2.4"
              />
            </svg>
          </button>
          {/* 충돌 방지 바이패스 */}
          <button
            type="button"
            style={iconBox(bypassOn ? '#cf1414' : null, theme.button.radius)}
            onClick={onToggleBypass}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <circle
                cx="8"
                cy="12"
                r="4.4"
                fill="none"
                stroke={bypassOn ? '#ffecec' : '#9a9a9a'}
                strokeWidth="2.2"
              />
              <line
                x1="12.4"
                y1="12"
                x2="21"
                y2="12"
                stroke={bypassOn ? '#ffecec' : '#9a9a9a'}
                strokeWidth="2.6"
              />
              <line
                x1="18"
                y1="12"
                x2="18"
                y2="16"
                stroke={bypassOn ? '#ffecec' : '#9a9a9a'}
                strokeWidth="2.6"
              />
            </svg>
          </button>
          {/* PLC-HMI 통신오류 */}
          <button
            type="button"
            style={iconBox(commError ? '#e8b400' : null, theme.button.radius)}
            onClick={onToggleComm}
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <polygon
                points="12,3 22,20 2,20"
                fill="none"
                stroke={commError ? '#1a1a1a' : '#9a9a9a'}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <line
                x1="12"
                y1="9"
                x2="12"
                y2="14.5"
                stroke={commError ? '#1a1a1a' : '#9a9a9a'}
                strokeWidth="2.2"
              />
              <circle
                cx="12"
                cy="17.4"
                r="1.2"
                fill={commError ? '#1a1a1a' : '#9a9a9a'}
              />
            </svg>
          </button>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            color: theme.titleBar.brand,
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: 1,
            fontFamily: "'Arial Black', 'Pretendard', sans-serif",
          }}
        >
          Hanwha
        </span>
        <span
          style={{
            color: theme.titleBar.title,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 4,
          }}
        >
          충돌 방지 시스템
        </span>
        <span
          style={{
            color: theme.titleBar.screenName,
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {screenName}
        </span>
      </div>

      <span
        style={{
          marginLeft: 'auto',
          color: theme.titleBar.clock,
          fontSize: 16,
          fontWeight: 600,
          fontFamily: theme.valueFont,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {clock}
      </span>
    </div>
  );
}
