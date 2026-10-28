import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import {
  useInspectionDetail,
  useInspectionList,
  useSubmitAssignedInspection,
} from '@crane/features/inspection';
import { useUploadDocument } from '@crane/features/compliance';
import { KC } from '../../../shared/ui/kc';
import {
  FIELD_MAX_PHOTOS,
  addPhotos,
  type FieldDraft,
} from '../lib/field-draft';
import {
  buildFieldChecklist,
  checklistOutcome,
  defaultJudgments,
  failedItems,
  previousFailures,
  type FieldJudgments,
} from '../lib/field-checklist';
import { FIELD_PATH, fieldTicketPath } from '../lib/field-route';
import { useFieldWorker } from '../lib/field-storage';
import { FieldBigButton, FieldShell } from './field-shell';
import { FieldChecklistStep } from './field-checklist-step';
import { SymptomStep } from './field-step-views';

/**
 * 배정된 점검 수행 — 사무실이 잡아 둔 점검 WO 에 체크리스트 판정을 그대로 제출한다.
 * 새 WO 를 만들지 않으므로 예정 점검이 그 자리에서 닫힌다.
 */
export function FieldInspect({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [worker] = useFieldWorker();
  const { inspection } = useInspectionDetail(id);
  const { inspections } = useInspectionList();
  const submit = useSubmitAssignedInspection();
  const upload = useUploadDocument();
  // 전부 양호에서 시작 — 불량만 누른다.
  const [judgments, setJudgments] = useState<FieldJudgments>(() =>
    defaultJudgments(inspection?.checklistItems ?? []),
  );
  const [symptom, setSymptom] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const template = useMemo(
    () => inspection?.checklistItems ?? [],
    [inspection],
  );
  const recheck = useMemo(
    () =>
      inspection
        ? previousFailures(
            inspections,
            inspection.craneId,
            template,
            inspection.id,
          )
        : [],
    [inspections, inspection, template],
  );
  const outcome = checklistOutcome(template, judgments);
  const fails = failedItems(template, judgments).length;
  const back = () => navigate(fieldTicketPath('inspection', id));

  if (done) {
    return (
      <FieldShell title={t('mro2:field.inspect.title')}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 size={56} style={{ color: KC.ok }} />
          <div className="text-[20px] font-bold" style={{ color: KC.ink }}>
            {t('mro2:field.inspect.submitted')}
          </div>
          <div className="font-mono text-[18px]" style={{ color: KC.text }}>
            {done}
          </div>
          <p className="text-[14px]" style={{ color: KC.muted }}>
            {fails > 0
              ? t('mro2:field.inspect.submittedFail', { n: fails })
              : t('mro2:field.inspect.submittedPass')}
          </p>
          <div className="mt-4 w-full">
            <FieldBigButton
              variant="outline"
              onClick={() => navigate(FIELD_PATH)}
            >
              {t('mro2:field.done.home')}
            </FieldBigButton>
          </div>
        </div>
      </FieldShell>
    );
  }

  if (!inspection || inspection.status === 'completed') {
    return (
      <FieldShell
        title={t('mro2:field.inspect.title')}
        onBack={back}
        backLabel={t('mro2:field.back')}
      >
        <p className="py-6 text-[15px]" style={{ color: KC.muted }}>
          {inspection
            ? t('mro2:field.inspect.alreadyDone')
            : t('mro2:field.ticketNotFound')}
        </p>
      </FieldShell>
    );
  }

  const send = () => {
    if (!worker || outcome === null) return;
    const items = buildFieldChecklist(template, judgments);
    const res = submit(
      inspection.id,
      items.map((i) => ({
        id: i.id,
        judgment: i.judgment,
        actionRequired: i.actionRequired,
        comment:
          i.judgment === 'fail' && symptom.trim() ? symptom.trim() : i.comment,
      })),
      worker,
    );
    if (!res.ok) return;
    for (const photo of photos) {
      upload({
        fileName: photo.name,
        docType: 'other',
        craneId: inspection.craneId,
        craneName: inspection.craneName,
        uploadedBy: worker,
        sizeBytes: photo.size,
        objectUrl: URL.createObjectURL(photo),
        refWoNumber: inspection.woNumber,
      });
    }
    setDone(inspection.woNumber);
  };

  const draftForSymptom = { symptom } as FieldDraft;
  return (
    <FieldShell
      title={t('mro2:field.inspect.title')}
      onBack={back}
      backLabel={t('mro2:field.back')}
      footer={
        <div className="flex flex-col gap-2">
          <div className="text-center text-[13px]" style={{ color: KC.muted }}>
            {inspection.woNumber} · {inspection.craneName}
            {outcome === 'fail'
              ? ` · ${t('mro2:field.checklist.failedN', { n: fails })}`
              : outcome === 'pass'
                ? ` · ${t('mro2:field.resultPass')}`
                : ''}
          </div>
          <FieldBigButton onClick={send} disabled={outcome === null || !worker}>
            {t('mro2:field.inspect.send')}
          </FieldBigButton>
        </div>
      }
    >
      <FieldChecklistStep
        template={template}
        judgments={judgments}
        onChange={setJudgments}
        recheck={recheck}
      />
      {fails > 0 ? (
        <div className="mt-4">
          <div
            className="mb-2 text-[13px] font-semibold"
            style={{ color: KC.muted }}
          >
            {t('mro2:field.confirm.findings')}
          </div>
          <SymptomStep
            draft={draftForSymptom}
            patch={(p) => setSymptom(p.symptom ?? '')}
            presets="findings"
            placeholder={t('mro2:field.findingsPlaceholder')}
          />
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
        {photos.length > 0
          ? t('mro2:field.photoCount', {
              n: photos.length,
              max: FIELD_MAX_PHOTOS,
            })
          : t('mro2:field.addPhoto')}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            setPhotos((cur) =>
              addPhotos(cur, Array.from(e.target.files ?? [])),
            );
            e.target.value = '';
          }}
        />
      </label>
    </FieldShell>
  );
}
