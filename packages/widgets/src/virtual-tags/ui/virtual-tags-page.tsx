import {
  Copy,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  isVirtualTagSetStoredLocallyOnly,
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_TICK_MAX,
  VIRTUAL_TAG_TICK_MIN,
  VIRTUAL_TAGS_MAX,
  type VirtualTagDefinition,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
} from '@crane/domain/virtual-tag';
import {
  useRigLivePoll,
  useVirtualTagStore,
  virtualTagRuntime,
  type VirtualTagAddResult,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Switch } from '@crane/ui/atoms/switch';
import { Card, CardContent } from '@crane/ui/molecules/card';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
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
import {
  SceneUnsavedChangesDialog,
  useSceneUnsavedChangesGuard,
} from '@crane/widgets/scene-editor';
import { getTagKeyError, type TagKeyError } from '../lib/tag-key-validation';
import { WaveformIcon } from './waveform-icon';

/**
 * 가상 태그 관리 페이지 — 전역 목록의 CRUD·패턴 설정·재생.
 *
 * 값은 러너(virtualTagRuntime)가 들고 있고 표는 15Hz 폴링으로 읽는다.
 * 정의 편집은 스토어(메모리)를 지나고 저장 버튼이 배포 파일/localStorage 에
 * 기록한다 — 저장 상태는 씬 편집과 같이 저장 버튼의 점(미저장)·스피너(저장
 * 중)로 나타내고 결과는 토스트로 알리며, 미저장 이탈 경고는 같은 훅을 쓴다.
 * 키 중복·빈 키 같은 거부는 스토어가 boolean/결과로 돌려주고 여기서는 문구만
 * 보여 준다.
 *
 * 표는 table-fixed + 퍼센트 열 너비다 — auto 레이아웃이면 InputNumber 가
 * 호버 시 스테퍼 여백(pr-5)을 얻을 때 인풋 고유 폭이 커져 열이 흔들리고,
 * 표 폭이 줄 때 고정 폭 인풋이 든 열은 안 줄고 나머지만 줄어든다.
 */

const COLUMNS = [
  ['enabled', 'w-[4%]'],
  ['key', 'w-[18%]'],
  ['name', 'w-[14%]'],
  ['unit', 'w-[7%]'],
  ['min', 'w-[8%]'],
  ['max', 'w-[8%]'],
  ['pattern', 'w-[11%]'],
  ['period', 'w-[9%]'],
  ['value', 'w-[16%]'],
  ['actions', 'w-[5%]'],
] as const;

const CELL_INPUT =
  'border-border bg-muted text-foreground placeholder:text-muted-foreground h-7 w-full min-w-0 rounded-sm px-2 text-xs';
const CELL_NUMBER_WRAPPER =
  'border-border bg-muted h-7 w-full min-w-0 rounded-sm';
const CELL_NUMBER_INPUT = 'px-2 text-xs';

function defaultPattern(kind: VirtualTagPatternKind): VirtualTagPattern {
  return kind === 'manual'
    ? { kind }
    : { kind, periodMs: VIRTUAL_TAG_PERIOD_DEFAULT };
}

function withPeriod(
  pattern: VirtualTagPattern,
  periodMs: number,
): VirtualTagPattern {
  return pattern.kind === 'manual' ? pattern : { ...pattern, periodMs };
}

function formatValue(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value)
    ? Number(value.toFixed(3)).toString()
    : '—';
}

function TagRow({
  tag,
  takenKeys,
  onUpdate,
  onDuplicate,
  onRemove,
  t,
}: {
  tag: VirtualTagDefinition;
  /** 전체 태그 키 — 중복 판정용. */
  takenKeys: string[];
  onUpdate: (patch: Partial<Omit<VirtualTagDefinition, 'id'>>) => boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  // 키 입력은 비제어 — blur/Enter 에만 커밋한다(글자마다 저장·거부 문구가
  // 튀지 않게). 외부에서 키가 바뀌면 key={tag.key} 로 input 을 다시 마운트한다.
  // 거부되면 입력값을 유지한 채 툴팁을 띄우고 포커스를 돌려보내 고칠 때까지
  // 못 나가게 한다. Escape 가 탈출구(원래 키로 복귀).
  const [keyError, setKeyError] = useState<TagKeyError | null>(null);

  const value = virtualTagRuntime.getValue(tag.id);
  const manual = tag.pattern.kind === 'manual';
  const range = tag.max - tag.min;
  const pct =
    value === undefined || range <= 0
      ? 0
      : Math.min(100, Math.max(0, ((value - tag.min) / range) * 100));

  const commitKey = (input: HTMLInputElement): boolean => {
    const error = getTagKeyError(input.value, tag.key, takenKeys);
    if (error === null && input.value.trim() !== tag.key) {
      onUpdate({ key: input.value });
    }
    setKeyError(error);
    return error === null;
  };

  return (
    <TableRow className={cn(!tag.enabled && 'opacity-60')}>
      <TableCell>
        <Switch
          checked={tag.enabled}
          onCheckedChange={(enabled) => onUpdate({ enabled })}
        />
      </TableCell>
      <TableCell>
        <Tooltip open={keyError !== null}>
          <TooltipTrigger
            render={
              <Input
                key={tag.key}
                defaultValue={tag.key}
                aria-invalid={keyError !== null}
                className={cn(
                  CELL_INPUT,
                  'font-mono',
                  keyError !== null && 'border-amber-500 text-amber-500',
                )}
                onChange={() => setKeyError(null)}
                onBlur={(event) => {
                  const input = event.currentTarget;
                  if (!commitKey(input)) {
                    // blur 처리 중 focus 는 무시될 수 있어 한 틱 뒤에 되돌린다.
                    queueMicrotask(() => input.focus());
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    event.currentTarget.value = tag.key;
                    setKeyError(null);
                    event.currentTarget.blur();
                  }
                }}
              />
            }
          />
          <TooltipContent side="bottom">
            {keyError ? t(`monitoring:virtualTags.errors.${keyError}`) : null}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Input
          value={tag.name}
          className={CELL_INPUT}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </TableCell>
      <TableCell>
        <Input
          value={tag.unit ?? ''}
          className={CELL_INPUT}
          onChange={(event) => onUpdate({ unit: event.target.value })}
        />
      </TableCell>
      <TableCell>
        <InputNumber
          value={tag.min}
          className={CELL_NUMBER_WRAPPER}
          inputClassName={CELL_NUMBER_INPUT}
          onChange={(min) => onUpdate({ min })}
        />
      </TableCell>
      <TableCell>
        <InputNumber
          value={tag.max}
          className={CELL_NUMBER_WRAPPER}
          inputClassName={CELL_NUMBER_INPUT}
          onChange={(max) => onUpdate({ max })}
        />
      </TableCell>
      <TableCell>
        <Select
          value={tag.pattern.kind}
          onValueChange={(kind: VirtualTagPatternKind) =>
            onUpdate({ pattern: defaultPattern(kind) })
          }
        >
          <SelectTrigger
            aria-label={t('monitoring:virtualTags.columns.pattern')}
            className="bg-muted h-7 w-full min-w-0 rounded-sm px-2 text-xs font-normal"
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate">
                {t(`monitoring:virtualTags.patterns.${tag.pattern.kind}`)}
              </span>
              <WaveformIcon kind={tag.pattern.kind} />
            </span>
          </SelectTrigger>
          <SelectPopup align="start" className="min-w-40">
            {VIRTUAL_TAG_PATTERN_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{t(`monitoring:virtualTags.patterns.${kind}`)}</span>
                  <WaveformIcon kind={kind} />
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </TableCell>
      <TableCell>
        {tag.pattern.kind === 'manual' ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <InputNumber
            value={tag.pattern.periodMs}
            step={100}
            title={t('monitoring:virtualTags.periodHint')}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(periodMs) =>
              onUpdate({ pattern: withPeriod(tag.pattern, periodMs) })
            }
          />
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {manual ? (
            <input
              type="range"
              min={tag.min}
              max={tag.max}
              step={range > 0 ? range / 200 : 1}
              value={value ?? tag.min}
              aria-label={tag.key}
              className="accent-primary h-2 min-w-0 flex-1 cursor-pointer"
              onChange={(event) =>
                virtualTagRuntime.setManualValue(
                  tag.id,
                  Number(event.target.value),
                )
              }
            />
          ) : (
            <div className="bg-muted h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
              <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
            </div>
          )}
          <span className="w-16 shrink-0 text-right font-mono text-xs">
            {formatValue(value)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={t('monitoring:virtualTags.duplicate')}
            title={t('monitoring:virtualTags.duplicate')}
            onClick={onDuplicate}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-red-300"
            aria-label={t('monitoring:virtualTags.remove')}
            title={t('monitoring:virtualTags.remove')}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function VirtualTagsPage() {
  const { t } = useTranslation();
  useRigLivePoll();
  const load = useVirtualTagStore((s) => s.load);
  const save = useVirtualTagStore((s) => s.save);
  const discard = useVirtualTagStore((s) => s.discard);
  const tags = useVirtualTagStore((s) => s.tags);
  const tickMs = useVirtualTagStore((s) => s.tickMs);
  const savedSnapshot = useVirtualTagStore((s) => s.savedSnapshot);
  const isSaving = useVirtualTagStore((s) => s.isSaving);
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const start = useVirtualTagStore((s) => s.start);
  const pause = useVirtualTagStore((s) => s.pause);
  const addTag = useVirtualTagStore((s) => s.addTag);
  const updateTag = useVirtualTagStore((s) => s.updateTag);
  const removeTag = useVirtualTagStore((s) => s.removeTag);
  const duplicateTag = useVirtualTagStore((s) => s.duplicateTag);
  const setTickMs = useVirtualTagStore((s) => s.setTickMs);
  const [message, setMessage] = useState<string | null>(null);
  const takenKeys = useMemo(() => tags.map((tag) => tag.key), [tags]);
  // dirty 는 스냅샷 비교 — 스토어의 isDirty() 는 구독이 안 되므로 여기서 파생.
  const isDirty = useMemo(
    () => JSON.stringify({ version: 1, tickMs, tags }) !== savedSnapshot,
    [savedSnapshot, tags, tickMs],
  );

  useEffect(() => {
    void load();
  }, [load]);
  // 스토어가 전역이라 페이지를 떠나도 편집본이 남는다. 저장하지 않고 나가면
  // (다이얼로그의 "저장 안 함", 저장 없이 뒤로가기 등 경로 불문) 언마운트에서
  // 마지막 저장본으로 되돌린다. 저장 후 이탈은 dirty 가 아니라 no-op.
  useEffect(() => () => discard(), [discard]);

  // 저장 결과는 씬 편집(use-scene-persistence)과 같은 토스트로 알린다. 스토어
  // save() 는 boolean 만 돌려주므로 여기서 감싼다 — 운영(localStorage 전용)
  // 저장은 "이 브라우저에만" 고지를 함께 띄운다. 실패 토스트의 재시도는
  // 자기 자신을 다시 부르는데, 선언 전 참조를 react-hooks 규칙이 막으므로
  // ref 를 거친다.
  const handleSaveRef = useRef<() => Promise<boolean>>(() =>
    Promise.resolve(false),
  );
  const handleSave = useCallback(async (): Promise<boolean> => {
    const ok = await save();
    if (ok) {
      if (isVirtualTagSetStoredLocallyOnly()) {
        toast.success(t('monitoring:editor.statusSavedLocalOnly'), {
          description: t('monitoring:editor.statusSavedLocalOnlyHint'),
        });
      } else {
        toast.success(t('monitoring:editor.statusSaved'));
      }
      return true;
    }
    toast.error(t('monitoring:virtualTags.saveFailed'), {
      action: {
        label: t('monitoring:editor.retry'),
        onClick: () => {
          void handleSaveRef.current();
        },
      },
    });
    return false;
  }, [save, t]);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const { unsavedChangesPrompt } = useSceneUnsavedChangesGuard({
    isDirty,
    isSaving,
    onSave: handleSave,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
        event.preventDefault();
        if (isDirty && !isSaving) void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, isDirty, isSaving]);

  const reportAdd = (result: VirtualTagAddResult) => {
    if (result.ok) {
      setMessage(null);
      return;
    }
    setMessage(
      t(`monitoring:virtualTags.errors.${result.reason}`, {
        max: VIRTUAL_TAGS_MAX,
      }),
    );
  };

  const handleAdd = () => {
    // 비어 있는 키를 자동으로 만든다 — 사용자는 행에서 바로 고친다.
    const taken = new Set(tags.map((tag) => tag.key));
    const base = t('monitoring:virtualTags.newKey');
    let key = base;
    for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
    reportAdd(addTag({ key }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
      <SceneUnsavedChangesDialog
        open={unsavedChangesPrompt.open}
        isSaving={isSaving}
        onSaveAndLeave={() => unsavedChangesPrompt.choose('save')}
        onLeaveWithoutSaving={() => unsavedChangesPrompt.choose('discard')}
        onStay={() => unsavedChangesPrompt.choose('stay')}
      />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-foreground text-base font-semibold">
            {t('monitoring:virtualTags.title')}
          </h1>
          <p className="text-muted-foreground text-xs">
            {t('monitoring:virtualTags.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 저장 상태는 버튼 자체가 나타낸다 — 씬 편집 헤더 바와 같은 규칙.
              미저장이면 붉은 점과 진한 글자, 저장되면 흐린 글자, 저장 중엔
              스피너. 저장 직후 확인은 handleSave 의 토스트가 맡는다. 점은
              글자와 겹치지 않게 테두리 우상단 모서리에 걸친다(아이콘 전용인
              헤더 바 버튼과 달리 글자가 있어 안쪽에 두면 가린다). */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            className={cn(
              'relative',
              isDirty ? 'text-foreground' : 'text-muted-foreground',
            )}
            onClick={() => void handleSave()}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            {t('monitoring:virtualTags.save')}
            {isDirty && !isSaving ? (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-red-500"
              />
            ) : null}
          </Button>
          <Button
            type="button"
            variant={isRunning ? 'default' : 'outline'}
            size="sm"
            aria-pressed={isRunning}
            onClick={() => (isRunning ? pause() : start())}
          >
            {isRunning ? <Pause /> : <Play />}
            {t(
              isRunning
                ? 'monitoring:virtualTags.pause'
                : 'monitoring:virtualTags.play',
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => virtualTagRuntime.resetValues()}
          >
            <RotateCcw />
            {t('monitoring:virtualTags.resetValues')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            <Plus />
            {t('monitoring:virtualTags.add')}
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span>{t('monitoring:virtualTags.keyHint')}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            {t('monitoring:virtualTags.tick')}
            <InputNumber
              value={tickMs}
              min={VIRTUAL_TAG_TICK_MIN}
              max={VIRTUAL_TAG_TICK_MAX}
              step={10}
              className={cn(CELL_NUMBER_WRAPPER, 'w-20')}
              inputClassName={CELL_NUMBER_INPUT}
              onChange={setTickMs}
            />
          </label>
          <span>
            {t('monitoring:virtualTags.count', {
              count: tags.length,
              max: VIRTUAL_TAGS_MAX,
            })}
          </span>
        </div>
      </div>
      {message ? (
        <p className="text-[11px] text-amber-500" role="status">
          {message}
        </p>
      ) : null}

      <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
        <CardContent className="h-full min-h-0 overflow-auto p-0">
          <TooltipProvider>
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  {COLUMNS.map(([column, width]) => (
                    <TableHead
                      key={column}
                      className={cn('text-center text-[11px]', width)}
                    >
                      {t(`monitoring:virtualTags.columns.${column}`)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    takenKeys={takenKeys}
                    onUpdate={(patch) => updateTag(tag.id, patch)}
                    onDuplicate={() => reportAdd(duplicateTag(tag.id))}
                    onRemove={() => removeTag(tag.id)}
                    t={t}
                  />
                ))}
                {tags.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMNS.length}
                      className="text-muted-foreground py-8 text-center text-xs"
                    >
                      {t('monitoring:virtualTags.empty')}
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
