import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import type { TagsTab } from '../lib/tags-route';

const TABS: readonly TagsTab[] = ['realtime', 'virtual'];

/**
 * 태그 페이지 탭 — 실시간 태그 | 가상 태그. 3D 플레이의 소스 탭과 같은
 * 규칙(role=tablist 버튼, 공용 Tabs 컴포넌트 없음). 선택은 URL 이 든다.
 */
export function TagsTabs({
  value,
  onChange,
  className,
}: {
  value: TagsTab;
  onChange: (tab: TagsTab) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t('common:nav.tags')}
      className={cn(
        'bg-background border-border/60 flex shrink-0 items-end gap-1 border-b px-3',
        className,
      )}
    >
      {TABS.map((tab) => {
        const selected = tab === value;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              '-mb-px cursor-pointer border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              selected
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
            onClick={() => onChange(tab)}
          >
            {t(`monitoring:tags.tabs.${tab}`)}
          </button>
        );
      })}
    </div>
  );
}
