import { Sun, Moon, MenuIcon } from 'lucide-react';
import { useSidebar } from '@/shared/lib/sidebar-context';
import { useTheme } from '@/shared/lib/theme-context';
import { HanwhaIcon } from '../atoms/hanwha-icon';

export function AppHeader() {
  const { toggle } = useSidebar();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-background sticky top-0 z-40 flex h-14 items-center border-b px-4">
      <button
        onClick={toggle}
        className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
        aria-label="Toggle sidebar"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="ml-3 flex items-center gap-2">
        <HanwhaIcon />
        <span className="text-lg font-semibold">
          CRANE <span className="text-[#f5a623]">OPS</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>
      </div>
    </header>
  );
}
