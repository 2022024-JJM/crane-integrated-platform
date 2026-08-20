# assets-src — 3D 에셋 원본 보관소

`apps/shell/public/models/` 에 배포되는 GLB 의 **압축 전 원본**이다.

배포본은 `pnpm optimize:glb` 로 압축·리사이즈된 결과물이라 되돌릴 수 없다.
품질 설정을 바꿔 재압축하거나 롤백하려면 이 원본이 반드시 있어야 하므로
레포에 함께 보관한다. **이 디렉토리를 지우지 말 것.**

## 새 모델 반입

```bash
cp 새모델.glb apps/shell/public/models/   # 배포 위치에 두고
pnpm optimize:glb 새모델.glb              # 실행 → 원본이 여기로 자동 백업됨
```

## 기존 모델을 새 버전으로 교체 (순서 주의)

스크립트는 백업이 있으면 **백업본을 원본으로 취급**한다. 새 버전을 public 에
덮어쓰고 실행하면 옛 백업이 새 파일을 도로 덮어쓴다. 여기에 먼저 넣을 것:

```bash
cp 새버전.glb assets-src/models/기존파일.glb   # public 아님!
pnpm optimize:glb 기존파일.glb
```

## 롤백

```bash
cp assets-src/models/<파일> apps/shell/public/models/<파일>
```

## goliath_crane.glb — 원점 중심 계약 (⚠️ 재반입 시 필수)

충돌 감지 존·FSD 카메라·에디터 기즈모가 "GLB 원점 = 크레인 중심(다리 사이),
거더 = 로컬 +X" 를 전제로 씬 배치 transform 에서 파생된다. Blender 에서
**월드 좌표가 지오메트리에 베이크된 채** 내보내면 존이 원점에 그려지고 회전
피벗이 틀어진다 (2026-08-20 발생). 재반입 시:

```bash
# 새 export 를 public 에 놓은 뒤 (베이크 여부와 무관하게 안전)
node scripts/unbake-goliath-crane.mjs      # 원점 복원 → assets-src/ 에 저장
pnpm optimize:glb goliath_crane.glb        # 압축 배포
# 출력된 "씬 배치값"을 goliath.json / philly-2dock.json 에 기입
```

## maps/ (지형) — 텍스처만 수동 압축

지형은 `optimize:glb` 대상이 아니다(지오메트리 양자화가 드롭 레이캐스트·z-fighting
을 깨뜨릴 수 있음). 다만 대형 맵은 **텍스처만** 수동으로 압축한다 — 지오메트리는
바이트 단위로 그대로 유지된다. 노멀맵은 near-lossless 를 쓴다(원본이 이미 손실
JPEG 인 경우 lossless webp 는 오히려 커진다. phillyshipyard 실측: 8.7MB→9.6MB.
near-lossless 는 최대 오차 1/255 로 셰이딩 얼룩 없이 7.7MB).

```bash
cp apps/shell/public/maps/<맵>.glb assets-src/maps/<맵>.glb   # 원본 백업 먼저
gltf-transform webp <원본> <t1> --slots "{baseColorTexture,emissiveTexture}" --quality 85
gltf-transform webp <t1> <t2> --slots "{occlusionTexture,metallicRoughnessTexture}" --lossless
gltf-transform webp <t2> apps/shell/public/maps/<맵>.glb --slots "normalTexture" --near-lossless
```

자세한 파이프라인 설명은 `docs/GLB-압축-파이프라인-작업보고.md` 참고.
