/**
 * 바다 표시 판정 — 세 캔버스(모니터링·3D 플레이·에디터)와 에디터의 바다
 * 스위치가 전부 이 함수 하나를 본다. `environmentId` 로 바다를 유추하는
 * 코드를 다른 곳에 두지 않는다.
 *
 * `SavedSceneInfo.sea` 는 3-상태다:
 *  - `true` / `false`: 사용자가 에디터에서 명시한 값. 배경 유무와 무관하게
 *    그대로 쓴다.
 *  - `undefined`: 지정한 적 없는 씬. 배경(EXR)이 resolve 되면 바다가 있다는
 *    레거시 규칙으로 떨어진다 — 기존 배포 JSON·localStorage 저장본이 바다를
 *    잃지 않게 하는 경로다.
 *
 * boolean 이 아닌 오염값(문자열·숫자)은 sanitize 가 이미 버리지만, 정규화를
 * 거치지 않은 입력이 와도 명시 상태로 오판하지 않도록 typeof 로 검사한다.
 */
import type { SavedSceneInfo } from '../model/types';
import { resolveEnvironmentFileUrl } from '../model/scene-environment-registry';

export function resolveSeaVisible(
  regionId: string,
  sceneInfo: Pick<SavedSceneInfo, 'sea' | 'environmentId'> | null | undefined,
): boolean {
  if (typeof sceneInfo?.sea === 'boolean') return sceneInfo.sea;
  return resolveEnvironmentFileUrl(regionId, sceneInfo?.environmentId) !== null;
}
