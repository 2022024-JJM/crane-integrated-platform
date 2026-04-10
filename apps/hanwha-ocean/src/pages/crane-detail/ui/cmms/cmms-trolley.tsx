import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCmmsMockData } from '../../model/mock-data';
import type { CmmsTrolleyUnit } from '../../model/types';
import { CmmsPanel } from '@crane/ui/molecules/cmms-panel';
import { CmmsStatusLamp } from '@crane/ui/molecules/cmms-status-lamp';
import { CmmsValueRow } from '@crane/ui/molecules/cmms-value-row';
import { RunFaultBadge, OnOffBadge } from '@crane/ui/molecules/cmms-status-badge';

export function CmmsTrolley() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).trolley;

  return (
    <div className="h-full flex flex-col gap-2 p-3 bg-background text-foreground overflow-hidden">
      {/* Row 1: UPPER / LOWER TROLLEY 2컬럼 */}
      <div className="flex gap-2 flex-1 min-h-0 overflow-hidden">
        {([
          { title: t('trolley.upperTrolley'), unit: data.upperTrolley },
          { title: t('trolley.lowerTrolley'), unit: data.lowerTrolley },
        ]).map(({ title, unit }) => (
          <div key={title} className="flex-1 flex flex-col gap-2 min-w-0 overflow-y-auto">
            <TrolleyColumn title={title} unit={unit} t={t} />
          </div>
        ))}
      </div>

      {/* Row 2: Position / Brake / Upper LS Hoisting Cap / Pin — 4컬럼 */}
      <div className="flex gap-2 shrink-0">
        {/* POSITION */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('trolley.panels.position')}>
            {([
              [t('trolley.panels.fpSafetyStopRelay'), data.position.fpSafetyStopRelay],
              [t('trolley.panels.fpEndStopMgsw'),     data.position.fpEndStopMgsw],
              [t('trolley.panels.fpSlowdownMgsw'),    data.position.fpSlowdownMgsw],
              [t('trolley.panels.parkingPosition'),   data.position.parkingPosition],
              [t('trolley.panels.ppSlowdownMgsw'),    data.position.ppSlowdownMgsw],
              [t('trolley.panels.ppEndStopMgsw'),     data.position.ppEndStopMgsw],
              [t('trolley.panels.ppSafetyStopRelay'), data.position.ppSafetyStopRelay],
            ] as [string, ('ON' | 'OFF')[]][]).map(([label, arr]) => (
              <BadgeRow key={label} label={label} badges={arr} />
            ))}
          </CmmsPanel>
        </div>

        {/* BRAKE */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('trolley.panels.brake')}>
            <BadgeRow label={t('trolley.panels.brakeMc')}     badges={data.brake.brakeMc} />
            <BadgeRow label={t('trolley.panels.brake12Cb')}   badges={data.brake.brake12Cb} />
            <BadgeRow label={t('trolley.panels.brake34Cb')}   badges={[data.brake.brake34Cb]} />
            <BadgeRow label={t('trolley.panels.brake12Open')} badges={data.brake.brake12Open} />
            <BadgeRow label={t('trolley.panels.brake34Open')} badges={[data.brake.brake34Open]} />
          </CmmsPanel>
        </div>

        {/* UPPER LS HOISTING CAP */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('trolley.panels.upperLsHoistingCap')}>
            <CmmsStatusLamp label={t('trolley.panels.mgsw550660fp')} status={data.upperLsHoistingCap.mgsw550660fp} />
            <CmmsStatusLamp label={t('trolley.panels.mgsw550660pp')} status={data.upperLsHoistingCap.mgsw550660pp} />
            <CmmsStatusLamp label={t('trolley.panels.mgsw660750fp')} status={data.upperLsHoistingCap.mgsw660750fp} />
            <CmmsStatusLamp label={t('trolley.panels.mgsw660750pp')} status={data.upperLsHoistingCap.mgsw660750pp} />
          </CmmsPanel>
        </div>

        {/* PIN */}
        <div className="flex-1 min-w-0">
          <CmmsPanel title={t('trolley.panels.pin')}>
            <CmmsStatusLamp label={t('trolley.panels.upperTrolleyLockedH1')} status={data.pin.upperTrolleyLockedH1} />
            <CmmsStatusLamp label={t('trolley.panels.upperTrolleyLockedH2')} status={data.pin.upperTrolleyLockedH2} />
            <CmmsStatusLamp label={t('trolley.panels.lowerTrolleyLockedWs')} status={data.pin.lowerTrolleyLockedWs} />
            <CmmsStatusLamp label={t('trolley.panels.lowerTrolleyLockedLs')} status={data.pin.lowerTrolleyLockedLs} />
          </CmmsPanel>
        </div>
      </div>
    </div>
  );
}

function TrolleyColumn({ title, unit, t }: { title: string; unit: CmmsTrolleyUnit; t: (k: string) => string }) {
  return (
    <>
      {/* 헤더 */}
      <div className="flex items-stretch rounded border border-border bg-card overflow-hidden shrink-0">
        <div className="w-1 bg-sky-500 shrink-0" />
        <div className="flex-1 flex items-center justify-between px-3 py-2 bg-muted/60">
          <span className="text-sm font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">{title}</span>
          <RunFaultBadge value={unit.runFault} />
        </div>
      </div>

      {/* 수치 */}
      <div className="rounded border border-border bg-card px-3 py-1 shrink-0">
        <CmmsValueRow label={t('trolley.joystickStep')} value={unit.joystickStep} />
        <CmmsValueRow label={t('trolley.speedRef')}     value={unit.speedRef.toFixed(2)} />
        <CmmsValueRow label={t('trolley.actSpeed')}     value={unit.actSpeed.toFixed(2)} />
        <CmmsValueRow label={t('trolley.current')}      value={unit.current.toFixed(1)} />
        <CmmsValueRow label={t('trolley.driveFault')}   value={unit.driveFault} highlight={unit.driveFault !== '!'} />
        <CmmsValueRow label={t('trolley.position')}     value={unit.position.toFixed(1)} />
      </div>

      {/* 상태 비트 */}
      <div className="rounded border border-border bg-card px-3 py-1 shrink-0">
        <CmmsStatusLamp label={t('trolley.mechStopRelay')}         status={unit.mechStopRelay} />
        <CmmsStatusLamp label={t('trolley.driveFaultBit')}         status={unit.driveFaultBit} />
        <CmmsStatusLamp label={t('trolley.driveMainCb')}           status={unit.driveMainCb} />
        <CmmsStatusLamp label={t('trolley.driveFanCb')}            status={unit.driveFanCb} />
        <CmmsStatusLamp label={t('trolley.fieldCb')}               status={unit.fieldCb} />
        <CmmsStatusLamp label={t('trolley.driveMainMc')}           status={unit.driveMainMc} />
        <CmmsStatusLamp label={t('trolley.driveFanMc')}            status={unit.driveFanMc} />
        <CmmsStatusLamp label={t('trolley.driveFieldMc')}          status={unit.driveFieldMc} />
        <CmmsStatusLamp label={t('trolley.driveMainFuseBlown')}    status={unit.driveMainFuseBlown} />
        <CmmsStatusLamp label={t('trolley.driveFieldFuseBlown')}   status={unit.driveFieldFuseBlown} />
        <CmmsStatusLamp label={t('trolley.driveOutputFuseBlown')}  status={unit.driveOutputFuseBlown} />
        <CmmsStatusLamp label={t('trolley.motor12FieldMonitor')}   status={unit.motor12FieldMonitor} />
        <CmmsStatusLamp label={t('trolley.motor34FieldMonitor')}   status={unit.motor34FieldMonitor} />
        <CmmsStatusLamp label={t('trolley.motor1Overtemp')}        status={unit.motor1Overtemp} />
        <CmmsStatusLamp label={t('trolley.motor2Overtemp')}        status={unit.motor2Overtemp} />
        <CmmsStatusLamp label={t('trolley.motor3Overtemp')}        status={unit.motor3Overtemp} />
        <CmmsStatusLamp label={t('trolley.motor4Overtemp')}        status={unit.motor4Overtemp} />
        <CmmsStatusLamp label={t('trolley.eStopPb')}               status={unit.eStopPb} variant="ok-ng" />
      </div>
    </>
  );
}

function BadgeRow({ label, badges }: { label: string; badges: readonly string[] }) {
  const isMulti = badges.length > 1;
  return (
    <div className={`py-1 border-b border-border last:border-0 ${isMulti ? 'flex flex-col gap-1' : 'flex items-center justify-between gap-2'}`}>
      <span className="text-xs text-foreground">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {badges.map((v, i) => <OnOffBadge key={i} value={v as 'ON' | 'OFF'} />)}
      </div>
    </div>
  );
}
