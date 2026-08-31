import type { OutfittingFactoryOverview } from '../model/block'
import { OutfittingFactoryCard } from './OutfittingFactoryCard'

/**
 * 공장 카드 격자.
 *
 * 열 수를 breakpoint 로 못 박지 않고 카드 폭(20~23rem)으로 정한다 — 화면이 넓어져도
 * 카드가 같이 커지지 않고 다음 카드를 채운다 (공장이 늘어도 그대로 맞는다).
 */
export function OutfittingFactoryGrid({
  overviews,
}: {
  overviews: OutfittingFactoryOverview[]
}) {
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,20rem),23rem))]">
      {overviews.map((overview) => (
        <OutfittingFactoryCard key={overview.factory.id} overview={overview} />
      ))}
    </div>
  )
}
