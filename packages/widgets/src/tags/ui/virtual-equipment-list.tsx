import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  VIRTUAL_EQUIPMENTS_MAX,
  type VirtualEquipment,
} from '@crane/domain/virtual-tag';
import { BayChip, useVirtualTagStore } from '@crane/features/3d';
import { Button } from '@crane/ui/atoms/button';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';
import { SearchField } from '@crane/ui/molecules/search-field';
import {
  collectVirtualBays,
  filterVirtualEquipments,
} from '../lib/virtual-tag-rows';
import { VirtualEquipmentCard } from './virtual-equipment-card';

/**
 * 가상 장비 목록 — 실시간 크레인 목록과 같은 구성. 검색·구역 칩은 왼쪽,
 * 장비 수·장비 등록은 오른쪽 끝. 카드는 저장 순이다. 카드의 복제는 바로
 * 적용하고, 삭제는 목록이 든 확인창 하나를 거친다.
 */
export function VirtualEquipmentList({
  equipments,
  onOpen,
  onRegister,
}: {
  equipments: VirtualEquipment[];
  onOpen: (equipmentId: string) => void;
  onRegister: () => void;
}) {
  const { t } = useTranslation();
  const updateEquipment = useVirtualTagStore((s) => s.updateEquipment);
  const duplicateEquipment = useVirtualTagStore((s) => s.duplicateEquipment);
  const removeEquipment = useVirtualTagStore((s) => s.removeEquipment);
  const [bay, setBay] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const bays = useMemo(() => collectVirtualBays(equipments), [equipments]);
  const visible = useMemo(
    () => filterVirtualEquipments(equipments, bay, query),
    [equipments, bay, query],
  );
  const canAdd = equipments.length < VIRTUAL_EQUIPMENTS_MAX;
  const pendingRemove =
    pendingRemoveId === null
      ? null
      : (equipments.find((e) => e.id === pendingRemoveId) ?? null);

  return (
    <div className="flex flex-col gap-3">
      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveId(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogTitle>
            {t('monitoring:virtualTags.equipment.removeTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingRemove
              ? t('monitoring:virtualTags.equipment.removeDescription', {
                  id: pendingRemove.craneId,
                  count: pendingRemove.tags.length,
                })
              : null}
          </AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogClose
              render={<Button type="button" variant="outline" size="sm" />}
            >
              {t('monitoring:virtualTags.equipment.cancel')}
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingRemove) removeEquipment(pendingRemove.id);
                setPendingRemoveId(null);
              }}
            >
              {t('monitoring:virtualTags.equipment.confirmRemove')}
            </Button>
          </div>
        </AlertDialogPopup>
      </AlertDialog>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('monitoring:virtualTags.equipment.search')}
          aria-label={t('monitoring:virtualTags.equipment.search')}
          className="w-60 max-w-full flex-none"
        />
        {bays.length > 0 ? (
          <div
            role="group"
            aria-label={t('monitoring:tags.allBays')}
            className="flex flex-wrap gap-1"
          >
            <BayChip
              label={t('monitoring:tags.allBays')}
              count={equipments.length}
              pressed={bay === 'all'}
              onClick={() => setBay('all')}
            />
            {bays.map((option) => (
              <BayChip
                key={option.bay}
                label={option.bay}
                count={option.count}
                pressed={bay === option.bay}
                onClick={() => setBay(option.bay)}
              />
            ))}
          </div>
        ) : null}
        <span className="flex-1" />
        <span className="text-muted-foreground px-1">
          {t('monitoring:virtualTags.equipment.count', {
            count: equipments.length,
            max: VIRTUAL_EQUIPMENTS_MAX,
          })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAdd}
          onClick={onRegister}
        >
          <Plus />
          {t('monitoring:virtualTags.equipment.add')}
        </Button>
      </div>

      {equipments.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t('monitoring:virtualTags.equipment.empty')}
        </p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t('monitoring:virtualTags.equipment.emptyFiltered')}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2.5">
          {visible.map((equipment) => (
            <VirtualEquipmentCard
              key={equipment.id}
              equipment={equipment}
              canDuplicate={canAdd}
              onOpen={onOpen}
              onToggleEnabled={(enabled) =>
                updateEquipment(equipment.id, { enabled })
              }
              onDuplicate={() => duplicateEquipment(equipment.id)}
              onRemove={() => setPendingRemoveId(equipment.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
