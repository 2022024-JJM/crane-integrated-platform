import {
  Copy,
  Download,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  VIRTUAL_TAG_PATTERN_KINDS,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAG_STEP_PCT_DEFAULT,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import {
  parseVirtualTagSetJson,
  serializeVirtualTagSet,
  VIRTUAL_TAG_FILE_NAME,
} from '../lib/virtual-tag-file';

/**
 * 가상 태그 관리 페이지 — 전역 목록의 CRUD·패턴 설정·재생.
 *
 * 값은 러너(virtualTagRuntime)가 들고 있고 표는 15Hz 폴링으로 읽는다.
 * 정의 편집은 스토어(localStorage 영속화)를 지나며, 키 중복·빈 키 같은
 * 거부는 스토어가 boolean/결과로 돌려주고 여기서는 문구만 보여 준다.
 */

const CELL_INPUT =
  'border-border bg-muted text-foreground placeholder:text-muted-foreground h-7 w-full min-w-0 rounded-sm px-2 text-xs';
const CELL_NUMBER_WRAPPER = 'border-border bg-muted h-7 w-full min-w-0 rounded-sm';
const CELL_NUMBER_INPUT = 'px-2 text-xs';
const CELL_SELECT =
  'border-border bg-muted text-foreground h-7 w-full min-w-0 rounded-sm border px-1 text-xs';

function defaultPattern(kind: VirtualTagPatternKind): VirtualTagPattern {
  switch (kind) {
    case 'manual':
      return { kind };
    case 'random-walk':
      return { kind, stepPct: VIRTUAL_TAG_STEP_PCT_DEFAULT, seed: 1 };
    default:
      return { kind, periodMs: VIRTUAL_TAG_PERIOD_DEFAULT };
  }
}

function patternParam(pattern: VirtualTagPattern): number | null {
  if (pattern.kind === 'manual') return null;
  if (pattern.kind === 'random-walk') return pattern.stepPct;
  return pattern.periodMs;
}

function withPatternParam(
  pattern: VirtualTagPattern,
  value: number,
): VirtualTagPattern {
  if (pattern.kind === 'manual') return pattern;
  if (pattern.kind === 'random-walk') return { ...pattern, stepPct: value };
  return { ...pattern, periodMs: value };
}

function formatValue(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value)
    ? Number(value.toFixed(3)).toString()
    : '—';
}

function TagRow({
  tag,
  onUpdate,
  onDuplicate,
  onRemove,
  t,
}: {
  tag: VirtualTagDefinition;
  onUpdate: (patch: Partial<Omit<VirtualTagDefinition, 'id'>>) => boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  // 키 입력은 비제어 — blur/Enter 에만 커밋한다(글자마다 저장·거부 문구가
  // 튀지 않게). 외부에서 키가 바뀌면 key={tag.key} 로 input 을 다시 마운트한다.
  const [keyInvalid, setKeyInvalid] = useState(false);

  const value = virtualTagRuntime.getValue(tag.id);
  const manual = tag.pattern.kind === 'manual';
  const range = tag.max - tag.min;
  const pct =
    value === undefined || range <= 0
      ? 0
      : Math.min(100, Math.max(0, ((value - tag.min) / range) * 100));

  const commitKey = (input: HTMLInputElement) => {
    if (input.value.trim() === tag.key) {
      setKeyInvalid(false);
      return;
    }
    const ok = onUpdate({ key: input.value });
    setKeyInvalid(!ok);
    if (!ok) input.value = tag.key;
  };

  return (
    <TableRow className={cn(!tag.enabled && 'opacity-60')}>
      <TableCell className="w-12">
        <Switch
          checked={tag.enabled}
          onCheckedChange={(enabled) => onUpdate({ enabled })}
        />
      </TableCell>
      <TableCell className="min-w-44">
        <Input
          key={tag.key}
          defaultValue={tag.key}
          aria-invalid={keyInvalid}
          className={cn(
            CELL_INPUT,
            'font-mono',
            keyInvalid && 'border-amber-500 text-amber-500',
          )}
          onBlur={(event) => commitKey(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              event.currentTarget.value = tag.key;
              event.currentTarget.blur();
            }
          }}
        />
      </TableCell>
      <TableCell className="min-w-32">
        <Input
          value={tag.name}
          className={CELL_INPUT}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </TableCell>
      <TableCell className="w-20">
        <Input
          value={tag.unit ?? ''}
          className={CELL_INPUT}
          onChange={(event) => onUpdate({ unit: event.target.value })}
        />
      </TableCell>
      <TableCell className="w-24">
        <InputNumber
          value={tag.min}
          className={CELL_NUMBER_WRAPPER}
          inputClassName={CELL_NUMBER_INPUT}
          onChange={(min) => onUpdate({ min })}
        />
      </TableCell>
      <TableCell className="w-24">
        <InputNumber
          value={tag.max}
          className={CELL_NUMBER_WRAPPER}
          inputClassName={CELL_NUMBER_INPUT}
          onChange={(max) => onUpdate({ max })}
        />
      </TableCell>
      <TableCell className="w-32">
        <select
          className={CELL_SELECT}
          value={tag.pattern.kind}
          aria-label={t('monitoring:virtualTags.columns.pattern')}
          onChange={(event) =>
            onUpdate({
              pattern: defaultPattern(
                event.target.value as VirtualTagPatternKind,
              ),
            })
          }
        >
          {VIRTUAL_TAG_PATTERN_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`monitoring:virtualTags.patterns.${kind}`)}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="w-28">
        {manual ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <InputNumber
            value={patternParam(tag.pattern)}
            step={tag.pattern.kind === 'random-walk' ? 0.5 : 100}
            className={CELL_NUMBER_WRAPPER}
            inputClassName={CELL_NUMBER_INPUT}
            onChange={(param) =>
              onUpdate({ pattern: withPatternParam(tag.pattern, param) })
            }
          />
        )}
      </TableCell>
      <TableCell className="min-w-44">
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
      <TableCell className="w-20">
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
  const hydrate = useVirtualTagStore((s) => s.hydrate);
  const tags = useVirtualTagStore((s) => s.tags);
  const tickMs = useVirtualTagStore((s) => s.tickMs);
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const start = useVirtualTagStore((s) => s.start);
  const pause = useVirtualTagStore((s) => s.pause);
  const addTag = useVirtualTagStore((s) => s.addTag);
  const updateTag = useVirtualTagStore((s) => s.updateTag);
  const removeTag = useVirtualTagStore((s) => s.removeTag);
  const duplicateTag = useVirtualTagStore((s) => s.duplicateTag);
  const setTickMs = useVirtualTagStore((s) => s.setTickMs);
  const replaceAll = useVirtualTagStore((s) => s.replaceAll);
  const toExport = useVirtualTagStore((s) => s.toExport);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  const handleExport = () => {
    const blob = new Blob([serializeVirtualTagSet(toExport())], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = VIRTUAL_TAG_FILE_NAME;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseVirtualTagSetJson(await file.text());
    if (!parsed) {
      setMessage(t('monitoring:virtualTags.errors.import'));
      return;
    }
    replaceAll(parsed);
    setMessage(
      t('monitoring:virtualTags.importedCount', { count: parsed.tags.length }),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
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
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload />
            {t('monitoring:virtualTags.import')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              void handleImportFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={tags.length === 0}
            onClick={handleExport}
          >
            <Download />
            {t('monitoring:virtualTags.export')}
          </Button>
          <Button type="button" size="sm" onClick={handleAdd}>
            <Plus />
            {t('monitoring:virtualTags.add')}
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span>{t('monitoring:virtualTags.keyHint')}</span>
        <span>
          {t('monitoring:virtualTags.count', {
            count: tags.length,
            max: VIRTUAL_TAGS_MAX,
          })}
        </span>
      </div>
      {message ? (
        <p className="text-[11px] text-amber-500" role="status">
          {message}
        </p>
      ) : null}

      <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
        <CardContent className="h-full min-h-0 overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {(
                  [
                    'enabled',
                    'key',
                    'name',
                    'unit',
                    'min',
                    'max',
                    'pattern',
                    'param',
                    'value',
                    'actions',
                  ] as const
                ).map((column) => (
                  <TableHead key={column} className="text-[11px]">
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
                  onUpdate={(patch) => updateTag(tag.id, patch)}
                  onDuplicate={() => reportAdd(duplicateTag(tag.id))}
                  onRemove={() => {
                    if (
                      window.confirm(
                        t('monitoring:virtualTags.removeConfirm', {
                          key: tag.key,
                        }),
                      )
                    ) {
                      removeTag(tag.id);
                    }
                  }}
                  t={t}
                />
              ))}
              {tags.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-muted-foreground py-8 text-center text-xs"
                  >
                    {t('monitoring:virtualTags.empty')}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
