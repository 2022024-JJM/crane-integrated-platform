import type { ParseKeys } from 'i18next'
import { INSHOP_NS } from './config'

/**
 * 이 앱의 번역 키 타입.
 *
 * `ParseKeys` 는 인자가 없으면 defaultNS(셸의 'common')를 기준으로 잡는다.
 * 네임스페이스를 박아 둔 별칭을 쓰면 화면 쪽에서 매번 타입 인자를 적지 않아도
 * 이 앱의 키만 통과한다.
 */
export type InshopKey = ParseKeys<typeof INSHOP_NS>
