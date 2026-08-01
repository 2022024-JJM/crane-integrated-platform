import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TicketKind = 'repair' | 'inspection' | 'parts';

const KINDS: TicketKind[] = ['repair', 'inspection', 'parts'];

/**
 * 서비스 요청(WO) 생성 모달의 열림/프리필을 URL 쿼리로 관리하는 단일 소스.
 * `?new=<kind>` 로 열고 `&nc=<craneId>` 로 자산을 프리필한다.
 * 어느 페이지의 버튼이든 이 훅으로 열면 레이아웃에 마운트된 모달이 반응한다.
 */
export function useNewTicket() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('new');
  const kind: TicketKind | null =
    raw && KINDS.includes(raw as TicketKind) ? (raw as TicketKind) : raw ? 'repair' : null;
  const craneId = params.get('nc');

  const openTicket = useCallback(
    (nextKind: TicketKind = 'repair', prefillCraneId?: string) => {
      const next = new URLSearchParams(params);
      next.set('new', nextKind);
      if (prefillCraneId) next.set('nc', prefillCraneId);
      else next.delete('nc');
      setParams(next);
    },
    [params, setParams],
  );

  const closeTicket = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('new');
    next.delete('nc');
    setParams(next);
  }, [params, setParams]);

  return { isOpen: kind !== null, kind: kind ?? 'repair', craneId, openTicket, closeTicket };
}
