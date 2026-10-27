import { useTranslation } from 'react-i18next';
import type {
  AssetComponentStats,
  AssetHealthSnapshot,
} from '@crane/features/asset';
import { KC } from '../../../shared/ui/kc';
import type { InspectionDue } from '../lib/asset-card-metrics';

/**
 * 자산 카드 하단 2×2 타일 — 건강도(최악 부품 잔여 수명)·이상 부품·미결 WO·점검 기한.
 * 색은 신호일 때만: 0건·정상은 뉴트럴로 가라앉는다.
 */
export function AssetCardTiles({
  health,
  stats,
  openInspections,
  openRepairs,
  due,
  layout = 'grid',
}: {
  health: AssetHealthSnapshot | undefined;
  stats: AssetComponentStats | undefined;
  openInspections: number;
  openRepairs: number;
  due: InspectionDue;
  /** grid = 카드 하단 2×2, row = 상세 헤더 아래 한 줄 4칸 */
  layout?: 'grid' | 'row';
}) {
  const { t } = useTranslation('mro2');
  const pct = health?.remainingPct;
  const pctColor =
    pct == null
      ? KC.muted
      : pct <= 20
        ? KC.safety
        : pct <= 40
          ? KC.production
          : KC.ok;
  const issues = stats?.issues ?? 0;
  const row = layout === 'row';
  const tile = row
    ? 'flex flex-col gap-0.5 py-2.5 pr-4 pl-4 first:pl-0'
    : 'flex flex-col gap-0.5 px-3 py-2';
  const sep = row ? 'border-r' : '';
  const label = 'text-[11px]';
  return (
    <div
      className={
        layout === 'row'
          ? 'grid grid-cols-2 md:grid-cols-4'
          : 'grid grid-cols-2 border-t'
      }
      style={{ borderColor: KC.hairline }}
    >
      <div
        className={`${tile} ${row ? sep : 'border-r border-b'}`}
        style={{ borderColor: KC.hairline }}
      >
        <span className={label} style={{ color: KC.muted }}>
          {t('assets.card.health')}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-1.5 w-14 rounded-full"
            style={{ background: KC.track }}
          >
            <span
              className="block h-1.5 rounded-full"
              style={{ width: `${pct ?? 0}%`, background: pctColor }}
            />
          </span>
          <span
            className="text-[14px] font-bold tabular-nums"
            style={{ color: pctColor }}
          >
            {pct == null ? '-' : `${pct}%`}
          </span>
        </span>
        <span className="truncate text-[11px]" style={{ color: KC.faint }}>
          {health ? t('assets.card.worst', { name: health.componentName }) : ''}
        </span>
      </div>
      <div
        className={`${tile} ${row ? sep : 'border-b'}`}
        style={{ borderColor: KC.hairline }}
      >
        <span className={label} style={{ color: KC.muted }}>
          {t('assets.card.components')}
        </span>
        <span
          className="text-[14px] font-bold"
          style={{ color: issues > 0 ? KC.ink : KC.muted }}
        >
          {t('assets.card.issuesN', { n: issues })}
        </span>
        <span
          className="flex flex-wrap gap-x-2 text-[11px]"
          style={{ color: KC.muted }}
        >
          {stats && stats.critical + stats.replace > 0 ? (
            <span style={{ color: KC.safety }}>
              ● {t('assets.card.critical')} {stats.critical + stats.replace}
            </span>
          ) : null}
          {stats && stats.warning > 0 ? (
            <span style={{ color: KC.production }}>
              ● {t('assets.card.warning')} {stats.warning}
            </span>
          ) : null}
          {stats && stats.caution > 0 ? (
            <span style={{ color: KC.undetermined }}>
              ● {t('assets.card.caution')} {stats.caution}
            </span>
          ) : null}
        </span>
      </div>
      <div
        className={`${tile} ${row ? sep : 'border-r'}`}
        style={{ borderColor: KC.hairline }}
      >
        <span className={label} style={{ color: KC.muted }}>
          {t('common.openWos')}
        </span>
        <span
          className="text-[14px] font-bold tabular-nums"
          style={{ color: KC.ink }}
        >
          {openInspections + openRepairs}
        </span>
        <span className="text-[11px]" style={{ color: KC.faint }}>
          {t('assets.card.woSplit', { i: openInspections, r: openRepairs })}
        </span>
      </div>
      <div className={tile}>
        <span className={label} style={{ color: KC.muted }}>
          {t('assets.card.inspection')}
        </span>
        {due.kind === 'overdue' ? (
          <span
            className="text-[14px] font-bold tabular-nums"
            style={{ color: KC.safety }}
          >
            {t('assets.card.overdue', { n: due.days })}
          </span>
        ) : due.kind === 'due' ? (
          <span
            className="text-[14px] font-bold tabular-nums"
            style={{ color: KC.ink }}
          >
            D-{due.days}
          </span>
        ) : (
          <span className="text-[14px] font-bold" style={{ color: KC.muted }}>
            -
          </span>
        )}
        <span className="text-[11px]" style={{ color: KC.faint }}>
          {due.kind === 'overdue'
            ? t('assets.card.overdueHint')
            : due.kind === 'due'
              ? t('assets.card.nextHint')
              : t('assets.card.noneHint')}
        </span>
      </div>
    </div>
  );
}
