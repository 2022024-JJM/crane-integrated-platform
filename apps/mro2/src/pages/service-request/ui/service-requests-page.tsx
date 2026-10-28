import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Download,
  Package,
  Plus,
  Smartphone,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { useEntityTicks } from '@crane/features/shared';
import { useBulkWorkUpdate, type WorkTarget } from '@crane/features/triage';
import { dailyLoad } from '../../triage/lib/suggest-assignment';
import { spreadSchedule } from '../lib/spread-schedule';
import { getTechnicians } from '@crane/domain/shared';
import { toast } from 'sonner';
import { getAllPartsRequests } from '@crane/domain/inventory';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@crane/ui/molecules/pagination';
import {
  downloadCsv,
  toCsv,
  type CsvColumn,
} from '../../../shared/lib/export-csv';
import {
  SR_ALERT_CAP,
  SR_BUCKETS,
  applyAlertCap,
  buildSrRows,
  countBuckets,
  sortForAdmin,
  srBucket,
  type SrBucket,
  type SrRow,
} from '../../../shared/lib/sr-rows';
import { KC } from '../../../shared/ui/kc';
import { SrStatusChip } from '../../../shared/ui/sr-status-chip';
import { KcButton, KcEmpty, KcSectionHeading } from '../../../shared/ui/kc-ui';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import { fmtDate } from '../../../shared/lib/service-status';
import { useMro2Year } from '../../../shared/ui/layout';
import { SrDetailPanel } from './sr-detail-panel';
import { useAllNotes } from '@crane/features/notes';
import { useSeen } from '../../../shared/lib/seen-store';
import { unreadByRef } from '../../../shared/lib/timeline';

/** 담당자별 분배에서 담당자당 하루 상한 건수. */
const SPREAD_CAP = 2;
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
type Tab = 'active' | SrBucket | 'all';
const TABS: readonly Tab[] = ['active', ...SR_BUCKETS, 'all'];
const KIND_ICON = {
  repair: Wrench,
  inspection: ClipboardCheck,
  parts: Package,
} as const;

const CSV_COLUMNS: CsvColumn<SrRow>[] = [
  { header: 'Date', value: (r) => r.date },
  { header: 'Status', value: (r) => srBucket(r) },
  { header: 'Overdue days', value: (r) => r.overdueDays || '' },
  { header: 'Number', value: (r) => r.woNumber },
  { header: 'Subject', value: (r) => r.title },
  { header: 'Product', value: (r) => r.product },
  { header: 'Asset', value: (r) => r.craneName },
  { header: 'Assignee', value: (r) => r.assignee },
  { header: 'Reporter', value: (r) => r.reporter ?? '' },
  { header: 'Cost (USD)', value: (r) => r.cost },
];

/**
 * 서비스 요청 — 관리자의 작업대. 표 위 상태 탭(건수)이 곧 필터이고 기본은 미완료,
 * 정렬은 "지금 손댈 것" 순(지연 › 접수 › 진행 중 › 예정). 행을 누르면 오른쪽 패널에서
 * 담당·예정일을 바꾸고 사진을 본다. 여러 건은 체크해서 한 번에.
 */
export function Mro2ServiceRequestsPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const { openTicket } = useNewTicket();
  const { year } = useMro2Year();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();
  const partsTick = useEntityTicks(['parts']);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: Tab =
    rawTab && (TABS as readonly string[]).includes(rawTab)
      ? (rawTab as Tab)
      : 'active';
  const selKey = searchParams.get('sel');
  const notesOnly = searchParams.get('notes') === '1';
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const [assetQuery, setAssetQuery] = useState('');
  const notes = useAllNotes();
  const seen = useSeen('office');
  const unread = useMemo(
    () => unreadByRef(notes, 'office', seen),
    [notes, seen],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bulk = useBulkWorkUpdate();
  const [bulkDate, setBulkDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [bulkAssignee, setBulkAssignee] = useState(
    () => getTechnicians()[0]?.name ?? '',
  );

  const allRows = useMemo(
    () =>
      sortForAdmin(
        applyAlertCap(
          buildSrRows(
            inspections,
            repairs,
            getAllPartsRequests(),
            year,
            {
              inspectionProduct: (woType) =>
                t('mro2:detail.typeInspection', {
                  type: t(`calendar:type.${woType}`),
                }),
              onCallRepair: t('mro2:sr.onCallRepair'),
              plannedRepair: t('mro2:sr.plannedRepairs'),
              partsRequest: t('mro2:ticket.typeParts'),
              partsTitle: (first, qty, more) =>
                more > 0
                  ? t('mro2:sr.partsTitleMore', { first, qty, more })
                  : t('mro2:sr.partsTitle', { first, qty }),
            },
            now,
          ),
          SR_ALERT_CAP,
        ),
      ),
    // partsTick 은 부품 요청 배열이 바뀐 프레임을 잡는 구독값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inspections, repairs, partsTick, year, t, now],
  );
  const counts = useMemo(() => countBuckets(allRows), [allRows]);
  const tabCount = (k: Tab) =>
    k === 'all'
      ? allRows.length
      : k === 'active'
        ? allRows.length - counts.completed
        : counts[k];

  const q = assetQuery.trim().toLowerCase();
  const rows = allRows.filter(
    (r) =>
      (!notesOnly || (unread[`${r.kind}:${r.key.slice(2)}`] ?? 0) > 0) &&
      (tab === 'all' ||
        (tab === 'active'
          ? srBucket(r) !== 'completed'
          : srBucket(r) === tab)) &&
      (q === '' ||
        r.craneName.toLowerCase().includes(q) ||
        r.woNumber.toLowerCase().includes(q)),
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedRow = selKey
    ? (allRows.find((r) => r.key === selKey) ?? null)
    : null;

  const toggleSelected = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const bulkTargets: WorkTarget[] = allRows
    .filter((r) => selected.has(r.key) && r.kind !== 'parts')
    .map((r) => ({
      kind: r.kind as 'repair' | 'inspection',
      id: r.key.slice(2),
    }));
  const runBulk = (
    out: { changed: number; undo: () => void },
    msgKey: string,
    description?: string,
  ) => {
    toast.success(t(msgKey, { n: out.changed }), {
      description,
      action: out.changed
        ? { label: t('common:undo'), onClick: out.undo }
        : undefined,
    });
    setSelected(new Set());
  };
  /** 지연 건 담당자별 분배 — 오늘부터 평일에 담당자당 하루 SPREAD_CAP 건. */
  const runSpread = () => {
    const picked = allRows
      .filter((r) => selected.has(r.key) && r.kind !== 'parts')
      .map((r) => ({
        kind: r.kind as 'repair' | 'inspection',
        id: r.key.slice(2),
        assignee: r.assignee,
      }));
    const pickedIds = new Set(picked.map((p) => p.id));
    const load = (who: string, date: string) =>
      dailyLoad(
        {
          repairs: repairs.filter((w) => !pickedIds.has(w.id)),
          inspections: inspections.filter((w) => !pickedIds.has(w.id)),
        },
        who,
        date,
      );
    const today = new Date(now).toISOString().slice(0, 10);
    const { entries, skipped } = spreadSchedule(
      picked,
      today,
      load,
      SPREAD_CAP,
    );
    runBulk(
      bulk.rescheduleEach(entries),
      'mro2:sr.bulk.spreadDone',
      skipped > 0 ? t('mro2:sr.bulk.spreadSkipped', { n: skipped }) : undefined,
    );
  };
  const th = 'py-1.5 pr-3 font-semibold whitespace-nowrap';

  return (
    <div
      className={`min-w-0 transition-[padding] duration-300 ease-out ${selectedRow ? 'xl:pr-[calc(380px+1rem)]' : ''}`}
    >
      <KcSectionHeading
        right={
          <span className="flex items-center gap-2">
            <input
              value={assetQuery}
              onChange={(e) => {
                setAssetQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('mro2:sr.searchPlaceholder')}
              className="h-8 w-[220px] rounded-[4px] border px-2.5 text-[13px]"
              style={{
                borderColor: KC.border,
                color: KC.ink,
                background: KC.bg,
              }}
            />
            <KcButton
              variant="outline"
              onClick={() =>
                downloadCsv('service-requests.csv', toCsv(rows, CSV_COLUMNS))
              }
            >
              <Download size={13} /> {t('mro2:sr.exportCsv')}
            </KcButton>
            <KcButton variant="teal" onClick={() => openTicket('repair')}>
              <Plus size={13} /> {t('mro2:common.newServiceRequest')}
            </KcButton>
          </span>
        }
      >
        {t('mro2:sr.count', { count: rows.length })}
      </KcSectionHeading>

      {/* 상태 탭 — 건수가 곧 요약이고 탭이 곧 필터 */}
      <div
        className="mt-2 flex flex-wrap gap-1 border-b"
        style={{ borderColor: KC.border }}
      >
        {TABS.map((k) => {
          const n = tabCount(k);
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setParam('tab', k === 'active' ? null : k);
                setPage(1);
              }}
              className="-mb-px cursor-pointer px-3 py-2 text-[13px]"
              style={{
                color: active ? KC.ink : n === 0 ? KC.faint : KC.muted,
                fontWeight: active ? 700 : 500,
                borderBottom: active
                  ? `2px solid ${KC.ink}`
                  : '2px solid transparent',
              }}
            >
              {t(`mro2:sr.tabs.${k}`)}{' '}
              <span
                className="ml-0.5 rounded px-1 text-[11px] font-bold tabular-nums"
                style={{
                  background:
                    k === 'delayed' && n > 0
                      ? KC.safety
                      : k === 'received' && n > 0
                        ? KC.production
                        : KC.bgRow,
                  color:
                    (k === 'delayed' || k === 'received') && n > 0
                      ? KC.onSafety
                      : KC.muted,
                }}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {selected.size > 0 ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-3 rounded-[4px] px-3 py-2 text-[13px]"
          style={{ background: KC.inverseBg, color: KC.inverseText }}
        >
          <span className="font-bold">
            {t('mro2:sr.bulk.selected', { n: selected.size })}
          </span>
          <label className="flex items-center gap-1.5">
            {t('mro2:sr.bulk.date')}
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="h-7 rounded px-1.5 text-[12px]"
              style={{ background: KC.bg, color: KC.ink }}
            />
            <KcButton
              variant="teal"
              className="!py-0.5 !text-[12px]"
              onClick={() =>
                runBulk(
                  bulk.reschedule(bulkTargets, bulkDate),
                  'mro2:sr.bulk.rescheduled',
                )
              }
            >
              {t('mro2:sr.bulk.apply')}
            </KcButton>
          </label>
          <span className="flex items-center gap-1.5">
            <KcButton
              variant="outline"
              className="!py-0.5 !text-[12px]"
              onClick={runSpread}
            >
              {t('mro2:sr.bulk.spread')}
            </KcButton>
            <span className="text-[11px]" style={{ color: KC.inverseMuted }}>
              {t('mro2:sr.bulk.spreadHint', { cap: SPREAD_CAP })}
            </span>
          </span>
          <label className="flex items-center gap-1.5">
            {t('mro2:sr.bulk.assignee')}
            <select
              value={bulkAssignee}
              onChange={(e) => setBulkAssignee(e.target.value)}
              className="h-7 rounded px-1.5 text-[12px]"
              style={{ background: KC.bg, color: KC.ink }}
            >
              {getTechnicians().map((x) => (
                <option key={x.id} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
            <KcButton
              variant="teal"
              className="!py-0.5 !text-[12px]"
              onClick={() =>
                runBulk(
                  bulk.reassign(bulkTargets, bulkAssignee),
                  'mro2:sr.bulk.reassigned',
                )
              }
            >
              {t('mro2:sr.bulk.apply')}
            </KcButton>
          </label>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto cursor-pointer text-[12px] underline-offset-2 hover:underline"
            style={{ color: KC.inverseMuted }}
          >
            {t('mro2:sr.bulk.clear')}
          </button>
        </div>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px]" style={{ color: KC.muted }}>
              <th className="w-7 py-1.5 pr-1" />
              <th className={th}>{t('mro2:sr.col.date')}</th>
              <th className={th}>{t('mro2:sr.col.status')}</th>
              <th className={th}>{t('mro2:sr.col.number')}</th>
              <th className={`${th} w-full`}>{t('mro2:sr.col.title')}</th>
              <th className={th}>{t('mro2:sr.col.asset')}</th>
              <th className="py-1.5 font-semibold whitespace-nowrap">
                {t('mro2:sr.col.assignee')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const Icon = KIND_ICON[r.kind];
              const isSel = r.key === selKey;
              return (
                <tr
                  key={r.key}
                  role="button"
                  tabIndex={0}
                  aria-selected={isSel}
                  onClick={() => setParam('sel', isSel ? null : r.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setParam('sel', isSel ? null : r.key);
                    }
                  }}
                  className="kc-hover cursor-pointer border-t"
                  style={{
                    borderColor: KC.hairline,
                    background: isSel ? KC.bgSubtle : undefined,
                    boxShadow: r.alert
                      ? `inset 4px 0 0 ${KC.safety}`
                      : undefined,
                  }}
                >
                  <td className="py-2 pr-1 pl-1">
                    {r.kind !== 'parts' && r.tone !== 'completed' ? (
                      <input
                        type="checkbox"
                        aria-label={t('mro2:sr.bulk.select', {
                          number: r.woNumber,
                        })}
                        checked={selected.has(r.key)}
                        onChange={() => toggleSelected(r.key)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                      />
                    ) : null}
                  </td>
                  <td
                    className="py-2 pr-3 whitespace-nowrap tabular-nums"
                    style={{ color: KC.muted }}
                  >
                    {fmtDate(r.date)}
                  </td>
                  <td className="py-2 pr-3">
                    <SrStatusChip
                      tone={r.tone}
                      alert={r.alert}
                      days={r.overdueDays}
                    />
                  </td>
                  <td
                    className="py-2 pr-3 font-mono text-[12px] whitespace-nowrap"
                    style={{ color: KC.text }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {r.urgency > 0 ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          title={t(
                            r.urgency === 2 ? 'mro2:sr.urgent' : 'mro2:sr.high',
                          )}
                          style={{
                            background:
                              r.urgency === 2 ? KC.safety : KC.production,
                          }}
                        />
                      ) : null}
                      {r.woNumber}
                      {(unread[`${r.kind}:${r.key.slice(2)}`] ?? 0) > 0 ? (
                        <MessageSquare
                          size={12}
                          aria-label={t('mro2:sr.notesFilter')}
                          style={{ color: KC.teal }}
                        />
                      ) : null}
                    </span>
                  </td>
                  <td className="max-w-0 py-2 pr-3">
                    <span
                      className="flex items-center gap-1.5 font-semibold"
                      style={{ color: KC.ink }}
                    >
                      <Icon
                        size={12}
                        className="shrink-0"
                        style={{ color: KC.muted }}
                      />
                      <span className="truncate">{r.title}</span>
                    </span>
                  </td>
                  <td
                    className="py-2 pr-3 whitespace-nowrap"
                    style={{ color: KC.text }}
                  >
                    {r.craneName}
                  </td>
                  <td
                    className="py-2 whitespace-nowrap"
                    style={{ color: KC.text }}
                  >
                    {r.untriaged ? (
                      <span className="font-bold" style={{ color: KC.safety }}>
                        {t('mro2:sr.unassigned')}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1"
                        title={
                          r.reporter
                            ? t('mro2:sr.reportedBy', { name: r.reporter })
                            : undefined
                        }
                      >
                        {r.reporter ? (
                          <Smartphone size={11} style={{ color: KC.muted }} />
                        ) : null}
                        {r.assignee || '-'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <KcEmpty>{t('mro2:sr.noRequests')}</KcEmpty>
        ) : null}
        {rows.length > PAGE_SIZE_OPTIONS[0]! ? (
          <div className="mt-3">
            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        ) : null}
      </div>

      {selectedRow ? (
        <SrDetailPanel
          key={selectedRow.key}
          row={selectedRow}
          onClose={() => setParam('sel', null)}
        />
      ) : null}
    </div>
  );
}
