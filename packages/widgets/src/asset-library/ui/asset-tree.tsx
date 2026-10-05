import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AssetKind,
  AssetScope,
  AssetTree as AssetTreeData,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { AssetKindIcon } from './asset-badges';

interface AssetTreeProps {
  tree: AssetTreeData;
  scope: AssetScope;
  /** 고른 카테고리가 하나라도 있는지 — 있으면 종류 줄은 "그 종류 전부" 가 아니다. */
  hasCategories: boolean;
  onSelect: (scope: AssetScope) => void;
  onToggleCategory: (kind: AssetKind, category: string) => void;
}

interface TreeRowProps {
  label: string;
  count: number;
  active: boolean;
  /** 접고 펼 수 있는 마디면 지금 펼쳐져 있는지. 펼 것이 없으면 undefined. */
  open?: boolean;
  leading?: ReactNode;
  onSelect: () => void;
  onToggle?: () => void;
}

function TreeRow({
  label,
  count,
  active,
  open,
  leading,
  onSelect,
  onToggle,
}: TreeRowProps) {
  const { t } = useTranslation();
  const empty = count === 0;
  return (
    <div
      className={cn(
        'group/row relative flex h-8 items-center rounded-md pl-1 transition-colors',
        active ? 'bg-foreground/8' : 'hover:bg-muted',
      )}
    >
      {/* 지금 있는 위치 — 레일 왼쪽 가장자리의 세로 막대. */}
      <span
        aria-hidden
        className={cn(
          'absolute top-2 bottom-2 left-0 w-[3px] rounded-full',
          active ? 'bg-(--hanwha-orange-100)' : 'bg-transparent',
        )}
      />
      {onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={t(
            open ? 'asset-library:tree.collapse' : 'asset-library:tree.expand',
            { name: label },
          )}
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-2"
        >
          <ChevronRight
            className={cn('size-3.5 transition-transform', open && 'rotate-90')}
          />
        </button>
      ) : (
        <span aria-hidden className="size-6 shrink-0" />
      )}
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        onClick={onSelect}
        className={cn(
          'focus-visible:ring-ring/50 flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md pr-2.5 pl-1 text-left text-[13px] outline-none focus-visible:ring-2',
          active
            ? 'text-foreground font-semibold'
            : empty
              ? 'text-muted-foreground/70'
              : 'text-foreground/80 group-hover/row:text-foreground',
        )}
      >
        {leading}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            active
              ? 'text-foreground/70'
              : empty
                ? 'text-muted-foreground/50'
                : 'text-muted-foreground',
          )}
        >
          {count}
        </span>
      </button>
    </div>
  );
}

/** 종류 아래의 카테고리 한 줄 — 체크하면 그 카테고리를 가진 자산으로 좁힌다. */
function CategoryRow({
  category,
  count,
  checked,
  onToggle,
}: {
  category: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  // 더 걸면 남는 자산이 없는 카테고리는 고를 수 없다. 이미 고른 것은 풀 수 있어야
  // 하므로 막지 않는다.
  const disabled = count === 0 && !checked;
  return (
    <label
      className={cn(
        'flex h-7 items-center gap-2.5 rounded-md pr-2.5 pl-[2.125rem] text-[13px] transition-colors',
        disabled
          ? 'text-muted-foreground/50'
          : cn(
              'hover:bg-muted cursor-pointer',
              checked ? 'text-foreground font-medium' : 'text-foreground/80',
            ),
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        className="size-3.5 after:hidden"
      />
      <span className="min-w-0 flex-1 truncate">{category}</span>
      <span
        className={cn(
          'shrink-0 text-xs tabular-nums',
          disabled ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
      >
        {count}
      </span>
    </label>
  );
}

/**
 * 탐색 계층 — 종류 › 카테고리. 종류 줄을 누르면 그 종류 전부를 보고, 그 아래의
 * 카테고리를 체크하면 그 종류 안에서 좁혀 간다. 보고 있는 종류는 늘 펼쳐져 있고,
 * 나머지는 사용자가 여닫는다. 종류는 자산이 없어도 흐리게 보인다 — 그 자리에
 * 무엇을 둘 수 있는지 알린다.
 */
export function AssetTree({
  tree,
  scope,
  hasCategories,
  onSelect,
  onToggleCategory,
}: AssetTreeProps) {
  const { t } = useTranslation();
  // 사용자가 직접 여닫은 마디만 기억한다. 손대지 않은 마디는 지금 위치의
  // 길 위에 있을 때만 펼쳐진다.
  const [toggled, setToggled] = useState<Partial<Record<AssetKind, boolean>>>(
    {},
  );

  return (
    <ul className="flex flex-col gap-px">
      <li>
        <TreeRow
          label={t('asset-library:tree.all')}
          count={tree.total}
          active={scope.kind === null && !hasCategories}
          onSelect={() => onSelect({ kind: null })}
        />
      </li>
      {tree.kinds.map((kindNode) => {
        const { kind } = kindNode;
        // 길 위 — 보고 있는 종류이거나, 전체를 보는 중에 이 종류의 카테고리가
        // 걸려 있다.
        const onPath =
          scope.kind === kind || kindNode.categories.some((node) => node.checked);
        const hasChildren = kindNode.categories.length > 0;
        const open = hasChildren && (toggled[kind] ?? onPath);
        return (
          <li key={kind}>
            <TreeRow
              label={t(`asset-library:kind.${kind}`)}
              count={kindNode.count}
              active={scope.kind === kind && !hasCategories}
              open={hasChildren ? open : undefined}
              leading={<AssetKindIcon kind={kind} />}
              onSelect={() => onSelect({ kind })}
              onToggle={
                hasChildren
                  ? () =>
                      setToggled((current) => ({
                        ...current,
                        [kind]: !(current[kind] ?? onPath),
                      }))
                  : undefined
              }
            />
            {open ? (
              // 펼친 종류 아래에 세로 안내선 — 어느 종류의 카테고리인지 눈으로
              // 따라갈 수 있다.
              <ul
                aria-label={t('asset-library:tree.categoriesOf', {
                  name: t(`asset-library:kind.${kind}`),
                })}
                className="before:bg-border relative flex flex-col gap-px before:absolute before:top-1 before:bottom-1 before:left-[15px] before:w-px"
              >
                {kindNode.categories.map((categoryNode) => (
                  <li key={categoryNode.category}>
                    <CategoryRow
                      category={categoryNode.category}
                      count={categoryNode.count}
                      checked={categoryNode.checked}
                      onToggle={() => onToggleCategory(kind, categoryNode.category)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
