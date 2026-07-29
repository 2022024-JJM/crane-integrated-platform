import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
import { PAGE_TITLE, PAGE_CONTAINER } from '../../../shared/ui/page';
import { SURFACE_CARD } from '../../../shared/ui/surface';
import { FOCUS_RING } from '../../../shared/ui/controls';
import {
  INSPECTION_RESULT_VARIANT as RESULT_VARIANT,
  INSPECTION_TYPE_VARIANT as TYPE_VARIANT,
} from '../../../shared/ui/status-variants';
import {
  PILL_INACTIVE,
  TONE_BORDER_ACCENT,
  TONE_PILL_ACTIVE,
  TONE_SURFACE,
  TONE_TEXT,
  TONE_TOGGLE_ACTIVE,
  type Tone,
} from '../../../shared/ui/tone';

const JUDGMENT_ICON: Record<ChecklistJudgment, React.ReactNode> = {
  pass: <CheckCircle2 className={cn('w-5 h-5 shrink-0', TONE_TEXT.positive)} />,
  fail: <XCircle className={cn('w-5 h-5 shrink-0', TONE_TEXT.critical)} />,
  na: <MinusCircle className="w-5 h-5 text-muted-foreground shrink-0" />,
};

// 판정 레일 — 순환 클릭 대신 1클릭 세그먼트. 색은 판정 의미에만 실린다.
const JUDGMENT_SEGMENTS: Array<{ value: ChecklistJudgment; tone: Tone }> = [
  { value: 'pass', tone: 'positive' },
  { value: 'fail', tone: 'critical' },
  { value: 'na', tone: 'neutral' },
];

function JudgmentRail({
  value,
  onSelect,
  itemName,
}: {
  value: ChecklistJudgment | null;
  onSelect: (v: ChecklistJudgment | null) => void;
  itemName: string;
}) {
  const { t } = useTranslation('inspection');
  return (
    <div role="group" aria-label={itemName} className="flex shrink-0 gap-1">
      {JUDGMENT_SEGMENTS.map(({ value: seg, tone }) => (
        <button
          key={seg}
          type="button"
          aria-pressed={value === seg}
          // 같은 판정 재클릭 = 판정 해제 (미판정으로 되돌리기)
          onClick={() => onSelect(value === seg ? null : seg)}
          className={cn(FOCUS_RING, 
            'cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
            value === seg ? TONE_PILL_ACTIVE[tone] : PILL_INACTIVE,
          )}
        >
          {t(`detail.judgment.${seg}`)}
        </button>
      ))}
    </div>
  );
}

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

export function InspectionDetailPage() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const { inspection } = useInspectionDetail(inspectionId ?? '');
  const saveChecklist = useSaveInspectionChecklist();
  const submitInspection = useSubmitInspection();
  const navigate = useNavigate();
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

  // persist 후 inspection 객체가 새 checklist로 교체되면 로컬 편집 버퍼도 동기화
  useEffect(() => {
    setItemStates(initialItemStates);
  }, [initialItemStates]);

  // 저장 안 된 판정/코멘트가 있는지 — persisted checklist와 편집 버퍼 비교
  const dirty = useMemo(
    () =>
      Object.entries(itemStates).some(([id, s]) => {
        const init = initialItemStates[id];
        if (!init) return true;
        return (
          init.judgment !== s.judgment ||
          init.comment !== s.comment ||
          init.actionRequired !== s.actionRequired
        );
      }),
    [itemStates, initialItemStates],
  );

  // BrowserRouter(비-data 라우터)라 useBlocker 불가 — 탭 닫기/새로고침은 beforeunload로,
  // 페이지 내 이탈 링크는 confirm 가드로 막는다.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

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

  function setJudgment(itemId: string, next: ChecklistJudgment | null) {
    if (!isEditable) return;
    setItemStates((prev) => {
      const current = prev[itemId];
      // fail 전환 시 원본에 fail용 조치(stop_operation 등)가 있으면 유지 — 재토글로 소실 방지
      const original = inspection?.checklistItems.find((i) => i.id === itemId)?.actionRequired;
      const failAction = original && original !== 'none' ? original : 'repair_needed';
      return {
        ...prev,
        [itemId]: {
          ...current,
          judgment: next,
          actionRequired: next === 'fail' ? failAction : 'none',
        },
      };
    });
  }

  // 예외 중심 점검의 핵심 — 미판정 항목을 한 번에 합격 처리.
  // 되돌리기는 Undo 토스트로: 대상이던 항목만 미판정으로 복원해 이후의 개별 판정은 건드리지 않는다.
  function bulkPass(itemIds: string[]) {
    if (!isEditable || itemIds.length === 0) return;
    const changed = itemIds.filter((id) => itemStates[id]?.judgment === null);
    if (changed.length === 0) return;
    setItemStates((prev) => {
      const next = { ...prev };
      for (const id of changed) {
        next[id] = { ...next[id], judgment: 'pass', actionRequired: 'none' };
      }
      return next;
    });
    toast.success(t('detail.toastBulkPassed', { count: changed.length }), {
      action: {
        label: t('undo', { ns: 'common', defaultValue: 'Undo' }),
        onClick: () =>
          setItemStates((cur) => {
            const back = { ...cur };
            for (const id of changed) {
              back[id] = { ...back[id], judgment: null, actionRequired: 'none' };
            }
            return back;
          }),
      },
    });
  }

  function handleCommentChange(itemId: string, value: string) {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], comment: value },
    }));
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
      toast.error(t('detail.toastSaveFailed', { defaultValue: 'Failed to save checklist' }));
      return;
    }
    // 저장 성공 피드백은 toast로 일원화 — 버튼 라벨을 바꾸지 않아 폭이 흔들리지 않는다
    toast.success(t('detail.toastSaved'));
  }

  // 페이지 내 이탈 링크 공용 가드 — dirty면 confirm으로 한 번 묻는다
  function guardLeave(e: React.MouseEvent) {
    if (dirty && !window.confirm(t('detail.unsavedConfirm'))) {
      e.preventDefault();
    }
  }

  // 티켓 생성 이동 전에 편집 중인 판정을 먼저 저장 — 실패 시 이동하지 않는다
  function handleCreateRepairTicket() {
    if (!inspectionId || !inspection) return;
    if (dirty) {
      const ok = saveChecklist(inspectionId, collectPatches());
      if (!ok) {
        toast.error(t('detail.toastSaveFailed', { defaultValue: 'Failed to save checklist' }));
        return;
      }
      toast.success(t('detail.toastSaved'));
    }
    navigate(
      `/ticket/create?type=repair&craneId=${encodeURIComponent(inspection.craneId)}&sourceWo=${encodeURIComponent(inspection.woNumber)}&component=${encodeURIComponent(failedItems[0]?.itemName ?? '')}`,
    );
  }

  function handleSubmit() {
    if (!inspectionId) return;
    const outcome = submitInspection(inspectionId, collectPatches());
    if (!outcome.ok) {
      toast.error(t('detail.toastSubmitFailed', { defaultValue: 'Failed to submit inspection' }));
      return;
    }
    toast.success(t('detail.toastSubmitted'), {
      description: inspection?.woNumber,
    });
    // 반복 점검이면 다음 회차가 자동 생성됨 — 사용자에게 알리고 바로 이동할 수 있게
    const nextWo = outcome.nextWo;
    if (nextWo) {
      toast.info(
        t('detail.toastNextCreated', {
          woNumber: nextWo.woNumber,
          date: nextWo.scheduledDate,
          defaultValue: 'Next inspection {{woNumber}} auto-created for {{date}}',
        }),
        {
          action: {
            label: t('detail.toastNextCreatedAction', { defaultValue: 'Open' }),
            onClick: () => navigate(`/inspection/${nextWo.id}`),
          },
        },
      );
    }
  }

  return (
    <div className={PAGE_CONTAINER}>
      {/* 브레드크럼 */}
      <div className="flex items-center gap-3">
        <Link
          to="/inspection"
          onClick={guardLeave}
          className="cursor-pointer flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('detail.backLink')}
        </Link>
      </div>

      {/* W/O 헤더 */}
      <div className={cn(SURFACE_CARD, 'p-5')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className={PAGE_TITLE}>{inspection.woNumber}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <Link
                to={`/asset-management/${inspection.craneId}`}
                onClick={guardLeave}
                className="text-primary hover:underline"
              >
                {inspection.craneName}
              </Link>
              {' · '}
              {inspection.siteName}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={TYPE_VARIANT[inspection.woType]}>
              {t(`type.${inspection.woType}`)}
            </Badge>
            {inspection.result && (
              <Badge variant={RESULT_VARIANT[inspection.result]}>
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
            { label: t('detail.fields.priority'), value: t(`priority.${inspection.priority}`, { defaultValue: inspection.priority }) },
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
            <button
              type="button"
              onClick={handleCreateRepairTicket}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-destructive px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-destructive/90"
            >
              <Wrench className="size-3.5" />
              {t('detail.createRepairTicket')}
            </button>
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
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold">{t('detail.checklist')}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('detail.progress', { completed: checkedCount, total: totalCount })}
          </span>
        </div>

        {categories.map((category) => {
          const catItems = inspection.checklistItems.filter((i) => i.category === category);
          const catUnjudged = catItems.filter((i) => itemStates[i.id]?.judgment === null);
          const catDone = catUnjudged.length === 0;
          return (
            <div key={category} className={cn(SURFACE_CARD, 'overflow-hidden')}>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/90 bg-muted/30">
                <h3 className="text-sm font-semibold">{category}</h3>
                {isEditable && !catDone && (
                  <button
                    onClick={() => bulkPass(catUnjudged.map((i) => i.id))}
                    className={cn('cursor-pointer flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors', FOCUS_RING)}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {t('detail.bulkPassCategory', { count: catUnjudged.length })}
                  </button>
                )}
                {isEditable && catDone && (
                  <CheckCircle2 className={cn('w-3.5 h-3.5', TONE_TEXT.positive)} aria-label={t('detail.categoryDone')} />
                )}
              </div>
              <div className="divide-y divide-border/70">
                {catItems.map((item) => {
                  const state = itemStates[item.id];
                  const judgment = state?.judgment ?? null;
                  const comment = state?.comment ?? '';
                  const actionRequired = state?.actionRequired ?? 'none';

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex flex-col px-4 py-3 gap-2 border-l-2 transition-colors',
                        judgment === 'fail' ? TONE_BORDER_ACCENT.critical : 'border-l-transparent',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {!isEditable && (
                          judgment
                            ? JUDGMENT_ICON[judgment]
                            : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                        )}

                        <span className="text-sm flex-1">{item.itemName}</span>

                        {actionRequired !== 'none' && (
                          <Badge variant={ACTION_VARIANT[actionRequired]} className="shrink-0">
                            {t(`detail.action.${actionRequired}`)}
                          </Badge>
                        )}

                        {isEditable && (
                          <JudgmentRail
                            value={judgment}
                            onSelect={(v) => setJudgment(item.id, v)}
                            itemName={item.itemName}
                          />
                        )}
                      </div>

                      {judgment === 'fail' && isEditable && (
                        <input
                          type="text"
                          value={comment}
                          onChange={(e) => handleCommentChange(item.id, e.target.value)}
                          placeholder={t('detail.remarks')}
                          className="text-xs rounded border border-border bg-muted/40 px-3 py-1.5 outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
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

      {/* 판정 액션 바 — 예외만 지정하고 나머지는 한 번에 통과시키는 흐름의 종착점 */}
      {isEditable && (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:-mb-6 md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-32 flex-1">
              <div className="h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none"
                  style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                {t('detail.progress', { completed: checkedCount, total: totalCount })}
              </p>
            </div>

            {!allChecked && (
              <button
                onClick={() =>
                  bulkPass(
                    Object.entries(itemStates)
                      .filter(([, s]) => s.judgment === null)
                      .map(([id]) => id),
                  )
                }
                className={cn(FOCUS_RING, 
                  'cursor-pointer flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors',
                  TONE_TOGGLE_ACTIVE.positive,
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('detail.bulkPassRemaining', { count: totalCount - checkedCount })}
              </button>
            )}

            <button
              onClick={handleSave}
              className={cn('cursor-pointer flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors', FOCUS_RING)}
            >
              <Save className="w-3.5 h-3.5" />
              {t('detail.save')}
            </button>
            <button
              disabled={!allChecked}
              onClick={handleSubmit}
              className={cn('cursor-pointer flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50 hover:bg-primary/90 transition-colors', FOCUS_RING)}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              {t('detail.submitResult')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
