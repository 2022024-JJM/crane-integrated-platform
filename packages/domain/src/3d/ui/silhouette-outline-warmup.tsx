import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { BoxGeometry, Mesh, Scene } from 'three';
import {
  createSilhouetteMaskMesh,
  createSilhouetteOutlineHull,
  createSilhouetteOutlineMaterial,
} from '../lib/silhouette-outline';

/**
 * 실루엣 테두리 셰이더 프리워밍 — Canvas 안에 두는 렌더 없는 컴포넌트.
 *
 * 헐(ShaderMaterial)·마스크(MeshBasicMaterial 변형) 프로그램은 첫 그리기
 * 프레임에 동기로 컴파일·링크된다(three `WebGLProgram.onFirstUse`). 마운트
 * 시 작은 상자 하나에 두 머티리얼을 붙인 임시 씬을 `compileAsync` 로 미리
 * 컴파일해 첫 선택·첫 충돌 프레임에서 그 정지를 뺀다. targetScene 은 실제
 * 씬이다 — 마스크 머티리얼의 프로그램 키에 씬 environment 가 들어가므로.
 *
 * 헐 머티리얼은 **컴포넌트가 사는 동안 들고 있는다.** three 는 같은 셰이더를
 * 쓰는 마지막 머티리얼이 dispose 되면 프로그램도 지운다(`releaseProgram`) —
 * ObjectSilhouetteOutline 은 인스턴스마다 머티리얼을 만들고 언마운트 때
 * 버리므로, 이게 없으면 선택을 풀었다 다시 잡을 때마다 재컴파일된다.
 * 마스크 머티리얼은 모듈 싱글턴이라 따로 들 것이 없다.
 *
 * 실루엣 테두리가 그려질 수 있는 캔버스(스텐실 켜진 에디터·모니터링)에만
 * 마운트한다. 실패(컨텍스트 유실 등)는 무시한다 — 프리워밍이 안 되면 첫
 * 그리기가 예전처럼 컴파일할 뿐이다.
 */
export function SilhouetteOutlineWarmup() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  // 색은 uniform 값이라 프로그램 키와 무관하다 — 아무 값이나 된다.
  const material = useMemo(
    () => createSilhouetteOutlineMaterial('#ffffff'),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const geometry = new BoxGeometry(1, 1, 1);
    const target = new Mesh(geometry);
    const probe = new Scene();
    probe.add(
      createSilhouetteMaskMesh(target),
      createSilhouetteOutlineHull(target, material),
    );
    void gl.compileAsync(probe, camera, scene).catch(() => {
      /* 프리워밍 실패는 무시 — 첫 그리기가 컴파일한다. */
    });
    return () => {
      // 헐 사본 캐시는 원본 geometry 의 dispose 이벤트로 함께 정리된다.
      geometry.dispose();
    };
  }, [gl, camera, scene, material]);

  return null;
}
