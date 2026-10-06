import { Check } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getAllowedStatusTransitions,
  isAssetVersionInUse,
  type AssetRecord,
  type AssetVersion,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';
import { useAssetLibraryStore } from '@crane/features/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { ASSET_STATUS_TONE } from '../lib/asset-presentation';
import { AssetStatusBadge } from './asset-badges';
import { AssetConfirmDialog } from './asset-confirm-dialog';
import {
  isAssetSaveFailed,
  useAssetSaveReport,
} from '../model/use-asset-save-report';

/** 수명주기의 큰 흐름. 반려·철회는 이 길 위의 한 지점에 멈춰 선 상태다. */
const LIFECYCLE_STEPS: AssetVersionStatus[] = [
  'draft',
  'in-review',
  'approved',
  'published',
];

/** 상태가 길 위의 몇 번째 지점인가. 반려는 검토에, 철회는 게시에 서 있다. */
const STEP_INDEX: Record<AssetVersionStatus, number> = {
  draft: 0,
  'in-review': 1,
  rejected: 1,
  approved: 2,
  published: 3,
  withdrawn: 3,
};

/** 되돌리는 방향의 전이 — 주 버튼이 아니라 보조 버튼으로 둔다. */
const BACKWARD: ReadonlySet<AssetVersionStatus> = new Set([
  'rejected',
  'withdrawn',
]);

interface AssetLifecycleProps {
  asset: AssetRecord;
  version: AssetVersion;
  actor: string;
  /**
   * 좁은 자리(목록의 미리보기)용 — 되돌리는 걸음밖에 없는 상태(게시됨 → 철회)
   * 에서는 버튼을 내지 않는다. 드문 일은 상세에서 한다.
   */
  compact?: boolean;
  /** 머리 줄 오른쪽에 놓을 것(현재 버전 표시·현재로 지정 버튼 등). */
  aside?: ReactNode;
  className?: string;
}

/**
 * 버전의 수명주기 — 지금 어디까지 왔는지와, 여기서 할 수 있는 다음 행동.
 *
 * 상태를 드롭다운 속에 두면 "지금 무엇을 해야 하는가" 가 보이지 않는다.
 * 길을 펼쳐 놓고 다음 걸음을 버튼으로 꺼내 둔다.
 *
 * 씬이나 화면 코드가 쓰고 있는 버전은 철회할 수 없다 — 철회 버튼을 끄고 그
 * 이유를 한 줄로 적는다. 누르는 순간 스토어가 사용처를 다시 읽어 확인하므로,
 * 화면이 아직 모르는 사용처가 있어도 철회되지 않는다(그때는 토스트로 알린다).
 */
export function AssetLifecycle({
  asset,
  version,
  actor,
  compact = false,
  aside,
  className,
}: AssetLifecycleProps) {
  const { t } = useTranslation();
  const report = useAssetSaveReport();
  const transitionStatus = useAssetLibraryStore(
    (state) => state.transitionStatus,
  );

  const current = STEP_INDEX[version.status];
  const allowed = getAllowedStatusTransitions(version.status);
  // 되돌리는 걸음밖에 없는 상태(게시됨 → 철회)는 버튼 줄을 따로 세우지 않고
  // 머리 줄에 작게 둔다 — 드문 일이 자리를 크게 차지하지 않는다.
  const backwardOnly =
    allowed.length > 0 && allowed.every((next) => BACKWARD.has(next));
  const transitions = backwardOnly ? [] : allowed;
  const usageIndex = useAssetLibraryStore((state) => state.usageIndex);
  const inUse = useMemo(
    () => isAssetVersionInUse(asset, version.version, usageIndex),
    [asset, usageIndex, version.version],
  );
  const isBlocked = (next: AssetVersionStatus) => next === 'withdrawn' && inUse;
  const apply = (next: AssetVersionStatus) =>
    report(
      transitionStatus(asset.id, version.version, next, actor).then(
        (changed) => {
          // 저장은 됐는데 철회되지 않았다 — 그사이 쓰이기 시작한 버전이다.
          if (!changed && next === 'withdrawn' && !isAssetSaveFailed()) {
            toast.error(t('asset-library:protect.withdrawBlocked'));
          }
          return changed;
        },
      ),
    );
  // 되돌리는 걸음은 한 번 더 묻는다 — 누르는 순간 저장되고 물릴 길이 없다.
  const [pending, setPending] = useState<AssetVersionStatus | null>(null);
  const run = (next: AssetVersionStatus) => {
    if (BACKWARD.has(next)) setPending(next);
    else apply(next);
  };
  const tone = ASSET_STATUS_TONE[version.status];
  const settled = version.status === 'published';

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="text-foreground text-[13px] font-semibold">
          {t('asset-library:lifecycle.heading', { version: version.version })}
        </h3>
        <div className="flex items-center gap-1">
          {aside}
          {backwardOnly && !compact
            ? allowed.map((next) => (
                <Button
                  key={next}
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  disabled={isBlocked(next)}
                  title={
                    isBlocked(next)
                      ? t('asset-library:protect.withdrawInUse')
                      : undefined
                  }
                  onClick={() => run(next)}
                >
                  {t(`asset-library:versions.transition.${next}`)}
                </Button>
              ))
            : null}
        </div>
      </div>
      {settled ? (
        // 길을 다 온 버전은 단계를 다시 늘어놓지 않는다 — 대부분의 자산이 이
        // 상태라, 매번 네 개의 마디를 그리면 정작 진행 중인 것이 묻힌다.
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <AssetStatusBadge status={version.status} />
          {/* 쓰이는 버전은 철회할 수 없다 — 꺼진 버튼의 이유를 여기에 적는다. */}
          {inUse && !compact
            ? t('asset-library:protect.withdrawInUse')
            : t('asset-library:lifecycle.settled')}
        </p>
      ) : (
        <ol
          aria-label={t('asset-library:lifecycle.label', {
            version: version.version,
          })}
          className="flex items-start"
        >
          {LIFECYCLE_STEPS.map((step, index) => {
            const done = index < current;
            const active = index === current;
            // 멈춰 선 지점에는 그 상태(반려됨·철회됨)를 적는다.
            const label = active ? version.status : step;
            return (
              <li
                key={step}
                aria-current={active ? 'step' : undefined}
                className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                {/* 앞 단계와 잇는 선. 지나온 구간만 진하다. */}
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-[9px] right-1/2 left-[-50%] h-px',
                      index <= current ? 'bg-foreground/60' : 'bg-border',
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    'relative z-10 flex size-[19px] items-center justify-center rounded-full border-2',
                    done && 'border-foreground bg-foreground text-background',
                    // 마디는 선을 가려야 한다 — 패널의 면과 같은 색으로 채운다.
                    active && cn('bg-sidebar border-current', tone.text),
                    !done && !active && 'border-border bg-sidebar',
                  )}
                >
                  {done ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : active ? (
                    <span className={cn('size-2 rounded-full', tone.dot)} />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'max-w-full truncate px-0.5 text-xs',
                    active
                      ? 'text-foreground font-semibold'
                      : done
                        ? 'text-foreground/80'
                        : 'text-muted-foreground',
                  )}
                >
                  {t(`asset-library:status.${label}`)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {transitions.length > 0 ? (
        // 앞으로 가는 걸음은 넓은 주 버튼, 되돌리는 걸음(반려·철회)은 작은
        // 보조 버튼 — 잘못 누르기 쉬운 자리에 크게 두지 않는다.
        <div className="flex flex-wrap justify-end gap-2">
          {transitions.map((next) => (
            <Button
              key={next}
              size="sm"
              variant={BACKWARD.has(next) ? 'outline' : 'default'}
              className={cn(
                BACKWARD.has(next) ? 'text-muted-foreground' : 'flex-1',
              )}
              disabled={isBlocked(next)}
              onClick={() => run(next)}
            >
              {t(`asset-library:versions.transition.${next}`)}
            </Button>
          ))}
        </div>
      ) : null}
      <AssetConfirmDialog
        open={pending !== null}
        title={t('asset-library:lifecycle.confirmTitle', {
          version: version.version,
          action: pending
            ? t(`asset-library:versions.transition.${pending}`)
            : '',
        })}
        description={
          pending ? t(`asset-library:lifecycle.confirmHint.${pending}`) : ''
        }
        confirmLabel={
          pending ? t(`asset-library:versions.transition.${pending}`) : ''
        }
        onConfirm={() => {
          if (pending) apply(pending);
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
