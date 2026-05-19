// ════════════════════════════════════════════════════
// mypage.js — 다픽 마이페이지
// 사이드바 메뉴 + 탭 전환 + 내 정보 + 신청 내역 + 닉네임 모달
// ════════════════════════════════════════════════════

(async function init() {
  // 인증 확인
  if (!localStorage.getItem('dapick_token')) {
    window.location.href = '/login.html';
    return;
  }

  setupTabs();
  setupQuickMenu();
  setupNicknameModal();
  setupLogout();

  await loadProfile();
  await loadApplications();
})();

// ── 탭 전환 ─────────────────────────────────────────
function setupTabs() {
  const items = document.querySelectorAll('.mp-menu__item');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      if (tabName) switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // 사이드바 메뉴 활성화
  document.querySelectorAll('.mp-menu__item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === tabName);
  });

  // 탭 컨텐츠 전환
  document.querySelectorAll('.mp-tab').forEach((el) => {
    el.classList.remove('is-active');
    el.hidden = true;
  });
  const target = document.getElementById(`tab-${tabName}`);
  if (target) {
    target.classList.add('is-active');
    target.hidden = false;
  }

  // 모바일에서 컨텐츠 위로 스크롤
  if (window.innerWidth < 768) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── 빠른 메뉴 그리드 ──────────────────────────────────
function setupQuickMenu() {
  document.querySelectorAll('.mp-quick__item').forEach((item) => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      if (tabName) switchTab(tabName);
    });
  });
}

// ── 프로필 로드 ─────────────────────────────────────
async function loadProfile() {
  try {
    const data = await api.get('/api/mypage/profile');
    renderProfile(data);
  } catch (err) {
    console.error('[mypage] profile load failed:', err);
    showToast('프로필 정보를 불러오지 못했습니다.');
  }
}

function renderProfile(p) {
  const nick = p.nickname || '다픽 회원';
  const email = p.email || '-';
  const initial = (nick[0] || 'D').toUpperCase();

  // 사이드바 영역
  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('sidebar-nick').textContent = nick;
  document.getElementById('sidebar-email').textContent = email;

  // 인사말 카드
  document.getElementById('greeting-nick').textContent = nick;
  document.getElementById('greeting-email').textContent = email;

  // 내 정보 카드
  document.getElementById('profile-email').textContent = email;
  document.getElementById('profile-nickname').textContent = nick;
  document.getElementById('profile-realname').textContent = p.realName || '-';
  document.getElementById('profile-phone').textContent =
    formatPhone(p.phone) || '-';
  document.getElementById('profile-created').textContent =
    formatDate(p.createdAt) || '-';
  // ProfileResponse에 agreeMarketing 미포함 (B-29 부채) → 임시로 미동의 표시
  document.getElementById('profile-marketing').textContent = '미동의';
}

// ── 신청 내역 ────────────────────────────────────────
let allApps = [];

async function loadApplications() {
  try {
    const data = await api.get('/api/consultations/my');
    allApps = Array.isArray(data) ? data : data.content || [];
    document.getElementById('quick-app-count').textContent = allApps.length;
    renderApps('all');
    setupAppsFilter();
  } catch (err) {
    console.error('[mypage] applications load failed:', err);
    document.getElementById('apps-list').innerHTML =
      '<div class="empty-state">신청 내역을 불러오지 못했습니다.</div>';
  }
}

function setupAppsFilter() {
  document.querySelectorAll('.apps-filter__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.apps-filter__btn')
        .forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderApps(btn.dataset.filter);
    });
  });
}

function renderApps(filter) {
  let filtered = allApps;
  if (filter === 'progress') {
    filtered = allApps.filter(
      (a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS',
    );
  } else if (filter === 'done') {
    filtered = allApps.filter((a) => a.status === 'DONE');
  } else if (filter === 'cancelled') {
    filtered = allApps.filter((a) => a.status === 'CANCELLED');
  }

  document.getElementById('app-count').textContent = `${filtered.length}건`;

  const list = document.getElementById('apps-list');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">${filter === 'all' ? '아직 신청 내역이 없어요.' : '해당하는 신청이 없습니다.'}</div>`;
    return;
  }

  list.innerHTML = filtered
    .map(
      (app) => `
    <div class="app-card">
      <div class="app-card__main">
        <p class="app-card__no">${escapeHtml(app.consultationNumber || '-')}</p>
        <h4 class="app-card__title">${escapeHtml(app.productName || getCategoryLabel(app.categoryType) || '상담 신청')}</h4>
        <p class="app-card__meta">${formatDate(app.createdAt)} · ${escapeHtml(getCategoryLabel(app.categoryType))}</p>
        ${
          app.status === 'CANCELLED' && app.rejectReason
            ? `
          <div style="margin-top:10px;padding:10px 12px;background:#fff3cd;border-radius:6px;border-left:3px solid #dc3545;font-size:13px;">
            <div style="color:#856404;font-weight:600;margin-bottom:4px;">⚠ 상담 거절</div>
            <div style="color:#5a4a08;line-height:1.5;">${escapeHtml(app.rejectReason)}</div>
            ${app.cancelledAt ? `<div style="color:#999;font-size:11px;margin-top:6px;">${formatDate(app.cancelledAt)} 처리</div>` : ''}
          </div>
        `
            : ''
        }
      </div>
      <span class="app-card__status ${getStatusClass(app.status)}">${getStatusLabel(app.status)}</span>
    </div>
  `,
    )
    .join('');
}

function getStatusLabel(status) {
  const map = {
    PENDING: '대기',
    IN_PROGRESS: '진행중',
    DONE: '완료',
    CANCELLED: '취소',
  };
  return map[status] || status;
}

function getStatusClass(status) {
  const map = {
    PENDING: 'app-status--pending',
    IN_PROGRESS: 'app-status--in-progress',
    DONE: 'app-status--done',
    CANCELLED: 'app-status--cancelled',
  };
  return map[status] || '';
}

function getCategoryLabel(type) {
  const map = {
    PHONE: '휴대폰',
    INTERNET_TV: '인터넷/TV',
    CARD: '카드',
    WATER: '정수기',
    RENTAL: '렌탈',
  };
  return map[type] || type || '';
}

// ── 닉네임 변경 모달 ────────────────────────────────
function setupNicknameModal() {
  const modal = document.getElementById('modal-nickname');
  const input = document.getElementById('input-nickname');
  const hint = document.getElementById('nickname-hint');

  document.getElementById('btn-edit-nickname').addEventListener('click', () => {
    input.value = document.getElementById('profile-nickname').textContent;
    hint.textContent = '';
    modal.hidden = false;
    setTimeout(() => input.focus(), 50);
  });

  document
    .getElementById('btn-cancel-nickname')
    .addEventListener('click', () => {
      modal.hidden = true;
    });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      modal.hidden = true;
    });
  });

  document
    .getElementById('btn-save-nickname')
    .addEventListener('click', async () => {
      const newNick = input.value.trim();
      if (newNick.length < 2 || newNick.length > 20) {
        hint.textContent = '닉네임은 2~20자로 입력해주세요.';
        return;
      }
      try {
        await api.put('/api/mypage/profile', { nickname: newNick });
        modal.hidden = true;
        localStorage.setItem('dapick_nick', newNick);
        await loadProfile();
        showToast('닉네임이 변경되었습니다.');
      } catch (err) {
        hint.textContent = err.message || '닉네임 변경에 실패했습니다.';
      }
    });
}

// ── 로그아웃 ────────────────────────────────────────
function setupLogout() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      // 서버 호출 실패해도 클라이언트 정리는 진행
    }
    localStorage.clear();
    window.location.href = '/index.html';
  });
}

// ── 유틸 ────────────────────────────────────────────
function formatPhone(phone) {
  if (!phone) return '';
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
}
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#111018;color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 8px 20px rgba(0,0,0,0.2);';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
