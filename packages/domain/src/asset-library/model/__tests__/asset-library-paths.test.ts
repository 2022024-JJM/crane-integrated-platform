import { describe, expect, it } from 'vitest';
import {
  ASSET_ID_PATTERN,
  buildAssetThumbnailKey,
  buildAssetVersionFileKey,
  getAssetThumbnailPath,
  getFileExtension,
  isRemovableLegacyAssetPath,
  parseAssetLibraryFileKey,
  sanitizeAssetFileName,
  toAssetLibraryPublicPath,
  hashAssetLibraryText,
} from '../asset-library-paths';

describe('getFileExtension', () => {
  it('소문자 확장자를 돌려준다', () => {
    expect(getFileExtension('Crane.GLB')).toBe('glb');
    expect(getFileExtension('a.b.pdf')).toBe('pdf');
  });

  it('확장자가 없거나 점으로 시작·끝나면 빈 문자열이다', () => {
    expect(getFileExtension('README')).toBe('');
    expect(getFileExtension('.gitignore')).toBe('');
    expect(getFileExtension('name.')).toBe('');
    expect(getFileExtension('')).toBe('');
  });
});

describe('sanitizeAssetFileName', () => {
  it('ASCII 영숫자 밖의 문자를 - 로 접고 확장자는 소문자로 맞춘다', () => {
    expect(sanitizeAssetFileName('My Crane (v2).GLB')).toBe('My-Crane-v2.glb');
    expect(sanitizeAssetFileName('a__b--c.glb')).toBe('a__b-c.glb');
  });

  it('이름 부분이 전부 사라지면 file 을 쓴다', () => {
    expect(sanitizeAssetFileName('크레인.glb')).toBe('file.glb');
    expect(sanitizeAssetFileName('....glb')).toBe('file.glb');
  });

  it('경로 구분자와 상위 탈출이 이름에 남지 않는다', () => {
    const name = sanitizeAssetFileName('../../etc/passwd.glb');
    expect(name).not.toContain('/');
    expect(name.startsWith('.')).toBe(false);
    expect(parseAssetLibraryFileKey(`files/a/v1/${name}`)).not.toBeNull();
  });

  it('이름을 80자로 자른다', () => {
    const name = sanitizeAssetFileName(`${'a'.repeat(200)}.glb`);
    expect(name).toBe(`${'a'.repeat(80)}.glb`);
  });
});

describe('ASSET_ID_PATTERN', () => {
  it('64자까지 통과하고 65자는 거부한다', () => {
    expect(ASSET_ID_PATTERN.test('a'.repeat(64))).toBe(true);
    expect(ASSET_ID_PATTERN.test('a'.repeat(65))).toBe(false);
  });

  it('대문자·점·슬래시·빈 문자열·하이픈 시작을 거부한다', () => {
    for (const id of ['Abc', 'a.b', 'a/b', '', '-a', '..']) {
      expect(ASSET_ID_PATTERN.test(id)).toBe(false);
    }
  });
});

describe('parseAssetLibraryFileKey', () => {
  it('버전 파일 키와 썸네일 키를 해석한다', () => {
    const key = buildAssetVersionFileKey('okpo-ttc', 3, 'crane.glb');
    expect(key).toBe('files/okpo-ttc/v3/crane.glb');
    expect(parseAssetLibraryFileKey(key)).toEqual({
      kind: 'version',
      assetId: 'okpo-ttc',
      version: 3,
      fileName: 'crane.glb',
    });
    expect(parseAssetLibraryFileKey(buildAssetThumbnailKey('okpo-ttc'))).toEqual(
      { kind: 'thumbnail', assetId: 'okpo-ttc' },
    );
  });

  it('상위 탈출·다른 디렉터리·깊이가 다른 키를 거부한다', () => {
    for (const key of [
      '../library.json',
      'files/../../x/v1/a.glb',
      'files/a/v1/../../b.glb',
      'files/a/v1/sub/a.glb',
      'files/a/a.glb',
      'other/a/v1/a.glb',
      'thumbnails/a/b.png',
      'thumbnails/../a.png',
      '',
    ]) {
      expect(parseAssetLibraryFileKey(key)).toBeNull();
    }
  });

  it('버전 0·음수·선행 0·비정수를 거부한다', () => {
    for (const part of ['v0', 'v-1', 'v01', 'v1.5', '1', 'v']) {
      expect(parseAssetLibraryFileKey(`files/a/${part}/a.glb`)).toBeNull();
    }
    expect(parseAssetLibraryFileKey('files/a/v1/a.glb')).not.toBeNull();
  });

  it('배경(EXR) 버전 파일 키를 받는다 — 미들웨어가 이 판정으로 쓴다', () => {
    expect(parseAssetLibraryFileKey('files/sky/v2/sky-web.exr')).toEqual({
      kind: 'version',
      assetId: 'sky',
      version: 2,
      fileName: 'sky-web.exr',
    });
  });

  it('허용 목록 밖의 확장자와 썸네일의 png 아닌 확장자를 거부한다', () => {
    expect(parseAssetLibraryFileKey('files/a/v1/a.exe')).toBeNull();
    expect(parseAssetLibraryFileKey('files/a/v1/a.gltf')).toBeNull();
    expect(parseAssetLibraryFileKey('files/a/v1/a.hdr')).toBeNull();
    expect(parseAssetLibraryFileKey('files/a/v1/noext')).toBeNull();
    expect(parseAssetLibraryFileKey('thumbnails/a.jpg')).toBeNull();
  });
});

describe('toAssetLibraryPublicPath', () => {
  it('키 앞에 라이브러리 디렉터리를 붙인다', () => {
    expect(toAssetLibraryPublicPath('files/a/v1/a.glb')).toBe(
      '/asset-library/files/a/v1/a.glb',
    );
  });
});

describe('파일명의 이어진 점', () => {
  it('하나로 접는다 — 경로에 .. 이 남지 않는다', () => {
    expect(sanitizeAssetFileName('crane..v2.glb')).toBe('crane.v2.glb');
    expect(sanitizeAssetFileName('a...b....c.GLB')).toBe('a.b.c.glb');
    expect(sanitizeAssetFileName('..hidden..glb')).not.toContain('..');
  });

  it('파일 키는 .. 이 든 이름을 받지 않는다', () => {
    expect(parseAssetLibraryFileKey('files/a/v1/crane..v2.glb')).toBeNull();
    expect(parseAssetLibraryFileKey('files/a/v1/crane.v2.glb')).not.toBeNull();
  });
});

describe('hashAssetLibraryText', () => {
  it('같은 글자는 같은 지문, 한 글자만 달라도 다른 지문', () => {
    const text = '{"assets":[]}\n';
    expect(hashAssetLibraryText(text)).toBe(hashAssetLibraryText(text));
    expect(hashAssetLibraryText(text)).not.toBe(
      hashAssetLibraryText('{"assets":[] }\n'),
    );
  });

  it('16자리 16진수이고, 빈 글자와 한글도 받는다', () => {
    for (const text of ['', 'a', '옥포조선소 크레인', 'x'.repeat(100_000)]) {
      expect(hashAssetLibraryText(text)).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});

describe('getAssetThumbnailPath', () => {
  it('자산 id 로 썸네일의 public 절대 경로를 만든다', () => {
    expect(getAssetThumbnailPath('okpo-ttc')).toBe(
      '/asset-library/thumbnails/okpo-ttc.png',
    );
  });
});

describe('isRemovableLegacyAssetPath', () => {
  it('옛 배포 디렉터리 아래의 자산 파일은 지울 수 있다', () => {
    for (const path of [
      '/models/okpo_ttc.glb',
      '/models/sub/dir/a.glb',
      '/maps/okpo.glb',
      '/scenes/sky-blue-open-water-web.exr',
      '/drawings/equipment-layout/bos2.webp',
    ]) {
      expect(isRemovableLegacyAssetPath(path)).toBe(true);
    }
  });

  it('같은 디렉터리의 자산이 아닌 파일은 지울 수 없다 — 씬 JSON 을 지우는 길이 되지 않는다', () => {
    expect(isRemovableLegacyAssetPath('/scenes/okpo.json')).toBe(false);
    expect(isRemovableLegacyAssetPath('/models/2540_281.bin')).toBe(false);
    expect(isRemovableLegacyAssetPath('/models/README')).toBe(false);
  });

  it('정해진 디렉터리 밖은 지울 수 없다 — 라이브러리 디렉터리도 여기서는 아니다', () => {
    for (const path of [
      '/asset-library/files/a/v1/a.glb',
      '/simulation/a.glb',
      '/a.glb',
      '/index.html',
    ]) {
      expect(isRemovableLegacyAssetPath(path)).toBe(false);
    }
  });

  it('상위 탈출·빈 조각·역슬래시·상대 경로는 거부한다', () => {
    for (const path of [
      '/models/../scenes/okpo.glb',
      '/models/./a.glb',
      '/models//a.glb',
      '/models/',
      '/models',
      'models/a.glb',
      '/models\\a.glb',
      '/models/..\\a.glb',
      '',
    ]) {
      expect(isRemovableLegacyAssetPath(path)).toBe(false);
    }
  });

  it('확장자는 대소문자를 가리지 않는다', () => {
    expect(isRemovableLegacyAssetPath('/models/Crane.GLB')).toBe(true);
  });
});
