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
      // \uC54C\uB9BC \uBCA8 (\uC900\uBE44\uC911 \u2014 \uBC43\uC9C0 \uC790\uB9AC\uB9CC \uD655\uBCF4, \uD074\uB9AD \uC2DC \uC548\uB0B4)
      '<button class="gnb-bell" type="button" aria-label="\uC54C\uB9BC" data-count="0">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span class="gnb-bell-badge" hidden></span>' +
      '</button>' +
      '<div class="gnb-user" id="gnbUserDrop">' +
      // \uD2B8\uB9AC\uAC70: \uC0AC\uB78C \uC544\uC774\uCF58 + \uB2C9\uB124\uC784 + \u25BE
      '<button class="gnb-user-btn" type="button">' +
      '<span class="gnb-user-btn-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg></span>' +
      '<span class="gnb-user-name">' + cleanName + '\uB2D8</span>' +
      '<span class="gnb-user-arrow">\u25BE</span>' +
      '</button>' +
      '<div class="gnb-user-panel">' +
      // \uD504\uB85C\uD544 \uD5E4\uB354 (\uD074\uB9AD \u2192 \uB9C8\uC774\uD398\uC774\uC9C0)
      '<a class="gnb-user-profile" href="mypage.html">' +
      '<span class="gnb-user-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="#9aa0b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg></span>' +
      '<span class="gnb-user-profile-name">' +
      cleanName +
      '\uB2D8</span>' +
      '<span class="gnb-user-arrow-r">\u203A</span>' +
      '</a>' +
      // \uB2E4\uD53D \uD3EC\uC778\uD2B8 (\uC900\uBE44\uC911)
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">\uB2E4\uD53D \uD3EC\uC778\uD2B8</div>' +
      '<div class="gnb-user-row gnb-user-row--soon">' +
      '<span><span class="gnb-user-ico">\uD83E\uDE99</span>\uD3EC\uC778\uD2B8</span>' +
      '<span class="gnb-user-soonwrap"><span class="gnb-user-badge">\uC900\uBE44\uC911</span><strong>0 P</strong></span>' +
      '</div>' +
      '</div>' +
      // \uC11C\uBE44\uC2A4 \uC774\uC6A9
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">\uC11C\uBE44\uC2A4 \uC774\uC6A9</div>' +
      '<div class="gnb-user-link is-soon"><span><span class="gnb-user-ico">\uD83D\uDD50</span>\uCD5C\uADFC \uBCF8 \uAC8C\uC2DC\uAE00</span><span class="gnb-user-badge">\uC900\uBE44\uC911</span></div>' +
      '<div class="gnb-user-link is-soon"><span><span class="gnb-user-ico">\u2661</span>\uAD00\uC2EC \uBAA9\uB85D</span><span class="gnb-user-badge">\uC900\uBE44\uC911</span></div>' +
      '<a class="gnb-user-link" href="mypage.html"><span><span class="gnb-user-ico">\uD83D\uDCC4</span>\uC2E0\uCCAD \uB0B4\uC5ED</span><span class="gnb-user-arrow-r">\u203A</span></a>' +
      '</div>' +
      // \uB9C8\uC774\uD398\uC774\uC9C0 \u00B7 \uACE0\uAC1D\uC13C\uD130
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">\uB9C8\uC774\uD398\uC774\uC9C0 \u00B7 \uACE0\uAC1D\uC13C\uD130</div>' +
      '<a class="gnb-user-link" href="mypage.html"><span><span class="gnb-user-ico">\uD83D\uDC64</span>\uB9C8\uC774\uD398\uC774\uC9C0</span><span class="gnb-user-arrow-r">\u203A</span></a>' +
      '<a class="gnb-user-link" href="support-inquiry.html"><span><span class="gnb-user-ico">\uD83D\uDCAC</span>\uBB38\uC758\uD558\uAE30</span><span class="gnb-user-arrow-r">\u203A</span></a>' +
      '<a class="gnb-user-link" href="support-complaint.html"><span><span class="gnb-user-ico">\u26A0\uFE0F</span>\uBD88\uD3B8\uC0AC\uD56D</span><span class="gnb-user-arrow-r">\u203A</span></a>' +
      adminLink +
      '</div>' +
      // \uB85C\uADF8\uC544\uC6C3 (\uAE30\uC874 \uB3D9\uC791 \uC720\uC9C0)
      '<div class="gnb-user-foot">' +
      '<button class="gnb-user-logout" type="button" data-action="logout">' +
      '\uB85C\uADF8\uC544\uC6C3' +
      '</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    var btn = gnbRight.querySelector('.gnb-user-btn');
    if (btn) btn.addEventListener('click', toggleDrop);

    // 알림 벨 — 기능 미완이므로 클릭 시 준비중 안내 (마이페이지 '준비중' 톤과 일관)
    var bell = gnbRight.querySelector('.gnb-bell');
    if (bell) {
      bell.addEventListener('click', function (e) {
        e.stopPropagation();
        alert('알림 기능은 준비 중입니다.');
      });
    }

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
