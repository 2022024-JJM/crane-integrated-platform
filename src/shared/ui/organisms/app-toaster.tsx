import { Toaster } from 'sonner';
import { useTheme } from '@/shared/lib/theme-context';

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      expand={false}
      richColors
      closeButton
    />
  );
}
