# 배당 캘린더 (Dividends Calendar)

개인용 배당 캘린더 PWA 웹앱. 모바일 최적화, 다크 테마.

## 기술 스택
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Zustand + Recharts
- **Backend/DB**: Google Sheets + Google Apps Script (웹앱)
- **캡처 분석**: OpenAI GPT-4o-mini (GAS에서 호출)
- **배당/현재가/환율**: Yahoo Finance (GAS에서 호출)
- **배포**: Vercel (GitHub main 브랜치 자동 배포)

## 프로젝트 구조
```
src/
  pages/          # 4개 페이지 (Dashboard, Calendar, Capture, Settings)
  components/     # 페이지별 컴포넌트 + common
  hooks/          # useCurrency, useDividends, useExchangeRate, useHoldings
  services/       # sheetsApi (GAS 통신), exchangeApi
  stores/         # Zustand (accountStore, currencyStore, appStore)
  types/          # TypeScript 타입 정의
  utils/          # formatters, constants, dividendEstimator
gas/              # Google Apps Script 파일 (기록용, 실제는 GAS 에디터에서 관리)
```

## 개발 서버
```bash
npm run dev     # localhost:5173
```

## 빌드
```bash
npm run build   # tsc -b && vite build
```

## 환경변수
`.env` 파일에 설정 (Git에서 제외됨):
```
VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/.../exec
```

## GAS 관련 주의사항
- `gas/` 폴더는 로컬 기록용. 실제 GAS는 Google Apps Script 에디터에서 관리
- GAS 코드 수정 후 반드시 **새 배포** 필요 (배포 → 배포 관리 → 새 버전)
- GAS 코드를 사용자에게 전달할 때 **마크다운에서 복사하면 따옴표 깨짐** → 로컬 파일에서 직접 복사 안내

## 배당 데이터 흐름
1. Yahoo Finance에서 interval=1mo로 2년 배당 이력 수집 (GAS 트리거, 매일 09:00)
2. Google Sheets dividends 시트에 저장 (exDate, payDate, amount)
3. 앱에서 올해 데이터 표시 + 미발표 월은 전년 동월 기준 추정
4. 캘린더는 **payDate** 기준 표시 (실제 입금일에 가까움)
5. 배당 시트에 currency/status 컬럼 없음 → normalizeDividends에서 기본값 부여 (USD, actual)

## 알려진 한계
- Yahoo Finance interval=1mo → exDate가 항상 월 1일, payDate는 실제에 근접
- 같은 달 복수 배당(USHY 등) → 1건만 수집
- 세율 일괄 15.4% (실제 자본이득 분배는 비과세일 수 있음)
- 연간 배당 오차 약 3~5%
