const LAST_ASSIGNEE_KEY = 'ticket:lastAssignee';
const LAST_REQUESTER_KEY = 'ticket:lastRequester';

export function loadLastAssignee(): string {
  try {
    return localStorage.getItem(LAST_ASSIGNEE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastAssignee(name: string): void {
  if (!name.trim()) return;
  try {
    localStorage.setItem(LAST_ASSIGNEE_KEY, name);
  } catch {
    // storage 불가 환경(사파리 프라이빗 등)은 조용히 무시
  }
}

// 부품 요청자 — 배정 대상(assignee)과 의미가 달라 별도 키. 같은 사람이
// 연달아 요청을 올리는 흐름이라 최근값이 곧 기본값이다.
export function loadLastRequester(): string {
  try {
    return localStorage.getItem(LAST_REQUESTER_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastRequester(name: string): void {
  if (!name.trim()) return;
  try {
    localStorage.setItem(LAST_REQUESTER_KEY, name);
  } catch {
    // storage 불가 환경은 조용히 무시
  }
}
