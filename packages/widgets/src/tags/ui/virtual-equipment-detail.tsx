import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  VIRTUAL_EQUIPMENT_GROUPS_MAX,
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_EQUIPMENT_TAGS_MAX,
  VIRTUAL_EQUIPMENTS_MAX,
  VIRTUAL_TAG_CODE_MAX,
  buildVirtualTagKey,
  type VirtualEquipment,
  type VirtualTagGroup,
} from '@crane/domain/virtual-tag';
import { useRigLivePoll, useVirtualTagStore } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { Switch } from '@crane/ui/atoms/switch';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';
import { Card, CardContent } from '@crane/ui/molecules/card';
import { SearchField } from '@crane/ui/molecules/search-field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { copyText } from '../lib/copy-text';
import {
  UNGROUPED_FILTER,
  countVirtualTagsByGroup,
  groupVirtualTags,
  nextTagCode,
  type VirtualGroupFilter,
} from '../lib/virtual-tag-rows';
import {
  getEquipmentIdError,
  type EquipmentIdError,
} from '../lib/virtual-tag-validation';
import { CELL_INPUT } from './virtual-cell-styles';
import { VIRTUAL_TAG_COLUMNS, VirtualTagRow } from './virtual-tag-row';

const COPIED_MS = 1_200;

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * 가상 장비 상세 — 머리글(목록 버튼 · 장비 ID · 이름 · 구역 · 사용 · 복제 ·
 * 삭제), 태그 검색·그룹 필터·그룹 추가·JSON 복사, 그룹별 인라인 편집 표.
 * 그룹 머리글마다 이름 편집·순서 이동·삭제·태그 추가가 있고, 미분류는 맨 끝.
 * 값은 러너(virtualTagRuntime)가 들고 있고 표는 15Hz 폴링으로 읽는다.
 *
 * 장비 ID·코드 입력은 비제어 — blur/Enter 에만 커밋한다. 거부되면 입력값을
 * 유지한 채 툴팁을 띄우고 포커스를 돌려보내 고칠 때까지 못 나가게 한다.
 * Escape 가 탈출구(원래 값으로 복귀).
 */
export function VirtualEquipmentDetail({
  equipmentId,
  equipment,
  onBack,
}: {
  equipmentId: string;
  equipment: VirtualEquipment | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  if (!equipment) {
    return (
      <div className="flex min-h-0 flex-col gap-3">
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft />
            {t('monitoring:virtualTags.equipment.back')}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {t('monitoring:virtualTags.equipment.unknown', { id: equipmentId })}
        </p>
      </div>
    );
  }
  return <EquipmentBody equipment={equipment} onBack={onBack} t={t} />;
}

function EquipmentBody({
  equipment,
  onBack,
  t,
}: {
  equipment: VirtualEquipment;
  onBack: () => void;
  t: T;
}) {
  useRigLivePoll();
  const equipments = useVirtualTagStore((s) => s.equipments);
  const updateEquipment = useVirtualTagStore((s) => s.updateEquipment);
  const removeEquipment = useVirtualTagStore((s) => s.removeEquipment);
  const duplicateEquipment = useVirtualTagStore((s) => s.duplicateEquipment);
  const addGroup = useVirtualTagStore((s) => s.addGroup);
  const updateGroup = useVirtualTagStore((s) => s.updateGroup);
  const removeGroup = useVirtualTagStore((s) => s.removeGroup);
  const moveGroup = useVirtualTagStore((s) => s.moveGroup);
  const addTag = useVirtualTagStore((s) => s.addTag);
  const updateTag = useVirtualTagStore((s) => s.updateTag);
  const removeTag = useVirtualTagStore((s) => s.removeTag);
  const duplicateTag = useVirtualTagStore((s) => s.duplicateTag);

  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<VirtualGroupFilter>('all');
  const [idError, setIdError] = useState<EquipmentIdError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const otherCraneIds = useMemo(
    () => equipments.filter((e) => e.id !== equipment.id).map((e) => e.craneId),
    [equipments, equipment.id],
  );
  const takenCodes = useMemo(
    () => equipment.tags.map((tag) => tag.code),
    [equipment.tags],
  );
  const counts = useMemo(() => countVirtualTagsByGroup(equipment), [equipment]);
  const sections = useMemo(
    () => groupVirtualTags(equipment, groupFilter, query),
    [equipment, groupFilter, query],
  );
  // 고른 그룹이 지워졌으면 전체로.
  const effectiveFilter =
    groupFilter === 'all' ||
    groupFilter === UNGROUPED_FILTER ||
    equipment.groups.some((g) => g.id === groupFilter)
      ? groupFilter
      : 'all';

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [copied]);

  const commitId = (input: HTMLInputElement): boolean => {
    const error = getEquipmentIdError(
      input.value,
      equipment.craneId,
      otherCraneIds,
    );
    if (error === null && input.value.trim() !== equipment.craneId) {
      updateEquipment(equipment.id, { craneId: input.value });
    }
    setIdError(error);
    return error === null;
  };

  const handleAddTag = (groupId: string | undefined) => {
    const result = addTag(equipment.id, {
      code: nextTagCode(t('monitoring:virtualTags.newCode'), takenCodes),
      groupId,
    });
    setMessage(
      result.ok
        ? null
        : t(`monitoring:virtualTags.errors.${result.reason}`, {
            max: VIRTUAL_EQUIPMENT_TAGS_MAX,
            codeMax: VIRTUAL_TAG_CODE_MAX,
          }),
    );
  };

  const handleAddGroup = () => {
    const result = addGroup(
      equipment.id,
      t('monitoring:virtualTags.groups.newName'),
    );
    setMessage(
      result.ok
        ? null
        : t('monitoring:virtualTags.groups.limit', {
            max: VIRTUAL_EQUIPMENT_GROUPS_MAX,
          }),
    );
  };

  const handleCopy = async () => {
    if (await copyText(JSON.stringify(equipment, null, 2))) setCopied(true);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* 머리글 — 장비 속성은 여기서 바로 고친다. */}
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft />
            {t('monitoring:virtualTags.equipment.back')}
          </Button>
          <Tooltip open={idError !== null}>
            <TooltipTrigger
              render={
                <Input
                  key={equipment.craneId}
                  defaultValue={equipment.craneId}
                  aria-label={t('monitoring:virtualTags.equipment.id')}
                  aria-invalid={idError !== null}
                  title={t('monitoring:virtualTags.equipment.idHint')}
                  className={cn(
                    CELL_INPUT,
                    'h-8 w-40 text-sm font-semibold tracking-wide',
                    idError !== null && 'border-amber-500 text-amber-500',
                  )}
                  onChange={() => setIdError(null)}
                  onBlur={(event) => {
                    const input = event.currentTarget;
                    if (!commitId(input)) {
                      queueMicrotask(() => input.focus());
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      event.currentTarget.value = equipment.craneId;
                      setIdError(null);
                      event.currentTarget.blur();
                    }
                  }}
                />
              }
            />
            <TooltipContent side="bottom">
              {idError
                ? t(`monitoring:virtualTags.equipment.errors.${idError}`, {
                    idMax: VIRTUAL_EQUIPMENT_ID_MAX,
                  })
                : null}
            </TooltipContent>
          </Tooltip>
          <Input
            value={equipment.name ?? ''}
            placeholder={t('monitoring:virtualTags.equipment.name')}
            aria-label={t('monitoring:virtualTags.equipment.name')}
            className={cn(CELL_INPUT, 'h-8 w-44')}
            onChange={(event) =>
              updateEquipment(equipment.id, { name: event.target.value })
            }
          />
          <Input
            value={equipment.bay ?? ''}
            placeholder={t('monitoring:virtualTags.equipment.bay')}
            aria-label={t('monitoring:virtualTags.equipment.bay')}
            className={cn(CELL_INPUT, 'h-8 w-28')}
            onChange={(event) =>
              updateEquipment(equipment.id, { bay: event.target.value })
            }
          />
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">
              {t('monitoring:virtualTags.equipment.enabled')}
            </span>
            <Switch
              checked={equipment.enabled}
              onCheckedChange={(enabled) =>
                updateEquipment(equipment.id, { enabled })
              }
            />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const result = duplicateEquipment(equipment.id);
              setMessage(
                result.ok
                  ? null
                  : t(
                      `monitoring:virtualTags.equipment.errors.${result.reason}`,
                      {
                        max: VIRTUAL_EQUIPMENTS_MAX,
                        idMax: VIRTUAL_EQUIPMENT_ID_MAX,
                      },
                    ),
              );
            }}
          >
            <Copy />
            {t('monitoring:virtualTags.equipment.duplicate')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hover:text-red-400"
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2 />
            {t('monitoring:virtualTags.equipment.remove')}
          </Button>
        </div>
      </TooltipProvider>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogPopup>
          <AlertDialogTitle>
            {t('monitoring:virtualTags.equipment.removeTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('monitoring:virtualTags.equipment.removeDescription', {
              id: equipment.craneId,
              count: equipment.tags.length,
            })}
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
                setRemoveOpen(false);
                removeEquipment(equipment.id);
                onBack();
              }}
            >
              {t('monitoring:virtualTags.equipment.confirmRemove')}
            </Button>
          </div>
        </AlertDialogPopup>
      </AlertDialog>

      {/* 검색·그룹 필터·그룹 추가·JSON 복사 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('monitoring:tags.searchTag')}
          aria-label={t('monitoring:tags.searchTag')}
          className="w-60 max-w-full flex-none"
        />
        <ToggleGroup
          value={[effectiveFilter]}
          onValueChange={(next) => {
            const picked = next[0] as VirtualGroupFilter | undefined;
            if (picked) setGroupFilter(picked);
          }}
          variant="outline"
          size="sm"
          aria-label={t('monitoring:virtualTags.groups.all')}
          className="flex-wrap"
        >
          <ToggleGroupItem value="all" className="h-7 px-2.5 text-xs">
            {t('monitoring:virtualTags.groups.all')}
          </ToggleGroupItem>
          {equipment.groups.map((group) => (
            <ToggleGroupItem
              key={group.id}
              value={group.id}
              className="h-7 px-2.5 text-xs"
            >
              {group.name || t('monitoring:virtualTags.groups.newName')} ·{' '}
              {counts[group.id] ?? 0}
            </ToggleGroupItem>
          ))}
          {counts[UNGROUPED_FILTER] > 0 ? (
            <ToggleGroupItem
              value={UNGROUPED_FILTER}
              className="h-7 px-2.5 text-xs"
            >
              {t('monitoring:virtualTags.groups.ungrouped')} ·{' '}
              {counts[UNGROUPED_FILTER]}
            </ToggleGroupItem>
          ) : null}
        </ToggleGroup>
        <span className="flex-1" />
        <span className="text-muted-foreground px-1">
          {t('monitoring:virtualTags.count', {
            count: equipment.tags.length,
            max: VIRTUAL_EQUIPMENT_TAGS_MAX,
          })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={equipment.groups.length >= VIRTUAL_EQUIPMENT_GROUPS_MAX}
          onClick={handleAddGroup}
        >
          <FolderPlus />
          {t('monitoring:virtualTags.groups.add')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => void handleCopy()}
        >
          <Copy />
          {t(copied ? 'monitoring:tags.copied' : 'monitoring:tags.copyJson')}
        </Button>
      </div>
      <p className="text-muted-foreground text-[11px]">
        {t('monitoring:virtualTags.codeHint')}
      </p>
      {message ? (
        <p className="text-[11px] text-amber-500" role="status">
          {message}
        </p>
      ) : null}

      <Card className="min-h-64 shrink-0 gap-0 overflow-hidden py-0">
        <CardContent className="max-h-[60vh] min-h-0 overflow-auto p-0">
          <TooltipProvider>
            <Table className="w-max min-w-full table-fixed text-xs">
              <TableHeader>
                <TableRow>
                  {VIRTUAL_TAG_COLUMNS.map(([column, width]) => (
                    <TableHead
                      key={column}
                      className={cn(
                        'bg-card sticky top-0 text-center text-[11px] whitespace-nowrap',
                        width,
                      )}
                    >
                      {t(`monitoring:virtualTags.columns.${column}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <GroupRows
                    key={section.group?.id ?? UNGROUPED_FILTER}
                    group={section.group}
                    index={equipment.groups.findIndex(
                      (g) => g.id === section.group?.id,
                    )}
                    groupCount={equipment.groups.length}
                    tagCount={section.tags.length}
                    canAddTag={
                      equipment.tags.length < VIRTUAL_EQUIPMENT_TAGS_MAX
                    }
                    onRename={(name) =>
                      section.group &&
                      updateGroup(equipment.id, section.group.id, { name })
                    }
                    onMove={(delta) =>
                      section.group &&
                      moveGroup(equipment.id, section.group.id, delta)
                    }
                    onRemove={() =>
                      section.group &&
                      removeGroup(equipment.id, section.group.id)
                    }
                    onAddTag={() => handleAddTag(section.group?.id)}
                    t={t}
                  >
                    {section.tags.map((tag) => (
                      <VirtualTagRow
                        key={tag.id}
                        tag={tag}
                        tagKey={buildVirtualTagKey(equipment.craneId, tag.code)}
                        groups={equipment.groups}
                        takenCodes={takenCodes}
                        onUpdate={(patch) =>
                          updateTag(equipment.id, tag.id, patch)
                        }
                        onDuplicate={() => {
                          const result = duplicateTag(equipment.id, tag.id);
                          setMessage(
                            result.ok
                              ? null
                              : t(
                                  `monitoring:virtualTags.errors.${result.reason}`,
                                  {
                                    max: VIRTUAL_EQUIPMENT_TAGS_MAX,
                                    codeMax: VIRTUAL_TAG_CODE_MAX,
                                  },
                                ),
                          );
                        }}
                        onRemove={() => removeTag(equipment.id, tag.id)}
                        t={t}
                      />
                    ))}
                  </GroupRows>
                ))}
                {equipment.tags.length === 0 && sections.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={VIRTUAL_TAG_COLUMNS.length}
                      className="text-muted-foreground py-8 text-center text-xs"
                    >
                      {t('monitoring:virtualTags.empty')}
                    </TableCell>
                  </TableRow>
                ) : null}
                {equipment.tags.length > 0 &&
                sections.every((s) => s.tags.length === 0) ? (
                  <TableRow>
                    <TableCell
                      colSpan={VIRTUAL_TAG_COLUMNS.length}
                      className="text-muted-foreground py-6 text-center text-xs"
                    >
                      {t('monitoring:virtualTags.emptyFiltered')}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 그룹 묶음 — 머리글 행(이름 입력 · 개수 · 위/아래 · 삭제 · 태그 추가)과 그
 * 아래 태그 행들. 미분류(group null)는 이름을 바꾸거나 지울 수 없고 태그 추가만.
 */
function GroupRows({
  group,
  index,
  groupCount,
  tagCount,
  canAddTag,
  onRename,
  onMove,
  onRemove,
  onAddTag,
  t,
  children,
}: {
  group: VirtualTagGroup | null;
  index: number;
  groupCount: number;
  tagCount: number;
  canAddTag: boolean;
  onRename: (name: string) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onAddTag: () => void;
  t: T;
  children: ReactNode;
}) {
  return (
    <>
      <TableRow className="hover:bg-muted bg-muted">
        <TableCell colSpan={VIRTUAL_TAG_COLUMNS.length} className="py-1">
          <div className="flex items-center gap-2">
            {group ? (
              <Input
                value={group.name}
                placeholder={t('monitoring:virtualTags.groups.newName')}
                aria-label={t('monitoring:virtualTags.groups.rename')}
                className={cn(CELL_INPUT, 'h-6 w-44 font-semibold')}
                onChange={(event) => onRename(event.target.value)}
              />
            ) : (
              <span className="text-muted-foreground px-2 text-[11px] font-semibold tracking-wide">
                {t('monitoring:virtualTags.groups.ungrouped')}
              </span>
            )}
            <span className="text-muted-foreground text-[11px]">
              · {tagCount}
            </span>
            <span className="flex-1" />
            {group ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  disabled={index <= 0}
                  aria-label={t('monitoring:virtualTags.groups.moveUp')}
                  title={t('monitoring:virtualTags.groups.moveUp')}
                  onClick={() => onMove(-1)}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  disabled={index < 0 || index >= groupCount - 1}
                  aria-label={t('monitoring:virtualTags.groups.moveDown')}
                  title={t('monitoring:virtualTags.groups.moveDown')}
                  onClick={() => onMove(1)}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-red-300"
                  aria-label={t('monitoring:virtualTags.groups.remove')}
                  title={t('monitoring:virtualTags.groups.remove')}
                  onClick={onRemove}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={!canAddTag}
              onClick={onAddTag}
            >
              <Plus />
              {t('monitoring:virtualTags.groups.addTag')}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {children}
    </>
  );
}
