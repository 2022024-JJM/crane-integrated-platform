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

자세한 파이프라인 설명은 `docs/GLB-압축-파이프라인-작업보고.md` 참고.
