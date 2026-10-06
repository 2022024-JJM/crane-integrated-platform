/**
 * 사이드바가 레일(인라인)로 서는 최소 폭.
 *
 * 기본은 lg(1024px) — 그보다 좁으면 오버레이 드로어가 되고 접힘 = 숨김이다.
 * Indoorshop.OT 는 현장 모니터·분할 창에서 좁게 띄워도 대시보드 배치가 그대로 서야
 * 하므로 md(768px)까지 레일을 남긴다(본문 쪽 고정 레이아웃도 같은 md 선을 쓴다).
 */
export function sidebarRailMinWidth(role: string | undefined): number {
  return role === 'indoorshop-ot' ? 768 : 1024;
}
