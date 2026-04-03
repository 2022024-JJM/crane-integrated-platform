import { Toaster } from 'sonner';
import { useTheme } from '@crane/core/lib/theme-context';

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
