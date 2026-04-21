// ════════════════════════════════════════════════════
// config.js — 환경별 전역 설정
// 모든 페이지에서 가장 먼저 로드되어야 합니다
// ════════════════════════════════════════════════════

const DAPICK_CONFIG = {
  // API 베이스 URL — hostname 기반 자동 분기
  API_BASE_URL: (() => {
    const host = window.location.hostname;

    // 로컬 개발 환경
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.endsWith('.local')
    ) {
      return 'http://localhost:8081';
    }

    // Cloudflare Pages 프리뷰 (dapick-web.pages.dev)
    if (host.endsWith('.pages.dev')) {
      return 'https://api.dapick.co.kr';
    }

    // 운영 (dapick.co.kr)
    return 'https://api.dapick.co.kr';
  })(),

  // API 요청 공통 옵션
  DEFAULT_FETCH_OPTIONS: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
};

// 디버그용 로그 (운영에서도 환경 확인 가능)
console.log('[dapick] API_BASE_URL =', DAPICK_CONFIG.API_BASE_URL);
