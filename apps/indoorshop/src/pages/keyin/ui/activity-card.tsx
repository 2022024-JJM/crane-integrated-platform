import type { CSSProperties } from 'react';
import type { CardStatus, KeyinProc } from '../model/types';
import type { CardVM, WoRowVM } from '../model/use-keyin';

const PROC_COLOR: Record<KeyinProc, string> = {
  가공: '#2E5E96',
  조립: '#2F6E58',
  의장: '#6D5A9C',
  도장: '#96604A',
};

/**
 * 상태 칩 — [라벨, 글자색, 배경, 테두리].
 * 헤더 칩은 짧게 — 적색 '입력 필요'는 카드 본문 배너가 담당하므로
 * 헤더는 중립 톤 (적색 3중 반복 방지)
 */
const STATUS_META: Record<CardStatus, [string, string, string, string]> = {
  none: ['입력 필요', '#5C6678', '#ECEEF1', '#CFD5DE'],
  auto: ['자동수집 완료', '#2F8F5B', '#E9F4EE', '#BFDECB'],
  typed: ['수정됨', '#B55A00', '#FBF1E2', '#E8CB9C'],
  fixed: ['제출 완료', '#2F8F5B', '#E9F4EE', '#BFDECB'],
  fixedPart: ['제출됨 · 미완료', '#B55A00', '#FBF1E2', '#E8CB9C'],
};

const noAutoBadge: CSSProperties = {
  flex: 'none',
  fontSize: 11.5,
  fontWeight: 800,
  color: '#C42B2B',
  background: '#FBECEC',
  border: '1px solid #EDCFCF',
  padding: '2px 8px',
  borderRadius: 10,
  whiteSpace: 'nowrap',
};

function bigBtn(kind: 'green' | 'greenGhost' | 'orange' | 'blue'): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 7,
    fontSize: 16,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    ...(kind === 'green'
      ? { background: '#5CA627', color: '#fff', border: '2px solid #5CA627' }
      : kind === 'greenGhost'
        ? { background: '#fff', color: '#2F8F5B', border: '2px solid #9CC98A' }
        : kind === 'orange'
          ? { background: '#EE7A00', color: '#fff', border: '2px solid #EE7A00' }
          : { background: '#fff', color: '#2E5E96', border: '2px solid #A8B8CC' }),
  };
}

function WoRow({ w, small }: { w: WoRowVM; small?: boolean }) {
  return (
    <div
      onClick={w.toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: small ? '5px 10px' : '6px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        flex: 'none',
        ...(w.done
          ? { background: '#F0F7EA', border: '1px solid #D6E8C4' }
          : { background: '#FBFAF6', border: '1px solid #EAE4D4' }),
      }}
    >
      <span
        style={{
          flex: 'none',
          minWidth: 34,
          height: 34,
          padding: small ? '0 4px' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 17,
          fontSize: small ? 13 : 15,
          fontWeight: 800,
          ...(w.done
            ? { background: '#5CA627', color: '#fff' }
            : { background: '#ECEEF1', color: '#8A93A6' }),
        }}
      >
        {w.seq}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: small ? 15 : 16,
          fontWeight: 700,
          color: '#3C4859',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {w.name}
      </span>
      <span
        style={{
          flex: 'none',
          fontSize: small ? 12.5 : 13,
          color: '#A5AEBC',
          whiteSpace: 'nowrap',
        }}
      >
        {w.wo}
      </span>
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: small ? 44 : 46,
          width: small ? 100 : 110,
          borderRadius: 7,
          fontSize: small ? 15 : 16,
          fontWeight: 800,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          ...(w.done
            ? { background: '#5CA627', color: '#fff', border: '2px solid #5CA627' }
            : {
                background: '#fff',
                color: '#8A93A6',
                border: '2px solid #D5DAE2',
              }),
        }}
      >
        {w.done ? '✓ 완료' : '미완료'}
      </div>
    </div>
  );
}

export { WoRow };

export function ActivityCard({ c }: { c: CardVM }) {
  const meta = STATUS_META[c.status];
  const highlighted = c.confirmed || c.edited;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: '#fff',
        borderRadius: 9,
        ...(c.submittedDone
          ? { border: '1px solid #C6E3A2', boxShadow: 'inset 4px 0 0 #5CA627' }
          : { border: '1px solid #D3CBB4' }),
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          rowGap: 6,
          flex: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            rowGap: 4,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: '-0.4px',
              whiteSpace: 'nowrap',
              color: PROC_COLOR[c.proc],
            }}
          >
            {c.proc}
          </span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#3C4859',
              whiteSpace: 'nowrap',
            }}
          >
            {c.name}
          </span>
          <span
            style={{ fontSize: 13, color: '#8A93A6', whiteSpace: 'nowrap' }}
          >
            {c.actNo}
          </span>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            padding: '5px 12px',
            borderRadius: 14,
            whiteSpace: 'nowrap',
            color: meta[1],
            background: meta[2],
            border: `1px solid ${meta[3]}`,
          }}
        >
          {meta[0]}
        </span>
      </div>

      {/* 자동 인식(컨펌) 영역 */}
      {c.hasAuto && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            rowGap: 10,
            flexWrap: 'wrap',
            flex: 'none',
            padding: '12px 14px',
            borderRadius: 7,
            ...(highlighted
              ? { background: '#F0F7EA', border: '1px solid #C6E3A2' }
              : { background: '#FEFAF3', border: '1px solid #EDD3AE' }),
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: 'none',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#7A8394',
                whiteSpace: 'nowrap',
              }}
            >
              자동 인식 완성도 (LiDAR · {c.autoAt})
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: '-1.5px',
                  lineHeight: 1,
                  color: c.edited ? '#B55A00' : '#1E2733',
                }}
              >
                {c.autoVal}
              </span>
              <span style={{ fontSize: 19, fontWeight: 800, color: '#8A93A6' }}>
                %
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flex: 1,
              minWidth: 236,
              justifyContent: 'flex-end',
            }}
          >
            <div
              onClick={c.confirmAuto}
              style={{
                ...bigBtn(highlighted ? 'green' : 'greenGhost'),
                flex: 1,
                maxWidth: 170,
                padding: '0 14px',
              }}
            >
              {c.confirmLabel}
            </div>
            <div
              onClick={c.openPad}
              style={{ ...bigBtn('blue'), flex: 'none', width: 92 }}
            >
              수정
            </div>
          </div>
          {c.autoNote && (
            <span style={{ flex: '100%', fontSize: 11, color: '#909AAC' }}>
              {c.autoNote}
            </span>
          )}
        </div>
      )}

      {/* 자동수집 없음 — 스텝 안내 배너 */}
      {c.noAutoStep && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 'none',
            padding: '10px 13px',
            background: '#FBF2DE',
            border: '1px solid #E8CB9C',
            borderRadius: 7,
          }}
        >
          <span style={noAutoBadge}>자동수집 없음</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#8A5A1A' }}>
            {c.stepNote}
          </span>
        </div>
      )}

      {/* 자동수집 없음 — 실적률 직접 입력 */}
      {c.noAutoPct && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            rowGap: 10,
            flexWrap: 'wrap',
            flex: 'none',
            padding: '12px 14px',
            borderRadius: 7,
            ...(c.edited
              ? { background: '#F0F7EA', border: '1px solid #C6E3A2' }
              : { background: '#FBECEC', border: '1px solid #EDCFCF' }),
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: 'none',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={noAutoBadge}>자동수집 없음</span>
              <span
                style={{
                  fontSize: 12,
                  color: '#8A5252',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.failTxt}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  letterSpacing: '-1.5px',
                  lineHeight: 1,
                  color: c.edited ? '#B55A00' : '#1E2733',
                }}
              >
                {c.autoVal}
              </span>
              <span style={{ fontSize: 19, fontWeight: 800, color: '#8A93A6' }}>
                %
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#8A93A6',
                  whiteSpace: 'nowrap',
                  marginLeft: 4,
                }}
              >
                실적률 직접 입력
              </span>
            </div>
          </div>
          <div
            onClick={c.openPad}
            style={{
              ...bigBtn(c.edited ? 'green' : 'orange'),
              flex: 'none',
              padding: '0 22px',
            }}
          >
            {c.manualBtnLabel}
          </div>
        </div>
      )}

      {/* 하위 워크오더 — 소량은 인라인 */}
      {c.woInline && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            flex: 'none',
          }}
        >
          {c.woHeader && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#8A7A5C',
                whiteSpace: 'nowrap',
              }}
            >
              {c.woHeader}
            </span>
          )}
          {c.wos.map((w) => (
            <WoRow key={w.wo} w={w} />
          ))}
        </div>
      )}

      {/* 하위 워크오더 — 대량은 요약 + 목록 드릴다운 */}
      {c.woSummary && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flex: 'none',
            padding: '12px 14px',
            background: '#FBFAF6',
            border: '1px solid #EAE4D4',
            borderRadius: 7,
            flexWrap: 'wrap',
            rowGap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#8A7A5C',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              하위 워크오더 {c.woTotal}개 · {c.woTypeTxt}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#2F8F5B',
                  whiteSpace: 'nowrap',
                }}
              >
                완료
              </span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: '-0.8px',
                  color: '#1E2733',
                }}
              >
                {c.woDone}
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#B7BEC8',
                  padding: '0 5px',
                }}
              >
                ·
              </span>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#C42B2B',
                  whiteSpace: 'nowrap',
                }}
              >
                미완료
              </span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: '-0.8px',
                  color: c.woWait > 0 ? '#C42B2B' : '#B7BEC8',
                }}
              >
                {c.woWait}
              </span>
            </div>
          </div>
          <div
            onClick={c.openWoList}
            style={{ ...bigBtn('blue'), flex: 'none', padding: '0 22px' }}
          >
            목록 보기
          </div>
        </div>
      )}
    </div>
  );
}
