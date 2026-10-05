import {
  ASSET_CAD_EXTENSIONS,
  ASSET_DRAWING_EXTENSIONS,
  ASSET_ENVIRONMENT_EXTENSIONS,
  ASSET_ID_PATTERN,
  ASSET_MODEL_EXTENSIONS,
  getFileExtension,
} from '../model/asset-library-paths';
import type { AssetKind } from '../model/types';

/**
 * 등록할 파일의 판정 — 어떤 종류의 자산이 될 수 있는지, 화면에서 어떻게
 * 미리 볼 수 있는지, GLB 로서 온전한지, 배경으로 쓸 수 있는 EXR 인지.
 */

export type AssetPreviewMode =
  | 'model'
  | 'environment'
  | 'image'
  | 'pdf'
  | 'none';

export function getAssetPreviewMode(format: string): AssetPreviewMode {
  const extension = format.toLowerCase();
  if (extension === 'glb') return 'model';
  if (extension === 'exr') return 'environment';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  return 'none';
}

/** 이 파일이 될 수 있는 자산 종류. 빈 배열이면 받을 수 없는 파일이다. */
export function getAllowedAssetKinds(fileName: string): AssetKind[] {
  const extension = getFileExtension(fileName);
  if ((ASSET_MODEL_EXTENSIONS as readonly string[]).includes(extension)) {
    return ['model', 'map'];
  }
  if ((ASSET_ENVIRONMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return ['environment'];
  }
  if ((ASSET_DRAWING_EXTENSIONS as readonly string[]).includes(extension)) {
    return ['drawing'];
  }
  if ((ASSET_CAD_EXTENSIONS as readonly string[]).includes(extension)) {
    return ['cad'];
  }
  return [];
}

export type GlbHeaderError = 'too-short' | 'bad-magic' | 'bad-version' | 'bad-length';

const GLB_MAGIC = 0x46546c67; // 'glTF' little-endian
const GLB_HEADER_BYTES = 12;

/**
 * GLB 헤더(12바이트) 검사 — 매직 'glTF', 컨테이너 버전 2, 헤더에 적힌 길이가
 * 실제 파일 크기와 같은지. 확장자만 .glb 인 파일이나 전송 중 잘린 파일을
 * 등록 전에 걸러낸다. 문제 없으면 null.
 */
export function validateGlbHeader(
  head: Uint8Array,
  fileSize: number,
): GlbHeaderError | null {
  if (head.byteLength < GLB_HEADER_BYTES) return 'too-short';
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return 'bad-magic';
  if (view.getUint32(4, true) !== 2) return 'bad-version';
  if (view.getUint32(8, true) !== fileSize) return 'bad-length';
  return null;
}

export type ExrHeaderError =
  /** OpenEXR 파일이 아니다(확장자만 .exr). */
  | 'bad-magic'
  /** 헤더를 끝까지 읽지 못했다 — 잘렸거나 해상도 정보가 없다. */
  | 'no-size'
  /** 한 변이 `ASSET_ENVIRONMENT_MAX_SIZE` 를 넘는다. */
  | 'too-large';

const EXR_MAGIC = 0x01312f76; // 76 2f 31 01 little-endian
const EXR_HEADER_START = 8; // 매직 4바이트 + 버전 4바이트

/**
 * 배경 EXR 한 변의 상한(px). 이보다 큰 텍스처는 MAX_TEXTURE_SIZE 가 8192 인
 * GPU 에서 업로드가 실패해 배경이 검게 나온다. 파일 이름의 "4K" 나 파일 크기
 * (DWAA 는 9K 이미지도 수 MB 다)로는 알 수 없어 헤더를 읽는다.
 */
export const ASSET_ENVIRONMENT_MAX_SIZE = 8192;

/** `start` 부터 0 바이트 앞까지의 글자. 0 을 못 만나면 null. */
function readExrText(bytes: Uint8Array, start: number): string | null {
  let end = start;
  while (end < bytes.byteLength && bytes[end] !== 0) end += 1;
  if (end >= bytes.byteLength) return null;
  let text = '';
  for (let i = start; i < end; i += 1) text += String.fromCharCode(bytes[i]);
  return text;
}

/**
 * EXR 헤더에서 이미지 크기(dataWindow)를 읽는다. 헤더는 `이름\0 형식\0
 * 크기(int32) 값` 이 이어지다가 빈 이름으로 끝난다. EXR 이 아니거나 크기를
 * 찾지 못하면 null.
 */
export function readExrSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.byteLength < EXR_HEADER_START) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== EXR_MAGIC) return null;
  let offset = EXR_HEADER_START;
  for (;;) {
    const name = readExrText(bytes, offset);
    if (name === null || name === '') return null;
    offset += name.length + 1;
    const type = readExrText(bytes, offset);
    if (type === null) return null;
    offset += type.length + 1;
    if (offset + 4 > bytes.byteLength) return null;
    const size = view.getInt32(offset, true);
    offset += 4;
    if (size < 0 || offset + size > bytes.byteLength) return null;
    if (name === 'dataWindow' && type === 'box2i' && size === 16) {
      const width = view.getInt32(offset + 8, true) - view.getInt32(offset, true) + 1;
      const height =
        view.getInt32(offset + 12, true) - view.getInt32(offset + 4, true) + 1;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += size;
  }
}

/**
 * 배경으로 쓸 수 있는 EXR 인지 — OpenEXR 파일이고, 크기를 읽을 수 있고, 한
 * 변이 상한을 넘지 않는지. 문제 없으면 null.
 */
export function validateExrHeader(bytes: Uint8Array): ExrHeaderError | null {
  if (bytes.byteLength < EXR_HEADER_START) return 'bad-magic';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== EXR_MAGIC) return 'bad-magic';
  const size = readExrSize(bytes);
  if (!size) return 'no-size';
  return Math.max(size.width, size.height) > ASSET_ENVIRONMENT_MAX_SIZE
    ? 'too-large'
    : null;
}

/** 파일명에서 사람이 읽을 이름을 만든다 — 확장자를 떼고 구분자를 공백으로. */
export function humanizeAssetFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  const stem = extension
    ? fileName.slice(0, fileName.length - extension.length - 1)
    : fileName;
  return stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 이름에서 자산 id 를 만든다. ASCII 영숫자만 남기므로 한글 이름은 비게 되고,
 * 그때는 `fallback`(호출부가 주는 난수 조각)을 쓴다. 이미 있는 id 와 겹치면
 * `-2`, `-3` … 을 붙인다. id 는 한 번 정하면 바꾸지 않는다.
 */
export function createAssetId(
  name: string,
  existingIds: ReadonlySet<string>,
  fallback: string,
): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  const safeFallback =
    fallback
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 12) || 'asset';
  const base = ASSET_ID_PATTERN.test(slug) ? slug : `asset-${safeFallback}`;
  if (!existingIds.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}
