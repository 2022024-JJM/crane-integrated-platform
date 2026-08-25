# real-scan — 조립 5공장 (실측데이터) 뷰어 자산

한화에너지 PoC 실측 데이터셋(`20251220_150000`, LiDAR 12대)에서 변환한 대시보드 자산이다.

| 파일 | 내용 |
|---|---|
| `manifest.json` | 그룹(G1/G2/G3)·센서 위치·CAD 배치 행렬·정합 오차 메타 |
| `cad_meshes.json` | 블록 CAD 13종 로컬 메쉬 (정점 centroid 원점, m) |
| `g1.bin` `g2.bin` `g3.bin` `factory.bin` | display 좌표 Float32 xyz 점군 (다운샘플) |
| `*_labels.bin` | 점별 블록 라벨 (Uint8, blocks 인덱스, 255=미분류) — 세그멘테이션·블록 단독 뷰용 |
| `*_dev.bin` | 점별 CAD 표면 편차 (Uint8, dist/tolerance×255, 255=미일치) — 편차 히트맵용 |

전부 git에 커밋돼 있다 (합쳐서 ~100MB, 파일당 GitHub 100MB 제한 이내라 LFS 없이 그대로 둔다).
pull만 받으면 바로 뷰어가 뜬다 — 별도 재생성 불필요.

## bin 파일 재생성 (데이터셋이 갱신될 때만)

원본 데이터셋이 바뀌었을 때만 다시 돌린다 (laspy·numpy·scipy 필요). 원본 데이터셋
디렉토리를 받아 아래를 실행하면 이 디렉토리의 파일이 덮어써진다:

```bash
python3 scripts/build-real-scan-assets.py <데이터셋 경로>
```

재생성 후에는 바뀐 bin 파일도 함께 커밋한다.

## 좌표 규약 (중요)

- display 좌표: y-up. scene(z-up, G2 canonical) → `X=x-cx, Y=z-z0, Z=y-cy`.
- CAD 로컬 프레임은 **정점 centroid 원점**이다 (bbox 중심 아님 — 데이터 제공사 규약 확인됨).
  bbox 중심으로 다시 정규화하면 블록당 최대 2.6 m 오프셋이 생긴다.
- 배치 행렬은 제공된 `T_scene_cad` 그대로이며, 변환 시점에 CAD 표면 → 점군 최근접 거리
  중앙값 5~21 cm 로 검증됐다 (`manifest.json` 의 `fitErrorCm`).

## 세그멘테이션 (점 → 블록 라벨)

bbox 포함 판정이 아니라 **CAD 표면 최근접 거리** 기준이다 (bbox 방식은 바닥·지그까지
쓸려 들어간다):

1. CAD 는 FBX **바이너리에서 원시 Vertices 만 직접 추출**한다 — FBX 임포터(three
   FBXLoader, Blender 등)는 내부 노드 변환 체인(±수백 m 이동, x1000 스케일) 때문에 금지.
2. 삼각형 면적 가중 랜덤 샘플링 (~2 cm 유효 간격, 블록당 상한 80만, 정점 포함).
3. 블록 로컬 bbox 의 display AABB + 여유(0.5 m)로 후보 프리필터.
4. `cKDTree.query(distance_upper_bound=0.20)` 로 표면 거리 ≤ 20 cm 인 점만 라벨,
   여러 블록에 걸리면 최소 거리 블록이 가진다 (허용 오차는 정합 오차 중앙값 5~21 cm
   대비 10 cm 는 빠듯해 20 cm 로 운용 — `scripts/build-real-scan-assets.py` 의
   `SEG_TOLERANCE_M` 참조).

정상 정합이면 bbox 후보 대비 매칭률이 30~70% 수준이어야 한다 (바닥·지그가 걸러진다는
뜻) — 블록별 통계는 `manifest.json` 의 `segmentation.perBlock` 참조.
