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
  setupReviewModal();

  await loadProfile();
  await loadReviewEligibility(); // 신청 렌더 전에 eligible 집합 확보
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

  // 프로필 이미지가 있으면 표시, 없으면 HTML의 기본 사람 아이콘 유지
  const avatarEl = document.getElementById('sidebar-avatar');
  if (avatarEl && p.profileImageUrl) {
    avatarEl.innerHTML =
      '<img class="mp-sidebar__avatar-img" src="' + p.profileImageUrl + '" alt="" />';
  }

  document.getElementById('sidebar-nick').textContent = nick;
  document.getElementById('sidebar-email').textContent = email;
  // 환영 배너(.mp-greeting) 제거로 greeting-nick/email 바인딩 삭제 (사이드바·프로필 표시는 유지)
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

// 리뷰 작성 가능 상담(완료+미작성) 집합 — eligible API 결과. 실패 시 리뷰 UI 미표시.
let eligibleSet = new Set();
let eligibleLoaded = false;
let reviewRating = 0;
let reviewTargetId = null;

async function loadReviewEligibility() {
  try {
    const data = await api.get('/api/reviews/eligible');
    if (data == null) {
      // 401 갱신 실패(로그인 이동 중) 또는 빈 응답 → 리뷰 UI 미표시(오표기 방지)
      eligibleLoaded = false;
      return;
    }
    const list = Array.isArray(data) ? data : data.content || [];
    eligibleSet = new Set(list.map((e) => e.consultationId));
    eligibleLoaded = true;
  } catch (err) {
    console.error('[mypage] review eligible load failed:', err);
    eligibleLoaded = false; // 실패 시 버튼/완료표기 모두 숨김 (오표기 방지)
  }
}

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
      const priceHtml =
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

      // 3열 그리드: 좌(상태+번호) / 중(제목, 2줄 말줄임) / 우(요금·날짜·카테고리).
      // 카드 div는 클릭 대상 아님 — data-app-id는 하단 [자세히 보기] 버튼에만.
      // 리뷰 버튼은 목록에 없음(상세 모달 전용 유지).
      return `
    <div class="app-card">
      <div class="app-card__grid">
        <div class="app-card__col-left">
          <span class="app-card__status ${getStatusClass(app.status)}">${getStatusLabel(app.status)}</span>
          <span class="app-card__no">${escapeHtml(app.consultationNumber || '-')}</span>
        </div>
        <div class="app-card__col-center">
          <h4 class="app-card__title">${escapeHtml(app.productName || getCategoryLabel(app.categoryType) || '상담 신청')}</h4>
        </div>
        <div class="app-card__col-right">
          ${priceHtml}
          <span class="app-card__date">${formatDate(app.createdAt)}</span>
          <span class="app-card__cat">${escapeHtml(getCategoryLabel(app.categoryType))}</span>
        </div>
      </div>
      ${rejectBox}
      <div class="app-card__foot">
        <button type="button" class="app-card__detail-btn" data-app-id="${escapeHtml(app.id)}">자세히 보기</button>
      </div>
    </div>
  `;
    })
    .join('');

  // [자세히 보기] 버튼 클릭만 상세 모달 오픈 (카드 다른 영역 클릭은 무반응)
  list.querySelectorAll('.app-card__detail-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const app = allApps.find((a) => a.id === btn.dataset.appId);
      if (app) openDetailModal(app);
    });
  });
}

// 현재 활성 필터 (리뷰 등록 후 재렌더용)
function currentAppsFilter() {
  const active = document.querySelector('.apps-filter__btn.is-active');
  return active ? active.dataset.filter : 'all';
}

// 리뷰 상태 판정 — 목록 카드와 상세 모달이 공유(DRY). 'write' | 'done' | 'none'
// eligible 로드 실패 시 'none'(오표기 방지). 판정 소스는 eligibleSet 단일.
function getReviewState(app) {
  if (!eligibleLoaded || !app || app.status !== 'DONE') return 'none';
  return eligibleSet.has(app.id) ? 'write' : 'done';
}

// ── 리뷰 작성 모달 (조각2-②) ─────────────────────────
function setupReviewModal() {
  const modal = document.getElementById('modal-review');
  if (!modal) return;

  modal.querySelectorAll('[data-close-review]').forEach((el) => {
    el.addEventListener('click', () => {
      modal.hidden = true;
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.hidden = true;
  });

  // 별점 클릭 선택
  modal.querySelectorAll('.review-star').forEach((star) => {
    star.addEventListener('click', () => {
      reviewRating = parseInt(star.dataset.val, 10);
      paintReviewStars(reviewRating);
    });
  });

  // 실시간 글자수 카운터
  const ta = document.getElementById('review-content');
  const counter = document.getElementById('review-count');
  if (ta && counter) {
    ta.addEventListener('input', () => {
      counter.textContent = ta.value.length;
    });
  }

  document
    .getElementById('btn-submit-review')
    .addEventListener('click', submitReview);
}

function paintReviewStars(n) {
  document.querySelectorAll('#review-stars .review-star').forEach((star) => {
    star.classList.toggle('is-on', parseInt(star.dataset.val, 10) <= n);
  });
}

function openReviewModal(app) {
  reviewTargetId = app.id; // 상담 id (= consultationId). category/productId는 서버가 파생.
  reviewRating = 0;
  paintReviewStars(0);
  const ta = document.getElementById('review-content');
  if (ta) ta.value = '';
  document.getElementById('review-count').textContent = '0';
  document.getElementById('review-hint').textContent = '';
  document.getElementById('review-product').textContent =
    app.productName || getCategoryLabel(app.categoryType) || '상담';
  document.getElementById('modal-review').hidden = false;
}

async function submitReview() {
  if (!reviewTargetId) return;
  const hint = document.getElementById('review-hint');

  if (reviewRating < 1 || reviewRating > 5) {
    hint.textContent = '별점을 선택해주세요.';
    return;
  }
  const content = document.getElementById('review-content').value.trim();

  const btn = document.getElementById('btn-submit-review');
  btn.disabled = true;
  try {
    // consultationId만 전송 — category/productId는 서버가 상담에서 파생(위변조 방지)
    const res = await api.post('/api/reviews', {
      consultationId: reviewTargetId,
      rating: reviewRating,
      content: content || null,
    });
    if (res === null) return; // 401 갱신 실패 → 이미 로그인 이동

    // 성공: eligible 에서 제거 → 해당 카드 "리뷰 작성 완료"로 갱신
    eligibleSet.delete(reviewTargetId);
    document.getElementById('modal-review').hidden = true;
    showToast('리뷰가 등록되었습니다.');
    renderApps(currentAppsFilter());
  } catch (e) {
    if (e.status === 401) {
      showToast('로그인이 필요합니다. 다시 로그인해 주세요.');
      return;
    }
    // 중복(이미 작성 — DB UNIQUE 백스톱): 카드도 완료로 정정 후 닫기
    if (/이미|ALREADY/i.test(e.message || '')) {
      eligibleSet.delete(reviewTargetId);
      document.getElementById('modal-review').hidden = true;
      showToast(e.message);
      renderApps(currentAppsFilter());
      return;
    }
    // 미완료/타인 상담 등 도메인 예외 메시지 노출
    hint.textContent = e.message || '리뷰 등록에 실패했습니다.';
  } finally {
    btn.disabled = false;
  }
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

  // 환수동의서 다운로드 버튼 — 모달 열 때 status 조회해 SIGNED+pdf 보유 시 노출.
  // 어느 신청 모달인지 추적(빠른 연속 오픈 시 비동기 응답 뒤섞임 방지).
  modal.dataset.appId = app.id;
  const dlBtn = document.getElementById('btn-consent-download');
  if (dlBtn) {
    dlBtn.hidden = true;
    dlBtn.onclick = null;
    loadConsentStatus(app.id, app.consultationNumber);
  }

  // 리뷰 UI (목록과 동일 판정 공유) — 상세 모달 하단, 확인 버튼 옆
  renderDetailReview(app);

  modal.hidden = false;
}

// 상세 모달 리뷰 슬롯 렌더 — 목록과 같은 getReviewState 사용(일관성)
function renderDetailReview(app) {
  const slot = document.getElementById('detail-review-slot');
  if (!slot) return;
  const st = getReviewState(app);
  if (st === 'write') {
    slot.innerHTML =
      '<button type="button" class="app-review-btn" id="detail-review-btn">⭐ 리뷰 쓰기</button>';
    slot.querySelector('#detail-review-btn').addEventListener('click', () => {
      // 상세 닫고 작성 모달 오픈 — 스택/스테일 방지, 제출 후 목록·모달 모두 eligibleSet에서 재파생
      document.getElementById('modal-detail').hidden = true;
      openReviewModal(app);
    });
  } else if (st === 'done') {
    slot.innerHTML = '<span class="app-review-done">✓ 리뷰 작성 완료</span>';
  } else {
    slot.innerHTML = '';
  }
}

// 모달 진입 시 동의서 상태 조회 → 다운로드 버튼 노출 결정 (JWT 자동: api 래퍼)
async function loadConsentStatus(consultationId, consultationNumber) {
  const dlBtn = document.getElementById('btn-consent-download');
  if (!dlBtn) return;
  try {
    const status = await api.get(
      `/api/consultations/${consultationId}/consent/status`,
    );
    // 응답 도착 사이 다른 신청으로 모달이 바뀌었으면 무시
    const modal = document.getElementById('modal-detail');
    if (!modal || modal.dataset.appId !== String(consultationId)) return;

    if (status && status.downloadable === true) {
      dlBtn.hidden = false;
      dlBtn.onclick = () => downloadConsentPdf(consultationId, consultationNumber);
    } else {
      dlBtn.hidden = true;
      dlBtn.onclick = null;
    }
  } catch (e) {
    // 조회 실패 시 버튼 숨김(안전) — 목록/모달은 정상 유지
    console.error('[mypage] consent status load failed:', e);
    dlBtn.hidden = true;
    dlBtn.onclick = null;
  }
}

// ── 환수동의서 PDF 다운로드 ──────────────────────────
// api 래퍼는 응답을 text/JSON 으로 읽어 바이너리에 부적합 → 원시 fetch + blob.
// 인증 헤더는 기존 /my 호출과 동일하게 dapick_token(Bearer) 사용.
async function downloadConsentPdf(consultationId, consultationNumber) {
  const token = localStorage.getItem('dapick_token');
  try {
    const res = await fetch(
      `${BASE_URL}/api/consultations/${consultationId}/consent/pdf`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      if (res.status === 401) {
        showToast('로그인이 만료되었습니다. 다시 로그인해 주세요.');
      } else if (res.status === 404) {
        showToast('서명된 동의서를 찾을 수 없습니다.');
      } else if (res.status === 403) {
        showToast('본인의 동의서만 받을 수 있습니다.');
      } else {
        showToast('다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `환수동의서-${consultationNumber || consultationId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[mypage] consent pdf download failed:', e);
    showToast('다운로드 중 오류가 발생했습니다.');
  }
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
