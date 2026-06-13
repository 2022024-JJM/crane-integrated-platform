import type { CSSProperties } from 'react';
import type { MasterKind } from '../model/types';

const buttonStyle: CSSProperties = {
  background: '#3a3a3a',
  borderTop: '1px solid #7a7a7a',
  borderLeft: '1px solid #7a7a7a',
  borderRight: '1px solid #151515',
  borderBottom: '1px solid #151515',
  color: '#e3e3e3',
  fontSize: 18,
  fontWeight: 700,
  padding: '9px 20px',
  cursor: 'pointer',
  letterSpacing: 1,
};

interface BottomBarProps {
  onSystemClick: () => void;
  onSettingsClick: () => void;
  freeSlew: boolean;
  onToggleFreeSlew: () => void;
  showFreeSlew?: boolean;
  masterKind: MasterKind;
  onCycleMasterKind: () => void;
  showMasterKind?: boolean;
}

/** 하측 메뉴 바 — 시스템 화면 / 자유 선회(2.6) / 장비 설정 */
export function BottomBar({
  onSystemClick,
  onSettingsClick,
  freeSlew,
  onToggleFreeSlew,
  showFreeSlew = true,
  masterKind,
  onCycleMasterKind,
  showMasterKind = true,
}: BottomBarProps) {
  return (
    <div
      style={{
        height: 54,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        background: '#0a0a0a',
        borderTop: '1px solid #2c2c2c',
      }}
    >
      <button type="button" style={buttonStyle} onClick={onSystemClick}>
        시스템 화면
      </button>
      {showFreeSlew && (
        <button
          type="button"
          className={freeSlew ? 'hmi-pulse' : undefined}
          style={{
            ...buttonStyle,
            background: '#52f23a',
            color: '#000',
            fontWeight: 800,
            borderTop: '1px solid #b8ffb0',
            borderLeft: '1px solid #b8ffb0',
          }}
          onClick={onToggleFreeSlew}
        >
          자유 선회 {freeSlew ? 'ON' : 'OFF'}
        </button>
      )}
      {showMasterKind && (
        <button
          type="button"
          style={{
            ...buttonStyle,
            fontSize: 14,
            padding: '8px 12px',
            color: '#9fb6bd',
          }}
          onClick={onCycleMasterKind}
        >
          마스터: {masterKind} (데모)
        </button>
      )}
      <button
        type="button"
        style={{ ...buttonStyle, marginLeft: 'auto' }}
        onClick={onSettingsClick}
      >
        장비 설정
      </button>
    </div>
  );
}
