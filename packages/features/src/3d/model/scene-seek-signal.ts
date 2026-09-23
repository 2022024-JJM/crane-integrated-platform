/**
 * seek 신호 — 재생 위치가 불연속으로 바뀌었음을 알린다. 발신처는 리플레이
 * 스토어 `seekTo` 와 가상 태그 러너 `seek`·`resetValues` 뿐이고, 러너의 정상
 * 전진(리플레이 `tick`, 가상 태그 틱)은 알리지 않는다. seek 뒤 자세가 리깅
 * 스무딩으로 미끄러지는 동안의 감지 전이를 사건으로 남기지 않으려는 기록기
 * (use-play3d-stats-recorder)가 구독한다. 위치는 싣지 않는다 — 구독자가
 * 트랜스포트에서 읽는다.
 */
type SeekListener = () => void;

const listeners = new Set<SeekListener>();

export function notifySceneSeek(): void {
  for (const listener of [...listeners]) listener();
}

export function subscribeSceneSeek(listener: SeekListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
