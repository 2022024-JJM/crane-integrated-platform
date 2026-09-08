/*
 * 화면 문구의 **용어 사전** (W7-6D).
 *
 * 같은 것을 화면마다 다르게 부르고 있었다 — 조립 카드는 '판별', 그 옆 지도 패널은 '감지',
 * 통합실적 추이 타일은 '인식', 공장 화면은 '판정'. 넷 다 **같은 행위**(우리 시스템이 절점을
 * 판정한 것)를 가리켰고, 사용자는 그것이 네 가지 다른 지표라고 읽을 수밖에 없었다.
 *
 * 그래서 낱말을 줄인다. 규칙은 셋이다:
 *
 *   판별 — **우리 시스템이 절점을 판정한 행위와 그 결과 수치.** 실적·집계·상태 라벨은
 *          전부 이 낱말을 쓴다(W5-7 축의 공식 용어).
 *   수집 — **원천 데이터가 들어온 것.** 무엇이 들어왔나·언제 들어왔나를 말하는 자리
 *          (수집 현황·최근 수집·자동수집). 판별 이전 단계다.
 *   인식 — **센서·알고리즘이 원시 데이터에서 대상을 알아본 기술적 동작.** 실적을 세는
 *          자리에는 쓰지 않는다. 아래 예외 목록의 세 자리에서만 남는다.
 *
 * '감지'·'판정'은 화면에서 **완전히 걷어낸다** — 판별과 뜻이 겹치는데 낱말만 다르다.
 *
 * ⚠️ 이 사전은 **화면에 보이는 문자열**에만 적용된다. 코드 식별자(`detected`·`judged`),
 *    주석, 도면·레거시 필드 이름(YPWG413M 등)은 대상이 아니다 — 그것들은 사용자가
 *    읽지 않고, 원천의 이름을 우리 편의로 바꾸면 대조가 끊긴다.
 *
 * 검사는 `__tests__/glossary.test.ts` 가 i18n 트리의 **값**을 전수로 훑어서 한다.
 */

/** 화면 문구에서 쓰지 않는 낱말과, 대신 쓸 낱말 */
export interface BannedTerm {
  /** 금지 낱말 (ko) */
  term: string
  /** 대신 쓸 낱말 */
  useInstead: string
  /** 왜 금지인가 — 실패 메시지에 그대로 실린다 */
  why: string
  /**
   * 이 낱말이 남아도 되는 **i18n 키 경로**. 비어 있으면 예외 없이 금지.
   * 경로는 로케일 트리의 점 표기(`assembly.viewer.detectedBlocks.confidence`)다.
   */
  allowedPaths: readonly string[]
}

export const BANNED_TERMS: readonly BannedTerm[] = [
  {
    term: '감지',
    useInstead: '판별(우리 판정) 또는 수집(원천 유입)',
    why: '판별과 뜻이 겹치는데 낱말만 다르다 — 같은 수치가 화면마다 다른 지표로 읽힌다',
    allowedPaths: [],
  },
  {
    term: '판정',
    useInstead: '판별',
    why: "판별의 동의어다. 축의 공식 용어는 '판별' 하나로 둔다",
    allowedPaths: [],
  },
  {
    term: '인식',
    useInstead: '판별',
    why: '실적을 세는 자리에서는 판별과 같은 뜻이다 — 센서의 기술적 동작을 서술할 때만 남긴다',
    allowedPaths: [
      /* 정합 알고리즘이 낸 신뢰도 — 판별 이전, 센서·정합 쪽 품질값이다 */
      'blocks.confidence',
      /* 판별로 올라가지 **못한** 원시 관측 — 도면 매핑이 없어 식별이 안 붙은 것 */
      'assembly.bayIdentity.unmatchedTitle',
      /* OCR 은 기술 이름이다 — '판별' 로 바꾸면 무슨 기술인지 사라진다 */
      'zoneDetail.planItems.ocr',
    ],
  },
]

/**
 * 설비 종류의 **화면 이름**은 한 낱말로 — Network Panel / 판넬 / 캐비닛 / 패널 4중 명칭을
 * 걷어낸 결과(W7-6D). 결정과 근거는 `entities/equipment/ui/typeLabel.ts` 주석에 있다.
 *
 * 여기서는 화면에 **되살아나면 안 되는 이름**만 잠근다.
 */
export const BANNED_EQUIPMENT_NAMES: readonly BannedTerm[] = [
  {
    term: '캐비닛',
    useInstead: '판넬',
    why: '코드가 만든 파생 개념어(판넬+Edge PC)다 — 화면에 내면 없는 설비 종류를 찾게 된다',
    allowedPaths: [],
  },
  {
    term: 'Network Panel',
    useInstead: '판넬 (equipment.type.PNL)',
    why: '도면의 이름이다. 데이터는 지키되 화면은 현장 호칭을 쓴다',
    allowedPaths: [],
  },
]

/**
 * i18n 트리를 평평한 `{경로: 문자열}` 로 편다.
 *
 * **값만** 본다 — 키 이름(`detected`)과 주석은 사용자가 읽지 않으므로 사전의 대상이 아니다.
 */
export function flattenMessages(
  tree: unknown,
  prefix = ''
): { path: string; value: string }[] {
  if (typeof tree === 'string') return [{ path: prefix, value: tree }]
  if (tree == null || typeof tree !== 'object') return []
  const out: { path: string; value: string }[] = []
  for (const [key, child] of Object.entries(tree as Record<string, unknown>)) {
    out.push(...flattenMessages(child, prefix ? `${prefix}.${key}` : key))
  }
  return out
}

/** 사전을 어긴 자리 한 곳 */
export interface GlossaryViolation {
  path: string
  value: string
  term: string
  useInstead: string
  why: string
}

/** 사전 위반 전수 — 빈 배열이면 통과 */
export function findGlossaryViolations(
  tree: unknown,
  terms: readonly BannedTerm[]
): GlossaryViolation[] {
  const violations: GlossaryViolation[] = []
  for (const { path, value } of flattenMessages(tree)) {
    for (const rule of terms) {
      if (!value.includes(rule.term)) continue
      if (rule.allowedPaths.includes(path)) continue
      violations.push({
        path,
        value,
        term: rule.term,
        useInstead: rule.useInstead,
        why: rule.why,
      })
    }
  }
  return violations
}
