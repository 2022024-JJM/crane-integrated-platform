import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TAG_SLOTS,
  getSlotTagKey,
  isTagKeySlotsEqual,
  setSlotTagKey,
  type TagKeySlots,
  type TagSlot,
} from '@crane/domain/3d';
import { useCraneSnapshotFeed } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Dialog, DialogPopup, DialogTitle } from '@crane/ui/molecules/dialog';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@crane/ui/molecules/tabs';
import { TagPickRealtimeTab } from './tag-pick-realtime-tab';
import { TagPickVirtualTab } from './tag-pick-virtual-tab';

export interface TagPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 열릴 때 보일 탭 — 카드에서 누른 슬롯. */
  initialSlot: TagSlot;
  /** 지금 연결된 두 슬롯. */
  value: TagKeySlots;
  /** 모델의 craneId — 실시간 탭이 그 크레인을 먼저 고른다. */
  modelCraneId?: string;
  /** "연결" — 두 슬롯 초안을 한 번에 넘긴다. 바뀐 슬롯만 다르다. */
  onApply: (next: TagKeySlots) => void;
}

/**
 * 태그 연결 다이얼로그 — 탭이 곧 슬롯이다(실시간 태그 | 가상 태그). 두 탭의
 * 선택을 초안으로 들고 있다가 "연결" 한 번에 적용한다. 슬롯 비우기는 카드의
 * × 가 한다. 머리줄은 제목과 닫기뿐이고, 탭·검색창은 에디터 팔레트와 같은
 * 모양(`@crane/ui` Tabs·SearchField)이다.
 *
 * 본문은 열려 있을 때만 마운트해 열 때마다 초안·탭이 `value`·`initialSlot`
 * 으로 돌아온다. 크레인 스냅샷 피드(REST + STOMP)도 본문 수명 — 닫으면
 * 소켓 참조를 놓는다(에디터에는 다른 참조자가 없어 소켓이 닫힌다).
 */
export function TagPickDialog(props: TagPickDialogProps) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex h-[min(82vh,760px)] w-[min(96vw,64rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        {open ? <TagPickDialogBody {...props} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

function TagPickDialogBody({
  initialSlot,
  value,
  modelCraneId,
  onApply,
  onOpenChange,
}: TagPickDialogProps) {
  const { t } = useTranslation();
  useCraneSnapshotFeed(true);
  const [slot, setSlot] = useState<TagSlot>(initialSlot);
  const [draft, setDraft] = useState<TagKeySlots>(value);
  const dirty = !isTagKeySlotsEqual(draft, value);

  return (
    <>
      <header className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t('monitoring:inspector.tagPick.title')}
        </DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground shrink-0"
          aria-label={t('monitoring:inspector.tagPick.cancel')}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </header>

      <Tabs
        value={slot}
        onValueChange={(next) => setSlot(next as TagSlot)}
        className="min-h-0 flex-1"
      >
        <TabsList>
          {TAG_SLOTS.map((option) => (
            <TabsTab key={option} value={option}>
              {t(`monitoring:tags.tabs.${option}`)}
            </TabsTab>
          ))}
        </TabsList>
        <TabsPanel value="realtime">
          <TagPickRealtimeTab
            value={draft.realtimeTagKey}
            onChange={(key) =>
              setDraft((prev) => setSlotTagKey(prev, 'realtime', key))
            }
            modelCraneId={modelCraneId}
          />
        </TabsPanel>
        <TabsPanel value="virtual">
          <TagPickVirtualTab
            value={draft.virtualTagKey}
            onChange={(key) =>
              setDraft((prev) => setSlotTagKey(prev, 'virtual', key))
            }
          />
        </TabsPanel>
      </Tabs>

      <footer className="border-border flex items-center gap-3 border-t px-3 py-2 text-xs">
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
          {TAG_SLOTS.map((option) => {
            const key = getSlotTagKey(draft, option);
            return (
              <span
                key={option}
                className="inline-flex min-w-0 items-center gap-1.5"
              >
                <span className="text-muted-foreground shrink-0">
                  {t(`monitoring:inspector.tagPick.slots.${option}`)}
                </span>
                <span
                  className={cn(
                    'truncate font-mono',
                    key ? 'text-orange-400' : 'text-muted-foreground',
                  )}
                >
                  {key ?? '—'}
                </span>
              </span>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          {t('monitoring:inspector.tagPick.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!dirty}
          onClick={() => onApply(draft)}
        >
          {t('monitoring:inspector.tagPick.apply')}
        </Button>
      </footer>
    </>
  );
}
