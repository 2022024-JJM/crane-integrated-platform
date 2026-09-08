import type { Resources } from '../shared/lib/i18n/locales/ko'
import type { fabricationKo } from '../processes/fabrication/i18n/ko'
import type { assemblyKo } from '../processes/assembly/i18n/ko'
import type { outfittingKo } from '../processes/outfitting/i18n/ko'
import type { paintingKo } from '../processes/painting/i18n/ko'
import type { yardKo } from '../processes/yard/i18n/ko'

/**
 * `t('...')` 의 키를 타입으로 묶는다. (이식: 셸 i18next 의 'inshop' 네임스페이스에 얹는다 —
 * defaultNS 를 여기서 선언하면 셸·다른 모듈의 t() 까지 이 키 집합으로 좁혀진다.)
 *
 * 이게 없으면 오타난 키가 화면에 키 문자열 그대로 찍힐 때까지 아무도 모른다 —
 * 특히 영어로 볼 일이 드문 팀에서는 영어 화면의 오타가 오래 살아남는다.
 *
 * 공통 키(`Resources`)에 각 공정 모듈이 소유한 조각을 더한다. 모듈 안에서 키를
 * 더하거나 고치는 일은 이 파일을 건드리지 않는다 — **모듈을 새로 만들 때만** 한 줄
 * 늘어난다. (런타임 병합은 `app/bootstrap.ts` 가 한다.)
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      inshop: Resources &
        typeof fabricationKo &
        typeof assemblyKo &
        typeof outfittingKo &
        typeof paintingKo &
        typeof yardKo
    }
  }
}
