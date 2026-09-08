import { useTranslation as useI18nTranslation } from 'react-i18next'
import { INSHOP_NS } from './config'

/**
 * 내업 대시보드 전용 `useTranslation`.
 *
 * 셸 i18next 의 defaultNS 는 'common' 이라 맨몸 `useTranslation()` 으로는 이 앱의
 * 키가 하나도 잡히지 않는다(키 문자열이 그대로 화면에 나온다). 화면마다
 * `useTranslation('inshop')` 을 적는 대신 네임스페이스를 여기 한 곳에 묶어 두면,
 * 새로 만드는 화면에서 빠뜨릴 자리가 없다.
 */
export function useTranslation() {
  return useI18nTranslation(INSHOP_NS)
}
