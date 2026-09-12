import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import type { SceneCollisionRunner } from '../model/scene-collision-hold';

/**
 * 충돌 경보 오버레이 — 활성 충돌 기록(pinned·flash)이 있는 동안 캔버스 위에
 * 뜨는 화면 수준 경보. 뷰어 overlay 슬롯(pointer-events-none 컨테이너)에
 * 합성한다.
 *
 * 씬 안 표시(빨간 박스·접촉 표지)만으로는 카메라가 다른 곳을 보고 있을 때
 * 관제자가 충돌을 놓친다. 여기서는 카메라와 무관하게 보이는 가장자리 비네트를
 * 그린다 — 캔버스 네 변에서 안쪽으로 옅어지는 붉은 그라데이션. 주변 시야에서도
 * 걸리면서 시선은 씬 중앙으로 모이게 한다(실선 테두리는 가장자리로 시선을
 * 끌어 2026-09-08 에 교체). 은은하게 맥동하고 motion-reduce 면 정적. 조작을
 * 막지 않도록 pointer-events-none.
 *
 * 상단 중앙 배너([충돌 지점 보기]·[이어서 재생])는 2026-09-12 에 뺐다 — 관제
 * HUD 충돌 칸·독 AlertTriangle 배지와 겹쳐 보였다. 같은 행동은 독 충돌 팝업
 * (SceneCollisionPanel 의 [충돌 지점 보기])과 독 ▶(재개)에 있다.
 *
 * 2026-09-07 에 제거된 캔버스 위 "오버레이 패널"(감지 설정·기록 조작이 든
 * 컨트롤 패널)과는 역할이 다르다 — 이것은 경보 전용이고, 설정·기록은 그대로
 * 독 팝업(SceneCollisionPanel)에 있다.
 *
 * 해제 규칙은 스토어와 같다: flash 는 FLASH_MS 뒤 스스로 사라지고, pinned 은
 * [재개]로만 풀린다(경보를 닫기만 하고 정지 상태를 잊는 X 버튼은 두지 않는다).
 */
export function SceneCollisionAlertOverlay({
  runner,
}: {
  runner: SceneCollisionRunner;
  /** @deprecated 배너가 없어져 쓰이지 않는다. 호출부 호환용. */
  onViewCollision?: () => void;
  /** @deprecated 배너가 없어져 쓰이지 않는다. */
  bannerClassName?: string;
}) {
  const history = useSceneCollisionStore((s) => s.history);
  const activeRecordId = useSceneCollisionStore((s) => s.activeRecordId);
  const activeMode = useSceneCollisionStore((s) => s.activeMode);
  // runner 는 배너 시절의 문구 분기용이었다 — 비네트만 남은 지금은 쓰지 않지만
  // 호출부 계약을 유지한다.
  void runner;

  const record = history.find((r) => r.id === activeRecordId);
  if (!record || activeMode === null) return null;

  return (
    <>
      {/* 가장자리 비네트 — 캔버스 전체에 걸려 카메라가 어디를 보든 보인다.
          inset box-shadow 라 네 변 모두 같은 농도로 안쪽으로 옅어진다
          (radial-gradient 는 타원이라 모서리만 진해진다). */}
      <div
        aria-hidden
        className="absolute inset-0 animate-pulse shadow-[inset_0_0_120px_32px_rgba(239,68,68,0.6)] motion-reduce:animate-none"
      />
    </>
  );
}
