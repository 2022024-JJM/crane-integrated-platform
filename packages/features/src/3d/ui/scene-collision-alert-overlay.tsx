import { AlertTriangle, Crosshair, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import { FLASH_MS } from '../lib/scene-collision-pairs';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import type { SceneCollisionRunner } from './scene-collision-panel';

/**
 * 충돌 경보 오버레이 — 활성 충돌 기록(pinned·flash)이 있는 동안 캔버스 위에
 * 뜨는 화면 수준 경보. 뷰어 overlay 슬롯(pointer-events-none 컨테이너)에
 * 합성한다.
 *
 * 씬 안 표시(빨간 박스·접촉 표지)만으로는 카메라가 다른 곳을 보고 있을 때
 * 관제자가 충돌을 놓친다. 여기서는 카메라와 무관하게 보이는 두 가지를 그린다.
 * - 가장자리 비네트: 안쪽으로 번지는 붉은 광. 깜빡임이 아니라 호흡
 *   (collision-vignette-breathe)이라 주변 시야에 걸리되 눈을 찌르지 않는다.
 * - 상단 중앙 배너: 다크 글래스 판(테마 무관 고정색) 위에 어떤 장비끼리·
 *   언제 충돌했는지와 즉시 행동 버튼([충돌 지점 보기], 정지 중이면 [재개]).
 *   색 단독 인코딩을 피하려고 색 + 펄스 모션 + 텍스트를 함께 쓴다
 *   (motion-reduce 시 모션 제거). 배너 하단 바가 상태를 겸한다 — pinned 은
 *   붉은 실선(정지 유지 중), flash 는 FLASH_MS 동안 줄어드는 잔여 시간 바.
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
  const resume = useSceneCollisionStore((s) => s.resume);
  const loadVirtualTags = useVirtualTagStore((s) => s.load);
  const startVirtualTags = useVirtualTagStore((s) => s.start);

  const record = history.find((r) => r.id === activeRecordId);
  if (!record || activeMode === null) return null;

  const isRealtime = runner === 'realtime';
  const pinned = activeMode === 'pinned';
  const title = pinned
    ? t(
        isRealtime
          ? 'monitoring:sceneCollision.pausedTitleRealtime'
          : 'monitoring:sceneCollision.pausedTitle',
      )
    : t('monitoring:sceneCollision.alertTitle');
  const resumeLabel = t(
    isRealtime
      ? 'monitoring:sceneCollision.resumeRealtime'
      : 'monitoring:sceneCollision.resume',
  );

  // 재개: 가상 태그는 러너 재생이 해제 경로(▶ 전이를 검사기가 받아 resume),
  // 실시간은 스토어 resume 이 화면 반영 보류를 푼다 — 독 ▶·기록 재클릭과
  // 같은 동작을 배너에서 한 번에 제공할 뿐 새 해제 경로를 만들지 않는다.
  const handleResume = () => {
    if (isRealtime) {
      resume();
      return;
    }
    void loadVirtualTags();
    startVirtualTags();
  };

  return (
    <>
      {/* 가장자리 비네트 — 캔버스 전체 테두리라 카메라가 어디를 보든 걸린다.
          얇은 정의선 + 안쪽으로 번지는 광, 두 겹. */}
      <div
        aria-hidden
        className="absolute inset-0 ring-1 ring-red-500/50 ring-inset"
      />
      <div
        aria-hidden
        className="absolute inset-0 animate-[collision-vignette-breathe_2s_ease-in-out_infinite] shadow-[inset_0_0_110px_20px_rgba(239,68,68,0.38)] motion-reduce:animate-none"
      />
      <div
        role="alert"
        aria-live="assertive"
        className="animate-in slide-in-from-top-4 fade-in-0 zoom-in-95 pointer-events-auto absolute top-3 left-1/2 w-fit max-w-[min(92%,34rem)] -translate-x-1/2 overflow-hidden rounded-xl border border-red-500/40 bg-slate-950/85 text-white shadow-[0_12px_44px_-10px_rgba(239,68,68,0.55)] backdrop-blur-md duration-300 motion-reduce:animate-none"
      >
        <div className="flex items-center gap-3 py-2.5 pr-3 pl-3.5">
          {/* 아이콘 타일 — 뒤로 퍼지는 레이더 핑이 "지금 벌어지는 일"을 말한다. */}
          <div className="relative grid size-10 shrink-0 place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 animate-[collision-ping_1.6s_ease-out_infinite] rounded-lg bg-red-500/35 motion-reduce:animate-none"
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-lg border border-red-500/50 bg-red-500/15"
            />
            <AlertTriangle
              className="relative size-5 text-red-400"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate text-[10px] font-semibold tracking-[0.18em] text-red-400 uppercase">
                {title}
              </p>
              <p className="ml-auto shrink-0 font-mono text-[10px] text-white/55 tabular-nums">
                {new Date(record.at).toLocaleTimeString()}
              </p>
            </div>
            <p className="mt-0.5 flex items-baseline gap-1.5 text-sm font-bold">
              <span className="truncate">
                {record.a.equipName || record.a.modelId}
              </span>
              <span aria-hidden className="shrink-0 text-[11px] text-red-400">
                ↔
              </span>
              <span className="truncate">
                {record.b.equipName || record.b.modelId}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              className="bg-red-500 text-white shadow-[0_2px_12px_-2px_rgba(239,68,68,0.7)] hover:bg-red-400"
              onClick={onViewCollision}
            >
              <Crosshair className="size-3.5" />
              {t('monitoring:editor.collision.viewContact')}
            </Button>
            {pinned ? (
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                onClick={handleResume}
              >
                <Play className="size-3.5" />
                {resumeLabel}
              </Button>
            ) : null}
          </div>
        </div>
        {/* 하단 상태 바 — pinned: 정지 유지 중(실선), flash: 잔여 시간이
            줄어드는 바(자동 해제 예고). duration 을 FLASH_MS 와 묶으려고
            인라인 style 로 준다(잔여 시간 정보라 motion-reduce 에도 남긴다). */}
        {pinned ? (
          <div aria-hidden className="h-0.5 w-full bg-red-500/90" />
        ) : (
          <div aria-hidden className="h-0.5 w-full bg-white/10">
            <div
              className="h-full origin-left bg-red-500"
              style={{
                animation: `collision-flash-drain ${FLASH_MS}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
