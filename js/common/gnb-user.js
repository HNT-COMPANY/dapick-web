// ============================================================
// gnb-user.js - GNB right-side user dropdown + PENDING guard
// ------------------------------------------------------------
// 5/30: GNB 우상단 버튼 라벨 "OO 님" → "마이페이지" (드롭다운 유지)
//   - 드롭다운 패널 헤더에는 닉네임 유지(인사용)
// ------------------------------------------------------------
// Responsibilities:
//   1) PENDING guard
//   2) Render GNB right area by login state.
// Depends on: auth.js (isLoggedIn, isAdmin, isPending, logout)
// localStorage keys: dapick_token / dapick_nick / dapick_role / dapick_status
// ============================================================

(function () {
  'use strict';

  function isLoginPage() {
    var path = window.location.pathname;
    return /(^|\/)login\.html$/.test(path) || path === '/login';
  }

  function enforcePendingGuard() {
    var pending =
      typeof isPending === 'function'
        ? isPending()
        : localStorage.getItem('dapick_token') &&
          localStorage.getItem('dapick_status') === 'PENDING_PROFILE';

    if (pending && !isLoginPage()) {
      window.location.replace('login.html');
      return true;
    }
    return false;
  }

  function cleanNickname(raw) {
    if (!raw) return '\uD68C\uC6D0';
    return raw.replace(/_[0-9]{4}$/, '').replace(/\s+/g, '');
  }

  function goMypage() {
    window.location.href = 'mypage.html';
  }

  function goDashboard() {
    window.location.href = 'dashboard.html';
  }

  function handleLogout() {
    if (typeof logout === 'function') {
      logout();
    } else {
      localStorage.removeItem('dapick_token');
      localStorage.removeItem('dapick_refresh');
      localStorage.removeItem('dapick_role');
      localStorage.removeItem('dapick_nick');
      localStorage.removeItem('dapick_status');
      window.location.href = 'index.html';
    }
  }

  function toggleDrop(e) {
    e.stopPropagation();
    var drop = document.getElementById('gnbUserDrop');
    if (drop) drop.classList.toggle('is-open');
  }

  function setupOutsideClick() {
    document.addEventListener('click', function () {
      var drop = document.getElementById('gnbUserDrop');
      if (drop && drop.classList.contains('is-open')) {
        drop.classList.remove('is-open');
      }
    });
  }

  function setupEscapeKey() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var drop = document.getElementById('gnbUserDrop');
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

  function renderLoginButton() {
    var gnbRight = document.querySelector('.gnb-right');
    if (!gnbRight) return;

    gnbRight.innerHTML =
      '<button class="btn-login" type="button" onclick="window.location.href=\'login.html\'">' +
      '\uB85C\uADF8\uC778/\uD68C\uC6D0\uAC00\uC785' +
      '</button>';
  }

  function renderUserDrop(nickname, isAdminUser) {
    var gnbRight = document.querySelector('.gnb-right');
    if (!gnbRight) return;

    var cleanName = escapeHtml(cleanNickname(nickname));
    var adminLink = isAdminUser
      ? '<button class="gnb-user-link gnb-user-link--admin" type="button" data-action="dashboard">' +
        '<span>\uD83D\uDEE1\uFE0F \uC5B4\uB4DC\uBBF8\uB9AC \uB300\uC2DC\uBCF4\uB4DC</span>' +
        '<span class="gnb-user-arrow-r">\u203A</span>' +
        '</button>'
      : '';

    // 우상단 버튼 라벨: "마이페이지" (드롭다운 토글)
    gnbRight.innerHTML =
      '<div class="gnb-user" id="gnbUserDrop">' +
      '<button class="gnb-user-btn" type="button">' +
      '<span class="gnb-user-name">\uB9C8\uC774\uD398\uC774\uC9C0</span>' +
      '<span class="gnb-user-arrow">\u25BE</span>' +
      '</button>' +
      '<div class="gnb-user-panel">' +
      '<div class="gnb-user-panel-head">' +
      '<span class="gnb-user-panel-name">' +
      cleanName +
      ' \uB2D8</span>' +
      '</div>' +
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">\uD83D\uDCB0 \uC6D4\uB81B</div>' +
      '<div class="gnb-user-row">' +
      '<span>\uB2E4\uD53D \uD3EC\uC778\uD2B8</span>' +
      '<strong>0P</strong>' +
      '</div>' +
      '</div>' +
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">\u2699\uFE0F \uACC4\uC815</div>' +
      '<button class="gnb-user-link" type="button" data-action="mypage">' +
      '<span>\uB9C8\uC774\uD398\uC774\uC9C0</span>' +
      '<span class="gnb-user-arrow-r">\u203A</span>' +
      '</button>' +
      adminLink +
      '</div>' +
      '<div class="gnb-user-foot">' +
      '<button class="gnb-user-logout" type="button" data-action="logout">' +
      '\uB85C\uADF8\uC544\uC6C3' +
      '</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    var btn = gnbRight.querySelector('.gnb-user-btn');
    if (btn) btn.addEventListener('click', toggleDrop);

    gnbRight.querySelectorAll('.gnb-user-link').forEach(function (linkBtn) {
      linkBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = linkBtn.dataset.action;
        if (action === 'mypage') goMypage();
        if (action === 'dashboard') goDashboard();
      });
    });

    var logoutBtn = gnbRight.querySelector('.gnb-user-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        handleLogout();
      });
    }
  }

  function init() {
    if (enforcePendingGuard()) return;

    var gnbRight = document.querySelector('.gnb-right');
    if (!gnbRight) return;

    var loggedIn =
      typeof isLoggedIn === 'function'
        ? isLoggedIn()
        : !!localStorage.getItem('dapick_token');

    if (!loggedIn) {
      renderLoginButton();
      return;
    }

    var nickname = localStorage.getItem('dapick_nick');
    var adminUser =
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
