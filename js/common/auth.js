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
