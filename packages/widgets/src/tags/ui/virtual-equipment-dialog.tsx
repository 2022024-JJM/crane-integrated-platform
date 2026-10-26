import { X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_EQUIPMENTS_MAX,
  createDefaultGroups,
  type VirtualTagGroupPreset,
} from '@crane/domain/virtual-tag';
import {
  cloneTagsFromSnapshot,
  useCraneSnapshotFeed,
  useCraneSnapshotStore,
  useVirtualTagStore,
} from '@crane/features/3d';
import { createId } from '@crane/core/lib/create-id';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { Dialog, DialogPopup, DialogTitle } from '@crane/ui/molecules/dialog';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@crane/ui/molecules/tabs';
import { getEquipmentIdError } from '../lib/virtual-tag-validation';
import { CELL_INPUT } from './virtual-cell-styles';
import { VirtualClonePicker } from './virtual-clone-picker';

export interface VirtualEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 등록이 끝나면 새 장비 id 로. 호출자가 닫고 상세로 옮긴다. */
  onCreated: (equipmentId: string) => void;
  /**
   * 실시간 상세의 "가상 장비로 복제" — 이 크레인을 복제 소스로 미리 고르고
   * 장비 ID 도 같은 값으로 채운 채 복제 탭에서 열린다.
   */
  cloneCraneId?: string;
}

type DialogTab = 'basic' | 'clone';

/**
 * 장비 등록 다이얼로그 — 기본 정보(ID·이름·구역) 탭과 실시간 복제 탭. 등록
 * 하면 기본 그룹(시각·계측값·상태·알람)을 시드하고, 복제 소스를 골랐으면
 * 그 크레인의 체크한 태그를 현재값·관측 범위로 넣는다(1회 스냅샷). 본문은
 * 열려 있을 때만 마운트해 열 때마다 초안이 비고, 크레인 스냅샷 피드도 본문
 * 수명이다(태그 연결 다이얼로그와 같은 규칙).
 */
export function VirtualEquipmentDialog(props: VirtualEquipmentDialogProps) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex h-[min(78vh,680px)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        {open ? <DialogBody {...props} /> : null}
      </DialogPopup>
    </Dialog>
  );
}

function DialogBody({
  onOpenChange,
  onCreated,
  cloneCraneId,
}: VirtualEquipmentDialogProps) {
  const { t } = useTranslation();
  useCraneSnapshotFeed(true);
  const equipments = useVirtualTagStore((s) => s.equipments);
  const addEquipment = useVirtualTagStore((s) => s.addEquipment);
  const importTags = useVirtualTagStore((s) => s.importTags);

  const [tab, setTab] = useState<DialogTab>(cloneCraneId ? 'clone' : 'basic');
  const [craneId, setCraneId] = useState(cloneCraneId ?? '');
  const [name, setName] = useState('');
  const [bay, setBay] = useState('');
  const [cloneSource, setCloneSource] = useState<string | null>(
    cloneCraneId ?? null,
  );
  const [selectedCodes, setSelectedCodes] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 장비 ID 가 복제 소스에서 자동으로 채워진 상태인지 — 사용자가 직접 치면 끝.
  const idAutoFilledRef = useRef(Boolean(cloneCraneId));

  const takenCraneIds = useMemo(
    () => equipments.map((e) => e.craneId),
    [equipments],
  );
  const idError =
    craneId.trim().length > 0
      ? getEquipmentIdError(craneId, null, takenCraneIds)
      : null;
  const canSubmit =
    craneId.trim().length > 0 &&
    idError === null &&
    equipments.length < VIRTUAL_EQUIPMENTS_MAX;

  const groupNames: Record<VirtualTagGroupPreset, string> = {
    datetime: t('monitoring:virtualTags.groups.defaults.datetime'),
    measurement: t('monitoring:virtualTags.groups.defaults.measurement'),
    status: t('monitoring:virtualTags.groups.defaults.status'),
  };

  const handleCloneSourceChange = (next: string | null) => {
    setCloneSource(next);
    setSelectedCodes(null);
    if (!next) return;
    if (idAutoFilledRef.current || craneId.trim().length === 0) {
      setCraneId(next);
      idAutoFilledRef.current = true;
    }
    const sourceBay =
      useCraneSnapshotStore.getState().cranes[next]?.snapshot.bay;
    if (sourceBay && bay.trim().length === 0) setBay(sourceBay);
  };

  const handleSubmit = () => {
    const result = addEquipment({
      craneId,
      name,
      bay,
      groups: createDefaultGroups(groupNames, createId),
    });
    if (!result.ok) {
      setError(
        t(`monitoring:virtualTags.equipment.errors.${result.reason}`, {
          max: VIRTUAL_EQUIPMENTS_MAX,
          idMax: VIRTUAL_EQUIPMENT_ID_MAX,
        }),
      );
      return;
    }
    if (cloneSource) {
      const entry = useCraneSnapshotStore.getState().cranes[cloneSource];
      const equipment = useVirtualTagStore
        .getState()
        .equipments.find((e) => e.id === result.id);
      if (entry && equipment) {
        const cloned = cloneTagsFromSnapshot(entry, {
          codes: selectedCodes ?? undefined,
          existingGroups: equipment.groups,
          groupNames,
          nextId: createId,
        });
        const imported = importTags(result.id, cloned);
        toast.success(
          imported.skipped > 0
            ? t('monitoring:virtualTags.dialog.clonedSkipped', {
                count: imported.added,
                skipped: imported.skipped,
              })
            : t('monitoring:virtualTags.dialog.cloned', {
                count: imported.added,
              }),
        );
      }
    }
    onCreated(result.id);
  };

  return (
    <>
      <header className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t('monitoring:virtualTags.dialog.title')}
        </DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground shrink-0"
          aria-label={t('monitoring:virtualTags.equipment.cancel')}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </header>

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as DialogTab)}
        className="min-h-0 flex-1"
      >
        <TabsList>
          <TabsTab value="basic">
            {t('monitoring:virtualTags.dialog.basic')}
          </TabsTab>
          <TabsTab value="clone">
            {t('monitoring:virtualTags.dialog.clone')}
            {cloneSource ? ` · ${cloneSource}` : ''}
          </TabsTab>
        </TabsList>
        <TabsPanel value="basic" className="gap-3 overflow-y-auto p-4 text-xs">
          <Field label={t('monitoring:virtualTags.equipment.id')}>
            <Input
              value={craneId}
              autoFocus
              aria-invalid={idError !== null}
              placeholder="GC-04"
              className={cn(
                CELL_INPUT,
                'h-8',
                idError !== null && 'border-amber-500 text-amber-500',
              )}
              onChange={(event) => {
                idAutoFilledRef.current = false;
                setCraneId(event.target.value);
                setError(null);
              }}
            />
            <p
              className={cn(
                'text-[11px]',
                idError !== null ? 'text-amber-500' : 'text-muted-foreground',
              )}
            >
              {idError !== null
                ? t(`monitoring:virtualTags.equipment.errors.${idError}`, {
                    idMax: VIRTUAL_EQUIPMENT_ID_MAX,
                  })
                : t('monitoring:virtualTags.equipment.idHint')}
            </p>
          </Field>
          <Field label={t('monitoring:virtualTags.equipment.name')}>
            <Input
              value={name}
              className={cn(CELL_INPUT, 'h-8')}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label={t('monitoring:virtualTags.equipment.bay')}>
            <Input
              value={bay}
              className={cn(CELL_INPUT, 'h-8')}
              onChange={(event) => setBay(event.target.value)}
            />
          </Field>
        </TabsPanel>
        <TabsPanel value="clone">
          <p className="text-muted-foreground px-4 pt-3 pb-2 text-[11px]">
            {t('monitoring:virtualTags.dialog.cloneHint')}
          </p>
          <VirtualClonePicker
            value={cloneSource}
            onChange={handleCloneSourceChange}
            selectedCodes={selectedCodes}
            onSelectedCodesChange={setSelectedCodes}
          />
        </TabsPanel>
      </Tabs>

      <footer className="border-border flex items-center gap-3 border-t px-3 py-2 text-xs">
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            error ? 'text-amber-500' : 'text-muted-foreground',
          )}
        >
          {error ??
            (craneId.trim()
              ? `${t('monitoring:virtualTags.equipment.id')} · ${craneId.trim()}`
              : '')}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
        >
          {t('monitoring:virtualTags.equipment.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {t('monitoring:virtualTags.dialog.create')}
        </Button>
      </footer>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground font-medium">{label}</span>
      {children}
    </label>
  );
}
