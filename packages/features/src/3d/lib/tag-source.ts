import type { TagSourceId } from '../model/tag-value-bus';
import type { MonitoringViewMode } from '../model/types';
import type { Play3dSource } from '../model/use-play3d-store';

/**
 * 화면이 지금 받아야 할 값 생산자 — 실시간 모니터링은 실시간 러너, 3D 플레이는
 * 소스(리플레이|시뮬레이션)가 정한다. 세 생산자가 같은 키 표기를 쓰므로 어느
 * 것을 통과시킬지는 버스의 활성 소스 게이트가 정하고, 그 값을 여기서 만든다.
 *
 * 3D 플레이는 `mode` 만으로 부족하다 — 소스 전환은 리마운트가 아니라 상태
 * 변경이라 훅(`useActiveTagSource`)이 이 값을 의존성에 넣어야 한다.
 *
 * `mode` 가 null 인 화면(에디터)은 실시간 — 값 생산자가 없고 관제 문맥이
 * 기본이다. 관리 페이지에서 켜 둔 시나리오 러너가 넘어와도 게이트가 막는다.
 */
export function resolveActiveTagSource(
  mode: MonitoringViewMode | null | undefined,
  source: Play3dSource,
): TagSourceId {
  if (mode === 'play3d') {
    return source === 'simulation' ? 'simulation' : 'replay';
  }
  return 'realtime';
}

/** 씬 에디터의 소스 — 모드 없는 화면의 기본과 같다(값 생산자가 없다). */
export const EDITOR_TAG_SOURCE: TagSourceId = resolveActiveTagSource(
  null,
  'replay',
);
