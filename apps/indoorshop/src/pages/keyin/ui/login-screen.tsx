import type { CSSProperties } from 'react';
import type { LoginVM } from '../model/use-keyin';

const inputStyle: CSSProperties = {
  height: 58,
  border: '1px solid #C9B98E',
  borderRadius: 8,
  padding: '0 16px',
  fontSize: 19,
  fontWeight: 700,
  fontFamily: 'inherit',
  color: '#1E2733',
  outline: 'none',
  background: '#FEFAF3',
};

const labelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#3C4859',
};

export function LoginScreen({ l }: { l: LoginVM }) {
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
              width: 58,
              height: 58,
              background: '#EE7A00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 23,
              borderRadius: 12,
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
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.6px',
                color: '#28354A',
              }}
            >
              내업 공정실적 Key-In
            </span>
            <span style={{ fontSize: 14.5, color: '#7A8699' }}>
              한화오션 · 내업 공정실적 자료수집 시스템
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 24,
            background: '#fff',
            border: '1px solid #D3CBB4',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>사번 (ID)</span>
            <input
              value={l.loginId}
              onChange={(e) => l.setLoginId(e.target.value)}
              placeholder="예: 20231234"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelStyle}>비밀번호 (PW)</span>
            <input
              type="password"
              value={l.loginPw}
              onChange={(e) => l.setLoginPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') l.doLogin();
              }}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>
          {l.loginErr && (
            <span style={{ fontSize: 14, fontWeight: 800, color: '#C42B2B' }}>
              {l.loginErr}
            </span>
          )}
          <div
            onClick={l.doLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 62,
              background: '#EE7A00',
              borderRadius: 8,
              fontSize: 19,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            로그인
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            padding: '14px 18px',
            background: '#F7F4EC',
            border: '1px dashed #D8CFB8',
            borderRadius: 9,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: '#8A7A5C' }}>
            테스트 계정 (프로토타입)
          </span>
          {l.demoAccounts.map((d) => (
            <div
              key={d.id}
              onClick={d.fill}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#3C4859',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.id} <b style={{ color: '#A5AEBC' }}>/ 1234</b>
              </span>
              <span
                style={{ fontSize: 13, color: '#8A93A6', whiteSpace: 'nowrap' }}
              >
                {d.desc}
              </span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: 13, color: '#A5AEBC', textAlign: 'center' }}>
          통합생산(MES) 계정으로 로그인하면 담당 호선·블록·액티비티만
          표시됩니다
        </span>
      </div>
      <div style={{ marginBottom: 'auto' }} />
    </div>
  );
}
