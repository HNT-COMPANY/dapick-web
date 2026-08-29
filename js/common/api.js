//
// api.js — 다픽 웹 API 클라이언트
// BASE_URL은 config.js 박혀있으면 거기서 박음, 박지 않으면 자체 분기 박음
//

// ── BASE_URL 박음 (환경 자동 분기) ────────────────────────────────
const BASE_URL = (() => {
  // 1순위: config.js 박은 DAPICK_CONFIG 박음
  if (typeof DAPICK_CONFIG !== 'undefined' && DAPICK_CONFIG.API_BASE_URL) {
    return DAPICK_CONFIG.API_BASE_URL;
  }

  // 2순위 (fallback): config.js 박지 않은 페이지 박은 자체 분기 박음
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.endsWith('.local')
  ) {
    return 'http://localhost:8081'; // 로컬 개발 박음
  }
  return 'https://api.dapick.co.kr'; // 운영 박음 (Cloudflare Pages 박은 영역 포함)
})();

// dpLog 를 그냥 부르지 않는다. config.js 를 안 실은 화면이나
//   옛 config.js 가 캐시에 남은 브라우저에서 ReferenceError 가 난다.
//   로그 한 줄 때문에 그 뒤 코드가 통째로 안 도는 것이 훨씬 나쁘다.
var apiLog = (typeof dpLog === 'function') ? dpLog : function () {};
apiLog('[api] BASE_URL =', BASE_URL);

// ── 토큰 갱신 중복 방지 플래그 ───────────────────────────────────
// 여러 요청이 동시에 401 받아도 갱신은 한 번만 실행
let isRefreshing = false;
let refreshQueue = []; // 갱신 대기 중인 요청들

// ── 갱신 완료 후 대기 요청 일괄 처리 ────────────────────────────
function resolveQueue(newToken) {
  refreshQueue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

// ── Access Token 자동 갱신 (Silent Refresh) ──────────────────────
async function silentRefresh() {
  const refreshToken = localStorage.getItem('dapick_refresh');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error('refresh failed');

    const data = await res.json();
    const newAccessToken = data.accessToken ?? data.data?.accessToken;

    if (!newAccessToken) throw new Error('no access token');

    // 새 토큰 저장
    localStorage.setItem('dapick_token', newAccessToken);
    if (data.refreshToken) {
      localStorage.setItem('dapick_refresh', data.refreshToken);
    }

    return newAccessToken;
  } catch (e) {
    // Refresh Token도 만료 → 로그아웃 처리
    console.warn('[api] Refresh Token 만료 → 로그아웃');
    localStorage.removeItem('dapick_token');
    localStorage.removeItem('dapick_refresh');
    localStorage.removeItem('dapick_role');
    localStorage.removeItem('dapick_nick');
    alert('로그인 세션이 만료되었습니다.\n다시 로그인해주세요.');
    // 다시 로그인하면 보던 화면으로 돌아오게 한다 (auth.js)
    if (typeof saveReturnUrl === 'function') saveReturnUrl();
    window.location.href = '/login.html';
    return null;
  }
}

const api = {
  // ── 공통 요청 처리 (Silent Refresh 포함) ──────────────────────
  // opts.skipAuthRefresh=true 면 401 이 와도 silentRefresh 를 타지 않고
  // 백엔드 에러를 그대로 throw. 공개/미인증 엔드포인트(login, find-id,
  // password/reset/*)에서 사용 — 이들은 401=토큰만료가 아니라 비즈니스 에러.
  async request(method, path, body = null, retry = true, opts = {}) {
    const token = localStorage.getItem('dapick_token');

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body && { body: JSON.stringify(body) }),
    };

    const res = await fetch(`${BASE_URL}${path}`, options);

    // ── 401 응답 → Silent Refresh 시도 (skipAuthRefresh 면 건너뜀) ──
    if (res.status === 401 && retry && !opts.skipAuthRefresh) {
      // 이미 갱신 중이면 완료까지 대기
      if (isRefreshing) {
        await new Promise((resolve) => refreshQueue.push(resolve));
        // 새 토큰으로 원래 요청 재시도
        return api.request(method, path, body, false, opts);
      }

      // 갱신 시작
      isRefreshing = true;
      const newToken = await silentRefresh();
      isRefreshing = false;

      if (newToken) {
        resolveQueue(newToken);
        // 새 토큰으로 원래 요청 재시도 (retry=false 로 무한루프 방지)
        return api.request(method, path, body, false, opts);
      }

      return null; // 갱신 실패 시 (이미 로그인 페이지로 이동됨)
    }

    // ── 응답 파싱 (text 한 번만 읽고 JSON 파싱 시도) ─────────────
    // 빈 응답(403 등) 안전 처리: text가 비어있으면 data = null
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        /* 비-JSON 응답은 무시 */
      }
    }

    if (!res.ok) {
      const err = new Error((data && data.message) || `요청 실패 (${res.status})`);
      err.status = res.status; // 호출부에서 401/403 등 구분 가능 (하위호환: 기존은 e.message만 사용)
      throw err;
    }

    // 백엔드 응답 = ApiResponse 래퍼 박은 박음 = data.data 박음 추출, 박지 않으면 그대로 박음
    return data?.data ?? data;
  },

  // opts(예: {skipAuthRefresh:true})는 선택. 미전달 시 기존 동작 그대로(하위호환).
  get: (path, opts = {}) => api.request('GET', path, null, true, opts),
  post: (path, body, opts = {}) => api.request('POST', path, body, true, opts),
  put: (path, body, opts = {}) => api.request('PUT', path, body, true, opts),
  patch: (path, body, opts = {}) => api.request('PATCH', path, body, true, opts),
  delete: (path, opts = {}) => api.request('DELETE', path, null, true, opts),
};

// ── 상담 신청 API ──────────────────────────────────────────────
async function submitConsultApi(name, phone, summary) {
  // 추후 백엔드 Application API 연결
  // return await api.post('/api/applications', { name, phone, summary });
  apiLog('[API] 상담 신청:', { name, phone, summary });   // ⚠ 전화번호가 찍힌다. 운영에서는 조용해야 한다
}
