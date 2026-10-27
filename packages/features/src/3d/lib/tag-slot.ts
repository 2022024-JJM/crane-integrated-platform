import type { TagSlot } from '@crane/domain/3d';
import type { MonitoringViewMode } from '../model/types';
import type { Play3dSource } from '../model/use-play3d-store';

/**
 * 화면이 지금 읽어야 할 태그 슬롯 — 맵핑·상태 태그의 실시간 키와 가상 키 중
 * 하나. 값 생산자와 짝이다: 실시간 모니터링과 3D 플레이 리플레이는 서버 키로
 * 내보내고(실시간 브리지·리플레이 스토어), 시뮬레이션은 가상 태그 러너가 가상
 * 키로 내보낸다.
 *
 * 3D 플레이는 `mode` 만으로 부족하다 — 소스(리플레이|시뮬레이션) 전환은
 * 리마운트가 아니라 상태 변경이라 소비자가 이 값을 memo 의존성에 넣어야 한다.
 *
 * `mode` 가 null 인 화면(에디터)은 실시간 — 값 생산자가 없어 어느 쪽이든
 * 결과는 같고, 관제 문맥이 기본이다.
 */
export function resolveActiveTagSlot(
  mode: MonitoringViewMode | null | undefined,
  source: Play3dSource,
): TagSlot {
  if (mode === 'play3d')
    return source === 'simulation' ? 'virtual' : 'realtime';
  return 'realtime';
}

/** 3D 플레이 소스 → 슬롯. 리포트·통계처럼 소스만 아는 곳이 쓴다. */
export function tagSlotOfPlay3dSource(source: Play3dSource): TagSlot {
  return source === 'simulation' ? 'virtual' : 'realtime';
}

/** 씬 에디터의 슬롯 — 모드 없는 화면의 기본과 같다(값 생산자가 없다). */
export const EDITOR_TAG_SLOT: TagSlot = resolveActiveTagSlot(null, 'replay');
