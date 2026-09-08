import type { BlkDropdownVM } from '../model/use-gathering';

/** 블록 복수 선택 드롭다운 (필터 바) */
export function BlockDropdown({ dd }: { dd: BlkDropdownVM }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 14,
        position: 'relative',
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: '#3C4859',
          whiteSpace: 'nowrap',
        }}
      >
        블록 <b style={{ color: '#C42B2B' }}>*</b>
      </span>
      <div
        onClick={dd.toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          height: 27,
          minWidth: 150,
          border: '1px solid #C9B98E',
          borderRadius: 2,
          padding: '0 8px',
          fontSize: 11.5,
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            ...(dd.summaryOn
              ? { color: '#1E2733', fontWeight: 700 }
              : { color: '#8A93A6' }),
          }}
        >
          {dd.summary}
        </span>
        <span style={{ fontSize: 9, color: '#8A93A6' }}>▼</span>
      </div>
      {dd.open && (
        <div
          style={{
            position: 'absolute',
            left: 34,
            top: 31,
            width: 240,
            background: '#fff',
            border: '1px solid #C9B98E',
            borderRadius: 3,
            boxShadow: '0 8px 22px rgba(30,39,51,.18)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderBottom: '1px solid #EFE7D4',
              flex: 'none',
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: '#8A5A1A',
                whiteSpace: 'nowrap',
              }}
            >
              블록 선택 · {dd.selN} / {dd.totalN}개
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                onClick={dd.selectAll}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#2E5E96',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                전체 선택
              </span>
              <span
                onClick={dd.clear}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#C42B2B',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                전체 해제
              </span>
            </div>
          </div>
          <div
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid #EFE7D4',
              flex: 'none',
            }}
          >
            <input
              value={dd.query}
              onChange={(e) => dd.setQuery(e.target.value)}
              placeholder="블록 번호 검색"
              style={{
                width: '100%',
                height: 24,
                border: '1px solid #D8CFB8',
                borderRadius: 2,
                padding: '0 8px',
                fontSize: 11,
                fontFamily: 'inherit',
                color: '#1E2733',
                outline: 'none',
              }}
            />
          </div>
          <div
            style={{
              maxHeight: 260,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {dd.opts.map((bo) => (
              <div
                key={bo.no}
                onClick={bo.toggle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 28,
                  padding: '0 10px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #F5F2E9',
                  background: bo.on ? '#FDF3E7' : '#fff',
                  flex: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={bo.on}
                  readOnly
                  style={{
                    width: 14,
                    height: 14,
                    accentColor: '#EE7A00',
                    pointerEvents: 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#1E2733',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bo.no}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: '#909AAC',
                    whiteSpace: 'nowrap',
                    marginLeft: 'auto',
                  }}
                >
                  {bo.fac}
                </span>
              </div>
            ))}
          </div>
          <div
            onClick={dd.toggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 28,
              background: '#EE7A00',
              color: '#fff',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
              flex: 'none',
              borderRadius: '0 0 3px 3px',
            }}
          >
            닫기
          </div>
        </div>
      )}
    </div>
  );
}
