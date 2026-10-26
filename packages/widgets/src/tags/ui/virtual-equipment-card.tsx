import { useTranslation } from 'react-i18next';
import type { VirtualEquipment } from '@crane/domain/virtual-tag';
import { cn } from '@crane/core/lib/utils';
import { Switch } from '@crane/ui/atoms/switch';

/**
 * 가상 장비 카드 — 장비 ID · 이름 · 구역 · 태그 개수와 사용 스위치. 본문을
 * 누르면 상세로, 스위치는 장비 전체를 켜고 끈다(꺼진 장비는 흐리게).
 * 스위치가 든 카드라 바깥은 버튼이 아니고 본문만 버튼이다.
 */
export function VirtualEquipmentCard({
  equipment,
  onOpen,
  onToggleEnabled,
}: {
  equipment: VirtualEquipment;
  onOpen: (equipmentId: string) => void;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const { id, craneId, name, bay, enabled, tags } = equipment;
  return (
    <div
      className={cn(
        'bg-card text-card-foreground ring-foreground/10 hover:ring-foreground/30 flex min-w-0 items-stretch gap-2 rounded-xl p-3 ring-1 transition-[box-shadow,opacity]',
        !enabled && 'opacity-55 hover:opacity-85',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(id)}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left"
      >
        <span className="text-[15px] font-semibold tracking-wide">
          {craneId}
        </span>
        <span className="text-muted-foreground min-h-4 truncate text-[11px]">
          {[name, bay].filter(Boolean).join(' · ')}
        </span>
        <span className="text-muted-foreground text-[11px] whitespace-nowrap">
          {t('monitoring:virtualTags.equipment.tagCount', {
            count: tags.length,
          })}
        </span>
      </button>
      <Switch
        checked={enabled}
        onCheckedChange={onToggleEnabled}
        aria-label={t('monitoring:virtualTags.equipment.enabled')}
        className="self-start"
      />
    </div>
  );
}
