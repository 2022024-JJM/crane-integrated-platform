import { Copy, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VirtualEquipment } from '@crane/domain/virtual-tag';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Switch } from '@crane/ui/atoms/switch';

/**
 * 가상 장비 카드 — 위 줄은 장비 ID · 구역과 사용 스위치, 아래 줄은 태그 개수와
 * 장비 복제·삭제 버튼. 본문을 누르면 상세로, 스위치는 장비 전체를 켜고 끈다
 * (꺼진 장비는 흐리게). 스위치·버튼이 든 카드라 바깥은 버튼이 아니고 본문만
 * 버튼이다. 삭제 확인창은 목록(virtual-equipment-list)이 하나 들고 있다.
 */
export function VirtualEquipmentCard({
  equipment,
  canDuplicate,
  onOpen,
  onToggleEnabled,
  onDuplicate,
  onRemove,
}: {
  equipment: VirtualEquipment;
  /** 장비 상한에 닿으면 복제 버튼을 비활성으로. */
  canDuplicate: boolean;
  onOpen: (equipmentId: string) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { id, craneId, bay, enabled, tags } = equipment;
  return (
    <div
      className={cn(
        'bg-card text-card-foreground ring-foreground/10 hover:ring-foreground/30 flex min-w-0 flex-col gap-2 rounded-xl p-3 ring-1 transition-[box-shadow,opacity]',
        !enabled && 'opacity-55 hover:opacity-85',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onOpen(id)}
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left"
        >
          <span className="text-[15px] font-semibold tracking-wide">
            {craneId}
          </span>
          <span className="text-muted-foreground min-h-4 truncate text-[11px]">
            {bay ?? ''}
          </span>
        </button>
        <Switch
          checked={enabled}
          onCheckedChange={onToggleEnabled}
          aria-label={t('monitoring:virtualTags.equipment.enabled')}
          className="self-start"
        />
      </div>
      <div className="border-border text-muted-foreground flex items-center gap-0.5 border-t pt-2 text-[11px]">
        <span className="whitespace-nowrap">
          {t('monitoring:virtualTags.equipment.tagCount', {
            count: tags.length,
          })}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          disabled={!canDuplicate}
          aria-label={t('monitoring:virtualTags.equipment.duplicate')}
          title={t('monitoring:virtualTags.equipment.duplicate')}
          onClick={onDuplicate}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-red-300"
          aria-label={t('monitoring:virtualTags.equipment.remove')}
          title={t('monitoring:virtualTags.equipment.remove')}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
