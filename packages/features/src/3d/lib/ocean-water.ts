/**
 * three.js `examples/jsm/objects/Water.js` (r183) 의 TypeScript 포크.
 * 원본: https://github.com/mrdoob/three.js/blob/r183/examples/jsm/objects/Water.js
 *
 * The MIT License
 *
 * Copyright © 2010-2026 three.js authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * ---
 *
 * 평면 미러 반사 + 노멀맵 파도 바다. 미러 카메라·oblique 클립 행렬·
 * textureMatrix·eye·getNoise/sunLight·xr/shadowMap.autoUpdate 저장/복원·
 * depth.setMask·viewport 복원은 원본 그대로다. 원본과 다른 점:
 *
 * - 깊이를 읽지도 쓰지도 않고(`logdepthbuf` 청크 제거) 스텐실로 "불투명 씬
 *   메시가 그려진 픽셀" 을 거른다 — 바다는 불투명 패스 뒤(renderOrder 는
 *   컴포넌트가 둔다)에 그리되 수면 아래 드라이독·잠긴 선체를 가리지 않아야
 *   하고, 거른 픽셀은 셰이더 앞에서 탈락해 비용이 0 이다(@crane/domain/3d
 *   scene-stencil.ts).
 * - 반사 RT 에 깊이+스텐실 버퍼를 둔다 — 실루엣 마스크/헐(SILHOUETTE_STENCIL_BIT)
 *   이 RT 에서도 동작해 선택·충돌 테두리가 반사에서 덩어리로 뭉개지지 않는다.
 * - 반사 RT 는 원본의 HalfFloat 이 아니라 8bit 다 — EXR 하늘은 수평선 띠가
 *   백색의 몇 배(HDR)라 그대로 비추면 얕은 각도의 바다가 통째로 흰색이 된다.
 *   8bit 는 1.0 에서 잘라 EXR 이 달라도 반사 상한이 같고 RT 도 절반이다. 그 위에
 *   `reflectionIntensity` 유니폼을 곱해 비친 하늘을 누그러뜨린다(원본은 1).
 *   원본 예제는 렌더러 노출 0.1 로 같은 문제를 숨기는데 이 씬은 조명 전체가
 *   노출 1 기준이라 쓸 수 없다.
 * - `sunDiffuseIntensity` 유니폼 — 원본이 수면 전체에 더하는 태양 확산 회색
 *   (0.15·sin(고도)·sunColor²)의 배율(원본은 1). 우리 하늘·노출에선 낮에 이
 *   회색이 waterColor 산란을 덮어 물이 회색이 되므로 낮춰 쓴다.
 * - 직교 카메라(미니맵 캡처)는 미러 패스를 건너뛰고 `eye` 유니폼만 갱신한다
 *   — 카메라 위치가 아니라 시선 **반대쪽 아주 먼 점**(`ORTHO_EYE_DISTANCE`)에
 *   둔다. 직교 투영은 시선이 평행이라 카메라 위치를 그대로 쓰면 픽셀마다
 *   시선이 부채꼴로 퍼져 산란·프레넬이 중심에서 가장자리로 어두워지는
 *   비네트가 생기고, 갱신하지 않으면 마지막 원근 카메라 기준이 된다.
 * - `excludedObjects` 게터 — 미러 패스 동안만 `visible=false` 로 숨길 객체
 *   (컨텍스트 지형·밤하늘 틴트 돔·태양/달 스프라이트). 매 패스 호출하며
 *   `undefined`/`null` 항목은 건너뛴다(늦게 등록되는 지도 루트). three 는
 *   `visible=false` 루트의 서브트리를 통째로 건너뛰므로 지도 루트 하나로 LOD
 *   타일 전부가 빠진다. 메인 패스 렌더 리스트는 이미 만들어진 뒤라 메인
 *   프레임엔 영향 없다. `layers` 는 쓰지 않는다.
 * - 직교 카메라엔 미러 패스가 없다 — 미러 카메라가 projectionMatrix 를
 *   복사하므로 직교 투영에선 무의미하다. 미니맵 캡처는 물을 보이는 채로
 *   `reflectionIntensity` 0 으로 그려 낡은 반사 RT 가 섞이지 않게 한다.
 * - 중첩 render 동안 `renderer.info.autoReset` 을 끈다 — 안 끄면 중첩 render 의
 *   `info.reset()` 이 물 앞에 그린 드로우콜을 지워 perf HUD 가 "물 뒤 + 미러"
 *   만 보고한다. HUD 값은 "shadow pass 뒤 메인 패스 + 미러 패스" 다.
 * - 중첩 render 를 try/finally 로 감싸 visible·제외 객체·info.autoReset·
 *   xr.enabled·shadowMap.autoUpdate·렌더 타깃·viewport 를 반드시 원복한다.
 * - `lights: true`·`UniformsLib.lights`·shadowmap/shadowmask/lights_pars_begin
 *   청크를 빼고 `getShadowMask()` 를 1.0 으로 둔다 — 원본도 receiveShadow=false
 *   라 결과가 같고, 빼면 조명 구성이 바뀔 때의 물 셰이더 재컴파일이 없어진다.
 * - `dispose()` 는 RT·머티리얼만 폐기한다. geometry 는 컴포넌트 소유.
 * - `isOceanWater` 플래그·타입 가드, `uniforms` 를 타입으로 노출. 옵션에
 *   `size` 는 두지 않는다(원본도 읽지 않고 유니폼 기본 1).
 *
 * three 업그레이드 시 새 `Water.js` 와 대조한다.
 */
import { SCENE_OPAQUE_STENCIL_BIT } from '@crane/domain/3d';
import {
  Color,
  EqualStencilFunc,
  FrontSide,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type BufferGeometry,
  type Camera,
  type ColorRepresentation,
  type IUniform,
  type Object3D,
  type Scene,
  type Side,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { hideForReflection, restoreAfterReflection } from './water-reflection';

export interface OceanWaterOptions {
  /** 파도 노멀맵. RepeatWrapping 이어야 한다(ensureRepeatWrapping). */
  waterNormals: Texture;
  /** 반사 RT 크기. 클수록 선명하고 비싸다. 기본 512. */
  textureWidth?: number;
  textureHeight?: number;
  /** oblique 클립 평면 바이어스. 기본 0. */
  clipBias?: number;
  alpha?: number;
  time?: number;
  /** 태양 방향(단위 벡터). 유니폼 값으로 **그 참조를** 쓴다. */
  sunDirection?: Vector3;
  sunColor?: ColorRepresentation;
  waterColor?: ColorRepresentation;
  /** 카메라 월드 위치 스크래치. 유니폼 값으로 그 참조를 쓴다. */
  eye?: Vector3;
  /** 반사 왜곡 세기. 기본 20. */
  distortionScale?: number;
  /** 비친 상의 밝기 배율. 기본 1(원본과 같음). HDR 하늘이면 1 미만으로 둔다. */
  reflectionIntensity?: number;
  /** 태양 확산 회색항의 배율. 기본 1(원본과 같음). */
  sunDiffuseIntensity?: number;
  side?: Side;
  fog?: boolean;
  /** 미러 패스 동안만 숨길 객체. 매 패스 호출된다. */
  excludedObjects?: () => Iterable<Object3D | null | undefined>;
}

export interface OceanWaterUniforms extends Record<string, IUniform> {
  normalSampler: { value: Texture };
  mirrorSampler: { value: Texture };
  alpha: { value: number };
  time: { value: number };
  size: { value: number };
  distortionScale: { value: number };
  reflectionIntensity: { value: number };
  sunDiffuseIntensity: { value: number };
  textureMatrix: { value: Matrix4 };
  sunColor: { value: Color };
  sunDirection: { value: Vector3 };
  eye: { value: Vector3 };
  waterColor: { value: Color };
}

const DEFAULT_TEXTURE_SIZE = 512;
/** 직교 카메라의 eye 를 시선 반대쪽으로 띄우는 거리(m). 씬 크기보다 훨씬 커서 시선이 사실상 평행이면 된다. */
const ORTHO_EYE_DISTANCE = 1e6;
const DEFAULT_SUN_DIRECTION = (): Vector3 => new Vector3(0.70707, 0.70707, 0);

const VERTEX_SHADER = /* glsl */ `
  uniform mat4 textureMatrix;
  uniform float time;

  varying vec4 mirrorCoord;
  varying vec4 worldPosition;

  #include <common>
  #include <fog_pars_vertex>

  void main() {
    mirrorCoord = modelMatrix * vec4( position, 1.0 );
    worldPosition = mirrorCoord.xyzw;
    mirrorCoord = textureMatrix * mirrorCoord;
    vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );
    gl_Position = projectionMatrix * mvPosition;

    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <fog_vertex>
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D mirrorSampler;
  uniform float alpha;
  uniform float time;
  uniform float size;
  uniform float distortionScale;
  uniform float reflectionIntensity;
  uniform float sunDiffuseIntensity;
  uniform sampler2D normalSampler;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  uniform vec3 eye;
  uniform vec3 waterColor;

  varying vec4 mirrorCoord;
  varying vec4 worldPosition;

  vec4 getNoise( vec2 uv ) {
    vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
    vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
    vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
    vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
    vec4 noise = texture2D( normalSampler, uv0 ) +
      texture2D( normalSampler, uv1 ) +
      texture2D( normalSampler, uv2 ) +
      texture2D( normalSampler, uv3 );
    return noise * 0.5 - 1.0;
  }

  void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
    vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
    float direction = max( 0.0, dot( eyeDirection, reflection ) );
    specularColor += pow( direction, shiny ) * sunColor * spec;
    diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
  }

  #include <common>
  #include <packing>
  #include <bsdfs>
  #include <fog_pars_fragment>

  void main() {
    vec4 noise = getNoise( worldPosition.xz * size );
    vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

    vec3 diffuseLight = vec3(0.0);
    vec3 specularLight = vec3(0.0);

    vec3 worldToEye = eye-worldPosition.xyz;
    vec3 eyeDirection = normalize( worldToEye );
    sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );

    float distance = length(worldToEye);

    vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
    vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) ) * reflectionIntensity;

    float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
    float rf0 = 0.02;
    float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
    vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
    // 원본의 그림자 마스크 자리 — receiveShadow=false 라 항상 1.0 이다.
    vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 * sunDiffuseIntensity + scatter ) * 1.0, reflectionSample + specularLight, reflectance );
    vec3 outgoingLight = albedo;
    gl_FragColor = vec4( outgoingLight, alpha );

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** 인스턴스마다 새 유니폼 — `UniformsUtils.merge` 가 값을 깊은 복사한다. */
function createUniforms(): OceanWaterUniforms {
  return UniformsUtils.merge([
    UniformsLib['fog'],
    {
      normalSampler: { value: null },
      mirrorSampler: { value: null },
      alpha: { value: 1.0 },
      time: { value: 0.0 },
      size: { value: 1.0 },
      distortionScale: { value: 20.0 },
      reflectionIntensity: { value: 1.0 },
      sunDiffuseIntensity: { value: 1.0 },
      textureMatrix: { value: new Matrix4() },
      sunColor: { value: new Color(0x7f7f7f) },
      sunDirection: { value: DEFAULT_SUN_DIRECTION() },
      eye: { value: new Vector3() },
      waterColor: { value: new Color(0x555555) },
    },
  ]) as OceanWaterUniforms;
}

export class OceanWater extends Mesh<BufferGeometry, ShaderMaterial> {
  readonly isOceanWater = true;

  private readonly clipBias: number;
  private readonly excludedObjects:
    | (() => Iterable<Object3D | null | undefined>)
    | null;
  private readonly renderTarget: WebGLRenderTarget;
  private readonly mirrorCamera = new PerspectiveCamera();
  private readonly textureMatrix = new Matrix4();

  // 미러 패스 스크래치 — 매 프레임 할당을 피한다.
  private readonly mirrorPlane = new Plane();
  private readonly normal = new Vector3();
  private readonly mirrorWorldPosition = new Vector3();
  private readonly cameraWorldPosition = new Vector3();
  private readonly rotationMatrix = new Matrix4();
  private readonly lookAtPosition = new Vector3(0, 0, -1);
  private readonly clipPlane = new Vector4();
  private readonly view = new Vector3();
  private readonly target = new Vector3();
  private readonly q = new Vector4();
  /** 미러 패스 동안 숨긴 제외 객체 — restoreAfterReflection 이 비운다. */
  private readonly hiddenForReflection: Object3D[] = [];

  constructor(geometry: BufferGeometry, options: OceanWaterOptions) {
    super(geometry);

    const textureWidth = options.textureWidth ?? DEFAULT_TEXTURE_SIZE;
    const textureHeight = options.textureHeight ?? DEFAULT_TEXTURE_SIZE;
    this.clipBias = options.clipBias ?? 0.0;
    this.excludedObjects = options.excludedObjects ?? null;

    const alpha = options.alpha ?? 1.0;
    const time = options.time ?? 0.0;
    const sunDirection = options.sunDirection ?? DEFAULT_SUN_DIRECTION();
    const sunColor = new Color(options.sunColor ?? 0xffffff);
    const waterColor = new Color(options.waterColor ?? 0x7f7f7f);
    const eye = options.eye ?? new Vector3(0, 0, 0);
    const distortionScale = options.distortionScale ?? 20.0;
    const reflectionIntensity = options.reflectionIntensity ?? 1.0;
    const sunDiffuseIntensity = options.sunDiffuseIntensity ?? 1.0;
    const side = options.side ?? FrontSide;
    const fog = options.fog ?? false;

    // 8bit(기본 UnsignedByte) — 파일 상단 주석(HDR 하늘 클램프).
    this.renderTarget = new WebGLRenderTarget(textureWidth, textureHeight, {
      depthBuffer: true,
      stencilBuffer: true,
    });

    const material = new ShaderMaterial({
      name: 'OceanWaterShader',
      uniforms: createUniforms(),
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side,
      fog,
      // 깊이는 읽지도 쓰지도 않고 스텐실 비트로만 거른다(파일 상단 주석).
      depthTest: false,
      depthWrite: false,
      stencilWrite: true,
      // 테스트만 — 값은 쓰지 않는다.
      stencilWriteMask: 0,
      stencilRef: 0,
      stencilFunc: EqualStencilFunc,
      stencilFuncMask: SCENE_OPAQUE_STENCIL_BIT,
    });

    const uniforms = material.uniforms as OceanWaterUniforms;
    uniforms.mirrorSampler.value = this.renderTarget.texture;
    uniforms.textureMatrix.value = this.textureMatrix;
    uniforms.alpha.value = alpha;
    uniforms.time.value = time;
    uniforms.normalSampler.value = options.waterNormals;
    uniforms.sunColor.value = sunColor;
    uniforms.waterColor.value = waterColor;
    uniforms.sunDirection.value = sunDirection;
    uniforms.distortionScale.value = distortionScale;
    uniforms.reflectionIntensity.value = reflectionIntensity;
    uniforms.sunDiffuseIntensity.value = sunDiffuseIntensity;
    uniforms.eye.value = eye;

    this.material = material;
  }

  get uniforms(): OceanWaterUniforms {
    return this.material.uniforms as OceanWaterUniforms;
  }

  override onBeforeRender(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
  ): void {
    // 미러 카메라가 projectionMatrix 를 복사하므로 직교 투영엔 의미가 없다 —
    // 미러 패스는 건너뛰고 eye 만 시선 반대쪽 먼 점으로 둔다(파일 상단 주석).
    // 카메라 로컬 +Z(matrixWorld 셋째 열)가 시선의 반대 방향이다.
    const perspective = camera as PerspectiveCamera;
    if (!perspective.isPerspectiveCamera) {
      this.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
      this.uniforms.eye.value
        .setFromMatrixColumn(camera.matrixWorld, 2)
        .normalize()
        .multiplyScalar(ORTHO_EYE_DISTANCE)
        .add(this.cameraWorldPosition);
      return;
    }

    const {
      mirrorWorldPosition,
      cameraWorldPosition,
      rotationMatrix,
      normal,
      view,
      lookAtPosition,
      target,
      mirrorCamera,
      textureMatrix,
      mirrorPlane,
      clipPlane,
      q,
    } = this;

    mirrorWorldPosition.setFromMatrixPosition(this.matrixWorld);
    cameraWorldPosition.setFromMatrixPosition(perspective.matrixWorld);

    rotationMatrix.extractRotation(this.matrixWorld);

    normal.set(0, 0, 1);
    normal.applyMatrix4(rotationMatrix);

    view.subVectors(mirrorWorldPosition, cameraWorldPosition);

    // 미러가 카메라를 등지고 있으면 그리지 않는다.
    if (view.dot(normal) > 0) return;

    view.reflect(normal).negate();
    view.add(mirrorWorldPosition);

    rotationMatrix.extractRotation(perspective.matrixWorld);

    lookAtPosition.set(0, 0, -1);
    lookAtPosition.applyMatrix4(rotationMatrix);
    lookAtPosition.add(cameraWorldPosition);

    target.subVectors(mirrorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(mirrorWorldPosition);

    mirrorCamera.position.copy(view);
    mirrorCamera.up.set(0, 1, 0);
    mirrorCamera.up.applyMatrix4(rotationMatrix);
    mirrorCamera.up.reflect(normal);
    mirrorCamera.lookAt(target);

    mirrorCamera.far = perspective.far; // WebGLBackground 가 쓴다.

    mirrorCamera.updateMatrixWorld();
    mirrorCamera.projectionMatrix.copy(perspective.projectionMatrix);

    // 텍스처 행렬 갱신
    textureMatrix.set(
      0.5,
      0.0,
      0.0,
      0.5,
      0.0,
      0.5,
      0.0,
      0.5,
      0.0,
      0.0,
      0.5,
      0.5,
      0.0,
      0.0,
      0.0,
      1.0,
    );
    textureMatrix.multiply(mirrorCamera.projectionMatrix);
    textureMatrix.multiply(mirrorCamera.matrixWorldInverse);

    // 투영 행렬에 클립 평면을 심는다(oblique near plane):
    // http://www.terathon.com/code/oblique.html
    // http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
    mirrorPlane.setFromNormalAndCoplanarPoint(normal, mirrorWorldPosition);
    mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);

    clipPlane.set(
      mirrorPlane.normal.x,
      mirrorPlane.normal.y,
      mirrorPlane.normal.z,
      mirrorPlane.constant,
    );

    const projectionMatrix = mirrorCamera.projectionMatrix;

    q.x =
      (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) /
      projectionMatrix.elements[0];
    q.y =
      (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) /
      projectionMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    // 스케일된 평면 벡터
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

    // 투영 행렬 셋째 행 교체
    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;
    projectionMatrix.elements[10] = clipPlane.z + 1.0 - this.clipBias;
    projectionMatrix.elements[14] = clipPlane.w;

    this.uniforms.eye.value.setFromMatrixPosition(perspective.matrixWorld);

    // 미러 패스
    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const currentInfoAutoReset = renderer.info.autoReset;

    // 숨김·플래그 변경부터 try 안에 둔다 — 제외 게터나 render 가 던져도
    // finally 가 전부 원복한다.
    try {
      this.visible = false;
      hideForReflection(
        this.excludedObjects ? this.excludedObjects() : [],
        this.hiddenForReflection,
      );

      renderer.xr.enabled = false; // 카메라 변조·재귀 방지
      renderer.shadowMap.autoUpdate = false; // 그림자 재계산 방지
      renderer.info.autoReset = false; // 메인 패스 드로우콜 카운트 보존

      renderer.setRenderTarget(this.renderTarget);

      // 깊이 버퍼가 지워지도록 쓰기 마스크를 켠다(three #18897).
      renderer.state.buffers.depth.setMask(true);

      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, mirrorCamera);
    } finally {
      this.visible = true;
      restoreAfterReflection(this.hiddenForReflection);

      renderer.xr.enabled = currentXrEnabled;
      renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
      renderer.info.autoReset = currentInfoAutoReset;

      renderer.setRenderTarget(currentRenderTarget);

      // viewport 복원
      const viewport = perspective.viewport;
      if (viewport !== undefined) {
        renderer.state.viewport(viewport);
      }
    }
  }

  /** 반사 RT 와 머티리얼을 폐기한다. geometry 는 컴포넌트가 폐기한다. */
  dispose(): void {
    this.renderTarget.dispose();
    this.material.dispose();
  }
}

export function isOceanWater(object: Object3D): object is OceanWater {
  return (object as Partial<OceanWater>).isOceanWater === true;
}
