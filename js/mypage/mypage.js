// mypage.js — 다픽 마이페이지
// 기능: 내 정보 조회/닉네임 변경 + 내 신청 내역 (탭 필터)
// 메모리 #15: GET /api/consultations/my 박음 (B-22 부채로 mypage/applications 미사용)

// ── 상수 박음 ────────────────────────────────────────────────
const STATUS_LABEL = {
  PENDING: '신청 접수',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  CANCELLED: '취소',
};

const STATUS_CLASS = {
  PENDING: 'status-pending',
  IN_PROGRESS: 'status-progress',
  DONE: 'status-done',
  CANCELLED: 'status-cancelled',
};

const CATEGORY_LABEL = {
  MOBILE: '휴대폰',
  WATER: '정수기',
  INTERNET_TV: '인터넷/TV',
  CARD: '카드',
  RENTAL: '렌탈',
};

// ── 전역 상태 (탭 필터용 캐시) ───────────────────────────────
let allApplications = [];
let currentProfile = null;

// ── 페이지 로드 ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 비로그인 차단
  if (typeof isLoggedIn !== 'function' || !isLoggedIn()) {
    sessionStorage.setItem('redirect_after_login', '/mypage.html');
    if (typeof showToast === 'function') {
      showToast('로그인이 필요한 페이지입니다.', 'info');
    }
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 800);
    return;
  }

  // 병렬 로드
  await Promise.all([loadProfile(), loadApplications()]);
});

// ════════════════════════════════════════════════════
// 내 정보
// ════════════════════════════════════════════════════
async function loadProfile() {
  const card = document.getElementById('profile-card');
  if (!card) return;

  try {
    const data = await api.get('/api/mypage/profile');
    currentProfile = data;
    renderProfile(data);
  } catch (e) {
    card.innerHTML = `
      <div class="loading-placeholder">
        내 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    `;
    console.error('[mypage] loadProfile 실패:', e);
  }
}

function renderProfile(p) {
  const card = document.getElementById('profile-card');
  if (!card || !p) return;

  // 가입일 포맷 (YYYY.MM.DD)
  const joinedAt = formatDate(p.createdAt);
  const marketingLabel = p.agreeMarketing ? '동의' : '미동의';

  card.innerHTML = `
    <div class="profile-row">
      <span class="profile-row__label">이메일</span>
      <span class="profile-row__value">${escapeHtml(p.email || '-')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-row__label">닉네임</span>
      <span class="profile-row__value">${escapeHtml(p.nickname || '-')}</span>
      <button class="profile-row__edit" onclick="openNicknameModal()">변경</button>
    </div>
    <div class="profile-row">
      <span class="profile-row__label">이름</span>
      <span class="profile-row__value">${escapeHtml(p.realName || '-')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-row__label">전화번호</span>
      <span class="profile-row__value">${escapeHtml(p.phone || '-')}</span>
    </div>
    <div class="profile-row">
      <span class="profile-row__label">가입일</span>
      <span class="profile-row__value">${joinedAt}</span>
    </div>
    <div class="profile-row">
      <span class="profile-row__label">마케팅 수신</span>
      <span class="profile-row__value">${marketingLabel}</span>
    </div>
    <div class="profile-row">
      <span class="profile-row__label">비밀번호</span>
      <span class="profile-row__value" style="color:var(--text-muted);font-size:12px;">
        5월 중 오픈 예정
      </span>
      <button class="profile-row__edit" disabled>변경</button>
    </div>
  `;
}

// ════════════════════════════════════════════════════
// 내 신청 내역 (메모리 #15)
// ════════════════════════════════════════════════════
async function loadApplications() {
  const list = document.getElementById('apps-list');
  const count = document.getElementById('apps-count');
  if (!list) return;

  try {
    // /api/consultations/my (B-22 부채로 mypage/applications 미사용)
    const data = await api.get('/api/consultations/my');
    allApplications = Array.isArray(data) ? data : [];

    if (count) count.textContent = `${allApplications.length}건`;

    // 최신순 정렬 (createdAt 내림차순)
    allApplications.sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return db - da;
    });

    renderApplications(allApplications);
  } catch (e) {
    list.innerHTML = `
      <div class="loading-placeholder">
        신청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    `;
    if (count) count.textContent = '0건';
    console.error('[mypage] loadApplications 실패:', e);
  }
}

function renderApplications(items) {
  const list = document.getElementById('apps-list');
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">신청 내역이 없습니다</div>
        <div class="empty-state__desc">다픽에서 나에게 딱 맞는 상품을 둘러보세요!</div>
        <a href="index.html" class="empty-state__cta">상품 둘러보기</a>
      </div>
    `;
    return;
  }

  list.innerHTML = items.map(renderAppCard).join('');
}

function renderAppCard(app) {
  const status = app.status || 'PENDING';
  const statusLabel = STATUS_LABEL[status] || status;
  const statusClass = STATUS_CLASS[status] || 'status-pending';

  const category = app.categoryType || '';
  const categoryLabel = CATEGORY_LABEL[category] || category;
  const productName =
    app.productName || (app.product && app.product.name) || '-';
  const monthlyPrice = app.monthlyPrice
    ? `월 ${Number(app.monthlyPrice).toLocaleString()}원`
    : '월 요금 상담';

  const createdAt = formatDate(app.createdAt);

  // 카카오 상담 정보 (utils.js openKakaoConsult 호출용)
  const kakaoInfo = {
    productName,
    category: categoryLabel,
    monthly: app.monthlyPrice,
  };
  // onclick 속성 안전하게 박음 (XSS 방지)
  const kakaoInfoStr = escapeHtml(JSON.stringify(kakaoInfo));

  return `
    <div class="app-card">
      <div class="app-card__head">
        <span class="app-card__no">${escapeHtml(app.consultationNumber || '-')}</span>
        <span class="app-card__status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="app-card__body">
        <span class="app-card__category">${escapeHtml(categoryLabel)}</span>
        <span class="app-card__product">${escapeHtml(productName)}</span>
        <span class="app-card__price">${monthlyPrice}</span>
      </div>
      <div class="app-card__foot">
        <span class="app-card__date">${createdAt}</span>
        <button class="app-card__action" onclick="openKakaoConsult(JSON.parse(this.dataset.info))" data-info="${kakaoInfoStr}">
          💬 카카오 상담
        </button>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════
// 탭 필터
// ════════════════════════════════════════════════════
function filterApplications(btn, filter) {
  document
    .querySelectorAll('.apps-tab')
    .forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');

  let filtered;
  switch (filter) {
    case 'ACTIVE':
      // 진행중 = PENDING + IN_PROGRESS
      filtered = allApplications.filter(
        (a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS',
      );
      break;
    case 'DONE':
      filtered = allApplications.filter((a) => a.status === 'DONE');
      break;
    case 'CANCELLED':
      filtered = allApplications.filter((a) => a.status === 'CANCELLED');
      break;
    case 'ALL':
    default:
      filtered = allApplications;
  }

  // 카운트도 업데이트
  const count = document.getElementById('apps-count');
  if (count) count.textContent = `${filtered.length}건`;

  renderApplications(filtered);
}

// ════════════════════════════════════════════════════
// 닉네임 변경 모달
// ════════════════════════════════════════════════════
function openNicknameModal() {
  if (!currentProfile) return;
  const input = document.getElementById('modal-nickname');
  if (input) {
    input.value = currentProfile.nickname || '';
    input.classList.remove('err');
  }
  hideModalAlert();
  document.getElementById('nickname-modal').classList.add('show');
  setTimeout(() => input && input.focus(), 100);
}

function closeNicknameModal() {
  document.getElementById('nickname-modal').classList.remove('show');
}

async function saveNickname() {
  const input = document.getElementById('modal-nickname');
  const newNick = input.value.trim();

  if (newNick.length < 2 || newNick.length > 20) {
    showModalAlert('닉네임은 2~20자 사이여야 합니다.');
    input.classList.add('err');
    return;
  }
  if (currentProfile && newNick === currentProfile.nickname) {
    showModalAlert('현재 닉네임과 동일합니다.');
    return;
  }

  setNicknameLoading(true);

  try {
    // PUT /api/mypage/profile (ProfileUpdateRequest 추정 필드: nickname)
    const data = await api.put('/api/mypage/profile', { nickname: newNick });

    // 응답이 ProfileResponse 형태로 박힘 가정 → 현재 프로필 갱신
    currentProfile =
      data && data.nickname ? data : { ...currentProfile, nickname: newNick };
    localStorage.setItem('dapick_nick', currentProfile.nickname);

    // GNB 갱신 (auth.js)
    if (typeof renderGnbAuth === 'function') renderGnbAuth();

    renderProfile(currentProfile);
    closeNicknameModal();

    if (typeof showToast === 'function') {
      showToast('닉네임이 변경되었습니다 ✨', 'success');
    }
  } catch (e) {
    showModalAlert(e.message || '닉네임 변경에 실패했습니다.');
  } finally {
    setNicknameLoading(false);
  }
}

function setNicknameLoading(loading) {
  const btn = document.getElementById('btn-save-nickname');
  const txt = document.getElementById('save-nickname-text');
  const spn = document.getElementById('save-nickname-spinner');
  if (btn) btn.disabled = loading;
  if (txt) txt.style.visibility = loading ? 'hidden' : 'visible';
  if (spn) spn.style.display = loading ? 'block' : 'none';
}

// ════════════════════════════════════════════════════
// 헬퍼
// ════════════════════════════════════════════════════
function showModalAlert(msg, type = 'error') {
  const el = document.getElementById('modal-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert-banner show ${type}`;
}

function hideModalAlert() {
  const el = document.getElementById('modal-alert');
  if (el) el.classList.remove('show');
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
