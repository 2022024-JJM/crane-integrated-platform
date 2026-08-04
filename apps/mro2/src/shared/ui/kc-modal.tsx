import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { KC } from './kc';

/**
 * KC 모달 셸 — 백드롭 + fade/scale 진입 애니메이션 + ESC 닫기.
 * ESC 는 최상위 레이어(이 모달)가 처리한다 — 아래 깔린 패널의 ESC 핸들러는
 * 모달 열림 여부를 가드해 위임할 것.
 *
 * body 로 포털 렌더한다 — transform 이 걸린 조상(슬라이드 패널 등) 안에서 열면
 * fixed 가 그 조상 기준이 되어 화면 중앙이 아닌 패널 중앙에 뜨기 때문.
 */
export function KcModal({
  onClose,
  children,
  maxWidth = 440,
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="mro2-root fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        style={{ background: 'rgba(0,0,0,0.45)', opacity: show ? 1 : 0, transition: 'opacity 180ms ease-out' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full overflow-hidden rounded-[6px] shadow-2xl"
        style={{
          maxWidth,
          background: KC.bg,
          border: `1px solid ${KC.border}`,
          opacity: show ? 1 : 0,
          transform: show ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
