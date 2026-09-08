import { registerAssetHashManifest } from '@crane/core/lib/asset-url';
import { ASSET_HASH_MANIFEST } from 'virtual:asset-hash-manifest';

/**
 * 빌드 타임에 계산된 public/ 자산 콘텐츠 해시를 shared 레이어(@crane/core 의
 * asset-url)에 넘긴다.
 *
 * 이 모듈은 import 부작용으로만 동작한다 — main.tsx 최상단에서 한 번
 * import 되며, 그 시점 이후의 모든 withBaseUrl() 호출이 `?v=<hash>` 를 얻는다.
 * 패키지가 shell 의 가상 모듈을 직접 import 하면 의존 방향이 뒤집히므로
 * (packages/ 가 apps/ 를 알게 된다) 주입 지점을 앱 쪽에 둔다.
 *
 * 이 모듈은 main.tsx 가 정적으로 import 하므로 여기서 물리는 것은 전부 첫
 * 화면에 실리고, 그 파일들의 수정은 HMR 경계 없이 main.tsx 까지 올라가 전체
 * 리로드가 된다. 그래서 무거운 `@crane/domain/3d` 배럴(three·drei 를 끌어온다)이
 * 아니라 의존성 없는 `@crane/core/lib/asset-url` 만 import 한다.
 */
registerAssetHashManifest(ASSET_HASH_MANIFEST);
