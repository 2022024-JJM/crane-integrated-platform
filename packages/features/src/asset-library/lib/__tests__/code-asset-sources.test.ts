import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CODE_ASSETS } from '@crane/domain/3d';
import {
  CODE_USED_DRAWINGS,
  sanitizeAssetLibraryDocument,
} from '@crane/domain/asset-library';
import { collectCodeAssetSources } from '../code-asset-sources';

/** 배포되는 라이브러리 문서 — 코드의 자산 표가 가리키는 대상이다. */
const library = sanitizeAssetLibraryDocument(
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(
          '../../../../../../apps/shell/public/asset-library/library.json',
          import.meta.url,
        ),
      ),
      'utf8',
    ),
  ),
);

const codeAssets = [...Object.values(CODE_ASSETS), ...CODE_USED_DRAWINGS];

describe('collectCodeAssetSources', () => {
  const sources = collectCodeAssetSources();

  it('전부 코드 사용처다 — region·편집 경로가 없다', () => {
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.kind).toBe('code');
      expect(source.regionIds).toEqual([]);
      expect(source.editorPath).toBe('');
    }
  });

  it('쓰는 곳(usedBy)별로 한 줄이고 이름이 겹치지 않는다', () => {
    const names = sources.map((source) => source.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(names)).toEqual(
      new Set(codeAssets.map((item) => item.usedBy)),
    );
  });

  it('표의 자산을 하나도 빠뜨리지 않고 자산 참조와 경로를 싣는다', () => {
    const refs = sources.flatMap((source) => source.refs);
    expect(refs).toHaveLength(codeAssets.length);
    for (const item of codeAssets) {
      expect(refs).toContainEqual({
        path: item.path,
        asset: { id: item.id, version: item.version },
      });
    }
  });
});

describe('코드의 자산 표는 배포된 라이브러리와 맞는다', () => {
  it.each(codeAssets.map((item) => [item.id, item] as const))(
    '%s — 그 자산의 그 버전이 있고 파일 경로가 같다',
    (_id, item) => {
      const asset = library.assets.find((entry) => entry.id === item.id);
      expect(asset, `라이브러리에 자산 ${item.id} 가 없다`).toBeDefined();
      const version = asset!.versions.find(
        (entry) => entry.version === item.version,
      );
      expect(version, `${item.id} 에 버전 ${item.version} 이 없다`).toBeDefined();
      expect(version!.file.ref).toEqual({ storage: 'public', path: item.path });
    },
  );

  it.each(codeAssets.map((item) => [item.id, item] as const))(
    '%s — 코드가 쓰는 버전은 철회·반려 상태가 아니다',
    (_id, item) => {
      const status = library.assets
        .find((entry) => entry.id === item.id)
        ?.versions.find((entry) => entry.version === item.version)?.status;
      expect(['withdrawn', 'rejected']).not.toContain(status);
    },
  );

  it('표 안에서 같은 자산을 두 번 적지 않는다', () => {
    const ids = codeAssets.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
