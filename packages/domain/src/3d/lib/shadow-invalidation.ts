/**
 * shadow map 온디맨드 무효화 — React 밖 모듈 싱글턴 (선례: model-object-registry).
 *
 * three 는 기본적으로 매 프레임 shadow map 을 다시 그린다. 이 저장소의 씬은
 * 캐스터(모델)가 움직인 프레임이 전체의 일부라 — 정지 화면·실시간 유휴·리플레이
 * 프레임 사이 — SceneLighting 이 `gl.shadowMap.autoUpdate = false` 로 끄고,
 * 캐스터를 실제로 움직이는 코드가 여기의 `invalidateShadows()` 를 부르면
 * 그 프레임의 shadow pass 한 번만 다시 그린다(three 가 needsUpdate 를 소비
 * 후 자동 리셋 — WebGLShadowMap.render 선두의 early return).
 *
 * 왜 "신호" 방식인가: 드라이버(use-rig-driver)는 값 변화와 무관하게 매 프레임
 * 포즈를 재기록하므로 three 쪽에서는 "실제로 움직였다"를 알 수 없다. 변화의
 * 사실은 값의 출처만 안다. 캐스터를 움직이는 경로는 넷뿐이고 각각 여기로
 * 수렴한다:
 *   1. rigValueStore (가상 태그·WebSocket·리플레이·슬라이더·기록 복원·reset)
 *   2. 기즈모 드래그 (useActiveTransformStore.publish/end)
 *   3. React 커밋 (ModelMesh 의 배치 props·meshOverrides·마운트/언마운트)
 *   4. SceneLighting 자신 (카메라 추종 frustum·태양각 — 내부에서 판정)
 *
 * 호출자가 domain(ModelMesh)·features(rigValueStore)·widgets 세 레이어라
 * FSD 하향 import 가 성립하는 최저 레이어인 domain 에 둔다.
 *
 * 소비 시점: R3F 는 모든 useFrame 을 돌린 뒤 같은 rAF 에서 gl.render 를
 * 부르고, three 는 그 안(main pass 직전)에서 플래그를 소비한다 — 프레임 내
 * 어느 시점(useFrame·effect·setInterval·WS 핸들러)에 불러도 같은 프레임에
 * 반영되므로 1프레임 그림자 지연이 없다.
 *
 * 렌더러가 하나도 등록돼 있지 않으면(그림자 꺼진 씬, 단위 테스트) 전부
 * no-op 이다 — 호출부는 조건 없이 불러도 된다.
 */

interface ShadowRendererLike {
  shadowMap: { needsUpdate: boolean };
}

const renderers = new Set<ShadowRendererLike>();

/**
 * dev 진단 카운터 — 콘솔에서 `__shadowDebug` 로 등록 수·무효화 횟수를 본다.
 * "그림자가 안 따라온다/매 프레임 다시 그려진다" 를 배선 문제인지 판정할 때
 * 쓴다. 프로덕션 번들에선 코드가 제거된다(import.meta.env.DEV 트리셰이킹).
 */
const debugCounters = { registered: 0, invalidations: 0 };
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as { __shadowDebug?: typeof debugCounters }).__shadowDebug =
    debugCounters;
}

/** SceneLighting 이 autoUpdate 를 끌 때 등록한다. 다중 캔버스 안전(Set). */
export function registerShadowRenderer(gl: ShadowRendererLike): void {
  renderers.add(gl);
  debugCounters.registered = renderers.size;
}

export function unregisterShadowRenderer(gl: ShadowRendererLike): void {
  renderers.delete(gl);
  debugCounters.registered = renderers.size;
}

/** 등록된 모든 렌더러의 다음 프레임 shadow pass 를 1회 갱신시킨다. 멱등. */
export function invalidateShadows(): void {
  debugCounters.invalidations += 1;
  for (const gl of renderers) {
    gl.shadowMap.needsUpdate = true;
  }
}
