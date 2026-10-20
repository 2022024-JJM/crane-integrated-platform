import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCraneFeedUrl,
  useCraneSnapshotStore,
  type CraneFeedConnection,
} from '@crane/features/3d';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { collectBays, countOnline, filterCraneIds } from '../lib/crane-filter';
import { useNow } from '../model/use-now';
import { ConnectionSettings } from './connection-settings';
import { ConnectionStatus } from './connection-status';
import { CraneCard } from './crane-card';

/**
 * 크레인 목록 — 검색·구역 칩은 왼쪽, 연결 상태·온라인 수·연결 설정(톱니)은
 * 오른쪽 끝. 구역 묶음 없이 한 격자이고 카드는 서버 목록 순(ID 끝 숫자)이다.
 */
export function CraneList({
  connection,
  enabled,
  onToggleConnection,
  onOpen,
}: {
  connection: CraneFeedConnection;
  /** 사용자가 연결을 켜 둔 상태(연결 해제 버튼의 반대). */
  enabled: boolean;
  onToggleConnection: () => void;
  onOpen: (craneId: string) => void;
}) {
  const { t } = useTranslation();
  const order = useCraneSnapshotStore((s) => s.order);
  const cranes = useCraneSnapshotStore((s) => s.cranes);
  const now = useNow(500);
  const [bay, setBay] = useState<string>('all');
  const [query, setQuery] = useState('');
  const bays = useMemo(() => collectBays(order, cranes), [order, cranes]);
  const visible = useMemo(
    () => filterCraneIds(order, cranes, bay, query),
    [order, cranes, bay, query],
  );
  const connected = connection === 'open';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('monitoring:tags.searchCrane')}
          aria-label={t('monitoring:tags.searchCrane')}
          className="bg-muted h-7 w-60 max-w-full text-xs"
        />
        <div
          role="group"
          aria-label={t('monitoring:tags.allBays')}
          className="flex flex-wrap gap-1"
        >
          <BayChip
            label={t('monitoring:tags.allBays')}
            count={order.length}
            pressed={bay === 'all'}
            onClick={() => setBay('all')}
          />
          {bays.map((option) => (
            <BayChip
              key={option.bay}
              label={option.bay}
              count={option.count}
              mono
              pressed={bay === option.bay}
              onClick={() => setBay(option.bay)}
            />
          ))}
        </div>
        <span className="flex-1" />
        <ConnectionStatus connection={connection} className="px-1" />
        <span className="inline-flex items-center gap-1.5 px-1">
          <span className="text-muted-foreground">
            {t('monitoring:tags.online')}
          </span>
          <span className="font-mono font-semibold">
            {countOnline(order, cranes)} / {order.length}
          </span>
        </span>
        <ConnectionSettings
          connection={connection}
          enabled={enabled}
          host={getCraneFeedUrl()}
          onToggleConnection={onToggleConnection}
        />
      </div>

      {order.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t('monitoring:tags.noCranes')}
        </p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          {t('monitoring:tags.emptyCranes')}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2.5">
          {visible.map((id) => (
            <CraneCard
              key={id}
              entry={cranes[id]}
              now={now}
              connected={connected}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BayChip({
  label,
  count,
  pressed,
  mono,
  onClick,
}: {
  label: string;
  count: number;
  pressed: boolean;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? 'secondary' : 'outline'}
      size="xs"
      aria-pressed={pressed}
      className="rounded-full font-normal"
      onClick={onClick}
    >
      <span className={mono ? 'font-mono' : undefined}>{label}</span>
      <span className="text-muted-foreground">{count}</span>
    </Button>
  );
}
