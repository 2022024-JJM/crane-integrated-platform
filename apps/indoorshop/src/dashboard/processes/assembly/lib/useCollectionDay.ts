import { useSearchParams } from 'react-router-dom'
import { parseDateParams, todayString } from '../../../shared/features/performance/lib/baseDate'

/*
 * **이 화면의 수치가 어느 날 것인가** (W7-7-5 부기).
 *
 * 통합실적은 기준일을 되감을 수 있고(W7-2), 그 선택은 `?date=` 로 주소에 실린다. 그런데
 * 조립 공장 목록·일일 생산은 **아직 그 기준일을 따르지 않는다** — 수치가 언제나 오늘
 * 수집분이다(연계 매트릭스 T5·T7 의 이행 대상이고, 그건 이 작업의 범위가 아니다).
 *
 * 문제는 그 상태에서 라벨이 '오늘 완료' 라고만 말한다는 것이다. 기준일을 8월 20일로
 * 되감아 둔 사람이 이 화면에 오면 '오늘' 이 무엇을 가리키는지 알 수 없다 — 자기가 고른
 * 날인지, 진짜 오늘인지.
 *
 * 그래서 **말을 갈라 준다**:
 *   기준일 = 오늘  → '오늘 완료' (지금까지 그대로. 군더더기를 만들지 않는다)
 *   기준일 ≠ 오늘  → '{{date}} 완료' 로 **수치의 실제 날짜**를 박고, 화면이 아직 기준일을
 *                    따르지 않는다는 사실을 한 줄로 말한다.
 *
 * ⚠️ 날짜 자리에 **기준일을 넣지 않는다.** 수치는 오늘 것인데 라벨만 8월 20일로 적으면,
 *    지금의 애매함이 명백한 거짓말로 바뀐다. 라벨은 언제나 **가진 데이터의 날짜**를 말한다.
 */

export interface CollectionDay {
  /** 지금 보고 있는 수치의 날짜 — 지금은 언제나 오늘이다 */
  dataDate: string
  /** 주소가 가리키는 기준일 */
  baseDate: string
  /** 둘이 같은가 — 다르면 화면이 그 사실을 말해야 한다 */
  followsBaseDate: boolean
}

export function useCollectionDay(): CollectionDay {
  const [searchParams] = useSearchParams()
  const today = todayString()
  const baseDate = parseDateParams(searchParams, today).date
  /* W7-2 머지 이후 조립 수집 경로도 기준일 축을 따른다 — dataDate 는 곧 기준일이다.
   * followsBaseDate 는 이제 '오늘인가'의 뜻으로만 쓰인다: 오늘이면 '오늘 완료',
   * 되감았으면 '{{date}} 완료'(그 날짜가 데이터의 실제 날짜이므로 진실). */
  return { dataDate: baseDate, baseDate, followsBaseDate: baseDate === today }
}
