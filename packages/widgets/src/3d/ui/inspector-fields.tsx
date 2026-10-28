import { Bone, Box, ChevronDown, Shapes } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RIG_AXES, type RigAxis } from '@crane/domain/3d';
import { useNodePreviewStore } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Combobox } from '@crane/ui/molecules/combobox';
import { TreeRow } from '@crane/ui/molecules/tree';
import {
  listModelNodeOptions,
  listNodeAncestorPaths,
  type ModelNodeTreeItem,
} from '../lib/model-node-tree';
import { buildNodeSelectRows } from '../lib/node-select-rows';
import {
  FIELD_LABEL,
  FIELD_LABEL_COMPACT,
  NUMBER_INPUT,
  NUMBER_WRAPPER,
} from './inspector-field-classes';

export type InspectorT = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * 라벨 + 컨트롤 한 줄. 라벨 폭은 고정(w-14)이라 여러 행이 정렬된다. `compact`
 * 는 라벨이 짧은 카드용 좁은 라벨 열이다 — 라벨 없는 줄은
 * FIELD_INDENT_COMPACT 로 들여쓴다.
 */
export function Field({
  label,
  compact = false,
  children,
}: {
  label: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={compact ? FIELD_LABEL_COMPACT : FIELD_LABEL}>
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * GLB 노드 선택 — 계층 목록(팔레트)과 같은 트리 모양의 검색 콤보박스. 자식이
 * 있는 노드는 화살표로 펼치고 접으며(선택되지 않는다), 열 때는 현재 값의
 * 조상만 펼친다. 검색어가 있으면 접힘과 무관하게 전체 노드를 이름으로
 * 거른다. 값이 목록에 없으면(GLB 교체 등) amber 로 표시하고 값을 보존한다 —
 * 사용자가 다시 고르기 전엔 지우지 않는다. `rootLabel` 을 주면 '' (모델
 * 루트) 행을 맨 위 깊이 0 에 둔다. 펼침 상태는 팔레트와 독립이다.
 *
 * `previewModelId` 를 주면 행을 하이라이트(호버·↑↓)하는 동안 그 노드를
 * 미리보기(useNodePreviewStore)로 알린다 — 에디터 캔버스가 실루엣·고스트·
 * 포커스 이동으로 응답한다. 닫힐 때 끝내며 카메라는 그 자리에 남는다. 행
 * 사이로 마우스가 빠진 것(null)은 무시한다.
 */
export function NodeSelect({
  value,
  tree,
  onChange,
  rootLabel,
  previewModelId,
  jointNodePaths,
  t,
}: {
  value: string;
  tree: ModelNodeTreeItem[];
  onChange: (path: string) => void;
  rootLabel?: string;
  previewModelId?: string;
  /** 리그 관절이 구동하는 노드 경로 — 계층 목록과 같은 관절 표시. */
  jointNodePaths?: ReadonlySet<string>;
  t: InspectorT;
}) {
  const knownPaths = useMemo(
    () => new Set(listModelNodeOptions(tree).map((o) => o.path)),
    [tree],
  );
  const known =
    (rootLabel !== undefined && value === '') || knownPaths.has(value);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(listNodeAncestorPaths(value)),
  );
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () => buildNodeSelectRows(tree, { rootLabel, query, expanded }),
    [tree, rootLabel, query, expanded],
  );
  const rowByValue = useMemo(
    () => new Map(rows.map((row) => [row.value, row])),
    [rows],
  );
  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // 팝업이 열린 채 인스펙터가 바뀌어도 미리보기가 남지 않게.
  useEffect(() => {
    if (previewModelId === undefined) return;
    return () => {
      useNodePreviewStore.getState().endPreview();
    };
  }, [previewModelId]);

  return (
    <Combobox
      value={value}
      options={rows}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
      invalid={!known}
      className="h-6 rounded-sm px-1 text-[11px]"
      renderValue={(selected) =>
        selected
          ? selected.label
          : `${t('monitoring:inspector.rigging.unresolvedNode')}: ${value || '—'}`
      }
      searchPlaceholder={t('monitoring:inspector.rigging.nodeSearch')}
      emptyText={t('monitoring:inspector.rigging.nodeEmpty')}
      searchText={(option) => option.label}
      onSearchChange={setQuery}
      itemClassName="p-0"
      renderItem={(option, { selected }) => {
        const row = rowByValue.get(option.value);
        if (!row) return option.label;
        const Icon = row.kind === 'mesh' ? Shapes : Box;
        const isJoint =
          row.kind !== 'root' && jointNodePaths?.has(row.path) === true;
        return (
          <TreeRow
            depth={row.depth}
            hasChildren={row.hasChildren}
            expanded={row.expanded}
            onToggle={() => toggleExpanded(row.path)}
            selected={selected}
            toggleLabel={t(
              row.expanded
                ? 'monitoring:editor.collapseNodes'
                : 'monitoring:editor.expandNodes',
            )}
            title={row.path || undefined}
            className={cn(
              'w-full',
              selected
                ? 'border-primary/50 bg-primary/15 text-foreground'
                : 'text-foreground/70',
            )}
          >
            <Icon
              className={cn(
                'size-3 shrink-0',
                selected ? 'text-primary' : 'text-muted-foreground/70',
              )}
            />
            <p className="min-w-0 flex-1 truncate text-[11px] leading-none">
              {row.label}
            </p>
            {isJoint ? (
              <Bone
                className="size-3 shrink-0 text-amber-500"
                aria-label={t('monitoring:editor.jointNode')}
              />
            ) : null}
          </TreeRow>
        );
      }}
      onHighlightChange={
        previewModelId === undefined
          ? undefined
          : (path) => {
              if (path !== null) {
                useNodePreviewStore
                  .getState()
                  .startPreview(previewModelId, path);
              }
            }
      }
      onOpenChange={(open) => {
        if (open) {
          // 열 때마다 현재 값의 조상만 펼친다 — 값 행이 보이는 최소 상태.
          setExpanded(new Set(listNodeAncestorPaths(value)));
          return;
        }
        if (previewModelId !== undefined) {
          useNodePreviewStore.getState().endPreview();
        }
      }}
    />
  );
}

/** x/y/z 세그먼트 — 리깅 관절 축 선택과 같은 모양. */
export function AxisSegment({
  value,
  onChange,
  label,
}: {
  value: RigAxis;
  onChange: (axis: RigAxis) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 gap-0.5" role="group" aria-label={label}>
      {RIG_AXES.map((axis) => (
        <button
          key={axis}
          type="button"
          aria-pressed={value === axis}
          className={cn(
            'h-6 w-6 cursor-pointer rounded-sm border text-[11px] uppercase',
            value === axis
              ? 'border-primary/50 bg-primary/15 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
          onClick={() => onChange(axis)}
        >
          {axis}
        </button>
      ))}
    </div>
  );
}

/**
 * 네이티브 number 입력 대신 테마 스테퍼가 있는 InputNumber. 비우면 undefined.
 * 인스펙터 필드는 전부 좁아서 편집 중 미리보기 툴팁을 항상 켠다.
 */
export function NumberField({
  value,
  placeholder,
  onChange,
  step = 0.1,
  unit,
  className,
  disabled,
}: {
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  step?: number;
  /** 편집 중 미리보기에 붙일 단위 */
  unit?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <InputNumber
      value={value ?? null}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      editPreview
      unit={unit}
      className={cn(NUMBER_WRAPPER, className)}
      inputClassName={NUMBER_INPUT}
      onChange={(next) => onChange(next)}
      onEmpty={() => onChange(undefined)}
    />
  );
}

/** 소제목(uppercase tracking) + 우측 액션 슬롯. */
export function SubHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </p>
      {action}
    </div>
  );
}

/**
 * 접고 펴는 소제목 구역 — SubHeader 와 같은 제목에 chevron 을 붙인 네이티브
 * details. 우측 액션은 summary 밖에 둔다(안에 두면 버튼 클릭이 접힘을
 * 토글한다). 열림 상태는 호출자가 가진다 — 액션이 접힌 구역을 펼 수 있게.
 * 내용은 열려 있을 때만 마운트한다 — 접으면 안쪽 세션 상태가 정리된다.
 */
export function CollapsibleSection({
  title,
  count,
  action,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  /** 제목 옆 개수(접혀 있어도 내용 유무가 보인다). */
  count?: number;
  action?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <details
        className="group"
        open={open}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
      >
        <summary className="flex min-h-6 cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            aria-hidden
            className="text-muted-foreground size-3 shrink-0 -rotate-90 transition-transform group-open:rotate-0"
          />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
            {title}
          </span>
          {count !== undefined ? (
            <span className="text-muted-foreground text-[10px] tabular-nums">
              {count}
            </span>
          ) : null}
        </summary>
        {open ? <div className="mt-1.5">{children}</div> : null}
      </details>
      {action ? <div className="absolute top-0 right-0">{action}</div> : null}
    </div>
  );
}

/**
 * 선택지 몇 개 중 하나 — AxisSegment 와 같은 모양, 글자 폭에 맞춘다. `compact`
 * 는 한두 글자짜리 선택지를 줄 끝에 붙일 때 쓴다 — 남는 폭을 채우지 않고
 * 칸마다 AxisSegment 와 같은 고정 폭이다.
 */
export function ChoiceSegment<T extends string>({
  value,
  options,
  onChange,
  label,
  compact = false,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'ml-auto flex shrink-0 gap-0.5'
          : 'flex min-w-0 flex-1 gap-0.5'
      }
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(
            'h-6 cursor-pointer truncate rounded-sm border text-[10px]',
            compact ? 'w-6' : 'min-w-0 flex-1 px-1',
            value === option.value
              ? 'border-primary/50 bg-primary/15 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
