/**
 * 씬 배경(등장방형 파노라마 EXR) 카탈로그.
 *
 * 에디터가 이 목록에서 배경을 고르고, 선택 결과는 씬의 `environmentId`로
 * 저장된다. 파일 경로가 아니라 id를 저장하는 이유:
 *  - 저장본이 배포 경로(BASE_URL)에 묶이지 않는다.
 *  - 파일을 교체·리사이즈해도 씬 파일을 건드릴 필요가 없다.
 *  - 없어진 id는 "배경 없음"으로 안전하게 떨어진다(경로였다면 404 로더 오류).
 *
 * 파일은 apps/shell/public/scenes/에 둔다.
 */

export interface SceneEnvironmentCatalogItem {
  id: string;
  label: string;
  /** public 기준 상대 경로. BASE_URL은 조회 시점에 붙인다. */
  path: string;
}

/**
 * -web 파일은 원본을 4096×2048 half-float/DWAA로 리사이즈한 웹 배포용이다.
 * 원본은 MAX_TEXTURE_SIZE 8192인 GPU에서 업로드가 실패해 배경이 검게 나오고,
 * GPU 메모리도 수백 MB를 먹는다 — 원본은 카탈로그에 넣지 말 것.
 *
 * **파일명의 "4K"를 믿지 말 것.** 지금까지 확인한 *_4K.exr는 전부 4K가 아니었다 —
 * EXR 헤더의 dataWindow로 잰 실측값이다:
 *   - overcast-sky-over-the-atlantic_4K.exr : 6656 x 3328  (2026-08-14 삭제)
 *   - sky-blue-open-water_4K_*.exr          : 원본          (2026-08-14 삭제)
 *   - infinite-horizon_4K.exr               : 9216 x 4608  ← 8192 초과, 미등록
 * DWAA는 손실 압축이라 9K 이미지도 3.6MB로 작아진다. **파일 크기로도 파일명으로도
 * 해상도를 알 수 없으니, 새 EXR을 등록하기 전에 반드시 헤더를 볼 것.**
 *
 * 위 원본 둘은 `-web` 버전으로 대체된 뒤 참조가 없어 삭제했다(합 22.6MB).
 */
export const sceneEnvironmentCatalog: SceneEnvironmentCatalogItem[] = [
  {
    id: 'overcast-atlantic',
    label: 'Overcast Sky',
    path: 'scenes/overcast-sky-over-the-atlantic-web.exr',
  },
  {
    id: 'blue-open-water',
    label: 'Blue Open Water',
    path: 'scenes/sky-blue-open-water-web.exr',
  },
  // TODO(infinite-horizon): 원본이 9216x4608이라 그대로 등록하면 8192 상한
  // GPU에서 배경이 검게 나온다. 4096x2048 half-float/DWAA로 리사이즈해
  // `scenes/infinite-horizon-web.exr`로 저장한 뒤 아래를 활성화할 것.
  // {
  //   id: 'infinite-horizon',
  //   label: 'Infinite Horizon',
  //   path: 'scenes/infinite-horizon-web.exr',
  // },
];

export function getSceneEnvironmentById(
  environmentId: string | null | undefined,
): SceneEnvironmentCatalogItem | null {
  if (!environmentId) return null;
  return sceneEnvironmentCatalog.find((e) => e.id === environmentId) ?? null;
}
