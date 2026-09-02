import { useEffect, useReducer } from 'react';

/**
 * 드라이버가 매 프레임 써 넣는 표시용 값. mutable — UI 는 useRigLivePoll 로
 * 낮은 주기 폴링해 읽는다(60fps setState 금지).
 */
export interface RigModelReadout {
  /** 관절 노드 경로를 못 찾은 관절 id */
  unresolvedJoints: string[];
  /**
   * 이번 프레임에 실제로 적용된 관절 값(한계 클램프·구속조건 계산 후).
   * driven 관절은 값 저장소에 없으므로 UI 가 여기서 읽는다.
   */
  jointValues: Map<string, number>;
}

const readouts = new Map<string, RigModelReadout>();

export const rigLiveReadouts = {
  get(modelId: string): RigModelReadout | undefined {
    return readouts.get(modelId);
  },
  set(modelId: string, readout: RigModelReadout): void {
    readouts.set(modelId, readout);
  },
  delete(modelId: string): void {
    readouts.delete(modelId);
  },
  clear(): void {
    readouts.clear();
  },
};

/**
 * 표시용 폴링 틱. 반환값은 리렌더를 일으키는 카운터일 뿐이고, 호출자는
 * rigValueStore / rigLiveReadouts 를 직접 읽는다.
 */
export function useRigLivePoll(intervalMs = 66): number {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = window.setInterval(bump, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}
