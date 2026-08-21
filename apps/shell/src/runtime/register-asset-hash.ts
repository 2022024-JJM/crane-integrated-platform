import { registerAssetHashManifest } from '@crane/domain/3d';
import { ASSET_HASH_MANIFEST } from 'virtual:asset-hash-manifest';

/**
 * 빌드 타임에 계산된 public/ 자산 콘텐츠 해시를 도메인 레이어에 넘긴다.
 *
 * 이 모듈은 import 부작용으로만 동작한다 — main.tsx 최상단에서 한 번
 * import 되며, 그 시점 이후의 모든 withBaseUrl() 호출이 `?v=<hash>` 를 얻는다.
 * 도메인 패키지가 shell 의 가상 모듈을 직접 import 하면 의존 방향이 뒤집히므로
 * (packages/ 가 apps/ 를 알게 된다) 주입 지점을 앱 쪽에 둔다.
 */
registerAssetHashManifest(ASSET_HASH_MANIFEST);
