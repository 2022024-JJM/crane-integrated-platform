import type { CSSProperties } from 'react';
import type { MasterKind } from '../model/types';
import { useHmiTheme } from './theme';
import type { HmiTheme, HmiThemeName } from './theme';

const buttonStyle = (theme: HmiTheme): CSSProperties => ({
  background: theme.button.bg,
  borderTop: theme.button.borderTop,
  borderLeft: theme.button.borderTop,
  borderRight: theme.button.borderBottom,
  borderBottom: theme.button.borderBottom,
  borderRadius: theme.button.radius,
  color: theme.button.text,
  fontSize: 18,
  fontWeight: 700,
  padding: '9px 20px',
  cursor: 'pointer',
  letterSpacing: 1,
});

interface BottomBarProps {
  onSystemClick: () => void;
  onSettingsClick: () => void;
  freeSlew: boolean;
  onToggleFreeSlew: () => void;
  showFreeSlew?: boolean;
  masterKind: MasterKind;
  onCycleMasterKind: () => void;
  showMasterKind?: boolean;
  themeName: HmiThemeName;
  onToggleTheme: () => void;
}

/** 하측 메뉴 바 — 시스템 화면 / 자유 선회(2.6) / 데모 컨트롤 / 장비 설정 */
export function BottomBar({
  onSystemClick,
  onSettingsClick,
  freeSlew,
  onToggleFreeSlew,
  showFreeSlew = true,
  masterKind,
  onCycleMasterKind,
  showMasterKind = true,
  themeName,
  onToggleTheme,
}: BottomBarProps) {
  const theme = useHmiTheme();
  const base = buttonStyle(theme);
  const demoStyle: CSSProperties = {
    ...base,
    fontSize: 14,
    padding: '8px 12px',
    color: theme.titleBar.screenName,
  };

  return (
    <div
      style={{
        height: 54,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        background: theme.titleBar.bg,
        borderTop: theme.titleBar.border,
      }}
    >
      <button type="button" style={base} onClick={onSystemClick}>
        시스템 화면
      </button>
      {showFreeSlew && (
        <button
          type="button"
          className={freeSlew ? 'hmi-pulse' : undefined}
          style={{
            ...base,
            background: theme.freeSlew.bg,
            color: theme.freeSlew.text,
            fontWeight: 800,
            borderTop: theme.freeSlew.border,
            borderLeft: theme.freeSlew.border,
            borderRight: theme.freeSlew.border,
            borderBottom: theme.freeSlew.border,
          }}
          onClick={onToggleFreeSlew}
        >
          자유 선회 {freeSlew ? 'ON' : 'OFF'}
        </button>
      )}
      {showMasterKind && (
        <button type="button" style={demoStyle} onClick={onCycleMasterKind}>
          마스터: {masterKind} (데모)
        </button>
      )}
      <button
        type="button"
        style={{ ...demoStyle, marginLeft: 'auto' }}
        onClick={onToggleTheme}
      >
        디자인: {themeName === 'modern' ? '모던' : '클래식'}
      </button>
      <button type="button" style={base} onClick={onSettingsClick}>
        장비 설정
      </button>
    </div>
  );
}
