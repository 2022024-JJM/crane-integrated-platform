import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';

/**
 * 구역(bay) 선택 칩 — 이름과 그 구역의 크레인 수. 태그 페이지 크레인 목록과
 * 태그 연결 다이얼로그가 같은 모양을 쓴다.
 *
 * 고른 칩은 primary 테두리·틴트로 밝히고 나머지는 글자를 흐리게 둔다 —
 * secondary 채움과 outline 은 다크 테마에서 둘 다 회색이라 구분되지 않는다.
 * ghost 를 바탕으로 쓰는 것은 outline 의 `dark:` 테두리·바탕이 틴트를 덮기 때문.
 */
export function BayChip({
  label,
  count,
  pressed,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? 'ghost' : 'outline'}
      size="xs"
      aria-pressed={pressed}
      className={cn(
        'rounded-full',
        pressed
          ? 'border-primary/50 bg-primary/15 text-foreground hover:bg-primary/20 dark:hover:bg-primary/20'
          : 'text-muted-foreground font-normal',
      )}
      onClick={onClick}
    >
      <span className="text-box-cap">{label}</span>
      <span
        className={cn(
          'text-box-cap',
          pressed ? 'text-foreground/70' : 'text-muted-foreground',
        )}
      >
        {count}
      </span>
    </Button>
  );
}
