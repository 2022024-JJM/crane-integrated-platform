import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, ClipboardCheck, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useEntityTicks } from '@crane/features/shared';
import { useDocuments, useUploadDocument } from '@crane/features/compliance';
import { useInspectionList } from '@crane/features/inspection';
import {
  useMaintenanceList,
  useRepairWorkProgress,
} from '@crane/features/maintenance';
import { getAllPartsRequests } from '@crane/domain/inventory';
import { KC } from '../../../shared/ui/kc';
import { useIsMobile } from '@crane/core/lib/use-is-mobile';
import { fmtDate } from '../../../shared/lib/service-status';
import {
  FIELD_PATH,
  fieldInspectPath,
  type FieldKind,
} from '../lib/field-route';
import {
  collectMyTickets,
  myTicketTone,
  type MyTicketRow,
} from '../lib/my-tickets';
import { useFieldWorker } from '../lib/field-storage';
import { FieldBigButton, FieldChip, FieldShell } from './field-shell';
import { SrTimeline } from '../../../shared/ui/sr-timeline';

/**
 * 현장용 티켓 상세 — 번호·장비·내용·상태·날짜·첨부 사진. 휴대폰에서는 포털
 * 상세 페이지로 갈 수 없으므로(레이아웃이 현장 홈으로 되돌린다) 여기서
 * 보여 주고, 데스크톱에서만 포털 상세 링크를 둔다.
 */
export function FieldTicketDetail({
  kind,
  id,
}: {
  kind: FieldKind;
  id: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [worker] = useFieldWorker();
  const upload = useUploadDocument();
  const work = useRepairWorkProgress();
  const [completing, setCompleting] = useState(false);
  const [action, setAction] = useState('');
  const { repairs } = useMaintenanceList();
  const { inspections } = useInspectionList();
  // 부품 요청·업로드 목록은 같은 배열을 제자리 수정하므로 참조로는 변화를
  // 못 잡는다 — 구독 tick 을 메모 의존성에 함께 둔다.
  const partsTick = useEntityTicks(['parts']);
  const docsTick = useEntityTicks(['compliance']);
  const { uploads } = useDocuments();
  // 보고자와 무관하게 id 로 찾는다 — 중복 신고 안내에서 남의 신고로도 들어온다.
  const row: MyTicketRow | undefined = useMemo(
    () =>
      collectMyTickets(
        '*',
        repairs,
        inspections,
        getAllPartsRequests(),
        1000,
      ).find((r) => r.kind === kind && r.id === id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repairs, inspections, partsTick, kind, id],
  );
  const photos = useMemo(
    () =>
      row
        ? uploads.filter((d) => d.refWoNumber === row.number && d.objectUrl)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploads, docsTick, row],
  );
  const back = () => navigate(`${FIELD_PATH}/tickets`);

  if (!row) {
    return (
      <FieldShell
        title={t('mro2:field.myTickets')}
        onBack={back}
        backLabel={t('mro2:field.back')}
      >
        <p className="py-6 text-[15px]" style={{ color: KC.muted }}>
          {t('mro2:field.ticketNotFound')}
        </p>
      </FieldShell>
    );
  }
  const tone = myTicketTone(row.status);
  const statusLabel =
    kind === 'parts'
      ? t(`mro2:field.tone.${tone}`)
      : t(`mro2:woStatus.${row.status}`);
  const rows: Array<[string, string]> = [
    [t('mro2:field.confirm.asset'), row.craneName],
    [t('mro2:field.detail.status'), statusLabel],
    [t('mro2:field.detail.date'), fmtDate(row.date)],
    [
      kind === 'parts'
        ? t('mro2:field.confirm.parts')
        : kind === 'inspection'
          ? t('mro2:field.confirm.findings')
          : t('mro2:field.confirm.symptom'),
      row.title || '—',
    ],
  ];
  if (kind === 'repair' && row.action)
    rows.push([t('mro2:field.work.action'), row.action]);
  const canStart =
    kind === 'repair' &&
    row.status !== 'in_progress' &&
    row.status !== 'completed';
  const canComplete = kind === 'repair' && row.status === 'in_progress';
  const canInspect =
    kind === 'inspection' &&
    row.status !== 'completed' &&
    row.status !== 'cancelled';
  const ACTION_PRESETS = [
    'partReplaced',
    'adjusted',
    'cleaned',
    'tempFix',
  ] as const;
  const toggleAction = (label: string) =>
    setAction((cur) => {
      const parts = cur.split(', ').filter(Boolean);
      return parts.includes(label)
        ? parts.filter((x) => x !== label).join(', ')
        : [...parts, label].join(', ');
    });
  const portalPath =
    kind === 'parts'
      ? '/mro2/inventory'
      : `/mro2/service-requests/${kind}/${id}`;
  return (
    <FieldShell
      title={row.number}
      onBack={back}
      backLabel={t('mro2:field.back')}
    >
      <div className="mb-3 text-[14px]" style={{ color: KC.muted }}>
        {t(`mro2:field.kind.${kind}`)}
      </div>
      <dl
        className="flex flex-col divide-y"
        style={{ borderColor: KC.hairline }}
      >
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 py-3">
            <dt
              className="w-24 shrink-0 text-[14px]"
              style={{ color: KC.muted }}
            >
              {k}
            </dt>
            <dd
              className="min-w-0 flex-1 text-[15px] break-words"
              style={{ color: KC.ink }}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
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
      ) : null}
      {canInspect ? (
        <div className="mt-4">
          <FieldBigButton onClick={() => navigate(fieldInspectPath(row.id))}>
            <ClipboardCheck size={18} /> {t('mro2:field.inspect.start')}
          </FieldBigButton>
        </div>
      ) : null}
      {canStart ? (
        <div className="mt-4">
          <FieldBigButton
            onClick={() => {
              if (work.start(row.id, worker))
                toast.success(
                  t('mro2:field.work.started', { number: row.number }),
                );
            }}
          >
            <Play size={18} /> {t('mro2:field.work.start')}
          </FieldBigButton>
        </div>
      ) : null}
      {canComplete && !completing ? (
        <div className="mt-4">
          <FieldBigButton onClick={() => setCompleting(true)}>
            <CheckCircle2 size={18} /> {t('mro2:field.work.complete')}
          </FieldBigButton>
        </div>
      ) : null}
      {canComplete && completing ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="text-[14px] font-semibold" style={{ color: KC.ink }}>
            {t('mro2:field.work.actionTitle')}
          </div>
          <div className="flex flex-wrap gap-2">
            {ACTION_PRESETS.map((k) => {
              const label = t(`mro2:field.work.preset.${k}`);
              return (
                <FieldChip
                  key={k}
                  label={label}
                  active={action.split(', ').includes(label)}
                  onClick={() => toggleAction(label)}
                />
              );
            })}
          </div>
          <textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            rows={3}
            placeholder={t('mro2:field.work.actionPlaceholder')}
            className="w-full rounded p-3 text-[16px]"
            style={{
              background: KC.bg,
              border: `1px solid ${KC.borderStrong}`,
              color: KC.ink,
              borderRadius: KC.radius,
            }}
          />
          <label
            className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded text-[15px] font-bold"
            style={{
              border: `1px dashed ${KC.borderStrong}`,
              color: KC.ink,
              borderRadius: KC.radius,
            }}
          >
            <Camera size={18} /> {t('mro2:field.detail.addPhoto')}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                for (const file of Array.from(e.target.files ?? [])) {
                  upload({
                    fileName: file.name,
                    docType: 'other',
                    uploadedBy: worker || t('mro2:field.reporter'),
                    sizeBytes: file.size,
                    objectUrl: URL.createObjectURL(file),
                    refWoNumber: row.number,
                  });
                }
                e.target.value = '';
              }}
            />
          </label>
          <FieldBigButton
            disabled={action.trim().length === 0}
            onClick={() => {
              if (work.complete(row.id, action, worker)) {
                toast.success(
                  t('mro2:field.work.completed', { number: row.number }),
                );
                setCompleting(false);
              }
            }}
          >
            <CheckCircle2 size={18} /> {t('mro2:field.work.sendComplete')}
          </FieldBigButton>
          <FieldBigButton
            variant="outline"
            onClick={() => setCompleting(false)}
          >
            {t('mro2:field.back')}
          </FieldBigButton>
        </div>
      ) : null}
      <label
        className="mt-4 flex h-12 cursor-pointer items-center justify-center gap-2 rounded text-[15px] font-bold"
        style={{
          border: `1px dashed ${KC.borderStrong}`,
          color: KC.ink,
          borderRadius: KC.radius,
        }}
      >
        <Camera size={18} /> {t('mro2:field.detail.addPhoto')}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            for (const file of Array.from(e.target.files ?? [])) {
              upload({
                fileName: file.name,
                docType: 'other',
                uploadedBy: worker || t('mro2:field.reporter'),
                sizeBytes: file.size,
                objectUrl: URL.createObjectURL(file),
                refWoNumber: row.number,
              });
            }
            e.target.value = '';
          }}
        />
      </label>
      <div className="mt-5">
        <div
          className="mb-2 text-[13px] font-semibold"
          style={{ color: KC.muted }}
        >
          {t('mro2:timeline.title')}
        </div>
        <SrTimeline kind={kind} refId={row.id} side="field" by={worker} big />
      </div>
      {!isMobile ? (
        <Link
          to={portalPath}
          className="mt-6 inline-block text-[14px]"
          style={{ color: KC.link }}
        >
          {t('mro2:field.detail.openPortal')}
        </Link>
      ) : null}
    </FieldShell>
  );
}
