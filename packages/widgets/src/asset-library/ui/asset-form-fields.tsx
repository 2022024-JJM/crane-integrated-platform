import { X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_SITES,
  ASSET_TAG_MAX,
  ASSET_TAGS_MAX,
  type AssetSiteId,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Input } from '@crane/ui/atoms/input';
import { parseTagInput } from '../lib/asset-presentation';
import { toggleListValue } from '../lib/asset-library-url';

/**
 * 인스펙터의 조용한 입력 — 평소에는 테두리 없이 값처럼 읽히고, 올리거나
 * 포커스하면 입력란임이 드러난다. 속성이 열 개 넘게 늘어선 패널에서 테두리
 * 상자가 줄마다 서 있으면 값보다 상자가 먼저 보인다.
 */
const QUIET_FIELD =
  'border-transparent bg-muted/60 hover:bg-muted focus:border-ring focus:bg-background';

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
 * 조선소 선택. 아무것도 고르지 않은 상태가 "전사 공용" 이다 — 공용을 별도
 * 선택지로 두지 않아 "공용이면서 옥포" 같은 모순이 생기지 않는다.
 */
export function SitePicker({
  value,
  onChange,
  disabled,
}: {
  value: readonly AssetSiteId[];
  onChange: (sites: AssetSiteId[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {ASSET_SITES.map((site) => {
          const active = value.includes(site);
          return (
            <button
              key={site}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  ASSET_SITES.filter((item) =>
                    toggleListValue(value, site).includes(item),
                  ),
                )
              }
              className={cn(
                'focus-visible:ring-ring/50 h-8 cursor-pointer rounded-md border px-3 text-[13px] transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
                active
                  ? 'border-foreground bg-foreground text-background font-medium'
                  : 'border-border text-foreground/75 hover:bg-muted hover:text-foreground',
              )}
            >
              {t(`asset-library:site.${site}`)}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        {value.length === 0
          ? t('asset-library:form.siteCommonHint')
          : t('asset-library:form.siteScopedHint')}
      </p>
    </div>
  );
}

/** 태그 편집 — Enter·쉼표로 추가, 칩의 × 로 제거. */
export function TagEditor({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: readonly string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const full = value.length >= ASSET_TAGS_MAX;

  const commit = (raw: string) => {
    const lower = new Set(value.map((tag) => tag.toLowerCase()));
    const next = [...value];
    for (const tag of parseTagInput(raw)) {
      const trimmed = tag.slice(0, ASSET_TAG_MAX);
      if (lower.has(trimmed.toLowerCase())) continue;
      if (next.length >= ASSET_TAGS_MAX) break;
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
          {value.map((tag) => (
            <li
              key={tag}
              className="border-border text-foreground inline-flex h-7 items-center gap-1 rounded-full border pr-1 pl-2.5 text-xs"
            >
              {tag}
              <button
                type="button"
                disabled={disabled}
                aria-label={t('asset-library:form.removeTag', { tag })}
                onClick={() => onChange(value.filter((item) => item !== tag))}
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
        maxLength={ASSET_TAG_MAX * 4}
        placeholder={
          full
            ? t('asset-library:form.tagsFull', { max: ASSET_TAGS_MAX })
            : t('asset-library:form.tagPlaceholder')
        }
        className={cn(QUIET_FIELD, 'h-8 text-[13px]')}
        onChange={(event) => {
          const next = event.target.value;
          // 쉼표를 치는 순간 그 앞까지를 태그로 확정한다.
          if (next.includes(',')) commit(next);
          else setDraft(next);
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (draft.trim()) commit(draft);
          } else if (
            event.key === 'Backspace' &&
            // 꾹 누르고 있을 때의 반복 입력으로 저장된 태그가 줄줄이 지워지지
            // 않게, 눌렀다 뗀 한 번만 받는다.
            !event.repeat &&
            draft === '' &&
            value.length > 0
          ) {
            onChange(value.slice(0, -1));
          }
        }}
      />
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
