// api.js — 다픽 웹 백엔드 API 호출

// 로컬 개발: http://localhost:8081
// 운영 배포: https://api.dapick.co.kr
const BASE_URL = 'https://api.dapick.co.kr';

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
    window.location.href = '/login.html';
    return null;
  }
}

const api = {
  // ── 공통 요청 처리 (Silent Refresh 포함) ──────────────────────
  async request(method, path, body = null, retry = true) {
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

    // ── 401 응답 → Silent Refresh 시도 ─────────────────────────
    if (res.status === 401 && retry) {
      // 이미 갱신 중이면 완료까지 대기
      if (isRefreshing) {
        const newToken = await new Promise((resolve) =>
          refreshQueue.push(resolve),
        );
        // 새 토큰으로 원래 요청 재시도
        return api.request(method, path, body, false);
      }

      // 갱신 시작
      isRefreshing = true;
      const newToken = await silentRefresh();
      isRefreshing = false;

      if (newToken) {
        resolveQueue(newToken);
        // 새 토큰으로 원래 요청 재시도 (retry=false 로 무한루프 방지)
        return api.request(method, path, body, false);
      }

      return null; // 갱신 실패 시 (이미 로그인 페이지로 이동됨)
    }

    // ── 응답 파싱 ───────────────────────────────────────────────
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || '요청 실패');
    }

    return data.data ?? data;
  },

  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  put: (path, body) => api.request('PUT', path, body),
  patch: (path, body) => api.request('PATCH', path, body),
  delete: (path) => api.request('DELETE', path),
};

// ── 상담 신청 API ──────────────────────────────────────────────
async function submitConsultApi(name, phone, summary) {
  // 추후 백엔드 Application API 연결
  // return await api.post('/api/applications', { name, phone, summary });
  console.log('[API] 상담 신청:', { name, phone, summary });
}
