/*
 * 조립 공장 마스터 — **생성물이므로 손으로 고치지 않는다.**
 *
 * 출처: painting 지번속성.js (window.CSV_LOT_ATTR) 의 '조립' 공정 공장.
 * 생성: `node scripts/build-assembly-factories-fixture.mjs` 를 다시 돌리면 이 파일을 덮어쓴다.
 *
 * 공장 7곳과 각 공장의 BAY(정반) 구조를 지번의 공장그룹/그룹명에서 파생했다. yardLots 는
 * 그 BAY 소속 지번코드로, 야드 맵이 정반을 실제 자리에 그리는 연결 키다.
 */

export type AssemblyUnitLevel = 'assembly' | 'block'

export interface AssemblyBaySpec {
  /** BAY 번호 (공장그룹 코드의 숫자) */
  bayNo: number
  /** 공장그룹 코드 (예: PB1B) */
  code: string
  /** 그룹명 (예: 'NPS 1-BAY 소조 작업장') */
  groupName: string
  /** 인식 단위 — 대조(블록)=block, 소/중조=assembly */
  unitLevel: AssemblyUnitLevel
  /** 이 BAY 소속 지번코드 — 야드 맵 연결 키 */
  yardLots: string[]
}

export interface AssemblyFactorySpec {
  id: string
  name: string
  assyShop: string
  bays: AssemblyBaySpec[]
}

export const ASSEMBLY_FACTORIES: AssemblyFactorySpec[] = [
  {
    id: "asm-pbs",
    name: "PBS",
    assyShop: "PBS",
    bays: [
      { bayNo: 1, code: "PB1B", groupName: "PBS 1BAY", unitLevel: "assembly", yardLots: ["PB1B01", "PB1B02", "PB1B03"] },
      { bayNo: 2, code: "PB2B", groupName: "PBS 2BAY", unitLevel: "assembly", yardLots: ["PB2B01", "PB2B02"] },
      { bayNo: 3, code: "PB3B", groupName: "PBS 3BAY", unitLevel: "assembly", yardLots: ["PB3B01"] },
      { bayNo: 4, code: "PB4B", groupName: "PBS 4-BAY", unitLevel: "assembly", yardLots: ["PB4B01", "PB4B02", "PB4B03"] },
      { bayNo: 5, code: "PB5B", groupName: "PBS 5 BAY 남쪽-", unitLevel: "assembly", yardLots: ["PB5B01", "PB5B02", "PB5B03"] },
      { bayNo: 6, code: "PB6B", groupName: "PBS 6-BAY-", unitLevel: "assembly", yardLots: ["PB6B01", "PB6B02", "PB6B03"] },
      { bayNo: 7, code: "PB7B", groupName: "PBS 7-BAY", unitLevel: "assembly", yardLots: ["PB7B01", "PB7B02"] },
      { bayNo: 8, code: "PB8B", groupName: "PBS 8-BAY", unitLevel: "assembly", yardLots: ["PB8B01", "PB8B02"] },
    ],
  },
  {
    id: "asm-of1",
    name: "해양제작1공장",
    assyShop: "OF1",
    bays: [
      { bayNo: 1, code: "OF1B", groupName: "해양제작1공장 1B", unitLevel: "assembly", yardLots: ["OF1B01", "OF1B02", "OF1B03"] },
      { bayNo: 2, code: "OF2B", groupName: "해양제작1공장 2B", unitLevel: "assembly", yardLots: ["OF2B01", "OF2B02", "OF2B03"] },
      { bayNo: 3, code: "OF3B", groupName: "해양제작1공장 3B", unitLevel: "assembly", yardLots: ["OF3B01", "OF3B02", "OF3B03"] },
      { bayNo: 4, code: "OF4B", groupName: "해양제작1공장 4B", unitLevel: "assembly", yardLots: ["OF4B01", "OF4B02", "OF4B03"] },
    ],
  },
  {
    id: "asm-3ds",
    name: "3DS",
    assyShop: "3DS",
    bays: [
      { bayNo: 1, code: "3D1B", groupName: "3DS 1-B", unitLevel: "assembly", yardLots: ["3D1B01", "3D1B02", "3D1B03"] },
      { bayNo: 2, code: "3D2B", groupName: "3DS 2-B", unitLevel: "assembly", yardLots: ["3D2B01", "3D2B02", "3D2B03"] },
      { bayNo: 3, code: "3D3B", groupName: "3DS 3-B", unitLevel: "assembly", yardLots: ["3D3B01", "3D3B02", "3D3B03"] },
    ],
  },
  {
    id: "asm-nps",
    name: "NPS",
    assyShop: "NPS",
    bays: [
      { bayNo: 1, code: "NP1B", groupName: "NPS 1-BAY 소조 작업장", unitLevel: "assembly", yardLots: ["NP1B01", "NP1B02", "NP1B03"] },
      { bayNo: 2, code: "NP2B", groupName: "NPS 2-BAY 대조 작업장", unitLevel: "block", yardLots: ["NP2B01", "NP2B02", "NP2B03"] },
      { bayNo: 3, code: "NP3B", groupName: "NPS 3-BAY 대조 작업장", unitLevel: "block", yardLots: ["NP3B01", "NP3B02", "NP3B03"] },
    ],
  },
  {
    id: "asm-gbs",
    name: "GBS",
    assyShop: "GBS",
    bays: [
      { bayNo: 1, code: "GB1B", groupName: "GBS 1BAY내", unitLevel: "assembly", yardLots: ["GB1B01", "GB1B02", "GB1B03"] },
      { bayNo: 2, code: "GB2B", groupName: "GBS 2BAY내", unitLevel: "assembly", yardLots: ["GB2B01", "GB2B02", "GB2B03"] },
      { bayNo: 3, code: "GB3B", groupName: "GBS 3BAY내", unitLevel: "assembly", yardLots: ["GB3B01", "GB3B02", "GB3B03"] },
    ],
  },
  {
    id: "asm-of3",
    name: "해양제작3공장",
    assyShop: "OF3",
    bays: [
      { bayNo: 1, code: "OF", groupName: "해양제작 3공장", unitLevel: "assembly", yardLots: ["OF3001", "OF3002", "OF3003"] },
    ],
  },
  {
    id: "asm-of2",
    name: "해양제작2공장",
    assyShop: "OF2",
    bays: [
      { bayNo: 1, code: "OF", groupName: "해양제작 2공장", unitLevel: "assembly", yardLots: ["OF2001", "OF2002", "OF2003"] },
    ],
  },
]
