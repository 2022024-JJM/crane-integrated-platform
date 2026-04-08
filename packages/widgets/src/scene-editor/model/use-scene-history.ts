import { useCallback, useMemo, useState, type SetStateAction } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { isSceneInfoEqual } from './scene-snapshot';

interface SceneHistoryState {
  past: SavedSceneInfo[];
  present: SavedSceneInfo | null;
  future: SavedSceneInfo[];
}

interface UpdateSceneOptions {
  recordHistory?: boolean;
}

interface UseSceneHistoryResult {
  sceneInfo: SavedSceneInfo | null;
  replaceScene: (sceneInfo: SavedSceneInfo | null) => void;
  updateScene: (
    updater: SetStateAction<SavedSceneInfo | null>,
    options?: UpdateSceneOptions,
  ) => void;
  commitHistoryFrom: (baseSceneInfo: SavedSceneInfo | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const MAX_UNDO_DEPTH = 50;

export function useSceneHistory(): UseSceneHistoryResult {
  const [history, setHistory] = useState<SceneHistoryState>({
    past: [],
    present: null,
    future: [],
  });

  const replaceScene = useCallback((sceneInfo: SavedSceneInfo | null) => {
    setHistory({
      past: [],
      present: sceneInfo,
      future: [],
    });
  }, []);

  const updateScene = useCallback(
    (
      updater: SetStateAction<SavedSceneInfo | null>,
      options: UpdateSceneOptions = {},
    ) => {
      const { recordHistory = true } = options;

      setHistory((prev) => {
        const nextSceneInfo =
          typeof updater === 'function' ? updater(prev.present) : updater;

        if (isSceneInfoEqual(nextSceneInfo, prev.present)) {
          return prev;
        }

        if (!recordHistory || !prev.present) {
          return {
            ...prev,
            present: nextSceneInfo,
          };
        }

        return {
          past: [...prev.past.slice(-MAX_UNDO_DEPTH + 1), prev.present],
          present: nextSceneInfo,
          future: [],
        };
      });
    },
    [],
  );

  const commitHistoryFrom = useCallback(
    (baseSceneInfo: SavedSceneInfo | null) => {
      if (!baseSceneInfo) {
        return;
      }

      setHistory((prev) => {
        if (!prev.present || isSceneInfoEqual(prev.present, baseSceneInfo)) {
          return prev;
        }

        return {
          past: [...prev.past.slice(-MAX_UNDO_DEPTH + 1), baseSceneInfo],
          present: prev.present,
          future: [],
        };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0 || !prev.present) {
        return prev;
      }

      const nextPast = [...prev.past];
      const previousSceneInfo = nextPast.pop() ?? null;

      if (!previousSceneInfo) {
        return prev;
      }

      return {
        past: nextPast,
        present: previousSceneInfo,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0 || !prev.present) {
        return prev;
      }

      const [nextSceneInfo, ...nextFuture] = prev.future;

      return {
        past: [...prev.past.slice(-MAX_UNDO_DEPTH + 1), prev.present],
        present: nextSceneInfo,
        future: nextFuture,
      };
    });
  }, []);

  return useMemo(
    () => ({
      sceneInfo: history.present,
      replaceScene,
      updateScene,
      commitHistoryFrom,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      undo,
      redo,
    }),
    [
      commitHistoryFrom,
      history.future.length,
      history.past.length,
      history.present,
      redo,
      replaceScene,
      undo,
      updateScene,
    ],
  );
}
