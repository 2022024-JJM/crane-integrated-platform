import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCmmsMockData } from '../../model/mock-data';
import type { CmmsHoistUnit } from '../../model/types';
import { CmmsPanel } from '@crane/ui/molecules/cmms-panel';
import { CmmsStatusLamp } from '@crane/ui/molecules/cmms-status-lamp';
import { CmmsValueRow } from '@crane/ui/molecules/cmms-value-row';
import { RunFaultBadge, OnOffBadge } from '@crane/ui/molecules/cmms-status-badge';

export function CmmsHoist() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const d = getCmmsMockData(craneId).hoist;
  const units: CmmsHoistUnit[] = [d.hoist1, d.hoist2, d.hoist3];

  return (
    <div className="h-full flex flex-col gap-2 p-3 bg-background text-foreground overflow-hidden">
      {/* Row 1: HOIST #1 / #2 / #3 컬럼 */}
      <div className="flex gap-2 flex-1 min-h-0 overflow-hidden">
        {units.map((unit, idx) => (
          <div key={idx} className="flex-1 min-w-0 flex flex-col gap-2 overflow-y-auto">

            {/* 헤더 */}
            <div className="flex items-stretch rounded border border-border bg-card overflow-hidden shrink-0">
              <div className="w-1 bg-sky-500 shrink-0" />
              <div className="flex-1 flex items-center justify-between px-3 py-2 bg-muted/60">
                <span className="text-sm font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">
                  {t('hoist.title')} #{idx + 1}
                </span>
                <RunFaultBadge value={unit.runFault} />
              </div>
            </div>

            {/* 수치 */}
            <div className="rounded border border-border bg-card px-3 py-1 shrink-0">
              <CmmsValueRow label={t('hoist.joystickStep')} value={unit.joystickStep} />
              <CmmsValueRow label={t('hoist.speedRef')}     value={unit.speedRef.toFixed(2)} />
              <CmmsValueRow label={t('hoist.actSpeed')}     value={unit.actSpeed.toFixed(2)} />
              <CmmsValueRow label={t('hoist.current')}      value={unit.current.toFixed(1)} />
              <CmmsValueRow label={t('hoist.driveFault')}   value={unit.driveFault} highlight={unit.driveFault !== '!'} />
              <CmmsValueRow label={t('hoist.position')}     value={unit.position.toFixed(1)} />
              <CmmsValueRow label={t('hoist.load')}         value={unit.load.toFixed(1)} />
              <CmmsValueRow label={t('hoist.motorTemp')}    value={unit.motorTemp.toFixed(1)} />
            </div>

            {/* 상태 비트 */}
            <div className="rounded border border-border bg-card px-3 py-1 shrink-0">
              <CmmsStatusLamp label={t('hoist.mechStopRelay')}       status={unit.mechStopRelay} />
              <CmmsStatusLamp label={t('hoist.driveFaultBit')}       status={unit.driveFaultBit} />
              <CmmsStatusLamp label={t('hoist.driveMainCb')}         status={unit.driveMainCb} />
              <CmmsStatusLamp label={t('hoist.driveFanCb')}          status={unit.driveFanCb} />
              <CmmsStatusLamp label={t('hoist.fieldCb')}             status={unit.fieldCb} />
              <CmmsStatusLamp label={t('hoist.driveMainMc')}         status={unit.driveMainMc} />
              <CmmsStatusLamp label={t('hoist.driveFanMc')}          status={unit.driveFanMc} />
              <CmmsStatusLamp label={t('hoist.driveFieldMc')}        status={unit.driveFieldMc} />
              <CmmsStatusLamp label={t('hoist.driveFieldFuseBlown')} status={unit.driveFieldFuseBlown} />
              <CmmsStatusLamp label={t('hoist.motorFanMainCb')}      status={unit.motorFanMainCb} />
              <CmmsStatusLamp label={t('hoist.motorFanMc')}          status={unit.motorFanMc} />
              <CmmsStatusLamp label={t('hoist.lubricationMotorCb')}  status={unit.lubricationMotorCb} />
              <CmmsStatusLamp label={t('hoist.eStopPb')}             status={unit.eStopPb} variant="ok-ng" />
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: 하중 / 과속 / 로프시브 / 위치 / 브레이크 — 5컬럼 */}
      <div className="flex gap-2 shrink-0">
        {/* 하중 */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('hoist.panels.load')}>
            <CmmsValueRow label={t('hoist.panels.totalLoad')} value={d.load.totalLoad.toFixed(1)} />
            <CmmsValueRow label={t('hoist.panels.h1h2Diff')}  value={d.load.h1h2Diff.toFixed(1)} />
            <BadgeRow label={t('hoist.panels.overloadWarning')}      badges={d.load.overloadWarning} />
            <BadgeRow label={t('hoist.panels.overloadTrip')}         badges={d.load.overloadTrip} />
            <BadgeRow label={t('hoist.panels.totalOverloadWarning')} badges={[d.load.totalOverloadWarning]} />
            <BadgeRow label={t('hoist.panels.totalOverloadTrip')}    badges={[d.load.totalOverloadTrip]} />
          </CmmsPanel>
        </div>

        {/* 과속 */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('hoist.panels.overspeed')}>
            <BadgeRow label={t('hoist.panels.fsl')}      badges={d.overspeed.overspeedFsl} />
            <BadgeRow label={t('hoist.panels.esl')}      badges={d.overspeed.overspeedEsl} />
            <BadgeRow label={t('hoist.panels.monitor1')} badges={d.overspeed.overspeedMonitor1} />
            <BadgeRow label={t('hoist.panels.monitor2')} badges={d.overspeed.overspeedMonitor2} />
          </CmmsPanel>
        </div>

        {/* 로프 시브 */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('hoist.panels.ropeSheave')}>
            <CmmsStatusLamp label={t('hoist.panels.ropeSheaveH1Cb')} status={d.ropeSheave.ropeSheaveH1Cb} />
            <CmmsStatusLamp label={t('hoist.panels.ropeSheaveH2Cb')} status={d.ropeSheave.ropeSheaveH2Cb} />
            <CmmsStatusLamp label={t('hoist.panels.wsMc')}           status={d.ropeSheave.wsMc} />
            <CmmsStatusLamp label={t('hoist.panels.lsMc')}           status={d.ropeSheave.lsMc} />
            <CmmsStatusLamp label={t('hoist.panels.wsEndStop')}      status={d.ropeSheave.wsEndStop} />
            <CmmsStatusLamp label={t('hoist.panels.lsEndStop')}      status={d.ropeSheave.lsEndStop} />
          </CmmsPanel>
        </div>

        {/* 위치 */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('hoist.panels.position')}>
            {([
              [t('hoist.panels.upSafetyStop'),  d.position.upSafetyStop],
              [t('hoist.panels.upNormalStop'),  d.position.upNormalStop],
              [t('hoist.panels.upSlowdown'),    d.position.upSlowdown],
              [t('hoist.panels.downSlowdown'),  d.position.downSlowdown],
              [t('hoist.panels.downNormalStop'),d.position.downNormalStop],
              [t('hoist.panels.downSafetyStop'),d.position.downSafetyStop],
            ] as [string, ('ON'|'OFF')[]][]).map(([label, arr]) => (
              <BadgeRow key={label} label={label} badges={arr} />
            ))}
          </CmmsPanel>
        </div>

        {/* 브레이크 */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('hoist.panels.brake')}>
            {([
              [t('hoist.panels.brakeCb'),    d.brake.brakeCb],
              [t('hoist.panels.brakeMc'),    d.brake.brakeMc],
              [t('hoist.panels.brake1Open'), d.brake.brake1Open],
              [t('hoist.panels.brake2Open'), d.brake.brake2Open],
            ] as [string, ('ON'|'OFF')[]][]).map(([label, arr]) => (
              <BadgeRow key={label} label={label} badges={arr} />
            ))}
          </CmmsPanel>
        </div>
      </div>
    </div>
  );
}

function BadgeRow({ label, badges }: { label: string; badges: readonly string[] }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border last:border-0">
      <span className="text-xs text-foreground shrink-0">{label}</span>
      <div className="flex gap-1 shrink-0">
        {badges.map((v, i) => <OnOffBadge key={i} value={v as 'ON' | 'OFF'} />)}
      </div>
    </div>
  );
}
