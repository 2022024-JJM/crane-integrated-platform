import { Boxes, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';

export type SceneEditorSidebarTab = 'palette' | 'inspector';

interface SceneEditorSidebarTabsProps {
  activeTab: SceneEditorSidebarTab;
  onTabChange: (tab: SceneEditorSidebarTab) => void;
}

const TAB_ITEMS: Array<{
  id: SceneEditorSidebarTab;
  icon: typeof Boxes;
  labelKey: string;
}> = [
  {
    id: 'palette',
    icon: Boxes,
    labelKey: 'monitoring:palette.title',
  },
  {
    id: 'inspector',
    icon: SlidersHorizontal,
    labelKey: 'monitoring:inspector.title',
  },
];

export function SceneEditorSidebarTabs({
  activeTab,
  onTabChange,
}: SceneEditorSidebarTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-background/70 border-border/70 inline-flex w-full items-center rounded-xl border p-1">
      {TAB_ITEMS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              onTabChange(tab.id);
            }}
            className={cn(
              'text-muted-foreground flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[0.7rem] px-3 py-2 text-xs font-medium transition',
              isActive && 'bg-primary text-primary-foreground shadow-sm',
            )}
          >
            <Icon className="size-3.5" />
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
