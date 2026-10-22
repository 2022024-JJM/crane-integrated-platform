import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CraneFeedConnection } from '@crane/features/3d';
import { Button } from '@crane/ui/atoms/button';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import { ConnectionStatus } from './connection-status';

/**
 * 연결 설정 팝업 — 톱니 아이콘을 누르면 피드가 붙는 호스트(브로커 주소)·상태와
 * 연결 해제/연결 버튼이 나온다. 버튼을 눌러도 팝업은 열린 채라 상태 줄과
 * 툴바 아이콘이 바뀌는 것이 보인다.
 */
export function ConnectionSettings({
  connection,
  enabled,
  host,
  onToggleConnection,
}: {
  connection: CraneFeedConnection;
  /** 사용자가 연결을 켜 둔 상태(연결 해제 버튼의 반대). */
  enabled: boolean;
  host: string;
  onToggleConnection: () => void;
}) {
  const { t } = useTranslation();
  const title = t('monitoring:tags.connectionSettings');
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={title}
            title={title}
          >
            <Settings />
          </Button>
        }
      />
      <PopoverPopup
        align="end"
        className="w-fit max-w-[min(28rem,calc(100vw-2rem))] p-3"
      >
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-xs">
          <dt className="text-muted-foreground">{t('monitoring:tags.host')}</dt>
          <dd className="break-all select-all">{host}</dd>
          <dt className="text-muted-foreground">
            {t('monitoring:tags.status')}
          </dt>
          <dd>
            <ConnectionStatus connection={connection} withLabel />
          </dd>
        </dl>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleConnection}
          >
            {t(
              enabled
                ? 'monitoring:tags.disconnect'
                : 'monitoring:tags.connect',
            )}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
