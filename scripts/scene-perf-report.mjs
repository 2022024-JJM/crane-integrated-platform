// 씬 성능 진단 리포트 — 수동 진단 전용, CI 게이트 아님.
//
// ⚠️ 이 스크립트는 **항상 exit code 0** 으로 끝난다. 2026-09-01 자동 성능
//    게이트 폐기 결정(AGENTS.md "자동화된 성능 게이트는 없다")을 준수한다.
//    임계값 초과는 경고 출력일 뿐, 빌드·커밋을 막는 용도로 쓰지 않는다.
//
// 사용법:
//   node scripts/scene-perf-report.mjs                    # scenes/*.json 전체
//   node scripts/scene-perf-report.mjs philly-2dock.json  # 특정 씬만 (.json 생략 가능, 복수 가능)
//   node scripts/scene-perf-report.mjs --json             # 기계 판독 스냅샷 (시점 간 diff 용)
//
// 무엇을 재나:
//   씬 JSON(models[].path + maps[].path)이 참조하는 GLB 전수를
//   @gltf-transform/core 로 열어 노드·드로우콜·삼각형·머티리얼·텍스처 VRAM 을
//   집계한다. 측정 코어는 scripts/join-static-glb.mjs 의 stats() 와 같은
//   NodeIO + ALL_EXTENSIONS + MeshoptDecoder, "노드 사용 기준" 이다 —
//   같은 mesh 를 노드 여럿이 참조하면 각각 드로우콜로 센다.
//
// 수치 해석 주의:
//   - 드로우콜·렌더 삼각형은 GLB 기원 **정적 상한**이다. 실제 프레임은 프러스텀
//     컬링으로 줄고, 그리드·스카이·실루엣 등 비 GLB 오버레이로 는다
//     (philly-2dock 실측: GLB 기원 103 vs renderer.info 154 — 오버레이 ~51콜).
//   - shadows=true 씬은 캐스터 드로우콜이 shadow pass 에서 한 번 더 소모된다
//     (표의 수치는 base pass 기준 — 해당 씬 표 아래 각주로 표시).
//   - texVRAM·uniqTris·file(MB) 는 같은 GLB 를 여러 번 배치해도 1회만 센다.
//     drei useGLTF 가 URL 단위로 캐시해 지오메트리·텍스처가 인스턴스 간
//     공유되기 때문이다. drawCalls·renderTris 는 배치 수만큼 곱한다.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(repoRoot, 'apps/shell/public');
const SCENES_DIR = join(PUBLIC_DIR, 'scenes');

// ─────────────────────────────────────────────────────────────────────────────
// 경고 기준 상수 — 2026-09-09 씬 5개 전수 실측 분포 기준.
// 운영 장비(폐쇄망) GPU 스펙 실측이 없어 dev 장비 기준 추정치다. 초과해도
// 경고만 낸다 — 게이트로 승격하려면 운영 장비 검증이 선행돼야 한다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 모델 1개(인스턴스당) 드로우콜 상한.
 * 정상 분포 최대는 지도 phillyshipyard.glb 의 41인데 그건 머티리얼 41 =
 * 병합 하한 도달이라 정상이다(그래서 지도는 이 기준에서 제외). 모델 위반
 * 선례: crane.glb 91(머티리얼 7뿐 → join 시 ~7 예상), 병합 전
 * hanwha-ocean-lngc-174k.glb 2,193(join 후 11 — join-static-glb.mjs 주석).
 */
const MODEL_DRAWCALLS_WARN = 30;

/**
 * 드로우콜/머티리얼 비율. 1 에 가까울수록 병합 하한에 도달한 상태다.
 * crane.glb 가 91/7 = 13배 — 계층이 런타임 의미 없이 쪼개져 있다는 신호.
 */
const MODEL_PRIM_TO_MATERIAL_RATIO_WARN = 3;

/**
 * 씬 GLB 기원 드로우콜 합계. 현 최대 214(1dock/2dock) — 모델 수십 개
 * 성장분을 반영해 300, 명백한 이상은 600.
 */
const SCENE_DRAWCALLS_WARN = 300;
const SCENE_DRAWCALLS_RED = 600;

/**
 * 씬 텍스처 VRAM 합계(MB). 현 최대 philly-2dock 281.83MB(지도 2장 포함).
 * 이보다 커지면 통합 그래픽 장비에서 스왑·프리징 위험이 커진다.
 */
const SCENE_TEX_VRAM_WARN_MB = 350;
const SCENE_TEX_VRAM_RED_MB = 500;

/**
 * 모델 1개 텍스처 VRAM(MB). 2048² 1장 ≈ 22MB(optimize-glb.mjs 주석) + 여유.
 * 위반 선례: crane.glb 111.7MB — 1024² 21장, 그중 15장은 파일 8KB 이하
 * 단색인데 각 5.32MB 로 디코드된다(아래 FLAT_TEXTURE 린트가 잡는다).
 */
const MODEL_TEX_VRAM_WARN_MB = 30;

/**
 * 모델 1개(인스턴스당) 삼각형. 현 최대 TTC-28.glb 171,868 을 통과시키는
 * 위치에 둔다. 지도는 제외 — philly-terrain 178만 tris 는 simplify 바닥
 * 실측(재시도 금물, memory/philly-3d-loading-analysis)이라 모델 기준이
 * 무의미하다. 지도 부하는 씬 합계 기준이 잡는다.
 */
const MODEL_TRIS_WARN = 200_000;

/**
 * 씬 렌더 삼각형 합계(배치 수 반영). 현 최대 philly-2dock 2,502,024
 * (terrain 1,782,152 지배). 성장 여유를 두어 3.0M, 명백한 이상은 4.5M.
 */
const SCENE_RENDER_TRIS_WARN = 3_000_000;
const SCENE_RENDER_TRIS_RED = 4_500_000;

/**
 * 모델 노드 수. meshOverrides·리깅·태그 바인딩이 없는 모델의 거대 계층은
 * 런타임 의미 없이 드로우콜·순회 비용만 남는다. 위반 선례: crane.glb 185,
 * 병합 전 lngc 2,198.
 */
const MODEL_NODES_WARN = 100;

/**
 * 단색(플랫) 텍스처 린트: 해상도 ≥1024² 인데 파일 ≤16KB 면 사실상 단색이다.
 * 축소해도 화면 무손실인데 GPU 에는 1024² RGBA ≈ 5.32MB/장으로 디코드된다.
 * 선례: crane.glb 21장 중 15장이 0~8KB webp — 합계 약 80MB 회수 가능.
 * 주의: optimize-glb 의 resize 스테이지는 GLB 단위 전체 적용이라 이 린트에
 * 걸린 텍스처만 골라 줄이려면 텍스처별 개별 처리가 필요하다(일괄 축소는
 * 정상 텍스처 품질을 깎는다 — 품질 저하 금지).
 */
const FLAT_TEXTURE_MIN_PIXELS = 1024 * 1024;
const FLAT_TEXTURE_MAX_FILE_KB = 16;

/**
 * 텍스처 VRAM 공식: w×h×4바이트×1.33(밉맵 오버헤드). 근거는
 * scripts/optimize-glb.mjs 의 MAX_TEXTURE_SIZE 주석(2048² ≈ 22MB/장) —
 * webp/png 가 압축 형식과 무관하게 RGBA8 로 디코드 업로드되는 현 파이프라인
 * 전제다. image/ktx2(basis) 는 GPU 압축 형식 그대로 상주해 이 공식이
 * 무효이므로, 발견 시 "공식 부정확" 경고를 낸다.
 */
const MIPMAP_OVERHEAD = 1.33;

// ─────────────────────────────────────────────────────────────────────────────
// CLI 파싱 — 인자 없으면 scenes/ 전체, 씬 이름 인자(.json 생략 가능), --json.
// ─────────────────────────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const jsonMode = rawArgs.includes('--json');
const sceneArgs = rawArgs.filter((a) => a !== '--json');

const allSceneFiles = readdirSync(SCENES_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

let targetScenes = allSceneFiles;
if (sceneArgs.length > 0) {
  targetScenes = [];
  for (const arg of sceneArgs) {
    const name = basename(arg);
    const candidate = name.endsWith('.json') ? name : `${name}.json`;
    if (allSceneFiles.includes(candidate)) {
      targetScenes.push(candidate);
    } else {
      // 못 찾아도 exit 0 유지(게이트 아님) — 안내만 하고 나머지는 진행한다.
      console.error(
        `씬을 찾을 수 없습니다: ${arg}\n사용 가능: ${allSceneFiles.join(', ')}`,
      );
    }
  }
}

// ANSI 색은 사람이 보는 TTY 에서만 — 파이프·리다이렉트·--json 은 플레인.
const useColor = process.stdout.isTTY === true && !jsonMode;
const yellow = (s) => (useColor ? `\x1b[33m${s}\x1b[0m` : s);
const red = (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s);
const dim = (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s) => (useColor ? `\x1b[1m${s}\x1b[0m` : s);

// ─────────────────────────────────────────────────────────────────────────────
// join-static-glb 적격성 역스캔 — 측정 대상과 무관하게 **전 씬**을 본다.
// 어느 한 씬에서라도 노드 계층을 참조하면(join-static-glb.mjs 헤더의 금지
// 조건) flatten/join 이 그 씬을 조용히 깨뜨리기 때문이다.
// ─────────────────────────────────────────────────────────────────────────────

function collectJoinBlockers() {
  const blockers = new Map(); // glbPath → Map(사유 → Set(씬 이름))
  const add = (glbPath, reason, sceneName) => {
    if (!blockers.has(glbPath)) blockers.set(glbPath, new Map());
    const byReason = blockers.get(glbPath);
    if (!byReason.has(reason)) byReason.set(reason, new Set());
    byReason.get(reason).add(sceneName);
  };
  for (const sceneFile of allSceneFiles) {
    const sceneName = sceneFile.replace(/\.json$/, '');
    let scene;
    try {
      scene = JSON.parse(readFileSync(join(SCENES_DIR, sceneFile), 'utf8'));
    } catch {
      continue; // 손상 씬은 아래 측정 단계에서 따로 보고된다.
    }
    for (const m of scene.models ?? []) {
      if (!m?.path) continue;
      if (Array.isArray(m.meshOverrides) && m.meshOverrides.length > 0) {
        add(m.path, 'meshOverrides', sceneName);
      }
      if (m.rigId) add(m.path, 'rigId', sceneName);
      // 레거시 rigBindings 는 로드 시 joint tagMappings 로 변환된다
      // (sanitize-tag-mappings.ts) — 저장본에 남아 있어도 차단 사유다.
      if (Array.isArray(m.rigBindings) && m.rigBindings.length > 0) {
        add(m.path, 'rigBindings(legacy)', sceneName);
      }
      for (const t of m.tagMappings ?? []) {
        const target = t?.target;
        if (!target) continue;
        if (target.kind === 'joint') add(m.path, 'joint tagMapping', sceneName);
        // node === '' 은 모델 루트(씬 배치 래퍼) 대상이라 계층 병합과 무관.
        else if (target.kind === 'node' && target.node) {
          add(m.path, '내부 노드 tagMapping', sceneName);
        }
      }
    }
  }
  return blockers;
}

const joinBlockers = collectJoinBlockers();

/** '/models/x.glb' → { eligible, reasons: ['rigId(philly-2dock)', ...] } */
function joinEligibility(glbPath) {
  const byReason = joinBlockers.get(glbPath);
  if (!byReason) return { eligible: true, reasons: [] };
  const reasons = [...byReason.entries()].map(
    ([reason, scenes]) => `${reason}(${[...scenes].sort().join(', ')})`,
  );
  return { eligible: false, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// GLB 측정 — join-static-glb.mjs 의 stats() 와 같은 노드 사용 기준.
// ─────────────────────────────────────────────────────────────────────────────

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

async function measureGlb(absPath) {
  const doc = await io.read(absPath);
  const root = doc.getRoot();

  // 드로우콜·렌더 삼각형: 노드 사용 기준 — 같은 mesh 를 노드 여럿이
  // 참조하면 각각 드로우콜이다 (three.js 렌더러 동작과 일치).
  let drawCalls = 0;
  let renderTris = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    // LOD 사본(extras lod>0 — 지형 타일·모델 LOD)은 기본 숨김이라 렌더
    // 기준에서 뺀다. 한 시점에 한 레벨만 보이므로 LOD0 이 상한이다.
    const lod = node.getExtras()?.lod;
    if (typeof lod === 'number' && lod > 0) continue;
    for (const prim of mesh.listPrimitives()) {
      drawCalls += 1;
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      const count = idx ? idx.getCount() : pos ? pos.getCount() : 0;
      renderTris += Math.floor(count / 3);
    }
  }

  // 고유 지오메트리 기준 — GPU 상주 버퍼 관점(공유 mesh 는 1회).
  let uniqueTris = 0;
  let uniqueVerts = 0;
  let primCount = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      primCount += 1;
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      const count = idx ? idx.getCount() : pos ? pos.getCount() : 0;
      uniqueTris += Math.floor(count / 3);
      if (pos) uniqueVerts += pos.getCount();
    }
  }

  const textures = [];
  let texVramBytes = 0;
  let flatTextureCount = 0;
  let flatTextureVramBytes = 0;
  let hasKtx2 = false;
  let sizeUnknownCount = 0;
  for (const tex of root.listTextures()) {
    const size = tex.getSize(); // png/jpeg/webp/ktx2 헤더에서 읽는다. 실패 시 null.
    const mime = tex.getMimeType();
    const fileBytes = tex.getImage()?.byteLength ?? 0;
    if (mime === 'image/ktx2') hasKtx2 = true;
    if (size) {
      const vram = size[0] * size[1] * 4 * MIPMAP_OVERHEAD;
      texVramBytes += vram;
      const isFlat =
        size[0] * size[1] >= FLAT_TEXTURE_MIN_PIXELS &&
        fileBytes <= FLAT_TEXTURE_MAX_FILE_KB * 1024;
      if (isFlat) {
        flatTextureCount += 1;
        flatTextureVramBytes += vram;
      }
      textures.push({
        name: tex.getName() || null,
        mime,
        width: size[0],
        height: size[1],
        fileKB: Math.round(fileBytes / 1024),
        vramMB: round2(vram / 1024 / 1024),
        flat: isFlat,
      });
    } else {
      // 크기를 못 읽으면 VRAM 을 0 으로 두지 않고 "미상" 으로 보고해
      // 합계가 과소 집계임을 드러낸다.
      sizeUnknownCount += 1;
      textures.push({
        name: tex.getName() || null,
        mime,
        width: null,
        height: null,
        fileKB: Math.round(fileBytes / 1024),
        vramMB: null,
        flat: false,
      });
    }
  }

  return {
    fileSize: statSync(absPath).size,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    primCount,
    drawCalls,
    renderTris,
    uniqueTris,
    uniqueVerts,
    textures,
    texVramBytes,
    flatTextureCount,
    flatTextureVramBytes,
    hasKtx2,
    sizeUnknownCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 씬 단위 집계 + 경고 판정
// ─────────────────────────────────────────────────────────────────────────────

const round2 = (x) => Math.round(x * 100) / 100;
const mb = (bytes) => round2(bytes / 1024 / 1024);
const fmtMB = (bytes) => mb(bytes).toFixed(2);
const num = (x) => x.toLocaleString('en-US');

const glbCache = new Map(); // absPath → 측정 결과 (씬 간 공유 — 같은 GLB 1회 측정)

async function analyzeScene(sceneFile) {
  const scene = JSON.parse(readFileSync(join(SCENES_DIR, sceneFile), 'utf8'));
  const shadows = scene.lighting?.shadows === true;

  // path 별 배치 수 집계 — 모델 먼저, 지도 나중 (표 가독성).
  const byPath = new Map();
  const addPlacement = (path, kind) => {
    const key = `${kind}:${path}`;
    const entry = byPath.get(key) ?? { path, kind, count: 0 };
    entry.count += 1;
    byPath.set(key, entry);
  };
  for (const m of scene.models ?? [])
    if (m?.path) addPlacement(m.path, 'model');
  for (const m of scene.maps ?? []) if (m?.path) addPlacement(m.path, 'map');

  const assets = [];
  const missing = [];
  const totals = {
    placements: (scene.models?.length ?? 0) + (scene.maps?.length ?? 0),
    drawCalls: 0,
    renderTris: 0,
    uniqueTris: 0,
    uniqueVerts: 0,
    texVramBytes: 0,
    fileBytes: 0,
    textures: 0,
  };

  for (const entry of byPath.values()) {
    const abs = join(PUBLIC_DIR, entry.path.replace(/^\//, ''));
    if (!existsSync(abs)) {
      missing.push(entry.path);
      continue;
    }
    if (!glbCache.has(abs)) {
      try {
        glbCache.set(abs, await measureGlb(abs));
      } catch (error) {
        glbCache.set(abs, { error: error.message });
      }
    }
    const s = glbCache.get(abs);
    if (s.error) {
      missing.push(`${entry.path} (읽기 실패: ${s.error})`);
      continue;
    }
    totals.drawCalls += s.drawCalls * entry.count;
    totals.renderTris += s.renderTris * entry.count;
    // 아래 넷은 GLB 당 1회 — useGLTF 의 URL 단위 캐시로 인스턴스 간 공유.
    totals.uniqueTris += s.uniqueTris;
    totals.uniqueVerts += s.uniqueVerts;
    totals.texVramBytes += s.texVramBytes;
    totals.fileBytes += s.fileSize;
    totals.textures += s.textures.length;
    assets.push({ ...entry, stats: s, join: joinEligibility(entry.path) });
  }

  return { sceneFile, shadows, assets, missing, totals };
}

/** 씬 분석 결과 → 경고 목록. level: 'warn' | 'red'. */
function buildWarnings({ assets, missing, totals }) {
  const warnings = [];
  const push = (level, message, nextAction) =>
    warnings.push({ level, message, nextAction: nextAction ?? null });

  for (const path of missing) {
    push(
      'red',
      `참조 GLB 없음: ${path}`,
      '씬 JSON 의 path 와 public/ 배포 여부를 확인',
    );
  }

  for (const a of assets) {
    const s = a.stats;
    const file = basename(a.path);
    // MODEL_* 기준은 모델에만 적용한다 — 지도는 병합 하한(=머티리얼 수)에
    // 이미 도달해 있고(phillyshipyard 41) 전용 파이프라인(optimize:map)을
    // 쓰므로, 지도 부하는 씬 합계 기준으로만 본다.
    if (a.kind !== 'model') continue;

    // 드로우콜·비율·노드 수는 원인이 같아(무의미한 계층 분할) 한 항목으로 묶는다.
    const ratio = s.materials > 0 ? s.drawCalls / s.materials : 0;
    const structureFacts = [];
    if (s.drawCalls > MODEL_DRAWCALLS_WARN) {
      structureFacts.push(
        `드로우콜 ${num(s.drawCalls)}/인스턴스 (기준 ${MODEL_DRAWCALLS_WARN}, 씬 합계 ${num(s.drawCalls * a.count)})`,
      );
    }
    if (ratio > MODEL_PRIM_TO_MATERIAL_RATIO_WARN) {
      structureFacts.push(
        `드로우콜/머티리얼 ${ratio.toFixed(1)}배 (기준 ${MODEL_PRIM_TO_MATERIAL_RATIO_WARN} — 머티리얼 ${s.materials}개면 join 시 ~${s.materials}콜)`,
      );
    }
    if (s.nodes > MODEL_NODES_WARN) {
      structureFacts.push(`노드 ${num(s.nodes)}개 (기준 ${MODEL_NODES_WARN})`);
    }
    if (structureFacts.length > 0) {
      const action = a.join.eligible
        ? `node scripts/join-static-glb.mjs ${file} → pnpm optimize:glb ${file} (전 씬 역스캔: 차단 참조 없음 — join-static-glb 후보)`
        : `join 불가: ${a.join.reasons.join(' · ')} — 계층 병합 금지, 원 자산 정리로만 개선 가능`;
      push('warn', `${file}: ${structureFacts.join(' · ')}`, action);
    }

    if (mb(s.texVramBytes) > MODEL_TEX_VRAM_WARN_MB) {
      push(
        'warn',
        `${file}: 텍스처 VRAM ${fmtMB(s.texVramBytes)}MB (기준 ${MODEL_TEX_VRAM_WARN_MB}MB, ${s.textures.length}장)`,
        'pnpm optimize:glb 의 resize 상한은 2048 — 이미 그 이하라면 장수·해상도 자체를 텍스처별로 검토',
      );
    }

    if (s.flatTextureCount > 0) {
      push(
        'warn',
        `${file}: 단색 의심 텍스처 ${s.flatTextureCount}장 (≥1024² 인데 파일 ≤${FLAT_TEXTURE_MAX_FILE_KB}KB) — 회수 가능 VRAM ~${fmtMB(s.flatTextureVramBytes)}MB`,
        '축소해도 화면 무손실. 단 resize 스테이지는 GLB 전체 적용이라 텍스처별 개별 처리 필요(일괄 축소 금지 — 정상 텍스처 품질 저하)',
      );
    }

    if (s.renderTris > MODEL_TRIS_WARN) {
      push(
        'warn',
        `${file}: 삼각형 ${num(s.renderTris)}/인스턴스 (기준 ${num(MODEL_TRIS_WARN)})`,
        '모델용 데시메이션 자동 스테이지는 없다(optimize:map 은 지도 전용) — 원 자산에서 감축 검토',
      );
    }

    if (s.hasKtx2) {
      push(
        'warn',
        `${file}: image/ktx2 텍스처 발견 — VRAM 공식(w×h×4×1.33)은 RGBA8 디코드 전제라 부정확(basis 는 GPU 압축 상주)`,
        null,
      );
    }
    if (s.sizeUnknownCount > 0) {
      push(
        'warn',
        `${file}: 크기 미상 텍스처 ${s.sizeUnknownCount}장 — texVRAM 합계가 과소 집계됨`,
        null,
      );
    }
  }

  // 씬 합계 기준 — 지도 포함 전체 부하.
  const sceneChecks = [
    [
      totals.drawCalls,
      SCENE_DRAWCALLS_WARN,
      SCENE_DRAWCALLS_RED,
      `씬 드로우콜 합계 ${num(totals.drawCalls)}`,
      (w) => `기준 ${num(w)}`,
    ],
    [
      totals.renderTris,
      SCENE_RENDER_TRIS_WARN,
      SCENE_RENDER_TRIS_RED,
      `씬 렌더 삼각형 합계 ${num(totals.renderTris)}`,
      (w) => `기준 ${num(w)}`,
    ],
    [
      mb(totals.texVramBytes),
      SCENE_TEX_VRAM_WARN_MB,
      SCENE_TEX_VRAM_RED_MB,
      `씬 텍스처 VRAM 합계 ${fmtMB(totals.texVramBytes)}MB`,
      (w) => `기준 ${w}MB`,
    ],
  ];
  for (const [value, warnAt, redAt, label, fmtLimit] of sceneChecks) {
    if (value > redAt) {
      push(
        'red',
        `${label} (${fmtLimit(redAt)} 초과)`,
        '표에서 최대 기여 자산부터 병합·감축 검토',
      );
    } else if (value > warnAt) {
      push(
        'warn',
        `${label} (${fmtLimit(warnAt)} 초과)`,
        '표에서 최대 기여 자산부터 병합·감축 검토',
      );
    }
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// 출력 — 사람용 모노스페이스 표 / --json 스냅샷
// ─────────────────────────────────────────────────────────────────────────────

function printSceneTable(result, warnings) {
  const { sceneFile, shadows, assets, totals } = result;
  const label = (a) =>
    a.kind === 'map'
      ? `map:${a.path.replace('/maps/', '')}`
      : a.path.replace('/models/', '');

  console.log('');
  console.log(
    bold(
      `═══ ${sceneFile}  (models ${result.assets.filter((a) => a.kind === 'model').reduce((n, a) => n + a.count, 0)} + maps ${result.assets.filter((a) => a.kind === 'map').reduce((n, a) => n + a.count, 0)}, shadows=${shadows}) ═══`,
    ),
  );

  const header = [
    'kind '.padEnd(5),
    '×n'.padStart(3),
    ' file'.padEnd(31),
    'nodes'.padStart(6),
    'drawCalls'.padStart(10),
    'renderTris'.padStart(11),
    'uniqTris'.padStart(10),
    'mats'.padStart(5),
    'tex'.padStart(4),
    'texVRAM(MB)'.padStart(12),
    'file(MB)'.padStart(9),
  ].join(' ');
  console.log(dim(header));
  console.log(dim('─'.repeat(header.length)));

  for (const a of assets) {
    const s = a.stats;
    console.log(
      [
        a.kind.padEnd(5),
        String(a.count).padStart(3),
        ` ${label(a)}`.padEnd(31),
        num(s.nodes).padStart(6),
        num(s.drawCalls * a.count).padStart(10),
        num(s.renderTris * a.count).padStart(11),
        num(s.uniqueTris).padStart(10),
        num(s.materials).padStart(5),
        num(s.textures.length).padStart(4),
        fmtMB(s.texVramBytes).padStart(12),
        fmtMB(s.fileSize).padStart(9),
      ].join(' '),
    );
  }

  console.log(dim('─'.repeat(header.length)));
  console.log(
    bold(
      [
        'TOTAL'.padEnd(5),
        ''.padStart(3),
        ''.padEnd(31),
        ''.padStart(6),
        num(totals.drawCalls).padStart(10),
        num(totals.renderTris).padStart(11),
        num(totals.uniqueTris).padStart(10),
        ''.padStart(5),
        num(totals.textures).padStart(4),
        fmtMB(totals.texVramBytes).padStart(12),
        fmtMB(totals.fileBytes).padStart(9),
      ].join(' '),
    ),
  );
  if (shadows) {
    console.log(
      dim(
        '  * shadows=true: 캐스터 드로우콜은 shadow pass 에서 한 번 더 소모된다 (표는 base pass 기준)',
      ),
    );
  }

  if (warnings.length === 0) {
    console.log(dim('  경고 없음'));
    return;
  }
  console.log('');
  console.log(bold('  WARNINGS'));
  for (const w of warnings) {
    const mark = w.level === 'red' ? red('✖') : yellow('⚠');
    const paint = w.level === 'red' ? red : yellow;
    console.log(`  ${mark} ${paint(w.message)}`);
    if (w.nextAction) console.log(dim(`      다음: ${w.nextAction}`));
  }
}

function toJsonScene(result, warnings) {
  const { sceneFile, shadows, assets, missing, totals } = result;
  return {
    scene: sceneFile,
    shadows,
    totals: {
      placements: totals.placements,
      drawCalls: totals.drawCalls,
      renderTris: totals.renderTris,
      uniqueTris: totals.uniqueTris,
      uniqueVerts: totals.uniqueVerts,
      textures: totals.textures,
      texVramMB: mb(totals.texVramBytes),
      glbFileMB: mb(totals.fileBytes),
    },
    assets: assets.map((a) => ({
      kind: a.kind,
      path: a.path,
      count: a.count,
      nodes: a.stats.nodes,
      meshes: a.stats.meshes,
      primitives: a.stats.primCount,
      drawCallsPerInstance: a.stats.drawCalls,
      renderTrisPerInstance: a.stats.renderTris,
      uniqueTris: a.stats.uniqueTris,
      uniqueVerts: a.stats.uniqueVerts,
      materials: a.stats.materials,
      texVramMB: mb(a.stats.texVramBytes),
      fileMB: mb(a.stats.fileSize),
      flatTextures: a.stats.flatTextureCount,
      textures: a.stats.textures,
      join: a.join,
    })),
    missing,
    warnings,
  };
}

const results = [];
for (const sceneFile of targetScenes) {
  let result;
  try {
    result = await analyzeScene(sceneFile);
  } catch (error) {
    // 손상 씬 JSON 등 — 게이트가 아니므로 보고만 하고 계속 간다.
    console.error(`씬 분석 실패: ${sceneFile} — ${error.message}`);
    continue;
  }
  const warnings = buildWarnings(result);
  results.push({ result, warnings });
  if (!jsonMode) printSceneTable(result, warnings);
}

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        thresholds: {
          MODEL_DRAWCALLS_WARN,
          MODEL_PRIM_TO_MATERIAL_RATIO_WARN,
          SCENE_DRAWCALLS_WARN,
          SCENE_DRAWCALLS_RED,
          SCENE_TEX_VRAM_WARN_MB,
          SCENE_TEX_VRAM_RED_MB,
          MODEL_TEX_VRAM_WARN_MB,
          MODEL_TRIS_WARN,
          SCENE_RENDER_TRIS_WARN,
          SCENE_RENDER_TRIS_RED,
          MODEL_NODES_WARN,
          FLAT_TEXTURE_MIN_PIXELS,
          FLAT_TEXTURE_MAX_FILE_KB,
          MIPMAP_OVERHEAD,
        },
        scenes: results.map(({ result, warnings }) =>
          toJsonScene(result, warnings),
        ),
      },
      null,
      2,
    ),
  );
} else if (results.length > 0) {
  const warnCount = results.reduce((n, r) => n + r.warnings.length, 0);
  console.log('');
  console.log(
    dim(
      `씬 ${results.length}개 · 경고 ${warnCount}건 — 진단 전용이며 exit code 는 항상 0 이다 (2026-09-01 성능 게이트 폐기 결정).`,
    ),
  );
}

process.exitCode = 0; // 게이트 아님 — 어떤 경고·누락에도 실패로 끝내지 않는다.
