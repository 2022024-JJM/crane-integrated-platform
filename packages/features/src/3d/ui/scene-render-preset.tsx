import { ACESFilmicToneMapping } from 'three';

/**
 * 씬 렌더링 공통 설정 — 에디터·모니터링·리플레이가 **같은 화면**을 그리게 하는
 * 단일 소스.
 *
 * 예전에는 세 곳이 각자 gl 옵션과 조명을 복붙해 갖고 있었고, 그러다 값이
 * 어긋났다. 에디터가 `intensity={5}`, 뷰어 둘이 `intensity={4}`여서 에디터가
 * 약 25% 밝게 보였다 — 즉 **에디터에서 맞춘 조명이 실제 화면과 달랐다.**
 * 저작 도구가 결과와 다른 그림을 보여주면 저작 자체를 신뢰할 수 없다.
 *
 * 여기 값을 바꾸면 세 화면이 함께 바뀐다. 한쪽만 손대지 말 것.
 */

/**
 * 카메라 near/far.
 *
 * far: 기본값(1000)이면 줌 아웃 시 카메라-타깃 거리가 1000을 넘는 순간
 *   지도 중앙부터 잘려나간다. OrbitControls maxDistance(3000) + 씬 반폭보다
 *   커야 잘림이 없다.
 * near: 0.1(three 기본)을 쓴다. 에디터만 0.5를 쓰고 있었는데, near를 올리면
 *   깊이 정밀도는 좋아지지만 카메라에 바짝 붙은 지오메트리가 잘려 보인다 —
 *   뷰어와 다른 값을 쓸 이유가 없다.
 */
export const SCENE_CAMERA_CLIP = { near: 0.1, far: 5000 } as const;

/**
 * 캔버스 픽셀 비율 상한.
 *
 * Retina(DPR 2~3)에서 네이티브로 그리면 프래그먼트 수가 1.8~4배로 늘어
 * 지도급 씬(philly 지도 42만 삼각형)에서 프레임 예산을 다 먹는다. 1.5는
 * 골리앗 충돌가드 모드에서 먼저 검증된 값 — 라벨은 DOM(Html)이라 텍스트
 * 선명도와 무관하고, MSAA(antialias)가 켜져 있어 엣지도 깨끗하다.
 *
 * ThreeSceneViewer(@crane/ui)의 기본값도 같은 [1, 1.5]다 — 그 패키지는
 * features를 참조할 수 없어(SCENE_CAMERA_CLIP과 같은 사정) 리터럴로 들고
 * 있다. 여기 값을 바꾸면 three-scene-viewer.tsx의 기본값도 같이 바꿀 것.
 */
export const SCENE_DEFAULT_DPR = [1, 1.5] as const;

/**
 * WebGLRenderer 옵션.
 *
 * toneMapping: 예전에는 NoToneMapping(0)이었다. 강한 광량과 겹쳐 하이라이트가
 *   전부 흰색으로 뭉개졌고("납작한 룩"의 주범), HDR 환경맵을 도입해도 계조가
 *   살지 않았다. ACESFilmic은 밝은 쪽을 부드럽게 말아 넣어 금속 하이라이트와
 *   하늘의 계조를 함께 살린다. 대신 전체가 어두워지므로 조명·노출을 같이
 *   재보정했다(SCENE_LIGHTING / SCENE_TONE_EXPOSURE 주석 참고).
 */
export const SCENE_GL_OPTIONS = {
  toneMapping: ACESFilmicToneMapping,
  /**
   * 노출은 1.0(중립)이다.
   *
   * 처음엔 "ACES가 중간톤을 누르니 보정해야 한다"고 보고 1.15로 올렸는데,
   * 그건 조명이 그대로일 때의 이야기였다. 실제로는 같은 시점에 환경광(IBL)이
   * 새로 더해져 광원이 하나 늘어난 상태라, 노출까지 올리자 전체가 들떴다.
   * 밝기 손잡이가 셋(조명·환경광·노출)이면 하나만 중립으로 고정해 두는 편이
   * 나머지를 조율하기 쉽다 — 노출을 그 기준으로 삼는다.
   */
  toneMappingExposure: 1,
  powerPreference: 'high-performance',
  alpha: false,
  antialias: true,
  stencil: false,
  depth: true,
} as const;

/**
 * 조명 세기.
 *
 * 예전 값(ambient 2 / directional 4)은 **톤매핑도 환경광도 없던 시절**에
 * 맞춘 것이다. 그때는 조명이 유일한 광원이라 세게 때려야 했다. 지금은
 * 환경맵(IBL)이 반사광을 더하므로 같은 세기를 유지하면 광량이 이중으로
 * 들어가 화면이 들뜬다 — 특히 ambient는 환경광과 역할이 정면으로 겹친다.
 *
 * 그래서 ambient를 줄이고(2 → 0.9) directional도 약간 낮췄다(4 → 3.6).
 * 비율상 directional 비중이 커지는데, 이건 의도한 것이다 — ambient가
 * 지배적이면 면마다 밝기 차이가 사라져 입체감이 죽는다. 방향광이 주도해야
 * 거더의 면이 구분되고, 그 위에 환경광이 반사를 얹는 구성이 된다.
 *
 * 값 이력(전부 화면을 보고 맞춤 — ACES 곡선의 응답은 선형 합산으로
 * 예측되지 않는다):
 *   2.0/4.0 + 노출 1.15 → 들뜸 (조명은 그대로인데 환경광까지 더해진 탓)
 *   1.0/3.0             → 어두움
 *   1.4/4.0             → 약간 밝음
 *   1.1/3.8             → 여전히 약간 밝음
 *   0.9/3.6             → 현재
 *
 * **밝기 조절은 여기 두 값으로 한다.** 노출(toneMappingExposure)은 1.0
 * 중립으로 고정해 두는 편이 기준점이 흔들리지 않아 조율하기 쉽다.
 * 더 밝게: directional을 먼저 올린다(ambient를 올리면 평평해진다).
 * 더 어둡게: 두 값을 같은 비율로 내린다.
 */
export const SCENE_LIGHTING = {
  ambientIntensity: 0.9,
  directionalIntensity: 3.6,
  directionalPosition: [0, 50, 10] as [number, number, number],
  directionalColor: '#ffffff',
} as const;

/**
 * 씬 공통 조명. 세 화면이 이 컴포넌트 하나를 쓴다.
 *
 * 그림자는 쓰지 않는다. ContactShadows로 접지 그림자를 넣어 봤으나(2026-08-14)
 * 관제 화면에서는 득보다 실이 컸다 — 지도 위에 어두운 반점이 생겨 오히려
 * 지형을 읽기 어려워졌다. 실시간 shadow map은 더 비싸다(옥외 대형 씬이라
 * shadow camera 범위 튜닝이 따로 필요하고 매 프레임 비용이 든다).
 *
 * 그래서 각 뷰어에 남아 있던 castShadow/receiveShadow 플래그는 2026-08-14에
 * 제거했다 — Canvas에 `shadows`를 켜지 않는 한 아무 효과가 없어, 남겨두면
 * "그림자가 되는 설정인데 왜 안 보이지"라는 오해만 남긴다. 그림자를 되살리려면
 * Canvas의 `shadows`부터 켜야 하고, 그때 이 플래그들도 함께 복원해야 한다.
 *
 * 예외: collision-guard-object-model은 `= false`를 **명시적으로** 넣는다.
 * GLB가 true로 실려 올 수 있어 방어하는 코드라 성격이 다르다.
 */
export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={SCENE_LIGHTING.ambientIntensity} />
      <directionalLight
        position={SCENE_LIGHTING.directionalPosition}
        color={SCENE_LIGHTING.directionalColor}
        intensity={SCENE_LIGHTING.directionalIntensity}
      />
    </>
  );
}
