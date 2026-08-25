export interface DocMeta {
  /** URL 에 쓰는 식별자 — 파일 이름을 슬러그로 만든 값 */
  id: string
  /** 원본 파일 이름 (예: `개발환경가이드.md`) */
  fileName: string
  /** 레포 기준 경로 — 화면에 "어디 있는 문서인가"를 밝힌다 */
  repoPath: string
  /** 화면에 내는 이름 — 파일 이름(확장자 제외). 사람들이 문서를 부르는 이름이다 */
  title: string
  /** 문서 안의 `#` 제목 — 파일 이름과 다를 때만 채운다 (부제로 쓴다) */
  heading?: string
  /** 제목 다음의 첫 문단 — 목록 카드의 설명줄 */
  summary: string
  /** 대략적인 분량 (글자 수 기반 읽기 시간, 분) */
  readingMinutes: number
}

export interface DocContent extends DocMeta {
  markdown: string
}
