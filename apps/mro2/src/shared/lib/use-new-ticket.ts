import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TicketKind = 'repair' | 'inspection' | 'parts';

const KINDS: TicketKind[] = ['repair', 'inspection', 'parts'];

/** 소견→수리 등 컨텍스트 프리필 payload (일회성 — 모달이 열릴 때 소비) */
export interface TicketPrefill {
  componentName?: string;
  failureDescription?: string;
  /** 원천 점검 WO 번호 — 설정 시 수리 sourceType 이 'inspection' 이 되어 리스크 해소 추적과 연결된다 */
  sourceWoNumber?: string;
  priority?: 'emergency' | 'high' | 'normal' | 'low';
}

// 모달 열림/닫힘은 URL 단일 소스, 프리필 상세는 URL 에 담기엔 길어 일회성 메모리로 전달한다.
// (딥링크로 직접 열면 프리필 없이 열림 — 의도된 동작)
let pendingPrefill: TicketPrefill | null = null;

export function consumeTicketPrefill(): TicketPrefill | null {
  const p = pendingPrefill;
  pendingPrefill = null;
  return p;
}

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
    (nextKind: TicketKind = 'repair', prefillCraneId?: string, prefill?: TicketPrefill) => {
      pendingPrefill = prefill ?? null;
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
