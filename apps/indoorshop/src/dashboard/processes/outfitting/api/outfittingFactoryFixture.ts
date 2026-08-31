/*
 * 선행의장 공장 마스터 — **생성물이므로 손으로 고치지 않는다.**
 *
 * 출처: painting 지번속성.js (window.CSV_LOT_ATTR) 의 '의장' 공정 공장.
 * 생성: `node scripts/build-outfitting-factories-fixture.mjs` 를 다시 돌리면 이 파일을 덮어쓴다.
 *
 * 공장 7곳과 각 공장의 구역(area) 구조를 지번의 공장그룹/그룹명에서 파생했다. 의장은
 * 소조/중조/대조 세분이 없다 — 구역은 위치 개념일 뿐, 실제 작업 단위는 '블록'이다
 * (블록은 mock 계층 `mockOutfittingData` 가 이 구역들 위에 만든다).
 */

export interface OutfittingAreaSpec {
  /** 구역 코드 (공장그룹, 본체는 '{Shop}-M') */
  code: string
  /** 구역 이름 (그룹명) */
  name: string
  /** 이 구역 소속 지번코드 — 야드 맵 연결 키 */
  yardLots: string[]
}

export interface OutfittingFactorySpec {
  id: string
  name: string
  shopCode: string
  areas: OutfittingAreaSpec[]
}

export const OUTFITTING_FACTORIES: OutfittingFactorySpec[] = [
  {
    id: "ofit-pos1",
    name: "POS 1공장",
    shopCode: "POS1",
    areas: [
      { code: "P11B", name: "POS 1공장 1BAY", yardLots: ["P11B01", "P11B02", "P11B03", "P11B04"] },
      { code: "P12B", name: "POS 1공장 2BAY", yardLots: ["P12B02", "P12B03"] },
      { code: "P13B", name: "POS 1공장 3BAY", yardLots: ["P13B02", "P13B03"] },
      { code: "P14B", name: "POS 1공장 4BAY", yardLots: ["P14B01", "P14B02", "P14B03", "P14B04"] },
      { code: "P15B", name: "POS 1공장 5B", yardLots: ["P15B01", "P15B02", "P15B03", "P15B04"] },
      { code: "P16B", name: "POS 1공장 6BAY", yardLots: ["P16B01", "P16B02", "P16B03", "P16B04"] },
      { code: "P17B", name: "POS 1공장 7BAY", yardLots: ["P17B01", "P17B02", "P17B03", "P17B04"] },
      { code: "POS1-M", name: "POS 1공장 본체", yardLots: ["P11E02", "P11E03", "P11E04", "P11E05", "P11E06", "P11E07", "P11W03", "P11W04", "P12B01", "P13B01"] },
    ],
  },
  {
    id: "ofit-dm2",
    name: "두모 선행의장 2공장",
    shopCode: "DM2",
    areas: [
      { code: "DM20", name: "두모 선행의장 2공장", yardLots: ["DM2051", "DM2052", "DM2053", "DM2061", "DM2062", "DM2063", "DM2071", "DM2072", "DM2081", "DM2082"] },
      { code: "PO30", name: "두모 선행의장 3공장", yardLots: ["PO3011", "PO3012", "PO3021", "PO3022", "PO3031", "PO3032", "PO3041", "PO3042"] },
    ],
  },
  {
    id: "ofit-bos1",
    name: "조립의장 1공장 BOS 1",
    shopCode: "BOS1",
    areas: [
      { code: "BOS1", name: "BOS 1공장", yardLots: ["BOS111", "BOS112", "BOS121", "BOS122", "BOS131", "BOS132", "BOS141", "BOS142", "BOS151", "BOS152"] },
      { code: "BOS2", name: "BOS 1공장", yardLots: ["BOS261", "BOS271"] },
    ],
  },
  {
    id: "ofit-bos2",
    name: "조립의장 2공장 BOS 2",
    shopCode: "BOS2",
    areas: [
      { code: "BOS4", name: "BOS 2공장 1BAY", yardLots: ["BOS401", "BOS402", "BOS403", "BOS404"] },
    ],
  },
  {
    id: "ofit-bos3",
    name: "조립의장 3공장 쉘터",
    shopCode: "BOS3",
    areas: [
      { code: "BOS3-M", name: "조립의장 3공장 쉘터 본체", yardLots: ["TE1W11", "TE1W12", "TE1W13", "TE1W14"] },
    ],
  },
  {
    id: "ofit-gos",
    name: "GOS 조립의장 쉘터",
    shopCode: "GOS",
    areas: [
      { code: "GOS-M", name: "GOS 조립의장 쉘터 본체", yardLots: ["GO1S01", "GO2S01"] },
    ],
  },
  {
    id: "ofit-ofd",
    name: "OFD조립의장 셸터",
    shopCode: "OFD",
    areas: [
      { code: "OFD-M", name: "OFD조립의장 셸터 본체", yardLots: ["E33002"] },
    ],
  },
]
