# 배당 캘린더 PWA - API 및 기술 리서치

**작성일**: 2026-03-27
**대상**: 개인용 배당 캘린더 PWA (키움증권 미국 ETF + 삼성증권 한국 ETF)

---

## 1. 한국 ETF/종목 배당 데이터 소스

### 1.1 주요 데이터 소스

#### **공공 API 옵션**

##### 금융위원회 주식배당정보 API
- **URL**: https://www.data.go.kr/data/15043284/openapi.do
- **특징**:
  - 공공데이터포털에서 제공하는 공식 API
  - 배당기준일자, 현금배당지급일자, 배당금액 등 조회 가능
  - 데이터 갱신주기: 일 1회 (기준일자로부터 영업일 하루 뒤 오후 1시 이후 업데이트)
  - **무료**: 별도의 인증키 필요 없음 (공공데이터 공개 API)
- **장점**: 공식적이고 신뢰도 높음
- **단점**: 갱신 주기가 하루 늦음, 실시간성 없음

##### KRX 데이터마켓플레이스
- **URL**: https://data.krx.co.kr/
- **특징**:
  - 한국거래소 공식 데이터 제공 서비스
  - 시장정보, 공매도정보, 투자분석정보(SMILE) 등
  - ETF 상품 정보 포함
- **가격**: 일부는 무료, 일부는 유료
- **단점**: 회원가입 필요, 일부 기능은 유료화

##### 한국수출입은행 API
- **URL**: https://www.data.go.kr/data/15001145/openapi.do
- **특징**: 한국예탁결제원의 주식정보서비스 API
- **갱신주기**: 정기적 업데이트

##### KRX Open API
- **URL**: https://openapi.krx.co.kr/
- **특징**: 한국거래소에서 공식 제공하는 개발자용 API
- **가격**: 가입 필요 (확인 필요)

#### **권리행사정보 조회**

- **URL**: https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179
- **출처**: 한국예탁결제원(SEIBRO)
- **특징**: 분배금지급현황 등 권리행사 정보 직접 조회 가능
- **방식**: 웹 스크래핑 필요

### 1.2 파이썬 라이브러리 옵션

#### **PyKRX**
- **GitHub**: https://github.com/sharebook-kr/pykrx
- **특징**:
  - KRX 데이터를 Python에서 쉽게 조회
  - ETF 거래량, 거래대금 정보 조회 가능
  - `get_index_fundamental()` 함수로 PER/PBR/배당수익률 조회
- **장점**: Python 개발자 친화적
- **단점**: 배당금 정확한 지급액보다는 수익률 정보 위주

#### **한국투자증권 Open API**
- **URL**: https://apiportal.koreainvestment.com/apiservice
- **GitHub**: https://github.com/Soju06/python-kis
- **특징**:
  - 증권사 공식 API
  - 시장 데이터, 종목 정보 조회 가능
  - Python 래퍼 라이브러리 제공
- **장점**: 공식 지원, 신뢰도 높음
- **단점**: 계좌 인증 필요 (키움증권이 아님)

### 1.3 웹 스크래핑 방식

#### **네이버금융**
- 직접 크롤링 방식 (Puppeteer, Playwright 등)
- 터미널 기반 검색 필요
- CORS 제약 없음 (서버에서만 가능)

#### **한국예탁결제원 (SEIBRO)**
- 분배금지급현황 페이지에서 직접 스크래핑 가능
- 공식 데이터 출처

### 1.4 권장 방법

**단기(MVP)**: 금융위원회 주식배당정보 API + PyKRX 조합
- 공공 API로 기본 정보 획득
- PyKRX로 실시간 거래 정보 보완

**장기**: KRX Open API + 한국투자증권 Open API 통합
- 더 정확한 데이터 수집
- 실시간성 향상

---

## 2. 미국 ETF 배당 데이터 소스

### 2.1 주요 무료 API 옵션

#### **yfinance (권장)**
- **GitHub**: https://github.com/ranaroussi/yfinance
- **특징**:
  - Yahoo Finance 데이터를 Python에서 액세스
  - 공식 API는 2017년 중단되었으나, yfinance가 비공식 대안으로 널리 사용
  - ETF 배당 이력, 분할 정보 등 조회 가능
  - 무료, 제한 없음
- **사용 예시**:
  ```python
  import yfinance as yf
  etf = yf.Ticker("VTI")
  print(etf.dividends)  # 배당 이력 조회
  print(etf.info)  # ETF 기본 정보
  ```
- **장점**: 간편하고 신뢰도 높음
- **단점**: 비공식 API이므로 언제든 중단될 가능성

#### **EODHD (End-of-Day Historical Data)**
- **URL**: https://eodhd.com/
- **특징**:
  - 무료 플랜: 1년치 배당 이력 데이터
  - 10,000개 이상의 ETF 데이터 지원
  - API 기반 접근 (REST)
- **가격**: 무료 플랜 제공
- **링크**: https://eodhd.com/financial-apis/api-splits-dividends

#### **Finnhub**
- **URL**: https://finnhub.io/
- **문서**: https://finnhub.io/docs/api/stock-dividends
- **특징**:
  - 실시간 주가, 회사 기본 정보, 경제 데이터 등
  - ETF 배당 조회 API 제공
  - 무료 플랜 지원
- **요청 제한**: 무료 플랜의 경우 확인 필요

#### **Alpha Vantage**
- **URL**: https://www.alphavantage.co/
- **특징**:
  - 주가, ETF, 뮤추얼펀드 데이터
  - 무료 API 지원
  - JSON 형식 응답
- **요청 제한**: 분당 요청 제한 있음

#### **Financial Modeling Prep (FMP)**
- **URL**: https://site.financialmodelingprep.com/developer/docs
- **특징**:
  - ETF 심볼 검색 및 기본 정보
  - 무료 플랜 제공
  - 상세한 기본 정보 데이터

#### **Tiingo**
- **URL**: https://www.tiingo.com/products/corporate-actions/stock-etf-mutual-fund-dividend-api
- **특징**:
  - 주식, ETF, 뮤추얼펀드 배당 API
  - 무료 계정: 하루 1,000 API 요청
  - 배당 이력 정보 포함

### 2.2 API 엔드포인트 예시

#### **yfinance (Python)**
```python
import yfinance as yf

# VTI ETF 배당 이력 조회
etf = yf.Ticker("VTI")
dividends = etf.dividends
print(dividends)
# 출력 예시:
# 2023-03-10    0.82
# 2023-06-09    0.87
# 2023-09-08    0.91
```

#### **Finnhub REST API**
```
https://finnhub.io/api/v1/stock/dividend?symbol=VTI&token=YOUR_API_KEY
```

**응답 형식**:
```json
{
  "symbol": "VTI",
  "data": [
    {
      "exDate": "2023-03-10",
      "paymentDate": "2023-03-24",
      "recordDate": "2023-03-13",
      "amount": 0.82,
      "currency": "USD"
    }
  ]
}
```

#### **EODHD API**
```
https://eodhd.com/api/data-feeds/v1/splits-dividends?symbols=VTI&api_token=YOUR_API_KEY
```

### 2.3 권장 방법

**우선순위**:
1. **yfinance** (Python): 간편하고 무료, 신뢰도 높음
2. **EODHD**: API 기반, REST 호출 가능, 프리 플랜 제공
3. **Finnhub**: 다양한 데이터 제공, 구조화된 API

---

## 3. 실시간 환율 API

### 3.1 주요 환율 API

#### **Dunamu Forex API (권장)**
- **URL**: https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD
- **특징**:
  - Upbit에서 사용하는 환율 API
  - 실시간 환율 데이터
  - CORS 지원 (브라우저에서 직접 호출 가능)
  - 무료, 제한 없음
- **응답 형식**:
  ```json
  {
    "FRX.KRWUSD": {
      "change": 5,
      "changePercent": 0.37,
      "closePrice": 1350.5,
      "code": "FRX.KRWUSD",
      "openPrice": 1345.5,
      "prevClosePrice": 1345.5,
      "symbol": "KRW/USD"
    }
  }
  ```
- **호출 예시**:
  ```javascript
  fetch('https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD')
    .then(r => r.json())
    .then(data => console.log(data['FRX.KRWUSD'].closePrice))
  ```

#### **한국수출입은행 API**
- **URL**: https://www.data.go.kr/data/3068846/openapi.do
- **특징**:
  - 공공데이터포털에서 제공
  - 공식 환율 정보
  - API 키 필요
  - CORS 정보 확인 필요
- **갱신 주기**: 일 1회 (오후 중 업데이트)

#### **한국은행 ECOS API**
- **URL**: https://ecos.bok.or.kr/api/
- **특징**:
  - 한국은행 공식 API
  - 원/달러, 원/엔, 원/유로 등 다양한 환율
  - 무료 (인증키 필요)
  - CORS 정보 확인 필요
- **회원가입**: 자동으로 인증키 부여됨 (일반적으로 1일 이내 활성화)

#### **Exchange API (Shin-JaeHeon)**
- **URL**: https://jaeheon.kr/12
- **특징**:
  - Yahoo Finance 기반
  - 다양한 통화 쌍 지원
  - 무료

### 3.2 권장 방법

**브라우저 PWA 환경**:
- **Dunamu Forex API** (첫 번째 선택)
  - CORS 지원으로 브라우저에서 직접 호출 가능
  - 무료, 제한 없음
  - 실시간 데이터

**백엔드 지원 시**:
- **한국은행 ECOS API** (두 번째 선택)
  - 더 신뢰도 높음
  - 공식 정보

**폴백 방식**:
- Dunamu 호출 실패 시 한국수출입은행 API로 대체

---

## 4. 브라우저 OCR 솔루션

### 4.1 Tesseract.js

#### **기본 정보**
- **GitHub**: https://github.com/naptha/tesseract.js
- **특징**:
  - 100개 이상의 언어 지원 (한국어 포함)
  - 순수 JavaScript, 브라우저에서 직접 실행 가능
  - 무료, 오픈소스
  - 서버 요청 불필요

#### **한국어 인식 성능**
- **인식률**: 일반적으로 80% 전후
- **문제점**:
  - 한글용 학습 데이터 부족
  - 한글 + 영어 + 숫자 혼합 구간에서 오류 증가
  - 저품질 이미지에서 성능 급격히 하락
- **개선 방법**:
  - 이미지 전처리 (노이즈 제거, 명도 조절, 회전 보정)
  - 커스텀 학습 데이터 추가 (고급)

#### **사용 예시**
```javascript
import Tesseract from 'tesseract.js';

const worker = await Tesseract.createWorker('kor');
const { data: { text } } = await worker.recognize('image.png');
console.log(text);
await worker.terminate();
```

#### **장점**
- 무료, 오픈소스
- 브라우저에서 서버 요청 없이 실행
- 프라이버시 보호 (데이터가 로컬에서만 처리)

#### **단점**
- 한국어 인식률이 완벽하지 않음
- 처리 시간이 길 수 있음 (CPU 기반 처리)
- 복잡한 레이아웃 인식 어려움

### 4.2 Google Cloud Vision API

#### **기본 정보**
- **URL**: https://cloud.google.com/vision
- **문서**: https://docs.cloud.google.com/vision/docs
- **특징**:
  - Google의 고급 머신러닝 기반 OCR
  - 한국어 완벽 지원
  - 고정확도, 고급 이미지 분석 기능

#### **가격**
- **무료**: 월 1,000 유닛까지 무료
- **유료**: $1.50/1,000 유닛 (1,001~5,000,000), $0.60/1,000 유닛 (5,000,001+)
- **신규 고객**: $300 무료 크레딧 제공
- **1,000 유닛 = 약 100장의 문서 페이지**

#### **한국어 지원 언어**
- Chinese (Simplified), English, French, German, Italian, Japanese, **Korean**, Portuguese, Spanish

#### **사용 시나리오**
- Tesseract.js로 1차 인식 후 신뢰도가 낮으면 Google Cloud Vision 활용
- 중요한 거래 데이터의 정확한 인식 필요 시

#### **장점**
- 매우 높은 인식률 (95% 이상)
- 한국어 완벽 지원
- 복잡한 레이아웃 인식 가능
- 텍스트 방향, 필기체 등도 인식

#### **단점**
- 유료 (월 1,000 이상 사용 시)
- Google 계정 및 결제 정보 필요
- 클라우드 업로드 필요 (프라이버시 고려)
- 네트워크 지연 가능

### 4.3 기타 OCR 옵션

#### **Microsoft Azure Computer Vision API**
- 유사한 가격대, Google Vision과 비슷한 성능
- CORS 지원 여부 확인 필요

#### **AWS Textract**
- 엔터프라이즈급 OCR
- 비싼 가격대 (최초 1,000 페이지 이후 고가)

### 4.4 권장 방법

**하이브리드 방식 (권장)**:

```
증권사 캡처 이미지
    ↓
[1단계] Tesseract.js로 1차 인식
    ↓
신뢰도 판정
    ├─ 높음 (80% 이상) → 결과 사용
    ├─ 중간 (50~80%) → 사용자 수정 UI 제공
    └─ 낮음 (50% 이하) → Google Cloud Vision으로 2차 인식
```

**단계별 구현**:
1. **MVP**: Tesseract.js만 사용 (기본 템플릿 인식)
2. **1.0**: Tesseract.js + 신뢰도 표시
3. **Pro**: Tesseract.js + Google Cloud Vision 하이브리드

---

## 5. 실제 사용 가능한 무료 API 엔드포인트 정리

### 5.1 한국 배당 데이터

| API | 엔드포인트 | 무료 | CORS | 설명 |
|-----|-----------|------|------|------|
| 금융위원회 API | `https://www.data.go.kr/data/15043284/openapi.do` | O | X | 공식 배당 정보, 일 1회 갱신 |
| KRX Open API | `https://openapi.krx.co.kr/` | △ | X | 회원가입 필요 |
| PyKRX | GitHub | O | - | Python 라이브러리 |

### 5.2 미국 배당 데이터

| API | 엔드포인트 | 무료 | CORS | 설명 |
|-----|-----------|------|------|------|
| yfinance | Python 라이브러리 | O | - | Python 기반, 권장 |
| EODHD | `https://eodhd.com/api/data-feeds/v1/splits-dividends` | O | △ | REST API, 1년 이력 |
| Finnhub | `https://finnhub.io/api/v1/stock/dividend` | O | O | 구조화된 응답 |
| Alpha Vantage | JSON 기반 | O | △ | 분당 요청 제한 |

### 5.3 환율

| API | 엔드포인트 | 무료 | CORS | 응답 속도 |
|-----|-----------|------|------|---------|
| Dunamu (권장) | `https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD` | O | O | 매우 빠름 |
| 한국수출입은행 | `https://www.data.go.kr/data/3068846/openapi.do` | O | ? | 보통 |
| 한국은행 ECOS | `https://ecos.bok.or.kr/api/` | O | ? | 보통 |

### 5.4 OCR

| 솔루션 | 비용 | 한글 인식 | 위치 | 권장 용도 |
|--------|------|---------|------|---------|
| Tesseract.js | 무료 | 80% | 브라우저 | MVP, 기본 인식 |
| Google Cloud Vision | $1.50/1K units | 95%+ | 클라우드 | 정확한 인식 필요 시 |

---

## 6. 아키텍처 권장안

### 6.1 데이터 수집 플로우

```
┌─────────────────────────────────────────┐
│      배당 캘린더 PWA                     │
└─────────────────────────────────────────┘
           ↓
   ┌───────┴────────┐
   │                │
┌──▼────────┐  ┌───▼──────────┐
│ 미국 ETF   │  │ 한국 ETF     │
└──┬────────┘  └───┬──────────┘
   │                │
   ▼                ▼
┌────────────────────────────┐
│  yfinance (Python)         │
│  배당 이력 + 현재 정보     │
└────────────────────────────┘

┌────────────────────────────┐
│  금융위원회 API            │
│  한국 배당 데이터          │
└────────────────────────────┘

   ↓    모든 데이터 통합    ↓

┌────────────────────────────┐
│  Google Sheets             │
│  (데이터베이스)             │
└────────────────────────────┘

   ↓    조회 + 계산    ↓

┌────────────────────────────┐
│  React 프론트엔드          │
│  - 배당 캘린더 UI          │
│  - 환율 토글 (Dunamu API)  │
│  - 차트 시각화             │
└────────────────────────────┘
```

### 6.2 OCR 처리 플로우

```
캡처 이미지 업로드
    ↓
[Tesseract.js 1차 인식]
    ↓
신뢰도 90% 이상? → Yes → 자동 저장
    ↓ No
신뢰도 70% 이상? → Yes → 사용자 수동 수정 UI
    ↓ No
[Google Cloud Vision 2차 인식] (선택사항)
    ↓
최종 결과 저장
```

---

## 7. 개발 로드맵

### Phase 1: MVP (2주)
- [ ] Dunamu API로 환율 기능 구현
- [ ] yfinance + 금융위원회 API로 배당 데이터 수집
- [ ] Tesseract.js로 기본 OCR 구현
- [ ] Google Sheets에 데이터 저장

### Phase 2: 1.0 (1주)
- [ ] Google Cloud Vision API 통합
- [ ] 배당 캘린더 UI 완성
- [ ] 차트 시각화 추가
- [ ] PWA 최적화

### Phase 3: Pro (향후)
- [ ] 실시간 배당 알림
- [ ] 포트폴리오 분석 대시보드
- [ ] 자동 거래 기록

---

## 참고 자료

### 한국 배당 데이터
- [KRX API로 국내 상장 ETF 데이터 불러오는 법](https://velog.io/@pys573/KRX-API%EB%A1%9C-%EA%B5%AD%EB%82%B4-%EC%83%81%EC%9E%A5-ETF-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%B6%88%EB%9F%AC%EC%98%A4%EB%8A%94-%EB%B2%95)
- [KRX Data Marketplace](https://data.krx.co.kr/contents/MDC/MAIN/main/index.cmd)
- [PyKRX - GitHub](https://github.com/sharebook-kr/pykrx)
- [금융위원회 주식배당정보 API](https://www.data.go.kr/data/15043284/openapi.do)
- [KRX 분배금지급현황](https://seibro.or.kr/websquare/control.jsp?w2xPath=/IPORTAL/user/etf/BIP_CNTS06030V.xml&menuNo=179)

### 미국 배당 데이터
- [yfinance GitHub](https://github.com/ranaroussi/yfinance)
- [yfinance 사용법 가이드](https://wikidocs.net/230307)
- [Finnhub API 문서](https://finnhub.io/docs/api/stock-dividends)
- [EODHD API](https://eodhd.com/financial-apis/api-splits-dividends)
- [Alpha Vantage](https://www.alphavantage.co/)

### 환율 API
- [무료 환율 API 공개](https://shin-jaeheon.github.io/article/2018/02/01/free-exchange-api/)
- [한국수출입은행 환율 API](https://www.data.go.kr/data/3068846/openapi.do)
- [한국은행 ECOS API](https://ecos.bok.or.kr/api/)

### OCR
- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js/)
- [Tesseract OCR과 인식률](https://velog.io/@agugu95/Tesseract-OCR)
- [Google Cloud Vision API 가격](https://cloud.google.com/vision/pricing)
- [Google Cloud Vision 문서](https://docs.cloud.google.com/vision/docs)
- [Tesseract.js를 통한 한글 텍스트 추출](https://velog.io/@imphj3/JavaScript-tesseract.js%EB%A5%BC-%ED%86%B5%ED%95%B4-%EC%9D%B4%EB%AF%B8%EC%A7%80-%ED%95%9C%EA%B8%80-%ED%85%8D%EC%8A%A4%ED%8A%B8-%EC%B6%94%EC%B6%9C%ED%95%98%EA%B8%B0)

---

**작성자**: 리서처 에이전트
**최종 검토일**: 2026-03-27
