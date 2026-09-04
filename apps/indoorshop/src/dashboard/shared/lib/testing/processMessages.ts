import i18n, { initI18nForTests } from '../i18n/config'

/*
 * 공정 문구 조각을 테스트 i18n 에 얹는다.
 *
 * 앱에서는 공정 로케일이 모듈 부트스트랩(`app/bootstrap.ts` → 레지스트리)을 거쳐 합쳐진다.
 * 화면 테스트는 컴포넌트 하나만 그리므로 그 부트스트랩이 돌지 않고, 그래서 공정 문구를
 * 쓰는 컴포넌트는 **번역 키가 그대로 보이는 상태**로 그려진다 — 검증하려던 것과 무관한
 * 실패가 난다.
 *
 * ⚠️ 여기서 공정 모듈을 import 하지 않는다. **조각을 인자로 받는다** — shared 는 어떤
 * 공정이 있는지 몰라야 하고(모듈 경계), 테스트가 자기 공정 것만 얹는 편이 무엇을 그리고
 * 있는지도 분명하다.
 *
 * 쓰는 쪽(테스트)에서 자기 공정 로케일 조각을 가져와 넘긴다:
 * `addProcessMessages(assemblyKo, assemblyEn)`
 *
 * (여기에 예시 import 문을 적지 않는다 — 모듈 경계 검사기는 주석 안의 import 도 실제
 *  의존으로 읽어서, 예시 한 줄 때문에 shared 가 공정을 아는 것으로 잡힌다.)
 */
export function addProcessMessages(ko: object, en?: object): void {
  initI18nForTests()
  i18n.addResourceBundle('ko', 'inshop', ko, /* deep */ true, /* overwrite */ true)
  if (en) i18n.addResourceBundle('en', 'inshop', en, true, true)
}
