/**
 * 상태 태그 — "모델의 상태 역할 하나 ← 서버(PLC) 상태 비트 하나".
 *
 * 태그 맵핑(tag-mapping-types.ts)이 값으로 노드를 **움직인다면**, 상태 태그는
 * 값으로 라벨을 **칠한다**(운전 상태 색·아이콘). 태그는 `tagKey` 문자열로만
 * 참조하고 키 공간(`${craneId}:${tagCode}`)이 맵핑과 같아, 가상 태그·리플레이·
 * 실서버 어느 소스로도 같은 판정이 나온다.
 *
 * 값은 0/1 숫자다 — 버스가 숫자 전용이라 boolean 은 입구에서 바뀌어 들어온다
 * (`@crane/domain/monitoring` toTagNumber). on/off 문턱과 판정 우선순위는
 * features/3d lib/model-label-state.ts.
 *
 * - controlOn: 운전 전원. 멈춘 장비가 켜져 있는지 꺼져 있는지를 가른다.
 * - fault: 고장.
 * - bypass: 충돌방지 우회(충돌방지가 꺼진 상태).
 * - freeSwing: 자유선회.
 */
export const STATUS_TAG_ROLES = [
  'controlOn',
  'fault',
  'bypass',
  'freeSwing',
] as const;

export type StatusTagRole = (typeof STATUS_TAG_ROLES)[number];

/** 역할 → 값 버스 키. 연결하지 않은 역할은 키 자체가 없다. */
export type ModelStatusTags = Partial<Record<StatusTagRole, string>>;
