// utils.js — 다픽 웹 공통 유틸

// ── 페이지 이동 ──
function goPage(cat) {
  const pages = {
    internet: 'internet.html',
    phone: 'phone.html',
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

// ── 카카오 상담 ──
function openKakao() {
  // 추후 실제 카카오 채널 URL로 변경
  // window.open('https://pf.kakao.com/YOUR_CHANNEL', '_blank');
  showToast('카카오톡 상담 채널로 이동합니다!', 'info');
}

// ── 모달 ──
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
  // 전화번호 간단 검증
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
    // 입력 초기화
    document.getElementById('input-name').value = '';
    document.getElementById('input-phone').value = '';
  } catch (e) {
    showToast(e.message || '상담 신청 실패', 'error');
  }
}

// ── 토스트 알림 ──
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

// ── 공통 초기화 (모든 페이지) ──
document.addEventListener('DOMContentLoaded', () => {
  initScrollTop();
});
