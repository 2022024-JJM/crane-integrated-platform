import { Camera, GripVertical, Pin, PinOff, Plus, X } from 'lucide-react';
import { Fragment, memo, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SCENE_SPLIT_SLOT_COUNT,
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
  type SavedCameraInfo,
  type SavedSceneView,
  type SavedViewSplit,
} from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  isSceneViewDrag,
  isSceneViewLimitReached,
  readSceneViewDrag,
  SCENE_VIEW_DRAG_TYPE,
  validateSceneViewName,
  type SceneViewNameError,
} from '../lib/view-editor';

interface PaletteViewSectionProps {
  views: SavedSceneView[];
  split: SavedViewSplit | undefined;
  /** 현재 카메라 구도 — 추가·다시 지정 시점에 읽는다. 컨트롤러 준비 전이면 null. */
  getPose: () => SavedCameraInfo | null;
  /** 행 클릭 — 에디터 카메라를 그 구도로 옮긴다(확인용). */
  onFlyTo: (view: SavedSceneView) => void;
  onAdd: (name: string, pose: SavedCameraInfo) => void;
  onRename: (id: string, name: string) => void;
  onRecapture: (id: string, pose: SavedCameraInfo) => void;
  onRemove: (id: string) => void;
  /** 목록 순서 변경 — `insertBefore` 는 현재 목록 기준(withSceneViewMoved). */
  onReorder: (id: string, insertBefore: number) => void;
  onPinChange: (id: string, pinned: boolean) => void;
  onSlotChange: (slot: number, viewId: string | null) => void;
  onSplitPinnedChange: (pinned: boolean) => void;
}

/**
 * Project 팔레트 "뷰" 탭 — 위는 분할 화면 칸(2×2, 번호), 아래는 뷰 목록이다.
 *
 * - 뷰는 "카메라를 맞추고 추가" 다. 이름은 목록 끝의 인라인 인풋으로 받는다
 *   (Enter 커밋·Esc 취소·blur 커밋). 이름 규칙은 lib/view-editor.ts.
 * - 행 클릭은 그 구도로 이동, 이름 더블클릭은 이름 변경(계층 목록과 같은
 *   인라인 인풋), 카메라 버튼은 현재 화면으로 다시 지정, 핀은 우상단 고정.
 * - 분할 칸은 목록의 행을 끌어다 놓아 채운다(HTML5 DnD, 타입은
 *   SCENE_VIEW_DRAG_TYPE). 찬 칸에 놓으면 교체, 다른 칸에 있던 뷰면 이동이다
 *   — 의미는 세터(withSplitSlot)가 정하고 여기는 이벤트만 넘긴다.
 * - 같은 드래그를 목록 안에 놓으면 순서가 바뀐다. 끌고 있는 동안 놓일 자리에
 *   빈 행이 생겨 다른 행이 밀린다(자기 자리 앞뒤는 빈 행을 만들지 않는다).
 *   순서는 우상단 고정 줄의 버튼 순서다.
 * - 분할 자체의 고정은 절 제목 옆 핀이다. 칸이 2개 이상 차야 모니터링에
 *   분할이 생긴다는 안내를 칸 아래 둔다.
 */
export const PaletteViewSection = memo(function PaletteViewSection({
  views,
  split,
  getPose,
  onFlyTo,
  onAdd,
  onRename,
  onRecapture,
  onRemove,
  onReorder,
  onPinChange,
  onSlotChange,
  onSplitPinnedChange,
}: PaletteViewSectionProps) {
  const { t } = useTranslation();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const viewById = new Map(views.map((view) => [view.id, view]));
  const slots = Array.from(
    { length: SCENE_SPLIT_SLOT_COUNT },
    (_, index) => split?.slots?.[index] ?? null,
  );
  const filledCount = slots.filter(
    (id) => id !== null && viewById.has(id),
  ).length;
  const splitPinned = split?.pinned === true;

  const handleSlotDragOver = (slot: number, event: DragEvent) => {
    if (!isSceneViewDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverSlot !== slot) setDragOverSlot(slot);
  };
  const handleSlotDrop = (slot: number, event: DragEvent) => {
    const id = readSceneViewDrag(event.dataTransfer);
    setDragOverSlot(null);
    if (!id) return;
    event.preventDefault();
    onSlotChange(slot, id);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 분할 화면 — 칸 2×2 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-medium">
            {t('monitoring:editor.views.splitSection')}
          </span>
          <PinButton
            pinned={splitPinned}
            label={
              splitPinned
                ? t('monitoring:editor.views.unpinSplit')
                : t('monitoring:editor.views.pinSplit')
            }
            onToggle={() => onSplitPinnedChange(!splitPinned)}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {slots.map((id, slot) => {
            const view = id ? viewById.get(id) : undefined;
            const isOver = dragOverSlot === slot;
            return (
              <div
                key={slot}
                role="group"
                aria-label={t('monitoring:editor.views.splitSlot', {
                  index: slot + 1,
                })}
                onDragOver={(event) => handleSlotDragOver(slot, event)}
                onDragLeave={() => {
                  if (dragOverSlot === slot) setDragOverSlot(null);
                }}
                onDrop={(event) => handleSlotDrop(slot, event)}
                className={cn(
                  'relative flex h-14 items-center justify-center rounded-md border px-1.5 text-center transition-colors',
                  view
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border border-dashed',
                  isOver && 'border-primary bg-primary/20',
                )}
              >
                <span className="text-muted-foreground absolute top-1 left-1.5 text-[10px] leading-none font-semibold">
                  {slot + 1}
                </span>
                {view ? (
                  <>
                    <span className="text-foreground w-full truncate px-3 text-[11px] font-medium">
                      {view.name}
                    </span>
                    <button
                      type="button"
                      aria-label={t('monitoring:editor.views.splitSlotClear')}
                      title={t('monitoring:editor.views.splitSlotClear')}
                      onClick={() => onSlotChange(slot, null)}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1 right-1 flex size-4 cursor-pointer items-center justify-center rounded-sm"
                    >
                      <X className="size-3" />
                    </button>
                  </>
                ) : (
                  <span className="text-muted-foreground px-2 text-[10px] leading-snug">
                    {t('monitoring:editor.views.splitSlotEmpty')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {filledCount < 2 ? (
          <p className="text-muted-foreground text-[10px] leading-snug">
            {t('monitoring:editor.views.splitHint')}
          </p>
        ) : null}
      </div>

      {/* 뷰 목록 */}
      <div className="border-border mt-1 flex flex-col gap-1.5 border-t pt-2">
        <span className="text-muted-foreground text-[11px] font-medium">
          {t('monitoring:editor.views.listSection')}
        </span>
        <ViewList
          views={views}
          draggingId={draggingId}
          onDraggingChange={setDraggingId}
          getPose={getPose}
          onFlyTo={onFlyTo}
          onAdd={onAdd}
          onRename={onRename}
          onRecapture={onRecapture}
          onRemove={onRemove}
          onReorder={onReorder}
          onPinChange={onPinChange}
        />
      </div>
    </div>
  );
});

function PinButton({
  pinned,
  label,
  onToggle,
  className,
}: {
  pinned: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors',
        pinned
          ? 'text-primary hover:bg-primary/15'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {pinned ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
    </button>
  );
}

/** 인풋 아래 안내 — 길이는 maxLength 가 막으므로 중복만 문구가 있다. */
function nameErrorMessage(
  t: ReturnType<typeof useTranslation>['t'],
  error: SceneViewNameError | null,
): string | null {
  if (error === 'duplicate') return t('monitoring:sceneViews.duplicateName');
  return null;
}

function ViewList({
  views,
  draggingId,
  onDraggingChange,
  getPose,
  onFlyTo,
  onAdd,
  onRename,
  onRecapture,
  onRemove,
  onReorder,
  onPinChange,
}: {
  views: SavedSceneView[];
  draggingId: string | null;
  onDraggingChange: (id: string | null) => void;
  getPose: () => SavedCameraInfo | null;
  onFlyTo: (view: SavedSceneView) => void;
  onAdd: (name: string, pose: SavedCameraInfo) => void;
  onRename: (id: string, name: string) => void;
  onRecapture: (id: string, pose: SavedCameraInfo) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, insertBefore: number) => void;
  onPinChange: (id: string, pinned: boolean) => void;
}) {
  const { t } = useTranslation();
  // 순서 변경 드래그 — 놓일 자리(현재 목록 기준 index). 행 위에서는 위·아래
  // 반으로 앞·뒤를 정하고, 목록 빈 바닥이면 맨 뒤다. 목록 밖으로 나가거나
  // 드래그가 끝나면 지운다.
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const draggingIndex = draggingId
    ? views.findIndex((view) => view.id === draggingId)
    : -1;
  // 자기 자리 앞뒤는 놓아도 그대로라 빈 행을 만들지 않는다.
  const gapIndex =
    dropIndex !== null &&
    draggingIndex >= 0 &&
    dropIndex !== draggingIndex &&
    dropIndex !== draggingIndex + 1
      ? dropIndex
      : null;

  const handleRowDragOver = (
    index: number,
    event: DragEvent<HTMLLIElement>,
  ) => {
    if (!isSceneViewDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    const next = before ? index : index + 1;
    if (dropIndex !== next) setDropIndex(next);
  };
  const handleListDragOver = (event: DragEvent<HTMLUListElement>) => {
    if (!isSceneViewDrag(event.dataTransfer)) return;
    event.preventDefault();
    if (event.target === event.currentTarget && dropIndex !== views.length) {
      setDropIndex(views.length);
    }
  };
  const handleListDragLeave = (event: DragEvent<HTMLUListElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setDropIndex(null);
  };
  const handleListDrop = (event: DragEvent<HTMLUListElement>) => {
    const id = readSceneViewDrag(event.dataTransfer);
    const target = dropIndex;
    setDropIndex(null);
    if (!id || target === null) return;
    event.preventDefault();
    onReorder(id, target);
  };
  // 인라인 인풋 하나가 "새 뷰 이름" 과 "이름 변경" 을 겸한다 — editingId 가
  // null 이면 추가, 아니면 그 뷰의 이름 변경이다.
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Enter 커밋 직후 unmount 로 blur 가 한 번 더 들어와도 중복 커밋되지 않게.
  const doneRef = useRef(false);

  const isLimitReached = isSceneViewLimitReached(views);
  // 편집 중이던 뷰가 사라지면(삭제·undo) 인풋도 사라진다 — 상태를 고치는
  // effect 대신 렌더에서 걸러 낸다.
  const activeEditingId =
    editingId && views.some((view) => view.id === editingId) ? editingId : null;
  const nameError = validateSceneViewName(
    views,
    draft,
    activeEditingId ?? undefined,
  );

  const closeInput = () => {
    doneRef.current = true;
    setIsAdding(false);
    setEditingId(null);
    setDraft('');
  };

  const startAdd = () => {
    if (isLimitReached) return;
    doneRef.current = false;
    setEditingId(null);
    setDraft('');
    setIsAdding(true);
  };

  const startRename = (view: SavedSceneView) => {
    doneRef.current = false;
    setIsAdding(false);
    setDraft(view.name);
    setEditingId(view.id);
  };

  // blur 와 Enter 가 함께 부른다. 무효한 이름이면 저장 없이 닫는다 — blur
  // 시점엔 에러로 붙잡아 둘 수 없다(저장한 뷰 인라인 인풋과 같은 규칙).
  const commitInput = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (nameError === null) {
      if (activeEditingId) {
        onRename(activeEditingId, draft);
      } else {
        const pose = getPose();
        if (pose) onAdd(draft, pose);
      }
    }
    setIsAdding(false);
    setEditingId(null);
    setDraft('');
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitInput();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeInput();
    }
  };

  const errorMessage = nameErrorMessage(t, nameError);
  const inputRow = (
    <div className="flex flex-col gap-0.5">
      <Input
        ref={inputRef}
        autoFocus
        value={draft}
        maxLength={SCENE_VIEW_NAME_MAX}
        placeholder={t('monitoring:sceneViews.namePlaceholder')}
        aria-label={
          activeEditingId
            ? t('monitoring:editor.views.rename')
            : t('monitoring:editor.views.add')
        }
        aria-invalid={draft.length > 0 && nameError !== null ? true : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleInputKeyDown}
        onBlur={commitInput}
        className={cn(
          'bg-muted/60 focus:bg-muted h-7 rounded-md border-0 px-2.5 text-xs focus:border-0 focus:ring-0',
          draft.length > 0 && nameError !== null && 'text-destructive',
        )}
      />
      {draft.length > 0 && errorMessage ? (
        <p className="text-destructive px-1 text-[10px] leading-4">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-1">
      {views.length === 0 && !isAdding ? (
        <p className="text-muted-foreground text-[10px] leading-snug">
          {t('monitoring:editor.views.empty')}
        </p>
      ) : null}
      <ul
        className="flex flex-col gap-0.5"
        onDragOver={handleListDragOver}
        onDragLeave={handleListDragLeave}
        onDrop={handleListDrop}
      >
        {views.map((view, index) => {
          const pinned = view.pinned === true;
          const gap =
            gapIndex === index ? (
              <li
                key={`gap:${index}`}
                aria-hidden
                className="border-primary/50 bg-primary/5 h-7 rounded-md border border-dashed"
              />
            ) : null;
          if (activeEditingId === view.id) {
            return (
              <Fragment key={view.id}>
                {gap}
                <li>{inputRow}</li>
              </Fragment>
            );
          }
          return (
            <Fragment key={view.id}>
              {gap}
              <li
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(SCENE_VIEW_DRAG_TYPE, view.id);
                  onDraggingChange(view.id);
                }}
                onDragEnd={() => {
                  onDraggingChange(null);
                  setDropIndex(null);
                }}
                onDragOver={(event) => handleRowDragOver(index, event)}
                className={cn(
                  'group border-border/60 hover:bg-muted/60 flex h-7 items-center gap-1 rounded-md border pr-0.5 pl-1 transition-colors',
                  draggingId === view.id &&
                    'border-primary/40 bg-primary/12 opacity-50',
                )}
              >
                <GripVertical
                  aria-hidden
                  className="text-muted-foreground/60 size-3.5 shrink-0 cursor-grab"
                />
                <button
                  type="button"
                  title={t('monitoring:sceneViews.flyTo', { name: view.name })}
                  onClick={() => onFlyTo(view)}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    startRename(view);
                  }}
                  className="text-foreground min-w-0 flex-1 cursor-pointer truncate text-left text-[11px]"
                >
                  {view.name}
                </button>
                <PinButton
                  pinned={pinned}
                  label={
                    pinned
                      ? t('monitoring:editor.views.unpin')
                      : t('monitoring:editor.views.pin')
                  }
                  onToggle={() => onPinChange(view.id, !pinned)}
                />
                <button
                  type="button"
                  aria-label={t('monitoring:editor.views.recapture')}
                  title={t('monitoring:editor.views.recapture')}
                  onClick={() => {
                    const pose = getPose();
                    if (pose) onRecapture(view.id, pose);
                  }}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors"
                >
                  <Camera className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={t('monitoring:editor.views.remove')}
                  title={t('monitoring:editor.views.remove')}
                  onClick={() => onRemove(view.id)}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            </Fragment>
          );
        })}
        {gapIndex === views.length ? (
          <li
            aria-hidden
            className="border-primary/50 bg-primary/5 h-7 rounded-md border border-dashed"
          />
        ) : null}
        {isAdding ? <li>{inputRow}</li> : null}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isLimitReached || isAdding}
        title={
          isLimitReached
            ? t('monitoring:sceneViews.limitReached', { max: SCENE_VIEWS_MAX })
            : undefined
        }
        onClick={startAdd}
        className="h-7 justify-start gap-1.5 text-[11px]"
      >
        <Plus className="size-3.5" />
        {t('monitoring:editor.views.add')}
      </Button>
      {isLimitReached ? (
        <p className="text-muted-foreground text-[10px] leading-4">
          {t('monitoring:sceneViews.limitReached', { max: SCENE_VIEWS_MAX })}
        </p>
      ) : null}
    </div>
  );
}
