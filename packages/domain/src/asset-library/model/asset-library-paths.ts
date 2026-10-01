/**
 * 3D 자산 라이브러리의 경로·파일명 규칙 — 브라우저(저장 어댑터)와 Node(vite
 * dev 미들웨어)가 같은 표를 읽는다.
 *
 * 이 파일은 의존성이 0 이어야 한다(React·three·import.meta 없음). 그래야
 * apps/shell/vite.config.ts 가 그대로 import 할 수 있다 — scene-file-map 과
 * 같은 이유다. 한쪽에만 규칙이 있으면 브라우저가 만든 경로를 미들웨어가
 * 거부하거나, 반대로 미들웨어가 라이브러리 밖에 파일을 쓰게 된다.
 *
 * 버전 파일은 **추가만** 한다. 경로에 자산 id 와 버전 번호가 들어가므로
 * 같은 경로는 항상 같은 내용이고, 서버로 옮길 때 이 상대 경로를 그대로
 * 객체 키로 쓸 수 있다.
 */

/** public/ 아래 라이브러리 디렉터리. */
export const ASSET_LIBRARY_DIR = 'asset-library';
/** 라이브러리 문서(자산 메타데이터·버전 목록·컬렉션). */
export const ASSET_LIBRARY_DOCUMENT_PATH = `/${ASSET_LIBRARY_DIR}/library.json`;
/** 배포 파일에서 미리 뽑아 둔 통계 표(scripts/asset-library-stats.mjs). */
export const ASSET_LIBRARY_STATS_PATH = `/${ASSET_LIBRARY_DIR}/stats.json`;
/**
 * 최적화해 저장한 버전의 **원본**을 두는 곳(저장소 루트 기준). 배포되지 않고,
 * 파이프라인을 고친 뒤 다시 최적화할 때의 입력이다(`assets-src/models` 와 같은
 * 역할). 그 아래는 버전 파일 키와 같은 `<id>/v<N>/<name>` 이다.
 */
export const ASSET_LIBRARY_ORIGINALS_DIR = 'assets-src/asset-library';

/** dev 저장 미들웨어 경로. `/file` 하위는 바이너리 업로드·삭제. */
export const DEV_ASSET_LIBRARY_API_PATH = '/__dev/asset-library';

/** 자산 id — 디렉터리명으로 쓰이므로 경로 탈출이 불가능한 문자만 허용한다. */
export const ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** 저장 파일명 — ASCII 영숫자와 `._-` 만. 점으로 시작하지 않는다. */
export const ASSET_FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

/** 3D 자산(모델·지도)으로 받을 수 있는 확장자. 외부 버퍼를 끄는 .gltf 는 받지 않는다. */
export const ASSET_MODEL_EXTENSIONS = ['glb'] as const;
/** 도면(화면에서 바로 보는 문서)으로 받을 수 있는 확장자. */
export const ASSET_DRAWING_EXTENSIONS = [
  'pdf',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const;
/** CAD 원본으로 받을 수 있는 확장자. 보관·버전 관리만 하고 미리보기는 없다. */
export const ASSET_CAD_EXTENSIONS = [
  'dwg',
  'dxf',
  'step',
  'stp',
  'iges',
  'igs',
] as const;
export const ASSET_UPLOAD_EXTENSIONS: readonly string[] = [
  ...ASSET_MODEL_EXTENSIONS,
  ...ASSET_DRAWING_EXTENSIONS,
  ...ASSET_CAD_EXTENSIONS,
];

/** 저장 요청에 싣는 "내가 읽은 문서의 판" 헤더. */
export const ASSET_LIBRARY_REVISION_HEADER = 'x-asset-library-revision';

/**
 * 문서 글자의 지문 — 저장할 때 "내가 읽은 뒤로 다른 곳에서 바뀌지 않았는가"
 * 를 견주는 데 쓴다. 브라우저와 vite 미들웨어가 같은 함수를 쓴다(보안용
 * 해시가 아니다. LAN 의 http 에서는 `crypto.subtle` 이 없어 직접 계산한다).
 */
export function hashAssetLibraryText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

/** 파일명에서 소문자 확장자를 뽑는다. 없으면 빈 문자열. */
export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * 사용자가 올린 파일명을 저장 가능한 이름으로 바꾼다. 한글·공백 등은 `-` 로
 * 접고 확장자는 소문자로 맞춘다. 이름 부분이 전부 사라지면 `file` 을 쓴다.
 * 점이 이어진 곳(`a..b`)은 하나로 접는다 — 경로에 `..` 이 들어가면 읽을 때의
 * 방어가 상위 탈출로 보고 그 자산을 버린다.
 */
export function sanitizeAssetFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  const stem = extension
    ? fileName.slice(0, fileName.length - extension.length - 1)
    : fileName;
  const safeStem =
    stem
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/^[-._]+|[-._]+$/g, '')
      .slice(0, 80) || 'file';
  return extension ? `${safeStem}.${extension}` : safeStem;
}

/** 라이브러리 디렉터리 기준 상대 경로 — 저장소 키와 미들웨어 인자로 쓴다. */
export function buildAssetVersionFileKey(
  assetId: string,
  version: number,
  fileName: string,
): string {
  return `files/${assetId}/v${version}/${fileName}`;
}

export function buildAssetThumbnailKey(assetId: string): string {
  return `thumbnails/${assetId}.png`;
}

/** 저장소 키 → public 절대 경로(`/asset-library/...`). */
export function toAssetLibraryPublicPath(key: string): string {
  return `/${ASSET_LIBRARY_DIR}/${key}`;
}

export type AssetLibraryFileKey =
  | { kind: 'version'; assetId: string; version: number; fileName: string }
  | { kind: 'thumbnail'; assetId: string };

/**
 * 저장소 키를 검증하며 해석한다. 규칙에 맞지 않으면 null — 미들웨어는 null
 * 이면 쓰지 않는다. 버전 번호는 1 이상의 정수, 확장자는 허용 목록 안이어야 한다.
 */
export function parseAssetLibraryFileKey(
  key: string,
): AssetLibraryFileKey | null {
  const parts = key.split('/');
  if (parts[0] === 'thumbnails' && parts.length === 2) {
    const match = /^(.+)\.png$/.exec(parts[1]);
    if (!match || !ASSET_ID_PATTERN.test(match[1])) return null;
    return { kind: 'thumbnail', assetId: match[1] };
  }
  if (parts[0] === 'files' && parts.length === 4) {
    const [, assetId, versionPart, fileName] = parts;
    if (!ASSET_ID_PATTERN.test(assetId)) return null;
    const versionMatch = /^v([1-9]\d{0,5})$/.exec(versionPart);
    if (!versionMatch) return null;
    if (!ASSET_FILE_NAME_PATTERN.test(fileName)) return null;
    if (fileName.includes('..')) return null;
    if (!ASSET_UPLOAD_EXTENSIONS.includes(getFileExtension(fileName))) {
      return null;
    }
    return {
      kind: 'version',
      assetId,
      version: Number(versionMatch[1]),
      fileName,
    };
  }
  return null;
}
