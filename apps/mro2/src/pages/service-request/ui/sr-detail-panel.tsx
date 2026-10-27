import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  Inbox,
  Package,
  Smartphone,
  Wrench,
  X,
} from 'lucide-react';
import { useDocuments } from '@crane/features/compliance';
import { useMaintenanceDetail } from '@crane/features/maintenance';
import { KC } from '../../../shared/ui/kc';
import { KcButton, KcFieldRow } from '../../../shared/ui/kc-ui';
import { SrStatusChip } from '../../../shared/ui/sr-status-chip';
import { fmtDate } from '../../../shared/lib/service-status';
import type { SrRow } from '../../../shared/lib/sr-rows';
import { SrAssignFields } from './sr-assign-fields';
import { SrTimeline } from '../../../shared/ui/sr-timeline';
import { useTriageActions } from '@crane/features/triage';
import { useInventoryList } from '@crane/features/inventory';
import { getAllPartsRequests } from '@crane/domain/inventory';
import { useEntityTick } from '@crane/features/shared';
import { toast } from 'sonner';

const KIND_ICON = {
  repair: Wrench,
  inspection: ClipboardCheck,
  parts: Package,
} as const;

/**
 * 서비스 요청 오른쪽 패널 — 표에서 행을 누르면 열린다. 관리자가 매일 하는 것
 * (담당자·예정일 바꾸기, 사진·증상 확인, 접수함으로)을 표를 떠나지 않고 한다.
 * 리포트·체크리스트 전체는 상세 페이지로.
 */
export function SrDetailPanel({
  row,
  onClose,
}: {
  row: SrRow;
  onClose: () => void;
}) {
  const { t } = useTranslation('mro2');
  const { uploads } = useDocuments();
  const { repair } = useMaintenanceDetail(
    row.kind === 'repair' ? row.key.slice(2) : '',
  );
  const editable = row.kind !== 'parts' && row.tone !== 'completed';
  const target = {
    kind: row.kind as 'repair' | 'inspection',
    id: row.key.slice(2),
  };
  const photos = useMemo(
    () => uploads.filter((d) => d.refWoNumber === row.woNumber && d.objectUrl),
    [uploads, row.woNumber],
  );
  const Icon = KIND_ICON[row.kind];
  const partsTick = useEntityTick('parts');
  const partsReq = useMemo(
    () =>
      row.kind === 'parts'
        ? getAllPartsRequests().find((r) => r.id === row.key.slice(2))
        : undefined,
    // partsTick: 부품 요청 배열이 바뀐 프레임
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row.kind, row.key, partsTick],
  );
  const { items: inventory } = useInventoryList();
  const { triageParts } = useTriageActions(t('timeline.office'));

  return (
    <aside
      aria-label={row.woNumber}
      // z-30·top 100px: 헤더(z-40)의 설정 패널 아래, 콘텐츠 툴바 아래에서 시작 (자산 슬라이드아웃과 같은 규칙)
      className="fixed top-[100px] right-0 bottom-0 z-30 flex w-[380px] max-w-[calc(100vw-1rem)] flex-col border-l shadow-xl"
      style={{ borderColor: KC.border, background: KC.bg }}
    >
      <div
        className="flex items-start gap-2 border-b px-4 py-3"
        style={{ borderColor: KC.hairline }}
      >
        <Icon
          size={16}
          className="mt-0.5 shrink-0"
          style={{ color: KC.muted }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-mono text-[13px] font-bold"
              style={{ color: KC.ink }}
            >
              {row.woNumber}
            </span>
            <SrStatusChip
              tone={row.tone}
              alert={row.tone === 'delayed'}
              days={row.overdueDays}
            />
            {row.urgency === 2 ? (
              <span
                className="rounded px-1.5 text-[11px] font-bold"
                style={{ background: KC.safety, color: KC.onSafety }}
              >
                {t('sr.urgent')}
              </span>
            ) : null}
          </div>
          <div
            className="mt-1 text-[14px] font-semibold"
            style={{ color: KC.ink }}
          >
            {row.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('inventory.detail.close')}
          className="cursor-pointer p-1"
        >
          <X size={16} style={{ color: KC.ink }} />
        </button>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-3">
        <KcFieldRow
          k={t('sr.asset')}
          labelWidth={90}
          v={
            <Link
              to={`/mro2/assets/${row.craneId}`}
              className="hover:underline"
              style={{ color: KC.link }}
            >
              {row.craneName}
            </Link>
          }
        />
        <KcFieldRow
          k={t('sr.col.date')}
          labelWidth={90}
          v={fmtDate(row.date)}
        />
        {row.reporter ? (
          <KcFieldRow
            k={t('sr.panel.reporter')}
            labelWidth={90}
            v={
              <span className="inline-flex items-center gap-1">
                <Smartphone size={12} style={{ color: KC.muted }} />
                {row.reporter}
              </span>
            }
          />
        ) : null}
        {row.untriaged ? (
          <div
            className="my-2 rounded-[4px] px-3 py-2 text-[13px]"
            style={{
              background: KC.bgSubtle,
              border: `1px solid ${KC.production}`,
            }}
          >
            <div className="font-bold" style={{ color: KC.ink }}>
              {t('sr.unassigned')}
            </div>
            <Link
              to="/mro2/triage"
              className="mt-1 inline-flex items-center gap-1 font-semibold hover:underline"
              style={{ color: KC.link }}
            >
              <Inbox size={13} /> {t('sr.panel.toInbox')}
            </Link>
          </div>
        ) : editable ? (
          <div className="my-2">
            <SrAssignFields
              target={target}
              assignee={row.assignee}
              due={row.due.slice(0, 10)}
            />
          </div>
        ) : (
          <KcFieldRow
            k={t('sr.col.assignee')}
            labelWidth={90}
            v={row.assignee || '-'}
          />
        )}
        {repair?.correctiveAction ? (
          <KcFieldRow
            k={t('sr.work.action')}
            labelWidth={90}
            v={repair.correctiveAction}
          />
        ) : null}
        {partsReq ? (
          <div className="mt-3">
            <div
              className="mb-1 text-[12px] font-bold"
              style={{ color: KC.ink }}
            >
              {t('sr.panel.partsItems', { n: partsReq.items.length })}
            </div>
            <table className="w-full text-[12px]">
              <tbody>
                {partsReq.items.map((it) => {
                  const inv = inventory.find((i) => i.partId === it.partId);
                  const short = !inv || inv.availableQty < it.qty;
                  return (
                    <tr
                      key={it.partId}
                      className="border-b"
                      style={{ borderColor: KC.hairline }}
                    >
                      <td className="py-1 pr-2" style={{ color: KC.ink }}>
                        {it.partName}
                      </td>
                      <td
                        className="py-1 text-right tabular-nums"
                        style={{ color: KC.text }}
                      >
                        ×{it.qty}
                      </td>
                      <td
                        className="py-1 pl-2 text-right tabular-nums"
                        style={{ color: short ? KC.safety : KC.muted }}
                      >
                        {t('sr.panel.stock', { n: inv?.availableQty ?? 0 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {partsReq.fulfillment ? (
              <div className="mt-2 text-[12px]" style={{ color: KC.muted }}>
                {t('sr.panel.fulfilled', {
                  issued: partsReq.fulfillment.issued,
                  po: partsReq.fulfillment.poNumber ?? '-',
                })}
              </div>
            ) : partsReq.status === 'pending' && !row.untriaged ? (
              <div className="mt-2 flex gap-2">
                <KcButton
                  variant="teal"
                  className="flex-1 justify-center"
                  onClick={() => {
                    const res = triageParts(partsReq.id, 'approved');
                    if (res.ok)
                      toast.success(
                        t('triage.approved', { number: row.woNumber }),
                      );
                  }}
                >
                  {t('triage.approve')}
                </KcButton>
                <KcButton
                  className="flex-1 justify-center"
                  onClick={() => {
                    const res = triageParts(partsReq.id, 'cancelled');
                    if (res.ok)
                      toast.success(
                        t('triage.rejected', { number: row.woNumber }),
                      );
                  }}
                >
                  {t('triage.reject')}
                </KcButton>
              </div>
            ) : null}
          </div>
        ) : null}
        {photos.length > 0 ? (
          <div className="mt-3">
            <div
              className="mb-1 text-[12px] font-bold"
              style={{ color: KC.ink }}
            >
              {t('sr.panel.photos', { n: photos.length })}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <a
                  key={p.id}
                  href={p.objectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square overflow-hidden rounded"
                  style={{ background: KC.bgSubtle }}
                >
                  <img
                    src={p.objectUrl}
                    alt={p.fileName}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <div className="mb-1 text-[12px] font-bold" style={{ color: KC.ink }}>
            {t('timeline.title')}
          </div>
          <SrTimeline
            kind={row.kind}
            refId={row.key.slice(2)}
            side="office"
            by={t('timeline.office')}
          />
        </div>
      </div>

      {row.path ? (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: KC.hairline }}
        >
          <Link to={row.path} className="block w-full">
            <KcButton variant="teal" className="w-full justify-center">
              {t('sr.panel.fullDetail')}
            </KcButton>
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
