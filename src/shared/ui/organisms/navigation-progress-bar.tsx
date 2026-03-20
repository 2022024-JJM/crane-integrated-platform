import { cn } from '@/shared/lib/utils';
import { useNavigationProgress } from '@/shared/lib/use-navigation-progress';

export function NavigationProgressBar() {
  const { isVisible, progress } = useNavigationProgress();

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden',
        isVisible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div
        className="bg-[var(--navigation-progress)] h-full origin-left transition-[transform,opacity] duration-200 ease-out will-change-transform"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
