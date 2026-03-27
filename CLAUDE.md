# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요
개인용 배당 캘린더 PWA 웹앱. 모바일 최적화(max-width 430px), 다크 테마 전용.

## 명령어
```bash
npm run dev       # 개발 서버 (localhost:5173)
npm run build     # tsc -b && vite build
npm run lint      # eslint
npm run preview   # 빌드 결과 프리뷰
```

## 기술 스택
- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Zustand + Recharts
- **Backend/DB**: Google Sheets + Google Apps Script (웹앱)
- **캡처 분석**: OpenAI GPT-5.4-mini (GAS에서 호출, `max_completion_tokens` 사용)
- **배당/현재가/환율**: Yahoo Finance (GAS에서 호출)
- **배포**: Vercel (GitHub main 브랜치 자동 배포)

## 아키텍처

### 데이터 흐름
```
Google Sheets (DB) ←→ GAS (API 서버) ←→ React 앱 (Frontend)
                          ↑
                   Yahoo Finance (배당/현재가/환율)
                   OpenAI GPT-5.4-mini (캡처 OCR)
```

### Frontend 구조
- **pages/**: 4개 페이지 (Dashboard, Calendar, Capture, Settings)
- **hooks/**: 데이터 페칭 + 로컬 필터링 패턴. `useHoldings`와 `useDividends`는 GAS에서 전체 데이터를 한 번 fetch하고 계좌 필터링은 클라이언트에서 처리
- **stores/**: Zustand. `accountStore`(계좌 선택), `currencyStore`(KRW/USD 토글 + 환율)
- **services/sheetsApi.ts**: GAS 통신 레이어. `gasGet`/`gasPost` 헬퍼 + `normalizeHoldings`/`normalizeDividends`로 데이터 정규화

### 배당 계산 핵심 로직 (dividendEstimator.ts)
- **calcAnnualYield**: TTM(Trailing 12 Month) 세후(×0.846) 배당수익률. `allDividends`(전체 2년 이력) 기반
- **generateEstimatedDividendsForYear**: 올해 데이터 없는 월은 작년 동월 기준 추정
- **연간 배당금**: 지난 달은 확정(actual), 안 지난 달은 예상(estimated). 모두 세후 적용

### GAS 파일 (gas/ - 로컬 기록용)
- **Code.gs**: 웹앱 엔드포인트 (doGet/doPost), 환율/현재가 조회
- **SheetsService.gs**: Sheets CRUD + deleteAccount/deleteHolding
- **DividendFetcher.gs**: Yahoo Finance 배당 수집 (US/KR 통합, KR은 .KS 접미사)
- **GeminiOcr.gs**: OpenAI GPT-5.4-mini OCR (증권사 캡처 → JSON 파싱)
- **Scheduler.gs**: 트리거 관리 (매일 09:00 배당 수집)

## 환경변수
`.env` 파일에 설정 (Git에서 제외됨):
```
VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/.../exec
```

## GAS 관련 주의사항
- `gas/` 폴더는 로컬 기록용. 실제 GAS는 Google Apps Script 에디터에서 관리
- GAS 코드 수정 후 반드시 **새 배포** 필요 (배포 → 배포 관리 → 새 버전)
- GAS 코드를 사용자에게 전달할 때 **마크다운에서 복사하면 따옴표 깨짐** → 로컬 파일에서 직접 복사 안내
- OpenAI 최신 모델은 `max_tokens` 대신 `max_completion_tokens` 파라미터 사용

## 스타일 컨벤션
- Tailwind CSS 4 (`@theme` 블록으로 커스텀 색상 정의, `src/index.css`)
- 다크 테마 전용: `dark-bg`, `dark-surface`, `dark-border`, `dark-text`, `dark-text-secondary`, `dark-text-muted`
- 금액 표시: `tabular-nums` 클래스 필수, `formatCurrency`/`useCurrency` 사용
- 카드: `Card` 컴포넌트 (bg-dark-surface, rounded-2xl, border)

## 알려진 한계
- Yahoo Finance interval=1mo → exDate가 항상 월 1일, payDate는 실제에 근접
- 같은 달 복수 배당(USHY 등) → 1건만 수집
- 세율 일괄 15.4% (실제 자본이득 분배는 비과세일 수 있음)
- 연간 배당 오차 약 3~5%
