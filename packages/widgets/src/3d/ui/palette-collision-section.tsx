import { Crosshair, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCENE_COLLISION_HISTORY_MAX,
  useSceneCollisionStore,
  type SceneCollisionRecord,
} from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Switch } from '@crane/ui/atoms/switch';

interface PaletteCollisionSectionProps {
  /** 선택된 기록의 두 노드로 카메라를 맞춘다(캔버스 fitToObjects). */
  onViewCollision: () => void;
}

/**
 * 에디터 팔레트 "충돌" 탭 — 충돌 감지 on/off, 충돌 시 정지 여부, 충돌 기록.
 *
 * 기록은 최신이 위이고 SCENE_COLLISION_HISTORY_MAX 개까지 남는다. 행을 누르면
 * 시뮬레이션을 멈추고 그 시점 자세로 돌아가며(선택 행 강조 + 빨간 박스),
 * 같은 행을 다시 누르거나 ▶ 를 누르면 풀린다. 상태·복원 로직은 전부
 * useSceneCollisionStore 에 있고 여기서는 그리기만 한다.
 */
export const PaletteCollisionSection = memo(function PaletteCollisionSection({
  onViewCollision,
}: PaletteCollisionSectionProps) {
  const { t } = useTranslation();
  const enabled = useSceneCollisionStore((s) => s.enabled);
  const pauseOnCollision = useSceneCollisionStore((s) => s.pauseOnCollision);
  const history = useSceneCollisionStore((s) => s.history);
  const activeRecordId = useSceneCollisionStore((s) => s.activeRecordId);
  const activeMode = useSceneCollisionStore((s) => s.activeMode);
  const setEnabled = useSceneCollisionStore((s) => s.setEnabled);
  const setPauseOnCollision = useSceneCollisionStore(
    (s) => s.setPauseOnCollision,
  );
  const selectRecord = useSceneCollisionStore((s) => s.selectRecord);
  const clearHistory = useSceneCollisionStore((s) => s.clearHistory);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium">
          {t('monitoring:editor.collision.enable')}
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={t('monitoring:editor.collision.enable')}
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium">
          {t('monitoring:editor.collision.pauseOnCollision')}
        </span>
        <Switch
          checked={pauseOnCollision}
          onCheckedChange={setPauseOnCollision}
          aria-label={t('monitoring:editor.collision.pauseOnCollision')}
        />
      </label>
      <p className="text-muted-foreground text-[10px] leading-snug">
        {t('monitoring:editor.collision.pauseHint')}{' '}
        {t('common:viewer3d.collisionBvhHint')}
      </p>

      <div className="flex items-center justify-between pt-1">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {t('monitoring:editor.collision.history')}{' '}
          <span className="font-normal tracking-normal normal-case">
            {t('monitoring:editor.collision.historyLimit', {
              max: SCENE_COLLISION_HISTORY_MAX,
            })}
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          disabled={history.length === 0}
          aria-label={t('monitoring:editor.collision.clearHistory')}
          title={t('monitoring:editor.collision.clearHistory')}
          onClick={clearHistory}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {history.length === 0 ? (
        <p className="text-muted-foreground text-[10px]">
          {t('monitoring:editor.collision.empty')}
        </p>
      ) : (
        <ul className="space-y-1">
          {history.map((record) => (
            <CollisionRecordRow
              key={record.id}
              record={record}
              selected={record.id === activeRecordId && activeMode === 'pinned'}
              onSelect={() => selectRecord(record.id)}
              onView={onViewCollision}
            />
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-[10px] leading-snug">
        {t('monitoring:editor.collision.selectedHint')}
      </p>
    </div>
  );
});

function CollisionRecordRow({
  record,
  selected,
  onSelect,
  onView,
}: {
  record: SceneCollisionRecord;
  selected: boolean;
  onSelect: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const time = new Date(record.at).toLocaleTimeString();
  return (
    <li
      className={cn(
        'border-border bg-muted/30 flex items-center gap-1 rounded-md border p-1.5',
        selected && 'border-red-500/60 bg-red-500/10',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <p className="truncate text-[11px] font-medium">
          {record.a.equipName || record.a.modelId}
          <span className="text-muted-foreground mx-1">↔</span>
          {record.b.equipName || record.b.modelId}
        </p>
        <p className="text-muted-foreground font-mono text-[10px] tabular-nums">
          {time}
        </p>
      </button>
      {selected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground shrink-0"
          aria-label={t('monitoring:editor.collision.viewContact')}
          title={t('monitoring:editor.collision.viewContact')}
          onClick={onView}
        >
          <Crosshair className="size-3.5" />
        </Button>
      ) : null}
    </li>
  );
}
