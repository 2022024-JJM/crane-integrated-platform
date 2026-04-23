import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@crane/core/lib/theme-context';
import { getCmmsMockData } from '@crane/domain/crane';

export function CmmsConfiguration() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const data = getCmmsMockData(craneId).configuration;

  const deviceMap = Object.fromEntries(data.devices.map((d) => [d.id, d]));

  // 테마별 색상
  const normalFill   = isDark ? '#166534' : '#dcfce7';
  const normalStroke = isDark ? '#22c55e' : '#16a34a';
  const normalText   = isDark ? '#86efac' : '#15803d';
  const faultFill    = isDark ? '#7f1d1d' : '#fee2e2';
  const faultStroke  = isDark ? '#ef4444' : '#dc2626';
  const faultText    = isDark ? '#fca5a5' : '#b91c1c';
  const lineNormal   = isDark ? '#4b5563' : '#d1d5db';
  const lineFault    = '#ef4444';

  return (
    <div className="h-full flex flex-col gap-3 p-4 bg-background text-foreground overflow-auto">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
        {t('configuration.title')}
      </div>

      <div className="flex-1 rounded border border-border bg-card overflow-auto p-4">
        <svg
          viewBox="0 0 640 520"
          className="w-full max-h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 연결선 */}
          {data.connections.map((conn, i) => {
            const from = deviceMap[conn.from];
            const to = deviceMap[conn.to];
            if (!from || !to) return null;
            const isFault = conn.status === 'fault';
            return (
              <line
                key={i}
                x1={from.x} y1={from.y}
                x2={to.x}   y2={to.y}
                stroke={isFault ? lineFault : lineNormal}
                strokeWidth={isFault ? 2 : 1.5}
                strokeDasharray={isFault ? '4 2' : undefined}
              />
            );
          })}

          {/* 장치 노드 */}
          {data.devices.map((device) => {
            const isNormal = device.status === 'normal';
            return (
              <g key={device.id}>
                <rect
                  x={device.x - 48} y={device.y - 18}
                  width={96} height={36} rx={6}
                  fill={isNormal ? normalFill : faultFill}
                  stroke={isNormal ? normalStroke : faultStroke}
                  strokeWidth={1.5}
                />
                <circle
                  cx={device.x + 38} cy={device.y - 10}
                  r={4}
                  fill={isNormal ? normalStroke : faultStroke}
                />
                <text
                  x={device.x} y={device.y + 5}
                  textAnchor="middle"
                  fill={isNormal ? normalText : faultText}
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {device.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
          {t('configuration.normal')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          {t('configuration.fault')}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <svg width="24" height="8">
            <line x1="0" y1="4" x2="24" y2="4" stroke={lineNormal} strokeWidth="1.5" />
          </svg>
          {t('configuration.normalConnection')}
        </div>
        <div className="flex items-center gap-2">
          <svg width="24" height="8">
            <line x1="0" y1="4" x2="24" y2="4" stroke={lineFault} strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          {t('configuration.faultConnection')}
        </div>
      </div>
    </div>
  );
}
