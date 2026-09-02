import { addInshopBundle } from '../shared/lib/i18n/config'
import { registerProcessModules } from '../shared/model/processRegistry'
import { fabricationModule } from '../processes/fabrication/module'
import { assemblyModule } from '../processes/assembly/module'
import { outfittingModule } from '../processes/outfitting/module'
import { paintingModule } from '../processes/painting/module'
import { yardModule } from '../processes/yard/module'

/*
 * 공정 모듈을 앱에 등록한다.
 *
 * **이 목록은 모듈을 새로 만들 때만 손댄다.** 라우트·네비게이션 항목·번역 키·
 * 대시보드 카드를 더하는 일은 전부 각 모듈의 `module.ts` 안에서 끝나므로,
 * 공정별 작업이 이 파일에서 부딪히지 않는다.
 *
 * 사이드바에 서는 차례는 배열 순서가 아니라 각 모듈의 `order` 가 정한다.
 */
const processModules = [
  fabricationModule,
  assemblyModule,
  outfittingModule,
  paintingModule,
  yardModule,
]

registerProcessModules(processModules)

/*
 * 모듈이 들고 온 번역 조각을 공통 리소스에 얹는다.
 *
 * deep=true 로 병합해야 공통 로케일의 같은 묶음을 지우지 않고 더한다.
 */
for (const processModule of processModules) {
  addInshopBundle('ko', processModule.i18n.ko)
  addInshopBundle('en', processModule.i18n.en)
}
