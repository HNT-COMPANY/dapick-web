// auth.js — 다픽 웹 인증 관리
// 토큰 저장/삭제, 로그인 상태 확인, GNB 렌더링 담당

const TOKEN_KEY = 'dapick_token';
const REFRESH_KEY = 'dapick_refresh';
const ROLE_KEY = 'dapick_role';
const NICK_KEY = 'dapick_nick';

// ── 토큰 저장 ────────────────────────────────────────────────────
function saveTokens(accessToken, refreshToken, role, nickname) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  if (role) localStorage.setItem(ROLE_KEY, role);
  if (nickname) localStorage.setItem(NICK_KEY, nickname);
}

// ── 토큰 삭제 (로그아웃) ─────────────────────────────────────────
function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NICK_KEY);
}

// ── 로그인 여부 확인 ─────────────────────────────────────────────
function isLoggedIn() {
  return !!localStorage.getItem(TOKEN_KEY);
}

// ── 현재 역할 반환 ───────────────────────────────────────────────
function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

// ── 어드민 여부 확인 ─────────────────────────────────────────────
function isAdmin() {
  return getRole() === 'LV4_ADMIN';
}

// ── 로그아웃 ─────────────────────────────────────────────────────
async function logout() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    try {
      await api.post('/api/auth/logout', null);
    } catch (e) {
      console.warn('[auth] 로그아웃 API 실패:', e.message);
    }
  }
  clearTokens();
  window.location.href = 'login.html';
}

// ── Access Token 갱신 ────────────────────────────────────────────
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) {
    clearTokens();
    return null;
  }
  try {
    const data = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).then((r) => r.json());

    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
      return data.accessToken;
    }
  } catch (e) {
    console.warn('[auth] 토큰 갱신 실패:', e.message);
  }
  clearTokens();
  return null;
}

// ── GNB 로그인/로그아웃 버튼 렌더링 ─────────────────────────────
// GNB가 없는 페이지(login.html 등)에서는 실행 안 함
function renderGnbAuth() {
  const gnbRight = document.querySelector('.gnb-right');
  if (!gnbRight) return; // [수정] GNB 없는 페이지 안전 처리

  if (isLoggedIn()) {
    const nick = localStorage.getItem(NICK_KEY) || '사용자';
    gnbRight.innerHTML = `
      <span style="font-size:13px;color:var(--text-sub);font-weight:500;">${nick}님</span>
      ${isAdmin() ? '<a href="dashboard.html" style="font-size:13px;color:var(--purple);font-weight:600;text-decoration:none;">어드민</a>' : ''}
      <button class="btn-login" onclick="logout()">로그아웃</button>
    `;
  } else {
    gnbRight.innerHTML = `
      <button class="btn-login" onclick="window.location.href='login.html'">로그인/회원가입</button>
    `;
  }
}

// ── 자동 실행 ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderGnbAuth();
});
