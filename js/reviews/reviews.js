// ════════════════════════════════════════════════════
// reviews.js — 실제 후기 통합 탭 (조각2-③)
// 카테고리별 GET /api/reviews 조회 + 글쓰기 진입 안내.
// ※ 실제 작성은 마이페이지 신청내역(완료 상담 자격검사) 경유 — 여기선 조회 + 안내만.
// 전역 충돌 방지 위해 헬퍼는 rv* 접두어.
// ════════════════════════════════════════════════════

// 카테고리 상수 — 확장 대비 1곳 관리 (하드코딩 최소화)
const RV_CATEGORIES = [
  { cat: 'WATER', label: '정수기' },
  { cat: 'RENTAL', label: '렌탈' },
  { cat: 'INTERNET_TV', label: '인터넷TV' },
];
const RV_PAGE_SIZE = 10;

let rvCurrentCat = RV_CATEGORIES[0].cat;
let rvPage = 0;
let rvLoading = false;
let rvModalConfirm = null;

document.addEventListener('DOMContentLoaded', () => {
  rvRenderTabs();
  rvBindWrite();
  rvBindModal();
  rvSelectCat(rvCurrentCat);
});

// ── 카테고리 탭 (가로 버튼) ───────────────────────────
function rvRenderTabs() {
  const el = document.getElementById('rvTabs');
  el.innerHTML = RV_CATEGORIES.map(
    (c) =>
      `<button type="button" class="rv-tab${c.cat === rvCurrentCat ? ' is-active' : ''}" data-cat="${c.cat}">${rvEscape(c.label)}</button>`,
  ).join('');
  el.querySelectorAll('.rv-tab').forEach((btn) => {
    btn.addEventListener('click', () => rvSelectCat(btn.dataset.cat));
  });
}

function rvSelectCat(cat) {
  rvCurrentCat = cat;
  rvPage = 0;
  document.querySelectorAll('#rvTabs .rv-tab').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.cat === cat);
  });
  rvLoadReviews(true);
}

// ── 목록 조회 (reset=true: 새 카테고리, false: 더보기 append) ──
async function rvLoadReviews(reset) {
  if (rvLoading) return;
  rvLoading = true;

  const list = document.getElementById('rvList');
  if (reset) list.innerHTML = '<div class="rv-empty">불러오는 중...</div>';

  try {
    const data = await api.get(
      `/api/reviews?category=${encodeURIComponent(rvCurrentCat)}&page=${rvPage}&size=${RV_PAGE_SIZE}`,
    );
    const items = (data && data.content) || [];
    const totalPages = (data && data.totalPages) || 0;

    if (reset) list.innerHTML = '';
    if (reset && items.length === 0) {
      list.innerHTML =
        '<div class="rv-empty">아직 등록된 후기가 없습니다.</div>';
      rvRenderMore(false);
      return;
    }
    list.insertAdjacentHTML('beforeend', items.map(rvCardHtml).join(''));
    rvRenderMore(rvPage + 1 < totalPages);
  } catch (e) {
    if (reset) {
      list.innerHTML =
        '<div class="rv-empty">후기를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    }
    rvRenderMore(false);
  } finally {
    rvLoading = false;
  }
}

// ── 리뷰 카드 1건 (모든 값 escape) ────────────────────
function rvCardHtml(r) {
  const rating = rvClampRating(r && r.rating);
  const stars =
    '<span class="rv-card__stars">' +
    '★'.repeat(rating) +
    '<span class="rv-card__stars-off">' +
    '★'.repeat(5 - rating) +
    '</span></span>';
  const thumb =
    r && r.imageUrl
      ? `<div class="rv-card__thumb"><img src="${rvEscape(r.imageUrl)}" alt="" loading="lazy"></div>`
      : '';
  const content =
    r && r.content
      ? `<p class="rv-card__content">${rvEscape(r.content)}</p>`
      : '';

  return `
    <article class="rv-card">
      ${thumb}
      <div class="rv-card__body">
        ${stars}
        ${content}
        <div class="rv-card__meta">
          <span class="rv-card__product">${rvEscape((r && r.productName) || '-')}</span>
          <span class="rv-card__author">${rvEscape((r && r.authorName) || '익명')}</span>
          <span class="rv-card__date">${rvDate(r && r.createdAt)}</span>
        </div>
      </div>
    </article>`;
}

// ── 더보기 버튼 ───────────────────────────────────────
function rvRenderMore(show) {
  const el = document.getElementById('rvMore');
  if (!show) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML =
    '<button type="button" class="rv-more-btn" id="rvMoreBtn">더보기</button>';
  document.getElementById('rvMoreBtn').addEventListener('click', () => {
    rvPage += 1;
    rvLoadReviews(false);
  });
}

// ── 글쓰기 버튼 → 로그인/작성 안내 모달 ────────────────
function rvBindWrite() {
  document.getElementById('rvWriteBtn').addEventListener('click', () => {
    if (!rvLoggedIn()) {
      rvOpenModal(
        '로그인 후 이용 가능합니다.\n로그인 페이지로 이동하시겠습니까?',
        () => {
          window.location.href = 'login.html';
        },
      );
    } else {
      // 실제 작성은 마이페이지 신청내역(완료 상담 자격검사) 경유
      rvOpenModal(
        '신청 내역에서 완료된 상담에 리뷰를 작성할 수 있습니다.\n신청 내역으로 이동할까요?',
        () => {
          window.location.href = 'mypage.html';
        },
      );
    }
  });
}

// ── 모달 (안내/확인 공용) ─────────────────────────────
function rvBindModal() {
  const modal = document.getElementById('rvModal');
  modal.querySelectorAll('[data-rv-close]').forEach((el) => {
    el.addEventListener('click', () => {
      modal.hidden = true;
    });
  });
  document.getElementById('rvModalConfirm').addEventListener('click', () => {
    modal.hidden = true;
    if (rvModalConfirm) rvModalConfirm();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.hidden = true;
  });
}

function rvOpenModal(msg, onConfirm) {
  document.getElementById('rvModalMsg').textContent = msg;
  rvModalConfirm = onConfirm;
  document.getElementById('rvModal').hidden = false;
}

// ── 유틸 (rv 접두어 — 전역 충돌 방지) ─────────────────
function rvLoggedIn() {
  return typeof isLoggedIn === 'function'
    ? isLoggedIn()
    : !!localStorage.getItem('dapick_token');
}

function rvClampRating(v) {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 0) return 0;
  return n > 5 ? 5 : n;
}

function rvDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

function rvEscape(s) {
  if (s == null) return '';
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
}
