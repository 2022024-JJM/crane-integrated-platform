import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { RepairStatus } from '@crane/domain/maintenance';
import { useMaintenanceDetail, useSetRepairStatus } from '@crane/features/maintenance';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import {
  REPAIR_PRIORITY_VARIANT as PRIORITY_VARIANT,
  REPAIR_STATUS_VARIANT as STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { FOCUS_RING } from '../../../shared/ui/controls';
import { RepairPipelineStepper } from './repair-pipeline-stepper';
import {
  RepairInfoSection,
  RepairPartsSection,
  RepairResultsForm,
} from './repair-panel-contents';
import { RepairPartModal } from './repair-part-modal';

// 슬라이드 아웃 애니메이션 시간(ms) — aside의 `duration-300` Tailwind 클래스와 반드시 일치해야 한다.
const PANEL_SLIDE_MS = 300;

/** 정비 WO 원클릭 처리 패널 — 상태 점프·부품 기록·결과 입력을 페이지 이동 없이 한 곳에서. */
export function RepairDetailPanel({
  repairId,
  onClose,
}: {
  repairId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('maintenance');
  const { repair, sourceInspectionId } = useMaintenanceDetail(repairId);
  const setStatus = useSetRepairStatus();
  const [partModalOpen, setPartModalOpen] = useState(false);
  // 슬라이드 애니메이션용: 마운트 직후 entered=true로 전환해 오른쪽에서 밀려들어온다
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // 닫기 요청 — 슬라이드 아웃 후 실제 onClose 호출
  const requestClose = useCallback(() => {
    setEntered(false);
    window.setTimeout(onClose, PANEL_SLIDE_MS);
  }, [onClose]);

  // ESC: 모달 열림 → 모달이 처리(위임) / 패널 → 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (partModalOpen) return; // 상단 레이어(모달)가 ESC를 우선 처리
      requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [partModalOpen, requestClose]);

  const handleStageSelect = (stage: RepairStatus) => {
    if (!repair) return;
    const outcome = setStatus(repair.id, stage);
    if (outcome.success) {
      if (stage === 'completed') {
        toast.success(t('toast.completed', { woNumber: repair.woNumber }));
      } else {
        toast.info(t('toast.moveTo', { woNumber: repair.woNumber, status: t(`pipeline.${stage}`) }));
      }
      return;
    }
    if (outcome.reason === 're_inspection_required') {
      toast.error(t('toast.reInspectionRequired'));
    }
  };

  if (!repair) return null;

  return (
    <aside
      // 접근성: non-modal 사이드 패널이므로 complementary 랜드마크로 노출
      role="complementary"
      aria-label={t('panel.label', { wo: repair.woNumber, defaultValue: repair.woNumber })}
      className={cn(
        'fixed right-0 top-14 bottom-0 z-40 flex w-[440px] max-w-[calc(100vw-1rem)] flex-col border-l border-border bg-card shadow-2xl',
        // duration-300은 PANEL_SLIDE_MS(300ms)와 결합 — 값 변경 시 둘 다 수정할 것
        'transition-transform duration-300 ease-out will-change-transform',
        entered ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* 헤더 */}
      <div className="flex flex-col gap-1.5 border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">{repair.woNumber}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              <Link
                to={`/asset-management/${repair.craneId}`}
                className="text-primary hover:underline"
              >
                {repair.craneName}
              </Link>
              {' · '}
              {repair.siteName}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className={cn('shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
            aria-label={t('panel.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={PRIORITY_VARIANT[repair.priority]}>
            {t(`priority.${repair.priority}`).toUpperCase()}
          </Badge>
          <Badge variant={STATUS_VARIANT[repair.status]}>
            {t(`status.${repair.status}`)}
          </Badge>
        </div>
      </div>

      {/* 파이프라인 스테퍼 */}
      <div className="border-b border-border p-3">
        <RepairPipelineStepper status={repair.status} onSelect={handleStageSelect} />
      </div>

      {/* 본문 — 정보 / 부품 / 결과 입력 */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <RepairInfoSection repair={repair} sourceInspectionId={sourceInspectionId} />
        <div className="h-px bg-border/60" />
        <RepairPartsSection repair={repair} onAddPart={() => setPartModalOpen(true)} />
        <div className="h-px bg-border/60" />
        <RepairResultsForm key={repair.id} repair={repair} />
      </div>

      {partModalOpen && (
        <RepairPartModal
          repairId={repair.id}
          woNumber={repair.woNumber}
          onClose={() => setPartModalOpen(false)}
        />
      )}
    </aside>
  );
}
