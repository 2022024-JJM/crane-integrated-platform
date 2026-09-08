import type { InshopKey } from '../lib/i18n/keys'

/**
 * 현재 사용자 — 단일 출처.
 *
 * 인증이 붙기 전까지의 자리표시자다. 계정 API 가 생기면 이 파일만 세션 조회로
 * 바꾸면 되도록, 화면 쪽에서는 항상 이 모양(`CurrentUser`)만 보게 한다.
 */
export interface CurrentUser {
  /**
   * 이름·역할·소속은 아직 자리표시자라 **번역 키**로 들고 있다.
   * 계정 API 가 붙으면 서버가 준 실제 사람 이름이 오고, 그때는 번역 대상이 아니다.
   */
  nameKey: InshopKey
  /** 직책·역할 — 아바타 아래 보조 줄에 쓴다 */
  roleKey: InshopKey
  teamKey: InshopKey
  email: string
}

export const CURRENT_USER: CurrentUser = {
  nameKey: 'account.userName',
  roleKey: 'account.role',
  teamKey: 'app.team',
  email: 'operator@hanwha.com',
}

/**
 * 아바타에 쓸 이니셜.
 *
 * 한글 이름은 알파벳처럼 단어별 첫 글자를 따면 "운담" 처럼 읽히지 않는 조합이
 * 나오므로, 한글이면 앞 두 글자를 그대로 쓴다.
 */
export function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'

  if (/[가-힣]/.test(trimmed)) {
    return trimmed.replace(/\s/g, '').slice(0, 2)
  }

  const words = trimmed.split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
