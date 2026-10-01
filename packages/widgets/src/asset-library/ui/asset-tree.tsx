import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AssetScope,
  AssetTreeSiteNode,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { AssetKindIcon } from './asset-badges';

interface AssetTreeProps {
  tree: readonly AssetTreeSiteNode[];
  scope: AssetScope;
  onSelect: (scope: AssetScope) => void;
}

interface TreeRowProps {
  depth: 0 | 1 | 2;
  label: string;
  count: number;
  active: boolean;
  /** 접고 펼 수 있는 마디면 지금 펼쳐져 있는지. 잎이면 undefined. */
  open?: boolean;
  leading?: ReactNode;
  onSelect: () => void;
  onToggle?: () => void;
}

const DEPTH_INDENT = ['pl-1', 'pl-5', 'pl-[4.125rem]'] as const;

function TreeRow({
  depth,
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
        'group/row relative flex h-8 items-center rounded-md transition-colors',
        DEPTH_INDENT[depth],
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
      ) : depth < 2 ? (
        <span aria-hidden className="size-6 shrink-0" />
      ) : null}
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

/**
 * 탐색 계층 — 조선소 › 종류 › 분류. 자산이 어디에 있는지 폴더처럼 내려가며
 * 찾는다. 지금 있는 위치의 길은 늘 펼쳐져 있고, 나머지는 사용자가 여닫는다.
 * 종류는 자산이 없어도 흐리게 보인다 — 그 자리에 무엇을 둘 수 있는지 알린다.
 */
export function AssetTree({ tree, scope, onSelect }: AssetTreeProps) {
  const { t } = useTranslation();
  // 사용자가 직접 여닫은 마디만 기억한다. 손대지 않은 마디는 지금 위치의
  // 길 위에 있을 때만 펼쳐진다.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, onPath: boolean) => toggled[key] ?? onPath;
  const toggle = (key: string, onPath: boolean) =>
    setToggled((current) => ({ ...current, [key]: !(current[key] ?? onPath) }));

  return (
    <ul className="flex flex-col gap-px">
      {tree.map((siteNode) => {
        const siteKey = siteNode.site;
        const siteOnPath = scope.site === siteNode.site;
        const siteOpen = isOpen(siteKey, siteOnPath);
        return (
          <li key={siteKey}>
            <TreeRow
              depth={0}
              label={t(`asset-library:site.${siteNode.site}`)}
              count={siteNode.count}
              active={siteOnPath && scope.kind === null}
              open={siteOpen}
              onSelect={() =>
                onSelect({ site: siteNode.site, kind: null, category: null })
              }
              onToggle={() => toggle(siteKey, siteOnPath)}
            />
            {siteOpen ? (
              // 펼친 마디 아래에 세로 안내선 — 어느 조선소의 가지인지 눈으로
              // 따라갈 수 있다.
              <ul className="before:bg-border relative flex flex-col gap-px before:absolute before:top-1 before:bottom-1 before:left-[15px] before:w-px">
                {siteNode.kinds.map((kindNode) => {
                  const kindKey = `${siteKey}/${kindNode.kind}`;
                  const kindOnPath = siteOnPath && scope.kind === kindNode.kind;
                  const hasChildren = kindNode.categories.length > 0;
                  const kindOpen = hasChildren && isOpen(kindKey, kindOnPath);
                  return (
                    <li key={kindKey}>
                      <TreeRow
                        depth={1}
                        label={t(`asset-library:kind.${kindNode.kind}`)}
                        count={kindNode.count}
                        active={kindOnPath && scope.category === null}
                        open={hasChildren ? kindOpen : undefined}
                        leading={<AssetKindIcon kind={kindNode.kind} />}
                        onSelect={() =>
                          onSelect({
                            site: siteNode.site,
                            kind: kindNode.kind,
                            category: null,
                          })
                        }
                        onToggle={
                          hasChildren
                            ? () => toggle(kindKey, kindOnPath)
                            : undefined
                        }
                      />
                      {kindOpen ? (
                        <ul className="before:bg-border relative flex flex-col gap-px before:absolute before:top-1 before:bottom-1 before:left-[31px] before:w-px">
                          {kindNode.categories.map((categoryNode) => (
                            <li key={categoryNode.category}>
                              <TreeRow
                                depth={2}
                                label={categoryNode.category}
                                count={categoryNode.count}
                                active={
                                  kindOnPath &&
                                  scope.category === categoryNode.category
                                }
                                onSelect={() =>
                                  onSelect({
                                    site: siteNode.site,
                                    kind: kindNode.kind,
                                    category: categoryNode.category,
                                  })
                                }
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
