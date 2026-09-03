/*
 * 상태 UX 3종 — 로딩(뼈대) · 빈 상태 · 실패.
 *
 * 화면마다 "불러오는 중…"·"데이터 없음"을 다른 문구, 다른 여백, 다른 색으로 적어 두면
 * 사용자는 그것이 같은 상태인지 매번 다시 읽어야 한다. 세 상태의 **생김새와 낱말을
 * 여기 한 곳**에 두고, 화면은 자기 사정(원인·행동·마지막 성공 시각)만 얹는다.
 *
 * ── 데이터 훅과의 계약 ──────────────────────────────────────────────
 * 이 컴포넌트들은 훅을 알지 못한다. 비동기 훅이 내주는 세 채널을 **props 로** 받는다:
 *
 *   loading  → 뼈대를 그린다 (`CardSkeleton` / `ListSkeleton` / `MapPanelSkeleton`)
 *   error    → `ErrorState error={error} onRetry={…} lastSuccessAt={…}`
 *              `error` 는 `Error | null` 이다 — 문자열이나 unknown 을 그대로 넘기지 않는다.
 *              `onRetry` 는 **같은 요청을 다시 거는** 함수여야 한다(화면 새로고침이 아니라).
 *   data 가 비었을 때 → `EmptyState reason={…}`
 *
 * 셋의 우선순위도 정해 둔다: **실패 > 로딩 > 빈 상태**. 실패한 뒤에도 재시도가 돌고
 * 있다는 이유로 뼈대를 세우면, 방금 실패했다는 사실이 화면에서 사라진다.
 * ────────────────────────────────────────────────────────────────
 */

export { SkeletonBlock, CardSkeleton, ListSkeleton, MapPanelSkeleton, type StateTone } from './Skeleton'
export { EmptyState, BatchPendingState, type EmptyReason, type EmptyStateProps } from './EmptyState'
export { ErrorState, type ErrorStateProps } from './ErrorState'
