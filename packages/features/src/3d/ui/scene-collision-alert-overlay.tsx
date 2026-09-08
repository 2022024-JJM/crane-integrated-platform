import { AlertTriangle, Crosshair, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import type { SceneCollisionRunner } from '../model/scene-collision-hold';

/**
 * 충돌 경보 오버레이 — 활성 충돌 기록(pinned·flash)이 있는 동안 캔버스 위에
 * 뜨는 화면 수준 경보. 뷰어 overlay 슬롯(pointer-events-none 컨테이너)에
 * 합성한다.
 *
 * 씬 안 표시(빨간 박스·접촉 표지)만으로는 카메라가 다른 곳을 보고 있을 때
 * 관제자가 충돌을 놓친다. 여기서는 카메라와 무관하게 보이는 두 가지를 그린다.
 * - 가장자리 비네트: 캔버스 네 변에서 안쪽으로 옅어지는 붉은 그라데이션.
 *   주변 시야에서도 걸리면서 시선은 씬 중앙으로 모이게 한다(실선 테두리는
 *   가장자리로 시선을 끌어 2026-09-08 에 교체). 은은하게 맥동하고
 *   motion-reduce 면 정적. 조작을 막지 않도록 pointer-events-none.
 * - 상단 중앙 배너: 어떤 장비끼리·언제 충돌했는지와 즉시 행동 버튼
 *   ([충돌 지점 보기], 정지 중이면 [이어서 재생]). 색 단독 인코딩을 피하려고
 *   색 + 비네트 + 텍스트를 함께 쓴다. 아이콘은 깜빡이지 않는다.
 *   실시간 정지("화면 반영 보류")는 제목에 드러내지 않는다 — 시뮬레이션
 *   정지만 제목이 바뀐다. 재개 버튼은 두 모드 모두 가상 태그 러너 재생
 *   (독 ▶ 와 동일)이다 — 실시간 페이지에서도 값은 독 ▶ 가 켠 시뮬레이션이
 *   만들므로, 보류만 풀던 옛 [최신 값 복귀]는 눌러도 아무것도 움직이지
 *   않았다(2026-09-08 통일).
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
  onViewCollision,
}: {
  runner: SceneCollisionRunner;
  onViewCollision: () => void;
}) {
  const { t } = useTranslation();
  const history = useSceneCollisionStore((s) => s.history);
  const activeRecordId = useSceneCollisionStore((s) => s.activeRecordId);
  const activeMode = useSceneCollisionStore((s) => s.activeMode);
  const loadVirtualTags = useVirtualTagStore((s) => s.load);
  const startVirtualTags = useVirtualTagStore((s) => s.start);

  const record = history.find((r) => r.id === activeRecordId);
  if (!record || activeMode === null) return null;

  const isRealtime = runner === 'realtime';
  const pinned = activeMode === 'pinned';
  const title = t(
    pinned && !isRealtime
      ? 'monitoring:sceneCollision.pausedTitle'
      : 'monitoring:sceneCollision.alertTitle',
  );
  const resumeLabel = t('monitoring:sceneCollision.resume');

  // 재개 = 독 ▶ 와 같은 경로. 러너 isRunning false→true 전이를 검사기가 받아
  // 스토어 resume 을 부르고, 그 안에서 실시간 화면 반영 보류도 풀린다
  // (releaseRunners) — 새 해제 경로를 만들지 않는다.
  const handleResume = () => {
    void loadVirtualTags();
    startVirtualTags();
  };

  return (
    <>
      {/* 가장자리 비네트 — 캔버스 전체에 걸려 카메라가 어디를 보든 보인다.
          inset box-shadow 라 네 변 모두 같은 농도로 안쪽으로 옅어진다
          (radial-gradient 는 타원이라 모서리만 진해진다). */}
      <div
        aria-hidden
        className="absolute inset-0 animate-pulse shadow-[inset_0_0_120px_32px_rgba(239,68,68,0.6)] motion-reduce:animate-none"
      />
      <div
        role="alert"
        aria-live="assertive"
        className="animate-in slide-in-from-top-4 fade-in-0 pointer-events-auto absolute top-3 left-1/2 flex w-fit max-w-[min(90%,32rem)] -translate-x-1/2 items-center gap-3 rounded-lg border-2 border-red-500/70 bg-red-600/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-sm duration-300 motion-reduce:animate-none"
      >
        <AlertTriangle className="size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide uppercase opacity-90">
            {title}
          </p>
          <p className="truncate text-sm font-bold">
            {record.a.equipName || record.a.modelId}
            <span className="mx-1.5 font-normal opacity-80">↔</span>
            {record.b.equipName || record.b.modelId}
          </p>
          <p className="font-mono text-[11px] tabular-nums opacity-90">
            {new Date(record.at).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="bg-white text-red-700 hover:bg-white/90"
            onClick={onViewCollision}
          >
            <Crosshair className="size-3.5" />
            {t('monitoring:editor.collision.viewContact')}
          </Button>
          {pinned ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={handleResume}
            >
              <Play className="size-3.5" />
              {resumeLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
