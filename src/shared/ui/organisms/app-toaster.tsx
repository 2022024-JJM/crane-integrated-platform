import { Toaster } from 'sonner';
import { useTheme } from '@/shared/lib/theme-context';

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="top-center"
      expand={false}
      richColors
      closeButton
    />
  );
}
