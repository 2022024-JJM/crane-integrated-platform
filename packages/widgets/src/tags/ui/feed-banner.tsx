import { useTranslation } from 'react-i18next';
import { severityBadgeClassName } from '@crane/core/lib/status-colors';
import { cn } from '@crane/core/lib/utils';

/**
 * 피드 안내 줄 — 초기 조회(REST) 실패만 알린다. 연결 상태는 목록 툴바의
 * 아이콘이 맡으므로 여기서는 그리지 않는다.
 */
export function FeedBanner({ loadError }: { loadError: boolean }) {
  const { t } = useTranslation();
  if (!loadError) return null;
  return (
    <p
      role="status"
      className={cn(
        'rounded-lg border px-3 py-2 text-xs',
        severityBadgeClassName.medium,
      )}
    >
      {t('monitoring:tags.banner.loadError')}
    </p>
  );
}
