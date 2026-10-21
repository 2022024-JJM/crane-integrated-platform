import { Tabs as TabsPrimitive } from '@base-ui/react';
import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';

/**
 * 밑줄 탭 — 씬 에디터 팔레트(모델·맵·배경·뷰)의 모양을 Base UI `Tabs` 로 감싼
 * 것. 탭이 남는 폭을 나눠 채우고(flex-auto) 좁아지면 라벨이 말줄임된다.
 * 활성 탭은 Base UI 가 `data-active` 를 붙인다(`data-selected` 가 아니다).
 * 키보드 이동·aria 는 프리미티브가 맡는다. `TabsPanel` 은 활성일 때만
 * 마운트한다(`keepMounted` 로 바꿀 수 있다).
 */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      className={cn('flex min-h-0 flex-col', className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      className={cn(
        'border-border flex h-9 shrink-0 items-stretch border-b',
        className,
      )}
      {...props}
    />
  );
}

function TabsTab({ className, children, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'text-muted-foreground hover:text-foreground flex h-full min-w-0 flex-auto cursor-pointer items-center justify-center border-b-2 border-transparent px-2 text-[11px] font-medium transition-colors outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-2',
        'data-[active]:border-primary data-[active]:text-foreground',
        className,
      )}
      {...props}
    >
      <span className="truncate">{children as ReactNode}</span>
    </TabsPrimitive.Tab>
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn('flex min-h-0 flex-1 flex-col outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTab, TabsPanel };
