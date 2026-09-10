import { Crosshair } from 'lucide-react';
import { PREDICTION_LINE_RGB } from '@crane/domain/3d';
import { formatLeadTimeSec } from '../lib/prediction-visual';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';

/**
 * 충돌 **예측** 경보 오버레이 — 카메라가 어디를 보든 "이대로 가면 몇 초 뒤에
 * 부딪힌다" 를 알린다. 뷰어 overlay 슬롯에 합성한다.
 *
 * 기존 `SceneCollisionAlertOverlay` 를 고치지 않고 형제로 둔 이유가 둘이다.
 * 그 컴포넌트는 활성 기록이 없으면 곧바로 null 을 돌려주므로 예측 단독 상태를
 * 표현할 수 없고, 두 비네트가 같은 `inset-0` 에 겹치면 농도가 합쳐져 어느
 * 쪽도 안 읽힌다.
 *
 * **실제 충돌이 예측을 이긴다.** `activeMode` 가 있으면(pinned·flash) 여기서
 * null 을 돌려준다. 정지 모드에서는 러너가 멈춰 예측 게이트가 닫히므로 자연히
 * 사라지지만, "충돌 시 정지" 를 끈 모드에서는 러너가 계속 돌아 3초 flash 구간
 * 동안 빨강과 주황이 함께 뜬다 — 그 구간을 이 규칙이 막는다.
 *
 * `aria-live` 는 `polite` 다. 예측은 리드타임이 갱신되며 반복해서 바뀌는
 * 경고라 `assertive` 로 두면 스크린리더가 계속 끼어든다(실제 충돌만
 * assertive).
 *
 * 재개·정지 버튼은 두지 않는다 — 예측은 경보만 하고 러너를 멈추지 않는다.
 * 정지는 감지의 역할이다.
 */
export function SceneCollisionPredictionOverlay({
  onViewPrediction,
}: {
  onViewPrediction: () => void;
}) {
  const { t } = useTranslation();
  const predicted = useSceneCollisionStore((s) => s.predicted);
  const activeMode = useSceneCollisionStore((s) => s.activeMode);

  if (!predicted || activeMode !== null) return null;

  return (
    <>
      {/* 가장자리 비네트 — 실제 충돌(빨강)보다 옅게, 맥동 없이. 예측은 지속
          상태라 깜빡이면 피로하다. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          boxShadow: `inset 0 0 90px 20px rgba(${PREDICTION_LINE_RGB}, 0.4)`,
        }}
      />
      <div
        aria-live="polite"
        className="animate-in slide-in-from-top-4 fade-in-0 pointer-events-auto absolute top-3 left-1/2 flex w-fit max-w-[min(90%,32rem)] -translate-x-1/2 items-center gap-3 rounded-lg border-2 border-teal-300/70 bg-teal-600/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-sm duration-300 motion-reduce:animate-none"
      >
        {/* 남은 시간을 큰 숫자로 — 씬 안 카운트다운과 같은 값·같은 어휘다.
            "충돌까지" 를 붙여야 무엇까지 남은 시간인지 읽힌다. */}
        <div
          className="flex shrink-0 flex-col items-center leading-none"
          aria-hidden
        >
          <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">
            {t('monitoring:sceneCollision.predictUntilImpact')}
          </span>
          <span className="mt-0.5 text-2xl font-black tabular-nums">
            {formatLeadTimeSec(predicted.leadTimeSec)}
            <span className="ml-0.5 text-[11px] font-semibold opacity-80">
              {t('monitoring:editor.collision.predictHorizonUnit')}
            </span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide uppercase opacity-90">
            {t('monitoring:sceneCollision.predictTitle')}
            <span className="sr-only">
              {' '}
              {t('monitoring:sceneCollision.predictLead', {
                seconds: formatLeadTimeSec(predicted.leadTimeSec),
              })}
            </span>
          </p>
          <p className="truncate text-sm font-bold">
            {predicted.a.equipName || predicted.a.modelId}
            <span className="mx-1.5 font-normal opacity-80">↔</span>
            {predicted.b.equipName || predicted.b.modelId}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 bg-white text-teal-700 hover:bg-white/90"
          onClick={onViewPrediction}
        >
          <Crosshair className="size-3.5" />
          {t('monitoring:editor.collision.viewPredictContact')}
        </Button>
      </div>
    </>
  );
}
