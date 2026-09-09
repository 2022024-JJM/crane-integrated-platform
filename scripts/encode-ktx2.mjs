// GLB 텍스처의 KTX2(UASTC) 변환 — GPU 압축 텍스처 파일럿/전환 도구.
//
// 사용법:
//   node scripts/encode-ktx2.mjs <입력.glb> <출력.glb> [--srgb-only]
//
// 왜: webp/png 텍스처는 GPU 에 디코드된 RGBA(w×h×4×1.33)로 올라간다 —
// phillyshipyard.glb 하나가 190MB VRAM. UASTC(8bpp)는 GPU 네이티브 압축
// (BC7 등으로 트랜스코드)이라 VRAM·샘플링 대역폭이 1/4 이다. 인코더는
// npm ktx2-encoder(wasm, Binomial basis_universal)라 외부 CLI 설치가 없고
// 폐쇄망 재현이 가능하다. zstd supercompression 으로 파일 크기를 방어한다.
//
// 품질 정책:
//   - UASTC 는 고품질(≈47dB급)이지만 수학적 무손실이 아니다. baseColor/
//     emissive 는 현행 파이프라인도 webp q85 손실이라 급이 같지만, normal/
//     ORM 은 현행이 무손실 webp 라 이 변환이 첫 손실이다 — `--srgb-only` 로
//     baseColor/emissive 만 바꾸고 normal/ORM 을 webp 로 남길 수 있다.
//   - 적용 전 반드시 실 화면 A/B(특히 normal 셰이딩 얼룩·도크 라인 엣지)로
//     확인한다. 슬롯 프리셋: sRGB 전달함수는 baseColor/emissive 만, normal 은
//     normal-map 전용 튜닝, 나머지는 linear.
//   - RDO 는 쓰지 않는다(크기↓ 대신 품질↓ — 품질 우선).
//
// 제약:
//   - 입력 텍스처 한 장이 12Mpix(≈4096² 초과)면 wasm 인코더가 거부한다 —
//     resize 스테이지(최대 2048)를 먼저 거친 파일에 쓰면 걸릴 일 없다.
//   - 뷰어 쪽은 KTX2Loader 배선(@crane/domain/3d lib/ktx2-loader.ts)과
//     public/basis/ 트랜스코더가 있어야 로드된다 — 배선 없는 화면이 하나라도
//     이 GLB 를 로드하면 KHR_texture_basisu 가 필수 확장이라 통째로 throw 된다.
//   - meshopt(EXT_meshopt_compression) GLB 는 encoder 등록으로 재압축 보존.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const srgbOnly = process.argv.includes('--srgb-only');
const [input, output] = args;
if (!input || !output) {
  console.error(
    '사용법: node scripts/encode-ktx2.mjs <입력.glb> <출력.glb> [--srgb-only]',
  );
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`입력 파일이 없습니다: ${input}`);
  process.exit(1);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

/** wasm 인코더는 raw RGBA 입력만 받는다 — webp/png 디코드는 sharp 가 한다. */
async function decodeImage(buffer) {
  const { data, info } = await sharp(Buffer.from(buffer))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

/**
 * 텍스처가 물린 머티리얼 슬롯 이름들 (baseColorTexture 등).
 * 루트가 모든 텍스처를 들고 있는 'textures' 엣지는 슬롯이 아니므로 뺀다.
 */
function textureSlots(texture) {
  return [
    ...new Set(
      texture
        .getGraph()
        .listParentEdges(texture)
        .map((edge) => edge.getName())
        .filter((name) => name !== 'image' && name !== 'textures'),
    ),
  ];
}

const SRGB_SLOTS = new Set(['baseColorTexture', 'emissiveTexture']);
const CONVERTIBLE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

const doc = await io.read(input);
const textures = doc.getRoot().listTextures();
let converted = 0;
let vramBefore = 0;
let vramAfter = 0;

for (const texture of textures) {
  const image = texture.getImage();
  const mime = texture.getMimeType();
  const size = texture.getSize();
  const name = texture.getName() || texture.getURI() || '(unnamed)';
  if (!image || !size || !CONVERTIBLE_MIME.has(mime)) {
    console.log(`  건너뜀 ${name} (${mime})`);
    continue;
  }
  const slots = textureSlots(texture);
  const isSrgb = slots.some((s) => SRGB_SLOTS.has(s));
  const isNormal = slots.some((s) => s === 'normalTexture');
  if (srgbOnly && !isSrgb) {
    console.log(`  유지  ${name} [${slots.join(',')}] (--srgb-only)`);
    continue;
  }
  if (isSrgb && slots.some((s) => !SRGB_SLOTS.has(s))) {
    console.warn(
      `  경고  ${name}: sRGB 슬롯과 linear 슬롯에 동시에 물려 있음 — sRGB 로 인코딩`,
    );
  }

  const [w, h] = size;
  const ktx2 = await encodeToKTX2(image, {
    isUASTC: true,
    generateMipmap: true,
    needSupercompression: true, // zstd — 없으면 8bpp 원시 크기 그대로다
    uastcLDRQualityLevel: 2,
    enableRDO: false, // 품질 우선 — RDO 는 크기↓ 대신 품질↓
    isNormalMap: isNormal,
    isPerceptual: isSrgb,
    isSetKTX2SRGBTransferFunc: isSrgb,
    imageDecoder: decodeImage,
  });
  texture.setImage(ktx2).setMimeType('image/ktx2');
  converted += 1;
  vramBefore += w * h * 4 * 1.33;
  vramAfter += w * h * 1 * 1.33; // UASTC = 8bpp
  console.log(
    `  변환  ${name.padEnd(12)} ${w}x${h} [${slots.join(',')}]` +
      ` ${(image.byteLength / 1024).toFixed(0)}KB → ${(ktx2.byteLength / 1024).toFixed(0)}KB` +
      `${isSrgb ? ' sRGB' : isNormal ? ' normal' : ' linear'}`,
  );
}

if (converted === 0) {
  console.log('변환된 텍스처 없음 — 출력 파일을 만들지 않습니다.');
  process.exit(0);
}

doc.createExtension(KHRTextureBasisu).setRequired(true);
await io.write(output, doc);
console.log(
  `완료: ${converted}장 변환 → ${output}\n` +
    `  텍스처 VRAM ${(vramBefore / 1024 / 1024).toFixed(1)}MB → ${(vramAfter / 1024 / 1024).toFixed(1)}MB (밉맵 포함 추정)`,
);
