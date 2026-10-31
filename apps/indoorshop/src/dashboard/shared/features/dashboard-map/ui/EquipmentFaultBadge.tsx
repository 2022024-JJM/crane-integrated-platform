/**
 * 설비 장애 표식 — 경고 삼각형 + 글자. 색만으로 뜻을 나르지 않도록 글자를 함께 둔다.
 *
 * 카드 머리('현황' 옆)와 베이 행이 같은 모양을 쓴다 — 어디서 보든 "손봐야 한다"가 같은
 * 표식으로 읽히게.
 */
export function EquipmentFaultBadge({ label, title }: { label: string; title?: string }) {
  return (
    <span
      title={title ?? label}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-status-unhealthy/20 px-2 py-0.5 text-inshop-sm font-semibold text-status-unhealthy ring-1 ring-inset ring-status-unhealthy/50"
    >
      <span aria-hidden="true">⚠</span>
      {label}
    </span>
  )
}
