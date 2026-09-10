import { Gauge } from 'lucide-react';

import { cn } from '@crane/core/lib/utils';
import { tagLiveValues } from '@crane/features/3d';
import { Badge } from '@crane/ui/atoms/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import type { DashboardEquipmentRow } from '../model';
import { useNowTick } from '../model/use-now-tick';
import { tagRangeRatio, toTagDisplay } from '../lib/tag-display';
import type { DashboardTranslate } from './dashboard-helpers';
import { EmptyStateBox } from './dashboard-parts';

/**
 * 씬 tagMappings 기반 장비별 라이브 태그 값. tagLiveValues 는 구독 API 가
 * 없어 폴링으로 읽는다(setTagIngest 는 단일 슬롯이라 사용 금지 — 폴링만).
 * 러너가 멈추면 값 갱신이 끊겨 stale → "정지" 배지가 된다.
 */
export function DashboardEquipmentLiveSection({
  equipment,
  translate,
}: {
  equipment: DashboardEquipmentRow[];
  translate: DashboardTranslate;
}) {
  const now = useNowTick(500);

  return (
    <Card className="border-border/90 bg-background/60 border shadow-none">
      <CardHeader>
        <div>
          <CardTitle>{translate('dashboard:equipmentLive.title')}</CardTitle>
          <CardDescription>
            {translate('dashboard:equipmentLive.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300">
            {translate('dashboard:badges.now')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {equipment.length === 0 ? (
          <EmptyStateBox
            message={translate('dashboard:equipmentLive.empty')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {equipment.map((row) => (
              <EquipmentCard
                key={row.modelId}
                row={row}
                now={now}
                translate={translate}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EquipmentCard({
  row,
  now,
  translate,
}: {
  row: DashboardEquipmentRow;
  now: number;
  translate: DashboardTranslate;
}) {
  return (
    <div className="border-border/90 bg-card/70 rounded-2xl border p-3">
      <div className="flex items-center gap-2">
        <Gauge className="text-primary size-4 shrink-0" />
        <p className="font-medium">{row.equipName}</p>
        <span className="text-muted-foreground ml-auto text-xs">
          {translate(row.regionTitleKey)}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {row.tags.map((tag) => {
          const live = tagLiveValues.get(tag.tagKey);
          const display = toTagDisplay(live, now);
          const ratio = tagRangeRatio(live?.value, tag.min, tag.max);
          return (
            <div key={tag.tagKey}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground min-w-0 truncate text-xs">
                  {tag.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-1">
                  {display.stale ? (
                    <Badge className="border-border/90 bg-muted/60 text-muted-foreground border text-[10px]">
                      {translate('dashboard:equipmentLive.stopped')}
                    </Badge>
                  ) : null}
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      display.stale && 'text-muted-foreground',
                    )}
                  >
                    {display.text ?? '—'}
                  </span>
                  {tag.unit ? (
                    <span className="text-muted-foreground text-xs">
                      {tag.unit}
                    </span>
                  ) : null}
                </span>
              </div>
              {ratio !== null ? (
                <div className="bg-muted/40 mt-1 h-1 w-full overflow-hidden rounded-full">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-300',
                      display.stale ? 'bg-muted-foreground/40' : 'bg-sky-500',
                    )}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
