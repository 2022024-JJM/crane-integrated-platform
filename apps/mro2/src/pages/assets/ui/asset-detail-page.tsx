import { lazy, Suspense, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Download, Plus, Upload } from 'lucide-react';
import { useAssetDetail } from '@crane/features/asset';
import { useOpenRisks } from '@crane/features/risk';
import { useDocuments, useUploadDocument } from '@crane/features/compliance';
import type { DocumentType } from '@crane/domain/compliance';
import { KC, KC_FONT_DISPLAY, KC_FONT_MONO, SERVICE_TONE_COLOR } from '../../../shared/ui/kc';
import { KcButton, KcEmpty, KcStat } from '../../../shared/ui/kc-ui';
import { i18n } from '@crane/core/config/i18n';
import {
  fmtDate,
  inspectionTone,
  repairTone,
  serviceToneLabel,
} from '../../../shared/lib/service-status';
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

const TABS = [
  { key: 'open', labelKey: 'detail.tabOpenItems' },
  { key: 'activity', labelKey: 'detail.tabActivities' },
  { key: '3d', labelKey: 'detail.tab3d' },
  { key: 'monitoring', labelKey: 'detail.tabMonitoring' },
  { key: 'documents', labelKey: 'detail.tabDocuments' },
  { key: 'info', labelKey: 'detail.tabInfo' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function Mro2AssetDetailPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const { craneId = '' } = useParams<{ craneId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openTicket } = useNewTicket();
  const { asset, components, inspections, repairs } = useAssetDetail(craneId);
  const { safety, production } = useOpenRisks();

  const tab = (searchParams.get('tab') as TabKey | null) ?? 'open';
  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (t === 'open') next.delete('tab');
    else next.set('tab', t);
    setSearchParams(next);
  };

  if (!asset) {
    return (
      <div className="pt-8 text-center text-[13px]" style={{ color: KC.muted }}>
        {t('mro2:assets.notFound')}{' '}
        <Link to="/mro2/assets" style={{ color: KC.link }}>
          {t('mro2:assets.backToFleet')}
        </Link>
      </div>
    );
  }

  const safetyCount = safety.filter((r) => r.craneId === craneId).length;
  const productionCount = production.filter((r) => r.craneId === craneId).length;
  const openInspections = inspections.filter(
    (w) => w.status !== 'completed' && w.status !== 'cancelled',
  );
  const openRepairs = repairs.filter((w) => w.status !== 'completed');
  const openWoCount = openInspections.length + openRepairs.length;

  return (
    <div className="pt-1">
      <Link to="/mro2/assets" className="mb-2 flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
        <ChevronLeft size={14} /> {t('mro2:common.back')}
      </Link>

      {/* 헤더 + 탭 */}
      <div className="flex flex-wrap items-center gap-4 border-b" style={{ borderColor: KC.border }}>
        <div className="flex items-center gap-2.5 pb-2">
          <CraneThumb craneType={asset.craneType} size={42} />
          <div>
            <div className="text-[16px] font-bold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
              {asset.name}
            </div>
            <div className="text-[10.5px]" style={{ color: KC.muted }}>
              {asset.model}
            </div>
          </div>
        </div>
        <nav className="flex flex-1 items-end gap-5 self-end text-[12px]">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              type="button"
              onClick={() => setTab(tabDef.key)}
              className="cursor-pointer pb-2"
              style={{
                color: KC.ink,
                fontWeight: tab === tabDef.key ? 700 : 400,
                borderBottom: tab === tabDef.key ? `2px solid ${KC.ink}` : '2px solid transparent',
              }}
            >
              {t(`mro2:${tabDef.labelKey}`)}
            </button>
          ))}
        </nav>
        <div className="pb-2">
          <KcButton variant="teal" onClick={() => openTicket('repair', craneId)}>
            <Plus size={12} /> {t('mro2:common.newServiceRequest')}
          </KcButton>
        </div>
      </div>

      {/* ── Open Items ── */}
      {tab === 'open' ? (
        <div className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px]" style={{ color: KC.ink }}>
              {t('mro2:detail.openItemsNow')}
            </h3>
          </div>
          <div className="mb-5 flex items-start gap-8">
            <KcStat value={safetyCount + productionCount + openWoCount} label={t('mro2:common.openItems')} size="lg" />
            <KcStat value={safetyCount} label={t('mro2:detail.safetyRisks')} tone={KC.safety} />
            <KcStat value={productionCount} label={t('mro2:detail.productionRisks')} tone={KC.production} />
            <KcStat value={openWoCount} label={t('mro2:common.openWos')} tone={KC.planned} />
          </div>
          <WoTimeline
            inspections={openInspections}
            repairs={openRepairs}
            navigate={(p) => navigate(p)}
          />
          {openWoCount === 0 ? (
            <KcEmpty>{t('mro2:detail.noOpenItems')}</KcEmpty>
          ) : null}
        </div>
      ) : null}

      {/* ── All Activities ── */}
      {tab === 'activity' ? (
        <div className="pt-4">
          <h3 className="mb-3 text-[13px]" style={{ color: KC.ink }}>
            {t('mro2:common.activities', { count: inspections.length + repairs.length })}
          </h3>
          <WoTimeline inspections={inspections} repairs={repairs} navigate={(p) => navigate(p)} />
        </div>
      ) : null}

      {/* ── 3D View ── */}
      {tab === '3d' ? (
        <Suspense
          fallback={
            <div className="py-16 text-center text-[12px]" style={{ color: KC.muted }}>
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

      {/* ── Documents ── */}
      {tab === 'documents' ? (
        <AssetDocumentsTab craneId={craneId} craneName={asset.name} />
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
            {asset.spanM ? <InfoRow k={t('mro2:info.span')} v={`${asset.spanM} m`} /> : null}
            {asset.liftHeightM ? <InfoRow k={t('mro2:info.liftHeight')} v={`${asset.liftHeightM} m`} /> : null}
            <InfoRow k={t('mro2:info.manufactureDate')} v={fmtDate(asset.manufactureDate)} />
            <InfoRow k={t('mro2:info.installationDate')} v={fmtDate(asset.installationDate)} />
            <InfoRow k={t('mro2:info.warranty')} v={`${fmtDate(asset.warrantyStart)} – ${fmtDate(asset.warrantyEnd)}`} />
            <InfoRow k={t('mro2:info.site')} v={asset.siteName} />
            <InfoRow k={t('mro2:info.location')} v={asset.locationZone} />
            <InfoRow k={t('mro2:info.indoorOutdoor')} v={asset.indoorOutdoor} />
            <InfoRow k={t('mro2:info.oshaClassification')} v={asset.oshaClassification} />
            <InfoRow k={t('mro2:info.status')} v={asset.status} />
          </div>

          {/* 정면 3D 뷰 — 우측 절반을 꽉 채운다 (높이는 좌측 표에 맞춰 늘어남) */}
          <div className="min-w-0">
            <CraneFrontView
              craneType={asset.craneType}
              caption={t('mro2:info.frontViewCaption', { name: asset.name })}
              fill
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex border-b py-1.5 text-[11.5px]" style={{ borderColor: KC.hairline }}>
      <span className="w-[180px] shrink-0 font-bold" style={{ color: KC.ink }}>
        {k}
      </span>
      <span style={{ color: KC.text }}>{v}</span>
    </div>
  );
}

/* WO 타임라인 (Open Items / All Activities 공용) */
function WoTimeline({
  inspections,
  repairs,
  navigate,
}: {
  inspections: ReturnType<typeof useAssetDetail>['inspections'];
  repairs: ReturnType<typeof useAssetDetail>['repairs'];
  navigate: (path: string) => void;
}) {
  const rows = [
    ...inspections.map((w) => ({
      key: `i-${w.id}`,
      date: w.actualDate ?? w.scheduledDate,
      tone: SERVICE_TONE_COLOR[inspectionTone(w.status, w.scheduledDate)],
      statusLabel: i18n.t('mro2:detail.srOf', { status: serviceToneLabel(inspectionTone(w.status, w.scheduledDate)) }),
      woNumber: w.woNumber,
      subtitle: i18n.t('mro2:detail.typeInspection', { type: i18n.t(`calendar:type.${w.woType}`) }),
      path: `/mro2/service-requests/inspection/${w.id}`,
      findings: w.checklistItems
        .filter((c) => c.judgment === 'fail')
        .map((c) => ({ name: c.itemName, tone: c.severity === 'critical' || c.severity === 'major' ? KC.safety : KC.production })),
    })),
    ...repairs.map((w) => ({
      key: `r-${w.id}`,
      date: w.actualEnd ?? w.scheduledStart,
      tone: SERVICE_TONE_COLOR[repairTone(w.status, w.scheduledEnd)],
      statusLabel: i18n.t('mro2:detail.repairOf', { status: serviceToneLabel(repairTone(w.status, w.scheduledEnd)) }),
      woNumber: w.woNumber,
      subtitle: w.componentName,
      path: `/mro2/service-requests/repair/${w.id}`,
      findings: [] as { name: string; tone: string }[],
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <div key={row.key} className="flex gap-3">
          <div className="w-[64px] shrink-0 pt-2 text-right text-[10px]" style={{ color: KC.faint }}>
            {fmtDate(row.date)}
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(row.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(row.path);
              }
            }}
            className="kc-hover mb-2 flex-1 cursor-pointer border"
            style={{ borderColor: KC.hairline, borderLeft: `4px solid ${row.tone}` }}
          >
            <div className="px-3 py-2">
              <div className="text-[10px]" style={{ color: KC.faint, fontFamily: KC_FONT_MONO }}>
                🔧 {row.woNumber}
              </div>
              <div className="text-[12px] font-bold" style={{ color: KC.ink }}>
                {row.statusLabel}
              </div>
              <div className="text-[10.5px]" style={{ color: KC.muted }}>
                {row.subtitle}
              </div>
            </div>
            {row.findings.length > 0 ? (
              <div className="border-t" style={{ borderColor: KC.hairline }}>
                {row.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-1 text-[10.5px]"
                    style={{ borderLeft: `3px solid ${f.tone}`, color: KC.text }}
                  >
                    {f.name}
                    <span style={{ color: KC.faint }}>{i18n.t('mro2:common.quote')} ⌄</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Documents 탭 — 이 자산의 문서만 (매뉴얼 5p 자산 상세 Documents 탭) */
function AssetDocumentsTab({ craneId, craneName }: { craneId: string; craneName: string }) {
  const { t } = useTranslation('mro2');
  const { oshaReports, certifications, uploads } = useDocuments();
  const uploadDocument = useUploadDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  // 인증서는 자산 귀속이 아니므로 제외 — 이 자산의 보고서/업로드만 남긴다
  const rows = useMemo(
    () =>
      buildDocumentRows({ oshaReports, certifications: [], uploads }).filter(
        (r) => r.craneId === craneId,
      ),
    [oshaReports, certifications, uploads, craneId],
  );

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const docType: DocumentType =
      ext === 'dwg' || ext === 'dxf' ? 'drawing' : ext === 'pdf' ? 'manual' : 'other';
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
        <h3 className="text-[13px]" style={{ color: KC.ink }}>
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
              className="flex items-center gap-3 border-b py-2 text-[11.5px]"
              style={{ borderColor: KC.hairline }}
            >
              <span className="min-w-0 flex-1 truncate" style={{ color: KC.ink }}>
                {row.name}
              </span>
              <span className="w-[130px] shrink-0 truncate" style={{ color: KC.muted }}>
                {t(`documents.type.${row.docType}`)}
              </span>
              <span className="w-[90px] shrink-0 text-[10.5px]" style={{ color: KC.faint }}>
                {fmtDate(row.date)}
              </span>
              <button
                type="button"
                onClick={() => downloadDocumentRow(row)}
                className="flex cursor-pointer items-center gap-1 text-[11px]"
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
