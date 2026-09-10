import { ArrowRight, ShieldAlert, X } from 'lucide-react';

import { AppLink } from '@crane/ui/atoms/app-link';
import type { DashboardCollisionRow } from '../model';
import type { DashboardTranslate } from './dashboard-helpers';

/**
 * 최근 충돌 경보 배너 — 최신 충돌이 ATTENTION_WINDOW_MS 안이면 대시보드
 * 최상단에 뜬다. 세션 activeRecord(정지 상태)는 모니터링 화면을 떠나는 순간
 * 해제돼 대시보드에선 볼 수 없으므로, journal 의 시간 창 기준을 쓴다.
 * 닫으면 그 충돌 key 에 한해 숨고, 새 충돌이 오면 다시 뜬다.
 */
export function DashboardCollisionBanner({
  collision,
  translate,
  formatTime,
  onDismiss,
}: {
  collision: DashboardCollisionRow;
  translate: DashboardTranslate;
  formatTime: (at: number) => string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 md:p-4"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15">
        <ShieldAlert className="size-5 text-red-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-red-600 dark:text-red-400">
          {translate('dashboard:collisionBanner.title')}
        </p>
        <p className="text-foreground truncate text-sm">
          {collision.equipA}
          <span className="text-muted-foreground mx-1.5">↔</span>
          {collision.equipB}
          <span className="text-muted-foreground ml-2 text-xs">
            {collision.regionTitleKey
              ? translate(collision.regionTitleKey)
              : translate('dashboard:collisionHistory.unknownRegion')}
            {' · '}
            {formatTime(collision.at)}
          </span>
        </p>
      </div>
      {collision.navigateTo ? (
        <AppLink
          to={collision.navigateTo}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-600"
        >
          {translate('dashboard:collisionBanner.open')}
          <ArrowRight className="size-4" />
        </AppLink>
      ) : null}
      <button
        type="button"
        aria-label={translate('dashboard:collisionBanner.dismiss')}
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer rounded-lg p-1.5 transition"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
