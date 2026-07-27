// ============================================================
// auth.js - dapick web auth manager
// ------------------------------------------------------------
// Responsibility: token save/clear, login state, token refresh.
// GNB rendering is handled by gnb-user.js (separation of concerns).
//
// status: User account status ('PENDING_PROFILE' | 'ACTIVE' | ...)
//   - PENDING_PROFILE: Kakao auth done but extra info not filled.
//     Must complete signup before using the site.
//   - isPending() is the single source of truth used by the
//     page guard (gnb-user.js) and the login modal (login.js).
// ============================================================

const TOKEN_KEY = 'dapick_token';
const REFRESH_KEY = 'dapick_refresh';
const ROLE_KEY = 'dapick_role';
const NICK_KEY = 'dapick_nick';
const STATUS_KEY = 'dapick_status';

// -- save tokens -------------------------------------------------
// status added (5th param). Optional so existing 4-arg calls still work,
// but Kakao callback / email login should pass it.
function saveTokens(accessToken, refreshToken, role, nickname, status) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  if (role) localStorage.setItem(ROLE_KEY, role);
  if (nickname) localStorage.setItem(NICK_KEY, nickname);
  if (status) localStorage.setItem(STATUS_KEY, status);
}

// -- clear tokens (logout) ---------------------------------------
function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NICK_KEY);
  localStorage.removeItem(STATUS_KEY);
}

// -- login state -------------------------------------------------
function isLoggedIn() {
  return !!localStorage.getItem(TOKEN_KEY);
}

// -- current role ------------------------------------------------
function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

// -- admin check -------------------------------------------------
function isAdmin() {
  return getRole() === 'LV4_ADMIN';
}

// -- current status ----------------------------------------------
function getStatus() {
  return localStorage.getItem(STATUS_KEY);
}

// -- pending check (signup not completed) ------------------------
// True only when logged in AND status is PENDING_PROFILE.
// Used to lock the user into the signup modal everywhere.
function isPending() {
  return isLoggedIn() && getStatus() === 'PENDING_PROFILE';
}

// -- mark active (call after complete-signup succeeds) -----------
// Lifts the pending lock immediately without needing a re-login.
function markActive() {
  localStorage.setItem(STATUS_KEY, 'ACTIVE');
}

// ================================================================
// 로그인 후 복귀 경로
// ----------------------------------------------------------------
// 로그인을 요구하는 지점이 사이트 곳곳에 흩어져 있는데(찜·후기·문의·
// 마이페이지·세션만료 등) 대부분 현재 위치를 안 남기고 /login 으로만
// 보냈다. 그래서 로그인하면 전부 홈으로 떨어졌다.
// 저장과 복원을 여기 한 곳으로 모은다.
//   보내기 전:  saveReturnUrl()
//   로그인 후:  takeReturnUrl() || 'index.html'
// ================================================================
const RETURN_KEY = 'redirect_after_login';

// 같은 사이트 안의 경로인가.
//  - '//evil.com' / '/\evil.com' 은 브라우저가 외부 주소로 읽는다(오픈 리다이렉트)
//  - 'http://…' 같은 절대 주소도 막는다
//  - 로그인·가입 페이지로 돌려보내면 무한 루프가 된다
function isSafeReturnUrl(u) {
  if (typeof u !== 'string' || u.charAt(0) !== '/') return false;
  if (u.charAt(1) === '/' || u.charAt(1) === '\\') return false;
  const path = u.split('?')[0].split('#')[0];
  return !/^\/(login|signup)(\.html)?$/.test(path);
}

// 로그인 페이지로 보내기 직전에 부른다. 인자 없으면 지금 페이지.
function saveReturnUrl(url) {
  try {
    const target =
      url ||
      window.location.pathname + window.location.search + window.location.hash;
    if (!isSafeReturnUrl(target)) return;
    sessionStorage.setItem(RETURN_KEY, target);
  } catch (e) {
    // 시크릿 모드 등에서 sessionStorage 가 막힐 수 있다.
    // 복귀를 못 해도 로그인 자체는 되어야 하므로 삼킨다.
  }
}

// 로그인 성공 뒤 한 번만 꺼내 쓴다(읽으면 지운다).
// 저장 후에 값이 변조됐을 수도 있으니 꺼낼 때 한 번 더 검사한다.
function takeReturnUrl() {
  try {
    const u = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return isSafeReturnUrl(u) ? u : null;
  } catch (e) {
    return null;
  }
}

// -- logout ------------------------------------------------------
async function logout() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    try {
      await api.post('/api/auth/logout', null);
    } catch (e) {
      console.warn('[auth] logout API failed:', e.message);
    }
  }
  clearTokens();
  window.location.href = 'index.html';
}

// -- access token refresh ----------------------------------------
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
    console.warn('[auth] token refresh failed:', e.message);
  }
  clearTokens();
  return null;
}
