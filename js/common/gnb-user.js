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

  // 비교함에 담긴 개수. 저장소가 아직 안 실렸으면 아무것도 안 붙인다 -
  // 0 을 보여주면 '비어 있다' 가 아니라 '고장' 처럼 읽힌다.
  // compare-button.js 가 안 실린 화면에서도 조용히 넘어간다.
  function gnbCompareCount() {
    try {
      var st = window.dpCompareStore;
      if (!st || typeof st.count !== 'function') return '';
      var n = 0;
      (st.CATS || []).forEach(function (c) { n += st.count(c) || 0; });
      return n ? ' <em class="gnb-user-badge">' + n + '</em>' : '';
    } catch (e) { return ''; }
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
      var np = document.getElementById('gnbNotiPanel');
      if (np && np.classList.contains('is-open')) np.classList.remove('is-open');
    });
  }

  function setupEscapeKey() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var drop = document.getElementById('gnbUserDrop');
        if (drop) drop.classList.remove('is-open');
        var np = document.getElementById('gnbNotiPanel');
        if (np) np.classList.remove('is-open');
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
      '<div class="gnb-noti-panel" id="gnbNotiPanel">' +
      '<div class="gnb-noti-head"><span class="gnb-noti-title">알림</span>' +
      '<button class="gnb-noti-readall" type="button">모두 읽음</button></div>' +
      '<div class="gnb-noti-list" id="gnbNotiList"></div>' +
      '</div>' +
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
      // 다픽 포인트 (준비중)
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">다픽 포인트</div>' +
      '<div class="gnb-user-row gnb-user-row--soon">' +
      '<span><span class="gnb-user-ico">🪙</span>포인트</span>' +
      '<span class="gnb-user-soonwrap"><span class="gnb-user-badge">준비중</span><strong>0 P</strong></span>' +
      '</div>' +
      '</div>' +
      // 서비스 이용
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">서비스 이용</div>' +
      '<a class="gnb-user-link" href="mypage.html?tab=recent"><span><span class="gnb-user-ico">🕐</span>최근 본 게시글</span><span class="gnb-user-arrow-r">›</span></a>' +
      '<a class="gnb-user-link" href="mypage.html?tab=favorites"><span><span class="gnb-user-ico">♡</span>관심 목록</span><span class="gnb-user-arrow-r">›</span></a>' +
      // 비교함 (2026-08-03 추가). 마이페이지에 탭은 원래 있었는데 여기서 갈 길이 없었다.
      // 아이콘을 이모지가 아니라 그림(SVG)으로 둔 이유 - 이모지는 기기·브라우저마다
      // 모양이 다르고, 안 그려지면 네모(□)로 뜬다. 담긴 개수는 저장소를 읽어 붙인다.
      '<a class="gnb-user-link" href="mypage.html?tab=compare"><span><span class="gnb-user-ico">' +
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="vertical-align:-2px">' +
      '<rect x="3.5" y="11" width="7" height="9" rx="1.5"/><rect x="13.5" y="5" width="7" height="15" rx="1.5"/>' +
      '</svg></span>비교함' + gnbCompareCount() + '</span><span class="gnb-user-arrow-r">›</span></a>' +
      '<a class="gnb-user-link" href="mypage.html"><span><span class="gnb-user-ico">📄</span>신청 내역</span><span class="gnb-user-arrow-r">›</span></a>' +
      '</div>' +
      // 마이페이지 · 고객센터
      '<div class="gnb-user-section">' +
      '<div class="gnb-user-section-title">마이페이지 · 고객센터</div>' +
      '<a class="gnb-user-link" href="mypage.html"><span><span class="gnb-user-ico">👤</span>마이페이지</span><span class="gnb-user-arrow-r">›</span></a>' +
      '<a class="gnb-user-link" href="support-inquiry.html"><span><span class="gnb-user-ico">💬</span>문의하기</span><span class="gnb-user-arrow-r">›</span></a>' +
      '<a class="gnb-user-link" href="support-complaint.html"><span><span class="gnb-user-ico">⚠️</span>불편사항</span><span class="gnb-user-arrow-r">›</span></a>' +
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

    // 알림 벨 — 클릭 시 알림 드롭다운 토글 + 목록 로드
    injectNotiStyles();
    var bell = gnbRight.querySelector('.gnb-bell');
    var notiPanel = document.getElementById('gnbNotiPanel');
    if (bell && notiPanel) {
      bell.addEventListener('click', function (e) {
        e.stopPropagation();
        var opening = !notiPanel.classList.contains('is-open');
        notiPanel.classList.toggle('is-open');
        if (opening) loadNotiList();
      });
      notiPanel.addEventListener('click', function (e) {
        e.stopPropagation();
        var readall = e.target.closest && e.target.closest('.gnb-noti-readall');
        if (readall) { markAllNoti(); return; }
        var goBtn = e.target.closest && e.target.closest('.gnb-noti-go');
        if (goBtn) { onNotiGoClick(goBtn); return; }
        var item = e.target.closest && e.target.closest('.gnb-noti-item');
        if (item) onNotiItemClick(item);
      });
      loadUnreadCount();
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

  // ── 인앱 알림 (GNB 벨 드롭다운) ──────────────────────────
  function notiApiReady() { return typeof api !== 'undefined' && api && api.get; }

  function setBellBadge(count) {
    var bell = document.querySelector('.gnb-bell');
    var badge = document.querySelector('.gnb-bell-badge');
    if (!bell || !badge) return;
    bell.setAttribute('data-count', String(count));
    if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.hidden = false; }
    else { badge.textContent = ''; badge.hidden = true; }
  }

  function loadUnreadCount() {
    if (!notiApiReady()) return;
    api.get('/api/notifications/unread-count').then(function (d) {
      setBellBadge((d && d.count) || 0);
    }).catch(function () {});
  }

  function fmtNotiTime(raw) {
    if (!raw) return '';
    var m = String(raw).replace('T', ' ').match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})/);
    return m ? (m[2] + '.' + m[3] + ' ' + m[4] + ':' + m[5]) : '';
  }

  function loadNotiList() {
    var list = document.getElementById('gnbNotiList');
    if (!list || !notiApiReady()) return;
    list.innerHTML = '<div class="gnb-noti-empty">불러오는 중…</div>';
    api.get('/api/notifications').then(function (rows) {
      var arr = Array.isArray(rows) ? rows : [];
      if (!arr.length) { list.innerHTML = '<div class="gnb-noti-empty">새 알림이 없습니다.</div>'; return; }
      list.innerHTML = arr.slice(0, 30).map(function (n) {
        var dest = resolveNotiLink(n.linkUrl);
        var goBtn = dest
          ? '<button class="gnb-noti-go" type="button" data-go="' + escapeHtml(dest) + '">바로가기 <span aria-hidden="true">›</span></button>'
          : '';
        return '<div class="gnb-noti-item' + (n.read ? '' : ' is-unread') + '" data-id="' + escapeHtml(n.id) +
          '" data-link="' + escapeHtml(n.linkUrl || '') + '">' +
          '<div class="gnb-noti-item-title">' + (n.read ? '' : '<span class="gnb-noti-dot"></span>') +
          '<span class="gnb-noti-item-titletext">' + escapeHtml(n.title || '알림') + '</span>' +
          '<span class="gnb-noti-caret" aria-hidden="true">▾</span></div>' +
          '<div class="gnb-noti-item-body">' + escapeHtml(n.content || '') + '</div>' +
          '<div class="gnb-noti-item-foot">' +
          '<span class="gnb-noti-item-time">' + escapeHtml(fmtNotiTime(n.createdAt)) + '</span>' +
          goBtn +
          '</div>' +
          '</div>';
      }).join('');
    }).catch(function () {
      list.innerHTML = '<div class="gnb-noti-empty">알림을 불러오지 못했습니다.</div>';
    });
  }

  // 알림 링크 정규화 — 예쁜 경로/미존재 경로로 인한 404 방지. 안전한 곳만 이동.
  function resolveNotiLink(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;                    // 절대 URL
    if (s.charAt(0) !== '/') s = '/' + s;
    if (/^\/mypage(\/|$|\?|#)/i.test(s)) return '/mypage.html'; // 마이페이지 계열 → 실제 페이지
    if (/^\/consent(\/|$|\?|#)/i.test(s)) return s;            // 동의서 서명(Pages 서빙)
    if (/\.html(\?|#|$)/i.test(s)) return s;                   // 실제 정적 파일
    if (s === '/') return s;                                    // 홈
    return null;                                                // 알 수 없는 경로 → 이동 안 함(404 방지)
  }

  // 아이템 클릭 = 펼치기/접기 토글. 첫 펼침 시 읽음 처리. 이동은 '바로가기' 버튼으로 분리.
  function onNotiItemClick(item) {
    item.classList.toggle('is-expanded');
    var id = item.getAttribute('data-id');
    if (item.classList.contains('is-unread') && notiApiReady() && id) {
      api.patch('/api/notifications/' + id + '/read', {}).then(function () {
        item.classList.remove('is-unread');
        var dot = item.querySelector('.gnb-noti-dot');
        if (dot) dot.remove();
        loadUnreadCount();
      }).catch(function () {});
    }
  }

  // '바로가기' 버튼 = linkUrl 이동 (펼치기와 분리, 클릭 전파 차단).
  function onNotiGoClick(btn) {
    var dest = btn.getAttribute('data-go');
    if (dest) window.location.href = dest;
  }

  function markAllNoti() {
    if (!notiApiReady()) return;
    api.patch('/api/notifications/read-all', {}).then(function () {
      loadUnreadCount();
      loadNotiList();
    }).catch(function () {});
  }

  var _notiStyled = false;
  function injectNotiStyles() {
    if (_notiStyled) return;
    _notiStyled = true;
    var css =
      '.gnb-right{position:relative;}' +
      '.gnb-bell{position:relative;}' +
      '.gnb-bell-badge{position:absolute;top:0;right:0;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#e5484d;color:#fff;font-size:10px;font-weight:800;line-height:16px;text-align:center;box-sizing:border-box;}' +
      '.gnb-noti-panel{position:absolute;top:calc(100% + 12px);right:0;width:340px;max-height:460px;overflow-y:auto;background:#fff;border:1px solid #eceaf2;border-radius:14px;box-shadow:0 14px 44px rgba(20,18,35,.18);z-index:3000;display:none;font-family:"Noto Sans KR",sans-serif;}' +
      '.gnb-noti-panel.is-open{display:block;}' +
      '.gnb-noti-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f1f0f6;position:sticky;top:0;background:#fff;border-radius:14px 14px 0 0;}' +
      '.gnb-noti-title{font-size:15px;font-weight:800;color:#18172b;}' +
      '.gnb-noti-readall{background:none;border:none;color:#5b3fbe;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.gnb-noti-readall:hover{text-decoration:underline;}' +
      '.gnb-noti-list{padding:2px 0;}' +
      '.gnb-noti-empty{padding:34px 16px;text-align:center;color:#a7a5b8;font-size:13.5px;}' +
      '.gnb-noti-item{padding:12px 16px;border-bottom:1px solid #f6f5fa;cursor:pointer;transition:background .12s;}' +
      '.gnb-noti-item:last-child{border-bottom:none;}' +
      '.gnb-noti-item:hover{background:#faf9ff;}' +
      '.gnb-noti-item.is-unread{background:#f5f1ff;}' +
      '.gnb-noti-item.is-unread:hover{background:#efe9ff;}' +
      '.gnb-noti-item-title{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:#221f38;margin-bottom:3px;}' +
      '.gnb-noti-dot{width:7px;height:7px;border-radius:50%;background:#5b3fbe;flex-shrink:0;}' +
      '.gnb-noti-item-title{cursor:pointer;}' +
      '.gnb-noti-item-titletext{flex:1;min-width:0;}' +
      '.gnb-noti-caret{margin-left:6px;color:#b0aec2;font-size:11px;flex-shrink:0;transition:transform .15s;}' +
      '.gnb-noti-item.is-expanded .gnb-noti-caret{transform:rotate(180deg);}' +
      '.gnb-noti-item-body{font-size:12.5px;color:#6a6880;line-height:1.5;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.gnb-noti-item.is-expanded .gnb-noti-item-body{display:block;-webkit-line-clamp:none;overflow:visible;white-space:pre-wrap;word-break:break-word;}' +
      '.gnb-noti-item-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;}' +
      '.gnb-noti-item-time{font-size:11px;color:#b0aec2;}' +
      '.gnb-noti-go{display:none;background:none;border:none;padding:0;color:#5b3fbe;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.gnb-noti-go:hover{text-decoration:underline;}' +
      '.gnb-noti-item.is-expanded .gnb-noti-go{display:inline-flex;align-items:center;gap:2px;}' +
      '@media(max-width:520px){.gnb-noti-panel{width:min(340px,calc(100vw - 24px));}}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
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
