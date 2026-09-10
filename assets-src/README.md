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

## 루트 노드에 월드 포즈가 베이크된 모델 (Block_001/002 등)

Blender 에서 씬에 배치된 오브젝트를 그대로 내보내면 정점은 원점 중심이어도
루트 노드 translation/rotation 에 월드 좌표가 실려 온다. 그대로 등록하면
에디터 드롭 지점에서 수 km 떨어진 곳에 나타난다. 범용 도구로 되돌린다:

```bash
node scripts/unbake-root-transform.mjs assets-src/models/Block_001.glb   # 원점 복원
pnpm optimize:glb Block_001.glb                                          # 압축 배포
# 출력된 "씬 배치값"을 원래 자리에 두고 싶을 때 씬 JSON 에 기입
```

## maps/ (지형) — 전용 파이프라인 `pnpm optimize:map`

지형은 `optimize:glb` 가 아니라 **전용 파이프라인**을 쓴다 (2026-08-20 도입,
그 전의 "텍스처만 수동 압축" 절차를 대체). 텍스처 상한 2048px·노멀/ORM 손실
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

### philly-area-1.glb · philly-area-2.glb — 필리조선소 지도 (2026-09-11 분할)

2026-09-11 디자이너가 조선소 지도를 `Philly Area 1.glb`(35MB)·`Philly Area 2.glb`
(60MB) 두 장으로 나눠 보냈다. **옛 `phillyshipyard.glb` 는 은퇴**했다 — 카탈로그·
씬·배포본·이 디렉터리 원본 모두 제거했고, 롤백 원본은 git 이력(V4 반입 `254c9af`)에
있다. 아래의 phillyshipyard 이력은 좌표계 배경으로 남겨 둔다.

- 두 파일 모두 루트 노드에 V4 와 같은 (-263.125, -3.482, 31.333) 오프셋이 실려
  왔고, 오프셋을 지운 bbox 합집합이 V4 원본 bbox 와 정확히 같다(배포본 기준 차이
  1.1cm = 양자화 그리드). 즉 **옛 조선소와 같은 좌표계**라 옛 지도 항목의 배치값
  (goliath: 원점·무회전, philly-2dock: yaw 354.4)을 그대로 두 장에 주면 제자리다.
- 둘 다 카탈로그 `kind: 'ground'` 이고 두 씬 모두 `cameraBounds: true` 다 — 카메라
  제한 합집합이 옛 조선소 bbox 와 같다. 에디터 드롭 raycast 는 ground 지도 전부를
  본다(`resolveGroundMaps`).
- 지면 4096 텍스처 3장이 두 파일에 **중복**으로 들어 있어 텍스처 VRAM 이 옛 한 장
  대비 늘었다(`pnpm perf:scene` 기준 181MB → 138.6 + 133.0MB). 드로우콜 41 → 36 + 26.
- 경계에서 Ground·Sea·Water Front Wall 의 X 범위가 약 50m 겹친다.

```bash
node scripts/unbake-root-transform.mjs "Philly Area 1.glb" "Philly Area 2.glb"
mv "assets-src/models/Philly Area 1.glb" assets-src/maps/philly-area-1.glb
mv "assets-src/models/Philly Area 2.glb" assets-src/maps/philly-area-2.glb
cp assets-src/maps/philly-area-{1,2}.glb apps/shell/public/maps/
pnpm optimize:map philly-area-1.glb philly-area-2.glb   # 33.3→2.49MB, 57.1→6.00MB
```

⚠️ `pnpm optimize:map` 을 인자 없이 돌리면 `philly-terrain.glb` 까지 다시 돌아 타일·LOD
구조가 망가진다. 항상 파일명을 지정한다.

### phillyshipyard.glb (은퇴, 이력)

`phillyshipyard.glb` 는 2026-09-04 반입본(`Philly Yard_20260903`)부터 **루트 노드가
원점(0,0,0) 기준**이다. 그 전 버전은 루트 노드에 (-1552, -3.5, 1801) 오프셋이
실려 있었고 씬 배치가 그 좌표를 전제로 했으므로, 교체 시 씬의 크레인·블록·카메라를
에디터에서 다시 놓아야 했다. 재반입 시에도 원점 기준으로 받는다 — 옛 오프셋을
복원하지 말 것.

2026-09-07 V4 반입본(`Philly V4.glb`)은 루트 노드에 (-263, -3.5, 31) 오프셋이
실려 왔다. 정점 좌표 범위는 20260903 본과 완전히 같았으므로 루트 오프셋만 지워
반입했고 씬 재배치는 없었다. 지도의 루트 오프셋은 범용 언베이크 도구로 지운다 —
출력 위치가 `assets-src/models/` 로 고정돼 있어 지도는 `mv` 로 옮긴다:

```bash
node scripts/unbake-root-transform.mjs "새지도.glb"     # → assets-src/models/새지도.glb
mv "assets-src/models/새지도.glb" assets-src/maps/phillyshipyard.glb
pnpm optimize:map phillyshipyard.glb
```

지면 머티리얼도 V4 부터 unlit 베이크 1장이 아니라 lit PBR 3장(base/MR/normal,
각 4096 → 2048 webp)이다. 조명(환경 프리셋)에 따라 지면 밝기가 달라진다.

### philly-terrain.glb — 조선소 주변 지형 레이어 (원본 미커밋 ⚠️)

2026-09-08 디자이너 전달본 `Terrain.glb`(175MB, 필라델피아 시 전역 OSM 지형 —
건물 extrude·도로·항공사진 overlay, 삼각형 245만). **조선소 자리가 구멍으로
잘려 있는 컨텍스트 레이어**라 조선소 지도(현재 Area 1/2)를 대체하지 않고
goliath.json · philly-2dock.json 에 함께 깐다.

**원본은 커밋하지 않고 컨플루언스에서 별도 관리한다** (`.gitignore` 의
`assets-src/maps/philly-terrain.glb`). GitHub 파일당 100MB 한도를 넘고(무손실 weld
후에도 147MB) git-lfs 는 쓰지 않기로 했다. 재압축·재튜닝·롤백이 필요하면 컨플루언스에서
원본을 받아 `assets-src/maps/philly-terrain.glb` 에 놓고 아래 절차를 다시 돌린다.

반입 절차(실제 수행 기록):

```bash
node scripts/unbake-root-transform.mjs Terrain.glb     # 루트 오프셋 (515.305, 0, -814.879) 제거
mv assets-src/models/Terrain.glb assets-src/maps/philly-terrain.glb
cp assets-src/maps/philly-terrain.glb apps/shell/public/maps/philly-terrain.glb
FORCE_MESHOPT=1 pnpm optimize:map philly-terrain.glb   # 167MB → 14.8MB, 삼각형 245만 → 182만
```

같은 날 2차 전달본 `Terrain2.glb`(174MB) 로 교체했다. 루트 오프셋·XZ 정점 범위가
1차와 동일해 배치값은 그대로이고, Y −325m 까지 내려가던 프리미티브 1개가 빠져
(30 → 29, 삼각형 245만 → 241만) 압축 결과는 165.5MB → 14.6MB, 삼각형 178만이다.
재전달본도 위 절차 그대로 돌리면 되며, 시작 전에 루트 오프셋과 bbox 가 이전과
같은지 먼저 비교해 배치값 유지 여부를 판단한다.

2026-09-09 부터 배포본은 위 절차 뒤에 **타일 + LOD 재구성**을 한 번 더 거친다
(AGENTS.md 의 philly-terrain 항목). 재반입의 마지막 단계는 항상 이것이다:

```bash
node scripts/tile-terrain-glb.mjs apps/shell/public/maps/philly-terrain.glb /tmp/philly-terrain.tiled.glb --lod
cp /tmp/philly-terrain.tiled.glb apps/shell/public/maps/philly-terrain.glb
```

2026-09-11 3차 전달본 `Terrain.glb`(172MB)로 교체했다. 루트 오프셋이 같고 공통
프리미티브(silver·black·grey 등) bbox 가 이전 원본과 정확히 같아 **같은 좌표계에서
외곽만 잘린 것**이다(XZ 18.9×16.7km → 13.4×10.1km) — 씬 배치값은 그대로다.
삼각형 241만 → 237만, 무텍스처 `vegetation.001` 이 1024 텍스처를 가진 `Vegetation
Area` 로 바뀌었다(UV 가 전부 (0,1) 한 점이라 사실상 단색). 압축 163.9MB → 15.5MB
(삼각형 176만), 타일링 후 24.1MB.

- 도로 3개 프리미티브의 UV 12개가 [0,1] 을 최대 2.6e-5 벗어나 meshopt 가 그 UV 를
  양자화하지 않고 float 로 남겼고, 굽기 그룹 안 attribute 구성이 섞여 타일 스크립트가
  병합을 거부했다. `optimize-map.mjs` 에 노이즈 UV 클램프(범위 밖 값이 전부 1e-4
  이내인 accessor 만)를 넣어 해결했다.
- 범위가 줄어 8×8 그리드가 전부 채워지고(타일 45 → 64) `Vegetation Area` 가 타일마다
  유지 머티리얼로 하나 더 붙어, LOD 레벨당 프리미티브가 약 82 → 181 로 늘었다.
  LOD 잔존율은 71.2/49.3/35.3%(2/4/8m)로 이전과 같은 수준이다.
- 원본(172MB)은 이전처럼 커밋하지 않는다 — 컨플루언스의 원본도 이 버전으로 교체한다.

- `FORCE_MESHOPT=1` 인 이유: 폭 18.9km 라 16bit 그리드가 28.8cm 인데 도로(Y 0.3)·
  숲(0.1)·지면 평면(0) 층간이 10cm 라 가드가 생략한다. 그 평면층들은 2~57m 기복의
  지형 overlay 아래 묻혀 있어 z-fighting 이 보이지 않고, 건물·지형은 도시 스케일에서
  29cm 양자화가 비가시다. 생략하면 f32 123MB 로 남는다.
- simplify 는 0.4 목표에 못 미친다(182만) — 건물 벽이 quad 하나짜리 박스라 오차
  한도 안에서 더 접을 게 없다. 추가 절감이 필요하면 건물·도로 프리미티브 제거가 다음 수단.
- **씬 배치값 (778.43, 3.482, -846.212)** 의 유도: 디자이너 Blender 씬에서 조선소
  V4 는 (-263.125, -3.482, 31.333) 에, Terrain 은 (515.305, 0, -814.879) 에 있었다.
  V4 반입 때 그 오프셋을 지웠으므로 Terrain 배치 = Terrain 오프셋 − V4 오프셋.
  50m 셀 실측으로 이 값에서 조선소 지면과 지형의 겹침이 3% (경계 노이즈)로,
  구멍이 조선소 발자국과 맞물린다. philly-2dock.json 은 조선소 지도가 yaw 354.4°
  라 같은 회전을 원점 기준으로 함께 적용한 값(현재 씬 파일은 에디터에서 미세 조정한
  (858.135, 3.482, -765.266))이다.
- 구멍 가장자리 지형 높이가 조선소 지면(3.68m)보다 약 1.8m 높다(SRTM 오차 수준).
  어색하면 에디터 계층 목록에서 터레인 잠금을 풀고 Y 를 내려 저장한다.
- 도로·보도는 Y=0.3 평면이라 지형 아래 묻혀 보이지 않는다 — 원본 특성이며 여기서
  고치지 않는다(드레이핑은 디자이너 요청 사항).

소형 지도(okpo·1dock·plane)는 대상이 아니다 — 절감 효과가 없고 unlit 플레인은
단면화가 오히려 위험하다. 자세한 단계·안전 가드·문제 해결은
`docs/지도-GLB-최적화-파이프라인.md` 참고. 모델 파이프라인 설명은
`docs/GLB-압축-파이프라인-작업보고.md`.
