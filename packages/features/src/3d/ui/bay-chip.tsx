import { Button } from '@crane/ui/atoms/button';

/**
 * 구역(bay) 선택 칩 — 이름과 그 구역의 크레인 수. 태그 페이지 크레인 목록과
 * 태그 연결 다이얼로그가 같은 모양을 쓴다. `mono` 는 서버 구역 코드처럼
 * 고정폭으로 보일 라벨.
 */
export function BayChip({
  label,
  count,
  pressed,
  mono,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? 'secondary' : 'outline'}
      size="xs"
      aria-pressed={pressed}
      className="rounded-full font-normal"
      onClick={onClick}
    >
      <span className={mono ? 'font-mono' : undefined}>{label}</span>
      <span className="text-muted-foreground">{count}</span>
    </Button>
  );
}
