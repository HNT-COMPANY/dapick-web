//
// config.js — 환경별 전역 설정
// 모든 페이지에서 가장 먼저 로드되어야 합니다
//

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

// ── 개발용 로그 스위치 (2026-08-10 신설) ────────────────────
//
// 왜 만드나
//   운영 화면에서 F12 를 열면 우리가 찍어 둔 안내 로그가 줄줄이 나온다.
//   고객이 볼 일은 거의 없지만, 진짜 오류가 그 사이에 묻혀서 우리가 못 찾는다.
//   화면이 어디에 붙어 있는지(주소·포트)도 굳이 알려줄 필요가 없다.
//
// 켜는 법 — 주소 뒤에 ?debug=1 을 붙이거나, 콘솔에서 한 번만
//     localStorage.setItem('dapick_debug','1')
//   로컬(localhost·192.168.…)에서는 늘 켜져 있다.
//
// console.warn 과 console.error 는 절대 안 막는다.
//   그건 '고쳐야 할 것' 이라 눈에 띄어야 한다. 여기서 끄는 것은 log·info 뿐이다.
const DAPICK_DEBUG = (function () {
  try {
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' ||
        h.startsWith('192.168.') || h.startsWith('10.') || h.endsWith('.local')) return true;
    if (window.location.search.indexOf('debug=1') >= 0) return true;
    return window.localStorage && localStorage.getItem('dapick_debug') === '1';
  } catch (e) { return false; }
})();

// 개발용 안내. 운영에서는 조용하다.
window.dpLog = DAPICK_DEBUG ? console.log.bind(console) : function () {};
window.dpInfo = DAPICK_DEBUG ? console.info.bind(console) : function () {};

dpLog('[dapick] API_BASE_URL =', DAPICK_CONFIG.API_BASE_URL);
