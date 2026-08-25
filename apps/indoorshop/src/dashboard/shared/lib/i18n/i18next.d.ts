import type { Resources } from './locales/ko'

/**
 * `t('...')` 의 키를 타입으로 묶는다.
 *
 * 이게 없으면 오타난 키가 화면에 키 문자열 그대로 찍힐 때까지 아무도 모른다 —
 * 특히 영어로 볼 일이 드문 팀에서는 영어 화면의 오타가 오래 살아남는다.
 *
 * 원본은 `defaultNS: 'translation'` 에 이 앱의 리소스만 걸었다. 모듈 보강은
 * 프로그램 전역이라 그대로 두면 셸·다른 모듈의 `t()` 까지 이 키 집합으로
 * 좁혀져 멀쩡한 호출이 타입 오류가 된다. 네임스페이스를 'inshop' 으로 두고
 * defaultNS 는 셸 값('common')을 그대로 둔다.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      inshop: Resources
    }
  }
}
