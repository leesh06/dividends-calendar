/** GAS 웹앱 URL (환경변수에서 가져옴) */
export const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_WEB_APP_URL || '';

/** 배당 뱃지 색상 */
export const BADGE_COLORS = {
  US: '#3B82F6',
  KR: '#10B981',
} as const;

/** 배당 상태별 opacity */
export const STATUS_OPACITY = {
  actual: 1,
  estimated: 0.5,
} as const;

/** 캐시 만료 시간 (밀리초) */
export const CACHE_TTL = {
  EXCHANGE_RATE: 60 * 60 * 1000,
  SHEETS_DATA: 30 * 60 * 1000,
} as const;

/** 하단 네비게이션 탭 정보 */
export const NAV_TABS = [
  { path: '/', label: '홈', icon: 'home' },
  { path: '/calendar', label: '캘린더', icon: 'calendar' },
  { path: '/capture', label: '캡처', icon: 'camera' },
  { path: '/settings', label: '설정', icon: 'settings' },
] as const;

/** 기본 설정값 */
export const DEFAULT_SETTINGS = {
  defaultCurrency: 'KRW',
  theme: 'light',
} as const;

/** 세후 배당 비율 (15.4% 세금) */
export const AFTER_TAX_RATE = 0.846;

/** OCR 신뢰도 임계값 */
export const OCR_CONFIDENCE = {
  HIGH: 80,
  MEDIUM: 50,
} as const;

/** 요일 라벨 */
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 월 라벨 */
export const MONTH_LABELS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
] as const;
