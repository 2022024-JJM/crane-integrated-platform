import { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePartDetail } from '@crane/features/inventory';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import {
  CRITICALITY_VARIANT,
  INVENTORY_STATUS_VARIANT as STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { StockActionModal, type ActionMode } from './stock-action-modal';
import { FOCUS_RING } from '../../../shared/ui/controls';
import {
  ActionButtons,
  HistoryContent,
  InfoContent,
  StockChips,
  UsageContent,
} from './part-detail-contents';

export type PanelTab = 'info' | 'history' | 'usage';

// 슬라이드 아웃 애니메이션 시간(ms) — aside의 `duration-300` Tailwind 클래스와 반드시 일치해야 한다.
// (Tailwind 정적 클래스 추출 때문에 템플릿 문자열로 합칠 수 없어 상수로 결합을 명시)
const PANEL_SLIDE_MS = 300;

export function PartDetailPanel({
  partId,
  onClose,
}: {
  partId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('inventory');
  const { isOpen: sidebarOpen } = useSidebar();
  const { item, transactions, repairUsages, openPoLines, onOrderQty } = usePartDetail(partId);
  const [tab, setTab] = useState<PanelTab>('info');
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [expanded, setExpanded] = useState(false);
  // 슬라이드 애니메이션용: 마운트 직후 entered=true로 전환해 오른쪽에서 밀려들어온다
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // 닫기 요청 — 슬라이드 아웃 후 실제 onClose 호출 (확장 뷰는 즉시)
  const requestClose = useCallback(() => {
    if (expanded) {
      onClose();
      return;
    }
    setEntered(false);
    window.setTimeout(onClose, PANEL_SLIDE_MS);
  }, [expanded, onClose]);

  // ESC: 모달 열림 → 모달이 처리(위임) / 확장 뷰 → 패널로 / 패널 → 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (actionMode) return; // 상단 레이어(모달)가 ESC를 우선 처리
      if (expanded) setExpanded(false);
      else requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionMode, expanded, requestClose]);

  if (!item) return null;

  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={STATUS_VARIANT[item.status]}>{t(`status.${item.status}`)}</Badge>
      <Badge variant={CRITICALITY_VARIANT[item.criticality]}>
        {t(`criticality.${item.criticality}`)}
      </Badge>
    </div>
  );

  const modal = actionMode && (
    <StockActionModal
      mode={actionMode}
      partId={item.partId}
      partName={item.partName}
      availableQty={item.availableQty}
      openPoLines={openPoLines}
      onClose={() => setActionMode(null)}
    />
  );

  // ── 확장 전체 뷰: 탭이 병렬 컬럼으로 펼쳐진다 ──
  if (expanded) {
    return (
      <div
        className={cn(
          // lg 이상 인라인 사이드바(w-64)만 오프셋 — lg 미만은 드로어라 전체 폭 사용
          'fixed right-0 top-14 bottom-0 left-0 z-40 flex flex-col bg-background',
          sidebarOpen && 'lg:left-64',
        )}
      >
        {/* 헤더 */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{item.partNumber}</p>
            <h2 className="mt-0.5 truncate text-lg font-bold">{item.partName}</h2>
            <div className="mt-1.5">{badges}</div>
          </div>
          <div className="flex items-center gap-3">
            <StockChips item={item} onOrderQty={onOrderQty} className="w-[420px] max-w-full" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className={cn('cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
                aria-label={t('detail.collapse')}
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className={cn('cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
                aria-label={t('detail.close', { defaultValue: 'Close' })}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 3열 본문 */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.1fr_1.2fr_1fr] lg:overflow-hidden">
          <section className="border-b border-border p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.tabs.info')}
            </h3>
            <InfoContent item={item} openPoLines={openPoLines} />
          </section>
          <section className="border-b border-border p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.tabs.history')}
              {transactions.length > 0 && (
                <span className="ml-1.5 tabular-nums">{transactions.length}</span>
              )}
            </h3>
            <HistoryContent transactions={transactions} />
          </section>
          <section className="p-5 lg:overflow-y-auto">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.tabs.usage')}
              {repairUsages.length > 0 && (
                <span className="ml-1.5 tabular-nums">{repairUsages.length}</span>
              )}
            </h3>
            <UsageContent repairUsages={repairUsages} />
          </section>
        </div>

        {/* 푸터 액션 */}
        <div className="flex justify-end border-t border-border px-6 py-3">
          <ActionButtons
            onAction={setActionMode}
            partId={item.partId}
            craneIds={item.craneIds}
            className="w-72"
          />
        </div>

        {modal}
      </div>
    );
  }

  // ── 사이드 패널 뷰 ──
  return (
    <aside
      // 접근성: non-modal 사이드 패널이므로 complementary 랜드마크로 노출
      role="complementary"
      aria-label={t('detail.panelLabel', {
        defaultValue: `Part detail: ${item.partName}`,
        part: item.partName,
      })}
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
            <p className="font-mono text-xs text-muted-foreground">{item.partNumber}</p>
            <h2 className="mt-0.5 truncate text-sm font-bold">{item.partName}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className={cn('cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
              aria-label={t('detail.expand')}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={requestClose}
              className={cn('cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
              aria-label={t('detail.close', { defaultValue: 'Close' })}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {badges}
      </div>

      {/* 재고 요약 */}
      <div className="border-b border-border p-3">
        <StockChips item={item} onOrderQty={onOrderQty} />
      </div>

      {/* 탭 */}
      <div className="flex border-b border-border">
        {(['info', 'history', 'usage'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(FOCUS_RING, 
              'flex-1 cursor-pointer border-b-2 px-2 py-2.5 text-xs font-medium transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`detail.tabs.${key}`)}
            {key === 'history' && transactions.length > 0 && (
              <span className="ml-1 tabular-nums text-muted-foreground">
                {transactions.length}
              </span>
            )}
            {key === 'usage' && repairUsages.length > 0 && (
              <span className="ml-1 tabular-nums text-muted-foreground">
                {repairUsages.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'info' && <InfoContent item={item} openPoLines={openPoLines} />}
        {tab === 'history' && <HistoryContent transactions={transactions} />}
        {tab === 'usage' && <UsageContent repairUsages={repairUsages} />}
      </div>

      {/* 푸터 액션 */}
      <ActionButtons
        onAction={setActionMode}
        partId={item.partId}
        craneIds={item.craneIds}
        className="border-t border-border p-3"
      />

      {modal}
    </aside>
  );
}
