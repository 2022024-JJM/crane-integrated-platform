/**
 * 씬 객체(GLB) 로드 실패 재시도 지연(ms) — 서버 순단·늦게 뜬 백엔드를
 * 겨냥한다. 횟수가 다하면 그 객체는 새로 고침 전까지 빠진 채로 둔다(무한
 * 재시도는 404 를 영원히 두드린다). ui/scene-object-boundary.tsx 가 쓴다.
 */
export const OBJECT_RETRY_DELAYS_MS = [5_000, 15_000, 45_000] as const;
