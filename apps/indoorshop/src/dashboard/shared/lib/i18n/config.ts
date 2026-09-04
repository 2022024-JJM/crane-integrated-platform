import { initReactI18next } from 'react-i18next'
import { i18n } from '@crane/core/config/i18n'
import { ko } from './locales/ko'
import { en } from './locales/en'

export const LANGUAGES = ['ko', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** 언어 선택 UI 가 쓰는 이름 — **각 언어를 그 언어로** 적는다 (English 를 '영어'로 쓰지 않는다) */
export const LANGUAGE_LABEL: Record<Language, string> = {
  ko: '한국어',
  en: 'English',
}

/** 날짜·시각 서식에 쓰는 로케일 */
export const LANGUAGE_LOCALE: Record<Language, string> = {
  ko: 'ko-KR',
  en: 'en-US',
}

/**
 * 내업 대시보드 문구를 셸 i18next 인스턴스에 **네임스페이스로** 얹는다.
 *
 * 원본은 여기서 `i18n.init()` 을 직접 불렀다. 그런데 i18next 의 기본 export 는
 * 프로세스 전역 싱글턴이고 셸(@crane/core/config/i18n)도 같은 인스턴스를 init
 * 한다 — 나중에 부르는 쪽이 상대의 resources·ns 설정을 통째로 덮어써서, import
 * 순서에 따라 이 화면이든 다른 모듈이든 한쪽 번역이 키 그대로 노출된다.
 *
 * 그래서 init 은 셸에 맡기고 이쪽은 번들만 등록한다. 셸이 지원하는 'la' 는
 * 원본에 리소스가 없으므로 fallbackLng('ko')가 받는다.
 */
export const INSHOP_NS = 'inshop'

/*
 * init 전에는 i18next 싱글턴에 addResourceBundle 이 아직 없다. 셸 런타임에서는
 * initI18n 이 이 청크보다 먼저 돌지만, vitest 는 아무도 init 하지 않은 채 이
 * 모듈을 끌어온다 — 그때는 큐에 쌓았다가 'initialized' 에서 얹는다.
 */
const pending: [string, object][] = []

export function addInshopBundle(lng: string, resources: object): void {
  if (i18n.isInitialized) {
    i18n.addResourceBundle(lng, INSHOP_NS, resources, true, true)
  } else {
    pending.push([lng, resources])
  }
}

i18n.on('initialized', () => {
  for (const [lng, resources] of pending.splice(0)) {
    i18n.addResourceBundle(lng, INSHOP_NS, resources, true, true)
  }
})

let registered = false

export function registerInshopLocales(): void {
  if (registered) return
  registered = true
  addInshopBundle('ko', ko)
  addInshopBundle('en', en)
}

export default i18n

/*
 * 공통 번들은 이 모듈이 로드될 때 바로 얹는다. 원본은 init 시점에 resources 로 넣었고,
 * 공정별 조각은 app/bootstrap 이 그 위에 deep-merge 한다 — bootstrap 이 이 파일을
 * import 하므로, 여기서 먼저 등록해 두면 순서가 원본과 같아진다.
 */
registerInshopLocales()

/**
 * 테스트 전용 init.
 *
 * 셸 런타임은 initI18n 이 먼저 돌지만 vitest 에는 아무도 없다. renderWithProviders
 * 뿐 아니라 addProcessMessages 를 모듈 최상위에서 부르는 테스트도 있어, init 을
 * 한 곳에서 보장한다. 런타임에서는 isInitialized 가 참이라 아무 일도 하지 않는다.
 */
export function initI18nForTests(): void {
  if (i18n.isInitialized) return
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
