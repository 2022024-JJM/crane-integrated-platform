import type { CSSProperties } from 'react';
import type { ChipVM, WoModalVM } from '../model/use-keyin';
import { WoRow } from './activity-card';
import { Modal } from './modal';

function filterChipStyle(active: boolean): CSSProperties {
  return {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    height: 46,
    padding: '0 15px',
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ...(active
      ? { background: '#3C4859', color: '#fff', border: '1px solid #3C4859' }
      : { background: '#fff', color: '#5C6678', border: '1px solid #D8CFB8' }),
  };
}

function typeChipStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    padding: '0 13px',
    borderRadius: 20,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ...(active
      ? { background: '#3C4859', color: '#fff', border: '1px solid #3C4859' }
      : { background: '#fff', color: '#5C6678', border: '1px solid #D8CFB8' }),
  };
}

function Chip({ chip, kind }: { chip: ChipVM; kind: 'filter' | 'type' }) {
  return (
    <div
      onClick={chip.select}
      style={kind === 'filter' ? filterChipStyle(chip.active) : typeChipStyle(chip.active)}
    >
      {chip.label}
    </div>
  );
}

/** 하위 워크오더 목록 드릴다운 모달 */
export function WoListModal({ wo }: { wo: WoModalVM }) {
  return (
    <Modal
      onClose={wo.close}
      title={wo.title}
      sub={wo.sub}
      width={640}
      panelStyle={{ height: '82vh', display: 'flex', flexDirection: 'column' }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 'none',
          padding: '10px 14px',
          borderBottom: '1px solid #EFE7D4',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={wo.query}
            onChange={(e) => wo.setQuery(e.target.value)}
            placeholder="부재·WO 번호 검색"
            style={{
              flex: 1,
              minWidth: 0,
              height: 46,
              border: '1px solid #C9B98E',
              borderRadius: 7,
              padding: '0 12px',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'inherit',
              color: '#1E2733',
              outline: 'none',
              background: '#FEFAF3',
            }}
          />
          {wo.filters.map((f) => (
            <Chip key={f.label} chip={f} kind="filter" />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              flex: 'none',
              fontSize: 12.5,
              fontWeight: 800,
              color: '#8A7A5C',
              whiteSpace: 'nowrap',
            }}
          >
            작업유형
          </span>
          {wo.types.map((t) => (
            <Chip key={t.label} chip={t} kind="type" />
          ))}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {wo.rows.map((w) => (
          <WoRow key={w.seq} w={w} small />
        ))}
        {wo.more && (
          <div
            onClick={wo.loadMore}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 52,
              borderRadius: 7,
              background: '#F7F5EE',
              border: '1px solid #DDD4BE',
              fontSize: 15,
              fontWeight: 800,
              color: '#8A5A1A',
              cursor: 'pointer',
            }}
          >
            더 보기 ({wo.restN}개 남음)
          </div>
        )}
      </div>

      <div
        style={{
          flex: 'none',
          padding: '10px 14px',
          borderTop: '1px solid #EFE7D4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{ fontSize: 13.5, color: '#8A93A6', whiteSpace: 'nowrap' }}
        >
          표시 {wo.shownN} / {wo.filteredN}건
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginLeft: 'auto',
          }}
        >
          {wo.batchLabel && (
            <div
              onClick={wo.doBatch}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 52,
                padding: '0 18px',
                background: '#fff',
                border: '2px solid #5CA627',
                borderRadius: 7,
                fontSize: 15,
                fontWeight: 800,
                color: '#2F8F5B',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {wo.batchLabel}
            </div>
          )}
          <div
            onClick={wo.close}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 52,
              padding: '0 30px',
              background: '#EE7A00',
              borderRadius: 7,
              fontSize: 16,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            닫기
          </div>
        </div>
      </div>
    </Modal>
  );
}
