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
  const { ref, scale } = useFitScale(DESIGN_W, DESIGN_H);

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
          height: '100%',
          background: '#000',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }}
      >
        <style>{HMI_KEYFRAMES}</style>
        <div
          style={{
            width: DESIGN_W,
            height: DESIGN_H,
            flexShrink: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            background: theme.pageBg,
            fontFamily: theme.font,
            position: 'relative',
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
              <div style={{ width: 528, flexShrink: 0 }}>
                <CraneMap snap={snap} flashKey={snap.alarmAt} />
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minWidth: 0,
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
