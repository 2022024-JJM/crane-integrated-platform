import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

/**
 * 분리 트리거용 툴팁 핸들 — 팝업(Root) 하나에 트리거 여러 개를 물린다. 표식이
 * 수백 개인 타임라인처럼 트리거마다 Root 를 두기 어려운 곳에서 쓴다:
 * `<Tooltip handle={h}>{({ payload }) => …}</Tooltip>` 하나와
 * `<TooltipTrigger handle={h} payload={…} />` 여러 개. 컴포넌트가 아니라서
 * tooltip.tsx 가 아닌 이 파일에 둔다(react-refresh 규칙).
 */
export type TooltipHandle<Payload = unknown> = TooltipPrimitive.Handle<Payload>;

export function createTooltipHandle<
  Payload = unknown,
>(): TooltipHandle<Payload> {
  return TooltipPrimitive.createHandle<Payload>();
}
