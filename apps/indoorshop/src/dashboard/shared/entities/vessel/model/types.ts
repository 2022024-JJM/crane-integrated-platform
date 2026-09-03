/**
 * 호선·블록 마스터 타입 — 화면 전체가 공유하는 **단일 mock 우주**의 어휘.
 *
 * 지금까지 호선번호·블록번호는 화면마다 따로 있었다 (통합실적 7004/7012/8103,
 * 조립 2540/2543/…, 의장 5510/5511/…). 세 우주가 겹치지 않아 같은 블록이 두 화면에
 * 나타날 수 없었고, 화면을 옮기면 조회 조건을 처음부터 다시 골라야 했다.
 * 이 엔티티가 그 셋을 하나로 합친다 — 블록은 여기 한 번만 적히고, 조립·의장·통합실적은
 * 그 목록을 읽어 각자의 표현(정반 배치·진척·절점 실적)만 얹는다.
 */

/** 공정존 — `ProcessModule.id` 와 같은 키 (`/indoorshop/zones/{zone}` 경로의 그 이름) */
export type ProcessZone = 'fabrication' | 'assembly' | 'outfitting' | 'painting'

/**
 * 공정존 → 야드 데이터의 **공정 이름**. 지번·베이 fixture 의 `process` 열, 그리고
 * `colorOfProcess` 의 키가 이 한글 이름이다 — 지도가 자리를 그 공정 색으로 칠할 때 쓴다.
 * 새 이름 체계를 만들지 않는다(공장 이름과 같은 이유).
 */
export const YARD_PROCESS_OF_ZONE: Readonly<Record<ProcessZone, string>> = {
  fabrication: '가공',
  assembly: '조립',
  outfitting: '의장',
  painting: '도장',
}

/** ASSY 급 — 대조 > 중조 > 소조 (통합실적 `AssyUnit.tier` 와 같은 어휘) */
export type AssyTier = 'grand' | 'mid' | 'sub'

/** 호선 — `7004호 (LNGC)` 표기용 */
export interface Vessel {
  projNo: string
  shipType: string
}

/**
 * 조립 정반 배치 — 이 블록이 어느 공장 어느 정반에 놓여 있는가.
 *
 * `bayId` 는 조립 mock 의 정반 id 규약(`{factoryId}-b{bayNo}`)과 같은 값이다 —
 * 대시보드 베이 카드 ↔ 통합실적 블록을 잇는 연결 키이자 `/indoorshop/zones/assembly/{factoryId}/{bayId}`
 * 딥링크의 재료다. 두 값을 따로 두는 것은 문자열에서 잘라 쓰지 않기 위함이다.
 */
export interface AssemblyBerth {
  factoryId: string
  bayId: string
  /** `public/models/{projNo}_{blockNo}.{json,bin}` 실측 CAD 가 있는 블록인가 */
  hasCadModel: boolean
  /** 인식 단위 — 대조(블록)=block, 소/중조=assembly */
  unitLevel: 'assembly' | 'block'
}

/** 선행의장 구역 배치 — 의장은 정반이 아니라 구역(공장그룹) 단위다 */
export interface OutfittingBerth {
  factoryId: string
  areaCode: string
}

/**
 * ASSY 한 덩이가 서 있는 자리 — **블록은 한 자리에 있지 않다.**
 *
 * 조립 중인 블록은 대조·중조·소조가 서로 다른 공장에서 동시에 만들어진다(소조 공장에서
 * 소조를 붙여 중조 공장으로 보내고, 대조 정반에서 합친다). 그래서 "이 블록 어디 있어요"의
 * 답이 점 하나가 아니라 **여러 점**이고, 지도도 그렇게 그려야 한다.
 *
 * `assyNo` 는 통합실적 조립 카드가 쓰는 ASSY_NO(조합식 `PROJ-BLK-STRC+SER`)와 **같은 값**
 * 이라야 한다 — 지도에서 본 ASSY 이름을 실적 화면에서 찾을 수 있어야 하기 때문이다.
 * (그 일치는 `features/performance` 쪽 테스트가 생성기와 대조해 잠근다.)
 */
export interface AssyPlacement {
  /** ASSY_NO — 통합실적 ASSY 목록에 실제로 있는 번호 */
  assyNo: string
  tier: AssyTier
  /**
   * 이 ASSY 자리의 공정 — 대개 'assembly' 지만, 대조가 먼저 도장으로 넘어간 전이 상태처럼
   * 블록 단계와 다를 수 있다. 마커 라벨이 이 값을 따른다.
   */
  zone: ProcessZone
  /** 지도 공장명 */
  factory: string
  /** 지도 베이명(`YardParcelBay.bay`) — 없으면 공장 앵커로 떨어진다 */
  mapBay?: string
  /** 조립 정반이면 그 정반 (정반 상세 딥링크의 재료) */
  berth?: { factoryId: string; bayId: string }
  /**
   * **부모 ASSY_NO — 이 목록을 평평한 명단이 아니라 BOM 트리로 만드는 한 줄** (R34).
   *
   * 소조는 중조에, 중조는 대조에 들어간다(YDEH040M 부모추적, PRDT_PART_NO→CMPT_PART_NO).
   * 대조 루트는 null 이다. 예전에는 로스터가 급(G/M/S)만 적고 귀속을 적지 않아, 통합실적
   * 생성기가 같은 블록의 계층을 **해시로 따로 합성**했다 — 지도가 아는 구성과 실적 카드가
   * 그리는 트리가 서로 다른 근거에서 나오는 상태였다. 이제 귀속도 여기 적히고, 생성기는
   * 로스터에 트리가 있으면 **그대로 쓴다**(없는 블록만 합성 폴백).
   */
  parentAssyNo: string | null
  /**
   * **실측 스캔이 이 덩이를 정합했다** — 인식 사실(신원)이지 실적이 아니다.
   *
   * 로스터는 "무엇이 어디에 있나"를 적고 진척은 통합실적이 낸다(연계 매트릭스 원칙).
   * 정합 여부와 표면 정합 오차는 그 사이에 있는 값이라 여기 둔다 — 스캔이 관측한
   * **신원 확인 결과**이고, 통합실적은 이 사실 위에 판별 수치를 얹는다. 원천은 실측
   * 데이터셋(`public/real-scan/manifest.json`)이고, shared 는 processes 를 import 할 수
   * 없으므로 값을 옮겨 적되 **조립 쪽 parity 테스트가 데이터셋과 대조해 잠근다.**
   */
  scan?: AssyScanFact
}

/** 실측 스캔이 이 ASSY 를 정합한 결과 — 데이터셋 원천, parity 테스트가 잠근다 */
export interface AssyScanFact {
  /** 표면 정합 오차(cm) — manifest `blocks[].fitErrorCm` 그대로 */
  fitErrorCm: number
}

/**
 * 블록 1개 — 이 우주의 원자.
 *
 * `factory` 는 **지금 이 블록이 서 있는 공장의 지도 공장명**이다. 야드 지도 공장 키와
 * 같은 체계라서 그대로 `/?factory=` · `/indoorshop/zones/{zone}?shop=` 딥링크에 실린다 —
 * 새 이름 체계를 만들지 않는다(딥링크 계약).
 */
export interface RosterBlock {
  projNo: string
  blockNo: string
  /** 지금 이 블록이 서 있는 공정존 */
  zone: ProcessZone
  /** 지금 이 블록이 서 있는 공장 (지도 공장명 = 딥링크 키) */
  factory: string
  /** 조립 정반 배치 — zone 이 'assembly' 이고 정반이 정해진 블록만 */
  berth?: AssemblyBerth
  /** 의장 구역 배치 — zone 이 'outfitting' 인 블록만 */
  outfitting?: OutfittingBerth
  /**
   * 이 블록이 서 있는 지도 베이(`YardParcelBay.bay`) — 없으면 지도가 공장 앵커로 찍는다.
   * 정반(`berth`)이 있는 블록은 그 정반 번호와 같아야 한다(불변식 테스트가 지킨다).
   */
  mapBay?: string
  /**
   * BTS(블록 추적)가 찍은 야드 좌표 — **도장 재실의 정본**.
   *
   * 도장공장에는 베이명을 적어 주는 사람이 없다. BTS 는 반입 지점의 좌표만 남기므로,
   * 화면이 그 점을 베이 기하에 떨어뜨려(point-in-bay) 어느 칸인지 유도한다
   * (`shared/features/dashboard-map/lib/bayOccupancy`). 손으로 붙인 베이명을 정본으로
   * 삼으면 좌표와 이름이 언젠가 어긋나고, 어느 쪽이 사실인지 화면만 보고는 모른다.
   */
  bts?: { lat: number; lon: number }
  /**
   * ASSY 단위 소재 — **있으면 이쪽이 지도 위치의 정본**이다(블록 자리 대신 이 자리들을
   * 찍는다). 조립 중인 블록이 여러 공장에 흩어져 있는 상태를 이걸로 말한다.
   *
   * ⚠️ **조립 단계에서만 쓴다.** 흩어짐은 "아직 안 합쳐졌다"는 뜻이고, 합쳐진 뒤(=조립
   * 완료)에는 대조 하나가 곧 블록이라 자리가 하나다. 의장·도장 블록에 ASSY 분산을 적으면
   * 공정 순서(가공 → 조립 → 의장 → 도장)와 어긋난다.
   */
  assyUnits?: readonly AssyPlacement[]
  /**
   * **단계 전이 — 이 공정에 막 넘어온 블록.** 직전 공정을 끝낸 직후라 이 공정의 실적은
   * 아직 시작 전이다. 더미가 그 시점의 모양을 만든다:
   *  - 의장으로 막 넘어옴 → 조립 전량 완료 + 검사장 이동이 **어제**
   *  - 도장으로 막 넘어옴 → BTS 반입만 되고 스텝 미착수(일일공정률이 아직 없다)
   * 화면이 경계에 선 블록을 실제로 그릴 수 있게 하는 표본이다.
   */
  justArrived?: boolean
}

/**
 * 지도에 찍을 자리 한 개 — 마커 하나가 된다. 같은 (공정, 공장, 베이)의 ASSY 는 한 마커로
 * 묶인다(열 개짜리 블록이 열 개의 핀으로 지도를 덮지 않도록).
 *
 * ⚠️ **가공 중인 블록은 자리가 없다** — 가공권역은 필드 수집(LiDAR/PLC)이 없어 부재의
 * 물리 위치를 추적할 원천이 아예 없다. 없는 위치를 공장 앵커로라도 찍으면 "여기 있다"는
 * 거짓말이 되므로, 그때는 자리 목록이 빈 배열이고 화면은 상태 배지로만 말한다.
 */
export interface BlockSite {
  /** 마커 키 — `{zone}@{factory}#{mapBay}` */
  id: string
  zone: ProcessZone
  factory: string
  mapBay?: string
  /** 이 자리에 있는 ASSY 들 — 블록 단위 자리면 빈 배열 */
  assys: readonly { assyNo: string; tier: AssyTier }[]
  /** 이 자리의 공정 화면 경로 (정반이 정해졌으면 정반 상세까지) */
  path: string
}

/** 블록 멀티선택 항목 — 통합실적 필터가 쓰는 얇은 형태 */
export interface BlockOption {
  blockNo: string
  factory: string
}
