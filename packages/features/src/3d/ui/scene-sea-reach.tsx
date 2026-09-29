import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { modelObjectRegistry, type SavedMapInfo } from '@crane/domain/3d';
import { isSceneFrameTickerActive } from '../model/scene-frame-request';
import {
  createSeaReachController,
  type SeaReachController,
} from '../model/sea-reach-controller';

/**
 * 바다 도달 마스크 — 수면 아래 잠김 안개가 "바다가 실제로 닿는 위치" 에만
 * 끼도록 씬의 지도에서 마스크를 만들어 올린다(@crane/domain/3d
 * sea-reach-mask.ts, 수명 규칙은 model/sea-reach-controller.ts). 바다가 켜진
 * 씬에서만 SceneEnvironment 가 마운트한다.
 *
 * 지도 루트는 ModelMesh 가 GLB 로드 뒤 modelObjectRegistry 에 등록한다.
 * 레지스트리는 구독이 없어 프레임마다 조회한다 — 바다가 켜진 씬은 거버너가
 * 상시 틱을 돌린다. 계산은 useFrame 안이 아니라 프레임 사이 슬라이스에서
 * 돈다. 마스크가 바뀌면 한 프레임을 깨우되 거버너가 틱을 도는 중이면 부르지
 * 않는다(다음 틱이 그린다 — isSceneFrameTickerActive 규약).
 *
 * 언마운트에도 마스크를 내리지 않는다 — 같은 지도 구성의 씬에 다시 들어오면
 * 그대로 쓴다. 다른 씬이면 그 씬의 컨트롤러가 첫 조회에서 내린다.
 */
export function SceneSeaReach({ maps }: { maps?: SavedMapInfo[] }) {
  const invalidate = useThree((s) => s.invalidate);
  const controllerRef = useRef<SeaReachController | null>(null);

  useEffect(() => {
    const controller = createSeaReachController({
      resolveRoot: (id) => modelObjectRegistry.get(id),
      onChange: () => {
        if (!isSceneFrameTickerActive()) invalidate();
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [invalidate]);

  useFrame(() => {
    controllerRef.current?.poll(maps);
  });

  return null;
}
