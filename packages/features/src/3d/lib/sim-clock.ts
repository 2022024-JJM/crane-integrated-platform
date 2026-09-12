/**
 * 시뮬레이션 시계 표시 — 경과 ms → `mm:ss`. ui 파일에 두면 react-refresh
 * 규칙(컴포넌트 파일의 함수 export)에 걸려 lib 로 뺐다(scene-shadow.ts 선례).
 * 음수·NaN 은 00:00, 60분 이상은 분이 두 자리를 넘겨 그대로 커진다.
 */
export function formatSimClock(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
