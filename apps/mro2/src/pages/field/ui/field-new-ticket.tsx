import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useInventoryList } from '@crane/features/inventory';
import { useMaintenanceList } from '@crane/features/maintenance';
import { useUploadDocument } from '@crane/features/compliance';
import { useSubmitInspection } from '@crane/features/inspection';
import { getDefaultChecklist } from '@crane/domain/inspection';
import {
  useCreateInspectionTicket,
  useCreatePartsTicket,
  useCreateRepairTicket,
} from '@crane/features/ticket';
import { KC } from '../../../shared/ui/kc';
import {
  FIELD_STEPS,
  canProceed,
  emptyDraft,
  type FieldDraft,
} from '../lib/field-draft';
import {
  buildFieldChecklist,
  checklistOutcome,
  failedItems,
} from '../lib/field-checklist';
import { FIELD_PATH, type FieldKind } from '../lib/field-route';
import { useFieldWorker, useRecentAssets } from '../lib/field-storage';
import { openRepairsForAsset } from '../lib/open-reports';
import { FieldBigButton, FieldShell } from './field-shell';
import {
  AssetStep,
  InspectionStep,
  PartsStep,
  PhotoStep,
  PriorityStep,
  SymptomStep,
} from './field-step-views';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * 단계형 등록 — 자산 → (증상 | 부품 | 점검 결과) → 사진 → 우선순위 → 확인.
 * 생성은 데스크톱 모달과 같은 `@crane/features/ticket` 훅을 쓴다. 현장에서
 * 묻지 않는 항목(담당자·수행 주체·일정·고장 유형)은 기본값으로 두고 사무실이
 * 채운다 — 보고자 이름은 assignedTo(수리·점검)/requester(부품)에 들어간다.
 */
export function FieldNewTicket({ kind }: { kind: FieldKind }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [worker] = useFieldWorker();
  const [recent, pushRecent] = useRecentAssets();
  const { assets } = useAssetList();
  const { items: inventory } = useInventoryList();
  const { repairs } = useMaintenanceList();
  const createRepair = useCreateRepairTicket();
  const createInspection = useCreateInspectionTicket();
  const createParts = useCreatePartsTicket();
  const upload = useUploadDocument();
  const submitInspection = useSubmitInspection();

  const steps = FIELD_STEPS[kind];
  // 자산이 URL 로 미리 정해져 있고 실제로 있는 자산이면 자산 단계는 건너뛴다.
  // 모르는 id 면 자산 단계부터 — 건너뛰면 등록 단계에서 조용히 막힌다.
  const presetAsset = (() => {
    const id = params.get('asset');
    return id && assets.some((a) => a.id === id) ? id : null;
  })();
  const [draft, setDraft] = useState<FieldDraft>(() => emptyDraft(presetAsset));
  const [index, setIndex] = useState(() => (presetAsset ? 1 : 0));
  const [done, setDone] = useState<string | null>(null);
  const openReports = useMemo(
    () =>
      kind === 'repair' ? openRepairsForAsset(repairs, draft.assetId) : [],
    [kind, repairs, draft.assetId],
  );
  const template = useMemo(
    () => getDefaultChecklist(draft.inspectionType),
    [draft.inspectionType],
  );
  const patch = (p: Partial<FieldDraft>) => setDraft((d) => ({ ...d, ...p }));
  const step = steps[index]!;
  const asset = useMemo(
    () => assets.find((a) => a.id === draft.assetId) ?? null,
    [assets, draft.assetId],
  );

  const submit = () => {
    if (!asset || !worker) return;
    const base = {
      craneId: asset.id,
      craneName: asset.name,
      siteId: asset.siteId,
      siteName: asset.siteName,
    };
    const today = todayIso();
    const fieldReport = {
      reportedBy: worker,
      reportedAt: new Date().toISOString(),
    };
    let number = '';
    if (kind === 'repair') {
      const wo = createRepair({
        ...base,
        componentName: draft.component.trim() || 'General',
        failureType: 'other',
        sourceType: 'breakdown',
        priority: draft.repairPriority,
        repairLevel: 'minor',
        failureDescription: draft.symptom.trim(),
        performerType: 'internal',
        assignedTo: worker,
        scheduledStart: today,
        scheduledEnd: today,
        fieldReport,
      });
      number = wo.woNumber;
    } else if (kind === 'inspection') {
      // 현장 점검은 체크리스트 판정이 다 채워져 왔으므로 바로 완료 처리한다
      // (사무실 submit 규칙과 같은 함수). 전부 양호면 접수함에도 올리지 않는다.
      const outcome = checklistOutcome(template, draft.checklist);
      const failedN = failedItems(template, draft.checklist).length;
      const wo = createInspection({
        ...base,
        woType: draft.inspectionType,
        priority: outcome === 'fail' ? 'high' : 'normal',
        scheduledDate: today,
        performerType: 'internal',
        assignedTo: worker,
        findings:
          outcome === 'fail'
            ? draft.symptom.trim() ||
              t('mro2:field.checklist.failedN', { n: failedN })
            : t('mro2:field.resultPass'),
        checklistItems: buildFieldChecklist(template, draft.checklist),
        fieldReport:
          outcome === 'pass'
            ? {
                ...fieldReport,
                triagedAt: fieldReport.reportedAt,
                triagedBy: 'auto',
              }
            : fieldReport,
      });
      submitInspection(wo.id, []);
      number = wo.woNumber;
    } else {
      const req = createParts({
        ...base,
        priority: draft.partsPriority,
        requester: worker,
        items: draft.parts.map((p) => {
          const inv = inventory.find((i) => i.partId === p.partId);
          return {
            partId: p.partId,
            partName: inv?.partName ?? p.partId,
            qty: p.qty,
            unitPrice: inv?.unitPrice ?? 0,
          };
        }),
        note: draft.note.trim() || undefined,
        fieldReport,
      });
      number = req.requestNumber;
    }
    for (const photo of draft.photos) {
      upload({
        fileName: photo.name,
        docType: 'other',
        craneId: asset.id,
        craneName: asset.name,
        uploadedBy: worker,
        sizeBytes: photo.size,
        objectUrl: URL.createObjectURL(photo),
        refWoNumber: number,
      });
    }
    pushRecent(asset.id);
    setDone(number);
  };

  if (done) {
    return (
      <FieldShell title={t(`mro2:field.kind.${kind}`)}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 size={56} style={{ color: KC.ok }} />
          <div className="text-[20px] font-bold" style={{ color: KC.ink }}>
            {t('mro2:field.done.title')}
          </div>
          <div className="font-mono text-[18px]" style={{ color: KC.text }}>
            {done}
          </div>
          <div className="mt-4 flex w-full flex-col gap-3">
            <FieldBigButton
              onClick={() => {
                // 같은 URL 이라 라우터가 리마운트하지 않는다 — 상태를 직접 초기화.
                setDraft(emptyDraft(asset?.id ?? null));
                setIndex(asset ? 1 : 0);
                setDone(null);
              }}
            >
              {t('mro2:field.done.another')}
            </FieldBigButton>
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

  if (!worker) {
    return (
      <FieldShell
        title={t(`mro2:field.kind.${kind}`)}
        onBack={() => navigate(FIELD_PATH)}
        backLabel={t('mro2:field.back')}
      >
        <p className="py-6 text-[15px]" style={{ color: KC.muted }}>
          {t('mro2:field.workerFirst')}
        </p>
        <FieldBigButton onClick={() => navigate(FIELD_PATH)}>
          {t('mro2:field.done.home')}
        </FieldBigButton>
      </FieldShell>
    );
  }

  const last = index === steps.length - 1;
  // 마지막 단계의 한 줄 요약 — 확인 단계를 따로 두지 않는다
  const failedN = failedItems(template, draft.checklist).length;
  const summaryLine =
    kind === 'repair'
      ? [
          draft.symptom.trim(),
          draft.photos.length
            ? t('mro2:field.photoN', { n: draft.photos.length })
            : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : kind === 'parts'
        ? t('mro2:field.confirm.partsN', {
            n: draft.parts.filter((p) => p.partId && p.qty > 0).length,
          })
        : failedN === 0
          ? t('mro2:field.resultPass')
          : t('mro2:field.checklist.failedN', { n: failedN });
  const ok = canProceed(step, draft, template);
  const back = () => (index === 0 ? navigate(FIELD_PATH) : setIndex(index - 1));
  const titleOf = (): string => {
    switch (step) {
      case 'asset':
        return t('mro2:field.step.asset');
      case 'symptom':
        return t('mro2:field.step.symptom');
      case 'parts':
        return t('mro2:field.step.parts');
      case 'inspection':
        return t('mro2:field.step.inspection');
      case 'photo':
        return t('mro2:field.step.photo');
      case 'priority':
        return t('mro2:field.step.priority');
    }
  };

  return (
    <FieldShell
      title={titleOf()}
      onBack={back}
      backLabel={t('mro2:field.back')}
      footer={
        <div className="flex flex-col gap-2">
          <div className="text-center text-[13px]" style={{ color: KC.muted }}>
            {t('mro2:field.stepOf', { n: index + 1, total: steps.length })} ·{' '}
            {t(`mro2:field.kind.${kind}`)}
            {asset && step !== 'asset' ? ` · ${asset.name}` : ''}
            {last ? ` · ${summaryLine}` : ''}
          </div>
          <FieldBigButton
            onClick={last ? submit : () => setIndex(index + 1)}
            disabled={!ok}
          >
            {last
              ? t('mro2:field.submit')
              : step === 'photo' && draft.photos.length === 0
                ? t('mro2:field.skip')
                : t('mro2:field.next')}
          </FieldBigButton>
        </div>
      }
    >
      {step === 'asset' ? (
        <AssetStep
          assets={assets}
          recent={recent}
          draft={draft}
          patch={patch}
        />
      ) : null}
      {step === 'symptom' ? (
        <SymptomStep
          draft={draft}
          patch={patch}
          presets="repair"
          placeholder={t('mro2:field.symptomPlaceholder')}
          openReports={openReports}
        />
      ) : null}
      {step === 'inspection' ? (
        <InspectionStep draft={draft} patch={patch} template={template} />
      ) : null}
      {step === 'parts' ? (
        <PartsStep
          inventory={inventory}
          draft={draft}
          patch={patch}
          craneId={draft.assetId}
        />
      ) : null}
      {step === 'photo' ? <PhotoStep draft={draft} patch={patch} /> : null}
      {step === 'priority' ? (
        <PriorityStep kind={kind} draft={draft} patch={patch} />
      ) : null}
    </FieldShell>
  );
}
