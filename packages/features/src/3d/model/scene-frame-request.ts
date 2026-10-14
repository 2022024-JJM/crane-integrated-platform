/**
 * 프레임 요청 깔때기 — React·R3F 밖에서 씬을 바꾸는 코드가
 * `frameloop='demand'` 캔버스를 깨우는 단일 통로.
 *
 * shadow-invalidation(@crane/domain/3d)과 같은 모양이다: 캔버스 안 컴포넌트
 * (SceneFrameGovernor)가 자기 `invalidate` 를 등록하고, 값 저장소·시계
 * 스토어처럼 Canvas 를 모르는 코드가 `requestSceneFrame()` 을 부른다.
 * 등록된 캔버스 전부를 깨운다 — 에디터와 모니터링이 동시에 떠 있는 일은
 * 없지만, 있어도 각자 한 프레임일 뿐이다. 등록이 없으면(캔버스 없음·
 * 'always' 루프 시절) no-op.
 *
 * 부르는 곳: rigValueStore(set·reset·restore — 슬라이더·기록 복원·태그
 * ingest), useSceneClockStore(시각 지정·작업등), SceneLighting(조명 설정
 * 변경). 자체 useFrame 안에서 이어지는 스무딩·easing 은 각자 invalidate 로
 * 체인을 유지한다(use-rig-driver·scene-surface-camera).
 */
const requesters = new Set<() => void>();

export function registerSceneFrameRequester(invalidate: () => void): void {
  requesters.add(invalidate);
}

export function unregisterSceneFrameRequester(invalidate: () => void): void {
  requesters.delete(invalidate);
}

/** 등록된 모든 캔버스에 한 프레임을 요청한다. 등록이 없으면 no-op. */
export function requestSceneFrame(): void {
  for (const invalidate of requesters) invalidate();
}

/** 테스트·진단용 — 등록된 캔버스 수. */
export function sceneFrameRequesterCount(): number {
  return requesters.size;
}

let tickerActive = false;

/**
 * 거버너가 주기 틱(30fps 등)을 돌리는 중인지. `SceneFrameGovernor` 가 켜고
 * 끈다. 드라이버의 스무딩 self‑invalidate 는 이게 true 면 건너뛴다 — useFrame
 * 안에서 부른 invalidate 는 R3F 가 `frames=2` 로 두어 rAF 루프가 주사율로
 * 자체 지속되므로, 거버너가 있는 동안 부르면 30fps 상한이 무력화된다
 * (2026-09-16, 배속 ≥2 에서 그림자 20Hz 스로틀과 주사율 렌더가 어긋나
 * 모델 밝기가 명멸하던 원인의 절반).
 */
export function setSceneFrameTickerActive(active: boolean): void {
  tickerActive = active;
}

export function isSceneFrameTickerActive(): boolean {
  return tickerActive;
}
