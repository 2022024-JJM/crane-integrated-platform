import type { AlarmZone } from './types';

/** 매뉴얼 2.3: 근접 0.5초 / 미속 0.3초 / 정지 0.2초 부저 */
const BUZZ_SEC: Record<Exclude<AlarmZone, 'none'>, number> = {
  near: 0.5,
  slow: 0.3,
  stop: 0.2,
};

let ctx: AudioContext | null = null;

export function buzz(zone: AlarmZone) {
  if (zone === 'none') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 950;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + BUZZ_SEC[zone]);
  } catch {
    // 오디오 미지원/자동재생 차단 시 무음으로 동작
  }
}
