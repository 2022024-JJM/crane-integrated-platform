import { Link } from 'react-router-dom';
import {
  Layers,
  ClipboardCheck,
  Wrench,
  Package,
  ShieldCheck,
} from 'lucide-react';

const MRO_MENU_ITEMS = [
  {
    label: '자산 관리',
    description: '크레인 자산 현황 및 보증 만료 일정 관리',
    path: '/asset-management',
    icon: Layers,
  },
  {
    label: '점검',
    description: '정기 점검 계획 및 이력 조회',
    path: '/inspection',
    icon: ClipboardCheck,
  },
  {
    label: '정비',
    description: '수리 작업 요청 및 진행 현황 관리',
    path: '/maintenance',
    icon: Wrench,
  },
  {
    label: '재고',
    description: '부품 및 소모품 재고 현황',
    path: '/inventory',
    icon: Package,
  },
  {
    label: '컴플라이언스',
    description: '법정 검사 및 인증 만료 관리',
    path: '/compliance',
    icon: ShieldCheck,
  },
];

export function PhillyDashboardPage() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Philly Shipyard
        </h1>
        <p className="text-muted-foreground mt-1">
          MRO 관리 메뉴에 빠르게 접근하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {MRO_MENU_ITEMS.map(({ label, description, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="group flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
