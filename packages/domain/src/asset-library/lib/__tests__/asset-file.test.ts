import { describe, expect, it } from 'vitest';
import { ASSET_ID_PATTERN } from '../../model/asset-library-paths';
import {
  ASSET_ENVIRONMENT_MAX_SIZE,
  createAssetId,
  getAllowedAssetKinds,
  getAssetPreviewMode,
  humanizeAssetFileName,
  readExrSize,
  validateExrHeader,
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

/** EXR 헤더를 만든다 — 매직·버전 뒤에 `이름\\0 형식\\0 크기 값` 이 이어지고 빈 이름으로 끝난다. */
function exrHeader(
  attributes: [name: string, type: string, value: number[]][],
  options: { magic?: number; terminate?: boolean } = {},
): Uint8Array {
  const bytes: number[] = [];
  const pushInt = (value: number) => {
    const view = new DataView(new ArrayBuffer(4));
    view.setInt32(0, value, true);
    bytes.push(...new Uint8Array(view.buffer));
  };
  const pushText = (text: string) => {
    for (const char of text) bytes.push(char.charCodeAt(0));
    bytes.push(0);
  };
  pushInt(options.magic ?? 0x01312f76);
  pushInt(2);
  for (const [name, type, value] of attributes) {
    pushText(name);
    pushText(type);
    pushInt(value.length * 4);
    for (const item of value) pushInt(item);
  }
  if (options.terminate !== false) bytes.push(0);
  return new Uint8Array(bytes);
}
const window = (width: number, height: number): [string, string, number[]] => [
  'dataWindow',
  'box2i',
  [0, 0, width - 1, height - 1],
];

describe('readExrSize', () => {
  it('dataWindow 에서 폭과 높이를 읽는다', () => {
    expect(readExrSize(exrHeader([window(4096, 2048)]))).toEqual({
      width: 4096,
      height: 2048,
    });
  });

  it('앞에 다른 속성이 있어도 건너뛰어 찾는다', () => {
    expect(
      readExrSize(
        exrHeader([
          ['channels', 'chlist', [1, 2, 3]],
          ['compression', 'compression', [9]],
          window(9216, 4608),
        ]),
      ),
    ).toEqual({ width: 9216, height: 4608 });
  });

  it('원점이 0 이 아닌 dataWindow 도 크기를 맞게 센다', () => {
    expect(
      readExrSize(exrHeader([['dataWindow', 'box2i', [10, 20, 109, 69]]])),
    ).toEqual({ width: 100, height: 50 });
  });

  it('EXR 이 아니면 null', () => {
    expect(readExrSize(exrHeader([window(4, 2)], { magic: 0x46546c67 }))).toBe(
      null,
    );
    expect(readExrSize(new Uint8Array(0))).toBeNull();
    expect(readExrSize(new Uint8Array(7))).toBeNull();
  });

  it('dataWindow 없이 헤더가 끝나면 null', () => {
    expect(readExrSize(exrHeader([['compression', 'compression', [9]]]))).toBe(
      null,
    );
  });

  it('잘린 헤더(끝나지 않은 이름·형식·값)는 null — 범위 밖을 읽지 않는다', () => {
    const full = exrHeader([window(4096, 2048)], { terminate: false });
    for (const length of [8, 12, 19, 25, 29, full.byteLength - 1]) {
      expect(readExrSize(full.subarray(0, length))).toBeNull();
    }
    // 끝까지 있으면 읽힌다(종료 바이트가 없어도 dataWindow 는 이미 읽었다).
    expect(readExrSize(full)).toEqual({ width: 4096, height: 2048 });
  });

  it('크기가 0 이하인 dataWindow 는 null', () => {
    expect(
      readExrSize(exrHeader([['dataWindow', 'box2i', [0, 0, -1, 10]]])),
    ).toBeNull();
  });

  it('속성 크기가 음수면 null(무한 루프에 빠지지 않는다)', () => {
    const bytes = exrHeader([['compression', 'compression', [9]]]);
    // compression 속성의 크기 칸(값 4바이트 바로 앞)을 음수로 오염시킨다.
    const sizeOffset = bytes.byteLength - 1 - 4 - 4;
    new DataView(bytes.buffer).setInt32(sizeOffset, -8, true);
    expect(readExrSize(bytes)).toBeNull();
  });

  it('오프셋이 있는 뷰도 제 위치에서 읽는다', () => {
    const header = exrHeader([window(1024, 512)]);
    const padded = new Uint8Array(5 + header.byteLength);
    padded.set(header, 5);
    expect(readExrSize(padded.subarray(5))).toEqual({ width: 1024, height: 512 });
  });
});

describe('validateExrHeader', () => {
  it('상한 이하의 EXR 은 통과한다', () => {
    expect(validateExrHeader(exrHeader([window(4096, 2048)]))).toBeNull();
  });

  it('한 변이 상한과 같으면 통과, 1px 넘으면 too-large(경계)', () => {
    const max = ASSET_ENVIRONMENT_MAX_SIZE;
    expect(validateExrHeader(exrHeader([window(max, max / 2)]))).toBeNull();
    expect(validateExrHeader(exrHeader([window(max + 1, max / 2)]))).toBe(
      'too-large',
    );
    // 높이가 넘어도 같다.
    expect(validateExrHeader(exrHeader([window(max, max + 1)]))).toBe(
      'too-large',
    );
  });

  it('EXR 이 아니면 bad-magic', () => {
    expect(validateExrHeader(new Uint8Array(0))).toBe('bad-magic');
    expect(
      validateExrHeader(exrHeader([window(4, 2)], { magic: 0x46546c67 })),
    ).toBe('bad-magic');
  });

  it('크기를 읽지 못하면 no-size', () => {
    expect(
      validateExrHeader(exrHeader([['compression', 'compression', [9]]])),
    ).toBe('no-size');
    expect(
      validateExrHeader(exrHeader([window(4096, 2048)]).subarray(0, 20)),
    ).toBe('no-size');
  });
});

describe('getAllowedAssetKinds', () => {
  it('GLB 는 모델·지도, EXR 은 배경, 보는 문서는 도면, CAD 원본은 CAD', () => {
    expect(getAllowedAssetKinds('a.GLB')).toEqual(['model', 'map']);
    expect(getAllowedAssetKinds('sky.exr')).toEqual(['environment']);
    expect(getAllowedAssetKinds('SKY.EXR')).toEqual(['environment']);
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
    // .hdr 는 받지 않는다 — 씬 배경 로더가 EXR 만 읽는다.
    for (const name of ['a.gltf', 'a.fbx', 'a.exe', 'a.hdr', 'exr', 'noext', '']) {
      expect(getAllowedAssetKinds(name)).toEqual([]);
    }
  });
});

describe('getAssetPreviewMode', () => {
  it('형식별 미리보기 방식', () => {
    expect(getAssetPreviewMode('GLB')).toBe('model');
    expect(getAssetPreviewMode('exr')).toBe('environment');
    expect(getAssetPreviewMode('EXR')).toBe('environment');
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
