// ════════════════════════════════════════════════════════
// gnb-user.js — GNB 우측 사용자 드롭
// ────────────────────────────────────────────────────────
// 책임: GNB 우측 영역 렌더링 (로그인 상태별 분기)
// 의존:
//   - auth.js 의 isLoggedIn(), isAdmin(), logout()
//   - localStorage 키: dapick_token / dapick_nick / dapick_role
// ════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 카카오 닉네임 _xxxx 부분 제거 (e.g. "지혁_5891" → "지혁")
  function cleanNickname(raw) {
    if (!raw) return '회원';
    return raw.replace(/_[0-9]{4}$/, '').replace(/\s+/g, '');
  }

  function goMypage() {
    window.location.href = 'mypage.html';
  }

  function goDashboard() {
    window.location.href = 'dashboard.html';
  }

  // 로그아웃 — auth.js의 logout() 호출
  function handleLogout() {
    if (typeof logout === 'function') {
      logout();
    } else {
      localStorage.removeItem('dapick_token');
      localStorage.removeItem('dapick_refresh');
      localStorage.removeItem('dapick_role');
      localStorage.removeItem('dapick_nick');
      window.location.href = 'index.html';
    }
  }

  function toggleDrop(e) {
    e.stopPropagation();
    const drop = document.getElementById('gnbUserDrop');
    if (drop) drop.classList.toggle('is-open');
  }

  function setupOutsideClick() {
    document.addEventListener('click', () => {
      const drop = document.getElementById('gnbUserDrop');
      if (drop && drop.classList.contains('is-open')) {
        drop.classList.remove('is-open');
      }
    });
  }

  function setupEscapeKey() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const drop = document.getElementById('gnbUserDrop');
        if (drop) drop.classList.remove('is-open');
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 비로그인 GNB
  function renderLoginButton() {
    const gnbRight = document.querySelector('.gnb-right');
    if (!gnbRight) return;

    gnbRight.innerHTML = `
      <button class="btn-login" type="button" onclick="window.location.href='login.html'">
        로그인/회원가입
      </button>
    `;
  }

  function renderUserDrop(nickname, isAdminUser) {
    const gnbRight = document.querySelector('.gnb-right');
    if (!gnbRight) return;

    const cleanName = escapeHtml(cleanNickname(nickname));
    const adminLink = isAdminUser
      ? `
            <button class="gnb-user-link gnb-user-link--admin" type="button" data-action="dashboard">
              <span>🛡️ 어드민 대시보드</span>
              <span class="gnb-user-arrow-r">›</span>
            </button>`
      : '';

    gnbRight.innerHTML = `
      <div class="gnb-user" id="gnbUserDrop">
        <button class="gnb-user-btn" type="button">
          <span class="gnb-user-name">${cleanName} 님</span>
          <span class="gnb-user-arrow">▾</span>
        </button>
        <div class="gnb-user-panel">
          <div class="gnb-user-panel-head">
            <span class="gnb-user-panel-name">${cleanName} 님</span>
          </div>
          <div class="gnb-user-section">
            <div class="gnb-user-section-title">💰 월렛</div>
            <div class="gnb-user-row">
              <span>다픽 포인트</span>
              <strong>0P</strong>
            </div>
          </div>
          <div class="gnb-user-section">
            <div class="gnb-user-section-title">⚙️ 계정</div>
            <button class="gnb-user-link" type="button" data-action="mypage">
              <span>마이페이지</span>
              <span class="gnb-user-arrow-r">›</span>
            </button>${adminLink}
          </div>
          <div class="gnb-user-foot">
            <button class="gnb-user-logout" type="button" data-action="logout">
              로그아웃
            </button>
          </div>
        </div>
      </div>
    `;

    // 이벤트 박음
    const btn = gnbRight.querySelector('.gnb-user-btn');
    if (btn) btn.addEventListener('click', toggleDrop);

    gnbRight.querySelectorAll('.gnb-user-link').forEach((linkBtn) => {
      linkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = linkBtn.dataset.action;
        if (action === 'mypage') goMypage();
        if (action === 'dashboard') goDashboard();
      });
    });

    const logoutBtn = gnbRight.querySelector('.gnb-user-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleLogout();
      });
    }
  }

  function init() {
    const gnbRight = document.querySelector('.gnb-right');
    if (!gnbRight) return;

    const loggedIn =
      typeof isLoggedIn === 'function'
        ? isLoggedIn()
        : !!localStorage.getItem('dapick_token');

    if (!loggedIn) {
      renderLoginButton();
      return;
    }

    const nickname = localStorage.getItem('dapick_nick');
    const adminUser =
      typeof isAdmin === 'function'
        ? isAdmin()
        : localStorage.getItem('dapick_role') === 'LV4_ADMIN';

    renderUserDrop(nickname, adminUser);
    setupOutsideClick();
    setupEscapeKey();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
