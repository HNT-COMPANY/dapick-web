// ════════════════════════════════════════════════════
// mypage.js — 다픽 마이페이지
// 사이드바 메뉴 + 탭 전환 + 내 정보 + 신청 내역 + 닉네임 모달
// 5/30: 신청 카드 클릭형 + 월 요금 표시 + 자세히 보기 모달
// ════════════════════════════════════════════════════

(async function init() {
  if (!localStorage.getItem('dapick_token')) {
    window.location.href = '/login.html';
    return;
  }

  setupTabs();
  setupQuickMenu();
  setupNicknameModal();
  setupLogout();
  setupDetailModal();

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
  document.querySelectorAll('.mp-menu__item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === tabName);
  });
  document.querySelectorAll('.mp-tab').forEach((el) => {
    el.classList.remove('is-active');
    el.hidden = true;
  });
  const target = document.getElementById(`tab-${tabName}`);
  if (target) {
    target.classList.add('is-active');
    target.hidden = false;
  }
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

  document.getElementById('sidebar-avatar').textContent = initial;
  document.getElementById('sidebar-nick').textContent = nick;
  document.getElementById('sidebar-email').textContent = email;
  document.getElementById('greeting-nick').textContent = nick;
  document.getElementById('greeting-email').textContent = email;
  document.getElementById('profile-email').textContent = email;
  document.getElementById('profile-nickname').textContent = nick;
  document.getElementById('profile-realname').textContent = p.realName || '-';
  document.getElementById('profile-phone').textContent =
    formatPhone(p.phone) || '-';
  document.getElementById('profile-created').textContent =
    formatDate(p.createdAt) || '-';
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
    .map((app) => {
      const priceLine =
        app.monthlyPrice != null && Number(app.monthlyPrice) > 0
          ? `<span class="app-card__price">월 ${Number(app.monthlyPrice).toLocaleString('ko-KR')}원</span>`
          : '';
      const rejectBox =
        app.status === 'CANCELLED' && app.rejectReason
          ? `
          <div class="app-card__reject">
            <div class="app-card__reject-title">⚠ 상담 거절</div>
            <div class="app-card__reject-body">${escapeHtml(app.rejectReason)}</div>
            ${app.cancelledAt ? `<div class="app-card__reject-date">${formatDate(app.cancelledAt)} 처리</div>` : ''}
          </div>`
          : '';

      return `
    <button type="button" class="app-card app-card--btn" data-app-id="${escapeHtml(app.id)}">
      <div class="app-card__main">
        <p class="app-card__no">${escapeHtml(app.consultationNumber || '-')}</p>
        <h4 class="app-card__title">${escapeHtml(app.productName || getCategoryLabel(app.categoryType) || '상담 신청')}</h4>
        <p class="app-card__meta">${formatDate(app.createdAt)} · ${escapeHtml(getCategoryLabel(app.categoryType))}${priceLine ? ' · ' : ''}${priceLine}</p>
        ${rejectBox}
      </div>
      <div class="app-card__right">
        <span class="app-card__status ${getStatusClass(app.status)}">${getStatusLabel(app.status)}</span>
        <span class="app-card__chevron">›</span>
      </div>
    </button>
  `;
    })
    .join('');

  // 카드 클릭 → 자세히 보기
  list.querySelectorAll('[data-app-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const app = allApps.find((a) => a.id === card.dataset.appId);
      if (app) openDetailModal(app);
    });
  });
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

// ── 자세히 보기 모달 ────────────────────────────────
function setupDetailModal() {
  const modal = document.getElementById('modal-detail');
  if (!modal) return;
  modal.querySelectorAll('[data-close-detail]').forEach((el) => {
    el.addEventListener('click', () => {
      modal.hidden = true;
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.hidden = true;
  });
}

// selectedOptions 중 화면에 보여줄 라벨 매핑 (inquiry 및 금액류 제외)
const OPTION_LABELS = {
  통신사: '통신사',
  인터넷상품: '인터넷',
  TV: 'TV',
  공유기: '공유기',
  전화: '전화',
  type: '유형',
  color: '색상',
  cycle: '관리 주기',
  contract: '약정',
};

function openDetailModal(app) {
  const modal = document.getElementById('modal-detail');
  if (!modal) return;

  const body = document.getElementById('detail-body');

  const rows = [];
  rows.push(detailRow('신청 번호', app.consultationNumber || '-'));
  rows.push(detailRow('카테고리', getCategoryLabel(app.categoryType)));
  rows.push(
    detailRow(
      '상태',
      `<span class="app-card__status ${getStatusClass(app.status)}">${getStatusLabel(app.status)}</span>`,
      true,
    ),
  );
  if (app.monthlyPrice != null && Number(app.monthlyPrice) > 0) {
    rows.push(
      detailRow(
        '월 요금',
        `<strong style="color:var(--brand,#5b3fbe);font-size:16px;">${Number(app.monthlyPrice).toLocaleString('ko-KR')}원</strong>`,
        true,
      ),
    );
  }
  rows.push(detailRow('신청일', formatDateTime(app.createdAt)));

  // 선택 옵션 (inquiry/숫자 제외)
  if (app.selectedOptions) {
    for (const k in app.selectedOptions) {
      if (k === 'inquiry') continue;
      const v = app.selectedOptions[k];
      if (v == null || v === '') continue;
      if (typeof v === 'number') continue;
      if (typeof v === 'string' && /^\d{1,3}(,\d{3})*$|^\d+$/.test(v.trim()))
        continue;
      const label = OPTION_LABELS[k] || k;
      rows.push(detailRow(label, escapeHtml(String(v))));
    }
    // 문의사항은 별도 강조
    if (app.selectedOptions.inquiry) {
      rows.push(
        detailRow('문의사항', escapeHtml(String(app.selectedOptions.inquiry))),
      );
    }
  }

  // 완료 + 지원금
  if (app.status === 'DONE' && app.supportAmount != null) {
    rows.push(
      detailRow(
        '완료 지원금',
        `<strong style="color:#0d6efd;">${Number(app.supportAmount).toLocaleString('ko-KR')}원</strong>`,
        true,
      ),
    );
  }

  // 거절 사유
  if (app.status === 'CANCELLED' && app.rejectReason) {
    rows.push(
      `<div class="detail-reject">
        <div class="detail-reject__title">⚠ 상담 거절 사유</div>
        <div class="detail-reject__body">${escapeHtml(app.rejectReason)}</div>
        ${app.cancelledAt ? `<div class="detail-reject__date">${formatDate(app.cancelledAt)} 처리</div>` : ''}
      </div>`,
    );
  }

  document.getElementById('detail-title').textContent =
    app.productName || getCategoryLabel(app.categoryType) || '신청 상세';
  body.innerHTML = rows.join('');

  modal.hidden = false;
}

function detailRow(label, value, isHtml) {
  return `
    <div class="detail-row">
      <span class="detail-row__label">${escapeHtml(label)}</span>
      <span class="detail-row__value">${isHtml ? value : escapeHtml(String(value))}</span>
    </div>`;
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
    } catch (e) {}
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
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
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
