/**
 * ISO 8601 duration ("PT5S", "PT1M30S") 또는 단순형 ("5s", "1m") 문자열을
 * 밀리초(ms)로 변환한다.
 *
 * 파싱에 실패하면 기본값 5000ms를 반환한다.
 */
export function parseIntervalToMs(interval: string): number {
  // ISO 8601: PT5S, PT1M, PT1M30S
  const isoMatch = interval.match(/^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (isoMatch) {
    const minutes = parseInt(isoMatch[1] ?? '0', 10);
    const seconds = parseFloat(isoMatch[2] ?? '0');
    return (minutes * 60 + seconds) * 1000;
  }

  // 단순형: 5s, 30s, 1m
  const simpleMatch = interval.match(/^(\d+(?:\.\d+)?)(s|m)$/);
  if (simpleMatch) {
    const value = parseFloat(simpleMatch[1]);
    return simpleMatch[2] === 'm' ? value * 60_000 : value * 1_000;
  }

  return 5_000;
}
