import type { AnimationClip } from 'three';

/**
 * 자산 뷰어의 애니메이션 재생 — 클립 목록·선택·배속·시계. three 의 mixer 는
 * 뷰어 안에 있고, 여기는 three 없이 도는 순수 계산과 작은 시계뿐이다.
 *
 * 시계를 뷰어 바깥에 둔 이유: 두 버전을 나란히 볼 때 한 시계를 양쪽에 넘겨
 * 왼쪽이 밀고 오른쪽은 읽기만 하면 두 캔버스가 같은 시각을 그린다. 각자
 * 재생하면 프레임이 어긋날수록 자세가 벌어진다.
 */

export interface PlaybackClip {
  /** `gltf.animations` 안의 자리. 이름이 겹쳐도 이것으로 클립을 찾는다. */
  index: number;
  /** 보이는 이름이자 선택·맞물림의 키. 파일 속 이름이 비어 있으면 순번. */
  name: string;
  durationSec: number;
}

export const PLAYBACK_SPEED_MIN = 0.1;
export const PLAYBACK_SPEED_MAX = 2;
export const PLAYBACK_SPEED_STEP = 0.1;
export const DEFAULT_PLAYBACK_SPEED = 1;

/**
 * "애니메이션 없음" — 클립 대신 고르면 액션을 멈춰 파일의 기본 자세로 본다.
 * 클립 이름 자리에 넣는 값이라 `listPlaybackClips` 가 같은 이름의 클립을
 * 내지 않게 막는다.
 */
export const REST_POSE_CLIP = '#rest';

/**
 * 한 프레임에 나아갈 수 있는 최대 시간(초). demand 루프에서 always 로 바뀌는
 * 첫 프레임의 delta 는 멈춰 있던 시간 전체라, 그대로 더하면 자세가 뛴다.
 */
export const PLAYBACK_MAX_FRAME_DELTA_SEC = 0.1;

/**
 * 파일 속 클립을 목록으로. 빈 이름은 순번(`#n`)으로, 겹치는 이름(기본 자세
 * 항목과 같은 이름 포함)은 뒤에 번호를 붙여 선택 키가 겹치지 않게 한다.
 */
export function listPlaybackClips(
  animations: readonly Pick<AnimationClip, 'name' | 'duration'>[],
): PlaybackClip[] {
  const seen = new Map<string, number>([[REST_POSE_CLIP, 1]]);
  return animations.map((animation, index) => {
    const base = animation.name.trim() || `#${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return {
      index,
      name: count > 1 ? `${base} (${count})` : base,
      durationSec:
        Number.isFinite(animation.duration) && animation.duration > 0
          ? animation.duration
          : 0,
    };
  });
}

/**
 * 요청한 이름의 클립. 없거나 요청이 없으면 첫 클립, 클립이 없거나 기본 자세
 * (`REST_POSE_CLIP`)를 골랐으면 null.
 */
export function resolvePlaybackClip(
  clips: readonly PlaybackClip[],
  requested: string | null,
): PlaybackClip | null {
  if (requested === REST_POSE_CLIP) return null;
  return matchPlaybackClip(clips, requested) ?? clips[0] ?? null;
}

/**
 * 요청한 이름의 클립만. 요청이 없으면 첫 클립, 요청한 이름이 없거나 기본
 * 자세를 골랐으면 null — 따라가는 쪽(비교의 새 버전)이 다른 클립으로 대신
 * 돌지 않게.
 */
export function matchPlaybackClip(
  clips: readonly PlaybackClip[],
  requested: string | null,
): PlaybackClip | null {
  if (requested === null) return clips[0] ?? null;
  if (requested === REST_POSE_CLIP) return null;
  return clips.find((clip) => clip.name === requested) ?? null;
}

/** 저장소에서 읽은 값이 쓸 수 있는 배속인가. */
export function isPlaybackSpeed(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= PLAYBACK_SPEED_MIN &&
    value <= PLAYBACK_SPEED_MAX
  );
}

/** 범위 안으로 자르고 스텝의 부동소수 찌꺼기를 턴다. 숫자가 아니면 기본 배속. */
export function clampPlaybackSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PLAYBACK_SPEED;
  const clamped = Math.min(
    PLAYBACK_SPEED_MAX,
    Math.max(PLAYBACK_SPEED_MIN, value),
  );
  return Math.round(clamped * 100) / 100;
}

/** 클립 길이 안으로 감은 시각. 길이가 없으면 0. */
export function wrapPlaybackTime(time: number, durationSec: number): number {
  if (!(durationSec > 0) || !Number.isFinite(time)) return 0;
  const wrapped = time % durationSec;
  return wrapped < 0 ? wrapped + durationSec : wrapped;
}

/** 초 → `1.07`, 1분 이상이면 `1:02.5`. */
export function formatClipTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  if (safe < 60) return safe.toFixed(2);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

export interface PlaybackClock {
  /** 지금 시각(초). 클립 길이 안이다. */
  getTime(): number;
  /** 시각을 바로 놓는다(이동·클립 바꿈). 음수·비정상 값은 0. 구독자에게 알린다. */
  setTime(time: number): void;
  /**
   * 한 프레임만큼 나아가 클립 길이로 감는다. delta 는 벽시계 초이고 배속을
   * 여기서 곱한다. 돌려주는 값은 새 시각. 알리지 않는다 — 매 프레임 일이다.
   */
  advance(deltaSec: number, speed: number, durationSec: number): number;
  /** `setTime` 을 알린다. 멈춘 캔버스가 이동한 자세를 한 번 다시 그리는 데 쓴다. */
  subscribe(listener: () => void): () => void;
}

export function createPlaybackClock(): PlaybackClock {
  let time = 0;
  const listeners = new Set<() => void>();
  return {
    getTime: () => time,
    setTime: (next) => {
      time = Number.isFinite(next) && next > 0 ? next : 0;
      for (const listener of listeners) listener();
    },
    advance: (deltaSec, speed, durationSec) => {
      const step = Number.isFinite(deltaSec)
        ? Math.min(Math.max(deltaSec, 0), PLAYBACK_MAX_FRAME_DELTA_SEC)
        : 0;
      const rate = Number.isFinite(speed) && speed > 0 ? speed : 0;
      time = wrapPlaybackTime(time + step * rate, durationSec);
      return time;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
