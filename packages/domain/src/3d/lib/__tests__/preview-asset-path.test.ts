import { describe, expect, it } from 'vitest';
import { getModelPreviewAssetPath } from '../preview-asset-path';

describe('getModelPreviewAssetPath', () => {
  it('카탈로그 id 를 public 기준 절대 경로로 변환한다', () => {
    expect(getModelPreviewAssetPath('crane')).toBe('/previews/crane.png');
    expect(getModelPreviewAssetPath('gantry-crane')).toBe(
      '/previews/gantry-crane.png',
    );
    expect(getModelPreviewAssetPath('gc-04-part-2')).toBe(
      '/previews/gc-04-part-2.png',
    );
  });

  it('입력을 가공하지 않는다 — id 검증은 저장 측(dev 미들웨어) 책임이다', () => {
    // 특성화: 빈 문자열도 그대로 통과한다. 이런 URL 은 404 로 끝나고
    // 컴포넌트가 offscreen 렌더로 폴백하므로 여기서 방어하지 않는다.
    expect(getModelPreviewAssetPath('')).toBe('/previews/.png');
  });
});
