import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { statusUnit } from '../model/equipmentStatus'
import type { BaySceneItem } from '../lib/bayScene'
import { EquipmentChip } from './equipmentIcon'

/*
 * 고른 베이 하나의 **상세** — 3D 라벨이 줄 하나로 말한 것을 펼친다 (R38).
 *
 * 라벨에 다 적지 않는 이유는 겹침이다. 26면짜리 공장에서 카드마다 설비 목록이 붙으면
 * 화면이 카드로 덮인다. 그래서 라벨은 **한눈에 필요한 것**(이름·가동 대수·온습도·재실)만
 * 이고, 설비 한 대씩의 값은 눌러서 본다 — 조립 뷰가 정반 라벨을 눌러 단독 뷰로 들어가는
 * 것과 같은 층위다.
 *
 * 뷰포트 위 오버레이지만 **그리기 경로가 아니다** — React 로 그리고, 여는 것은 라벨
 * 클릭(=이벤트)뿐이다. 프레임 안에서 이 컴포넌트를 건드리는 코드는 없다.
 */

export function PaintingBayDetail({
  item,
  onClose,
}: {
  item: BaySceneItem
  onClose: () => void
}) {
  const { t } = useTranslation()
  const env = item.air?.env
  const units = item.air?.units ?? []

  return (
    <aside
      className="absolute left-3 top-20 z-10 flex max-h-[70%] w-64 flex-col gap-2 overflow-y-auto rounded-inshop-md bg-black/70 px-3 py-2.5 text-2xs text-white/80 backdrop-blur-sm"
      aria-label={t('painting.airView.bayDetailTitle', { bay: item.label })}
    >
      <header className="flex items-start justify-between gap-2">
        <span className="text-inshop-xs font-semibold text-white">{item.label}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          {t('painting.airView.close')}
        </button>
      </header>

      {/* 환경 — 값이 없으면 0 을 적지 않는다(끊긴 설비의 마지막 값은 지금 값이 아니다) */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tabular-nums">
        <dt className="text-white/45">{t('painting.airView.detailTemp')}</dt>
        <dd>
          {env?.tempC != null
            ? `${env.tempC}°C${env.tempSetpoint != null ? ` / ${env.tempSetpoint}` : ''}`
            : t('painting.airView.bayEnvNone')}
        </dd>
        <dt className="text-white/45">{t('painting.airView.detailHumidity')}</dt>
        <dd>
          {env?.humidityRh != null
            ? `${env.humidityRh}%RH${env.humiditySetpoint != null ? ` / ${env.humiditySetpoint}` : ''}`
            : t('painting.airView.bayEnvNone')}
        </dd>
        <dt className="text-white/45">{t('painting.airView.detailRunning')}</dt>
        <dd>
          {t('painting.airView.bayRunning', {
            running: item.runningCount,
            total: item.unitCount,
          })}
        </dd>
      </dl>

      {/* 설비 — 한 대씩. 자리(벽면·코너)는 배치 규칙이 정한 것이라 여기서 말하지 않는다 */}
      {units.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-white/45">{t('painting.airView.detailUnits')}</h3>
          <ul className="flex flex-col gap-1">
            {units.map((unit) => (
              <li key={unit.id} className="flex items-center gap-1.5">
                <EquipmentChip kind={unit.kind} size={14} />
                <span className="font-mono text-white/70">{unit.id}</span>
                <span className="ml-auto tabular-nums text-white/60">
                  {unit.value != null
                    ? `${unit.value}${statusUnit(unit.kind)}${unit.setpoint != null ? ` / ${unit.setpoint}` : ''}`
                    : t('painting.airView.bayEnvNone')}
                </span>
                <span className={unit.running ? 'text-white/80' : 'text-white/35'}>
                  {unit.running
                    ? t('painting.airView.unitRunning')
                    : t('painting.airView.unitStopped')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 재실 블록 — BTS 귀속(로스터)이 근거다 */}
      <section className="flex flex-col gap-1">
        <h3 className="text-white/45">{t('painting.airView.detailBlocks')}</h3>
        {item.occupants.length === 0 ? (
          <p className="text-white/40">{t('painting.airView.bayNoBlock')}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {item.occupants.map((block) => (
              <li key={block.key} className="flex items-center gap-1.5">
                <span className="font-mono text-white/75">{block.key}</span>
                {block.justArrived && (
                  <span className="rounded bg-white/10 px-1 text-white/60">
                    {t('painting.airView.bayArrived')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
