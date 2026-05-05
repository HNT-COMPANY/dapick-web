// utils.js — 다픽 웹 공통 유틸

// ── 페이지 이동 ──
function goPage(cat) {
  const pages = {
    internet: 'internet.html',
    mobile: 'mobile.html',
    card: 'card.html',
    water: 'water.html',
    rental: 'rental.html',
    main: 'index.html',
  };
  const target = pages[cat];
  if (target) {
    window.location.href = target;
  } else {
    showToast(`${cat} 페이지는 준비 중입니다!`, 'info');
  }
}

// ── 섹션 스크롤 이동 ──
function goTo(id) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

// ── FAQ 토글 ──
function toggleFaq(el) {
  const ans = el.nextElementSibling;
  const isOpen = el.classList.toggle('open');
  isOpen ? ans.classList.add('open') : ans.classList.remove('open');
}

// ── 카테고리 탭 전환 ──
function switchCat(el, cat) {
  document
    .querySelectorAll('.cat-item')
    .forEach((c) => c.classList.remove('active'));
  el.classList.add('active');
  if (cat) goPage(cat);
}

// ════════════════════════════════════════════════════
// 카카오 상담 — 모든 페이지 공통
// ════════════════════════════════════════════════════
const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_exaRjX/chat';

/**
 * 카카오 상담 열기 (상품 정보 없이 — 기본 상담)
 */
function openKakao() {
  openKakaoConsult();
}

/**
 * 카카오 상담 열기 (상품 정보 포함)
 * @param {Object|null} info - 상품 정보 (없으면 기본 상담)
 * @param {string} info.productName  - 상품명
 * @param {string} info.category     - 카테고리 (정수기/렌탈/휴대폰 등)
 * @param {string} [info.brand]      - 브랜드명
 * @param {string} [info.contract]   - 약정 조건
 * @param {string} [info.cycle]      - 관리주기
 * @param {string} [info.type]       - 가입조건 (기본/타사보상)
 * @param {string} [info.color]      - 색상
 * @param {number} [info.monthly]    - 월 렌탈료
 */
function openKakaoConsult(info = null) {
  // 1. 로그인 여부 확인
  if (!isLoggedIn()) {
    // 현재 상품 정보 임시 저장 (로그인 후 복귀용)
    if (info) {
      sessionStorage.setItem('pending_kakao_consult', JSON.stringify(info));
    }
    // 현재 페이지 경로 저장 (로그인 후 복귀용)
    sessionStorage.setItem(
      'redirect_after_login',
      window.location.pathname + window.location.search,
    );

    showToast('상담을 위해 로그인이 필요합니다.', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1000);
    return;
  }

  // 2. 닉네임 가져오기
  const nick = localStorage.getItem('dapick_nick') || '';

  // 3. 메시지 구성
  let lines = ['[다픽 상담 신청]'];
  if (nick) lines.push(`고객명: ${nick}`);

  if (info) {
    if (info.category) lines.push(`카테고리: ${info.category}`);
    if (info.brand) lines.push(`브랜드: ${info.brand}`);
    if (info.productName) lines.push(`상품명: ${info.productName}`);
    if (info.color) lines.push(`색상: ${info.color}`);
    if (info.contract) lines.push(`약정: ${info.contract}`);
    if (info.cycle) lines.push(`관리주기: ${info.cycle}`);
    if (info.type) lines.push(`가입조건: ${info.type}`);
    if (info.monthly)
      lines.push(`월 렌탈료: ${Number(info.monthly).toLocaleString()}원`);
    else lines.push('월 렌탈료: 상담 요청');
  }

  const msg = lines.join('\n');

  // 4. 카카오 채팅창 열기
  window.open(
    `${KAKAO_CHANNEL_URL}?message=${encodeURIComponent(msg)}`,
    '_blank',
  );
}

/**
 * 로그인 성공 후 pending 상담 처리
 * login.js의 로그인 성공 시점에서 호출
 */
function resumePendingKakaoConsult() {
  const raw = sessionStorage.getItem('pending_kakao_consult');
  if (!raw) return;

  try {
    const info = JSON.parse(raw);
    sessionStorage.removeItem('pending_kakao_consult');
    // 약간의 딜레이 후 카카오 열기
    setTimeout(() => openKakaoConsult(info), 500);
  } catch (e) {
    sessionStorage.removeItem('pending_kakao_consult');
  }
}

// ════════════════════════════════════════════════════
// 모달
// ════════════════════════════════════════════════════
function openModal(summaryHtml) {
  const el = document.getElementById('modal-summary');
  if (el && summaryHtml) el.innerHTML = summaryHtml;
  document.getElementById('modal').classList.add('show');
}
function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

// ── 상담 신청 제출 ──
async function submitConsult() {
  const name = document.getElementById('input-name').value.trim();
  const phone = document.getElementById('input-phone').value.trim();

  if (!name || !phone) {
    showToast('이름과 연락처를 입력해주세요', 'error');
    return;
  }
  if (!/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone.replace(/-/g, ''))) {
    showToast('올바른 연락처를 입력해주세요', 'error');
    return;
  }

  try {
    await submitConsultApi(
      name,
      phone,
      document.getElementById('modal-summary')?.innerText || '',
    );
    closeModal();
    showToast(
      `${name}님, 상담 신청 완료! 빠른 시간 내 연락드립니다 😊`,
      'success',
    );
    document.getElementById('input-name').value = '';
    document.getElementById('input-phone').value = '';
  } catch (e) {
    showToast(e.message || '상담 신청 실패', 'error');
  }
}

// ════════════════════════════════════════════════════
// 토스트 알림
// ════════════════════════════════════════════════════
function showToast(message, type = 'success') {
  const container =
    document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    background: ${type === 'error' ? '#EF4444' : type === 'info' ? '#6C3FC5' : '#22C55E'};
    color: #fff;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 16px rgba(0,0,0,.2);
    animation: slideInRight .3s ease;
    max-width: 300px;
    word-break: keep-all;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const el = document.createElement('div');
  el.id = 'toast-container';
  el.style.cssText =
    'position:fixed;top:80px;right:20px;z-index:600;display:flex;flex-direction:column;gap:8px;';
  document.body.appendChild(el);
  return el;
}

// ── 스크롤 탑 버튼 표시 ──
function initScrollTop() {
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top');
    if (!btn) return;
    window.scrollY > 400
      ? btn.classList.add('show')
      : btn.classList.remove('show');
  });
}

// ── 공통 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  initScrollTop();
});
