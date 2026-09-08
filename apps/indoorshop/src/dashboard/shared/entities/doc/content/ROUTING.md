# Web Dashboard 라우팅 구조

## 라우트 맵

| URL | 컴포넌트 | 설명 |
|-----|---------|------|
| `/` | `DashboardPage` | 통합대시보드 (4개 공정존 상태 + 시스템 정보 + 문서) |
| `/zones/assembly` | `FactoryListPage` | 조립 공장 목록 |
| `/zones/assembly/:factoryId` | `AssemblyWorkspace` | 공장 전체 센서퓨전 뷰 |
| `/zones/assembly/:factoryId/production` | `ProductionCountPage` | 일일 소조 생산 현황 |
| `/zones/assembly/:factoryId/:locationId` | `AssemblyWorkspace` | 정반 단위 라이다 인식 현황 |
| `/zones/:zoneId` | `ZoneDetailPage` | 공정별 Field Data 수집 현황판 |
| `/docs` | `DocsPage` | 레포 마크다운 문서 목록 |
| `/docs/:docId` | `DocViewerPage` | 문서 뷰어 (`docId` = 확장자 뺀 파일 이름) |
| `/settings` | `SettingsPage` | 테마·글자 크기 설정 |
| `*` | `NotFoundPage` | 404 Not Found |

## zoneId 값

| zoneId | 공정존 | 다국어 |
|--------|-------|-------|
| `assembly` | 조립 공정 | Assembly |
| `fabrication` | 가공 공정 | Fabrication |
| `outfitting` | 선행의장 공정 | Outfitting |
| `painting` | 선행도장 공정 | Painting |

## 디렉토리 구조 (FSD)

```
src/
├── app/
│   └── router.tsx                  # createBrowserRouter 설정
│
├── pages/                          # 페이지별 UI 구성
│   ├── dashboard/
│   │   └── ui/
│   │       └── DashboardPage.tsx    # 통합 대시보드 (/ 라우트)
│   │
│   ├── zone-detail/
│   │   └── ui/
│   │       └── ZoneDetailPage.tsx   # 공정별 현황판 (/zones/:zoneId 라우트)
│   │
│   └── not-found/
│       └── ui/
│           └── NotFoundPage.tsx     # 404 페이지 (* 라우트)
│
├── entities/                       # 도메인 모델
│   ├── zone/model/types.ts         # Zone, ZoneStatus, ZoneHealth 타입
│   └── system/model/types.ts       # SystemInfo, SystemDetail 타입
│
├── features/                       # 기능별 컴포넌트
│   ├── zone-monitoring/
│   │   └── ui/
│   │       ├── molecules/
│   │       │   └── ZoneCard.tsx    # 개별 공정존 카드 (Link 포함)
│   │       └── organisms/
│   │           └── ZoneGrid.tsx    # 공정존 그리드 레이아웃
│   │
│   └── system-info/
│       └── ui/molecules/
│           └── SystemInfoCard.tsx  # 시스템 정보 카드
│
├── shared/                         # 공유 자산
│   ├── ui/atoms/
│   │   ├── Card.tsx                # Card 컴포넌트 세트
│   │   ├── StatusBadge.tsx         # 상태 배지
│   │   └── HealthBadge.tsx         # 헬스 상태 배지
│   ├── lib/
│   │   └── utils.ts                # cn() Tailwind 유틸
│   └── styles/
│       └── globals.css             # 글로벌 스타일
│
├── widgets/                        # 레이아웃 구성 요소
│   ├── header/Header.tsx           # 헤더
│   ├── footer/Footer.tsx           # 푸터
│   └── layout-wrapper/
│       └── LayoutWrapper.tsx       # 메인 레이아웃 (Header + Footer)
│
└── main.tsx                        # React 진입점 (RouterProvider)
```

## 주요 변경사항

### 추가된 파일
- `src/app/router.tsx` — react-router-dom 라우터 설정
- `src/pages/dashboard/ui/DashboardPage.tsx` — 통합 대시보드 페이지
- `src/pages/zone-detail/ui/ZoneDetailPage.tsx` — 공정별 현황판 페이지 (placeholder)
- `src/pages/not-found/ui/NotFoundPage.tsx` — 404 페이지

### 삭제된 파일
- `src/app/layout.tsx` — Next.js App Router 흉내 (Vite SPA에는 불필요)
- `src/app/page.tsx` — 단일 페이지 (내용을 DashboardPage로 이관)

### 수정된 파일
- `src/main.tsx` — `RouterProvider`로 교체 (기존: `App` 직접 렌더링)
- `src/features/zone-monitoring/ui/molecules/ZoneCard.tsx` — `<Link>` 추가 (기존: `<button>`)

## 내비게이션

### 프로그래밍 방식
```tsx
import { useNavigate } from 'react-router-dom'

function MyComponent() {
  const navigate = useNavigate()
  
  const handleClick = () => {
    navigate('/zones/assembly')
  }
  
  return <button onClick={handleClick}>조립 현황판</button>
}
```

### 링크 방식 (권장)
```tsx
import { Link } from 'react-router-dom'

export function ZoneCard({ zone }) {
  return (
    <Link to={`/zones/${zone.id}`}>
      상세 보기 →
    </Link>
  )
}
```

### 동적 라우트 파라미터
```tsx
import { useParams } from 'react-router-dom'

export function ZoneDetailPage() {
  const { zoneId } = useParams<{ zoneId: string }>()
  // zoneId를 사용하여 데이터 페칭 등을 수행
}
```

## 다음 단계

1. **공정별 Field Data 시각화**: `ZoneDetailPage`에 LiDAR/OCR/PLC 데이터 위젯 추가
2. **API 연동**: Mock 데이터(`mockZones`)를 백엔드 API 호출로 교체
3. **상태 관리**: 전역 상태 관리 라이브러리(Context API, Redux 등) 도입 고려
4. **실시간 업데이트**: WebSocket/Server-Sent Events 추가로 실시간 데이터 수신
5. **상세 페이지 분기**: 필요시 `/zones/:zoneId/:tab` 등 중첩 라우트 추가 가능

## 테스트

```bash
# 개발 서버 시작
npm run dev
# http://localhost:5173 에서 확인

# 빌드
npm run build

# 린트
npm run lint
```

### 확인 체크리스트
- [ ] `/` 접근 시 통합 대시보드 렌더링
- [ ] `/zones/assembly` 접근 시 조립 현황판 렌더딩
- [ ] `/zones/fabrication` 접근 시 가공 현황판 렌더링
- [ ] `/zones/outfitting` 접근 시 의장 현황판 렌더링
- [ ] `/zones/painting` 접근 시 도장 현황판 렌더링
- [ ] `/zones/unknown-zone` 접근 시 안내 메시지 표시
- [ ] `/foo` 등 존재하지 않는 경로 접근 시 404 페이지 표시
- [ ] Zone 카드의 "상세 보기" 버튼 클릭 시 해당 공정존 페이지로 이동
- [ ] 각 페이지에서 "홈으로 돌아가기" 링크 정상 작동
