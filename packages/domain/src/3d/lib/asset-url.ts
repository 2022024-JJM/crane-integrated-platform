/**
 * 3D 에셋(glb/glTF) 경로에 Vite BASE_URL 과 콘텐츠 해시를 씌워준다.
 *
 * 저장된 scene JSON이나 catalog 엔트리는 '/maps/okpo.glb' 처럼 base 를 모르는
 * 절대 경로를 쓰는데, sub-path 배포(/crane_rnd/)에서는 그대로 fetch 하면 404 가
 * 난다. 모든 loader 호출(useGLTF, useGLTF.preload, GLTFLoader.load) 직전에
 * 이 함수를 통과시켜 /crane_rnd/maps/okpo.glb 형태로 정규화한다.
 *
 * 여기에 더해, 매니페스트에 등록된 파일이면 `?v=<내용해시>` 를 붙인다.
 * public/ 의 GLB 는 파일명이 고정이라 모델을 교체 배포해도 URL 이 그대로고,
 * 그래서 브라우저·앞단 프록시가 옛 파일을 계속 쓰는 일이 생긴다. 내용이
 * 바뀐 파일만 URL 이 바뀌므로 그 파일만 다시 받는다.
 *
 * - 원격 URL(http/https/프로토콜 상대) 은 건드리지 않는다.
 * - 이미 base prefix 로 시작하면 중복 적용하지 않는다.
 * - BASE_URL 이 '/' 거나 비어 있으면 base 는 생략하되 해시는 붙인다.
 */

/**
 * 앱(shell)이 빌드 타임 매니페스트를 주입한다. 도메인 패키지는 특정 앱의
 * 가상 모듈을 import 할 수 없으므로(의존 방향이 뒤집힌다) 등록 방식을 쓴다.
 * 주입 전이거나 매니페스트에 없는 경로는 해시 없이 동작한다 — 캐시 무효화가
 * 안 될 뿐, 경로는 항상 유효하다.
 */
let assetHashManifest: Record<string, string> = {};

export function registerAssetHashManifest(
  manifest: Record<string, string>,
): void {
  assetHashManifest = manifest;
}

/**
 * 매니페스트 조회용 키를 만든다. 키는 public 기준 절대 경로(`/models/x.glb`)
 * 이므로, base 가 이미 붙어 있거나 쿼리·프래그먼트가 달린 입력은 벗겨낸다.
 */
function toManifestKey(rawPath: string, base: string): string {
  const withoutQuery = rawPath.split(/[?#]/)[0];

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const stripped =
    normalizedBase && withoutQuery.startsWith(`${normalizedBase}/`)
      ? withoutQuery.slice(normalizedBase.length)
      : withoutQuery;

  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/**
 * 이미 쿼리가 있으면 &, 없으면 ? 로 붙인다. 프래그먼트는 항상 맨 뒤로 간다.
 *
 * 이 함수는 **멱등**이어야 한다. withBaseUrl 의 결과가 다시 withBaseUrl 로
 * 들어오는 경로가 실제로 있는데(gltf-cache-release 의 preload/clear 는
 * withBaseUrl(path) 를 drei 캐시 **키**로 쓴다), 두 번 통과하면서 `?v=x&v=x`
 * 가 되면 preload 때와 clear 때의 키가 달라진다. 그러면 clear 가 아무것도
 * 못 지우고 25MB GLB 가 캐시에 영구히 남는다.
 */
function appendVersion(url: string, hash: string): string {
  const [beforeHash, fragment] = url.split('#');

  // 같은 v 가 이미 붙어 있으면 그대로 둔다.
  const existing = beforeHash.match(/[?&]v=([^&]*)/);
  if (existing) {
    // 다른 해시가 붙어 있다면(옛 매니페스트로 만든 URL 등) 최신 값으로 교체한다.
    const corrected =
      existing[1] === hash
        ? beforeHash
        : beforeHash.replace(/([?&])v=[^&]*/, `$1v=${hash}`);
    return fragment === undefined ? corrected : `${corrected}#${fragment}`;
  }

  const separator = beforeHash.includes('?') ? '&' : '?';
  const versioned = `${beforeHash}${separator}v=${hash}`;
  return fragment === undefined ? versioned : `${versioned}#${fragment}`;
}

export function withBaseUrl(rawPath: string): string {
  if (!rawPath) return rawPath;
  if (/^(https?:)?\/\//i.test(rawPath)) return rawPath;
  if (rawPath.startsWith('blob:') || rawPath.startsWith('data:')) return rawPath;

  const base = import.meta.env.BASE_URL ?? '/';

  const hash = assetHashManifest[toManifestKey(rawPath, base)];
  const applyHash = (url: string) => (hash ? appendVersion(url, hash) : url);

  if (base === '/' || base === '') return applyHash(rawPath);
  if (rawPath.startsWith(base)) return applyHash(rawPath);

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return applyHash(`${normalizedBase}${normalizedPath}`);
}
