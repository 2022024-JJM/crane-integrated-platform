import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Download, FileText, Upload, X } from 'lucide-react';
import { useDocuments, useUploadDocument } from '@crane/features/compliance';
import type { DocumentType } from '@crane/domain/compliance';
import { KC, KC_FONT_DISPLAY, KC_FONT_MONO } from '../../../shared/ui/kc';
import { KcButton, KcFilterChip, KcFilterGroup, KcFilterRail } from '../../../shared/ui/kc-ui';
import { fmtDate } from '../../../shared/lib/service-status';
import { downloadCsv, toCsv, type CsvColumn } from '../../../shared/lib/export-csv';
import {
  buildDocumentRows,
  DOCUMENT_TYPES,
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

const CSV_COLUMNS: CsvColumn<DocumentRow>[] = [
  { header: 'Document', value: (r) => r.name },
  { header: 'Type', value: (r) => r.docType },
  { header: 'Origin', value: (r) => r.origin },
  { header: 'Asset', value: (r) => r.assetName },
  { header: 'Date', value: (r) => r.date },
  { header: 'By', value: (r) => r.by },
  { header: 'Detail', value: (r) => r.detail },
];

export function Mro2DocumentsPage() {
  const { t } = useTranslation('mro2');
  const [searchParams, setSearchParams] = useSearchParams();
  const { oshaReports, certifications, uploads } = useDocuments();
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

  // 파일 선택 — 바이트는 저장하지 않고 이름/크기만 메타데이터로 등록한다
  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const docType: DocumentType =
      ext === 'dwg' || ext === 'dxf' ? 'drawing' : ext === 'pdf' ? 'manual' : 'other';
    uploadDocument({
      fileName: file.name,
      docType,
      uploadedBy: t('common.customerName'),
      sizeBytes: file.size,
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex gap-6 pt-2">
      {/* 필터 레일 */}
      <div className="hidden lg:block">
        <div className="mb-2">
          <Link to="/mro2" className="flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
            <ChevronLeft size={14} /> {t('common.back')}
          </Link>
        </div>
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
            className="w-full border px-2 py-1 text-[11px] outline-none"
            style={{ borderColor: KC.border, color: KC.ink }}
          />
          <KcFilterGroup title={t('common.selectedCustomers')}>
            <div
              className="w-full px-2 py-1.5 text-[10.5px] leading-snug"
              style={{ background: KC.inverseBg, color: KC.inverseText }}
            >
              {t('common.customerName')}
              <div style={{ color: KC.inverseMuted }}>{t('common.customerAddress')}</div>
            </div>
          </KcFilterGroup>
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
        <div className="mb-1 flex items-center justify-between">
          <h2
            className="text-[18px] font-semibold tracking-wide"
            style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
          >
            {t('documents.title')}
          </h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
            <KcButton variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload size={12} /> {t('documents.upload')}
            </KcButton>
            <KcButton
              variant="teal"
              onClick={() => downloadCsv('documents.csv', toCsv(filtered, CSV_COLUMNS))}
            >
              <FileText size={12} /> {t('common.generateReport')}
            </KcButton>
          </div>
        </div>
        <div className="mb-3 text-[11px]" style={{ color: KC.muted }}>
          {t('documents.subtitle', { count: filtered.length })}
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-[12px]" style={{ color: KC.muted }}>
            {t('documents.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[11px]">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: KC.border, color: KC.muted }}>
                  <th className="py-1.5 pr-2 font-normal">{t('documents.colName')}</th>
                  <th className="py-1.5 pr-2 font-normal">{t('documents.colType')}</th>
                  <th className="py-1.5 pr-2 font-normal">{t('documents.colAsset')}</th>
                  <th className="py-1.5 pr-2 font-normal">{t('documents.colDate')}</th>
                  <th className="py-1.5 pr-2 font-normal">{t('documents.colBy')}</th>
                  <th className="py-1.5 font-normal">{t('documents.colDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="kc-hover cursor-pointer border-b"
                    style={{ borderColor: KC.hairline }}
                    onClick={() => openDoc(r.id)}
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
                    <td className="max-w-[150px] truncate py-1.5 pr-2" style={{ color: KC.text }}>
                      {r.assetName ?? '-'}
                    </td>
                    <td className="py-1.5 pr-2" style={{ color: KC.text }}>
                      {fmtDate(r.date)}
                    </td>
                    <td className="max-w-[110px] truncate py-1.5 pr-2" style={{ color: KC.text }}>
                      {r.by}
                    </td>
                    <td className="py-1.5" style={{ color: KC.muted }}>
                      {r.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 문서 상세 패널 (?doc= URL 단일 소스) */}
      {selected ? <DocumentInfoPanel row={selected} onClose={closeDoc} /> : null}
    </div>
  );
}

function DocumentInfoPanel({ row, onClose }: { row: DocumentRow; onClose: () => void }) {
  const { t } = useTranslation('mro2');

  const Field = ({ k, v }: { k: string; v: string }) => (
    <div className="flex py-0.5 text-[11px]">
      <span className="w-[110px] shrink-0 font-bold" style={{ color: KC.ink }}>
        {k}:
      </span>
      <span className="min-w-0 break-words" style={{ color: KC.text }}>
        {v}
      </span>
    </div>
  );

  return (
    <aside
      className="fixed top-14 right-0 bottom-0 z-40 w-[300px] overflow-y-auto border-l shadow-xl"
      style={{ borderColor: KC.border, background: KC.bg }}
    >
      <div className="flex items-start justify-between px-4 pt-4">
        <h3 className="pr-2 text-[13px] font-bold" style={{ color: KC.ink }}>
          {row.name}
        </h3>
        <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer">
          <X size={15} style={{ color: KC.ink }} />
        </button>
      </div>
      <div className="px-4 pb-4">
        <div className="mt-1 text-[10.5px]" style={{ color: KC.muted, fontFamily: KC_FONT_MONO }}>
          {t(`documents.origin.${row.origin}`)}
        </div>

        <div className="mt-3 border-t pt-2" style={{ borderColor: KC.hairline }}>
          <Field k={t('documents.colType')} v={t(`documents.type.${row.docType}`)} />
          <Field k={t('documents.colAsset')} v={row.assetName ?? '-'} />
          <Field k={t('documents.colDate')} v={fmtDate(row.date)} />
          <Field k={t('documents.colBy')} v={row.by} />
          <Field k={t('documents.colDetail')} v={row.detail || '-'} />
          {row.sizeBytes ? <Field k={t('documents.size')} v={formatSize(row.sizeBytes)} /> : null}
        </div>

        <div className="mt-4">
          <KcButton
            variant="outline"
            className="w-full justify-center"
            onClick={() =>
              downloadCsv(
                `${row.name.replace(/\.[^.]+$/, '')}.csv`,
                toCsv([row], CSV_COLUMNS),
              )
            }
          >
            <Download size={12} /> {t('documents.download')}
          </KcButton>
        </div>
      </div>
    </aside>
  );
}
