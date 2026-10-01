import { describe, expect, it } from 'vitest';
import {
  createViewerDisplay,
  nextViewerBackground,
  VIEWER_BACKGROUNDS,
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

  it('도우미는 켜고 자동 회전은 끈 채 시작한다', () => {
    expect(createViewerDisplay('dark')).toMatchObject({
      viewMode: 'lit',
      showGrid: true,
      showDimensions: true,
      turntable: false,
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
