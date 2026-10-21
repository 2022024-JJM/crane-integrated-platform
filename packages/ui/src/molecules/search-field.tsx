import { Search } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
} from 'react';
import { cn } from '@crane/core/lib/utils';
import { Input } from '../atoms/input';

interface SearchFieldProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'className'
> {
  /** 바깥 상자 클래스 — 폭·flex 를 바꿀 때. 높이·모서리는 기본값을 쓴다. */
  className?: string;
  inputClassName?: string;
}

/**
 * 검색 입력 — 씬 에디터 팔레트(모델 검색·객체 검색)의 모양이다: 흐린 돋보기와
 * 테두리 없는 입력을 h-6 상자가 감싸고 포커스 링은 상자에 생긴다. 팔레트·
 * 태그 페이지·태그 연결 다이얼로그가 같이 써서 검색창이 한 모양이다.
 */
function SearchFieldBase(
  { className, inputClassName, ...props }: SearchFieldProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <div
      className={cn(
        'border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 flex h-6 min-w-0 flex-1 items-center rounded-sm border px-2 transition-colors focus-within:ring-3',
        className,
      )}
    >
      <Search
        className="text-muted-foreground/50 mr-2 size-3 shrink-0"
        aria-hidden
      />
      <Input
        ref={ref}
        className={cn(
          'placeholder:text-muted-foreground h-full flex-1 border-0 bg-transparent px-0 text-[11px] leading-none shadow-none focus:border-0 focus:ring-0',
          inputClassName,
        )}
        {...props}
      />
    </div>
  );
}

const SearchField = forwardRef(SearchFieldBase);
SearchField.displayName = 'SearchField';

export { SearchField };
export type { SearchFieldProps };
