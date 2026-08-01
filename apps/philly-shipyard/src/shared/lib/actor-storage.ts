/**
 * 마지막 작업자(입출고·부품 기록의 '담당자') 기억 — 같은 사람이 단말에서
 * 연속으로 기록하는 흐름이 대부분이라, 매번 이름을 다시 타이핑하지 않게 한다.
 * ticket의 lastAssignee(배정 대상)와 의미가 달라 별도 키로 분리.
 */
const LAST_ACTOR_KEY = 'mro:lastActor';

export function loadLastActor(): string {
  try {
    return localStorage.getItem(LAST_ACTOR_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastActor(name: string): void {
  if (!name.trim()) return;
  try {
    localStorage.setItem(LAST_ACTOR_KEY, name);
  } catch {
    // storage 불가 환경(사파리 프라이빗 등)은 조용히 무시
  }
}
