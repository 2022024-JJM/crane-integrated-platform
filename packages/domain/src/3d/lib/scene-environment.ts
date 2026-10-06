/**
 * 씬 배경(등장방형 파노라마 EXR)의 URL.
 *
 * 씬은 배경을 파일 경로로 들고 있다(SavedEnvironmentInfo) — 여기서는 BASE_URL
 * (sub-path 배포 /crane_rnd/)과 콘텐츠 해시(`?v=`)만 씌운다. 그 일은
 * withBaseUrl 한 곳에서만 한다. 배경이 없으면 null 이고, 배경 컴포넌트는
 * 아예 마운트하지 않는다.
 *
 * 웹 배포용 EXR 은 4096×2048 half-float/DWAA 다. 한 변이 MAX_TEXTURE_SIZE
 * (GPU 에 따라 8192)를 넘는 원본은 업로드가 실패해 배경이 검게 나오고 GPU
 * 메모리도 수백 MB 를 먹는다 — 자산 라이브러리가 등록할 때 헤더를 보고 거른다.
 */
import { withBaseUrl } from '@crane/core/lib/asset-url';
import type { SavedEnvironmentInfo } from '../model/types';

export function resolveEnvironmentFileUrl(
  environment: SavedEnvironmentInfo | null | undefined,
): string | null {
  if (!environment?.path) return null;
  // 매니페스트 키는 public 절대 경로다 — 선행 슬래시가 빠진 경로도 맞춘다.
  return withBaseUrl(`/${environment.path.replace(/^\/+/, '')}`);
}
