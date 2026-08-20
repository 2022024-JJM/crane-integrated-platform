# 지도(maps/) GLB 최적화 파이프라인

- **작성일**: 2026-08-20
- **도구**: `pnpm optimize:map` (`scripts/optimize-map.mjs`)
- **대상**: `apps/shell/public/maps/*.glb` — 지형·건물·도크 등 지도 GLB.
  모델(크레인 등)은 별도 파이프라인 `pnpm optimize:glb` 를 쓴다
  (`docs/GLB-압축-파이프라인-작업보고.md` 참고).
- **배경**: phillyshipyard 지도 교체(de85396)로 지도가 1.7MB → 53.6MB(정점 41k → 113만,
  KHR_materials_transmission 포함)가 되며 3D 캔버스를 쓰는 전 화면이 저하됐다.
  이 파이프라인으로 **53.6MB → 7.6MB (-87.8%)**, 삼각형 60.5만 → 42.3만(-30%),
  텍스처 VRAM 약 190MB → 약 50MB, transmission 렌더 패스 제거를 달성했다
  (커밋 617981c, 496c44c, 0f061be).

---

## 1. 언제 실행하나

**새 대형 지도를 반입할 때 1회.** 빌드 파이프라인이 아니라 수동 도구다.
기존 소형 지도(okpo 255KB, 1dock 20KB, plane 1.4KB)는 최적화 대상이 아니다 —
절감 효과가 없고, 1dock/plane 은 unlit 2m 플레인이라 단면화가 오히려 위험하다.

## 2. 운영 순서

백업 관례는 `optimize:glb` 와 동일하다: `assets-src/maps/` 의 백업본이 항상
"진짜 원본"이고, 매 실행마다 원본에서 다시 최적화하므로 몇 번을 재실행해도
이중 압축이 없다(멱등).

**신규 지도 추가**:

```bash
cp 새지도.glb apps/shell/public/maps/     # 배포 위치에 두고
pnpm optimize:map 새지도.glb              # 실행 → 원본이 assets-src/maps/ 로 자동 백업됨
```

**기존 지도를 새 버전으로 교체 (⚠️ 순서 주의)** — 백업이 있으면 백업본이
원본으로 취급된다. public 에 덮어쓰고 실행하면 옛 백업이 새 파일을 도로 덮어쓴다:

```bash
cp 새버전.glb assets-src/maps/기존파일.glb   # public 아님!
pnpm optimize:map 기존파일.glb
```

**롤백**:

```bash
cp assets-src/maps/<파일> apps/shell/public/maps/<파일>
```

실행 후에는 `git status` 로 씬 JSON(`apps/shell/public/scenes/*.json`)이 의도치 않게
바뀌지 않았는지 확인한다 — 씬 에디터를 띄워 확인하는 과정에서 카메라 위치가
자동 저장될 수 있다.

## 3. 파이프라인 단계 (순서가 중요)

| 단계 | 처리 | 내용 |
|---|---|---|
| ① resize | CLI | 텍스처 최대 **1024px** (모델은 2048 — 지도는 200~500 유닛 거리의 배경이라 충분) |
| ② webp | CLI | **전 슬롯 손실 압축 q80** — 노멀/ORM 포함 (모델은 무손실 — 원거리 지형은 셰이딩 얼룩이 비가시) |
| ③ surgery | in-process | transmission 제거 → 단면화 → weld → simplify → **양자화 안전 가드** → meshopt |

- **meshopt 는 반드시 마지막**: gltf-transform 텍스처 커맨드가 `EXT_meshopt_compression`
  을 제거한다 (optimize-glb 문서의 실측 사고 참고).
- `optimize` 만능 커맨드 금지(join/prune 이 노드 계층을 병합)는 레포 정책 그대로 준수.
  지도는 meshOverrides/valueMapper 를 쓰지 않아 weld/simplify 같은 토폴로지 변경은 안전하다.

### surgery 세부

| 처리 | 내용 | 이유 |
|---|---|---|
| transmission 제거 | `KHR_materials_transmission` 을 벗기고 알파 블렌딩 반투명(알파 0.5, roughness 0.1)으로 변환 | three.js 는 transmission 머티리얼이 하나라도 보이면 **매 프레임 씬 전체를 별도 렌더 타겟에 한 번 더 렌더링**한다 — 프레임 비용 2배의 주범 |
| 단면화 | 전 머티리얼 `doubleSided=false` | 래스터/레이캐스트 삼각형 테스트 절반. 뒤집힌 면이 구멍으로 보이면 `KEEP_DOUBLE_SIDED=1` 로 재실행 |
| weld | 무손실 인덱스 dedup | simplify 가 프리미티브 경계를 넘어 동작하는 전제 |
| simplify | meshopt simplifier, ratio 0.4 / error 0.0002(bbox 대각 상대값) | 정점을 제거만 하고 이동시키지 않으므로 평면은 평면으로, 드롭 레이캐스트 착지 높이는 오차 한도 안에서 유지 |
| meshopt | 16bit 포지션 양자화 + 압축 | 아래 안전 가드를 통과할 때만 적용 |

## 4. 양자화 안전 가드 — 왜 있고 어떻게 동작하나

**사고 경위**: CLI `meshopt` 기본값은 14bit 포지션 양자화다. 양자화 그리드는
"지도 최대 폭 / 2^bits" 라서 philly(폭 2.4km)에서 14bit 는 그리드 14.6cm —
지면(Y 3.682m) 위에 10cm 띄워 둔 도로(Y 3.782m)가 **같은 그리드 셀로 붕괴**해
도로 전체가 지면과 z-fighting 으로 깜빡였다(2026-08-20 실측, 커밋 496c44c 로 수정).

16bit 로 올려 해결했지만 "16bit 면 안전"도 philly 크기에서만 참이다. 폭 6km 급
지도가 오면 그리드가 9cm 를 넘어 같은 문제가 재발한다. 그래서 스크립트가
**지도마다 실측하고 스스로 판단한다**:

1. 프리미티브 정점 Y 히스토그램(1mm 단위)에서 정점의 20% 이상 + 32개 이상이
   몰린 값만 "지배적 평면 레벨"로 수집한다 — z-fighting 은 넓은 평면끼리
   겹칠 때만 문제라, 벽·나무 같은 입체물의 bbox 경계가 우연히 가깝다고
   오발되지 않는다. 5mm 이내 레벨은 의도적 동일 평면(차선↔아스팔트,
   도크 라인↔도크 바닥)으로 병합한다 — 같은 입력값은 같은 셀로 가므로
   어떤 비트 수에서도 유지된다.
2. 인접 레벨 간 최소 높이 차(minGap)와 16bit 그리드를 비교해
   **그리드×2 ≤ minGap 일 때만 meshopt 를 적용**한다.
3. 조건을 못 넘으면 meshopt 를 생략하고 f32 로 남긴다 — simplify 까지만으로도
   대부분 절감되고 나머지는 HTTP gzip 이 흡수한다. 판단 근거는 항상 로그에 남는다:

```
OK  61.79MB -> 7.55MB (-87.8%)  phillyshipyard.glb  [그리드 3.6cm / 층간 8.7cm → meshopt 적용]
```

philly 검증값: 그리드 3.65cm, minGap 8.7cm(3.5945m 층 ↔ 3.6823m 지면 상단) → 적용.

## 5. 튜닝 노브 (스크립트 상수 / env)

| 노브 | 기본값 | 용도 |
|---|---|---|
| `SIMPLIFY_RATIO` | 0.4 | 삼각형 감소 목표. 더 줄이려면 낮춘다 |
| `SIMPLIFY_ERROR` | 0.0002 | bbox 대각 상대 오차(philly 기준 최대 편차 ~0.6m). 감소가 부족하면 0.001 까지 |
| `MAX_TEXTURE_SIZE` / `LOSSY_QUALITY` | 1024 / 80 | 텍스처 상한·품질 |
| `KEEP_DOUBLE_SIDED=1` | off | 단면화로 뒷면 구멍이 보일 때 양면 유지 |
| `FORCE_MESHOPT=1` | off | 양자화 가드 무시 — 감지된 작은 층간 갭이 의도가 아님을 사람이 확인한 경우만 |

## 6. 문제 해결

| 증상 | 원인 | 조치 |
|---|---|---|
| 도로/바닥이 깜빡이며 지워졌다 생김 | 양자화가 층간 높이 차를 붕괴 (z-fighting) | 로그의 그리드/층간 수치 확인. 가드가 `FORCE_MESHOPT` 로 우회됐다면 해제하고 재실행 |
| 특정 면이 안 보이거나 구멍 | 단면화 + 원본의 뒤집힌 노멀 | `KEEP_DOUBLE_SIDED=1` 로 재실행 후 육안 비교 |
| 유리가 어색함 | transmission → 알파 반투명 변환의 한계(굴절/블러 없음) | 알파값(스크립트의 0.5)·roughness 조정. transmission 복원은 금지 — 프레임 비용 2배 |
| 근접 시 형태 뭉개짐 | simplify 과다 | `SIMPLIFY_ERROR` 를 낮추거나 `SIMPLIFY_RATIO` 를 올려 재실행 |
| 파일이 기대만큼 안 줄어듦 | 가드가 meshopt 를 생략했거나, simplify 가 오차 한도에 걸림 | 로그 확인. philly 의 경우 나무 잎(Leaf Dark/Light 63.9만 정점)이 오차 한도에 걸려 전혀 줄지 않았다 — 추가 절감이 필요하면 잎 프리미티브만 공격적 simplify 가 다음 수단 |

## 7. 런타임 측 연계 (커밋 2d27006)

파이프라인과 별개로, 지도급 에셋이 켜는 런타임 비용도 함께 정리돼 있다:

- **transmission DEV 경고**: `model-mesh.tsx` 의 clone 순회가 transmission 머티리얼을
  발견하면 콘솔 경고를 낸다 — 원본 지도를 최적화 없이 반입한 실수를 개발 중에 잡는 그물.
- **지도 BVH**: 지도도 raycast BVH 를 빌드한다(기본값). 예전의 `enableRaycastBvh={false}`
  는 "지도는 수만 개 메시" 전제였는데 실제 지도는 프리미티브 수십 개다 — BVH 없이는
  포인터 이동마다 수십만 삼각형을 브루트포스 순회한다.
- **DPR 상한 [1, 1.5]**: `ThreeSceneViewer` 기본값 + 에디터(`SCENE_DEFAULT_DPR`).
- **지도 `showLabel={false}`**: 라벨 없는 지도의 마운트 시 전체 트리 bbox 순회 생략.

## 8. 검증 방법

1. **정적**: `node node_modules/@gltf-transform/cli/bin/cli.js inspect apps/shell/public/maps/<파일>`
   — extensionsUsed 에 `KHR_materials_transmission` 이 없고, 가드 적용 시
   `EXT_meshopt_compression` 이 있는지, 삼각형 수·크기 확인.
2. **비주얼**: `pnpm dev:shell` 후 해당 지도를 쓰는 화면(goliath / philly-dock-2 모니터링,
   씬 에디터)에서 — 도로·도크 마킹 깜빡임 없음, 뒷면 구멍 없음, 유리 외관 수용 가능,
   에디터에서 모델 드롭 시 지면 높이에 정확히 안착(드롭 레이캐스트).
3. **성능**: DevTools Rendering → Frame Rendering Stats 로 궤도 회전 중 FPS,
   Network 로 GLB 전송 크기.
