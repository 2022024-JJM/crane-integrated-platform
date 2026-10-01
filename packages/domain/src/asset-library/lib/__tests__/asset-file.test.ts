import { describe, expect, it } from 'vitest';
import { ASSET_ID_PATTERN } from '../../model/asset-library-paths';
import {
  createAssetId,
  getAllowedAssetKinds,
  getAssetPreviewMode,
  humanizeAssetFileName,
  validateGlbHeader,
} from '../asset-file';

function glbHeader(magic: number, version: number, length: number): Uint8Array {
  const bytes = new Uint8Array(12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, magic, true);
  view.setUint32(4, version, true);
  view.setUint32(8, length, true);
  return bytes;
}
const MAGIC = 0x46546c67;

describe('validateGlbHeader', () => {
  it('매직·버전 2·길이가 맞으면 null', () => {
    expect(validateGlbHeader(glbHeader(MAGIC, 2, 4096), 4096)).toBeNull();
  });

  it('12바이트보다 짧으면 too-short(11 은 거부, 12 는 검사 진행)', () => {
    expect(validateGlbHeader(new Uint8Array(11), 11)).toBe('too-short');
    expect(validateGlbHeader(new Uint8Array(0), 0)).toBe('too-short');
    expect(validateGlbHeader(new Uint8Array(12), 12)).toBe('bad-magic');
  });

  it('매직·버전·길이 불일치를 구분한다', () => {
    expect(validateGlbHeader(glbHeader(0x12345678, 2, 100), 100)).toBe('bad-magic');
    expect(validateGlbHeader(glbHeader(MAGIC, 1, 100), 100)).toBe('bad-version');
    // 전송 중 잘린 파일 — 헤더의 길이가 실제 크기와 다르다.
    expect(validateGlbHeader(glbHeader(MAGIC, 2, 100), 99)).toBe('bad-length');
  });

  it('오프셋이 있는 뷰도 제 위치에서 읽는다', () => {
    const padded = new Uint8Array(20);
    padded.set(glbHeader(MAGIC, 2, 64), 8);
    expect(validateGlbHeader(padded.subarray(8), 64)).toBeNull();
  });
});

describe('getAllowedAssetKinds', () => {
  it('GLB 는 모델·지도, 보는 문서는 도면, CAD 원본은 CAD', () => {
    expect(getAllowedAssetKinds('a.GLB')).toEqual(['model', 'map']);
    for (const name of ['a.pdf', 'a.svg', 'a.PNG', 'a.jpeg', 'a.webp']) {
      expect(getAllowedAssetKinds(name)).toEqual(['drawing']);
    }
    for (const name of ['a.dxf', 'a.DWG', 'a.step', 'a.stp', 'a.iges', 'a.igs']) {
      expect(getAllowedAssetKinds(name)).toEqual(['cad']);
    }
  });

  it('CAD 원본은 화면 미리보기가 없다', () => {
    for (const format of ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs']) {
      expect(getAssetPreviewMode(format)).toBe('none');
    }
  });

  it('받지 않는 형식과 확장자 없는 파일은 빈 배열', () => {
    for (const name of ['a.gltf', 'a.fbx', 'a.exe', 'noext', '']) {
      expect(getAllowedAssetKinds(name)).toEqual([]);
    }
  });
});

describe('getAssetPreviewMode', () => {
  it('형식별 미리보기 방식', () => {
    expect(getAssetPreviewMode('GLB')).toBe('model');
    expect(getAssetPreviewMode('webp')).toBe('image');
    expect(getAssetPreviewMode('svg')).toBe('image');
    expect(getAssetPreviewMode('pdf')).toBe('pdf');
    expect(getAssetPreviewMode('dwg')).toBe('none');
    expect(getAssetPreviewMode('')).toBe('none');
  });
});

describe('humanizeAssetFileName', () => {
  it('확장자를 떼고 구분자를 공백으로 바꾼다', () => {
    expect(humanizeAssetFileName('okpo_tower-crane.glb')).toBe('okpo tower crane');
    expect(humanizeAssetFileName('도면 A.pdf')).toBe('도면 A');
    expect(humanizeAssetFileName('noext')).toBe('noext');
  });
});

describe('createAssetId', () => {
  it('이름을 소문자 슬러그로 만든다', () => {
    expect(createAssetId('Okpo Tower Crane #2', new Set(), 'x')).toBe(
      'okpo-tower-crane-2',
    );
  });

  it('겹치면 -2, -3 … 을 붙인다', () => {
    const taken = new Set(['crane', 'crane-2']);
    expect(createAssetId('Crane', taken, 'x')).toBe('crane-3');
  });

  it('ASCII 가 남지 않는 이름은 폴백 조각을 쓴다', () => {
    expect(createAssetId('옥포 크레인', new Set(), 'AB-12_cd')).toBe('asset-ab12cd');
    expect(createAssetId('', new Set(), '')).toBe('asset-asset');
  });

  it('어떤 입력이든 id 형식을 지킨다', () => {
    for (const name of ['-x-', '..', 'A'.repeat(200), '한글 mix 1', '   ', '🚢']) {
      const id = createAssetId(name, new Set(), 'f0f0-f0f0-f0f0-f0f0');
      expect(ASSET_ID_PATTERN.test(id)).toBe(true);
    }
  });
});
