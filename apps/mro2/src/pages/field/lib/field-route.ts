/**
 * 현장 모드(`/mro2/field/*`)의 서브라우트 — 저장소 규약대로 `<Route>` 가 아니라
 * 페이지 안에서 `useParams()['*']` 를 보고 가른다.
 *
 * - ``            → 홈(등록 버튼·최근 자산·내 티켓 요약)
 * - `new/<kind>`  → 단계형 등록(고장 신고 repair · 부품 요청 parts · 점검 결과 inspection)
 * - `tickets`     → 내가 올린 티켓
 */
export const FIELD_KINDS = ['repair', 'parts', 'inspection'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export function isFieldKind(value: unknown): value is FieldKind {
  return (FIELD_KINDS as readonly string[]).includes(value as string);
}

export type FieldView =
  | { view: 'home' }
  | { view: 'new'; kind: FieldKind }
  | { view: 'tickets' }
  | { view: 'ticket'; kind: FieldKind; id: string }
  | { view: 'emergency' };

/** splat → 뷰. 모르는 경로는 홈으로(잘못된 딥링크가 빈 화면이 되지 않게). */
export function matchFieldSubRoute(splat: string | undefined): FieldView {
  const parts = (splat ?? '').split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'home' };
  if (parts[0] === 'emergency') return { view: 'emergency' };
  if (parts[0] === 'tickets') {
    if (isFieldKind(parts[1]) && parts[2]) {
      return { view: 'ticket', kind: parts[1], id: parts[2] };
    }
    return { view: 'tickets' };
  }
  if (parts[0] === 'new' && isFieldKind(parts[1])) {
    return { view: 'new', kind: parts[1] };
  }
  return { view: 'home' };
}

export const FIELD_PATH = '/mro2/field';
export const FIELD_EMERGENCY_PATH = `${FIELD_PATH}/emergency`;
export function fieldTicketPath(kind: FieldKind, id: string): string {
  return `${FIELD_PATH}/tickets/${kind}/${encodeURIComponent(id)}`;
}
export function fieldNewPath(kind: FieldKind, assetId?: string): string {
  const base = `${FIELD_PATH}/new/${kind}`;
  return assetId ? `${base}?asset=${encodeURIComponent(assetId)}` : base;
}
