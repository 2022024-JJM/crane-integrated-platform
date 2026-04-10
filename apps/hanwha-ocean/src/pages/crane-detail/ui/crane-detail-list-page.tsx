import { useSiteType } from '@crane/core/lib/site-type-context';
import { CraneListSection } from './crane-list-section';

const HANWHA_OCEAN_SECTIONS = [
  { regionId: 'dock-1',  title: '1 도크', subtitle: '타워갠트리 크레인 9기' },
  { regionId: 'dock-2',  title: '2 도크', subtitle: '타워갠트리 크레인 6기' },
  { regionId: 'dock-in', title: '내업',   subtitle: '오버헤드 크레인 5기' },
];

const GOLIATH_SECTIONS = [
  { regionId: 'goliath', title: '골리앗 크레인', subtitle: '골리앗 크레인 1기' },
];

export function CraneDetailListPage() {
  const { siteType } = useSiteType();
  const sections = siteType === 'goliath-crane' ? GOLIATH_SECTIONS : HANWHA_OCEAN_SECTIONS;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* 페이지 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">상세 크레인</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            크레인을 선택하면 CMMS 상세 화면으로 이동합니다.
          </p>
        </div>
      </div>

      {/* 섹션들 */}
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <CraneListSection
            key={section.regionId}
            regionId={section.regionId}
            title={section.title}
            subtitle={section.subtitle}
          />
        ))}
      </div>
    </div>
  );
}
