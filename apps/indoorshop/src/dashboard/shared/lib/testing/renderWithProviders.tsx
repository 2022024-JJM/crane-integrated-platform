import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import i18n, { INSHOP_NS } from '../i18n/config'
// 공정 번역 조각까지 큐에 올린다 — 아래 init 의 'initialized' 에서 한꺼번에 얹힌다
import '../../../app/bootstrap'

/*
 * 화면 테스트의 공통 껍데기.
 *
 * 앱의 화면은 대부분 두 가지에 기대어 산다 — 번역(`t()`)과 라우터(`<Link>`). 그것을
 * 빠뜨린 채 그리면 "번역 키가 그대로 보인다"거나 "Link 는 Router 안에서만"이라는,
 * 검증하려던 것과 무관한 실패가 난다. 그 둘을 여기서 한 번에 두른다.
 *
 * 언어는 **한국어로 고정**한다 — 테스트가 실행 환경의 브라우저 언어에 따라 달라지면
 * 안 되기 때문이다. 영어 문구를 봐야 하는 테스트는 `i18n.changeLanguage('en')` 로
 * 그 테스트 안에서만 바꾼다.
 */

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** 라우터 초기 경로 — 경로에 따라 갈라지는 화면을 세울 때 쓴다 */
  route?: string
}

/*
 * (이식) 원본 config 은 스스로 init 했지만, 이식본은 셸의 initI18n 에 얹혀 산다 —
 * vitest 에는 그게 없으므로 여기서 초기화한다. config·bootstrap 이 큐에 쌓아 둔
 * 번들(공통·공정)은 'initialized' 리스너가 이때 한꺼번에 얹는다.
 */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: 'ko',
    fallbackLng: 'ko',
    defaultNS: INSHOP_NS,
    ns: [INSHOP_NS],
    resources: {},
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...options }: RenderWithProvidersOptions = {},
): RenderResult {
  void i18n.changeLanguage('ko')

  function Providers({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </I18nextProvider>
    )
  }

  return render(ui, { wrapper: Providers, ...options })
}
