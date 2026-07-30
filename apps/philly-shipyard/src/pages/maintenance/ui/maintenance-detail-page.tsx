import { Navigate, useParams } from 'react-router-dom';

/**
 * 구 상세 페이지 라우트(/maintenance/:repairId) — 원클릭 처리 패널로 통합되면서
 * 보드의 ?wo= 딥링크로 리다이렉트한다. 캘린더·자산탭·재고 등의 기존 링크 호환용.
 */
export function MaintenanceDetailPage() {
  const { repairId } = useParams<{ repairId: string }>();
  return (
    <Navigate
      to={repairId ? `/maintenance?wo=${encodeURIComponent(repairId)}` : '/maintenance'}
      replace
    />
  );
}
