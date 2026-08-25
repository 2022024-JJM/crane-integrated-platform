import type { FactoryOverview } from '../../model/types'
import { FactoryCard } from '../molecules/FactoryCard'

interface FactoryGridProps {
  overviews: FactoryOverview[]
}

/**
 * 공장 카드 격자.
 *
 * 열 수를 breakpoint 로 못 박지 않고 **카드 폭**으로 정한다.
 * `2열` 처럼 고정하면 화면이 넓어질수록 카드가 같이 커지는데, 이 카드의 내용
 * (지표 타일 셋 + 정반 줄)은 380px 언저리에서 이미 다 읽힌다 — 그 이상은 여백만
 * 벌어져 "카드가 크다"는 인상만 남는다. 그래서 22~24rem 사이로 묶고, 남는 폭은
 * 카드를 늘리는 대신 다음 카드를 채우는 데 쓴다 (공장이 늘어도 그대로 맞는다).
 */
export function FactoryGrid({ overviews }: FactoryGridProps) {
  return (
    /*
     * auto-fill 의 열 개수는 트랙의 **최대**(23rem)로 계산된다 — 최대를 크게 잡으면
     * 한 장이 더 들어갈 폭이 남아도 열이 안 늘어나고 그만큼이 빈자리로 남는다.
     * 그래서 최대를 23rem 으로 좁게 묶었다 (2열 ≈ 756px, 3열 ≈ 1124px 부터).
     */
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),23rem))]">
      {overviews.map((overview) => (
        <FactoryCard key={overview.factory.id} overview={overview} />
      ))}
    </div>
  )
}
