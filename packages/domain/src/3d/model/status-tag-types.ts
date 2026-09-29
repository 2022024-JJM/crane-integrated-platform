/**
 * 상태 태그 — "모델의 상태 역할 하나 ← 서버(PLC) 상태 비트 하나".
 *
 * 태그 맵핑(tag-mapping-types.ts)이 값으로 노드를 **움직인다면**, 상태 태그는
 * 값으로 라벨을 **칠하고**(운전 상태 색·아이콘) 장비에 **외곽선을 두른다**.
 * 태그는 `tagKey` 문자열로만 참조하고 키 공간(`${craneId}:${tagCode}`)이 맵핑과
 * 같아, 가상 태그·리플레이·실서버 어느 소스로도 같은 판정이 나온다.
 *
 * 값은 0/1 숫자다 — 버스가 숫자 전용이라 boolean 은 입구에서 바뀌어 들어온다
 * (`@crane/domain/monitoring` toTagNumber). on/off 문턱과 판정 우선순위는
 * features/3d lib/model-label-state.ts(라벨)·lib/model-outline-state.ts(외곽선).
 *
 * 라벨:
 * - controlOn: 운전 전원. 멈춘 장비가 켜져 있는지 꺼져 있는지를 가른다.
 * - fault: 고장.
 * - bypass: 충돌방지 우회(충돌방지가 꺼진 상태).
 * - freeSwing: 자유선회.
 *
 * 외곽선:
 * - commError: 통신불량. 장비 PLC 와 연계 PLC 사이 통신이 끊겼다는 비트 —
 *   서버는 계속 값을 주지만 그 값이 장비의 지금 상태가 아니다.
 * - slowdown: 충돌방지 Slowdown 구간에 들어와 있다.
 * - endstop: 충돌방지 Endstop 구간에 들어와 있다.
 */
export const STATUS_TAG_ROLES = [
  'controlOn',
  'fault',
  'bypass',
  'freeSwing',
  'commError',
  'slowdown',
  'endstop',
] as const;

export type StatusTagRole = (typeof STATUS_TAG_ROLES)[number];

/** 외곽선을 정하는 역할 — 편집 UI 가 라벨 역할과 묶음을 나눠 보인다. */
export const OUTLINE_STATUS_TAG_ROLES = [
  'commError',
  'slowdown',
  'endstop',
] as const satisfies readonly StatusTagRole[];

export type OutlineStatusTagRole = (typeof OUTLINE_STATUS_TAG_ROLES)[number];

/** 라벨의 색·아이콘을 정하는 역할 — 외곽선 역할을 뺀 나머지. */
export const LABEL_STATUS_TAG_ROLES = STATUS_TAG_ROLES.filter(
  (role): role is Exclude<StatusTagRole, OutlineStatusTagRole> =>
    !(OUTLINE_STATUS_TAG_ROLES as readonly StatusTagRole[]).includes(role),
);

/** 역할 → 값 버스 키. 연결하지 않은 역할은 키 자체가 없다. */
export type ModelStatusTags = Partial<Record<StatusTagRole, string>>;
