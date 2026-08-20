# assets-src — 3D 에셋 원본 보관소

`apps/shell/public/models/`(모델)와 `apps/shell/public/maps/`(지도)에 배포되는
GLB 의 **압축 전 원본**이다.

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

## maps/ (지형) — 전용 파이프라인 `pnpm optimize:map`

지형은 `optimize:glb` 가 아니라 **전용 파이프라인**을 쓴다 (2026-08-20 도입,
그 전의 "텍스처만 수동 압축" 절차를 대체). 텍스처 상한 1024px·노멀/ORM 손실
압축에 더해, transmission 제거·단면화·데시메이션·양자화 안전 가드(층간 높이 차
실측으로 z-fighting 위험 시 meshopt 자동 생략)까지 처리한다. 백업·멱등·교체
관례는 `optimize:glb` 와 동일하다:

```bash
# 신규 지도
cp 새지도.glb apps/shell/public/maps/
pnpm optimize:map 새지도.glb              # 원본이 assets-src/maps/ 로 자동 백업

# 기존 지도 교체 — 백업 위치에 먼저 넣을 것 (모델 교체와 같은 이유)
cp 새버전.glb assets-src/maps/기존파일.glb
pnpm optimize:map 기존파일.glb
```

소형 지도(okpo·1dock·plane)는 대상이 아니다 — 절감 효과가 없고 unlit 플레인은
단면화가 오히려 위험하다. 자세한 단계·안전 가드·문제 해결은
`docs/지도-GLB-최적화-파이프라인.md` 참고. 모델 파이프라인 설명은
`docs/GLB-압축-파이프라인-작업보고.md`.
