import { useEffect, useRef, useState } from 'react';
import { loadLimits, saveLimits } from '../model/limits';
import type { CollisionLimits } from '../model/limits';
import type { AxisKey, MasterKind } from '../model/types';
import { MASTER_AXES } from '../model/types';
import { useHmiData } from '../model/use-hmi-data';
import { BottomBar } from './bottom-bar';
import { CraneMap } from './crane-map';
import { CollisionPanel, MasterPanel } from './info-panel';
import { SettingsScreen } from './settings-screen';
import {
  HMI_THEMES,
  HmiThemeContext,
  loadThemeName,
  saveThemeName,
} from './theme';
import type { HmiThemeName } from './theme';
import { TitleBar } from './title-bar';
import { useFitScale } from './use-fit-scale';

const DESIGN_W = 1024;
const DESIGN_H = 768;

const HMI_KEYFRAMES = `
@keyframes hmiBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.12; } }
.hmi-flash { animation: hmiBlink 0.5s linear 6; }
@keyframes hmiPulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.45); } }
.hmi-pulse { animation: hmiPulse 1s ease-in-out infinite; }
`;

const KIND_CYCLE: Record<MasterKind, MasterKind> = {
  TTC: 'GC',
  GC: 'OC',
  OC: 'TTC',
};

function formatClock(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function HmiPage() {
  const [screen, setScreen] = useState<'main' | 'settings'>('main');
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [controlOn, setControlOn] = useState(true);
  const [bypassOn, setBypassOn] = useState(false);
  const [commError, setCommError] = useState(false);
  const [freeSlew, setFreeSlew] = useState(false);
  const [masterKind, setMasterKind] = useState<MasterKind>('TTC');
  const [limits, setLimits] = useState<CollisionLimits>(loadLimits);
  const [themeName, setThemeName] = useState<HmiThemeName>(loadThemeName);

  const snap = useHmiData({ kind: masterKind, commError, limits });
  const { ref, scale, fillW, fillH } = useFitScale(DESIGN_W, DESIGN_H);

  const settingsClicks = useRef({ count: 0, last: 0 });

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  // 장비 설정 버튼 5회 연속 클릭 시 장비 재설정 화면 진입 (매뉴얼 2.5)
  const handleSettingsClick = () => {
    const now = Date.now();
    const s = settingsClicks.current;
    s.count = now - s.last < 1200 ? s.count + 1 : 1;
    s.last = now;
    if (s.count >= 5) {
      s.count = 0;
      setScreen('settings');
    }
  };

  const handleSaveLimits = (next: CollisionLimits) => {
    saveLimits(next);
    setLimits(next);
  };

  const handleToggleTheme = () => {
    setThemeName((t) => {
      const next = t === 'modern' ? 'classic' : 'modern';
      saveThemeName(next);
      return next;
    });
  };

  /** 장비 재설정 화면 출력용 — 해당 축이 없는 마스터 종류는 0 */
  const axisValue = (key: AxisKey) => {
    const i = MASTER_AXES[masterKind].findIndex((meta) => meta.key === key);
    return i < 0 ? 0 : snap.master.status[i].value;
  };

  const theme = HMI_THEMES[themeName];

  return (
    <HmiThemeContext.Provider value={theme}>
      <div
        ref={ref}
        style={{
          width: '100%',
          // AppLayout 헤더(h-14 + border 1px)를 제외한 나머지 뷰포트에 맞춤
          height: 'calc(100dvh - 57px)',
          background: '#000',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <style>{HMI_KEYFRAMES}</style>
        <div
          style={{
            // 화면 비율에 맞춰 캔버스를 확장해 레터박스 없이 꽉 채움.
            // absolute 배치라 캔버스 크기가 컨테이너 측정에 되먹임되지 않는다.
            // (남는 폭은 지도, 남는 높이는 본문 영역이 흡수)
            width: fillW,
            height: fillH,
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${scale})`,
            background: theme.pageBg,
            fontFamily: theme.font,
            userSelect: 'none',
          }}
        >
          <TitleBar
            clock={clock}
            screenName={screen === 'main' ? '전체 보기' : '장비 재설정'}
            controlOn={controlOn}
            bypassOn={bypassOn}
            commError={commError}
            onToggleControl={() => setControlOn((v) => !v)}
            onToggleBypass={() => setBypassOn((v) => !v)}
            onToggleComm={() => setCommError((v) => !v)}
            showIcons={screen === 'main'}
          />

          {screen === 'main' ? (
            <div
              style={{
                position: 'absolute',
                top: 50,
                bottom: 54,
                left: 0,
                right: 0,
                display: 'flex',
                gap: 8,
                padding: 8,
              }}
            >
              {/* 지도가 남는 폭을 흡수하고, 정보 패널은 설계 폭(464px)을 유지 */}
              <div style={{ flex: 1, minWidth: 528 }}>
                <CraneMap snap={snap} flashKey={snap.alarmAt} />
              </div>
              <div
                style={{
                  width: 464,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <MasterPanel snap={snap} />
                <CollisionPanel snap={snap} />
              </div>
            </div>
          ) : (
            <SettingsScreen
              slewDeg={axisValue('slew')}
              trolley={axisValue('traverse')}
              kind={masterKind}
              limits={limits}
              onSaveLimits={handleSaveLimits}
            />
          )}

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <BottomBar
              onSystemClick={() => setScreen('main')}
              onSettingsClick={handleSettingsClick}
              freeSlew={freeSlew}
              onToggleFreeSlew={() => setFreeSlew((v) => !v)}
              showFreeSlew={screen === 'main'}
              masterKind={masterKind}
              onCycleMasterKind={() => setMasterKind((k) => KIND_CYCLE[k])}
              showMasterKind={screen === 'main'}
              themeName={themeName}
              onToggleTheme={handleToggleTheme}
            />
          </div>
        </div>
      </div>
    </HmiThemeContext.Provider>
  );
}
