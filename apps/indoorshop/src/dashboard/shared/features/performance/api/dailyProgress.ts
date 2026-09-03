/*
 * 도장 **일일 그레인** — `YPWG413M`(일일작업실적내역) 문법의 더미 레이어 (W5-9).
 *
 * 왜 별도 축인가: `YPWP720M`/`YPWP710M` 은 행이 완료됐는지 아닌지(`FD_ACTL`)만 말한다.
 * 진행 중인 행이 "얼마나 됐는지"는 `YPWG413M` 의 **`DLY_PRGS_RATE`(일일공정률)** 에만
 * 있다. 그래서 카드의 '진행중 %' 는 이 축에서 온다.
 *
 * 명세(「Legacy SAP 테이블·필드 정리(도장)」, SE12 확인 완료):
 *   키        `ACTL_DATE` + `WORK_ORD_NO` + `WORK_OGAN_CODE`
 *   핵심 필드 `DLY_PRGS_RATE`(일일공정률) · `ACTL_DIR_MH`(실적직접시수) ·
 *            `CMPL_MV`(처리물량) · `INSP_INDC`(검사여부)
 *
 * **등록은 하루 1회 일괄이다**(2026-09-03 현업 회의). 그래서 이 더미는 오늘치를 만들지
 * 않는다 — 가장 최신 실적일이 언제나 **어제**다. 화면이 "지금 이 순간"을 말하는 것처럼
 * 보이면 안 되기 때문에, 이 배치 지연을 데이터 모양 자체에 넣어 둔다.
 *
 * ⚠️ `YPWG413M` 과 확정 관문 `YPWG221M` 의 관계(등록 순서·중복·마감 주체)는 미확정이다
 * (dataflow §5·§8). 여기서는 **진행률 재료로만** 쓰고 완료·확정 판정에는 쓰지 않는다.
 */

/** 결정적 의사난수 — performanceApi 와 같은 문법 */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

function shiftDate(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** YPWG413M 한 행 — 하루치 등록분 */
export interface DailyProgressRow {
  /** ACTL_DATE — 실적일자 */
  actlDate: string
  /** WORK_ORD_NO — 작업지시번호 */
  workOrdNo: string
  /** WORK_OGAN_CODE — 작업조직 (직영/협력) */
  workOganCode: string
  /** DLY_PRGS_RATE — 일일공정률(누적, 0~100) */
  dlyPrgsRate: number
  /** ACTL_DIR_MH — 실적직접시수 */
  actlDirMh: number
  /** CMPL_MV — 처리물량 */
  cmplMv: number
  /** INSP_INDC — 검사여부 */
  inspIndc: boolean
}

/** 작업조직 후보 — 720M 의 `RPST_WORK_OGAN` 과 같은 문법(직영/협력 코드) */
const WORK_OGAN_CODES = ['AUB4', 'AUC1', 'BPD2', 'BPE7'] as const

/**
 * **배치 기준일 = 어제.** 등록이 하루 1회 일괄이므로 오늘치는 아직 없다.
 * 화면의 '어제 등록분 기준' 단서가 이 값을 가리킨다.
 */
export function latestBatchDate(baseDate: string): string {
  return shiftDate(baseDate, -1)
}

/**
 * W/O 하나의 일일공정률 이력을 만든다 — 최신 실적일이 `latestBatchDate` 를 넘지 않는다.
 *
 * `targetRate` 까지 며칠에 걸쳐 **단조 증가**로 오른다(예: 3일치 40 → 65 → 80).
 * 착수일(`startDate`)보다 앞선 날짜는 만들지 않는다.
 */
export function generateDailyProgress(opts: {
  workOrdNo: string
  baseDate: string
  /** 최신 등록분의 누적 공정률 (0~100) */
  targetRate: number
  /** 착수일 — 이보다 앞선 등록은 없다 */
  startDate: string | null
  seed: string
}): DailyProgressRow[] {
  const { workOrdNo, baseDate, targetRate, startDate, seed } = opts
  if (targetRate <= 0) return []
  const lastDate = latestBatchDate(baseDate)
  if (startDate != null && startDate > lastDate) return []

  /* 3~5일치 — 하루 1회 일괄이라 진행 중 W/O 에는 며칠치 이력이 쌓여 있는 게 정상이다.
     착수일이 그보다 늦으면 아래 루프가 잘라 낸다(막 시작한 W/O 는 하루치뿐). */
  const days = 3 + (hashOf(`${seed}-days`) % 3)
  const oganCode = WORK_OGAN_CODES[hashOf(`${seed}-ogan`) % WORK_OGAN_CODES.length]

  const rows: DailyProgressRow[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const actlDate = shiftDate(lastDate, -i)
    if (startDate != null && actlDate < startDate) continue
    /* 마지막 날이 targetRate, 앞선 날은 그 아래로 단조 증가하게 깎는다 */
    const stepDown = (i * targetRate) / (days + 1)
    const jitter = (hashOf(`${seed}-${actlDate}`) % 5) - 2
    const rate = Math.max(1, Math.min(targetRate, Math.round(targetRate - stepDown + jitter)))
    rows.push({
      actlDate,
      workOrdNo,
      workOganCode: oganCode,
      dlyPrgsRate: rate,
      actlDirMh: Math.round((rate / 10 + (hashOf(`${seed}-mh-${actlDate}`) % 30)) * 10) / 10,
      cmplMv: Math.round(rate * (1 + (hashOf(`${seed}-mv-${actlDate}`) % 4))),
      inspIndc: rate >= 100,
    })
  }
  /* 단조 증가 보장 — jitter 가 순서를 뒤집지 않도록 앞에서부터 눌러 준다 */
  for (let i = 1; i < rows.length; i += 1) {
    rows[i].dlyPrgsRate = Math.max(rows[i].dlyPrgsRate, rows[i - 1].dlyPrgsRate)
  }
  return rows
}

/** 최신 등록분 — 이력이 없으면 null (413M 등록 전인 W/O) */
export function latestProgressOf(
  rows: readonly DailyProgressRow[]
): { rate: number; asOf: string } | null {
  if (rows.length === 0) return null
  const latest = rows.reduce((a, b) => (b.actlDate > a.actlDate ? b : a))
  return { rate: latest.dlyPrgsRate, asOf: latest.actlDate }
}
