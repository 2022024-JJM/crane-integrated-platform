const LAST_ASSIGNEE_KEY = 'ticket:lastAssignee';

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
