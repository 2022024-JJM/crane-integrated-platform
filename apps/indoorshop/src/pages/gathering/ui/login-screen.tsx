import type { CSSProperties, KeyboardEvent } from 'react';
import type { LoginVM } from '../model/use-gathering';

/** 프로토타입 로그인 — MES 계정 부서 기준으로 담당 권역이 정해진다 */
export function LoginScreen({ l }: { l: LoginVM }) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') l.submit();
  };
  const inputStyle: CSSProperties = {
    height: 40,
    border: '1px solid #C9B98E',
    borderRadius: 4,
    padding: '0 12px',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'inherit',
    color: '#1E2733',
    outline: 'none',
  };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: 24,
      }}
    >
      <div style={{ marginTop: 'auto' }} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 420,
          maxWidth: '94%',
          gap: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              background: '#EE7A00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 21,
              borderRadius: 10,
            }}
          >
            HW
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-.6px',
                color: '#28354A',
              }}
            >
              내업 공정실적 통합 현황
            </span>
            <span style={{ fontSize: 13.5, color: '#7A8699' }}>
              한화오션 · 내업 공정실적 자료수집 시스템
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 22,
            background: '#fff',
            border: '1px solid #D3CBB4',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#5C6678' }}>
              사번 (ID)
            </span>
            <input
              value={l.id}
              onChange={(e) => l.setId(e.target.value)}
              onKeyDown={onKey}
              placeholder="사번 8자리"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#5C6678' }}>
              비밀번호
            </span>
            <input
              type="password"
              value={l.pw}
              onChange={(e) => l.setPw(e.target.value)}
              onKeyDown={onKey}
              placeholder="••••"
              style={inputStyle}
            />
          </div>
          {l.err && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#C42B2B' }}>
              {l.err}
            </span>
          )}
          <div
            onClick={l.submit}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 42,
              background: '#EE7A00',
              color: '#fff',
              borderRadius: 4,
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            로그인
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '12px 16px',
            background: '#F7F4EC',
            border: '1px dashed #D8CFB8',
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#8A7A5C' }}>
            테스트 계정 (프로토타입) · 부서 권역에 따라 대시보드 구성이 달라집니다
          </span>
          {l.demoAccounts.map((d) => (
            <div
              key={d.id}
              onClick={d.pick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                cursor: 'pointer',
                padding: '3px 0',
              }}
            >
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#3C4859',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.id} <b style={{ color: '#A5AEBC' }}>/ 1234</b>
              </span>
              <span
                style={{ fontSize: 11.5, color: '#7A8699', whiteSpace: 'nowrap' }}
              >
                {d.desc}
              </span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#A5AEBC', textAlign: 'center' }}>
          통합생산(MES) 계정 부서 기준으로 담당 권역(가공·조립·의장·도장)의
          데이터만 표시됩니다
        </span>
      </div>
      <div style={{ marginBottom: 'auto' }} />
    </div>
  );
}
