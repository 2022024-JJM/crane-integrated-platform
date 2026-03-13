import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Topbar({ className, ...props }: React.ComponentProps<'header'>) {
  return (
    <header
      data-slot="topbar"
      className={cn(
        'flex w-full items-center justify-between gap-6 border-b bg-(--main-page-header-bg)',
        className,
      )}
      {...props}
    />
  );
}

function TopbarBrand({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="topbar-brand"
      className={cn('flex flex-none items-center gap-3.5', className)}
      {...props}
    />
  );
}

function TopbarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="topbar-content"
      className={cn(
        'flex min-w-0 flex-1 items-center justify-end gap-2',
        className,
      )}
      {...props}
    />
  );
}

export { Topbar, TopbarBrand, TopbarContent };
