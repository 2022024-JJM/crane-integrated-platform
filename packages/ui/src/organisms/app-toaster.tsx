import { Toaster } from 'sonner';
import { useTheme } from '@crane/core/lib/theme-context';

interface AppToasterProps {
  /**
   * sonner 의 Toaster id. 지정하면 `toast(msg, { toasterId })` 로 이 id 를
   * 붙인 토스트만 그리고, 없으면 id 없는 토스트만 그린다 — 앱 전역 Toaster
   * (app-layout) 외에 전체화면 루트 안 등 두 번째 Toaster 를 둘 때 쓴다.
   * sonner 는 포털을 쓰지 않고 마운트 자리에 인라인 렌더하므로, 전체화면
   * (top layer) 안에서 토스트를 보이게 하려면 그 루트 안에 Toaster 가 있어야 한다.
   */
  id?: string;
}

export function AppToaster({ id }: AppToasterProps = {}) {
  const { theme } = useTheme();

  return (
    <Toaster
      id={id}
      theme={theme}
      position="top-center"
      expand={false}
      richColors
      closeButton
    />
  );
}
