import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { invalidateShadows } from '@crane/domain/3d';
import { CONTEXT_RESTORE_TIMEOUT_MS } from '../lib/context-recovery';

/**
 * WebGL 컨텍스트 유실 복구 — Canvas 안 null 컴포넌트.
 *
 * 드라이버 리셋·GPU 과부하로 컨텍스트가 유실되면 three 는 `webglcontextrestored`
 * 뒤 프로그램·텍스처를 다시 올리지만, demand 프레임루프에서는 아무도
 * 프레임을 요청하지 않아 유휴 화면이 검게 남고 shadow map 도 낡은 채다.
 * 여기서 복원 이벤트에 그림자 무효화 + 프레임 요청을 걸고, 유실 뒤
 * CONTEXT_RESTORE_TIMEOUT_MS 안에 복원이 오지 않으면 페이지를 새로 고친다
 * (무인 관제 — 사람이 F5 를 누를 때까지 검은 화면으로 두지 않는다).
 * `preventDefault` 는 브라우저가 복원을 시도하게 하는 조건이다.
 */
export function SceneContextRecovery() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const onLost = (event: Event) => {
      event.preventDefault();
      console.warn('[scene] WebGL 컨텍스트 유실 — 복원을 기다린다');
      if (reloadTimer !== null) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        console.error('[scene] WebGL 컨텍스트가 복원되지 않아 새로 고친다');
        window.location.reload();
      }, CONTEXT_RESTORE_TIMEOUT_MS);
    };
    const onRestored = () => {
      if (reloadTimer !== null) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
      }
      console.warn('[scene] WebGL 컨텍스트 복원 — 다시 그린다');
      invalidateShadows();
      invalidate();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (reloadTimer !== null) clearTimeout(reloadTimer);
    };
  }, [gl, invalidate]);

  return null;
}
