import { Crosshair, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { numRound } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  useSceneCollisionStore,
  type SceneCollisionRecord,
  type SceneCollisionRecordParty,
} from '../model/use-scene-collision-store';

interface SceneCollisionOverlayProps {
  /** "충돌 지점 보기" — 카메라 이동은 호출자가. 없으면 버튼을 숨긴다. */
  onViewContact?: () => void;
  /** 위치 클래스(absolute 기준). 기본은 상단 중앙. */
  className?: string;
}

function selectPinnedRecord(state: {
  history: SceneCollisionRecord[];
  activeRecordId: number | null;
  activeMode: 'pinned' | 'flash' | null;
}): SceneCollisionRecord | null {
  if (state.activeMode !== 'pinned' || state.activeRecordId === null) {
    return null;
  }
  return state.history.find((r) => r.id === state.activeRecordId) ?? null;
}

/**
 * 충돌 정지 패널 — 좌측 패널이 없는 **모니터링 화면용** Canvas 위 DOM
 * 오버레이(편집기는 팔레트 "충돌" 탭이 같은 역할을 한다). 정지·복원(pinned)
 * 상태에서만 뜨고, 무정지 모드의 3초 박스에는 뜨지 않는다.
 *
 * 부모 오버레이 컨테이너가 pointer-events-none 이므로 루트에 pointer-events-auto.
 */
export function SceneCollisionOverlay({
  onViewContact,
  className,
}: SceneCollisionOverlayProps) {
  const { t } = useTranslation();
  const record = useSceneCollisionStore(selectPinnedRecord);
  const resume = useSceneCollisionStore((s) => s.resume);

  if (!record) return null;

  const [cx, cy, cz] = record.contactPoint;

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
          aria-label={t('monitoring:sceneCollision.deselect')}
          title={t('monitoring:sceneCollision.deselect')}
          onClick={resume}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <CollisionPartyCard party={record.a} />
        <CollisionPartyCard party={record.b} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:sceneCollision.contact')}{' '}
          <span className="font-mono tabular-nums">
            ({numRound(cx, 2)}, {numRound(cy, 2)}, {numRound(cz, 2)})
          </span>
        </p>
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
      </div>
    </section>
  );
}

function CollisionPartyCard({ party }: { party: SceneCollisionRecordParty }) {
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
    </div>
  );
}
