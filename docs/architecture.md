# 배당 캘린더 PWA - 아키텍처 설계

**작성일**: 2026-03-27
**버전**: 1.0

---

## 1. 프로젝트 구조

### 1.1 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | React 18 + TypeScript | SPA |
| 빌드 도구 | Vite 5 | 빠른 HMR, PWA 플러그인 지원 |
| 스타일링 | Tailwind CSS 3 | 유틸리티 퍼스트, 모바일 우선 |
| 상태 관리 | Zustand | 경량, 보일러플레이트 최소화 |
| 라우팅 | React Router v6 | SPA 라우팅 |
| 차트 | Recharts | React 친화적, 경량, 반응형 지원 |
| PWA | vite-plugin-pwa | Workbox 기반 Service Worker 자동 생성 |
| OCR | Tesseract.js | 브라우저 로컬 OCR (MVP) |
| DB | Google Sheets | Google Apps Script 웹앱을 통해 접근 |
| 중간 서버 | Google Apps Script | 배당 데이터 수집 + Sheets CRUD API |

### 1.2 폴더 구조

```
dividends-calendar/
├── public/
│   ├── icons/                  # PWA 아이콘 (192x192, 512x512)
│   └── manifest.json           # PWA 매니페스트 (Vite 플러그인이 자동 생성)
├── src/
│   ├── components/
│   │   ├── common/             # Button, Card, Modal, Spinner, Toggle 등
│   │   ├── calendar/           # CalendarGrid, DayCell, DividendBadge
│   │   ├── dashboard/          # SummaryCard, MonthlyChart, AccountSelector
│   │   ├── capture/            # ImageUploader, OcrResultEditor, AccountMapper
│   │   └── settings/           # AccountManager, CurrencyToggle, ThemeSwitch
│   ├── pages/
│   │   ├── DashboardPage.tsx   # 메인 대시보드
│   │   ├── CalendarPage.tsx    # 배당 캘린더
│   │   ├── CapturePage.tsx     # 캡처 업로드 + OCR
│   │   └── SettingsPage.tsx    # 설정
│   ├── hooks/
│   │   ├── useAccounts.ts      # 계좌 데이터 CRUD
│   │   ├── useHoldings.ts      # 보유 종목 데이터
│   │   ├── useDividends.ts     # 배당 데이터 조회/캘린더 변환
│   │   ├── useExchangeRate.ts  # 환율 조회 (Dunamu API)
│   │   └── useOcr.ts           # Tesseract.js OCR 처리
│   ├── services/
│   │   ├── sheetsApi.ts        # Google Apps Script 웹앱 통신
│   │   ├── exchangeApi.ts      # Dunamu 환율 API
│   │   └── ocrService.ts       # OCR 엔진 래퍼
│   ├── stores/
│   │   ├── accountStore.ts     # 계좌 선택 상태
│   │   ├── currencyStore.ts    # 환율/통화 전역 상태
│   │   └── appStore.ts         # 앱 전역 상태 (로딩, 에러 등)
│   ├── types/
│   │   ├── account.ts          # Account, Holding 타입
│   │   ├── dividend.ts         # Dividend, DividendEvent 타입
│   │   └── ocr.ts              # OcrResult, ParsedHolding 타입
│   ├── utils/
│   │   ├── formatters.ts       # 통화, 날짜, 숫자 포맷
│   │   ├── parsers.ts          # OCR 결과 파싱 로직
│   │   └── constants.ts        # 상수 정의
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css               # Tailwind 디렉티브
├── gas/                        # Google Apps Script 소스
│   ├── Code.gs                 # 웹앱 엔드포인트 (doGet/doPost)
│   ├── SheetsService.gs        # Google Sheets CRUD
│   ├── DividendFetcher.gs      # yfinance 대체: 배당 데이터 수집
│   └── Scheduler.gs            # 시간 기반 트리거 (배당 데이터 자동 갱신)
├── docs/
│   ├── research.md
│   └── architecture.md
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 1.3 라우팅 구조

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | DashboardPage | 메인 대시보드 - 이번 달 배당 요약, 계좌별 합산 |
| `/calendar` | CalendarPage | 월별 배당 캘린더 (배당일 표시) |
| `/capture` | CapturePage | 증권사 캡처 이미지 업로드 + OCR |
| `/settings` | SettingsPage | 계좌 관리, 통화 설정, 테마 |

하단 탭 네비게이션으로 모바일 최적화 (4개 탭: 홈, 캘린더, 캡처, 설정)

---

## 2. Google Sheets 스키마

하나의 Google Spreadsheet 파일 안에 4개의 시트를 사용합니다.

### 2.1 accounts 시트 (계좌 정보)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | accountId | string | 고유 ID (자동 생성) | `acc_001` |
| B | accountName | string | 계좌 별명 | `키움 미국ETF` |
| C | broker | string | 증권사명 | `키움증권` / `삼성증권` |
| D | currency | string | 기본 통화 | `USD` / `KRW` |
| E | isActive | boolean | 활성 여부 | `TRUE` |
| F | createdAt | string | 생성일 (ISO) | `2026-03-27` |
| G | updatedAt | string | 수정일 (ISO) | `2026-03-27` |

### 2.2 holdings 시트 (보유 종목)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | holdingId | string | 고유 ID | `hld_001` |
| B | accountId | string | 계좌 ID (FK) | `acc_001` |
| C | ticker | string | 종목코드/티커 | `VCLT` / `069500` |
| D | name | string | 종목명 | `Vanguard Long-Term Corp Bond` / `KODEX 200` |
| E | quantity | number | 보유 수량 | `50` |
| F | avgPrice | number | 매입 평균가 | `78.50` |
| G | currentPrice | number | 현재가 | `80.25` |
| H | currency | string | 통화 | `USD` / `KRW` |
| I | market | string | 시장 구분 | `US` / `KR` |
| J | updatedAt | string | 최종 갱신일 | `2026-03-27` |

### 2.3 dividends 시트 (배당 이력)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | dividendId | string | 고유 ID | `div_001` |
| B | ticker | string | 종목코드 | `VCLT` |
| C | name | string | 종목명 | `Vanguard Long-Term Corp Bond` |
| D | exDate | string | 배당락일 | `2026-03-10` |
| E | payDate | string | 지급일 | `2026-03-15` |
| F | amount | number | 주당 배당금 | `0.32` |
| G | currency | string | 통화 | `USD` |
| H | frequency | string | 배당 주기 | `monthly` / `quarterly` / `annual` |
| I | status | string | 실적/예상 구분 | `actual` / `estimated` |
| J | source | string | 데이터 출처 | `yfinance` / `krx` / `manual` |
| K | updatedAt | string | 갱신일 | `2026-03-27` |

### 2.4 settings 시트 (설정)

| 열 | 필드명 | 타입 | 설명 | 예시 |
|----|--------|------|------|------|
| A | key | string | 설정 키 | `defaultCurrency` |
| B | value | string | 설정 값 | `KRW` |
| C | updatedAt | string | 수정일 | `2026-03-27` |

**기본 설정값:**

| key | value | 설명 |
|-----|-------|------|
| `defaultCurrency` | `KRW` | 기본 표시 통화 |
| `theme` | `light` | 테마 (light/dark) |
| `lastSyncAt` | ISO 날짜 | 마지막 데이터 동기화 시간 |
| `exchangeRate_USD_KRW` | `1350.5` | 캐싱된 환율 (오프라인 폴백) |

---

## 3. 컴포넌트 구조

### 3.1 페이지 컴포넌트

```
App
├── BottomNav                    # 하단 탭 네비게이션
├── DashboardPage
│   ├── AccountSelector          # 계좌 선택 (전체/개별/복수)
│   ├── SummaryCard              # 이번 달 배당 요약 (총액, 건수)
│   ├── MonthlyChart             # 월별 배당 추이 차트 (Recharts)
│   └── UpcomingDividends        # 다가오는 배당 리스트
├── CalendarPage
│   ├── CalendarHeader           # 월 이동, 연/월 표시
│   ├── CalendarGrid             # 7x6 그리드
│   │   └── DayCell              # 개별 날짜 셀
│   │       └── DividendBadge    # 배당 표시 뱃지 (색상으로 계좌 구분)
│   └── DayDetailSheet           # 날짜 클릭 시 바텀 시트 (배당 상세)
├── CapturePage
│   ├── ImageUploader            # 카메라/갤러리 이미지 선택
│   ├── OcrProgress              # OCR 진행률 표시
│   ├── OcrResultEditor          # 인식 결과 편집 테이블
│   └── AccountMapper            # 인식된 종목 → 계좌 매핑
└── SettingsPage
    ├── AccountManager           # 계좌 추가/수정/삭제
    ├── CurrencyToggle           # USD ↔ KRW 토글
    ├── SyncStatus               # 마지막 동기화 시간 + 수동 동기화
    └── AppInfo                  # 앱 버전 정보
```

### 3.2 공통 UI 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `Button` | Primary/Secondary/Ghost 변형 |
| `Card` | 정보 카드 컨테이너 |
| `Modal` | 모달 다이얼로그 |
| `BottomSheet` | 모바일 바텀 시트 |
| `Spinner` | 로딩 스피너 |
| `Toggle` | 환율 토글 등 |
| `Badge` | 배당 뱃지 (색상 코드) |
| `EmptyState` | 데이터 없음 안내 |
| `ErrorBoundary` | 에러 폴백 UI |

### 3.3 데이터 관련 훅

| 훅 | 역할 | 반환값 |
|----|------|--------|
| `useAccounts()` | 계좌 목록 CRUD | `{ accounts, addAccount, updateAccount, removeAccount }` |
| `useHoldings(accountIds)` | 선택 계좌의 보유 종목 | `{ holdings, isLoading, refetch }` |
| `useDividends(accountIds, month)` | 월별 배당 데이터 | `{ dividends, totalAmount, calendarEvents }` |
| `useExchangeRate()` | USD/KRW 환율 | `{ rate, isLoading, lastUpdated }` |
| `useOcr()` | OCR 처리 | `{ recognize, result, confidence, isProcessing }` |
| `useCurrency()` | 통화 변환 헬퍼 | `{ convert, format, currentCurrency, toggle }` |

---

## 4. 데이터 흐름

### 4.1 캡처 → OCR → 시트 저장

```
[사용자]
  │ 증권사 앱 캡처 이미지 업로드
  ▼
[ImageUploader] ── 파일 선택 (카메라/갤러리)
  │
  ▼
[Tesseract.js] ── 브라우저 로컬 OCR 처리
  │  - 한국어 + 영어 + 숫자 인식
  │  - 신뢰도 점수 반환
  ▼
[OcrResultEditor] ── 인식 결과 테이블 표시
  │  - 사용자가 오인식 수정 가능
  │  - 종목코드, 종목명, 수량, 금액 매핑
  ▼
[AccountMapper] ── 계좌 선택/매핑
  │
  ▼
[sheetsApi.ts] ── Google Apps Script 웹앱 호출
  │  POST /exec { action: "upsertHoldings", data: [...] }
  ▼
[Google Sheets] ── holdings 시트에 upsert
```

### 4.2 배당 데이터 수집 (Google Apps Script)

```
[Google Apps Script - 시간 트리거]
  │  매일 1회 자동 실행 (오전 9시)
  ▼
[DividendFetcher.gs]
  ├── 미국 ETF: Finnhub API / Alpha Vantage (REST)
  │   - ticker 목록은 holdings 시트에서 market="US" 필터
  │   - 배당락일, 지급일, 주당 배당금 수집
  │
  ├── 한국 ETF: 금융위원회 주식배당정보 API
  │   - ticker 목록은 holdings 시트에서 market="KR" 필터
  │   - 배당기준일, 지급일, 배당금 수집
  │
  └── dividends 시트에 upsert
      - 기존 데이터와 비교하여 신규/변경분만 업데이트
      - status: "actual" (확정) / "estimated" (예상)
```

> **왜 Google Apps Script인가?**
> - yfinance(Python)는 브라우저에서 직접 호출 불가 → GAS가 중간 서버 역할
> - Finnhub/Alpha Vantage 같은 REST API도 CORS 이슈 없이 GAS에서 호출 가능
> - Google Sheets와 동일 생태계 → 인증 불필요, UrlFetchApp으로 바로 호출
> - 시간 기반 트리거로 자동 갱신 가능 (무료)

### 4.3 앱 로딩 → 캘린더 표시

```
[앱 시작]
  │
  ▼
[sheetsApi.ts] ── GET /exec?action=getAll
  │  Google Apps Script 웹앱에서 accounts + holdings + dividends + settings 일괄 조회
  ▼
[Zustand Store] ── 전역 상태에 캐싱
  │
  ├── accountStore: 계좌 목록 + 선택 상태
  ├── currencyStore: 환율 + 현재 통화
  └── appStore: 로딩/에러 상태
  │
  ▼
[useDividends] ── 선택된 계좌 + 월 기준으로 필터링
  │  - calendarEvents 형태로 변환 (날짜 → 배당 목록)
  ▼
[CalendarGrid] ── 날짜별 배당 뱃지 렌더링
```

### 4.4 환율 토글

```
[useExchangeRate] ── 앱 시작 시 Dunamu API 호출
  │  https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD
  │  - CORS 지원 → 브라우저에서 직접 호출
  │  - 실패 시 settings 시트의 캐싱된 환율 사용
  ▼
[currencyStore] ── rate, currentCurrency 저장
  │
  ▼
[CurrencyToggle] ── 사용자 토글 (USD ↔ KRW)
  │
  ▼
[useCurrency().convert()] ── 모든 금액 표시에 적용
  │  - USD 계좌: USD 원본 / KRW 환산
  │  - KRW 계좌: KRW 원본 / USD 환산
  │  - 합산 뷰: 선택된 통화로 통일
```

---

## 5. PWA 전략

### 5.1 manifest.json 설정

```json
{
  "name": "배당 캘린더",
  "short_name": "배당캘린더",
  "description": "개인 배당 투자 캘린더",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

> `vite-plugin-pwa`가 빌드 시 자동으로 manifest를 생성하므로, `vite.config.ts`에서 설정합니다.

### 5.2 Service Worker 캐싱 전략

`vite-plugin-pwa` + Workbox 기반으로 구성합니다.

| 리소스 | 전략 | 이유 |
|--------|------|------|
| HTML, JS, CSS (앱 셸) | **Precache** | 빌드 시 자동 프리캐시 → 오프라인에서도 앱 로딩 |
| Google Fonts | **CacheFirst** (30일) | 폰트는 거의 변경 없음 |
| 환율 API | **NetworkFirst** (1시간) | 최신 환율 우선, 실패 시 캐시 |
| Sheets 데이터 | **NetworkFirst** (30분) | 최신 데이터 우선, 오프라인 시 마지막 캐시 |
| OCR 언어 데이터 | **CacheFirst** | 한번 다운로드 후 캐싱 (수 MB) |

### 5.3 오프라인 지원 범위

| 기능 | 오프라인 지원 | 설명 |
|------|:---:|------|
| 앱 로딩 | O | Precache된 앱 셸 |
| 캘린더 조회 | O | 마지막 동기화된 데이터 표시 |
| 대시보드 | O | 캐싱된 데이터 기반 |
| 환율 표시 | △ | 마지막 캐싱된 환율 사용 (시간 표시) |
| OCR 인식 | O | Tesseract.js 로컬 처리 (언어 데이터 캐싱 전제) |
| 시트 저장 | X | 온라인 필요 → 오프라인 시 로컬 큐에 저장, 온라인 복귀 시 동기화 |
| 배당 데이터 갱신 | X | GAS 트리거가 서버에서 처리 |

---

## 6. 기술적 결정사항

### 6.1 배당 데이터 수집: Google Apps Script 웹앱

**결정**: 프론트에서 직접 호출하지 않고, Google Apps Script를 중간 서버로 활용

**이유**:
- yfinance(Python)는 브라우저에서 실행 불가
- 금융위원회 API는 CORS 미지원 → 브라우저 직접 호출 불가
- Finnhub/Alpha Vantage도 API Key 노출 위험
- GAS는 Google Sheets와 같은 생태계 → 인증 추가 설정 불필요
- 시간 기반 트리거로 매일 자동 갱신 (무료, 서버리스)

**구현 방식**:
```
[Google Apps Script 웹앱]
  ├── doGet(e)  → 데이터 조회 (action 파라미터로 분기)
  ├── doPost(e) → 데이터 저장/수정
  └── 시간 트리거 → 배당 데이터 자동 수집
```

**미국 ETF 배당 데이터**: GAS에서 Finnhub REST API 호출 (UrlFetchApp)
- yfinance는 Python 전용이므로 GAS에서는 REST API를 사용
- Finnhub 무료 플랜으로 시작, 필요 시 Alpha Vantage 폴백

**한국 ETF 배당 데이터**: GAS에서 금융위원회 API 호출
- 공공 API이므로 별도 인증 불필요
- 일 1회 갱신이면 충분

### 6.2 Google Sheets 접근: Google Apps Script 웹앱 (공개 배포)

**결정**: OAuth나 API Key 대신 GAS 웹앱으로 접근

**이유**:
- OAuth: 개인용 앱에 과도한 설정 (동의 화면, 스코프 등)
- API Key: Sheets API는 읽기만 가능, 쓰기 불가
- GAS 웹앱: `doGet`/`doPost`로 REST API처럼 사용 가능
  - "나만 실행" 권한으로 배포 → 보안 유지
  - "모든 사용자 접근 허용"으로 배포 → 프론트에서 fetch 가능
  - 개인용이므로 이 수준의 보안으로 충분

**보안 고려사항**:
- 웹앱 URL에 간단한 토큰 파라미터 추가 (무단 접근 방지)
- CORS 자동 처리 (GAS 웹앱은 CORS 헤더 포함)

### 6.3 차트 라이브러리: Recharts

**결정**: Recharts 사용

**비교**:

| 항목 | Chart.js | Recharts | Lightweight 대안 |
|------|----------|----------|-----------------|
| React 통합 | 래퍼 필요 (react-chartjs-2) | 네이티브 React 컴포넌트 | 다양 |
| 번들 크기 | ~60KB (gzip) | ~45KB (gzip) | ~10-20KB |
| 반응형 | 설정 필요 | ResponsiveContainer 내장 | 다양 |
| 커스터마이징 | 높음 | 높음 | 제한적 |
| 학습 곡선 | 중간 | 낮음 | 낮음 |

**이유**:
- React 컴포넌트로 선언적 사용 → 코드 가독성 높음
- BarChart(월별 배당), LineChart(추이), PieChart(계좌별 비중) 모두 지원
- 반응형 지원으로 모바일 최적화 용이
- 번들 크기 합리적 (tree-shaking 지원)

### 6.4 상태 관리: Zustand

**결정**: Zustand 사용 (Redux, Jotai, Context API 대신)

**이유**:
- 보일러플레이트 최소 (store 정의 3줄이면 충분)
- 번들 크기 ~2KB (gzip)
- React 외부에서도 접근 가능 (Service Worker 등)
- 이 규모의 앱에 적합한 경량 솔루션

### 6.5 OCR 전략: Tesseract.js (MVP) → 하이브리드 (향후)

**MVP**: Tesseract.js 단독
- 브라우저 로컬 처리 → 서버 비용 없음, 프라이버시 보호
- 증권사 캡처는 정형화된 테이블 → 템플릿 기반 파싱으로 인식률 보완
- 사용자 수정 UI 제공으로 오인식 보정

**향후 (필요 시)**: Tesseract.js + Google Cloud Vision
- 신뢰도 50% 이하일 때만 Cloud Vision 호출
- 월 1,000 유닛 무료이므로 개인용으로 충분

---

## 7. API 통신 규격

### 7.1 프론트 → GAS 웹앱

**Base URL**: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

#### 조회 (GET)

```
GET ?action=getAccounts
GET ?action=getHoldings&accountId=acc_001
GET ?action=getDividends&month=2026-03
GET ?action=getSettings
GET ?action=getAll   # 전체 데이터 일괄 조회 (앱 초기 로딩용)
```

#### 저장 (POST)

```json
// 보유 종목 upsert (OCR 결과 저장)
POST { "action": "upsertHoldings", "accountId": "acc_001", "holdings": [...] }

// 계좌 추가
POST { "action": "addAccount", "account": { "accountName": "키움 미국ETF", ... } }

// 설정 변경
POST { "action": "updateSetting", "key": "defaultCurrency", "value": "USD" }
```

#### 응답 형식

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## 8. 색상 시스템 (배당 뱃지)

| 구분 | 색상 | 용도 |
|------|------|------|
| 키움증권 (미국) | `#3B82F6` (blue-500) | 미국 ETF 배당 뱃지 |
| 삼성증권 (한국) | `#10B981` (emerald-500) | 한국 ETF 배당 뱃지 |
| 예상 배당 | 반투명 (opacity 50%) | 아직 확정되지 않은 배당 |
| 확정 배당 | 불투명 (opacity 100%) | 확정된 배당 |

---

**작성자**: Architect 에이전트
**최종 검토일**: 2026-03-27
