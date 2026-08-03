import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Package, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { RepairWO } from '@crane/domain/maintenance';
import { useUpdateRepairDetails } from '@crane/features/maintenance';
import { Button } from '@crane/ui/atoms/button';
import {
  FormField,
  ToggleGroup,
  inputClass,
  textareaClass,
} from '../../../shared/ui/form';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

/** 읽기 전용 기본 정보 — 상세 페이지의 dl을 패널 폭(440px)에 맞춰 2열로 압축 */
export function RepairInfoSection({
  repair,
  sourceInspectionId,
}: {
  repair: RepairWO;
  sourceInspectionId?: string;
}) {
  const { t } = useTranslation('maintenance');

  const fields: { label: string; value: ReactNode }[] = [
    { label: t('detail.fields.component'), value: repair.componentName },
    { label: t('detail.fields.failureType'), value: repair.failureType },
    { label: t('detail.fields.repairLevel'), value: repair.repairLevel },
    {
      label: t('detail.fields.performer'),
      value:
        repair.performerType === 'internal'
          ? t('detail.fields.performerInternal')
          : t('detail.fields.performerExternal'),
    },
    { label: t('detail.fields.assignedTo'), value: repair.assignedTo },
    {
      label: t('detail.fields.source'),
      value:
        sourceInspectionId && repair.sourceWoNumber ? (
          <Link
            to={`/inspection/${sourceInspectionId}`}
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            {repair.sourceWoNumber}
            <ChevronRight className="size-3" />
          </Link>
        ) : (
          repair.sourceType
        ),
    },
    { label: t('detail.fields.scheduledStart'), value: repair.scheduledStart.slice(0, 10) },
    { label: t('detail.fields.scheduledEnd'), value: repair.scheduledEnd.slice(0, 10) },
    { label: t('detail.fields.actualStart'), value: repair.actualStart?.slice(0, 10) ?? '—' },
    { label: t('detail.fields.actualEnd'), value: repair.actualEnd?.slice(0, 10) ?? '—' },
    {
      label: t('detail.fields.downtime'),
      value: repair.downtimeHours != null ? `${repair.downtimeHours} h` : '—',
    },
    { label: t('detail.fields.reInspection'), value: repair.reInspectionResult ?? '—' },
  ];

  return (
    <section className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium capitalize">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded bg-muted/40 p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {t('detail.failureDescription')}
        </p>
        <p className="text-sm">{repair.failureDescription}</p>
      </div>
    </section>
  );
}

/** 사용 부품 + 비용 합계. 완료 WO는 부품 추가 잠금(도메인 가드와 동일 조건). */
export function RepairPartsSection({
  repair,
  onAddPart,
}: {
  repair: RepairWO;
  onAddPart: () => void;
}) {
  const { t } = useTranslation('maintenance');
  const isClosed = repair.status === 'completed';
  const totalCost = (repair.laborCost ?? 0) + (repair.partsCost ?? 0);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>{t('detail.partsUsed')}</SectionTitle>
        <Button type="button" size="sm" variant="outline" disabled={isClosed} onClick={onAddPart}>
          <Plus className="h-3.5 w-3.5" />
          {t('panel.addPart')}
        </Button>
      </div>
      {isClosed && (
        <p className="text-[11px] text-muted-foreground">{t('panel.completedLocked')}</p>
      )}
      {repair.partsUsed.length === 0 ? (
        <div className="rounded border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          {t('detail.noParts')}
        </div>
      ) : (
        <div className="space-y-1">
          {repair.partsUsed.map((p, i) => (
            <Link
              key={`${p.partId}-${i}`}
              to={`/inventory?part=${encodeURIComponent(p.partId)}`}
              className="group flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
              title={t('detail.viewPart')}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <Package className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                <span className="truncate">{p.partName}</span>
              </span>
              <span className="ml-3 text-muted-foreground tabular-nums">×{p.qty}</span>
              <span className="ml-3 font-medium tabular-nums">
                ${(p.qty * p.unitCost).toLocaleString()}
              </span>
            </Link>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-bold">
            <span>{t('detail.partsCost')}</span>
            <span>${repair.partsCost?.toLocaleString() ?? '—'}</span>
          </div>
          {repair.laborCost != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('detail.laborCost', { hours: repair.laborHours })}
              </span>
              <span>${repair.laborCost.toLocaleString()}</span>
            </div>
          )}
          {totalCost > 0 && (
            <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
              <span>{t('detail.totalCost')}</span>
              <span>${totalCost.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** 정비 결과 입력 폼 — 부모에서 key={repair.id}로 마운트해 WO 전환 시 draft를 리셋한다. */
export function RepairResultsForm({
  repair,
  onDirtyChange,
}: {
  repair: RepairWO;
  /** 미저장 입력 여부를 부모(패널)에 알려 닫기/이탈을 가드하게 한다 */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation('maintenance');
  const updateDetails = useUpdateRepairDetails();
  const isClosed = repair.status === 'completed';

  const [rootCause, setRootCause] = useState(repair.rootCause ?? '');
  const [correctiveAction, setCorrectiveAction] = useState(repair.correctiveAction ?? '');
  const [preventiveAction, setPreventiveAction] = useState(repair.preventiveAction ?? '');
  const [laborHours, setLaborHours] = useState(repair.laborHours != null ? String(repair.laborHours) : '');
  const [downtimeHours, setDowntimeHours] = useState(
    repair.downtimeHours != null ? String(repair.downtimeHours) : '',
  );
  const [reInspection, setReInspection] = useState<'pass' | 'fail' | ''>(
    repair.reInspectionResult ?? '',
  );

  const dirty =
    rootCause !== (repair.rootCause ?? '') ||
    correctiveAction !== (repair.correctiveAction ?? '') ||
    preventiveAction !== (repair.preventiveAction ?? '') ||
    laborHours !== (repair.laborHours != null ? String(repair.laborHours) : '') ||
    downtimeHours !== (repair.downtimeHours != null ? String(repair.downtimeHours) : '') ||
    reInspection !== (repair.reInspectionResult ?? '');

  // dirty 변화를 부모에 전달 — 저장 성공 시 repair prop이 갱신되며 자동으로 false가 된다
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = () => {
    const outcome = updateDetails(repair.id, {
      rootCause: rootCause.trim(),
      correctiveAction: correctiveAction.trim(),
      preventiveAction: preventiveAction.trim(),
      laborHours: laborHours === '' ? null : Number(laborHours),
      downtimeHours: downtimeHours === '' ? null : Number(downtimeHours),
      reInspectionResult: reInspection === '' ? null : reInspection,
    });
    if (outcome.success) {
      toast.success(t('toast.detailsSaved', { woNumber: repair.woNumber }));
    } else {
      toast.error(t('panel.completedLocked'));
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle>{t('panel.results.title')}</SectionTitle>
      {isClosed && (
        <p className="text-[11px] text-muted-foreground">{t('panel.completedLocked')}</p>
      )}
      <FormField label={t('detail.rootCause')}>
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={2}
          disabled={isClosed}
          className={textareaClass}
        />
      </FormField>
      <FormField label={t('detail.correctiveAction')}>
        <textarea
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          rows={2}
          disabled={isClosed}
          className={textareaClass}
        />
      </FormField>
      <FormField label={t('detail.preventiveAction')}>
        <textarea
          value={preventiveAction}
          onChange={(e) => setPreventiveAction(e.target.value)}
          rows={2}
          disabled={isClosed}
          className={textareaClass}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('panel.results.laborHours')}>
          <input
            type="number"
            min={0}
            step={0.5}
            value={laborHours}
            onChange={(e) => setLaborHours(e.target.value)}
            disabled={isClosed}
            className={inputClass}
          />
        </FormField>
        <FormField label={t('panel.results.downtime')}>
          <input
            type="number"
            min={0}
            step={0.5}
            value={downtimeHours}
            onChange={(e) => setDowntimeHours(e.target.value)}
            disabled={isClosed}
            className={inputClass}
          />
        </FormField>
      </div>
      <FormField
        label={t('panel.results.reInspection')}
        hint={!isClosed ? t('panel.results.reInspectionHint') : undefined}
      >
        {isClosed ? (
          <p className="text-sm font-medium capitalize">{repair.reInspectionResult ?? '—'}</p>
        ) : (
          <ToggleGroup
            value={reInspection}
            options={[
              { value: 'pass', label: t('panel.results.pass') },
              { value: 'fail', label: t('panel.results.fail') },
            ]}
            onChange={setReInspection}
          />
        )}
      </FormField>
      {!isClosed && (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!dirty} onClick={handleSave}>
            {t('panel.results.save')}
          </Button>
        </div>
      )}
    </section>
  );
}
