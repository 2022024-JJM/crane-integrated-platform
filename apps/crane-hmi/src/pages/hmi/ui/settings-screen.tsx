import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { axisLimits, DEFAULT_LIMITS } from '../model/limits';
import type { AxisLimits, CollisionLimits } from '../model/limits';
import type { AxisKey, MasterKind } from '../model/types';
import { MASTER_AXES } from '../model/types';

const sectionStyle: CSSProperties = {
  border: '1px solid #555',
  background: '#111',
  display: 'flex',
  flexDirection: 'column',
  padding: '12px 18px',
  minHeight: 0,
};

const outputBox: CSSProperties = {
  width: 120,
  background: '#d8d8d8',
  color: '#111',
  fontSize: 20,
  fontWeight: 700,
  textAlign: 'right',
  padding: '6px 10px',
  border: '2px inset #888',
  fontVariantNumeric: 'tabular-nums',
};

const setButton: CSSProperties = {
  background: '#2e2e2e',
  borderTop: '1px solid #8a8a8a',
  borderLeft: '1px solid #8a8a8a',
  borderRight: '1px solid #101010',
  borderBottom: '1px solid #101010',
  color: '#f0f0f0',
  fontSize: 16,
  fontWeight: 800,
  padding: '7px 18px',
  cursor: 'pointer',
};

const inputBox: CSSProperties = {
  width: 120,
  background: '#fff',
  color: '#111',
  fontSize: 18,
  fontWeight: 700,
  padding: '6px 10px',
  border: '2px inset #888',
  outline: 'none',
};

const smallLabel: CSSProperties = {
  color: '#bdbdbd',
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 3,
};

const guideTitle: CSSProperties = {
  color: '#fff',
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 4,
};

const guideLine: CSSProperties = {
  color: '#9fdf9f',
  fontSize: 12.5,
  lineHeight: 1.55,
  fontWeight: 600,
};

const sectionTitle: CSSProperties = {
  color: '#fff',
  fontSize: 23,
  fontWeight: 900,
  marginBottom: 10,
};

const limitInput: CSSProperties = {
  ...inputBox,
  width: 72,
  fontSize: 16,
  padding: '5px 8px',
  textAlign: 'right',
};

const limitHeader: CSSProperties = {
  color: '#bdbdbd',
  fontSize: 12,
  fontWeight: 700,
  width: 72,
  textAlign: 'center',
};

type LimitField = keyof AxisLimits;
const LIMIT_FIELDS: { field: LimitField; label: string }[] = [
  { field: 'safe', label: '안전' },
  { field: 'stop', label: '정지' },
  { field: 'near', label: '근접' },
];

/** m → 0.1m 단위 정수 문자열 (입력 예시: 25.6m ⇒ 256) */
const toTenth = (m: number) => String(Math.round(m * 10));

function initDraft(kind: MasterKind, limits: CollisionLimits) {
  const draft: Record<string, Record<LimitField, string>> = {};
  for (const meta of MASTER_AXES[kind]) {
    const l = axisLimits(limits, kind, meta.key);
    draft[meta.key] = {
      safe: toTenth(l.safe),
      stop: toTenth(l.stop),
      near: toTenth(l.near),
    };
  }
  return draft;
}

/** 컨트롤(좌) + 안내문(우) 구성의 섹션 카드 */
function Section({
  title,
  controls,
  controlsWidth = 300,
  guideTitleText,
  guide,
  flex = 1,
}: {
  title: string;
  controls: ReactNode;
  controlsWidth?: number;
  guideTitleText: string;
  guide: ReactNode;
  flex?: number;
}) {
  return (
    <div style={{ ...sectionStyle, flex }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        <div style={{ width: controlsWidth, flexShrink: 0 }}>{controls}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={guideTitle}>{guideTitleText}</div>
          <div style={guideLine}>{guide}</div>
        </div>
      </div>
    </div>
  );
}

interface SettingsScreenProps {
  /** 시뮬레이션의 현재 선회각/횡행값 출력용 (해당 축이 없는 마스터는 0) */
  slewDeg: number;
  trolley: number;
  kind: MasterKind;
  limits: CollisionLimits;
  onSaveLimits: (next: CollisionLimits) => void;
}

/** 장비 재설정 화면 — 매뉴얼 2.5 + 충돌 기준값 설정(내재화 확장) */
export function SettingsScreen({
  slewDeg,
  trolley,
  kind,
  limits,
  onSaveLimits,
}: SettingsScreenProps) {
  const [slewOutput, setSlewOutput] = useState<number | null>(null);
  const [traverseOutput, setTraverseOutput] = useState<number | null>(null);
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');

  const [draft, setDraft] = useState(() => initDraft(kind, limits));
  const [limitsMessage, setLimitsMessage] = useState<string | null>(null);

  const encoder = Math.round(trolley * 137 + 4096);

  const setDraftValue = (axis: AxisKey, field: LimitField, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setDraft((d) => ({ ...d, [axis]: { ...d[axis], [field]: digits } }));
  };

  const handleSaveLimits = () => {
    const nextKind: Partial<Record<AxisKey, AxisLimits>> = { ...limits[kind] };
    for (const meta of MASTER_AXES[kind]) {
      const v = draft[meta.key];
      const safe = Number(v.safe) / 10;
      const stop = Number(v.stop) / 10;
      const near = Number(v.near) / 10;
      if (!(safe > 0 && stop > safe && near > stop)) {
        setLimitsMessage(
          `${meta.label}: 안전 < 정지 < 근접 순서로 0보다 큰 값을 입력하세요.`,
        );
        return;
      }
      nextKind[meta.key] = { safe, stop, near };
    }
    onSaveLimits({ ...limits, [kind]: nextKind });
    setLimitsMessage('저장되었습니다. 충돌 판정에 즉시 반영됩니다.');
  };

  const handleResetLimits = () => {
    setDraft(initDraft(kind, DEFAULT_LIMITS));
    setLimitsMessage('권장값을 불러왔습니다. 저장을 눌러 적용하세요.');
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 50,
        bottom: 54,
        left: 0,
        right: 0,
        display: 'flex',
        gap: 8,
        padding: 10,
        background: '#000',
      }}
    >
      {/* 좌측 컬럼 — 매뉴얼 2.5 (선회/횡행 재설정) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
        }}
      >
        <Section
          title="선회 재설정"
          controlsWidth={230}
          controls={
            <>
              <div style={smallLabel}>출력값</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={outputBox}>
                  {(slewOutput ?? slewDeg).toFixed(1)}
                </div>
                <button
                  type="button"
                  style={setButton}
                  onClick={() => setSlewOutput(90)}
                >
                  SET
                </button>
              </div>
            </>
          }
          guideTitleText="선회 재설정 방법"
          guide={
            <>
              1. 붐을 정북 방향으로 (주행 레일과 평행) 놓는다.
              <br />
              2. <b style={{ color: '#fff' }}>SET</b> 버튼을 누른다.
              <br />
              3. 선회 각도가 90도로 바뀌었는지 확인한다.
            </>
          }
        />

        <Section
          title="횡행 재설정"
          flex={2.2}
          controlsWidth={230}
          controls={
            <>
              <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                <div>
                  <div style={smallLabel}>출력값</div>
                  <div style={outputBox}>
                    {(traverseOutput ?? trolley).toFixed(1)}
                  </div>
                </div>
                <div>
                  <div style={smallLabel}>엔코더 값</div>
                  <div
                    style={{
                      ...outputBox,
                      background: '#2a2a2a',
                      color: '#eee',
                      border: '2px inset #555',
                    }}
                  >
                    {encoder}
                  </div>
                </div>
              </div>
              <div style={smallLabel}>입력1</div>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <input
                  style={inputBox}
                  value={input1}
                  inputMode="numeric"
                  onChange={(e) => setInput1(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="button"
                  style={setButton}
                  onClick={() =>
                    input1 && setTraverseOutput(Number(input1) / 10)
                  }
                >
                  SET 1
                </button>
              </div>
              <div style={smallLabel}>입력2</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  style={inputBox}
                  value={input2}
                  inputMode="numeric"
                  onChange={(e) => setInput2(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="button"
                  style={setButton}
                  onClick={() =>
                    input2 && setTraverseOutput(Number(input2) / 10)
                  }
                >
                  SET 2
                </button>
              </div>
            </>
          }
          guideTitleText="횡행 재설정 방법"
          guide={
            <>
              1. 트롤리를 운전실 안쪽으로 최대한 이동시킨다.
              <br />
              2. 크레인 중심에서 트롤리 중심까지의 거리를 측정하여 0.1m 단위로{' '}
              <b style={{ color: '#fff' }}>입력1</b>에 입력 후{' '}
              <b style={{ color: '#fff' }}>SET 1</b> 버튼을 누른다.
              <br />
              <span style={{ color: '#ff4a4a', fontWeight: 800 }}>
                입력 예시: 25.6m =&gt; 256
              </span>
              <br />
              3. 트롤리를 운전실 바깥쪽으로 최대한 이동시킨다.
              <br />
              4. 크레인 중심에서 트롤리 중심까지의 거리를 측정하여 0.1m 단위로{' '}
              <b style={{ color: '#fff' }}>입력2</b>에 입력 후{' '}
              <b style={{ color: '#fff' }}>SET 2</b> 버튼을 누른다.
              <br />
              5. 출력값이 잘 나오는지 확인한다.
            </>
          }
        />
      </div>

      {/* 우측 컬럼 — 충돌 기준값 설정 (매뉴얼 2.3 기준값, 내재화 확장) */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        <Section
          title={`충돌 기준값 설정 (${kind})`}
          controlsWidth={300}
          controls={
            <>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 5,
                  paddingLeft: 52,
                }}
              >
                {LIMIT_FIELDS.map((f) => (
                  <div key={f.field} style={limitHeader}>
                    {f.label}거리
                  </div>
                ))}
              </div>
              {MASTER_AXES[kind].map((meta) => (
                <div
                  key={meta.key}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 7,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      color: '#e9e9e9',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {meta.label}
                  </div>
                  {LIMIT_FIELDS.map((f) => (
                    <input
                      key={f.field}
                      style={limitInput}
                      value={draft[meta.key][f.field]}
                      inputMode="numeric"
                      onChange={(e) =>
                        setDraftValue(meta.key, f.field, e.target.value)
                      }
                    />
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  style={setButton}
                  onClick={handleSaveLimits}
                >
                  저장
                </button>
                <button
                  type="button"
                  style={{ ...setButton, fontWeight: 600 }}
                  onClick={handleResetLimits}
                >
                  권장값
                </button>
              </div>
            </>
          }
          guideTitleText="충돌 기준값 설정 방법"
          guide={
            <>
              1. 현재 마스터 크레인 종류({kind})의 축별 기준값을 0.1m 단위로
              입력한다.
              <br />
              <span style={{ color: '#ff4a4a', fontWeight: 800 }}>
                입력 예시: 25.0m =&gt; 250
              </span>
              <br />
              2. 안전 &lt; 정지 &lt; 근접 순서를 지켜야 하며, 미속거리는
              정지~근접 사이에서 자동 산출된다.
              <br />
              3. <b style={{ color: '#fff' }}>저장</b> 버튼을 누르면 즉시 충돌
              판정에 반영되고 재기동 후에도 유지된다.
              {limitsMessage && (
                <>
                  <br />
                  <span style={{ color: '#ffe33c', fontWeight: 800 }}>
                    {limitsMessage}
                  </span>
                </>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
