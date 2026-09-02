import type { CSSProperties, ReactNode } from 'react';

/** 공통 모달 프레임 — 오버레이 + 헤더(제목·부제·닫기) */
export function Modal({
  onClose,
  title,
  sub,
  width,
  panelStyle,
  children,
}: {
  onClose: () => void;
  title: string;
  sub?: string;
  width: number;
  /** WO 목록처럼 고정 높이 flex 레이아웃이 필요할 때 패널에 병합 */
  panelStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(30,39,51,.55)',
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width,
          maxWidth: '94vw',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.32)',
          zIndex: 41,
          overflow: 'hidden',
          ...panelStyle,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flex: 'none',
            padding: '14px 18px',
            background: '#F3F1EA',
            borderBottom: '1px solid #DDD8C8',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: '#28354A',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </span>
            {sub && (
              <span
                style={{ fontSize: 13, color: '#8A93A6', whiteSpace: 'nowrap' }}
              >
                {sub}
              </span>
            )}
          </div>
          <div
            onClick={onClose}
            style={{
              flex: 'none',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              fontSize: 19,
              fontWeight: 800,
              color: '#5C6678',
              cursor: 'pointer',
            }}
          >
            ✕
          </div>
        </div>
        {children}
      </div>
    </>
  );
}
