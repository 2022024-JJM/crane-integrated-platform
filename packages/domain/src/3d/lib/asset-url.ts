/**
 * 3D 에셋(glb/glTF) 경로에 Vite BASE_URL 을 씌워준다.
 *
 * 저장된 scene JSON이나 catalog 엔트리는 '/maps/okpo.glb' 처럼 base 를 모르는
 * 절대 경로를 쓰는데, sub-path 배포(/crane_rnd/)에서는 그대로 fetch 하면 404 가
 * 난다. 모든 loader 호출(useGLTF, useGLTF.preload, GLTFLoader.load) 직전에
 * 이 함수를 통과시켜 /crane_rnd/maps/okpo.glb 형태로 정규화한다.
 *
 * - 원격 URL(http/https/프로토콜 상대) 은 건드리지 않는다.
 * - 이미 base prefix 로 시작하면 중복 적용하지 않는다.
 * - BASE_URL 이 '/' 거나 비어 있으면 원본을 그대로 반환한다.
 */
export function withBaseUrl(rawPath: string): string {
  if (!rawPath) return rawPath;
  if (/^(https?:)?\/\//i.test(rawPath)) return rawPath;
  if (rawPath.startsWith('blob:') || rawPath.startsWith('data:')) return rawPath;

  const base = import.meta.env.BASE_URL ?? '/';
  if (base === '/' || base === '') return rawPath;
  if (rawPath.startsWith(base)) return rawPath;

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${normalizedBase}${normalizedPath}`;
}
