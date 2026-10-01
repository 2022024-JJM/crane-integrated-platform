import { describe, expect, it } from 'vitest';
import type { AssetRecord } from '@crane/domain/asset-library';
import {
  analyzeAssetFile,
  LARGE_ASSET_FILE_BYTES,
} from '../analyze-asset-file';

/** 최소한의 온전한 GLB 헤더 + 채움 바이트. */
function glb(totalBytes = 64, patch: (view: DataView) => void = () => {}) {
  const bytes = new Uint8Array(totalBytes);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalBytes, true);
  patch(view);
  return bytes;
}

const file = (bytes: Uint8Array | string, name: string) =>
  new File([bytes as BlobPart], name);

function uploaded(contentHash: string): AssetRecord {
  return {
    id: 'existing',
    kind: 'model',
    origin: 'user',
    name: 'Existing',
    description: '',
    category: '',
    sites: [],
    tags: [],
    owner: '',
    defaultScale: [1, 1, 1],
    relatedAssetIds: [],
    versions: [
      {
        version: 3,
        status: 'draft',
        file: {
          ref: { storage: 'browser', key: 'files/existing/v3/a.glb' },
          fileName: 'a.glb',
          format: 'glb',
          sizeBytes: 64,
          contentHash,
        },
        note: '',
        createdAt: '',
        createdBy: '',
      },
    ],
    currentVersion: 3,
    createdAt: '',
    updatedAt: '',
    history: [],
  };
}

describe('analyzeAssetFile', () => {
  it('온전한 GLB 는 모델·지도가 될 수 있고 해시가 나온다', async () => {
    const result = await analyzeAssetFile(file(glb(), 'Crane.GLB'), []);
    expect(result).toMatchObject({
      format: 'glb',
      allowedKinds: ['model', 'map'],
      problem: null,
      duplicates: [],
      large: false,
    });
    expect(result.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('받지 않는 형식은 내용을 읽지 않고 막는다', async () => {
    const result = await analyzeAssetFile(file('x', 'model.fbx'), []);
    expect(result.problem).toEqual({ code: 'unsupported', format: 'fbx' });
    expect(result.contentHash).toBeNull();
  });

  it('빈 파일을 막는다', async () => {
    expect((await analyzeAssetFile(file('', 'a.glb'), [])).problem).toEqual({
      code: 'empty',
    });
  });

  it('확장자만 glb 인 파일·잘린 파일·옛 버전을 구분해 막는다', async () => {
    expect(
      (await analyzeAssetFile(file('plain text, not a model', 'a.glb'), [])).problem,
    ).toEqual({ code: 'glb', reason: 'bad-magic' });
    expect((await analyzeAssetFile(file('tiny', 'a.glb'), [])).problem).toEqual({
      code: 'glb',
      reason: 'too-short',
    });
    // 헤더는 128 이라 적혀 있는데 실제는 64 바이트.
    expect(
      (
        await analyzeAssetFile(
          file(glb(64, (view) => view.setUint32(8, 128, true)), 'a.glb'),
          [],
        )
      ).problem,
    ).toEqual({ code: 'glb', reason: 'bad-length' });
    expect(
      (
        await analyzeAssetFile(
          file(glb(64, (view) => view.setUint32(4, 1, true)), 'a.glb'),
          [],
        )
      ).problem,
    ).toEqual({ code: 'glb', reason: 'bad-version' });
  });

  it('도면은 GLB 검사를 거치지 않는다', async () => {
    const result = await analyzeAssetFile(file('%PDF-1.7', 'plan.pdf'), []);
    expect(result).toMatchObject({ allowedKinds: ['drawing'], problem: null });
  });

  it('같은 내용의 버전이 있으면 중복으로 알린다', async () => {
    const bytes = glb();
    const { contentHash } = await analyzeAssetFile(file(bytes, 'a.glb'), []);
    const result = await analyzeAssetFile(file(bytes, 'renamed.glb'), [
      uploaded(contentHash!),
    ]);
    expect(result.duplicates).toEqual([
      { assetId: 'existing', assetName: 'Existing', version: 3 },
    ]);
    // 중복은 경고일 뿐 등록을 막지 않는다.
    expect(result.problem).toBeNull();
  });

  it('배포 파일과의 중복은 통계 표(해시 앞자리 + 크기)로 찾는다', async () => {
    const bytes = glb();
    const { contentHash } = await analyzeAssetFile(file(bytes, 'a.glb'), []);
    const deployed: AssetRecord = {
      ...uploaded(''),
      id: 'deployed',
      name: 'Deployed',
      versions: [
        {
          ...uploaded('').versions[0],
          version: 1,
          file: {
            ref: { storage: 'public', path: '/models/a.glb' },
            fileName: 'a.glb',
            format: 'glb',
            sizeBytes: null,
            contentHash: null,
          },
        },
      ],
    };
    const prefix = contentHash!.slice('sha256:'.length, 'sha256:'.length + 8);
    const match = await analyzeAssetFile(file(bytes, 'a.glb'), [deployed], {
      '/models/a.glb': { hash: prefix, bytes: 64 },
    });
    expect(match.duplicates.map((d) => d.assetId)).toEqual(['deployed']);
    const sizeDiffers = await analyzeAssetFile(file(bytes, 'a.glb'), [deployed], {
      '/models/a.glb': { hash: prefix, bytes: 65 },
    });
    expect(sizeDiffers.duplicates).toEqual([]);
  });

  it('큰 파일 표시는 경계 초과부터(정확값은 아님)', async () => {
    const sized = (size: number) => {
      const fake = file(glb(), 'a.glb');
      Object.defineProperty(fake, 'size', { value: size });
      return fake;
    };
    // 크기를 속였으므로 GLB 길이 검사에는 걸리지만, 큰 파일 판정은 그와 무관하다.
    expect((await analyzeAssetFile(sized(LARGE_ASSET_FILE_BYTES), [])).large).toBe(false);
    expect((await analyzeAssetFile(sized(LARGE_ASSET_FILE_BYTES + 1), [])).large).toBe(true);
  });
});
