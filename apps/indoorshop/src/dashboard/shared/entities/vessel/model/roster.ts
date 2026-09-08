import type { AssyPlacement, AssyScanFact, RosterBlock, Vessel } from './types'

/**
 * 호선·블록 로스터 — **이 레포 mock 우주의 정본**. 블록은 여기 한 번만 적는다.
 *
 * 성질:
 *  - **CAD 실측 블록은 손대지 않는다.** 2540-281·2543-642·2570-153·4391-154·4392-133 은
 *    `public/models/{projNo}_{blockNo}.{json,bin}` 파일명이 곧 키인 실제 FBX 전처리
 *    산출물이다 — 번호를 바꾸면 형상 로딩이 깨진다. 그래서 이 다섯이 우주의 고정점이고,
 *    나머지 호선·블록을 그 옆에 붙였다.
 *  - **통합실적의 기존 데모 블록(7004·7012·8103)도 그대로 둔다.** 생성기가 `projNo-blockNo`
 *    를 시드로 쓰므로 번호를 바꾸면 화면의 모든 수치가 흔들리고, 기존 계약 테스트도
 *    깨진다. 합치되 옮기지 않는다.
 *  - 블록번호는 **호선 안에서만** 유일하다 (실제 채번 규칙과 같다).
 *  - 이 파일은 데이터만 둔다 — 조회는 `lib/roster.ts`.
 *
 * ⚠️ 공장 id(`asm-*`/`ofit-*`)와 구역 코드는 각 공정의 공장 fixture 값과 **같은 문자열**
 * 이어야 한다. shared 는 processes 를 import 할 수 없으므로(모듈 경계) 여기서는 문자열
 * 계약으로만 잇고, 어긋나면 각 공정 쪽 테스트가 잡는다.
 */

/** 호선 — CAD 실측 5척 + 통합실적 데모 3척 */
export const VESSELS: readonly Vessel[] = [
  { projNo: '2540', shipType: 'LNGC' },
  { projNo: '2543', shipType: 'LNGC' },
  { projNo: '2570', shipType: 'VLCC' },
  { projNo: '4391', shipType: 'CONT' },
  { projNo: '4392', shipType: 'CONT' },
  { projNo: '7004', shipType: 'LNGC' },
  { projNo: '7012', shipType: 'LNGC' },
  { projNo: '8103', shipType: 'VLCC' },
  /* 실측 스캔 호선 — PBS 5BAY LiDAR 12대 데이터셋(20251220)의 블록들이 이 호선 소속이다 */
  { projNo: '5510', shipType: 'LNGC' },
]

/** 도장 BTS 귀속 후보 — 야드 도장공장 이름 체계(지도 공장 키와 동일, `?shop=` 딥링크 계약) */
export const PAINTING_FACTORIES: readonly string[] = [
  '1DOCK 도장공장',
  '2DOCK 도장공장',
  '느태 도장공장',
  '텍사코 도장공장',
  'GPS',
]

/** 정반 배치 한 줄을 짧게 적기 위한 도우미 (읽는 쪽 문법은 그대로 RosterBlock) */
const berth = (
  factoryId: string,
  bayNo: number,
  unitLevel: 'assembly' | 'block',
  hasCadModel = false
) => ({ factoryId, bayId: `${factoryId}-b${bayNo}`, unitLevel, hasCadModel })


/* ── ASSY 구성 (블록의 BOM 트리 + 그 덩이들의 소재) ──────────────────────
 *
 * 여기 적히는 것은 두 가지다.
 *
 * **① 구성** — 소조는 중조에, 중조는 대조에 들어간다(`parentAssyNo`). 예전에는 이
 * 목록이 급(G/M/S)만 있는 **평평한 명단**이었고, 통합실적 생성기가 같은 블록의 계층을
 * 해시로 따로 합성했다 — 지도가 아는 구성과 실적 카드가 그리는 트리의 근거가 서로
 * 달랐다. 이제 트리의 정본이 여기 하나이고, 생성기는 로스터에 트리가 있으면 그대로
 * 쓴다(`features/performance` 쪽 계약 테스트가 부모 관계까지 대조해 잠근다).
 *
 * **② 소재** — 조립 중인 블록은 한 자리에 없다. 소조 공장에서 소조를 붙여 중조 공장으로
 * 보내고, 대조 정반에서 합친다. 그래서 "이 블록 어디 있어요"의 답이 여러 점이고 지도도
 * 그렇게 그린다.
 *
 * 채번은 **급별 일련번호**다 — `G01·G02` / `M01·M02` / `S01·S02…`(ASSY_STRC_CODE +
 * ASSY_SER_NO). 예전의 전역 통번(`G01·M02·S03…`)은 한 블록의 소조가 `S03` 부터 시작해
 * 현장 채번처럼 읽히지 않았다. 실측 블록만 예외다(아래 — 데이터셋의 실채번이 이긴다).
 */

const asm = (
  assyNo: string,
  tier: AssyPlacement['tier'],
  parentAssyNo: string | null,
  factory: string,
  mapBay?: string,
  berthOf?: [factoryId: string, bayNo: number]
): AssyPlacement => ({
  assyNo,
  tier,
  parentAssyNo,
  zone: 'assembly',
  factory,
  mapBay,
  berth: berthOf ? { factoryId: berthOf[0], bayId: `${berthOf[0]}-b${berthOf[1]}` } : undefined,
})

/**
 * 7004-222 — 조립 중, 다섯 공장에 흩어져 있다(가장 넓게 퍼진 표본).
 * 대조 하나가 중조 둘을 거느리고, 중조마다 소조 둘이 다른 공장에서 올라온다.
 */
const SCATTER_222: readonly AssyPlacement[] = [
  asm('7004-222-G01', 'grand', null, '조립4공장-OFD1', '1'),
  asm('7004-222-M01', 'mid', '7004-222-G01', 'PBS', '6', ['asm-pbs', 6]),
  asm('7004-222-S01', 'sub', '7004-222-M01', 'NPS', '1', ['asm-nps', 1]),
  asm('7004-222-S02', 'sub', '7004-222-M01', 'NPS', '1', ['asm-nps', 1]),
  asm('7004-222-M02', 'mid', '7004-222-G01', 'GBS', '2', ['asm-gbs', 2]),
  asm('7004-222-S03', 'sub', '7004-222-M02', '3DS', '3', ['asm-3ds', 3]),
  asm('7004-222-S04', 'sub', '7004-222-M02', '3DS', '3', ['asm-3ds', 3]),
]

/**
 * 2540-283 — 조립 중, **대조 둘**이 같은 공장 다른 정반에 서고 하위가 세 공장에 퍼진다.
 * 대조가 여럿인 블록의 표본이다: G01 은 중조 하나 아래 소조 셋, G02 는 중조 둘이 각각
 * 소조 하나를 데리고 다른 공장(GBS·3DS)에서 올라온다.
 */
const SCATTER_283: readonly AssyPlacement[] = [
  asm('2540-283-G01', 'grand', null, 'PBS', '3', ['asm-pbs', 3]),
  asm('2540-283-M01', 'mid', '2540-283-G01', 'PBS', '3', ['asm-pbs', 3]),
  asm('2540-283-S01', 'sub', '2540-283-M01', 'NPS', '1', ['asm-nps', 1]),
  asm('2540-283-S02', 'sub', '2540-283-M01', 'NPS', '1', ['asm-nps', 1]),
  asm('2540-283-S03', 'sub', '2540-283-M01', 'NPS', '1', ['asm-nps', 1]),
  asm('2540-283-G02', 'grand', null, 'PBS', '7', ['asm-pbs', 7]),
  asm('2540-283-M02', 'mid', '2540-283-G02', 'GBS', '1', ['asm-gbs', 1]),
  asm('2540-283-S04', 'sub', '2540-283-M02', 'GBS', '1', ['asm-gbs', 1]),
  asm('2540-283-M03', 'mid', '2540-283-G02', '3DS', '2', ['asm-3ds', 2]),
  asm('2540-283-S05', 'sub', '2540-283-M03', '3DS', '2', ['asm-3ds', 2]),
]

/**
 * 2543-642 — **조립 후반, 대조 둘의 진도가 갈린 표본**. G01 가지는 대조·중조가 이미
 * 정반(PBS 6BAY)에 합쳐졌고 소조 둘만 NPS 에 남았다. G02 가지는 중조 M02 까지 올라왔지만
 * M03 은 아직 3DS 에서 제 소조를 붙이는 중이다 — "한 가지는 다 됐는데 한 가지가 남았다"가
 * 자리로 읽힌다.
 *
 * ⚠️ 예전에는 이 블록을 '대조 G01 만 먼저 도장으로 넘어간 전이'로 적었다. 그 모양은
 * 공정 순서(가공 → 조립 → 의장 → 도장)와 어긋난다 — **소조·중조는 대조 안에 들어가므로**
 * 대조가 도장에 가 있는데 하위가 조립 공장에 남아 있을 수 없고, 블록이 조립도 안 끝났는데
 * 도장 작업이 돌 수도 없다. 흩어짐은 조립 단계 안에서만 말한다(그건 실제로 그렇다).
 */
const SCATTER_642: readonly AssyPlacement[] = [
  asm('2543-642-G01', 'grand', null, 'PBS', '6', ['asm-pbs', 6]),
  asm('2543-642-M01', 'mid', '2543-642-G01', 'PBS', '6', ['asm-pbs', 6]),
  asm('2543-642-S01', 'sub', '2543-642-M01', 'NPS', '1', ['asm-nps', 1]),
  asm('2543-642-S02', 'sub', '2543-642-M01', 'NPS', '1', ['asm-nps', 1]),
  asm('2543-642-G02', 'grand', null, 'PBS', '6', ['asm-pbs', 6]),
  asm('2543-642-M02', 'mid', '2543-642-G02', 'PBS', '6', ['asm-pbs', 6]),
  asm('2543-642-S03', 'sub', '2543-642-M02', 'GBS', '3', ['asm-gbs', 3]),
  asm('2543-642-M03', 'mid', '2543-642-G02', '3DS', '1', ['asm-3ds', 1]),
  asm('2543-642-S04', 'sub', '2543-642-M03', '3DS', '1', ['asm-3ds', 1]),
]

/* ── 실측 스캔 블록의 ASSY 구성 (호선 5510 — PBS 5BAY) ──────────────────
 *
 * **실측을 1급 시민으로 올린다** (R31). 예전에는 5510 세 블록이 로스터에 이름만 있고
 * 구성이 없어, 통합실적이 그 블록의 ASSY 를 해시로 지어냈다 — 실측 뷰는 `FR103C` 를
 * 그리는데 통합실적은 `5510-553-M02` 를 적어, 같은 정반을 두고 두 화면이 서로 모르는
 * 이름을 불렀다. 이제 데이터셋이 정합한 13덩이가 **로스터의 정식 시민**이다.
 *
 * 세 가지가 여기서 정해진다:
 *  · **채번** — 데이터셋의 실채번(`FR103C`·`SR1B`·`TB81B`)을 그대로 쓴다. mock 의 조합식
 *    (`STRC+SER`)은 실채번이 없을 때의 규약이고, 있으면 실채번이 이긴다.
 *  · **구성** — 소조 → 중조 → 대조. 정합된 덩이 위에 **아직 안 붙은 상위**를 계획으로
 *    세운다(정합되지 않았으니 `scan` 이 없다) — 그것이 "지금 조립 중"의 뜻이다.
 *  · **정합 사실** — `scan.fitErrorCm` 은 manifest 값 그대로다. 통합실적의 판별 이벤트와
 *    실측 뷰의 표면일치가 이 한 값에서 함께 나온다.
 *
 * ⚠️ 자리(`berth`)는 **ASSY 자리**이지 블록 정반 배정이 아니다 — 로스터 블록에는 여전히
 * `berth` 를 주지 않는다(아래 5510 블록 주석). ASSY 자리는 `fetchLocations` 가 건드리지
 * 않고, 통합실적의 'PCD 뷰' 문이 실측 워크스페이스로 착지하는 재료가 된다.
 */
const REAL_BAY = { factoryId: 'asm-pbs', bayId: 'asm-pbs-b5' }

/** 실측 5BAY 의 ASSY 한 덩이 — 자리가 모두 같아 이름·급·귀속·정합오차만 적는다 */
const real = (
  assyNo: string,
  tier: AssyPlacement['tier'],
  parentAssyNo: string | null,
  scan?: AssyScanFact
): AssyPlacement => ({
  assyNo,
  tier,
  parentAssyNo,
  zone: 'assembly',
  factory: 'PBS',
  mapBay: '5',
  berth: REAL_BAY,
  scan,
})

/** 5510-553 — 중조 넷이 정합됐고 대조는 아직 안 합쳐졌다 (정합 4건) */
const SCAN_553: readonly AssyPlacement[] = [
  real('5510-553-G01', 'grand', null),
  real('5510-553-FR103C', 'mid', '5510-553-G01', { fitErrorCm: 7.2 }),
  real('5510-553-FR104C', 'mid', '5510-553-G01', { fitErrorCm: 6.5 }),
  real('5510-553-FR105C', 'mid', '5510-553-G01', { fitErrorCm: 7.5 }),
  real('5510-553-FR106C', 'mid', '5510-553-G01', { fitErrorCm: 7.1 }),
]

/** 5510-726 — 중조 FR84A 가 이미 서 있고 그 아래 소조 넷이 함께 정합됐다 (정합 5건) */
const SCAN_726: readonly AssyPlacement[] = [
  real('5510-726-G01', 'grand', null),
  real('5510-726-FR84A', 'mid', '5510-726-G01', { fitErrorCm: 9.2 }),
  real('5510-726-SR1B', 'sub', '5510-726-FR84A', { fitErrorCm: 6.6 }),
  real('5510-726-SR2B', 'sub', '5510-726-FR84A', { fitErrorCm: 5.4 }),
  real('5510-726-SR3B', 'sub', '5510-726-FR84A', { fitErrorCm: 12.3 }),
  real('5510-726-TB81B', 'sub', '5510-726-FR84A', { fitErrorCm: 10.0 }),
]

/**
 * 5510-736 — 726 의 자매 블록인데 **한 단계 뒤에 있다**: 같은 소조 넷이 정합됐지만
 * 그것을 받을 중조 M01 이 아직 안 붙었다. 같은 정반의 두 블록이 다른 단계에 서 있는
 * 모양이라, 실측 정반이 왜 복수 블록을 이고 있는지가 구성으로 읽힌다 (정합 4건).
 */
const SCAN_736: readonly AssyPlacement[] = [
  real('5510-736-G01', 'grand', null),
  real('5510-736-M01', 'mid', '5510-736-G01'),
  real('5510-736-SR1B', 'sub', '5510-736-M01', { fitErrorCm: 4.0 }),
  real('5510-736-SR2B', 'sub', '5510-736-M01', { fitErrorCm: 8.8 }),
  real('5510-736-SR3B', 'sub', '5510-736-M01', { fitErrorCm: 6.1 }),
  real('5510-736-TB81B', 'sub', '5510-736-M01', { fitErrorCm: 7.9 }),
]

/**
 * 블록 전체 — 호선 순 · 호선 안에서는 조립 → 의장 순.
 *
 * 조립 블록 중 `berth` 가 있는 것만 대시보드 정반에 앉는다(나머지는 재공 목록에만 있다).
 * `hasCadModel: true` 인 다섯만 3D 형상을 가진다 — 그 외 정반에 CAD 를 배정하면
 * 뷰어가 빈 정반을 '재실'로 보여 공장 뷰와 어긋난다.
 */
export const BLOCKS: readonly RosterBlock[] = [
  /* ── 2540 (CAD: 281 @ PBS 8BAY — 라이다 9대 권역. 1~3BAY 는 도면상 라이다가 없어
     시연 헤드라인 블록을 앉히지 않는다) ── */
  { projNo: '2540', blockNo: '281', zone: 'assembly', factory: 'PBS', mapBay: '8', berth: berth('asm-pbs', 8, 'assembly', true) },
  { projNo: '2540', blockNo: '283', zone: 'assembly', factory: 'PBS', mapBay: '3', assyUnits: SCATTER_283 },
  { projNo: '2540', blockNo: '286', zone: 'outfitting', factory: 'POS 1공장', mapBay: '1', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P11B' } },

  /* ── 2543 (CAD: 642 @ PBS 6BAY — 라이다 12대 권역, 같은 이유) ── */
  { projNo: '2543', blockNo: '642', zone: 'assembly', factory: 'PBS', mapBay: '6', berth: berth('asm-pbs', 6, 'assembly', true), assyUnits: SCATTER_642 },
  { projNo: '2543', blockNo: '645', zone: 'assembly', factory: '3DS', mapBay: '2' },
  { projNo: '2543', blockNo: '648', zone: 'outfitting', factory: 'POS 1공장', mapBay: '4', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P14B' } },

  /* ── 2570 (CAD: 153 @ PBS 4BAY) ── */
  { projNo: '2570', blockNo: '153', zone: 'assembly', factory: 'PBS', mapBay: '4', berth: berth('asm-pbs', 4, 'assembly', true) },
  { projNo: '2570', blockNo: '158', zone: 'assembly', factory: 'PBS', mapBay: '6' },
  { projNo: '2570', blockNo: '161', zone: 'outfitting', factory: 'POS 1공장', mapBay: '6', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P16B' } },

  /* ── 4391 (CAD: 154 @ NPS 2BAY, 대조) ── */
  { projNo: '4391', blockNo: '154', zone: 'assembly', factory: 'NPS', mapBay: '2', berth: berth('asm-nps', 2, 'block', true) },
  { projNo: '4391', blockNo: '157', zone: 'assembly', factory: 'NPS', mapBay: '1' },
  { projNo: '4391', blockNo: '160', zone: 'outfitting', factory: '두모 선행의장 2공장', mapBay: '5', outfitting: { factoryId: 'ofit-dm2', areaCode: 'DM20' } },

  /* ── 4392 (CAD: 133 @ NPS 3BAY, 대조) ── */
  { projNo: '4392', blockNo: '133', zone: 'assembly', factory: 'NPS', mapBay: '3', berth: berth('asm-nps', 3, 'block', true) },
  { projNo: '4392', blockNo: '136', zone: 'assembly', factory: '조립4공장-OFD1', mapBay: '3' },
  { projNo: '4392', blockNo: '139', zone: 'outfitting', factory: '두모 선행의장 2공장', mapBay: '1', outfitting: { factoryId: 'ofit-dm2', areaCode: 'PO30' } },

  /* ── 7004 (통합실적 데모 — 블록번호·공장 기존 그대로) ── */
  { projNo: '7004', blockNo: '222', zone: 'assembly', factory: '조립4공장-OFD1', mapBay: '1', assyUnits: SCATTER_222 },
  { projNo: '7004', blockNo: '310', zone: 'assembly', factory: 'PBS', mapBay: '7' },
  { projNo: '7004', blockNo: '415', zone: 'assembly', factory: 'GBS', mapBay: '1' },
  { projNo: '7004', blockNo: '521', zone: 'assembly', factory: 'NPS', mapBay: '3' },
  { projNo: '7004', blockNo: '530', zone: 'outfitting', factory: '조립의장 1공장 BOS 1', mapBay: '1', outfitting: { factoryId: 'ofit-bos1', areaCode: 'BOS1' } },
  { projNo: '7004', blockNo: '534', zone: 'outfitting', factory: '조립의장 2공장 BOS 2', mapBay: '1', outfitting: { factoryId: 'ofit-bos2', areaCode: 'BOS4' } },

  /* ── 7012 ── */
  { projNo: '7012', blockNo: '118', zone: 'assembly', factory: 'PBS', mapBay: '5' },
  { projNo: '7012', blockNo: '204', zone: 'assembly', factory: '3DS', mapBay: '1' },
  { projNo: '7012', blockNo: '233', zone: 'assembly', factory: 'GBS', mapBay: '3' },
  { projNo: '7012', blockNo: '240', zone: 'outfitting', factory: '조립의장 1공장 BOS 1', mapBay: '6', outfitting: { factoryId: 'ofit-bos1', areaCode: 'BOS2' } },
  { projNo: '7012', blockNo: '244', zone: 'outfitting', factory: '조립의장 3공장 쉘터', mapBay: '1', outfitting: { factoryId: 'ofit-bos3', areaCode: 'BOS3-M' } },

  /* ── 8103 ── */
  { projNo: '8103', blockNo: '105', zone: 'assembly', factory: 'NPS', mapBay: '1' },
  { projNo: '8103', blockNo: '141', zone: 'assembly', factory: 'PBS', mapBay: '8' },
  { projNo: '8103', blockNo: '150', zone: 'outfitting', factory: 'GOS 조립의장 쉘터', mapBay: '1', outfitting: { factoryId: 'ofit-gos', areaCode: 'GOS-M' } },
  { projNo: '8103', blockNo: '152', zone: 'outfitting', factory: '조립의장 2공장 BOS 2', mapBay: '1', outfitting: { factoryId: 'ofit-bos2', areaCode: 'BOS4' } },
  { projNo: '8103', blockNo: '155', zone: 'outfitting', factory: 'OFD조립의장 셸터', mapBay: '1', outfitting: { factoryId: 'ofit-ofd', areaCode: 'OFD-M' } },
  { projNo: '8103', blockNo: '157', zone: 'outfitting', factory: 'POS 1공장', outfitting: { factoryId: 'ofit-pos1', areaCode: 'POS1-M' } },

  /* ── 5510 (실측 스캔) — PBS 5BAY 에 실제로 서 있는 블록 셋 ────────────────
   *
   * `public/real-scan/` 데이터셋(2025-12-20 15:00 스캔)이 정합한 13개 조립품이 이 세
   * 블록에 속한다: 553(4건) · 726(5건) · 736(4건). **한 정반에 블록이 셋**이라는 점이
   * 목업 정반(1블록)과 다르고, 식별바·통합실적 링크가 그 사실을 복수로 말한다.
   * 그 13덩이의 **구성과 정합 사실은 위 `SCAN_*` 에 정식 시민으로 적혀 있다**(R31) —
   * 통합실적은 더 이상 이 블록의 ASSY 를 지어내지 않고 그 목록을 그대로 쓴다.
   *
   * ⚠️ **`berth` 를 주지 않는다.** 정반 배정은 목업의 어휘이고 세 가지 불변식이 그것을
   * 지킨다 — 정반 하나에 블록 하나(`roster.test`), 정반 배정 블록은 전부 CAD 데모 블록,
   * 그리고 **실측 베이에는 mock 배정을 넣지 않는다**(`berthSensors.test` — 넣으면
   * `fetchLocations` 가 그 칸을 실측으로 교체하면서 배정이 조용히 사라진다).
   * 세 블록이 한 베이에 함께 서 있다는 사실은 `factory`·`mapBay` 로 충분히 말할 수 있고,
   * 실측 정반의 신원은 화면이 **인식된 블록에서 직접** 읽는다(BayIdentityBar).
   */
  { projNo: '5510', blockNo: '553', zone: 'assembly', factory: 'PBS', mapBay: '5', assyUnits: SCAN_553 },
  { projNo: '5510', blockNo: '726', zone: 'assembly', factory: 'PBS', mapBay: '5', assyUnits: SCAN_726 },
  { projNo: '5510', blockNo: '736', zone: 'assembly', factory: 'PBS', mapBay: '5', assyUnits: SCAN_736 },

  /* ── 선행의장 재공 (호선별 조립을 끝내고 의장 공장으로 넘어간 블록들) ──
   * 구역 코드는 `outfittingFactoryFixture` 의 공장그룹 코드와 같은 문자열이어야 한다 —
   * 어긋난 블록은 의장 화면에 서지 않는다(그쪽 mock 이 걸러낸다). */
  { projNo: '2540', blockNo: '288', zone: 'outfitting', factory: 'POS 1공장', mapBay: '1', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P11B' } },
  { projNo: '2540', blockNo: '291', zone: 'outfitting', factory: 'POS 1공장', mapBay: '3', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P13B' } },
  { projNo: '2540', blockNo: '294', zone: 'outfitting', factory: '조립의장 1공장 BOS 1', mapBay: '1', outfitting: { factoryId: 'ofit-bos1', areaCode: 'BOS1' } },
  /* 전이 (a) — 조립을 막 끝내고 검사장을 거쳐 의장 공장에 갓 들어온 블록.
     조립 판별 전량 완료 + 검사장 이동이 어제, 의장 실적은 이제부터다. */
  { projNo: '2543', blockNo: '651', zone: 'outfitting', factory: 'POS 1공장', mapBay: '2', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P12B' }, justArrived: true },
  { projNo: '2543', blockNo: '654', zone: 'outfitting', factory: '조립의장 1공장 BOS 1', mapBay: '6', outfitting: { factoryId: 'ofit-bos1', areaCode: 'BOS2' } },
  { projNo: '2543', blockNo: '657', zone: 'outfitting', factory: 'GOS 조립의장 쉘터', mapBay: '1', outfitting: { factoryId: 'ofit-gos', areaCode: 'GOS-M' } },
  { projNo: '2570', blockNo: '164', zone: 'outfitting', factory: 'POS 1공장', mapBay: '3', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P13B' } },
  { projNo: '2570', blockNo: '167', zone: 'outfitting', factory: '조립의장 2공장 BOS 2', mapBay: '1', outfitting: { factoryId: 'ofit-bos2', areaCode: 'BOS4' } },
  { projNo: '4391', blockNo: '163', zone: 'outfitting', factory: 'POS 1공장', mapBay: '4', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P14B' } },
  { projNo: '4391', blockNo: '166', zone: 'outfitting', factory: '조립의장 3공장 쉘터', mapBay: '1', outfitting: { factoryId: 'ofit-bos3', areaCode: 'BOS3-M' } },
  { projNo: '4392', blockNo: '142', zone: 'outfitting', factory: 'POS 1공장', mapBay: '5', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P15B' } },
  { projNo: '4392', blockNo: '145', zone: 'outfitting', factory: 'POS 1공장', outfitting: { factoryId: 'ofit-pos1', areaCode: 'POS1-M' } },
  { projNo: '4392', blockNo: '148', zone: 'outfitting', factory: 'OFD조립의장 셸터', mapBay: '1', outfitting: { factoryId: 'ofit-ofd', areaCode: 'OFD-M' } },
  { projNo: '7004', blockNo: '538', zone: 'outfitting', factory: 'POS 1공장', mapBay: '5', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P15B' } },
  { projNo: '7004', blockNo: '542', zone: 'outfitting', factory: '두모 선행의장 2공장', mapBay: '5', outfitting: { factoryId: 'ofit-dm2', areaCode: 'DM20' } },
  { projNo: '7012', blockNo: '248', zone: 'outfitting', factory: 'POS 1공장', mapBay: '7', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P17B' } },
  { projNo: '7012', blockNo: '252', zone: 'outfitting', factory: '두모 선행의장 2공장', mapBay: '1', outfitting: { factoryId: 'ofit-dm2', areaCode: 'PO30' } },
  { projNo: '8103', blockNo: '160', zone: 'outfitting', factory: 'POS 1공장', mapBay: '7', outfitting: { factoryId: 'ofit-pos1', areaCode: 'P17B' } },
  { projNo: '8103', blockNo: '163', zone: 'outfitting', factory: '두모 선행의장 2공장', mapBay: '5', outfitting: { factoryId: 'ofit-dm2', areaCode: 'DM20' } },

  /* ── 가공 중 — **위치 추적이 없다.**
   * 가공권역은 필드 수집(LiDAR/PLC)이 없어 부재의 물리 위치를 알 원천이 아예 없다.
   * 공장 이름은 그 부재가 걸린 가공공장이지만, 지도에 점을 찍지는 않는다 —
   * `sitesOfBlock` 이 빈 배열을 내고 화면은 상태 배지로만 말한다. */
  { projNo: '2570', blockNo: '171', zone: 'fabrication', factory: 'PAS' },
  { projNo: '7004', blockNo: '612', zone: 'fabrication', factory: 'CAS' },
  { projNo: '8103', blockNo: '118', zone: 'fabrication', factory: '해양절단공장' },

  /* ── 선행도장 중 (BTS 귀속) — 블록번호는 통합실적 생성기가 `inShop` 으로 판정하는
   * 것들로 골랐다. 로스터가 "도장 중"이라 말하는데 실적 카드가 "도장 반입 전"이라 말하면
   * 두 화면이 어긋난다(그 일치는 도장 귀속 테스트가 잠근다). */
  { projNo: '2543', blockNo: '141', zone: 'painting', factory: '1DOCK 도장공장', mapBay: 'B3', bts: { lat: 34.87081, lon: 128.692824 } },
  { projNo: '4391', blockNo: '162', zone: 'painting', factory: '2DOCK 도장공장', mapBay: 'D2', bts: { lat: 34.873938, lon: 128.703955 } },
  { projNo: '7012', blockNo: '117', zone: 'painting', factory: '느태 도장공장', mapBay: 'NP2', bts: { lat: 34.879432, lon: 128.718988 } },
  /* 전이 (b) — 의장을 끝내고 도장공장에 **갓 반입된** 블록. BTS 반입만 찍혔고 스텝은
     아직 미착수라 일일공정률(YPWG413M)이 하나도 없다 — 도장 카드가 '완료 행만 반영'
     경로로 서는 유일한 실로스터 표본이다. */
  { projNo: '2543', blockNo: '660', zone: 'painting', factory: '2DOCK 도장공장', mapBay: 'D2', bts: { lat: 34.873905, lon: 128.703992 }, justArrived: true },
]
