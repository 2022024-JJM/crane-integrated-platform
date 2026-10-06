import { Plus, X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSET_CATEGORY_MAX, ASSET_CATEGORIES_MAX } from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Input } from '@crane/ui/atoms/input';
import {
  listCategorySuggestions,
  parseCategoryInput,
} from '../lib/asset-presentation';

/**
 * 인스펙터의 조용한 입력 — 평소에는 테두리 없이 값처럼 읽히고, 올리거나
 * 포커스하면 입력란임이 드러난다. 속성이 열 개 넘게 늘어선 패널에서 테두리
 * 상자가 줄마다 서 있으면 값보다 상자가 먼저 보인다.
 */
const QUIET_FIELD =
  'border-transparent bg-muted/60 hover:bg-muted focus:border-ring focus:bg-background';

/**
 * 권하는 카테고리 목록의 높이 상한 — 칩 네 줄(줄 높이 1.5rem, 줄 사이 0.25rem)에
 * 위아래 안쪽 여백을 더한 값이다.
 */
const SUGGESTIONS_MAX_HEIGHT = 'max-h-[7rem]';

/** 라벨 + 입력 한 줄. 라벨과 입력은 id 로 묶인다. */
export function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </label>
      {children(id)}
      {hint ? (
        <p className="text-muted-foreground text-xs leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** 여러 줄 입력. Input 원자와 같은 테두리·포커스 규칙을 쓴다. */
export function TextArea({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'textarea'>) {
  return (
    <textarea
      className={cn(
        'border-border bg-background focus:border-ring focus:ring-ring/50 min-h-16 w-full resize-y rounded-lg border px-2.5 py-1.5 text-sm leading-snug transition-colors outline-none focus:ring-3 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/**
 * 카테고리 편집 — Enter·쉼표로 추가, 칩의 × 로 제거. `suggestions` 는 같은 종류의
 * 자산이 이미 쓰는 카테고리다 — 눌러서 붙이게 해 철자가 갈리지 않게 한다(갈리면
 * 탐색 계층의 체크박스가 둘로 나뉜다). 입력란에 치는 글자로 그 목록을 거른다.
 */
export function CategoryEditor({
  id,
  value,
  onChange,
  disabled,
  suggestions,
}: {
  id?: string;
  value: readonly string[];
  onChange: (categories: string[]) => void;
  disabled?: boolean;
  suggestions?: readonly string[];
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const suggestionsRef = useRef<HTMLUListElement | null>(null);
  const full = value.length >= ASSET_CATEGORIES_MAX;
  const offered = full
    ? []
    : listCategorySuggestions(suggestions ?? [], value, draft);

  const commit = (raw: string) => {
    const lower = new Set(value.map((category) => category.toLowerCase()));
    const next = [...value];
    for (const category of parseCategoryInput(raw)) {
      const trimmed = category.slice(0, ASSET_CATEGORY_MAX);
      if (lower.has(trimmed.toLowerCase())) continue;
      if (next.length >= ASSET_CATEGORIES_MAX) break;
      lower.add(trimmed.toLowerCase());
      next.push(trimmed);
    }
    setDraft('');
    if (next.length !== value.length) onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {value.map((category) => (
            <li
              key={category}
              className="border-border text-foreground inline-flex h-7 items-center gap-1 rounded-full border pr-1 pl-2.5 text-xs"
            >
              {category}
              <button
                type="button"
                disabled={disabled}
                aria-label={t('asset-library:form.removeCategory', { category })}
                onClick={() => onChange(value.filter((item) => item !== category))}
                className="text-muted-foreground hover:text-foreground hover:bg-background focus-visible:ring-ring/50 flex size-4 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        value={draft}
        disabled={disabled || full}
        maxLength={ASSET_CATEGORY_MAX * 4}
        placeholder={
          full
            ? t('asset-library:form.categoriesFull', { max: ASSET_CATEGORIES_MAX })
            : t('asset-library:form.categoryPlaceholder')
        }
        className={cn(QUIET_FIELD, 'h-8 text-[13px]')}
        onChange={(event) => {
          const next = event.target.value;
          // 쉼표를 치는 순간 그 앞까지를 카테고리로 확정한다.
          if (next.includes(',')) commit(next);
          else setDraft(next);
        }}
        onBlur={(event) => {
          // 권하는 카테고리로 초점이 옮겨 간 것이면 치던 글자를 카테고리로 만들지
          // 않는다 — 그 글자는 목록을 거르려고 친 것이다.
          if (
            suggestionsRef.current?.contains(event.relatedTarget as Node | null)
          ) {
            return;
          }
          if (draft.trim()) commit(draft);
        }}
        onKeyDown={(event) => {
          // 한글처럼 조합해 넣는 글자는 Enter 가 두 번 온다 — 조합을 끝내는
          // Enter 와 그 뒤의 진짜 Enter. 앞의 것에서 확정하면 입력란을 비운
          // 뒤에 조합 중이던 마지막 글자가 다시 들어와 카테고리가 하나 더 생긴다.
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            if (draft.trim()) commit(draft);
          } else if (
            event.key === 'Backspace' &&
            // 꾹 누르고 있을 때의 반복 입력으로 저장된 카테고리가 줄줄이 지워지지
            // 않게, 눌렀다 뗀 한 번만 받는다.
            !event.repeat &&
            draft === '' &&
            value.length > 0
          ) {
            onChange(value.slice(0, -1));
          }
        }}
      />
      {offered.length > 0 ? (
        // 네 줄까지 보이고 넘치면 스크롤한다 — 카테고리가 많은 종류에서 목록이
        // 아래 입력란을 밀어내지 않는다.
        <ul
          ref={suggestionsRef}
          className={cn(
            // 안쪽 여백은 스크롤 영역이 칩의 초점 테두리를 자르지 않게 한다.
            '-m-0.5 flex flex-wrap gap-1 overflow-y-auto p-0.5',
            SUGGESTIONS_MAX_HEIGHT,
          )}
        >
          {offered.map((category) => (
            <li key={category}>
              <button
                type="button"
                disabled={disabled}
                aria-label={t('asset-library:form.addSuggestedCategory', { category })}
                // 누르는 동안 입력란이 초점을 잃지 않게 한다 — 이어서 칠 수 있다.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(category)}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-dashed pr-2 pl-1.5 text-[11px] outline-none focus-visible:ring-2 disabled:pointer-events-none"
              >
                <Plus className="size-3" />
                {category}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * 포커스를 떠나거나 Enter 를 누를 때 확정하는 한 줄 입력. 글자마다 저장하면
 * 이력이 글자 수만큼 쌓인다. Escape 는 고치던 값을 버린다.
 */
export function CommitInput({
  id,
  value,
  maxLength,
  placeholder,
  disabled,
  className,
  /** 비울 수 없는 필드 — 빈 값으로 확정하면 원래 값으로 되돌린다. */
  required,
  listId,
  onCommit,
}: {
  id?: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  /** 추천 값 목록(`<datalist>`)의 id. */
  listId?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  // Esc 는 취소다. 초점을 빼면 blur 가 저장을 부르는데, 그때의 `draft` 는 아직
  // 고친 값이라 그대로 두면 취소가 저장이 된다 — 취소했다는 표시를 남긴다.
  const cancelledRef = useRef(false);

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(value);
      return;
    }
    const next = draft.trim();
    if (next === value || (required && next === '')) {
      setDraft(value);
      return;
    }
    onCommit(next);
  };

  return (
    <Input
      id={id}
      value={draft}
      maxLength={maxLength}
      // 빈 칸이 빈 상자로만 보이지 않게 — 값이 없다는 것을 적는다.
      placeholder={placeholder ?? '—'}
      disabled={disabled}
      list={listId}
      className={cn(QUIET_FIELD, 'h-8 text-[13px]', className)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          cancelledRef.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** CommitInput 의 여러 줄 판. 확정은 포커스를 떠날 때다. */
export function CommitTextArea({
  id,
  value,
  maxLength,
  placeholder,
  disabled,
  onCommit,
}: {
  id?: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  return (
    <TextArea
      id={id}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(QUIET_FIELD, 'text-[13px]')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (next === value) setDraft(value);
        else onCommit(next);
      }}
    />
  );
}
