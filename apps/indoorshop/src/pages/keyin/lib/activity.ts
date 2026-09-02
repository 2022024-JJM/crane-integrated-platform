import type { Activity } from '../model/types';

/** 얕은 복제 — upd 콜백이 안전하게 변형할 수 있는 사본 */
export function cloneActivity(it: Activity): Activity {
  return { ...it, wos: it.wos.map((w) => ({ ...w })) };
}

/** 하위 WO 전체 완료 여부 */
export function actDone(it: Activity): boolean {
  return it.wos.every((w) => w.done);
}

/** 사용자 확인·수정이 있었는가 (자동수신 상태 그대로면 미확인) */
export function actEntered(it: Activity): boolean {
  return (
    it.confirmed ||
    it.edited != null ||
    it.wos.some((w) => w.done !== w.autoDone)
  );
}

/** 액티비티 작업 완료 여부: 하위 WO 전체 완료 (조립·의장은 실적률 100% 입력도 완료로 간주) */
export function actComplete(it: Activity): boolean {
  const pct = it.proc === '조립' || it.proc === '의장';
  const v = it.edited != null ? it.edited : it.auto;
  return actDone(it) || (pct && v != null && v >= 100);
}

/** 입력 상태 키 — 제출 스냅샷과 비교해 수정 여부 판정 */
export function actKey(it: Activity): string {
  return JSON.stringify([
    !!it.confirmed,
    it.edited,
    it.wos.map((w) => (w.done ? 1 : 0)),
  ]);
}

/** 제출 후 수정되었거나, 미제출 상태에서 입력이 있는가 (타일 붉은 점·제출 건수) */
export function actModified(it: Activity): boolean {
  return it.sub ? actKey(it) !== it.sub.key : actEntered(it);
}

/** 스냅샷 키 파싱 결과 — [confirmed, edited, wos done] */
type SnapshotKey = [boolean, number | null, number[]];

/**
 * 변경 건수(세분화): 마지막 제출(없으면 자동수집 원본) 대비
 * WO 완료 토글 1건씩 + 실적률 값 확인·수정 1건
 */
export function actChangeN(it: Activity): number {
  const base: SnapshotKey = it.sub
    ? (JSON.parse(it.sub.key) as SnapshotKey)
    : [false, null, it.wos.map((w) => (w.autoDone ? 1 : 0))];
  let n = 0;
  it.wos.forEach((w, i) => {
    if ((w.done ? 1 : 0) !== (base[2][i] || 0)) n++;
  });
  if (!!it.confirmed !== !!base[0] || it.edited !== base[1]) n++;
  return n;
}

/** 제출 완료된 상태가 '전체 완료'인가 — 이후 수정은 다음 제출 전까지 탭 이동에 영향 없음 */
export function actSubmittedDone(it: Activity): boolean {
  return !!(it.sub && it.sub.done);
}

/** 수정 취소: 마지막 제출 상태(없으면 자동수집 원래 상태)로 복원한 사본 반환 */
export function actRevert(it: Activity): Activity {
  const x = cloneActivity(it);
  if (x.sub) {
    const k = JSON.parse(x.sub.key) as SnapshotKey;
    x.confirmed = !!k[0];
    x.edited = k[1];
    x.wos.forEach((w, i) => {
      w.done = !!k[2][i];
    });
  } else {
    x.confirmed = false;
    x.edited = null;
    x.wos.forEach((w) => {
      w.done = w.autoDone;
    });
  }
  return x;
}

/** 미확인 액티비티 수 = 제출된 상태가 '전체 완료'가 아닌 액티비티 */
export function waitOf(arr: Activity[]): number {
  return arr.filter((it) => !actSubmittedDone(it)).length;
}

/** 미제출(수정됨) 액티비티 수 — 타일 붉은 점 표시용 */
export function pendingOf(arr: Activity[]): number {
  return arr.filter((it) => actModified(it)).length;
}

/**
 * 카드 정렬 우선순위 — 입력 필요(미확인·작성중) 먼저, 자동수집 완료·확정은 뒤로.
 * 순서는 블록 진입 시점에 고정해 사용한다 (입력 중 재정렬 방지).
 */
export function orderOf(it: Activity): number {
  if (actSubmittedDone(it)) return 3;
  if (actModified(it)) return 1;
  return it.auto != null ? 2 : 0;
}

/** 블록 진입 시점의 카드 순서 (id 배열) */
export function frozenOrder(list: Activity[]): string[] {
  return list
    .slice()
    .sort((a, b) => orderOf(a) - orderOf(b))
    .map((x) => x.id);
}

/** WO 이름에서 작업유형 추출 — "취부 — 부재 04101P01" → "취부" */
export function woTypeOf(name: string): string {
  return name.split(' — ')[0];
}
