# GLB 최적화 파이프라인 · 에셋 캐시 정책 작업 보고

- **작업일**: 2026-08-15
- **배경**: 3D 뷰어/에디터 감사에서 1순위로 지목된 항목(`docs/3D-뷰어-에디터-개선-백로그.md` P1-①).
  모델 GLB 45개(132.7MB)가 무압축 원본으로 서빙되고 있었고, nginx gzip 대상에도 GLB MIME이
  빠져 있었다. 작업 도중 **에셋 캐시 정책 결함**을 추가로 발견해 함께 수정했다.
- **결과**
  - 모델 총량 **132.7MB → 25.1MB (-81.1%)**
  - 4096² 텍스처 4장 제거 → GPU 텍스처 메모리 장당 89MB → 22MB
  - 해시 없는 public 자산에 걸려 있던 `immutable` 캐시 제거 → 모델·씬 업데이트가 기존
    사용자에게 도달하게 됨

---

## 1. 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `nginx.conf.template` | ① `gzip_types`에 GLB MIME 추가 ② **캐시 규칙을 해시 자산 / public 자산으로 분리** (2장) |
| `scripts/optimize-glb.mjs` | **신규.** 4단계 최적화 스크립트 (3장) |
| `package.json` | `@gltf-transform/cli` devDependency, `optimize:glb` 스크립트 |
| `packages/domain/src/3d/lib/model-bottom-offset-cache.ts` | 수동 GLTFLoader에 `setMeshoptDecoder` 배선 |
| `packages/widgets/src/3d/lib/preview-gltf-cache.ts` | 동일 배선 (팔레트 썸네일 로더) |
| `apps/shell/public/models/**/*.glb` (45개) | 최적화본으로 교체 |
| `assets-src/models/**` | **신규(git 미추적).** 압축 전 원본 백업 (132.7MB) |

drei `useGLTF` 경로(model-mesh, collision-guard-object-model, 에디터 preload, mro2 씬 2곳)는
**수정 불필요** — drei 10.7.7이 기본으로 MeshoptDecoder를 등록하고, `EXT_texture_webp`는
three.js GLTFLoader 내장 확장이다.

## 2. 에셋 캐시 정책 수정 (기능 결함)

**증상**: `.glb`·`.json`에 `expires 1y; Cache-Control: public, immutable`이 걸려 있었는데,
이 파일들은 `public/`에 있어 **파일명에 내용 해시가 없다**(`/models/goliath_crane.glb` 고정).
`immutable`은 "만료 전까지 재검증조차 하지 말라"는 의미라, 한 번 방문한 브라우저는 1년간
옛 파일을 쓴다. 결과:

- 모델을 교체 배포해도 기존 사용자에게 도달하지 않음
- **씬 JSON도 같은 규칙에 걸려, 에디터로 배치를 수정해 배포해도 반영되지 않음** (기능 결함)
- 이번 최적화분도 신규 방문자에게만 적용될 뻔했음

**수정**: 캐시 경계를 "파일명에 해시가 있는가"로 나눴다.

| 대상 | 정책 | 근거 |
|---|---|---|
| `/crane_rnd/assets/` (vite 빌드 산출물) | `expires 1y` + `immutable` | 내용이 바뀌면 파일명(해시)도 바뀌므로 영구 캐시가 안전 |
| 그 외 정적 자산 (models·maps·scenes·images·icons·drawings) | `expires off` + `public, no-cache` | ETag/Last-Modified 재검증. 변경 없으면 304만 오가므로 본문 전송 없음 |

`location ^~ /crane_rnd/assets/`는 nginx 우선순위상 정규식 location보다 먼저 매칭된다.

> ⚠️ 미검증: `nginx -t` 문법 검증은 로컬에 nginx 바이너리가 없고 Docker 데몬이 꺼져 있어
> 수행하지 못했다. 중괄호 균형과 location 목록은 확인했다. 배포 전
> `docker run --rm -v <rendered>:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t` 권장.

## 3. 최적화 스크립트 (`pnpm optimize:glb`)

`scripts/optimize-glb.mjs`. 신규 모델 반입 시 1회 실행하는 수동 도구이며 빌드 파이프라인이 아니다.

```bash
pnpm optimize:glb            # models/ 전체 (하위 디렉토리 포함)
pnpm optimize:glb car.glb    # 특정 파일만
```

### 파이프라인 (순서가 중요)

| 단계 | 커맨드 | 대상 |
|---|---|---|
| ① | `resize --width 2048 --height 2048` | 텍스처 최대 2048px (축소만, 확대 없음) |
| ② | `webp --slots {baseColorTexture,emissiveTexture} --quality 85` | 베이스컬러·이미시브 손실 압축 |
| ③ | `webp --slots {normalTexture,occlusionTexture,metallicRoughnessTexture} --lossless` | 노멀·ORM 무손실 |
| ④ | `meshopt` | 지오메트리 압축 — **반드시 마지막** |

> ⚠️ **meshopt는 반드시 마지막**이어야 한다. gltf-transform의 텍스처 커맨드(resize/webp)는
> 파일을 다시 쓰면서 `EXT_meshopt_compression`을 **제거한다**. 순서를 바꾸면 텍스처 패스가
> 지오메트리 압축을 조용히 해제한다 — 실측으로 `TTC-28.glb`가 1.64MB → 5.83MB로 되돌아갔고
> 전체 32개 파일이 26.4MB 증가했다. 스크립트의 `STAGES` 주석에 같은 경고를 남겨 두었다.

### 안전장치

- **백업**: 압축 전 원본을 `assets-src/models/`에 복사. 백업이 있으면 그 백업본이 원본.
- **멱등**: 항상 백업본을 입력으로 재처리 → 몇 번 재실행해도 이중 압축 없음.
- **실패 복원**: 실패 시 public 쪽을 원본으로 되돌려 깨진 파일이 남지 않음.
- **되돌리기**: `assets-src/models/`를 `apps/shell/public/models/`로 복사하면 끝.

### 설계 결정

| 결정 | 이유 |
|---|---|
| `optimize` 만능 커맨드 **금지**, 개별 커맨드만 사용 | `optimize`는 join/prune으로 노드 계층을 병합·삭제한다. meshOverrides의 `[index]name` 메쉬 경로(`mesh-path.ts`)와 valueMapper 노드 바인딩이 계층에 의존하므로 저장된 씬과 실시간 매핑이 조용히 깨진다. |
| draco 대신 **meshopt** | 디코더 ~30KB·고속 디코드(draco는 수백 KB wasm), CDN 의존 없음(폐쇄망 안전), gzip 조합 전제 설계. `public/draco/`는 빈 폴더(미사용). |
| 텍스처 상한 **2048px** | 파일 크기보다 **GPU 메모리** 때문. 텍스처는 압축 형식과 무관하게 디코드된 RGBA로 올라간다: 4096² ≈ 89MB/장, 2048² ≈ 22MB/장. |
| 노멀·ORM은 **무손실** | 노멀맵의 손실 아티팩트는 색이 아니라 표면 셰이딩 얼룩으로 나타나 눈에 잘 띈다. |
| 베이스컬러 **q85** | 품질 곡선의 무릎. q95까지 올려도 PSNR이 1.2dB만 개선된다(잔여 오차는 채도 높은 로고 경계의 크로마 서브샘플링이 원인이라 품질값으로 줄지 않음). 크기는 0.27MB→0.49MB로 늘어 이득이 없다. |
| **maps/(지형) 제외** | 합계 ~2MB로 절감 효과 미미. 드롭 레이캐스트 대상이자 z-fighting 여유가 빠듯해 리스크만 있다. *(2026-08-20 추가: 53.6MB짜리 phillyshipyard 반입으로 전제가 깨져 지도 전용 파이프라인 `pnpm optimize:map` 이 생겼다 — `docs/지도-GLB-최적화-파이프라인.md` 참고. 이 스크립트의 maps 제외 정책 자체는 유지.)* |

### 모델 반입 운영 순서

**신규 추가**:

1. GLB를 `apps/shell/public/models/`에 복사 (하위 폴더 가능)
2. `pnpm optimize:glb <파일명>` — 원본 자동 백업 + 최적화본 교체
3. 에디터 팔레트에 노출하려면 `packages/domain/src/3d/model/scene-model-catalog.ts`에
   항목 추가. 씬 JSON에서 직접 참조만 하면 생략.
4. dev 서버 확인: 팔레트 썸네일 → 드롭 안착 → 씬 저장. 실시간 바인딩 모델이면
   craneId/valueMap 설정 후 움직임 확인.

**기존 모델을 새 버전으로 교체 (⚠️ 순서 주의)**:

백업이 있으면 백업본이 원본으로 취급된다. 새 버전을 public에 덮어쓰고 스크립트를 돌리면
**옛 백업이 새 파일을 도로 덮어쓴다.** 반드시 백업 위치에 먼저 넣을 것:

```bash
cp 새버전.glb assets-src/models/기존파일.glb   # public 아님!
pnpm optimize:glb 기존파일.glb
```

## 4. 결과

전체 45/45 성공, **132.7MB → 25.1MB (-81.1%)**.

| 파일 | 원본 | 최종 | 절감 |
|---|---|---|---|
| goliath_crane.glb | 12.48MB | 0.90MB | -92.7% |
| goliath_crane_body.glb | 12.47MB | 0.90MB | -92.8% |
| goliath_crane_trolley.glb | 8.72MB | 0.26MB | -97.0% |
| LLC_002.glb | 10.39MB | 1.16MB | -88.8% |
| TTC-28.glb | 9.59MB | 1.64MB | -82.9% |
| car.glb | 7.86MB | 4.28MB | -45.5% |
| gantry_crane.glb | 3.85MB | 1.97MB | -48.8% |

지역 진입 시 다운로드(맵 포함):

| 지역 | 원본 | 최종 |
|---|---|---|
| 골리앗 | 14.8MB | ~2.6MB |
| philly-2dock | 25.2MB | ~3.8MB |
| dock-1 | 36.3MB | ~8.1MB |
| 실내 dock-in | 34.1MB | ~6.5MB |

최종 GLB의 `extensionsUsed` = `EXT_meshopt_compression`, `EXT_texture_webp`,
`KHR_mesh_quantization` (모두 three.js 지원).

## 5. 검증

`pnpm --filter @crane/shell typecheck` 통과. Playwright 실구동 + 픽셀 비교:

| 검증 | 결과 |
|---|---|
| 골리앗 3D 모니터링 (`/goliath-work/goliath/3d-monitoring`) | 정상 렌더, 콘솔/요청 에러 0건 |
| philly-dock-2 (`/outdoor-work/philly-dock-2/3d-monitoring`) | LLC_002·골리앗 정상 |
| 씬 에디터 (`/goliath-work/goliath/3d-viewer-edit`) | 계층·기즈모 정상, 팔레트 썸네일 전체 렌더 |
| `prefetchModelBottomOffset` 직접 호출 | 압축 GLB에서 타당한 측정값 반환 |
| **텍스처 원본 대비 (2048 동일 조건)** | PSNR 36.1dB, 평균 오차 4.0/255 |
| **렌더 결과 픽셀 비교 (크레인 306% 확대)** | **PSNR 47.1dB, 평균 오차 1.13/255, 8단계 초과 픽셀 0.30%** |

확대 상태에서 원본/최적화본을 같은 카메라로 렌더해 비교했고, 거더의 Hanwha 로고까지
육안 차이가 없었다. 잔여 최대 오차(78/255)는 캡처 시점 간 트롤리가 실제로 움직인
애니메이션 차이다.

## 6. 남은 항목 / 결정 필요

1. **빌드 훅 자동화** — 현재 수동 실행. `prebuild`에 연결하려면 "이미 최적화됨" 스킵 로직
   (`extensionsUsed`에 `EXT_meshopt_compression` 포함 여부)이 먼저 필요하다.
2. **`assets-src/` 보관 정책 (결정 필요)** — 원본 132.7MB가 git 미추적. git-lfs 추적 /
   `.gitignore` 후 별도 보관 중 택일.
3. **골리앗 텍스처 중복** — `goliath_crane`/`body`/`trolley`가 동일 텍스처(MD5 일치)를 각각
   embed한다. body+trolley는 mro2·philly 자산 상세 탭에서 동시 로드된다. 최적화로 장당
   0.26~0.90MB까지 줄어 실익이 작아졌으나, 구조적으로는 외부 텍스처 참조가 정답.
4. **KTX2 (장기)** — GPU 메모리를 더 줄이려면 필요. transcoder 배선 비용으로 보류.
5. `nginx -t` 검증 (2장 참고), `dist/`의 stale GLB는 다음 빌드 시 해소.
