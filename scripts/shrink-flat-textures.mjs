// 단색(uniform) 텍스처의 무손실 축소 (VRAM 회수).
//
// 사용법:
//   node scripts/shrink-flat-textures.mjs <파일명.glb>   # assets-src/models/ 의 백업본 대상
//   이어서 반드시: pnpm optimize:glb <파일명.glb>        # public 으로 압축 배포
//
// 왜 필요한가:
//   DCC 에서 나온 GLB 에는 재질 색만 담은 1024²~2048² "단색" 텍스처가 섞여
//   온다. 파일로는 몇 KB 지만 GPU 에는 디코드된 RGBA + 밉맵(w×h×4×1.33)로
//   올라가 장당 5.3~22MB 를 차지한다. 실측: crane.glb 는 1024² 21장 중
//   15장이 단색으로 VRAM 약 80MB 를 낭비했다(scene-perf-report 의
//   FLAT_TEXTURE_LINT 가 이런 파일을 찾아낸다).
//
// 품질 보증(무손실 판정이 이 스크립트의 본론):
//   sharp 로 각 텍스처를 디코드해 **모든 픽셀(RGBA)이 완전히 동일**한
//   텍스처만 4×4 단색 PNG 로 치환한다. 한 픽셀이라도 다르면(그라데이션·
//   노이즈·워터마크) 건드리지 않는다 — 단색 텍스처는 어떤 해상도로 샘플링해도
//   화면 결과가 픽셀 단위로 동일하므로 시각적 무손실이 보장된다.
//   (4×4 인 이유: 1×1 도 유효하지만 일부 압축 포맷·밉 체인이 4의 배수를
//   선호한다. 4×4 RGBA = 85KB → 밉 포함 ~0.0001MB.)
//
// join-static-glb.mjs 와 같은 교체 규약: assets-src 백업본을 제자리에서
// 고치고, .orig 보존은 join 이 이미 했거나(병합 대상) 여기서 만든다.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

// sharp 는 직접 의존성이 아니라 @gltf-transform/cli 가 끌고 온다 — 텍스처
// 커맨드(resize/webp)가 이미 sharp 기반이므로 같은 설치본을 쓴다.
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = join(repoRoot, 'assets-src/models');

const file = process.argv[2];
if (!file || !file.endsWith('.glb')) {
  console.error('사용법: node scripts/shrink-flat-textures.mjs <파일명.glb>');
  process.exit(1);
}

const backupPath = join(BACKUP_DIR, file);
if (!existsSync(backupPath)) {
  console.error(`원본 백업본이 없습니다: ${backupPath}`);
  process.exit(1);
}
const origPath = `${backupPath}.orig`;
if (!existsSync(origPath)) {
  copyFileSync(backupPath, origPath);
  console.log(`수정 전 원본 보존: ${origPath}`);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

const doc = await io.read(backupPath);
let shrunk = 0;
let kept = 0;

for (const texture of doc.getRoot().listTextures()) {
  const image = texture.getImage();
  if (!image) continue;
  const { data, info } = await sharp(Buffer.from(image))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  if (width <= 8 && height <= 8) continue; // 이미 작다

  // 모든 픽셀이 첫 픽셀과 완전히 같은지 — 하나라도 다르면 무손실이 아니므로 skip.
  let uniform = true;
  const r = data[0];
  const g = data[1];
  const b = data[2];
  const a = data[3];
  for (let i = channels; i < data.length; i += channels) {
    if (
      data[i] !== r ||
      data[i + 1] !== g ||
      data[i + 2] !== b ||
      data[i + 3] !== a
    ) {
      uniform = false;
      break;
    }
  }

  const name = texture.getName() || texture.getURI() || '(unnamed)';
  if (!uniform) {
    kept += 1;
    console.log(`  유지  ${name} ${width}x${height} (픽셀 불균일)`);
    continue;
  }

  const tiny = await sharp(Buffer.from([r, g, b, a]), {
    raw: { width: 1, height: 1, channels: 4 },
  })
    .resize(4, 4, { kernel: 'nearest' })
    .png()
    .toBuffer();
  texture.setImage(new Uint8Array(tiny)).setMimeType('image/png');
  shrunk += 1;
  console.log(
    `  축소  ${name} ${width}x${height} → 4x4 (rgba ${r},${g},${b},${a})`,
  );
}

if (shrunk === 0) {
  console.log('단색 텍스처 없음 — 파일 무변경.');
  process.exit(0);
}

await io.write(backupPath, doc);
console.log(
  `완료: ${shrunk}장 축소, ${kept}장 유지. 다음 단계: pnpm optimize:glb ${file}`,
);
