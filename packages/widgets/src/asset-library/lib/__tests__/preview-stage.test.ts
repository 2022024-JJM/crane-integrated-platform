import { describe, expect, it } from 'vitest';
import {
  PREVIEW_MODES,
  resolvePreviewStage,
  type PreviewStageInput,
} from '../preview-stage';

/** 3D 로 바로 열리는 자산 — 여기서 조건을 하나씩 바꿔 본다. */
const open: PreviewStageInput = {
  previewMode: '3d',
  interactive: true,
  fileStatus: 'ready',
  wants3d: true,
  settled: true,
};
const FILE_STATUSES = ['loading', 'ready', 'missing'] as const;
const FLAGS = [true, false] as const;

describe('resolvePreviewStage', () => {
  it('3D 로 열 자산은 머문 뒤에 뷰어가 파일을 연다', () => {
    expect(resolvePreviewStage(open)).toBe('viewer');
  });

  it('머물기 전에는 썸네일이 아니라 불러오는 표시를 보인다', () => {
    expect(resolvePreviewStage({ ...open, settled: false })).toBe('opening');
  });

  it('파일 주소를 푸는 동안에도 불러오는 표시를 보인다', () => {
    expect(resolvePreviewStage({ ...open, fileStatus: 'loading' })).toBe(
      'opening',
    );
    expect(
      resolvePreviewStage({ ...open, fileStatus: 'loading', settled: false }),
    ).toBe('opening');
  });

  it('큰 파일은 썸네일 위에서 묻는다 — 머물렀는지와 무관하다', () => {
    expect(resolvePreviewStage({ ...open, wants3d: false })).toBe('ask');
    expect(
      resolvePreviewStage({ ...open, wants3d: false, settled: false }),
    ).toBe('ask');
  });

  it('큰 파일의 주소를 아직 모르면 묻지 않고 썸네일만 보인다', () => {
    expect(
      resolvePreviewStage({ ...open, wants3d: false, fileStatus: 'loading' }),
    ).toBe('thumbnail');
  });

  it('파일이 없으면 열겠다고 했어도 썸네일이다', () => {
    for (const wants3d of FLAGS) {
      for (const settled of FLAGS) {
        expect(
          resolvePreviewStage({
            ...open,
            fileStatus: 'missing',
            wants3d,
            settled,
          }),
        ).toBe('thumbnail');
      }
    }
  });

  it('이미지로 보기를 고르면 어떤 자산이든 썸네일이다', () => {
    for (const fileStatus of FILE_STATUSES) {
      for (const wants3d of FLAGS) {
        for (const settled of FLAGS) {
          expect(
            resolvePreviewStage({
              previewMode: 'image',
              interactive: true,
              fileStatus,
              wants3d,
              settled,
            }),
          ).toBe('thumbnail');
        }
      }
    }
  });

  it('돌려 볼 수 없는 자산은 3D 로 보기를 골라도 썸네일이다', () => {
    for (const fileStatus of FILE_STATUSES) {
      for (const wants3d of FLAGS) {
        expect(
          resolvePreviewStage({
            ...open,
            interactive: false,
            fileStatus,
            wants3d,
          }),
        ).toBe('thumbnail');
      }
    }
  });

  it('뷰어를 올리는 단계에서는 썸네일을 보이지 않는다', () => {
    // 열기로 정해진 자산(3D · 돌려 볼 수 있음 · 받아도 됨 · 파일이 있음)은
    // 어느 순간에도 썸네일 단계를 거치지 않는다.
    for (const fileStatus of ['loading', 'ready'] as const) {
      for (const settled of FLAGS) {
        const stage = resolvePreviewStage({ ...open, fileStatus, settled });
        expect(['opening', 'viewer']).toContain(stage);
      }
    }
  });
});

describe('PREVIEW_MODES', () => {
  it('이미지가 먼저, 3D 가 다음이다', () => {
    expect(PREVIEW_MODES).toEqual(['image', '3d']);
  });
});
