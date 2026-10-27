import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { Download, FileText, Upload, X } from 'lucide-react';
import {
  useDocuments,
  useRequestCertRenewal,
  useCompleteCertRenewal,
  useUploadDocument,
} from '@crane/features/compliance';
import type { DocumentType } from '@crane/domain/compliance';
import { KC } from '../../../shared/ui/kc';
import {
  KcButton,
  KcEmpty,
  KcFieldRow,
  KcFilterChip,
  KcFilterGroup,
  KcFilterRail,
  KcSectionHeading,
} from '../../../shared/ui/kc-ui';
import { fmtDate } from '../../../shared/lib/service-status';
import { downloadCsv, toCsv } from '../../../shared/lib/export-csv';
import {
  buildDocumentRows,
  DOCUMENT_CSV_COLUMNS,
  DOCUMENT_TYPES,
  downloadDocumentRow,
  filterDocumentRows,
  formatSize,
  type DocumentRow,
} from '../lib/document-rows';

/** 문서 유형별 좌측 색 — 자동 생성물과 업로드를 시각적으로 구분 */
const TYPE_COLOR: Record<DocumentType, string> = {
  inspection_report: KC.s1,
  certificate: KC.ok,
  manual: KC.s3,
  drawing: KC.s4,
  contract: KC.planned,
  other: KC.muted,
};

export function Mro2DocumentsPage() {
  const { t } = useTranslation('mro2');
  const [searchParams, setSearchParams] = useSearchParams();
  const { oshaReports, certifications, uploads } = useDocuments();
  const requestRenewal = useRequestCertRenewal();
  const completeRenewal = useCompleteCertRenewal();
  const [renewing, setRenewing] = useState<{ id: string; date: string } | null>(
    null,
  );
  const uploadDocument = useUploadDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  const [types, setTypes] = useState<Set<DocumentType>>(new Set());
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () => buildDocumentRows({ oshaReports, certifications, uploads }),
    [oshaReports, certifications, uploads],
  );
  const filtered = useMemo(
    () => filterDocumentRows(rows, { types, query }),
    [rows, types, query],
  );

  const selectedId = searchParams.get('doc');
  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const openDoc = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('doc', id);
    setSearchParams(next);
  };
  const closeDoc = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('doc');
    setSearchParams(next);
  };

  const toggleType = (ty: DocumentType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(ty)) next.delete(ty);
      else next.add(ty);
      return next;
    });

  // 파일 선택 — 메타데이터 + 세션 한정 object URL 로 등록해 실파일 다운로드를 지원한다
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
      uploadedBy: t('common.customerName'),
      sizeBytes: file.size,
      objectUrl: URL.createObjectURL(file),
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex gap-6 pt-2">
      {/* 필터 레일 */}
      <div className="hidden lg:block">
        <KcFilterRail
          selectedCount={types.size}
          onClear={() => {
            setTypes(new Set());
            setQuery('');
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('documents.search')}
            className="w-full border px-2 py-1 text-[12px]"
            style={{ borderColor: KC.border, color: KC.ink }}
          />
          <KcFilterGroup title={t('documents.typeTitle')}>
            {DOCUMENT_TYPES.map((ty) => (
              <KcFilterChip
                key={ty}
                label={t(`documents.type.${ty}`)}
                tone={TYPE_COLOR[ty]}
                active={types.has(ty)}
                onClick={() => toggleType(ty)}
              />
            ))}
          </KcFilterGroup>
        </KcFilterRail>
      </div>

      {/* 본문 */}
      <div className="min-w-0 flex-1">
        <KcSectionHeading
          right={
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              <KcButton
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={12} /> {t('documents.upload')}
              </KcButton>
              <KcButton
                variant="teal"
                onClick={() =>
                  downloadCsv(
                    'documents.csv',
                    toCsv(filtered, DOCUMENT_CSV_COLUMNS),
                  )
                }
              >
                <FileText size={12} /> {t('common.generateReport')}
              </KcButton>
            </div>
          }
        >
          {t('documents.title')}
        </KcSectionHeading>
        <div className="mb-3 text-[12px]" style={{ color: KC.muted }}>
          {t('documents.subtitle', { count: filtered.length })}
        </div>

        {filtered.length === 0 ? (
          <KcEmpty>{t('documents.empty')}</KcEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[12px]">
              <thead>
                <tr
                  className="border-b text-left"
                  style={{ borderColor: KC.border, color: KC.muted }}
                >
                  <th className="py-1.5 pr-2 font-normal">
                    {t('documents.colName')}
                  </th>
                  <th className="py-1.5 pr-2 font-normal">
                    {t('documents.colType')}
                  </th>
                  <th className="py-1.5 pr-2 font-normal">
                    {t('documents.colAsset')}
                  </th>
                  <th className="py-1.5 pr-2 font-normal">
                    {t('documents.colDate')}
                  </th>
                  <th className="py-1.5 pr-2 font-normal">
                    {t('documents.colBy')}
                  </th>
                  <th className="py-1.5 font-normal">
                    {t('documents.colDetail')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    className="kc-hover cursor-pointer border-b"
                    style={{ borderColor: KC.hairline }}
                    onClick={() => openDoc(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDoc(r.id);
                      }
                    }}
                  >
                    <td className="max-w-[260px] py-1.5 pr-2">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-3.5 w-[4px] shrink-0"
                          style={{ background: TYPE_COLOR[r.docType] }}
                        />
                        <span className="truncate" style={{ color: KC.link }}>
                          {r.name}
                        </span>
                      </span>
                    </td>
                    <td className="py-1.5 pr-2" style={{ color: KC.text }}>
                      {t(`documents.type.${r.docType}`)}
                    </td>
                    <td
                      className="max-w-[150px] truncate py-1.5 pr-2"
                      style={{ color: KC.text }}
                    >
                      {r.assetName ?? '-'}
                    </td>
                    <td className="py-1.5 pr-2" style={{ color: KC.text }}>
                      {fmtDate(r.date)}
                    </td>
                    <td
                      className="max-w-[110px] truncate py-1.5 pr-2"
                      style={{ color: KC.text }}
                    >
                      {r.by}
                    </td>
                    <td className="py-1.5" style={{ color: KC.muted }}>
                      {r.certStatus ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                            style={
                              r.certStatus === 'expired'
                                ? { background: KC.safety, color: KC.onSafety }
                                : r.certStatus === 'expiry_soon'
                                  ? {
                                      color: KC.production,
                                      border: `1px solid ${KC.production}`,
                                    }
                                  : {
                                      color: KC.muted,
                                      border: `1px solid ${KC.border}`,
                                    }
                            }
                          >
                            {t(`documents.certStatus.${r.certStatus}`)}
                          </span>
                          <span className="tabular-nums">
                            {fmtDate(r.expiryDate)}
                          </span>
                          {r.certStatus === 'expired' ||
                          r.certStatus === 'expiry_soon' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const undo = requestRenewal(r.certId!);
                                if (undo) {
                                  toast.success(
                                    t('documents.renewalRequested', {
                                      name: r.name,
                                    }),
                                    {
                                      action: {
                                        label: t('common:undo'),
                                        onClick: undo,
                                      },
                                    },
                                  );
                                }
                              }}
                              className="cursor-pointer text-[12px] font-semibold underline-offset-2 hover:underline"
                              style={{ color: KC.link }}
                            >
                              {t('documents.requestRenewal')}
                            </button>
                          ) : r.certStatus === 'renewing' ? (
                            renewing && renewing.id === r.certId ? (
                              <span
                                className="inline-flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="date"
                                  value={renewing.date}
                                  onChange={(e) =>
                                    setRenewing({
                                      id: r.certId!,
                                      date: e.target.value,
                                    })
                                  }
                                  className="h-6 rounded border px-1 text-[12px]"
                                  style={{
                                    borderColor: KC.border,
                                    color: KC.ink,
                                  }}
                                  aria-label={t('documents.newExpiry')}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      completeRenewal(r.certId!, renewing.date)
                                    ) {
                                      toast.success(
                                        t('documents.renewalDone', {
                                          name: r.name,
                                        }),
                                      );
                                      setRenewing(null);
                                    }
                                  }}
                                  className="cursor-pointer text-[12px] font-semibold"
                                  style={{ color: KC.link }}
                                >
                                  {t('documents.confirmRenewal')}
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const d = new Date();
                                  d.setFullYear(d.getFullYear() + 2);
                                  setRenewing({
                                    id: r.certId!,
                                    date: d.toISOString().slice(0, 10),
                                  });
                                }}
                                className="cursor-pointer text-[12px] font-semibold underline-offset-2 hover:underline"
                                style={{ color: KC.link }}
                              >
                                {t('documents.completeRenewal')}
                              </button>
                            )
                          ) : null}
                        </span>
                      ) : (
                        r.detail
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 문서 상세 패널 (?doc= URL 단일 소스) */}
      {selected ? (
        <DocumentInfoPanel row={selected} onClose={closeDoc} />
      ) : null}
    </div>
  );
}

function DocumentInfoPanel({
  row,
  onClose,
}: {
  row: DocumentRow;
  onClose: () => void;
}) {
  const { t } = useTranslation('mro2');

  return (
    <aside
      className="fixed top-[100px] right-0 bottom-0 z-30 w-[300px] overflow-y-auto border-l shadow-xl"
      style={{ borderColor: KC.border, background: KC.bg }}
    >
      <div className="flex items-start justify-between px-4 pt-4">
        <h3 className="pr-2 text-[14px] font-bold" style={{ color: KC.ink }}>
          {row.name}
        </h3>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="cursor-pointer"
        >
          <X size={15} style={{ color: KC.ink }} />
        </button>
      </div>
      <div className="px-4 pb-4">
        <div className="mt-1 text-[12px]" style={{ color: KC.muted }}>
          {t(`documents.origin.${row.origin}`)}
        </div>

        <div
          className="mt-3 border-t pt-2"
          style={{ borderColor: KC.hairline }}
        >
          <KcFieldRow
            labelWidth={110}
            k={t('documents.colType')}
            v={t(`documents.type.${row.docType}`)}
          />
          <KcFieldRow
            labelWidth={110}
            k={t('documents.colAsset')}
            v={row.assetName ?? '-'}
          />
          <KcFieldRow
            labelWidth={110}
            k={t('documents.colDate')}
            v={fmtDate(row.date)}
          />
          <KcFieldRow labelWidth={110} k={t('documents.colBy')} v={row.by} />
          <KcFieldRow
            labelWidth={110}
            k={t('documents.colDetail')}
            v={row.detail || '-'}
          />
          {row.sizeBytes ? (
            <KcFieldRow
              labelWidth={110}
              k={t('documents.size')}
              v={formatSize(row.sizeBytes)}
            />
          ) : null}
        </div>

        <div className="mt-4">
          <KcButton
            variant="outline"
            className="w-full justify-center"
            onClick={() => downloadDocumentRow(row)}
          >
            <Download size={12} /> {t('documents.download')}
          </KcButton>
        </div>
      </div>
    </aside>
  );
}
