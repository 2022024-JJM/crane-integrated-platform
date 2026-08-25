import { useTranslation } from '../../../../lib/i18n/useTranslation'
import type { Zone } from '../../../../entities/zone/model/types'
import { Card, CardContent, CardFooter, CardHeader } from '../../../../ui/atoms/Card'
import { LinkButton } from '../../../../ui/atoms/Button'
import { StatusBadge } from '../../../../entities/zone/ui/StatusBadge'
import { HealthBadge } from '../../../../entities/zone/ui/HealthBadge'
import { ZoneCheckList } from '../../../../entities/zone/ui/ZoneCheckList'

interface ZoneCardProps {
  zone: Zone
}

/**
 * 공정존 카드.
 *
 * 배지 두 개("실행 중" · "정상")만 나란히 두면 둘이 같은 말로 보인다 — 그래서
 * **무엇에 대한 판정인지**(서비스 / 수집 품질)를 왼쪽에 이름표로 세우고,
 * 오른쪽에 배지, 그 아래에 그렇게 판정한 근거를 한 줄씩 붙인다.
 */
export function ZoneCard({ zone }: ZoneCardProps) {
  const { t } = useTranslation()

  return (
    <Card interactive className="flex flex-col">
      <CardHeader className="flex flex-col gap-1">
        <h3 className="text-inshop-base font-semibold text-foreground">{t(zone.displayNameKey)}</h3>
        {zone.source && (
          <p className="font-mono text-2xs text-foreground/54">{zone.source}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-3.5">
        <div className="space-y-2.5 rounded-inshop-md bg-surface-secondary/70 p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-inshop-xs font-medium text-foreground/58">{t('zone.service')}</span>
              <StatusBadge status={zone.status} />
            </div>
            <p className="mt-1 text-inshop-xs leading-relaxed text-foreground/70">{t(zone.statusDetailKey)}</p>
          </div>

          <div className="border-t border-border/70 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-inshop-xs font-medium text-foreground/58">{t('zone.quality')}</span>
              <HealthBadge health={zone.health} />
            </div>
            <p className="mt-1 text-inshop-xs leading-relaxed text-foreground/70">{t(zone.healthDetailKey)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-inshop-xs font-medium text-foreground/58">{t('zone.processing')}</p>
            {/* 값은 잉크 토큰을 입는다 — 강조색은 링크·활성 표시의 몫이고,
                수치에 쓰면 대비가 떨어지면서 "이 숫자만 특별하다"는 오독을 부른다 */}
            <p className="mt-1 text-inshop-2xl font-semibold leading-none text-foreground">
              {zone.processingCount}
            </p>
          </div>
          <div>
            <p className="text-inshop-xs font-medium text-foreground/58">{t('zone.lastCollected')}</p>
            <p className="mt-1 text-inshop-sm font-medium text-foreground/80">{t(zone.lastUpdateKey)}</p>
          </div>
        </div>

        <ZoneCheckList checks={zone.checks} className="border-t border-border pt-3" />
      </CardContent>

      <CardFooter>
        <LinkButton to={`/indoorshop/zones/${zone.id}`} className="flex-1">
          {t('zone.viewDetail')}
        </LinkButton>
      </CardFooter>
    </Card>
  )
}
