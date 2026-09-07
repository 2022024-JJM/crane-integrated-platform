import { Crosshair, RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { numRound } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  useSceneCollisionStore,
  type SceneCollisionNodeRef,
} from '../model/use-scene-collision-store';

interface SceneCollisionOverlayProps {
  /** "충돌 지점 보기" — 카메라 이동은 호출자가(뷰어 moveTo / 에디터 fit). 없으면 버튼을 숨긴다. */
  onViewContact?: () => void;
  /** 위치 클래스(absolute 기준). 기본은 상단 중앙. */
  className?: string;
}

/**
 * 충돌 보고 패널 — Canvas 위 DOM 오버레이. report 가 없으면 아무것도 그리지
 * 않는다(감시 중 상태는 토글 버튼이 나타낸다). 값은 report 의 충돌 순간
 * 스냅샷이라 폴링이 없다.
 *
 * 부모 오버레이 컨테이너가 pointer-events-none 이므로 루트에 pointer-events-auto.
 */
export function SceneCollisionOverlay({
  onViewContact,
  className,
}: SceneCollisionOverlayProps) {
  const { t } = useTranslation();
  const report = useSceneCollisionStore((s) => s.report);
  const dismiss = useSceneCollisionStore((s) => s.dismiss);
  const resetAndRearm = useSceneCollisionStore((s) => s.resetAndRearm);

  if (!report) return null;

  const [cx, cy, cz] = report.contactPoint;

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={cn(
        'bg-card/95 text-card-foreground pointer-events-auto absolute z-20 w-[22rem] max-w-[calc(100%-1.5rem)] rounded-lg border border-red-500/50 p-3 shadow-lg backdrop-blur-sm',
        className ?? 'top-3 left-1/2 -translate-x-1/2',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            {t('monitoring:sceneCollision.title')}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {t('monitoring:sceneCollision.pausedNote')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('monitoring:sceneCollision.dismiss')}
          title={t('monitoring:sceneCollision.dismissHint')}
          onClick={dismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <CollisionPartyCard party={report.a} />
        <CollisionPartyCard party={report.b} />
      </div>

      <p className="text-muted-foreground mt-2 text-[10px]">
        {t('monitoring:sceneCollision.contact')}{' '}
        <span className="font-mono tabular-nums">
          ({numRound(cx, 2)}, {numRound(cy, 2)}, {numRound(cz, 2)})
        </span>
      </p>

      <div className="mt-2 flex items-center justify-end gap-1.5">
        {onViewContact ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={onViewContact}
          >
            <Crosshair className="size-3.5" />
            {t('monitoring:sceneCollision.viewContact')}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          title={t('monitoring:sceneCollision.resetHint')}
          onClick={resetAndRearm}
        >
          <RotateCcw className="size-3.5" />
          {t('monitoring:sceneCollision.reset')}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-7 text-[11px]"
          title={t('monitoring:sceneCollision.dismissHint')}
          onClick={dismiss}
        >
          {t('monitoring:sceneCollision.dismiss')}
        </Button>
      </div>
    </section>
  );
}

function CollisionPartyCard({ party }: { party: SceneCollisionNodeRef }) {
  const { t } = useTranslation();
  return (
    <div className="border-border bg-muted/30 min-w-0 rounded-md border p-2">
      <p className="truncate text-xs font-semibold" title={party.equipName}>
        {party.equipName || party.modelId}
      </p>
      <p
        className="text-muted-foreground truncate font-mono text-[10px]"
        title={party.nodePath || undefined}
      >
        {party.nodePath || t('monitoring:sceneCollision.root')}
      </p>
      {party.tags.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {party.tags.map((tag) => (
            <li
              key={tag.tagKey}
              className="flex items-baseline justify-between gap-2 text-[10px]"
            >
              <span className="text-muted-foreground min-w-0 truncate font-mono">
                {tag.tagKey}
              </span>
              <span className="shrink-0 font-mono tabular-nums">
                {tag.value === null ? '—' : numRound(tag.value, 3)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-1 text-[10px]">
          {t('monitoring:sceneCollision.noTags')}
        </p>
      )}
      {party.jointValues.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {party.jointValues.map((joint) => (
            <li
              key={joint.jointId}
              className="flex items-baseline justify-between gap-2 text-[10px]"
            >
              <span className="text-muted-foreground min-w-0 truncate">
                {t('monitoring:sceneCollision.joint')} {joint.jointId}
              </span>
              <span className="shrink-0 font-mono tabular-nums">
                {numRound(joint.value, 2)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
