import { REVISION, WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { withBaseUrl } from '@crane/core/lib/asset-url';

/**
 * KTX2(GPU 압축 텍스처, KHR_texture_basisu) 디코드 배선 — lazy 싱글턴.
 *
 * KTX2 텍스처(scripts/encode-ktx2.mjs 로 인코딩)는 GPU 에 압축된 채로 올라가
 * VRAM·샘플링 대역폭이 RGBA 의 1/4 이다. GLB 에 KHR_texture_basisu 가
 * `extensionsRequired` 로 실리므로, **GLTF 를 로드하는 모든 경로**(drei
 * useGLTF·preload, 수동 GLTFLoader)가 이 로더를 물고 있어야 한다 — 배선
 * 안 된 화면이 KTX2 GLB 를 열면 파스 단계에서 통째로 throw 된다. KTX2
 * 텍스처가 없는 GLB 에는 아무 비용도 없다(setKTX2Loader 는 참조 저장뿐).
 *
 * - 트랜스코더(wasm)는 폐쇄망 제약 때문에 CDN 이 아니라
 *   `apps/shell/public/basis/r<three REVISION>/` 에 커밋해 두고 BASE_URL
 *   경유로 서빙한다. **경로에 three 버전을 넣는 이유**: 트랜스코더는
 *   KTX2Loader 내부 FileLoader 가 고정 파일명으로 fetch 해 `?v=` 해시를
 *   태울 통로가 없다 — URL 이 고정이면 three 업그레이드 배포 때 브라우저
 *   휴리스틱 캐시가 옛 .js/.wasm 을 내줘 로더와 버전이 어긋난다(디코드
 *   조용한 실패). 버전이 경로에 있으면 업그레이드 = 새 URL 이라 안전하다.
 *   three 를 올리면 node_modules/three/examples/jsm/libs/basis/ 의 두 파일을
 *   새 `public/basis/r<새 REVISION>/` 로 복사하고 옛 디렉터리를 지운다
 *   (REVISION 은 코드가 읽으므로 경로는 자동으로 따라온다).
 * - `detectSupport` 는 GPU 의 압축 포맷(BC7 등)을 정하는데 렌더러 인스턴스가
 *   필요하다. 프리로드는 Canvas 생성 전에 시작되므로(gltf-cache-release 주석)
 *   R3F 렌더러를 기다릴 수 없어, 싱글턴 생성 시 1회용 WebGLRenderer 를 만들어
 *   즉시 dispose 한다 — 포맷 지원은 기기 수준이라 컨텍스트가 달라도 같다.
 * - 모듈 로드 시점에는 WebGL 에 접근하지 않는다(lazy) — jsdom 테스트가 이
 *   모듈을 import 해도 안전하다.
 */

let sharedLoader: KTX2Loader | null = null;

function getKtx2Loader(): KTX2Loader {
  if (sharedLoader) return sharedLoader;
  const loader = new KTX2Loader();
  loader.setTranscoderPath(withBaseUrl(`/basis/r${REVISION}/`));
  try {
    const probe = new WebGLRenderer();
    loader.detectSupport(probe);
    probe.dispose();
    // 검사용 컨텍스트는 즉시 반납 — 동시 WebGL 컨텍스트 상한(보통 16)을
    // 문서 수명 내내 1개 소모하지 않도록 (three-scene-viewer 의 WebGL 지원
    // 검사와 같은 이유).
    probe
      .getContext()
      .getExtension('WEBGL_lose_context')
      ?.loseContext();
  } catch {
    // WebGL 생성 실패(헤드리스 등) — KTX2 GLB 로드는 어차피 실패할 환경이라
    // 로더는 미검사 상태로 두고, 일반 GLB 로드는 영향받지 않는다.
  }
  sharedLoader = loader;
  return sharedLoader;
}

/**
 * GLTFLoader 에 KTX2 로더를 꽂는다. drei `useGLTF(url, true, true, 여기)` 의
 * 4번째 인자(extendLoader)와 수동 GLTFLoader 생성처 양쪽에서 쓴다.
 * three-stdlib(useGLTF 내부)와 three/examples 의 GLTFLoader 는 타입이 서로
 * 달라 구조 타입으로 받는다 — 둘 다 setKTX2Loader 를 가진다.
 */
export function extendGltfLoaderWithKtx2(loader: {
  setKTX2Loader: (ktx2Loader: never) => unknown;
}): void {
  loader.setKTX2Loader(getKtx2Loader() as never);
}
