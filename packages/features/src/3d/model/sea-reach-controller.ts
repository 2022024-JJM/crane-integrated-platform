import {
  buildSeaReachMask,
  getSeaReachSignature,
  publishSeaReachMask,
  resetSeaReachMask,
  resolveGroundMaps,
  type SavedMapInfo,
  type SeaReachMask,
  type SeaReachSource,
} from '@crane/domain/3d';
import type { Object3D } from 'three';
import { runSlicedTask, type SlicedTaskOptions } from '../lib/sliced-task';

/**
 * 바다 도달 마스크의 수명 관리 — 씬의 지도 구성이 바뀔 때 마스크를 다시
 * 만들어 올린다. 캔버스 안 컴포넌트(ui/scene-sea-reach.tsx)가 프레임마다
 * `poll` 을 부르고, 계산은 프레임 사이 슬라이스로 돈다(lib/sliced-task.ts).
 *
 * 서명은 씬 데이터(지도 경로·배치)에서 만든다. 객체의 실제 행렬이 아니라
 * 저장값이라 기즈모로 지도를 끄는 동안에는 바뀌지 않고, 놓아서 씬에 반영된
 * 뒤에 한 번 다시 만든다.
 *
 * 규칙:
 *  - 선언된 지도가 **전부** 로드돼 레지스트리에 있을 때만 만든다. 일부만으로
 *    만들면 나중에 로드된 지도의 도크가 마스크가 다시 나올 때까지 물 색이 된다.
 *  - 올라가 있는 마스크의 서명이 같으면 다시 만들지 않는다(같은 씬 재진입).
 *  - 다른 씬이 남긴 마스크는 바로 내린다(준비 전 = 안개 없음). 이 컨트롤러가
 *    올린 마스크는 다시 만드는 동안 그대로 둔다 — 편집 중 안개가 깜빡이지
 *    않는다.
 *  - 지도가 없는 씬은 막는 지형이 없으므로 바로 "전부 바다" 다.
 *  - 계산이 던진 서명은 다시 시도하지 않는다(프레임마다 재시도하지 않게).
 */

const DEFAULT_POSITION = [0, 0, 0] as const;
const DEFAULT_ROTATION = [0, 0, 0] as const;
const DEFAULT_SCALE = [1, 1, 1] as const;

/** 지도 구성의 서명 — 경로와 배치. 순서를 보존한다. 지도가 없으면 빈 문자열. */
export function resolveSeaReachSignature(
  maps: readonly SavedMapInfo[] | null | undefined,
): string {
  if (!maps || maps.length === 0) return '';
  return maps
    .map((map) =>
      [
        map.path,
        ...(map.position ?? DEFAULT_POSITION),
        ...(map.rotation ?? DEFAULT_ROTATION),
        ...(map.scale ?? DEFAULT_SCALE),
      ].join(','),
    )
    .join(';');
}

export interface SeaReachStore {
  publish: (mask: SeaReachMask | null, signature: string) => void;
  reset: () => void;
  signature: () => string | null;
}

export interface SeaReachControllerDeps {
  /** 지도 id → 씬에 마운트된 루트. 아직 로드 전이면 undefined. */
  resolveRoot: (id: string) => Object3D | undefined;
  /** 마스크 상태가 바뀌었다 — 캔버스가 한 프레임 그린다. */
  onChange: () => void;
  build?: (
    sources: readonly SeaReachSource[],
  ) => Generator<void, SeaReachMask | null>;
  store?: SeaReachStore;
  task?: SlicedTaskOptions;
}

export interface SeaReachController {
  poll: (maps: readonly SavedMapInfo[] | null | undefined) => void;
  dispose: () => void;
}

const defaultStore: SeaReachStore = {
  publish: publishSeaReachMask,
  reset: resetSeaReachMask,
  signature: getSeaReachSignature,
};

export function createSeaReachController({
  resolveRoot,
  onChange,
  build = buildSeaReachMask,
  store = defaultStore,
  task,
}: SeaReachControllerDeps): SeaReachController {
  let building: { signature: string; cancel: () => void } | null = null;
  let failedSignature: string | null = null;
  /** 올라가 있는 마스크가 이 컨트롤러의 씬 것인지. */
  let owned = false;
  // 서명은 지도 배열이 바뀔 때만 다시 만든다 — poll 은 프레임마다 불린다.
  let signedMaps: readonly SavedMapInfo[] | null | undefined;
  let signedValue = '';
  let signed = false;

  const cancelBuild = () => {
    building?.cancel();
    building = null;
  };

  const signatureOf = (
    maps: readonly SavedMapInfo[] | null | undefined,
  ): string => {
    if (!signed || maps !== signedMaps) {
      signedMaps = maps;
      signedValue = resolveSeaReachSignature(maps);
      signed = true;
    }
    return signedValue;
  };

  return {
    poll(maps) {
      const signature = signatureOf(maps);
      const published = store.signature();
      if (published === signature) {
        owned = true;
        cancelBuild();
        return;
      }
      if (!owned && published !== null) {
        store.reset();
        onChange();
      }

      if (!maps || maps.length === 0) {
        cancelBuild();
        store.publish(null, signature);
        owned = true;
        onChange();
        return;
      }
      if (building?.signature === signature) return;
      cancelBuild();
      if (failedSignature === signature) return;

      const boundsMaps = resolveGroundMaps(maps);
      const sources: SeaReachSource[] = [];
      for (const map of maps) {
        const root = resolveRoot(map.id);
        if (!root) return;
        sources.push({ root, bounds: boundsMaps.includes(map) });
      }

      const cancel = runSlicedTask(
        build(sources),
        {
          onDone: (mask) => {
            building = null;
            store.publish(mask, signature);
            owned = true;
            onChange();
          },
          onError: (error) => {
            building = null;
            failedSignature = signature;
            console.error('[3d] 바다 도달 마스크 계산 실패', error);
          },
        },
        task,
      );
      building = { signature, cancel };
    },
    dispose() {
      cancelBuild();
    },
  };
}
