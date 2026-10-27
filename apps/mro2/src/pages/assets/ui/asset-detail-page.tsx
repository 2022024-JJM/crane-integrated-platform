import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  ChevronLeft,
  ClipboardCheck,
  Download,
  Plus,
  Upload,
  Wrench,
} from 'lucide-react';
import { useAssetDetail, useAssetList } from '@crane/features/asset';
import { useOpenRisks } from '@crane/features/risk';
import { useDocuments, useUploadDocument } from '@crane/features/compliance';
import type { DocumentType } from '@crane/domain/compliance';
import { SrStatusChip } from '../../../shared/ui/sr-status-chip';
import { KC } from '../../../shared/ui/kc';
import { buildSrRows } from '../../../shared/lib/sr-rows';
import { AssetCardTiles } from './asset-card-tiles';
import { inspectionDue } from '../lib/asset-card-metrics';
import { KcButton, KcEmpty } from '../../../shared/ui/kc-ui';
import { fmtDate } from '../../../shared/lib/service-status';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import {
  buildDocumentRows,
  downloadDocumentRow,
} from '../../documents/lib/document-rows';
import { CraneThumb } from './crane-thumb';
import { CraneFrontView } from './crane-front-view';
import { MonitoringTab } from './monitoring-tab';

const Asset3dTab = lazy(() =>
  import('./asset-3d-tab').then((m) => ({ default: m.Asset3dTab })),
);

/** 관리자가 보는 순서 — 작업(미결) › 컨디션 › 3D › 정보. 문서는 정보 안에 있다. */
const TABS = [
  { key: 'work', labelKey: 'detail.tabWork' },
  { key: 'monitoring', labelKey: 'detail.tabCondition' },
  { key: '3d', labelKey: 'detail.tab3d' },
  { key: 'info', labelKey: 'detail.tabInfo' },
] as const;

const STATUS_LABEL_KEY: Record<string, string> = {
  operating: 'assets.statusOperating',
  inspection: 'assets.statusInspection',
  repair: 'assets.statusRepair',
  idle: 'assets.statusIdle',
};

type TabKey = (typeof TABS)[number]['key'];

export function Mro2AssetDetailPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const { craneId = '' } = useParams<{ craneId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openTicket } = useNewTicket();
  const { asset, components, inspections, repairs } = useAssetDetail(craneId);
  const { craneHealthMap, craneComponentStatsMap, craneNextInspectionMap } =
    useAssetList();
  const [now] = useState(() => Date.now());
  const { safety, production } = useOpenRisks();

  const rawTab = searchParams.get('tab');
  const tab: TabKey =
    rawTab && TABS.some((x) => x.key === rawTab) ? (rawTab as TabKey) : 'work';
  const [showAll, setShowAll] = useState(false);
  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (t === 'work') next.delete('tab');
    else next.set('tab', t);
    setSearchParams(next);
  };

  if (!asset) {
    return (
      <div className="pt-8 text-center text-[14px]" style={{ color: KC.muted }}>
        {t('mro2:assets.notFound')}{' '}
        <Link to="/mro2/assets" style={{ color: KC.link }}>
          {t('mro2:assets.backToFleet')}
        </Link>
      </div>
    );
  }

  const safetyCount = safety.filter((r) => r.craneId === craneId).length;
  const productionCount = production.filter(
    (r) => r.craneId === craneId,
  ).length;
  const openInspections = inspections.filter(
    (w) => w.status !== 'completed' && w.status !== 'cancelled',
  );
  const openRepairs = repairs.filter((w) => w.status !== 'completed');
  const openWoCount = openInspections.length + openRepairs.length;
  const workRows = buildSrRows(
    showAll ? inspections : openInspections,
    showAll ? repairs : openRepairs,
    [],
    null,
    {
      inspectionProduct: (woType) =>
        t('mro2:detail.typeInspection', {
          type: t(`calendar:type.${woType}`),
        }),
      onCallRepair: t('mro2:sr.onCallRepair'),
      plannedRepair: t('mro2:sr.plannedRepairs'),
      partsRequest: t('mro2:ticket.typeParts'),
      partsTitle: (first, qty) => `${first} ×${qty}`,
    },
    now,
  );

  return (
    <div className="pt-1">
      <Link
        to="/mro2/assets"
        className="mb-2 flex items-center gap-1 text-[13px]"
        style={{ color: KC.ink }}
      >
        <ChevronLeft size={14} /> {t('mro2:common.back')}
      </Link>

      {/* 1행: 정체(이름·상태·모델) + 행동 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CraneThumb craneType={asset.craneType} size={42} />
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-[16px] font-bold tracking-wide"
                style={{ color: KC.ink }}
              >
                {asset.name}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                style={
                  asset.status === 'operating'
                    ? { background: KC.ok, color: KC.onOk }
                    : asset.status === 'repair'
                      ? { background: KC.safety, color: KC.onSafety }
                      : { background: KC.bgRow, color: KC.ink }
                }
              >
                {STATUS_LABEL_KEY[asset.status]
                  ? t(`mro2:${STATUS_LABEL_KEY[asset.status]}`)
                  : asset.status}
              </span>
            </div>
            <div className="text-[12px]" style={{ color: KC.muted }}>
              {asset.model} · {asset.locationZone}
            </div>
          </div>
        </div>
        <KcButton variant="teal" onClick={() => openTicket('repair', craneId)}>
          <Plus size={12} /> {t('mro2:common.newServiceRequest')}
        </KcButton>
      </div>

      {/* 2행: 상태 띠 — 목록 카드와 같은 4타일. 탭을 바꿔도 남는다 */}
      <div className="mt-3 border-y" style={{ borderColor: KC.hairline }}>
        <AssetCardTiles
          health={craneHealthMap[craneId]}
          stats={craneComponentStatsMap[craneId]}
          openInspections={openInspections.length}
          openRepairs={openRepairs.length}
          due={inspectionDue(craneNextInspectionMap[craneId], now)}
          layout="row"
        />
      </div>

      {/* 3행: 탭 */}
      <nav
        className="mb-4 flex gap-6 border-b text-[13px]"
        style={{ borderColor: KC.border }}
      >
        {TABS.map((tabDef) => (
          <button
            key={tabDef.key}
            type="button"
            onClick={() => setTab(tabDef.key)}
            className="-mb-px cursor-pointer py-2.5"
            style={{
              color: tab === tabDef.key ? KC.ink : KC.muted,
              fontWeight: tab === tabDef.key ? 700 : 500,
              borderBottom:
                tab === tabDef.key
                  ? `2px solid ${KC.ink}`
                  : '2px solid transparent',
            }}
          >
            {t(`mro2:${tabDef.labelKey}`)}
          </button>
        ))}
      </nav>

      {/* ── 작업 ── */}
      {tab === 'work' ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            {(
              [
                [false, t('mro2:detail.filterOpen', { n: openWoCount })],
                [
                  true,
                  t('mro2:detail.filterAll', {
                    n: inspections.length + repairs.length,
                  }),
                ],
              ] as const
            ).map(([all, label]) => (
              <button
                key={String(all)}
                type="button"
                onClick={() => setShowAll(all)}
                className="h-7 cursor-pointer rounded-[4px] px-2.5 text-[12px] font-bold"
                style={{
                  background: showAll === all ? KC.inverseBg : KC.bg,
                  color: showAll === all ? KC.inverseText : KC.ink,
                  border: `1px solid ${showAll === all ? KC.inverseBg : KC.border}`,
                }}
              >
                {label}
              </button>
            ))}
            <span
              className="ml-auto flex items-center gap-2 text-[12px]"
              style={{ color: KC.muted }}
            >
              <span style={{ color: safetyCount > 0 ? KC.safety : KC.muted }}>
                {t('mro2:detail.safetyRisks')} {safetyCount}
              </span>
              <span
                style={{
                  color: productionCount > 0 ? KC.production : KC.muted,
                }}
              >
                {t('mro2:detail.productionRisks')} {productionCount}
              </span>
            </span>
          </div>
          {workRows.length === 0 ? (
            <KcEmpty>{t('mro2:detail.noOpenItems')}</KcEmpty>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {workRows.map((r) => (
                  <tr
                    key={r.key}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(r.path)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(r.path);
                      }
                    }}
                    className="kc-hover cursor-pointer border-t"
                    style={{ borderColor: KC.hairline }}
                  >
                    <td
                      className="w-[110px] py-2 pr-3 whitespace-nowrap tabular-nums"
                      style={{ color: KC.muted }}
                    >
                      {fmtDate(r.date)}
                    </td>
                    <td className="w-[70px] py-2 pr-3">
                      <SrStatusChip
                        tone={r.tone}
                        alert={r.tone === 'delayed'}
                      />
                    </td>
                    <td
                      className="w-[120px] py-2 pr-3 font-mono text-[12px] whitespace-nowrap"
                      style={{ color: KC.text }}
                    >
                      {r.woNumber}
                    </td>
                    <td className="max-w-0 py-2 pr-3">
                      <span
                        className="flex items-center gap-1.5 font-semibold"
                        style={{ color: KC.ink }}
                      >
                        {r.kind === 'repair' ? (
                          <Wrench
                            size={12}
                            className="shrink-0"
                            style={{ color: KC.muted }}
                          />
                        ) : (
                          <ClipboardCheck
                            size={12}
                            className="shrink-0"
                            style={{ color: KC.muted }}
                          />
                        )}
                        <span className="truncate">{r.title}</span>
                      </span>
                    </td>
                    <td
                      className="w-[140px] py-2 text-right whitespace-nowrap"
                      style={{ color: KC.text }}
                    >
                      {r.assignee || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {/* ── 3D View ── */}
      {tab === '3d' ? (
        <Suspense
          fallback={
            <div
              className="py-16 text-center text-[13px]"
              style={{ color: KC.muted }}
            >
              {t('mro2:detail.loading3d')}
            </div>
          }
        >
          <Asset3dTab asset={asset} components={components} />
        </Suspense>
      ) : null}

      {/* ── Remote Monitoring ── */}
      {tab === 'monitoring' ? (
        <MonitoringTab
          craneId={craneId}
          components={components}
          inspections={inspections}
          repairs={repairs}
        />
      ) : null}

      {/* ── Asset Info ── */}
      {tab === 'info' ? (
        <div className="grid grid-cols-1 items-stretch gap-6 pt-4 lg:grid-cols-2">
          {/* 제원 표 */}
          <div className="min-w-0">
            <InfoRow k={t('mro2:info.manufacturer')} v={asset.manufacturer} />
            <InfoRow k={t('mro2:info.model')} v={asset.model} />
            <InfoRow k={t('mro2:info.serialNumber')} v={asset.serialNumber} />
            <InfoRow k={t('mro2:info.capacity')} v={`${asset.capacityTon} t`} />
            {asset.spanM ? (
              <InfoRow k={t('mro2:info.span')} v={`${asset.spanM} m`} />
            ) : null}
            {asset.liftHeightM ? (
              <InfoRow
                k={t('mro2:info.liftHeight')}
                v={`${asset.liftHeightM} m`}
              />
            ) : null}
            <InfoRow
              k={t('mro2:info.manufactureDate')}
              v={fmtDate(asset.manufactureDate)}
            />
            <InfoRow
              k={t('mro2:info.installationDate')}
              v={fmtDate(asset.installationDate)}
            />
            <InfoRow
              k={t('mro2:info.warranty')}
              v={`${fmtDate(asset.warrantyStart)} – ${fmtDate(asset.warrantyEnd)}`}
            />
            <InfoRow k={t('mro2:info.site')} v={asset.siteName} />
            <InfoRow k={t('mro2:info.location')} v={asset.locationZone} />
            <InfoRow
              k={t('mro2:info.indoorOutdoor')}
              v={t(`mro2:info.${asset.indoorOutdoor}`, {
                defaultValue: asset.indoorOutdoor,
              })}
            />
            <InfoRow
              k={t('mro2:info.oshaClassification')}
              v={asset.oshaClassification}
            />
            <InfoRow
              k={t('mro2:info.status')}
              v={
                STATUS_LABEL_KEY[asset.status]
                  ? t(`mro2:${STATUS_LABEL_KEY[asset.status]}`)
                  : asset.status
              }
            />
          </div>

          {/* 정면 3D 뷰 — 우측 절반을 꽉 채운다 (높이는 좌측 표에 맞춰 늘어남) */}
          <div className="min-w-0">
            <CraneFrontView
              craneType={asset.craneType}
              caption={t('mro2:info.frontViewCaption', { name: asset.name })}
              fill
            />
          </div>
          <div className="lg:col-span-2">
            <AssetDocumentsTab craneId={craneId} craneName={asset.name} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      className="flex border-b py-1.5 text-[13px]"
      style={{ borderColor: KC.hairline }}
    >
      <span className="w-[180px] shrink-0 font-bold" style={{ color: KC.ink }}>
        {k}
      </span>
      <span style={{ color: KC.text }}>{v}</span>
    </div>
  );
}

/* Documents 탭 — 이 자산의 문서만 (매뉴얼 5p 자산 상세 Documents 탭) */
function AssetDocumentsTab({
  craneId,
  craneName,
}: {
  craneId: string;
  craneName: string;
}) {
  const { t } = useTranslation('mro2');
  const { oshaReports, uploads } = useDocuments();
  const uploadDocument = useUploadDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  // 인증서는 자산 귀속이 아니므로 제외 — 이 자산의 보고서/업로드만 남긴다
  const rows = useMemo(
    () =>
      buildDocumentRows({ oshaReports, certifications: [], uploads }).filter(
        (r) => r.craneId === craneId,
      ),
    [oshaReports, uploads, craneId],
  );

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const docType: DocumentType =
      ext === 'dwg' || ext === 'dxf'
        ? 'drawing'
        : ext === 'pdf'
          ? 'manual'
          : 'other';
    uploadDocument({
      fileName: file.name,
      docType,
      craneId,
      craneName,
      uploadedBy: t('common.customerName'),
      sizeBytes: file.size,
      objectUrl: URL.createObjectURL(file),
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px]" style={{ color: KC.ink }}>
          {t('documents.assetDocs', { count: rows.length })}
        </h3>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
        <KcButton variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload size={12} /> {t('documents.upload')}
        </KcButton>
      </div>
      {rows.length === 0 ? (
        <KcEmpty>{t('documents.emptyAsset')}</KcEmpty>
      ) : (
        <div className="flex flex-col">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border-b py-2 text-[13px]"
              style={{ borderColor: KC.hairline }}
            >
              <span
                className="min-w-0 flex-1 truncate"
                style={{ color: KC.ink }}
              >
                {row.name}
              </span>
              <span
                className="w-[130px] shrink-0 truncate"
                style={{ color: KC.muted }}
              >
                {t(`documents.type.${row.docType}`)}
              </span>
              <span
                className="w-[90px] shrink-0 text-[12px]"
                style={{ color: KC.faint }}
              >
                {fmtDate(row.date)}
              </span>
              <button
                type="button"
                onClick={() => downloadDocumentRow(row)}
                className="flex cursor-pointer items-center gap-1 text-[12px]"
                style={{ color: KC.link }}
              >
                <Download size={12} /> {t('documents.download')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
