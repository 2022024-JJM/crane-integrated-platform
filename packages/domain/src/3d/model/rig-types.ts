/**
 * 리깅(관절 연동) 스키마.
 *
 * 태그 매핑(valueMapList)이 "모델 루트의 한 축에 서버 값을 절대 대입"하는
 * 것이라면, 리그는 "GLB 내부 노드를 관절로 선언하고 rest pose 기준으로
 * 상대 구동"하는 계층이다. 정의(RigDefinition)는 자산 단위라 씬 상위
 * `rigs[]`에 두고, 같은 GLB를 여러 번 배치해도 한 번만 정의한다. 인스턴스는
 * `rigId`로 정의를 가리키고, 서버 태그를 꽂는 `rigBindings`만 따로 가진다.
 *
 * 노드 경로는 mesh-path.ts 의 `[index]name/[index]name` 형식 그대로다 —
 * Blender export 는 Empty 와 Mesh 가 같은 이름을 쓰는 일이 흔해서 이름만으로는
 * 노드를 특정할 수 없다.
 */

/** 모델 clone root 기준 노드 경로(mesh-path.ts 형식). '' 는 root 자신. */
export type RigNodePath = string;

export type RigAxis = 'x' | 'y' | 'z';
export const RIG_AXES = ['x', 'y', 'z'] as const satisfies readonly RigAxis[];

/**
 * - hinge: 노드 로컬 축을 중심으로 회전. 값 단위 deg. `q = rest ∘ axisAngle(axis, v)`
 * - slide: 노드 로컬 축 방향 평행이동. 값 단위 m(월드 미터). 부모 scale 체인을
 *   나눠 로컬 단위로 환산한다.
 */
export type RigJointType = 'hinge' | 'slide';
export const RIG_JOINT_TYPES = [
  'hinge',
  'slide',
] as const satisfies readonly RigJointType[];

export type RigJointUnit = 'deg' | 'm';

export interface RigJoint {
  /** 리그 안에서 고유. 바인딩·구속조건이 이 id 로 참조한다. */
  id: string;
  label?: string;
  node: RigNodePath;
  type: RigJointType;
  axis: RigAxis;
  /** 값 한계. 생략 시 무제한. 둘 다 있으면 min <= max 가 보장된다(sanitize). */
  min?: number;
  max?: number;
  /** 축 방향 뒤집기. 생략 시 1. */
  sign?: 1 | -1;
}

/**
 * 선형 연동 — 디자이너가 주는 "파생 노드 = 입력 노드 값 × 계수" 형태의 공식.
 * 출력 관절은 **driven(구동됨)** 이 되어 슬라이더·태그 입력을 받지 않고, 매
 * 프레임 `input * factor + offset` 으로 계산된 값을 받는다. 출력 관절의
 * min/max·sign 은 그대로 적용된다. 구속조건은 배열 순서대로 계산하므로 앞
 * 항목의 출력이 뒤 항목의 입력이 될 수 있다(체인).
 */
export interface RigLinearConstraint {
  type: 'linear';
  id: string;
  label?: string;
  /** 입력 관절 id. driven 관절도 될 수 있다(체인). */
  input: string;
  /** 출력 관절 id — 이 관절은 driven 이 된다. 한 관절은 한 구속조건의 출력만 된다. */
  output: string;
  /** output = input * factor + offset. 무단위. */
  factor: number;
  offset?: number;
}

/**
 * 구속조건 discriminated union. 지금은 `linear` 하나지만 후속 타입(와이어 방향·
 * 길이 등)을 붙일 자리로 union 을 유지한다. 문자열 수식 eval 은 넣지 않는다.
 */
export type RigConstraint = RigLinearConstraint;

export type RigConstraintType = RigConstraint['type'];
export const RIG_CONSTRAINT_TYPES = [
  'linear',
] as const satisfies readonly RigConstraintType[];

export interface RigDefinition {
  id: string;
  name: string;
  /** 이 리그가 전제하는 GLB 경로(카탈로그 path). 노드 경로가 이 파일 기준이다. */
  modelPath: string;
  joints: RigJoint[];
  constraints: RigConstraint[];
}

/**
 * 관절 ← 서버 태그 바인딩. ValueMapItem 과 같은 모양이라 사용자가 새로 배울
 * 것이 없다. 적용 공식: joint = offset + value * scale (joint 값은 rest 기준 Δ).
 * driven 관절에는 바인딩할 수 없다(sanitize 가 버린다).
 * 이번 단계(수동 조작)에서는 저장만 하고 런타임 소스는 켜지 않는다.
 */
export interface RigBinding {
  jointId: string;
  /** `${craneId}:${tagCode}` — valueMapList 키와 같은 공간. */
  key: string;
  scale?: number;
  offset?: number;
}

export function getRigJointUnit(type: RigJointType): RigJointUnit {
  return type === 'hinge' ? 'deg' : 'm';
}

/**
 * 구속조건의 출력인 관절 id 집합 = driven 관절. 스키마 필드가 아니라 유추라
 * UI·드라이버·sanitize 가 어긋날 수 없다.
 */
export function getDrivenJointIds(rig: RigDefinition): Set<string> {
  const out = new Set<string>();
  for (const constraint of rig.constraints) {
    out.add(constraint.output);
  }
  return out;
}

/** hinge 기본 슬라이더 범위(deg). 한계가 없을 때 UI 가 쓰는 표시용 값. */
export const RIG_HINGE_DEFAULT_RANGE = { min: -180, max: 180 } as const;
/** slide 기본 슬라이더 범위(m). */
export const RIG_SLIDE_DEFAULT_RANGE = { min: -50, max: 50 } as const;
