import { useEffect, useRef, useState } from 'react';
import { sceneModelCatalog } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  checkPreviewThumbnailExists,
  generatePreviewThumbnail,
} from '../lib/generate-preview-thumbnails';

type ItemStatus = 'exists' | 'missing' | 'pending' | 'running' | 'done' | 'error';

interface ItemState {
  status: ItemStatus;
  error?: string;
}

/**
 * 정적 미리보기 썸네일 생성 패널 (dev 전용).
 *
 * 씬 편집 페이지의 모델 탭에서 썸네일 버튼으로 토글되어 모델 목록 자리에
 * 표시된다. sceneModelCatalog 전체를 offscreen 렌더러로 순차 렌더해 dev
 * 미들웨어(vite.config.ts 의 devPreviewSavePlugin)로 public/previews/*.png
 * 에 저장한다. 결과물은 git 으로 커밋해 배포한다. 모델 카탈로그를 바꾸거나
 * 미리보기 렌더 룩을 바꾸면 여기서 재생성한다.
 */
export function PreviewThumbnailGeneratorPanel() {
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [isRunning, setIsRunning] = useState(false);
  const runningRef = useRef(false);

  const setItemState = (id: string, state: ItemState) => {
    setItemStates((current) => ({ ...current, [id]: state }));
  };

  // 패널을 열 때 이미 배포된 썸네일이 있는지 항목별로 표시한다.
  // 생성이 시작된 항목의 상태는 덮어쓰지 않는다 (id 미설정일 때만 기록).
  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      sceneModelCatalog.map(
        async (item) =>
          [item.id, await checkPreviewThumbnailExists(item.id)] as const,
      ),
    ).then((entries) => {
      if (cancelled) return;
      setItemStates((current) => {
        const next = { ...current };
        for (const [id, exists] of entries) {
          if (!next[id]) {
            next[id] = { status: exists ? 'exists' : 'missing' };
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const runAll = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    setItemStates(
      Object.fromEntries(
        sceneModelCatalog.map((item) => [
          item.id,
          { status: 'pending' as const },
        ]),
      ),
    );

    // 렌더 큐가 어차피 직렬이므로 한 항목씩 진행해 진행 상황을 그대로 보여준다.
    for (const item of sceneModelCatalog) {
      setItemState(item.id, { status: 'running' });
      try {
        await generatePreviewThumbnail(item);
        setItemState(item.id, { status: 'done' });
      } catch (error) {
        setItemState(item.id, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    runningRef.current = false;
    setIsRunning(false);
  };

  const doneCount = Object.values(itemStates).filter(
    (s) => s.status === 'done',
  ).length;
  const errorCount = Object.values(itemStates).filter(
    (s) => s.status === 'error',
  ).length;

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" onClick={runAll} disabled={isRunning}>
        {isRunning
          ? `생성 중… (${doneCount + errorCount}/${sceneModelCatalog.length})`
          : '전체 생성'}
      </Button>
      {errorCount > 0 ? (
        <p className="text-destructive text-[11px]">{errorCount}개 항목 실패</p>
      ) : null}
      <ul className="divide-border divide-y rounded-md border">
        {sceneModelCatalog.map((item) => {
          const state = itemStates[item.id];
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-[11px] font-medium">
                  {item.label}
                </p>
                <p className="text-muted-foreground truncate text-[10px]">
                  {item.id}
                </p>
                {state?.error ? (
                  <p className="text-destructive mt-0.5 text-[10px] break-all">
                    {state.error}
                  </p>
                ) : null}
              </div>
              <span
                className={cn(
                  'shrink-0 text-[10px]',
                  state?.status === 'done' && 'text-foreground',
                  state?.status === 'exists' &&
                    'text-emerald-600 dark:text-emerald-400',
                  state?.status === 'error' && 'text-destructive',
                  state?.status === 'running' &&
                    'text-foreground animate-pulse',
                  (!state ||
                    state.status === 'pending' ||
                    state.status === 'missing') &&
                    'text-muted-foreground',
                )}
              >
                {state?.status === 'done'
                  ? '완료'
                  : state?.status === 'exists'
                    ? '있음'
                    : state?.status === 'missing'
                      ? '없음'
                      : state?.status === 'error'
                        ? '실패'
                        : state?.status === 'running'
                          ? '렌더 중'
                          : '대기'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
