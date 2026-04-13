import { useTranslation } from 'react-i18next';
import { getCmmsMockData } from '../../model/mock-data';
import type { CmmsTrolleyUnit } from '../../model/types';
import { CmmsPanel } from '@crane/ui/molecules/cmms-panel';
import { CmmsStatusLamp } from '@crane/ui/molecules/cmms-status-lamp';
import { CmmsValueRow } from '@crane/ui/molecules/cmms-value-row';
import { RunFaultBadge } from '@crane/ui/molecules/cmms-status-badge';
import { CmmsBadgeRow } from '@crane/ui/molecules/cmms-badge-row';

interface CmmsTrolleyInlineProps {
  craneId: string;
}

export function CmmsTrolleyInline({ craneId }: CmmsTrolleyInlineProps) {
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).trolley;

  return (
    <div className="flex flex-col gap-2 p-3 bg-background text-foreground">
      {/* UPPER / LOWER TROLLEY — 세로 스택 */}
      {([
        { title: t('trolley.upperTrolley'), unit: data.upperTrolley },
        { title: t('trolley.lowerTrolley'), unit: data.lowerTrolley },
      ]).map(({ title, unit }) => (
        <TrolleyColumn key={title} title={title} unit={unit} t={t} />
      ))}

      {/* 하단 종합 패널 — 2열 그리드 */}
      <div className="grid grid-cols-2 gap-2">
        {/* POSITION */}
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
            <CmmsBadgeRow key={label} label={label} badges={arr as ('ON' | 'OFF')[]} stacked />
          ))}
        </CmmsPanel>

        {/* BRAKE */}
        <CmmsPanel title={t('trolley.panels.brake')}>
          <CmmsBadgeRow label={t('trolley.panels.brakeMc')}     badges={data.brake.brakeMc}       stacked />
          <CmmsBadgeRow label={t('trolley.panels.brake12Cb')}   badges={data.brake.brake12Cb}     stacked />
          <CmmsBadgeRow label={t('trolley.panels.brake34Cb')}   badges={[data.brake.brake34Cb]}   stacked />
          <CmmsBadgeRow label={t('trolley.panels.brake12Open')} badges={data.brake.brake12Open}   stacked />
          <CmmsBadgeRow label={t('trolley.panels.brake34Open')} badges={[data.brake.brake34Open]} stacked />
        </CmmsPanel>

        {/* UPPER LS HOISTING CAP */}
        <CmmsPanel title={t('trolley.panels.upperLsHoistingCap')}>
          <CmmsStatusLamp label={t('trolley.panels.mgsw550660fp')} status={data.upperLsHoistingCap.mgsw550660fp} />
          <CmmsStatusLamp label={t('trolley.panels.mgsw550660pp')} status={data.upperLsHoistingCap.mgsw550660pp} />
          <CmmsStatusLamp label={t('trolley.panels.mgsw660750fp')} status={data.upperLsHoistingCap.mgsw660750fp} />
          <CmmsStatusLamp label={t('trolley.panels.mgsw660750pp')} status={data.upperLsHoistingCap.mgsw660750pp} />
        </CmmsPanel>

        {/* PIN */}
        <CmmsPanel title={t('trolley.panels.pin')}>
          <CmmsStatusLamp label={t('trolley.panels.upperTrolleyLockedH1')} status={data.pin.upperTrolleyLockedH1} />
          <CmmsStatusLamp label={t('trolley.panels.upperTrolleyLockedH2')} status={data.pin.upperTrolleyLockedH2} />
          <CmmsStatusLamp label={t('trolley.panels.lowerTrolleyLockedWs')} status={data.pin.lowerTrolleyLockedWs} />
          <CmmsStatusLamp label={t('trolley.panels.lowerTrolleyLockedLs')} status={data.pin.lowerTrolleyLockedLs} />
        </CmmsPanel>
      </div>
    </div>
  );
}

function TrolleyColumn({ title, unit, t }: { title: string; unit: CmmsTrolleyUnit; t: (k: string) => string }) {
  return (
    <div className="flex flex-col gap-2">
      {/* 헤더 */}
      <div className="flex items-stretch rounded border border-border bg-card overflow-hidden shrink-0">
        <div className="w-1 bg-sky-500 shrink-0" />
        <div className="flex-1 flex items-center justify-between px-3 py-2 bg-muted/60">
          <span className="text-sm font-bold uppercase tracking-wider text-sky-500 dark:text-sky-400">{title}</span>
          <RunFaultBadge value={unit.runFault} />
        </div>
      </div>

      {/* 수치 */}
      <div className="rounded border border-border bg-card px-3 py-1">
        <CmmsValueRow label={t('trolley.joystickStep')} value={unit.joystickStep} />
        <CmmsValueRow label={t('trolley.speedRef')}     value={unit.speedRef.toFixed(2)} />
        <CmmsValueRow label={t('trolley.actSpeed')}     value={unit.actSpeed.toFixed(2)} />
        <CmmsValueRow label={t('trolley.current')}      value={unit.current.toFixed(1)} />
        <CmmsValueRow label={t('trolley.driveFault')}   value={unit.driveFault} highlight={unit.driveFault !== '!'} />
        <CmmsValueRow label={t('trolley.position')}     value={unit.position.toFixed(1)} />
      </div>

      {/* 상태 비트 */}
      <div className="rounded border border-border bg-card px-3 py-1">
        <CmmsStatusLamp label={t('trolley.mechStopRelay')}        status={unit.mechStopRelay} />
        <CmmsStatusLamp label={t('trolley.driveFaultBit')}        status={unit.driveFaultBit} />
        <CmmsStatusLamp label={t('trolley.driveMainCb')}          status={unit.driveMainCb} />
        <CmmsStatusLamp label={t('trolley.driveFanCb')}           status={unit.driveFanCb} />
        <CmmsStatusLamp label={t('trolley.fieldCb')}              status={unit.fieldCb} />
        <CmmsStatusLamp label={t('trolley.driveMainMc')}          status={unit.driveMainMc} />
        <CmmsStatusLamp label={t('trolley.driveFanMc')}           status={unit.driveFanMc} />
        <CmmsStatusLamp label={t('trolley.driveFieldMc')}         status={unit.driveFieldMc} />
        <CmmsStatusLamp label={t('trolley.driveMainFuseBlown')}   status={unit.driveMainFuseBlown} />
        <CmmsStatusLamp label={t('trolley.driveFieldFuseBlown')}  status={unit.driveFieldFuseBlown} />
        <CmmsStatusLamp label={t('trolley.driveOutputFuseBlown')} status={unit.driveOutputFuseBlown} />
        <CmmsStatusLamp label={t('trolley.motor12FieldMonitor')}  status={unit.motor12FieldMonitor} />
        <CmmsStatusLamp label={t('trolley.motor34FieldMonitor')}  status={unit.motor34FieldMonitor} />
        <CmmsStatusLamp label={t('trolley.motor1Overtemp')}       status={unit.motor1Overtemp} />
        <CmmsStatusLamp label={t('trolley.motor2Overtemp')}       status={unit.motor2Overtemp} />
        <CmmsStatusLamp label={t('trolley.motor3Overtemp')}       status={unit.motor3Overtemp} />
        <CmmsStatusLamp label={t('trolley.motor4Overtemp')}       status={unit.motor4Overtemp} />
        <CmmsStatusLamp label={t('trolley.eStopPb')}              status={unit.eStopPb} variant="ok-ng" />
      </div>
    </div>
  );
}
