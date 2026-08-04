import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePartDetail } from '@crane/features/inventory';
import type { InventoryStatus } from '@crane/domain/inventory';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { KC, KC_FONT_DISPLAY, KC_FONT_MONO } from '../../../shared/ui/kc';
import { StockActionModal, type ActionMode } from './stock-action-modal';
import {
  ActionButtons,
  HistoryContent,
  InfoContent,
  StockChips,
  UsageContent,
} from './part-detail-contents';

export type PanelTab = 'info' | 'history' | 'usage';

const TABS: PanelTab[] = ['info', 'history', 'usage'];

const TAB_LABEL_KEY: Record<PanelTab, string> = {
  info: 'inventory.detail.tabInfo',
  history: 'inventory.detail.tabHistory',
  usage: 'inventory.detail.tabUsage',
};

/** 목록 페이지와 동일한 상태색 규칙 */
const STATUS_COLOR: Record<InventoryStatus, string> = {
  normal: KC.ok,
  low: KC.production,
  out_of_stock: KC.safety,
  excess: KC.planned,
  expiry_soon: KC.undetermined,
};

const STATUS_KEY: Record<InventoryStatus, string> = {
  normal: 'statusNormal',
  low: 'statusLow',
  out_of_stock: 'statusOut',
  excess: 'statusExcess',
  expiry_soon: 'statusExpiry',
};

/**
 * 부품 상세 — 사이드패널(탭: 부품 정보/입출고 이력/WO 사용) + 전체화면 확장 뷰.
 * 열림/선택은 `?part=` URL 단일 소스(페이지가 관리), 탭은 `?ptab=`, 확장은 로컬 상태.
 * 항상 마운트되어 transform 으로 슬라이드한다 (assets-page 드로어와 동일 패턴).
 */
export function PartDetailPanel({
  partId,
  onClose,
}: {
  partId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('mro2');
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOpen: sidebarOpen } = useSidebar();

  const open = partId !== null;
  // 슬라이드 아웃 동안에도 마지막 부품을 계속 그린다 (assets-page의 displayed 패턴)
  const lastIdRef = useRef<string | null>(null);
  if (partId !== null) lastIdRef.current = partId;
  const displayId = partId ?? lastIdRef.current;

  const { item, transactions, repairUsages, openPoLines, onOrderQty } = usePartDetail(displayId ?? '');

  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [expanded, setExpanded] = useState(false);

  const rawTab = searchParams.get('ptab');
  const tab: PanelTab = TABS.includes(rawTab as PanelTab) ? (rawTab as PanelTab) : 'info';
  const setTab = (next: PanelTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'info') params.delete('ptab');
    else params.set('ptab', next);
    setSearchParams(params);
  };

  // 닫히면 일회성 상태 정리 — 다음 부품에서 확장/모달이 이월되지 않게
  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setActionMode(null);
    }
  }, [open]);

  // ESC: 모달(재고 액션/WO 생성) 열림 → 해당 모달이 처리 / 확장 뷰 → 패널로 / 패널 → 닫기
  const newTicketOpen = searchParams.get('new') !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (actionMode || newTicketOpen) return; // 상단 레이어가 ESC를 우선 처리
      if (expanded) setExpanded(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, actionMode, newTicketOpen, expanded, onClose]);

  if (!item) return null;

  const statusRow = (
    <div className="flex items-center gap-1.5 text-[10.5px]">
      <span className="inline-block h-3 w-[4px]" style={{ background: STATUS_COLOR[item.status] }} />
      <span style={{ color: KC.text }}>{t(`inventory.${STATUS_KEY[item.status]}`)}</span>
      <span style={{ color: KC.faint }}>·</span>
      <span style={{ color: KC.muted }}>{item.criticality}</span>
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

  const iconBtn = 'cursor-pointer p-1';

  // ── 확장 전체 뷰: 탭이 병렬 컬럼으로 펼쳐진다 ──
  if (open && expanded) {
    return (
      <div
        className={`fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col ${sidebarOpen ? 'lg:left-64' : ''}`}
        style={{ background: KC.bg }}
      >
        {/* 헤더 */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-3.5" style={{ borderColor: KC.border }}>
          <div className="min-w-0">
            <div className="text-[10.5px]" style={{ color: KC.muted, fontFamily: KC_FONT_MONO }}>
              {item.partNumber}
            </div>
            <h2 className="truncate text-[17px] font-bold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
              {item.partName}
            </h2>
            <div className="mt-1">{statusRow}</div>
          </div>
          <div className="flex items-center gap-3">
            <StockChips item={item} onOrderQty={onOrderQty} className="w-[380px] max-w-full" />
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className={iconBtn}
                aria-label={t('inventory.detail.collapse')}
              >
                <Minimize2 size={15} style={{ color: KC.ink }} />
              </button>
              <button type="button" onClick={onClose} className={iconBtn} aria-label={t('inventory.detail.close')}>
                <X size={15} style={{ color: KC.ink }} />
              </button>
            </div>
          </div>
        </div>

        {/* 3열 본문 */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.1fr_1.2fr_1fr] lg:overflow-hidden">
          <section className="border-b p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r" style={{ borderColor: KC.border }}>
            <h3 className="mb-2.5 text-[11.5px] font-bold" style={{ color: KC.ink }}>
              {t(TAB_LABEL_KEY.info)}
            </h3>
            <InfoContent item={item} openPoLines={openPoLines} />
          </section>
          <section className="border-b p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r" style={{ borderColor: KC.border }}>
            <h3 className="mb-2.5 text-[11.5px] font-bold" style={{ color: KC.ink }}>
              {t(TAB_LABEL_KEY.history)}
              {transactions.length > 0 && (
                <span className="ml-1.5 tabular-nums" style={{ color: KC.muted }}>
                  {transactions.length}
                </span>
              )}
            </h3>
            <HistoryContent transactions={transactions} />
          </section>
          <section className="p-4 lg:overflow-y-auto">
            <h3 className="mb-2.5 text-[11.5px] font-bold" style={{ color: KC.ink }}>
              {t(TAB_LABEL_KEY.usage)}
              {repairUsages.length > 0 && (
                <span className="ml-1.5 tabular-nums" style={{ color: KC.muted }}>
                  {repairUsages.length}
                </span>
              )}
            </h3>
            <UsageContent repairUsages={repairUsages} />
          </section>
        </div>

        {/* 푸터 액션 */}
        <div className="flex justify-end border-t px-5 py-2.5" style={{ borderColor: KC.border }}>
          <ActionButtons onAction={setActionMode} partId={item.partId} craneIds={item.craneIds} className="w-72" />
        </div>

        {modal}
      </div>
    );
  }

  // ── 사이드 패널 뷰 ──
  return (
    <aside
      role="complementary"
      aria-label={t('inventory.detail.panelLabel', { part: item.partName })}
      aria-hidden={!open}
      className="fixed top-14 right-0 bottom-0 z-40 flex w-[380px] max-w-[calc(100vw-1rem)] flex-col border-l shadow-xl transition-transform duration-300 ease-out"
      style={{
        borderColor: KC.border,
        background: KC.bg,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        pointerEvents: open ? 'auto' : 'none',
        willChange: 'transform',
      }}
    >
      {/* 헤더 */}
      <div className="flex flex-col gap-1.5 border-b px-4 pt-4 pb-3" style={{ borderColor: KC.border }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px]" style={{ color: KC.muted, fontFamily: KC_FONT_MONO }}>
              {item.partNumber}
            </div>
            <h3 className="truncate text-[13px] font-bold" style={{ color: KC.ink }}>
              {item.partName}
            </h3>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className={iconBtn}
              aria-label={t('inventory.detail.expand')}
            >
              <Maximize2 size={14} style={{ color: KC.ink }} />
            </button>
            <button type="button" onClick={onClose} className={iconBtn} aria-label={t('inventory.detail.close')}>
              <X size={15} style={{ color: KC.ink }} />
            </button>
          </div>
        </div>
        {statusRow}
      </div>

      {/* 재고 요약 */}
      <div className="border-b p-3" style={{ borderColor: KC.border }}>
        <StockChips item={item} onOrderQty={onOrderQty} />
      </div>

      {/* 탭 */}
      <div className="flex border-b text-[11.5px]" style={{ borderColor: KC.border }}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex-1 cursor-pointer py-2"
            style={{
              color: KC.ink,
              fontWeight: tab === key ? 700 : 400,
              borderBottom: tab === key ? `2px solid ${KC.ink}` : '2px solid transparent',
            }}
          >
            {t(TAB_LABEL_KEY[key])}
            {key === 'history' && transactions.length > 0 && (
              <span className="ml-1 tabular-nums" style={{ color: KC.muted }}>
                {transactions.length}
              </span>
            )}
            {key === 'usage' && repairUsages.length > 0 && (
              <span className="ml-1 tabular-nums" style={{ color: KC.muted }}>
                {repairUsages.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {tab === 'info' && <InfoContent item={item} openPoLines={openPoLines} />}
        {tab === 'history' && <HistoryContent transactions={transactions} />}
        {tab === 'usage' && <UsageContent repairUsages={repairUsages} />}
      </div>

      {/* 푸터 액션 */}
      <ActionButtons
        onAction={setActionMode}
        partId={item.partId}
        craneIds={item.craneIds}
        className="border-t p-3"
      />

      {modal}
    </aside>
  );
}
