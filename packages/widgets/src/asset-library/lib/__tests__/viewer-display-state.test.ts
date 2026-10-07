// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ASSET_VIEW_MODES,
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  REST_POSE_CLIP,
} from '@crane/features/asset-library';
import {
  createViewerDisplay,
  DEFAULT_VIEW_MODE,
  nextViewerBackground,
  readRememberedViewerDisplay,
  rememberViewerDisplay,
  VIEWER_BACKGROUNDS,
  VIEWER_DISPLAY_STORAGE_KEY,
  type ViewerBackground,
} from '../viewer-display-state';

describe('createViewerDisplay', () => {
  it('첫 배경은 앱 테마를 따른다', () => {
    expect(createViewerDisplay('dark').background).toBe('dark');
    expect(createViewerDisplay('light').background).toBe('light');
  });

  it('모르는 테마는 밝은 배경', () => {
    expect(createViewerDisplay('system').background).toBe('light');
    expect(createViewerDisplay('').background).toBe('light');
  });

  it('기본 방식으로, 격자·치수·자동 회전을 모두 켠 채 시작한다', () => {
    expect(DEFAULT_VIEW_MODE).toBe('lit');
    expect(createViewerDisplay('dark')).toMatchObject({
      viewMode: DEFAULT_VIEW_MODE,
      showGrid: true,
      showDimensions: true,
      turntable: true,
    });
  });

  it('애니메이션은 첫 클립을 기본 배속으로 돌리며 시작한다', () => {
    expect(createViewerDisplay('dark')).toMatchObject({
      animationPlaying: true,
      animationSpeed: DEFAULT_PLAYBACK_SPEED,
      animationClip: null,
    });
  });
});

describe('애니메이션 재생 상태 기억', () => {
  const store = (value: unknown) =>
    window.sessionStorage.setItem(
      VIEWER_DISPLAY_STORAGE_KEY,
      JSON.stringify(value),
    );

  beforeEach(() => window.sessionStorage.clear());

  it('멈춤·재생은 기억한다', () => {
    rememberViewerDisplay({ animationPlaying: false });
    expect(readRememberedViewerDisplay()).toEqual({ animationPlaying: false });
    rememberViewerDisplay({ animationPlaying: true });
    expect(readRememberedViewerDisplay()).toEqual({ animationPlaying: true });
  });

  it('배속은 범위 안 숫자만 기억한다', () => {
    for (const speed of [PLAYBACK_SPEED_MIN, 0.5, 1, PLAYBACK_SPEED_MAX]) {
      rememberViewerDisplay({ animationSpeed: speed });
      expect(readRememberedViewerDisplay()).toEqual({ animationSpeed: speed });
    }
  });

  it('범위 밖·오염된 배속은 버린다', () => {
    for (const animationSpeed of [
      PLAYBACK_SPEED_MIN - 0.01,
      PLAYBACK_SPEED_MAX + 0.01,
      0,
      -1,
      Number.NaN,
      '1',
      null,
      true,
    ]) {
      store({ animationSpeed });
      expect(readRememberedViewerDisplay()).toEqual({});
    }
  });

  it('클립 이름은 기억하지 않는다 — 자산마다 다른 값이다', () => {
    rememberViewerDisplay({ animationClip: 'Walk' });
    expect(readRememberedViewerDisplay()).toEqual({});
    store({ animationClip: 'Walk', animationPlaying: false });
    expect(readRememberedViewerDisplay()).toEqual({ animationPlaying: false });
  });

  it('"애니메이션 없음"(기본 자세)은 자산과 무관하니 기억한다', () => {
    rememberViewerDisplay({ animationClip: REST_POSE_CLIP });
    expect(readRememberedViewerDisplay()).toEqual({
      animationClip: REST_POSE_CLIP,
    });
  });

  it('기본 자세에서 클립이나 첫 클립으로 돌아오면 기억한 기본 자세를 지운다', () => {
    rememberViewerDisplay({ showGrid: false, animationClip: REST_POSE_CLIP });
    rememberViewerDisplay({ animationClip: 'Walk' });
    expect(readRememberedViewerDisplay()).toEqual({ showGrid: false });

    rememberViewerDisplay({ animationClip: REST_POSE_CLIP });
    rememberViewerDisplay({ animationClip: null });
    expect(readRememberedViewerDisplay()).toEqual({ showGrid: false });
  });

  it('기본 자세가 기억돼 있지 않으면 클립 선택은 저장소를 건드리지 않는다', () => {
    rememberViewerDisplay({ animationClip: 'Walk' });
    expect(
      window.sessionStorage.getItem(VIEWER_DISPLAY_STORAGE_KEY),
    ).toBeNull();
    rememberViewerDisplay({ animationClip: null });
    expect(
      window.sessionStorage.getItem(VIEWER_DISPLAY_STORAGE_KEY),
    ).toBeNull();
  });

  it('재생 항목이 없는 옛 저장값은 그대로 읽힌다', () => {
    store({ showGrid: false, turntable: true });
    expect(readRememberedViewerDisplay()).toEqual({
      showGrid: false,
      turntable: true,
    });
  });
});

describe('nextViewerBackground', () => {
  it('순서대로 돌고 끝에서 처음으로 돌아온다', () => {
    const seen: ViewerBackground[] = [VIEWER_BACKGROUNDS[0]];
    for (let i = 0; i < VIEWER_BACKGROUNDS.length; i += 1) {
      seen.push(nextViewerBackground(seen[seen.length - 1]));
    }
    expect(seen).toEqual([...VIEWER_BACKGROUNDS, VIEWER_BACKGROUNDS[0]]);
  });
});

describe('표시 상태 기억', () => {
  const stored = () =>
    window.sessionStorage.getItem(VIEWER_DISPLAY_STORAGE_KEY);
  const store = (value: unknown) =>
    window.sessionStorage.setItem(
      VIEWER_DISPLAY_STORAGE_KEY,
      JSON.stringify(value),
    );

  beforeEach(() => window.sessionStorage.clear());

  it('기억한 것이 없으면 비어 있다', () => {
    expect(readRememberedViewerDisplay()).toEqual({});
  });

  it('바꾼 항목만 기억하고 나머지는 비워 둔다', () => {
    rememberViewerDisplay({ showGrid: false });
    expect(readRememberedViewerDisplay()).toEqual({ showGrid: false });
  });

  it('앞서 기억한 값 위에 덮어쓴다', () => {
    rememberViewerDisplay({ showGrid: false, turntable: false });
    rememberViewerDisplay({ showDimensions: false, turntable: true });
    rememberViewerDisplay({ background: 'blueprint' });
    rememberViewerDisplay({ viewMode: 'wireframe' });
    expect(readRememberedViewerDisplay()).toEqual({
      showGrid: false,
      showDimensions: false,
      turntable: true,
      background: 'blueprint',
      viewMode: 'wireframe',
    });
  });

  it('배경은 고를 수 있는 값을 모두 기억한다', () => {
    for (const background of VIEWER_BACKGROUNDS) {
      rememberViewerDisplay({ background });
      expect(readRememberedViewerDisplay()).toEqual({ background });
    }
  });

  it('뷰 모드는 고를 수 있는 값을 모두 기억한다', () => {
    for (const viewMode of ASSET_VIEW_MODES) {
      rememberViewerDisplay({ viewMode });
      expect(readRememberedViewerDisplay()).toEqual({ viewMode });
    }
  });

  it('빈 변경은 저장소를 건드리지 않는다', () => {
    rememberViewerDisplay({});
    expect(stored()).toBeNull();

    rememberViewerDisplay({ showGrid: false });
    const before = stored();
    rememberViewerDisplay({});
    expect(stored()).toBe(before);
  });

  it('손상된 값은 버린다', () => {
    window.sessionStorage.setItem(VIEWER_DISPLAY_STORAGE_KEY, '{oops');
    expect(readRememberedViewerDisplay()).toEqual({});
  });

  it('객체가 아닌 값은 버린다', () => {
    for (const value of [null, true, 3, 'showGrid', [false, false, false]]) {
      store(value);
      expect(readRememberedViewerDisplay()).toEqual({});
    }
  });

  it('오염된 항목·모르는 항목만 버리고 나머지는 살린다', () => {
    store({
      showGrid: 'no',
      showDimensions: 0,
      turntable: false,
      viewMode: 'xray',
      background: 'neon',
      lodLevel: 2,
    });
    expect(readRememberedViewerDisplay()).toEqual({ turntable: false });

    store({ showGrid: null, showDimensions: false, background: 'blueprint' });
    expect(readRememberedViewerDisplay()).toEqual({
      showDimensions: false,
      background: 'blueprint',
    });
  });

  it('모르는 배경은 버린다', () => {
    for (const background of ['', 'DARK', 'neon', 0, true, null, ['dark']]) {
      store({ background });
      expect(readRememberedViewerDisplay()).toEqual({});
    }
  });

  it('모르는 뷰 모드는 버린다', () => {
    for (const viewMode of ['', 'LIT', 'xray', 0, true, null, ['lit']]) {
      store({ viewMode });
      expect(readRememberedViewerDisplay()).toEqual({});
    }
  });

  it('오염된 변경은 기억하지 않는다', () => {
    rememberViewerDisplay({
      showGrid: 'no',
      turntable: undefined,
      background: 'neon',
      viewMode: 'xray',
    } as never);
    expect(stored()).toBeNull();
  });

  it('손상된 값 위에 기억하면 새 값만 남는다', () => {
    window.sessionStorage.setItem(VIEWER_DISPLAY_STORAGE_KEY, '{oops');
    rememberViewerDisplay({ turntable: false });
    expect(JSON.parse(stored() ?? '')).toEqual({ turntable: false });
  });
});
