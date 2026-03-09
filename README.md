# Crane Monitoring PoC

크레인 모니터링 화면을 위한 프론트엔드 PoC 프로젝트입니다.

현재 구성은 `Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui` 기반입니다.

<br>

## 1. 기준 환경

이 문서는 현재 로컬 개발 환경을 기준으로 정리했습니다.

- OS: Windows
- Node.js: `v24.11.1`
- npm: `11.6.2`

<br>

## 2. 기술 스택

- Architecture : `FSD`
- Build Tool: `Vite 7`
- UI: `React 19`
- Language: `TypeScript 5`
- Styling: `Tailwind CSS 4`, `tw-animate-css`
- UI Library: [`shadcn/ui`](https://ui.shadcn.com/docs), `@base-ui/react`, `lucide-react`
- Lint: `ESLint 9`
- Format: `Prettier 3`

<br>

## 3. 프로젝트 실행 방법

### 패키지 설치

```powershell
npm install
```

### 개발 서버 실행

```powershell
npm run dev
```

기본적으로 Vite 개발 서버가 실행되며, 보통 `http://localhost:5173` 에서 확인할 수 있습니다.

<br>

## 4. 현재 프로젝트 구성

### 엔트리 포인트

- `src/app/index.tsx`
  - React 앱 마운트
  - 전역 스타일 로드
- `src/app/app.tsx`
  - 현재 메인 앱 컴포넌트

### 스타일 구성

- `src/app/styles/index.css`
  - 스타일 진입점
  - `tailwind.css`, `theme.css`를 import
- `src/app/styles/tailwind.css`
  - `tailwindcss`
  - `tw-animate-css`
  - `shadcn/tailwind.css`
- `src/app/styles/theme.css`
  - CSS 변수 기반 테마 정의
  - 라이트/다크 컬러 토큰 정의

### 디렉터리 구조

```text
src/
  app/         # 앱 진입점, 전역 스타일
  pages/       # 페이지 레벨 구성 예정
  widgets/     # 복합 UI 블록 구성 예정
  features/    # 기능 단위 모듈 구성 예정
  entities/    # 도메인 엔티티 레이어 구성 예정
  shared/
    hooks/     # 공통 훅
    lib/       # 공통 유틸
    ui/        # shadcn/ui 기반 공통 컴포넌트
```

<br>

## 5. 코딩 컨벤션

- 변수명
  | type | case |
  | --------------- | -------------------------- |
  | 프로젝트 명 | kebab-case |
  | 폴더 | kebab-case |
  | 파일 | kebab-case |
  | 변수 | camelCase |
  | 함수 | camelCase |
  | 리액트 컴포넌트 | PascalCase |
  | 클래스 | PascalCase |
  | 인터페이스 | PascalCase |
  | 타입 | PascalCase |
  | enum | PascalCase |
  | 상수 | UPPER_SNAKE_CASE |
