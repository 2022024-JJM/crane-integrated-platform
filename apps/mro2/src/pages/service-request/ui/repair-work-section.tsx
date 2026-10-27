import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import type { RepairWO } from '@crane/domain/maintenance';
import { KC, usd } from '../../../shared/ui/kc';
import { KcButton, KcFieldRow, KcSection } from '../../../shared/ui/kc-ui';
import { fmtDate } from '../../../shared/lib/service-status';
import { RepairPartModal } from './repair-part-modal';

/**
 * 작업 현황 — 상태는 현장이 올리는 대로 따라가고(작업 시작·완료), 사무실은 읽는다.
 * 사무실이 손대는 것은 사용 부품 기록뿐. 인쇄(리포트)에는 나오지 않는다.
 */
export function RepairWorkSection({ wo }: { wo: RepairWO }) {
  const { t } = useTranslation('mro2');
  const closed = wo.status === 'completed';
  const [partOpen, setPartOpen] = useState(false);
  const partsCost =
    wo.partsCost ?? wo.partsUsed.reduce((s, p) => s + p.qty * p.unitCost, 0);

  return (
    <div className="kc-no-print">
      <KcSection
        title={t('sr.work.title')}
        right={
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-bold"
            style={{
              background: KC.bgSubtle,
              color: KC.ink,
              border: `1px solid ${KC.border}`,
            }}
          >
            {t(`woStatus.${wo.status}`)}
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <KcFieldRow
              k={t('sr.actualRange')}
              v={
                wo.actualStart
                  ? `${fmtDate(wo.actualStart)} – ${wo.actualEnd ? fmtDate(wo.actualEnd) : '…'}`
                  : '-'
              }
            />
            <KcFieldRow
              k={t('sr.work.action')}
              v={
                wo.correctiveAction ? (
                  wo.correctiveAction
                ) : (
                  <span style={{ color: KC.muted }}>
                    {closed ? '-' : t('sr.work.actionPending')}
                  </span>
                )
              }
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-bold" style={{ color: KC.ink }}>
                {t('sr.partsUsed', { count: wo.partsUsed.length })}
              </span>
              <KcButton
                variant="outline"
                disabled={closed}
                onClick={() => setPartOpen(true)}
                className="!py-1 !text-[12px]"
              >
                <Plus size={12} /> {t('sr.work.addPart')}
              </KcButton>
            </div>
            {wo.partsUsed.length === 0 ? (
              <div
                className="rounded-[4px] border border-dashed py-4 text-center text-[12px]"
                style={{ borderColor: KC.borderStrong, color: KC.muted }}
              >
                {t('sr.work.noParts')}
              </div>
            ) : (
              <ul className="flex flex-col">
                {wo.partsUsed.map((p, i) => (
                  <li key={`${p.partId}-${i}`}>
                    <Link
                      to={`/mro2/inventory?part=${encodeURIComponent(p.partId)}`}
                      className="flex items-center gap-2 py-1.5 text-[13px] hover:underline"
                      style={{ color: KC.ink }}
                    >
                      <Package size={13} style={{ color: KC.muted }} />
                      <span className="min-w-0 flex-1 truncate">
                        {p.partName}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ color: KC.muted }}
                      >
                        ×{p.qty}
                      </span>
                      <span className="w-20 text-right font-bold tabular-nums">
                        {usd(p.qty * p.unitCost)}
                      </span>
                    </Link>
                  </li>
                ))}
                <li
                  className="mt-1 flex justify-between border-t pt-1.5 text-[13px] font-bold"
                  style={{ borderColor: KC.hairline, color: KC.ink }}
                >
                  <span>{t('sr.partsCost')}</span>
                  <span className="tabular-nums">{usd(partsCost)}</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      </KcSection>
      {partOpen ? (
        <RepairPartModal
          repairId={wo.id}
          woNumber={wo.woNumber}
          defaultBy={wo.assignedTo}
          onClose={() => setPartOpen(false)}
        />
      ) : null}
    </div>
  );
}
