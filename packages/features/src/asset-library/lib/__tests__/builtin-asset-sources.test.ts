import { describe, expect, it } from 'vitest';
import { ASSET_ID_PATTERN, ASSET_KINDS } from '@crane/domain/asset-library';
import { sceneMapCatalog, sceneModelCatalog } from '@crane/domain/3d';
import { collectBuiltinAssetSources } from '../builtin-asset-sources';

describe('collectBuiltinAssetSources', () => {
  const sources = collectBuiltinAssetSources();

  it('씬 카탈로그의 모델·지도가 전부 들어 있다', () => {
    const ids = new Set(sources.map((source) => source.id));
    for (const item of [...sceneModelCatalog, ...sceneMapCatalog]) {
      expect(ids.has(item.id)).toBe(true);
    }
  });

  it('id 가 겹치지 않는다 — 겹치면 병합이 뒤의 자산을 조용히 버린다', () => {
    const ids = sources.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 id 가 자산 id 형식이다 — 아니면 저장 문서의 방어가 그 자산을 버린다', () => {
    for (const source of sources) {
      expect(ASSET_ID_PATTERN.test(source.id), source.id).toBe(true);
    }
  });

  it('경로는 public 절대 경로이고 종류는 아는 값이다', () => {
    for (const source of sources) {
      expect(source.path.startsWith('/'), source.id).toBe(true);
      expect(source.path.includes('..'), source.id).toBe(false);
      expect(ASSET_KINDS).toContain(source.kind);
    }
  });

  it('파일 경로가 겹치지 않는다 — 한 파일이 두 자산으로 보이지 않게', () => {
    const paths = sources.map((source) => source.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
