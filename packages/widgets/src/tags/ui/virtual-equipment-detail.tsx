import { ArrowLeft, Copy, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  VIRTUAL_EQUIPMENT_ID_MAX,
  VIRTUAL_EQUIPMENT_TAGS_MAX,
  VIRTUAL_TAG_CODE_MAX,
  buildVirtualTagKey,
  type VirtualEquipment,
} from '@crane/domain/virtual-tag';
import { useRigLivePoll, useVirtualTagStore } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { copyText } from '../lib/copy-text';
import { filterVirtualTags, nextTagCode } from '../lib/virtual-tag-rows';
import {
  getEquipmentIdError,
  type EquipmentIdError,
} from '../lib/virtual-tag-validation';
import { CELL_INPUT } from './virtual-cell-styles';
import { VIRTUAL_TAG_COLUMNS, VirtualTagRow } from './virtual-tag-row';

const COPIED_MS = 1_200;

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * 가상 장비 상세 — 머리글(목록 버튼 · 장비 ID · 구역), 태그 검색·태그 수·
 * 태그 추가·JSON 복사, 인라인 편집 표. 장비의 사용·복제·삭제는 목록 카드가
 * 맡는다. 값은 러너(virtualTagRuntime)가 들고 있고 표는 15Hz 폴링으로 읽는다.
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
  const addTag = useVirtualTagStore((s) => s.addTag);
  const updateTag = useVirtualTagStore((s) => s.updateTag);
  const removeTag = useVirtualTagStore((s) => s.removeTag);
  const duplicateTag = useVirtualTagStore((s) => s.duplicateTag);

  const [query, setQuery] = useState('');
  const [idError, setIdError] = useState<EquipmentIdError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const otherCraneIds = useMemo(
    () => equipments.filter((e) => e.id !== equipment.id).map((e) => e.craneId),
    [equipments, equipment.id],
  );
  const takenCodes = useMemo(
    () => equipment.tags.map((tag) => tag.code),
    [equipment.tags],
  );
  const visibleTags = useMemo(
    () => filterVirtualTags(equipment.tags, query),
    [equipment.tags, query],
  );
  const canAddTag = equipment.tags.length < VIRTUAL_EQUIPMENT_TAGS_MAX;

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

  const tagErrorMessage = (reason: string) =>
    t(`monitoring:virtualTags.errors.${reason}`, {
      max: VIRTUAL_EQUIPMENT_TAGS_MAX,
      codeMax: VIRTUAL_TAG_CODE_MAX,
    });

  const handleAddTag = () => {
    const result = addTag(equipment.id, {
      code: nextTagCode(t('monitoring:virtualTags.newCode'), takenCodes),
    });
    setMessage(result.ok ? null : tagErrorMessage(result.reason));
  };

  const handleCopy = async () => {
    if (await copyText(JSON.stringify(equipment, null, 2))) setCopied(true);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* 머리글 — 장비 ID·구역은 여기서 바로 고친다. */}
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
            value={equipment.bay ?? ''}
            placeholder={t('monitoring:virtualTags.equipment.bay')}
            aria-label={t('monitoring:virtualTags.equipment.bay')}
            className={cn(CELL_INPUT, 'h-8 w-28')}
            onChange={(event) =>
              updateEquipment(equipment.id, { bay: event.target.value })
            }
          />
        </div>
      </TooltipProvider>

      {/* 검색·태그 수·태그 추가·JSON 복사 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('monitoring:tags.searchTag')}
          aria-label={t('monitoring:tags.searchTag')}
          className="w-60 max-w-full flex-none"
        />
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
          disabled={!canAddTag}
          onClick={handleAddTag}
        >
          <Plus />
          {t('monitoring:virtualTags.addTag')}
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
        <CardContent className="max-h-[60vh] min-h-0 overflow-y-auto p-0">
          <TooltipProvider>
            <Table className="w-full table-fixed text-xs">
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
                {visibleTags.map((tag) => (
                  <VirtualTagRow
                    key={tag.id}
                    tag={tag}
                    tagKey={buildVirtualTagKey(equipment.craneId, tag.code)}
                    takenCodes={takenCodes}
                    onUpdate={(patch) => updateTag(equipment.id, tag.id, patch)}
                    onDuplicate={() => {
                      const result = duplicateTag(equipment.id, tag.id);
                      setMessage(
                        result.ok ? null : tagErrorMessage(result.reason),
                      );
                    }}
                    onRemove={() => removeTag(equipment.id, tag.id)}
                    t={t}
                  />
                ))}
                {equipment.tags.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={VIRTUAL_TAG_COLUMNS.length}
                      className="text-muted-foreground py-8 text-center text-xs"
                    >
                      {t('monitoring:virtualTags.empty')}
                    </TableCell>
                  </TableRow>
                ) : visibleTags.length === 0 ? (
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
