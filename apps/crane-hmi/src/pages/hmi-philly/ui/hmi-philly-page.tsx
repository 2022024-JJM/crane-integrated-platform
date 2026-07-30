import { useEffect, useState } from 'react';
import { useTheme } from '@crane/core/lib/theme-context';
import { usePhillySimulation } from '../model/use-philly-simulation';
import { BottomBar } from './bottom-bar';
import {
  AxisStatusPanel,
  CollisionClearancePanel,
  MyCranePanel,
} from './info-panels';
import { PhillyMap } from './philly-map';
import { PHILLY_FONT, PHILLY_THEMES, PhillyThemeContext } from './theme';
import { useFitScale } from './use-fit-scale';

/** 원본 HMI_main_Philly.mmc 설계 해상도 */
const DESIGN_W = 1600;
const DESIGN_H = 1150;

function formatClock(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Hanwha Anti-Collision System — 필리 조선소 향 HMI (crane.HMI2) */
export function HmiPhillyPage() {
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [freeSlew, setFreeSlew] = useState(false);
  const snap = usePhillySimulation();
  const { ref, scale } = useFitScale(DESIGN_W, DESIGN_H);
  const { theme } = useTheme();
  const t = PHILLY_THEMES[theme];

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <PhillyThemeContext value={t}>
      <div
        ref={ref}
        style={{
          width: '100%',
          // AppLayout 헤더(h-14 + border 1px)를 제외한 나머지 뷰포트에 맞춤
          height: 'calc(100dvh - 57px)',
          background: t.pageBg,
          display: 'grid',
          placeItems: 'center',
          // 설계 캔버스(1150px)가 컨테이너보다 클 때도 중앙 기준으로 스케일되도록
          placeContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: DESIGN_W,
            height: DESIGN_H,
            flexShrink: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            background: t.pageBg,
            fontFamily: PHILLY_FONT,
            position: 'relative',
            userSelect: 'none',
            display: 'flex',
            flexDirection: 'column',
            padding: 28,
            boxSizing: 'border-box',
          }}
        >
          {/* 타이틀 바 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              height: 52,
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700 }}>
              <span style={{ color: t.hanwhaOrange }}>Hanwha</span>
              <span style={{ color: t.text }}> Anti-Collision System</span>
            </span>
            <span style={{ fontSize: 24, fontWeight: 700, color: t.text }}>
              {clock}
            </span>
          </div>

          {/* 본문: 지도 + 우측 정보 패널 */}
          <div style={{ flex: 1, display: 'flex', gap: 24, minHeight: 0 }}>
            <div
              style={{
                flex: 1,
                border: `1px solid ${t.border}`,
                borderRadius: 4,
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <PhillyMap snap={snap} />
            </div>
            <div
              style={{
                width: 470,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <MyCranePanel snap={snap} />
              <AxisStatusPanel snap={snap} />
              <div style={{ height: 8 }} />
              <CollisionClearancePanel snap={snap} />
            </div>
          </div>

          {/* 하단 바 */}
          <div style={{ marginTop: 18 }}>
            <BottomBar
              freeSlew={freeSlew}
              onToggleFreeSlew={() => setFreeSlew((v) => !v)}
            />
          </div>
        </div>
      </div>
    </PhillyThemeContext>
  );
}
