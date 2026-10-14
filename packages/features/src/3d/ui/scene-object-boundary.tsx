import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';

/**
 * 씬 객체 하나를 격리하는 경계 — 실패해도 **그 객체만** 사라진다.
 *
 * 예전에는 지도·모델·텍스트·센서가 Canvas 바로 아래 나란히 있었다. GLB
 * 하나가 404거나 파싱에 실패하면 그 오류가 Canvas 전체로 번져 **화면이
 * 통째로 비었다.** 지도 하나 경로가 틀렸을 뿐인데 씬을 아무것도 못 보는
 * 상황이라, 배치 작업 중 경로 오타 한 번이 화면을 날렸다.
 *
 * 마찬가지로 Suspense도 객체마다 둔다. 하나로 묶으면 가장 느린 GLB가
 * 끝날 때까지 나머지가 전부 대기하는데, 지도(수 MB~수십 MB)가 그 하나가
 * 되기 쉽다. 개별로 두면 준비된 것부터 차례로 나타난다.
 *
 * fallback이 `null`인 이유: 이 컴포넌트는 **Canvas 안**에 있어서 DOM을
 * 반환할 수 없다(three.js 재조정기가 처리하지 못한다). 실패한 객체는
 * 조용히 빠지고, 원인은 콘솔로 보낸다 — 사용자에게 알릴 일이라면 씬
 * 로딩 오버레이나 토스트처럼 DOM 레이어에서 해야 한다.
 */

interface SceneObjectBoundaryProps {
  children: ReactNode;
  /** 콘솔 로그에 찍을 식별자 (모델 id·경로 등). */
  label?: string;
  /** 이 객체만의 Suspense를 둘지. 기본 false — 아래 주석 참고. */
  isolateSuspense?: boolean;
}

interface SceneObjectBoundaryState {
  hasError: boolean;
}

class SceneObjectErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  SceneObjectBoundaryState
> {
  state: SceneObjectBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneObjectBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 개발 중에는 원인을 알아야 하고, 운영에서도 무엇이 빠졌는지는 남겨야
    // 한다("모델이 안 보인다"는 문의의 유일한 단서가 된다).
    console.error(
      `[scene] 객체 렌더링 실패${this.props.label ? `: ${this.props.label}` : ''}`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * 씬 객체 하나를 감싸는 경계.
 *
 * @param isolateSuspense 이 객체만의 Suspense를 둘지 여부.
 *
 * 기본값이 `false`인 이유가 중요하다. 뷰어의 로딩 오버레이는 바깥 Suspense가
 * resolve되는 시점(SceneReadyProbe)을 "모델이 마운트됐다"는 신호로 쓴다.
 * 객체마다 Suspense를 두면 바깥 경계가 즉시 resolve되어 **모델이 아직 없는데
 * 오버레이가 걷힌다** — 빈 화면이 잠깐 보이고 모델이 팝인하는, 예전에 고쳤던
 * 그 깜빡임이 되돌아온다.
 *
 * 그래서 뷰어는 공유 Suspense를 유지하고 여기서는 **에러 격리만** 한다.
 * 캔버스를 통째로 비우는 원인은 로딩이 아니라 오류였으므로, 이것만으로
 * 목적은 달성된다. 에디터처럼 로딩 오버레이가 없는 화면에서는 `true`로
 * 켜서 준비된 객체부터 보여주는 편이 낫다.
 */
export function SceneObjectBoundary({
  children,
  label,
  isolateSuspense = false,
}: SceneObjectBoundaryProps) {
  return (
    <SceneObjectErrorBoundary label={label}>
      {isolateSuspense ? (
        <Suspense fallback={null}>{children}</Suspense>
      ) : (
        children
      )}
    </SceneObjectErrorBoundary>
  );
}
