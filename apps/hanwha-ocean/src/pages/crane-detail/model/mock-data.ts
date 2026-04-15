import type {
  CmmsMockData,
  CmmsHoistUnit,
  CmmsTrolleyUnit,
  OnOff,
  OkNg,
  RunFaultStatus,
} from './types';

// ─── 헬퍼 함수 ──────────────────────────────────────────────────
function rnd(min: number, max: number, decimal = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimal));
}
function coin(prob = 0.7): OnOff {
  return Math.random() < prob ? 'ON' : 'OFF';
}
function ok(prob = 0.85): OkNg {
  return Math.random() < prob ? 'OK' : 'NG';
}
function trio(prob = 0.7): [OnOff, OnOff, OnOff] {
  return [coin(prob), coin(prob), coin(prob)];
}
function pair(prob = 0.7): [OnOff, OnOff] {
  return [coin(prob), coin(prob)];
}

function makeHoistUnit(status: RunFaultStatus = 'STOP'): CmmsHoistUnit {
  return {
    runFault: status,
    joystickStep: '!',
    speedRef: 0,
    actSpeed: 0,
    current: 0,
    driveFault: '!',
    position: rnd(0, 30),
    load: rnd(0, 5),
    motorTemp: rnd(20, 40),
    mechStopRelay: 'ON',
    driveFaultBit: 'OFF',
    driveMainCb: 'ON',
    driveFanCb: 'ON',
    fieldCb: 'ON',
    driveMainMc: 'OFF',
    driveFanMc: 'OFF',
    driveFieldMc: 'OFF',
    driveFieldFuseBlown: 'OFF',
    motorFanMainCb: 'ON',
    motorFanMc: 'OFF',
    lubricationMotorCb: 'ON',
    eStopPb: 'OK',
  };
}

function makeTrolleyUnit(status: RunFaultStatus = 'STOP'): CmmsTrolleyUnit {
  return {
    runFault: status,
    joystickStep: '!',
    speedRef: 0,
    actSpeed: 0,
    current: 0,
    driveFault: '!',
    position: rnd(0, 50),
    mechStopRelay: 'ON',
    driveFaultBit: 'OFF',
    driveMainCb: 'ON',
    driveFanCb: 'ON',
    fieldCb: 'ON',
    driveMainMc: 'OFF',
    driveFanMc: 'OFF',
    driveFieldMc: 'OFF',
    driveMainFuseBlown: 'OFF',
    driveFieldFuseBlown: 'OFF',
    driveOutputFuseBlown: 'OFF',
    motor12FieldMonitor: 'ON',
    motor34FieldMonitor: 'ON',
    motor1Overtemp: 'OFF',
    motor2Overtemp: 'OFF',
    motor3Overtemp: 'OFF',
    motor4Overtemp: 'OFF',
    eStopPb: 'OK',
  };
}

const TREND_COLORS = [
  '#FF9900', // orange
  '#05EC8B', // emerald
  '#70B9FC', // sky blue
  '#9860ED', // violet
  '#F66969', // red
  '#49C1CE', // cyan
  '#FFCC7E', // amber
  '#D362AD', // pink
];

const TREND_GROUPS = [
  { id: 'main-hoist', label: 'MAIN HOIST' },
  { id: 'trolley', label: 'TROLLEY' },
  { id: 'travelling', label: 'TRAVELLING' },
  { id: 'slewing', label: 'SLEWING' },
];

function makeTrendData() {
  const now = Date.now();
  const chartData = Array.from({ length: 60 }, (_, i) => {
    const t = new Date(now - (60 - i) * 60000);
    const hh = t.getHours().toString().padStart(2, '0');
    const mm = t.getMinutes().toString().padStart(2, '0');
    const ss = t.getSeconds().toString().padStart(2, '0');
    return {
      time: `${hh}:${mm}:${ss}`,
      pen1: rnd(0, 5, 0),
      pen2: rnd(0, 500, 0),
      pen3: rnd(0, 200, 0),
      pen4: rnd(0, 100, 0),
      pen5: rnd(0, 10, 3),
      pen6: rnd(0, 1, 2),
    };
  });

  return {
    groups: TREND_GROUPS,
    pens: [
      { index: 1, color: TREND_COLORS[0], label: 'MAIN HOIST JOY-STICK NOTCH', value1: 1, value2: 0 },
      { index: 2, color: TREND_COLORS[1], label: 'MAIN HOIST SPEED FEEDBACK', value1: 391, value2: 0 },
      { index: 3, color: TREND_COLORS[2], label: 'MAIN HOIST OUTPUT VOLTAGE', value1: 141, value2: 0 },
      { index: 4, color: TREND_COLORS[3], label: 'MAIN HOIST CURRENT', value1: 84, value2: 1 },
      { index: 5, color: TREND_COLORS[4], label: 'MAIN HOIST DISTANCE', value1: 2.239, value2: 1.481 },
      { index: 6, color: TREND_COLORS[5], label: 'MAIN HOIST WEIGHT', value1: 0.21, value2: 0 },
    ],
    chartData,
  };
}

function makeConfigData() {
  return {
    devices: [
      { id: 'plc-main', label: 'PLC Main', status: 'normal' as const, x: 300, y: 80 },
      { id: 'switch-1', label: 'Switch 1', status: 'normal' as const, x: 150, y: 200 },
      { id: 'switch-2', label: 'Switch 2', status: 'normal' as const, x: 450, y: 200 },
      { id: 'drive-mh1', label: 'Drive MH#1', status: 'normal' as const, x: 80, y: 320 },
      { id: 'drive-mh2', label: 'Drive MH#2', status: 'fault' as const, x: 220, y: 320 },
      { id: 'drive-trolley', label: 'Drive Trolley', status: 'normal' as const, x: 380, y: 320 },
      { id: 'drive-travel', label: 'Drive Travel', status: 'normal' as const, x: 520, y: 320 },
      { id: 'enc-mh1', label: 'Enc MH#1', status: 'normal' as const, x: 80, y: 440 },
      { id: 'enc-mh2', label: 'Enc MH#2', status: 'normal' as const, x: 220, y: 440 },
      { id: 'enc-trolley', label: 'Enc Trolley', status: 'normal' as const, x: 380, y: 440 },
      { id: 'enc-travel', label: 'Enc Travel', status: 'normal' as const, x: 520, y: 440 },
    ],
    connections: [
      { from: 'plc-main', to: 'switch-1', status: 'normal' as const },
      { from: 'plc-main', to: 'switch-2', status: 'normal' as const },
      { from: 'switch-1', to: 'drive-mh1', status: 'normal' as const },
      { from: 'switch-1', to: 'drive-mh2', status: 'fault' as const },
      { from: 'switch-2', to: 'drive-trolley', status: 'normal' as const },
      { from: 'switch-2', to: 'drive-travel', status: 'normal' as const },
      { from: 'drive-mh1', to: 'enc-mh1', status: 'normal' as const },
      { from: 'drive-mh2', to: 'enc-mh2', status: 'normal' as const },
      { from: 'drive-trolley', to: 'enc-trolley', status: 'normal' as const },
      { from: 'drive-travel', to: 'enc-travel', status: 'normal' as const },
    ],
  };
}

const FAULT_COMMENTS = [
  '[MPP] 메인 전원 MCCB 확인 (101CB1)',
  '[MPP] 컨트롤 전원 차단기 확인 (103CP1)',
  '[MPP] SLM 메인 퓨즈 확인 (102F1,2,3)',
  '[TS#1] 전진 충돌감지 감속 이상',
  '[TS#1] MH#1 드럼 오버 스피드 감지 폴트',
  '[MPP] MH#1 브레이크 전원 차단기 확인 (302CB1)',
  '[TS#1] 전전 충돌감지 감속',
  '[MPP] 토탈 비상정지 릴레이 확인 (186CR1)',
];

const EVENT_COMMENTS = [
  'TRAVELLING 우측 주행 감속',
  'TRAVELLING 우측 주행 불가',
  'MAIN HOIST #1 EMG BRAKE',
  'MAIN HOIST #2 EMG BRAKE',
  'MAIN HOIST #1 CONTROL',
  'TROLLEY #1 구동',
  'TROLLEY #1 BWD 횡행 감속',
  'TRAVELLING 구동',
  'SLEWING 구동',
];

function makeAlarmRecords(comments: string[], count = 10) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const t = new Date(now - i * 60000 * rnd(1, 10));
    const date = t.toISOString().replace('T', ' ').slice(0, 19);
    return {
      time: date,
      value: Math.random() < 0.5 ? 'ON' : 'OFF',
      comment: comments[i % comments.length],
    };
  });
}

function randomRunFault(): RunFaultStatus {
  const r = Math.random();
  if (r < 0.6) return 'STOP';
  if (r < 0.85) return 'RUN';
  return 'FAULT';
}

function makeCmmsMockData(): CmmsMockData {
  const rf = () => randomRunFault();
  return {
    overview: {
      machines: [
        { name: 'HOIST #1',      runFault: rf(), joystickStep: '!', speed: rnd(0, 100), position: rnd(0, 10),  load: rnd(0, 5) },
        { name: 'HOIST #2',      runFault: rf(), joystickStep: '!', speed: rnd(0, 100), position: rnd(0, 10),  load: rnd(0, 5) },
        { name: 'HOIST #3',      runFault: rf(), joystickStep: '!', speed: rnd(0, 100), position: rnd(0, 10),  load: rnd(0, 5) },
        { name: 'UPPER TROLLEY', runFault: rf(), joystickStep: '!', speed: rnd(0, 100), position: rnd(0, 50),  load: null },
        { name: 'LOWER TROLLEY', runFault: rf(), joystickStep: '!', speed: rnd(0, 100), position: rnd(0, 50),  load: null },
        { name: 'GANTRY FIX',   runFault: rf(), joystickStep: '!', speed: rnd(0, 100), position: rnd(0, 100), load: null },
        { name: 'GANTRY PEND',  runFault: rf(), joystickStep: '!', speed: rnd(0, 100), position: rnd(0, 100), load: null },
      ],
      wind: {
        speed: rnd(0, 8),
        direction: '!',
        highWindWarning: 'OFF',
        highWindTrip: 'OFF',
      },
      load: {
        totalLoad: 0,
        h1h2Diff: 0,
        overloadWarning: ['OFF', 'OFF', 'OFF'],
        overloadTrip: ['OFF', 'OFF', 'OFF'],
        totalOverloadWarning: 'OFF',
        totalOverloadTrip: 'OFF',
      },
      eStop: {
        rightConsole: ok(),
        hvRoom: ok(),
        erectionCranePanel: ok(),
        gantryFix: ok(),
        gantryPend: ok(),
        gantryLocalStation: ok(),
        elecRoom1: ok(),
        elecRoom2: ok(),
        hoistRemotePanel1: ok(),
        hoistRemotePanel2: ok(),
        hoistRemotePanel3: ok(),
      },
    },
    hoist: {
      hoist1: makeHoistUnit(),
      hoist2: makeHoistUnit(),
      hoist3: makeHoistUnit(),
      load: {
        totalLoad: 0,
        h1h2Diff: 0,
        overloadWarning: trio(0.1),
        overloadTrip: trio(0.05),
        totalOverloadWarning: coin(0.1),
        totalOverloadTrip: coin(0.05),
      },
      overspeed: {
        overspeedFsl: trio(0.05),
        overspeedEsl: trio(0.05),
        overspeedMonitor1: trio(0.05),
        overspeedMonitor2: trio(0.05),
      },
      ropeSheave: {
        ropeSheaveH1Cb: 'ON',
        ropeSheaveH2Cb: 'ON',
        wsMc: 'OFF',
        lsMc: 'OFF',
        wsEndStop: 'OFF',
        lsEndStop: 'OFF',
      },
      position: {
        upSafetyStop: trio(0.05),
        upNormalStop: trio(0.05),
        upSlowdown: trio(0.05),
        downSlowdown: trio(0.05),
        downNormalStop: trio(0.05),
        downSafetyStop: trio(0.05),
        positionSynchronize: trio(0.05),
        aeDcmPositionCompareError: trio(0.05),
      },
      brake: {
        brakeCb: ['ON', 'ON', 'ON'],
        brakeMc: ['OFF', 'OFF', 'OFF'],
        brake1Open: ['OFF', 'OFF', 'OFF'],
        brake2Open: ['OFF', 'OFF', 'OFF'],
      },
    },
    trolley: {
      upperTrolley: makeTrolleyUnit(),
      lowerTrolley: makeTrolleyUnit(),
      position: {
        fpSafetyStopRelay: pair(0.05),
        fpEndStopMgsw: pair(0.05),
        fpSlowdownMgsw: pair(0.05),
        parkingPosition: pair(0.05),
        ppSlowdownMgsw: pair(0.05),
        ppEndStopMgsw: pair(0.05),
        ppSafetyStopRelay: pair(0.05),
        aeDcmPositionCompareError: pair(0.05),
      },
      brake: {
        brakeMc: ['OFF', 'OFF'],
        brake12Cb: ['ON', 'ON'],
        brake34Cb: 'ON',
        brake12Open: ['OFF', 'OFF'],
        brake34Open: 'OFF',
      },
      upperLsHoistingCap: {
        mgsw550660fp: 'OFF',
        mgsw550660pp: 'OFF',
        mgsw660750fp: 'OFF',
        mgsw660750pp: 'OFF',
      },
      pin: {
        upperTrolleyLockedH1: 'ON',
        upperTrolleyLockedH2: 'ON',
        lowerTrolleyLockedWs: 'ON',
        lowerTrolleyLockedLs: 'ON',
      },
    },
    faultInfo: {
      activeEvents: makeAlarmRecords(EVENT_COMMENTS, 8),
      activeFaults: makeAlarmRecords(FAULT_COMMENTS, 5),
    },
    faultHistory: {
      events: makeAlarmRecords(EVENT_COMMENTS, 35),
      faults: makeAlarmRecords(FAULT_COMMENTS, 20),
    },
    trend: makeTrendData(),
    configuration: makeConfigData(),
  };
}

// 크레인 ID별 독립적인 mock 데이터 (각 크레인마다 다른 랜덤 값)
const CRANE_IDS = [
  'C_171', 'C_172', 'C_173', 'C_800', 'C_801', 'C_810', 'C_811', 'C_812', 'C_863',
  'C_864', 'C_865', 'C_866', 'C_867', 'C_868', 'C_869',
  'C_862', 'C_870', 'C_871', 'C_890', 'C_1806',
];

export const cmmsMockData: Record<string, CmmsMockData> = Object.fromEntries(
  CRANE_IDS.map((id) => [id, makeCmmsMockData()]),
);

export function getCmmsMockData(craneId: string): CmmsMockData {
  return cmmsMockData[craneId] ?? makeCmmsMockData();
}
