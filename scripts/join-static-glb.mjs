// 정적 장식 모델의 프리미티브 병합 (드로우콜 감소).
//
// 사용법:
//   node scripts/join-static-glb.mjs <파일명.glb>   # assets-src/models/ 의 백업본을 병합
//   이어서 반드시: pnpm optimize:glb <파일명.glb>   # 병합본을 public 으로 압축 배포
//
// 왜 별도 스크립트인가:
//   optimize-glb.mjs 는 join/prune 을 의도적으로 쓰지 않는다 — meshOverrides 의
//   [index]name 메쉬 경로·tagMappings 노드 바인딩·리그 관절이 노드 계층에
//   의존하기 때문이다. 하지만 그런 참조가 전혀 없는 **정적 장식 모델**(배·
//   블록 등)은 계층이 런타임 의미를 갖지 않는데도 노드 수천 개 = 드로우콜
//   수천 개로 프레임을 잡아먹는다. 실측: hanwha-ocean-lngc-174k.glb 가
//   노드 2,198개·드로우콜 2,193개(삼각형은 11.2만뿐)로, philly-2dock 씬
//   전체 드로우콜의 96%였다. 병합 후 머티리얼 수(8) 수준으로 줄어든다.
//
// ⚠️ 실행 전 확인 (하나라도 해당하면 이 스크립트를 쓰면 안 된다):
//   - 어떤 씬이든 이 모델에 meshOverrides 가 있다
//   - 어떤 씬이든 이 모델에 내부 노드 대상 tagMappings 가 있다 (node !== '')
//   - 리그(rigId)가 할당돼 있거나 할당할 계획이 있다
//   확인: rg "<파일명>" apps/shell/public/scenes/ 로 사용처를 찾아 항목을 본다.
//
// 동작:
//   1. assets-src/models/<파일> (원본 백업본, **현재본**)을 읽는다. 없으면 중단.
//      .orig 가 아니라 현재본을 소스로 하는 이유: 자산을 새 버전으로 교체한
//      직후 재실행했을 때 옛 .orig 기준 병합본이 새 버전을 소리 없이 덮어쓰는
//      사고를 막기 위해서다(과거 "옛 백업이 새 파일을 되돌린" 사고와 동형).
//      join(dedup→flatten→join→prune)은 멱등이라 — 이미 병합된 파일을 다시
//      병합해도 같은 결과 — 현재본을 읽어도 재실행이 안전하다.
//   2. 병합 전 현재본을 <파일>.orig 로 보존한다(이미 있으면 건너뜀 — .glb 로
//      끝나지 않아 optimize:glb 대상에 잡히지 않는다). 계층이 다시 필요해지면
//      (예: 나중에 리깅) .orig 를 assets-src 로 되돌린다.
//      **자산을 새 버전으로 교체할 때는 옛 .orig 를 함께 지워야** 새 버전의
//      계층 원본이 보존된다 — 안 지우면 .orig 는 옛 버전의 계층으로 남는다.
//   3. dedup → flatten → join → prune 순으로 병합한다. flatten 이 노드
//      transform 을 정점에 구워 월드 결과는 동일하고, prune 이 고아 노드·
//      accessor 를 제거한다(제거 없인 정점 버퍼가 파일에 남는다).
//   4. 결과를 assets-src/models/<파일> 에 덮어쓴다 — optimize-glb.mjs 가
//      백업본을 원본으로 취급하므로, 이어서 pnpm optimize:glb 를 돌리면
//      병합본이 meshopt 압축되어 public 으로 나간다.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join as joinPrimitives, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = join(repoRoot, 'assets-src/models');

const file = process.argv[2];
if (!file || !file.endsWith('.glb')) {
  console.error('사용법: node scripts/join-static-glb.mjs <파일명.glb>');
  process.exit(1);
}

const backupPath = join(BACKUP_DIR, file);
if (!existsSync(backupPath)) {
  console.error(
    `원본 백업본이 없습니다: ${backupPath}\n` +
      '신규 모델이면 먼저 pnpm optimize:glb 로 반입해 백업본을 만든 뒤 실행하세요.',
  );
  process.exit(1);
}

// 병합 전 계층 원본 보존 — .glb 로 끝나지 않아 optimize:glb 가 무시한다.
const origPath = `${backupPath}.orig`;
if (!existsSync(origPath)) {
  copyFileSync(backupPath, origPath);
  console.log(`병합 전 원본 보존: ${origPath}`);
} else {
  console.log(`병합 전 원본 이미 있음(재실행): ${origPath}`);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

function stats(doc) {
  const root = doc.getRoot();
  let drawCalls = 0;
  let tris = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      drawCalls += 1;
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      const count = idx ? idx.getCount() : pos ? pos.getCount() : 0;
      tris += Math.floor(count / 3);
    }
  }
  return {
    nodes: root.listNodes().length,
    drawCalls,
    tris,
    materials: root.listMaterials().length,
  };
}

// 헤더 주석 1 참고 — .orig 가 아니라 현재본을 읽는다(멱등이라 재실행 안전,
// 교체된 새 버전을 옛 .orig 로 되돌리는 사고 방지).
const doc = await io.read(backupPath);
const before = stats(doc);

await doc.transform(dedup(), flatten(), joinPrimitives(), prune());

const after = stats(doc);
await io.write(backupPath, doc);

console.log(
  `병합 완료: nodes ${before.nodes} → ${after.nodes}, ` +
    `drawCalls ${before.drawCalls} → ${after.drawCalls}, ` +
    `tris ${before.tris.toLocaleString()} → ${after.tris.toLocaleString()}, ` +
    `materials ${before.materials} → ${after.materials}`,
);
console.log(`다음 단계: pnpm optimize:glb ${file}`);
