import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, XCircle, MinusCircle, Save, ClipboardCheck, AlertTriangle, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useInspectionDetail,
  useSaveInspectionChecklist,
  useSubmitInspection,
} from '@crane/features/inspection';
import type { ChecklistJudgment, ActionRequired, ChecklistItemPatch } from '@crane/domain/inspection';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { TONE_SURFACE, TONE_TEXT } from '../../../shared/ui/tone';

const JUDGMENT_ICON: Record<ChecklistJudgment, React.ReactNode> = {
  pass: <CheckCircle2 className={cn('w-5 h-5 shrink-0', TONE_TEXT.positive)} />,
  fail: <XCircle className={cn('w-5 h-5 shrink-0', TONE_TEXT.critical)} />,
  na: <MinusCircle className="w-5 h-5 text-muted-foreground shrink-0" />,
};

const JUDGMENT_CYCLE: Array<ChecklistJudgment | null> = ['pass', 'fail', 'na', null];

const ACTION_VARIANT: Record<ActionRequired, 'secondary' | 'warning' | 'destructive'> = {
  none: 'secondary',
  monitor: 'warning',
  repair_needed: 'warning',
  immediate_replace: 'destructive',
  stop_operation: 'destructive',
};

type ItemState = {
  judgment: ChecklistJudgment | null;
  comment: string;
  actionRequired: ActionRequired;
};

function nextJudgment(current: ChecklistJudgment | null): ChecklistJudgment | null {
  const idx = JUDGMENT_CYCLE.indexOf(current);
  return JUDGMENT_CYCLE[(idx + 1) % JUDGMENT_CYCLE.length];
}

export function InspectionDetailPage() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const { inspection } = useInspectionDetail(inspectionId ?? '');
  const saveChecklist = useSaveInspectionChecklist();
  const submitInspection = useSubmitInspection();
  const { t } = useTranslation('inspection');

  const isEditable = inspection?.status !== 'completed';

  const initialItemStates = useMemo<Record<string, ItemState>>(() => {
    if (!inspection) return {};
    return Object.fromEntries(
      inspection.checklistItems.map((item) => [
        item.id,
        {
          judgment: item.judgment,
          comment: item.comment ?? '',
          actionRequired: item.actionRequired,
        },
      ]),
    );
  }, [inspection]);

  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(initialItemStates);
  const [saved, setSaved] = useState(false);

  // persist 후 inspection 객체가 새 checklist로 교체되면 로컬 편집 버퍼도 동기화
  useEffect(() => {
    setItemStates(initialItemStates);
  }, [initialItemStates]);

  if (!inspection) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-muted-foreground">{t('empty')}</p>
      </div>
    );
  }

  const categories = [...new Set(inspection.checklistItems.map((i) => i.category))];

  const checkedCount = Object.values(itemStates).filter((s) => s.judgment !== null).length;
  const totalCount = inspection.checklistItems.length;
  const allChecked = checkedCount === totalCount;

  const failedItems = Object.entries(itemStates)
    .filter(([, s]) => s.judgment === 'fail')
    .map(([id, s]) => {
      const item = inspection.checklistItems.find((i) => i.id === id)!;
      return { ...item, ...s };
    });

  function handleJudgmentClick(itemId: string) {
    if (!isEditable) return;
    setItemStates((prev) => {
      const current = prev[itemId];
      const next = nextJudgment(current.judgment);
      return {
        ...prev,
        [itemId]: {
          ...current,
          judgment: next,
          actionRequired: next === 'fail' ? 'repair_needed' : 'none',
        },
      };
    });
    setSaved(false);
  }

  function handleCommentChange(itemId: string, value: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], comment: value },
    }));
    setSaved(false);
  }

  function collectPatches(): ChecklistItemPatch[] {
    return Object.entries(itemStates).map(([id, s]) => ({
      id,
      judgment: s.judgment,
      comment: s.comment || undefined,
      actionRequired: s.actionRequired,
    }));
  }

  function handleSave() {
    if (!inspectionId) return;
    const ok = saveChecklist(inspectionId, collectPatches());
    if (!ok) {
      toast.error(t('detail.toastSaved'));
      return;
    }
    setSaved(true);
    toast.success(t('detail.toastSaved'));
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSubmit() {
    if (!inspectionId) return;
    const ok = submitInspection(inspectionId, collectPatches());
    if (!ok) {
      toast.error(t('detail.toastSubmitted'));
      return;
    }
    toast.success(t('detail.toastSubmitted'), {
      description: inspection?.woNumber,
    });
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-3">
        <Link
          to="/inspection"
          className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('detail.backLink')}
        </Link>
      </div>

      {/* W/O 헤더 */}
      <div className="rounded border border-border/90 bg-card/60 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">{inspection.woNumber}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <Link
                to={`/asset-management/${inspection.craneId}`}
                className="text-primary hover:underline"
              >
                {inspection.craneName}
              </Link>
              {' · '}
              {inspection.siteName}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={inspection.woType === 'frequent' ? 'secondary' : 'warning'}>
              {t(`type.${inspection.woType}`)}
            </Badge>
            {inspection.result && (
              <Badge variant={inspection.result === 'pass' ? 'success' : inspection.result === 'fail' ? 'destructive' : 'warning'}>
                {t(`result.${inspection.result}`)}
              </Badge>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 mt-4 sm:grid-cols-4">
          {[
            { label: t('detail.fields.scheduledDate'), value: inspection.scheduledDate },
            { label: t('detail.fields.completedDate'), value: inspection.actualDate ?? '—' },
            { label: t('detail.fields.assignedTo'), value: inspection.assignedTo },
            { label: t('detail.fields.inspector'), value: inspection.performerType === 'internal' ? t('detail.fields.performerInternal') : t('detail.fields.performerExternal') },
            { label: t('detail.fields.status'), value: t(`status.${inspection.status}`) },
            { label: t('detail.fields.priority'), value: inspection.priority.toUpperCase() },
            { label: t('detail.fields.totalHours'), value: inspection.totalHours ? `${inspection.totalHours} h` : '—' },
            { label: t('detail.fields.cost'), value: inspection.cost ? `$${inspection.cost.toLocaleString()}` : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>

        {inspection.findings && (
          <div className="mt-4 rounded bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t('detail.findings')}</p>
            <p className="text-sm">{inspection.findings}</p>
          </div>
        )}
      </div>

      {/* 부적합 항목 요약 */}
      {failedItems.length > 0 && (
        <div className={cn('rounded border p-4 space-y-2', TONE_SURFACE.critical)}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={cn('flex items-center gap-2 text-sm font-bold', TONE_TEXT.critical)}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {t('detail.nonConformance')} ({failedItems.length})
            </h2>
            <Link
              to={`/ticket/create?type=repair&craneId=${encodeURIComponent(inspection.craneId)}&sourceWo=${encodeURIComponent(inspection.woNumber)}&component=${encodeURIComponent(failedItems[0]?.itemName ?? '')}`}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-destructive px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-destructive/90"
            >
              <Wrench className="size-3.5" />
              {t('detail.createRepairTicket')}
            </Link>
          </div>
          {failedItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-sm">
              <XCircle className={cn('w-4 h-4 shrink-0 mt-0.5', TONE_TEXT.critical)} />
              <div>
                <span className="font-medium">{item.itemName}</span>
                {item.comment && <p className="text-xs text-muted-foreground mt-0.5">{item.comment}</p>}
              </div>
              <Badge variant={ACTION_VARIANT[item.actionRequired]} className="ml-auto shrink-0">
                {t(`detail.action.${item.actionRequired}`)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* 체크리스트 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold">{t('detail.checklist')}</h2>
            <span className="text-xs text-muted-foreground">
              {t('detail.progress', { completed: checkedCount, total: totalCount })}
            </span>
          </div>
          {isEditable && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="cursor-pointer flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {saved ? '✓' : t('detail.save')}
              </button>
              <button
                disabled={!allChecked}
                onClick={handleSubmit}
                className="cursor-pointer flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                {t('detail.submitResult')}
              </button>
            </div>
          )}
        </div>

        {/* 진행률 바 */}
        {isEditable && (
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        )}

        {categories.map((category) => {
          const catItems = inspection.checklistItems.filter((i) => i.category === category);
          return (
            <div key={category} className="rounded border border-border/90 bg-card/60 overflow-hidden shadow-sm backdrop-blur-sm">
              <div className="px-4 py-3 border-b border-border/90 bg-muted/30">
                <h3 className="text-sm font-semibold">{category}</h3>
              </div>
              <div className="divide-y divide-border/70">
                {catItems.map((item) => {
                  const state = itemStates[item.id];
                  const judgment = state?.judgment ?? null;
                  const comment = state?.comment ?? '';
                  const actionRequired = state?.actionRequired ?? 'none';

                  return (
                    <div key={item.id} className="flex flex-col px-4 py-3.5 gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleJudgmentClick(item.id)}
                          disabled={!isEditable}
                          className={`shrink-0 transition-transform ${isEditable ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-default'}`}
                          aria-label={judgment ?? 'unchecked'}
                        >
                          {judgment
                            ? JUDGMENT_ICON[judgment]
                            : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40" />
                          }
                        </button>

                        <span className="text-sm flex-1">{item.itemName}</span>

                        {isEditable && judgment && (
                          <span className="text-xs text-muted-foreground">
                            {t(`detail.judgment.${judgment}`)}
                          </span>
                        )}

                        {actionRequired !== 'none' && (
                          <Badge variant={ACTION_VARIANT[actionRequired]} className="shrink-0">
                            {t(`detail.action.${actionRequired}`)}
                          </Badge>
                        )}
                      </div>

                      {judgment === 'fail' && isEditable && (
                        <input
                          type="text"
                          value={comment}
                          onChange={(e) => handleCommentChange(item.id, e.target.value)}
                          placeholder={t('detail.remarks')}
                          className="ml-8 text-xs rounded border border-border bg-muted/40 px-3 py-1.5 outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
                        />
                      )}

                      {!isEditable && comment && (
                        <p className="ml-8 text-xs text-muted-foreground">{comment}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
