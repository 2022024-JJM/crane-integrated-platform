import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { CmmsOverview } from './cmms/cmms-overview';
import { CmmsHoist } from './cmms/cmms-hoist';
import { CmmsTrolley } from './cmms/cmms-trolley';
import { CmmsFaultInfo } from './cmms/cmms-fault-info';
import { CmmsFaultHistory } from './cmms/cmms-fault-history';
import { CmmsTrend } from './cmms/cmms-trend';
import { CmmsConfiguration } from './cmms/cmms-configuration';

export function CraneDetailPage() {
  const { craneId = '' } = useParams<{ craneId: string }>();

  return (
    <div className="h-full w-full overflow-hidden">
      <Routes>
        <Route index element={<Navigate to={`/crane-detail/${craneId}/overview`} replace />} />
        <Route path="overview" element={<CmmsOverview />} />
        <Route path="hoist" element={<CmmsHoist />} />
        <Route path="trolley" element={<CmmsTrolley />} />
        <Route path="fault-info" element={<CmmsFaultInfo />} />
        <Route path="fault-history" element={<CmmsFaultHistory />} />
        <Route path="trend" element={<CmmsTrend />} />
        <Route path="configuration" element={<CmmsConfiguration />} />
      </Routes>
    </div>
  );
}
