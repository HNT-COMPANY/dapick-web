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
const rvById = {}; // id → 리뷰 원본 (상세 모달용)

document.addEventListener('DOMContentLoaded', () => {
  rvRenderTabs();
  rvBindWrite();
  rvBindModal();
  rvSetupDetail(); // 상세 모달 + 카드 클릭 위임
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
    items.forEach((it) => {
      if (it && it.id != null) rvById[it.id] = it;
    });
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
  const imgs =
    r && Array.isArray(r.imageUrls) && r.imageUrls.length
      ? r.imageUrls
      : r && r.imageUrl
        ? [r.imageUrl]
        : [];
  const thumb = imgs.length
    ? `<div class="rv-card__thumb"><img src="${rvEscape(imgs[0])}" alt="" loading="lazy">${
        imgs.length > 1
          ? `<span class="rv-card__imgcount">+${imgs.length - 1}</span>`
          : ''
      }</div>`
    : '';
  const content =
    r && r.content
      ? `<p class="rv-card__content">${rvEscape(r.content)}</p>`
      : '';

  return `
    <article class="rv-card" data-id="${r && r.id != null ? r.id : ''}" role="button" tabindex="0">
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

// ════════════════════════════════════════════════════
// 상세 모달 — 카드 클릭 시 전체 글 + 이미지 전부 (아정당식)
// (조회수/좋아요/댓글/태그는 백엔드 데이터 없어 이번 범위 제외)
// ════════════════════════════════════════════════════
function rvSetupDetail() {
  injectRvDetailStyles();

  const modal = document.createElement('div');
  modal.className = 'rvd-modal';
  modal.id = 'rvDetailModal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="rvd-backdrop" data-rvd-close></div>' +
    '<div class="rvd-panel" role="dialog" aria-modal="true">' +
    '  <button type="button" class="rvd-close" data-rvd-close aria-label="닫기">×</button>' +
    '  <div class="rvd-body" id="rvDetailBody"></div>' +
    '</div>';
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-rvd-close]').forEach((el) => {
    el.addEventListener('click', rvCloseDetail);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') rvCloseDetail();
  });

  // 카드 클릭 위임 (목록은 동적 렌더라 위임 사용)
  const listEl = document.getElementById('rvList');
  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const card = e.target.closest('.rv-card');
      if (card && card.dataset.id) rvOpenDetail(card.dataset.id);
    });
    listEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.rv-card');
        if (card && card.dataset.id) {
          e.preventDefault();
          rvOpenDetail(card.dataset.id);
        }
      }
    });
  }
}

function rvOpenDetail(id) {
  const r = rvById[id];
  if (!r) return;
  const body = document.getElementById('rvDetailBody');
  if (body) body.innerHTML = rvDetailHtml(r);
  const modal = document.getElementById('rvDetailModal');
  if (modal) {
    modal.hidden = false;
    modal.scrollTop = 0;
  }
  document.body.style.overflow = 'hidden';
}

function rvCloseDetail() {
  const modal = document.getElementById('rvDetailModal');
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';
}

function rvCatLabel(cat) {
  const found = RV_CATEGORIES.find((c) => c.cat === cat);
  return found ? found.label : cat || '후기';
}

function rvCtaHref(cat) {
  if (cat === 'WATER') return '/water';
  if (cat === 'RENTAL') return '/rental';
  return '/internet';
}

function rvDetailHtml(r) {
  const rating = rvClampRating(r && r.rating);
  const stars =
    '<span class="rvd-stars">' +
    '★'.repeat(rating) +
    '<span class="rvd-stars-off">' +
    '★'.repeat(5 - rating) +
    '</span></span>';
  const imgs =
    r && Array.isArray(r.imageUrls) && r.imageUrls.length
      ? r.imageUrls
      : r && r.imageUrl
        ? [r.imageUrl]
        : [];
  const gallery = imgs.length
    ? '<div class="rvd-gallery">' +
      imgs
        .map(
          (u) =>
            '<img class="rvd-img" src="' +
            rvEscape(u) +
            '" alt="" loading="lazy">',
        )
        .join('') +
      '</div>'
    : '';
  const content = r && r.content ? rvEscape(r.content) : '';

  return (
    '<div class="rvd-crumb">후기 › ' +
    rvEscape(rvCatLabel(r && r.category)) +
    '</div>' +
    '<div class="rvd-head">' +
    stars +
    '<span class="rvd-date">' +
    rvDate(r && r.createdAt) +
    '</span></div>' +
    '<div class="rvd-author">' +
    rvEscape((r && r.authorName) || '익명') +
    ' · ' +
    rvEscape((r && r.productName) || '-') +
    '</div>' +
    (content ? '<p class="rvd-content">' + content + '</p>' : '') +
    gallery +
    '<a class="rvd-cta" href="' +
    rvCtaHref(r && r.category) +
    '">최대 지원금 받고 나도 신청하기 →</a>' +
    '<button type="button" class="rvd-list-btn" data-rvd-close>목록으로</button>'
  );
}

function injectRvDetailStyles() {
  if (document.getElementById('rvd-styles')) return;
  const css =
    '.rvd-modal[hidden]{display:none;}' +
    '.rvd-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-start;' +
    'justify-content:center;padding:24px 12px;overflow-y:auto;}' +
    '.rvd-backdrop{position:fixed;inset:0;background:rgba(20,16,40,.55);}' +
    '.rvd-panel{position:relative;z-index:1;width:100%;max-width:900px;background:#fff;' +
    "border-radius:16px;padding:32px 32px 28px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:'Noto Sans KR',sans-serif;}" +
    '.rvd-close{position:absolute;top:14px;right:16px;width:32px;height:32px;border:none;' +
    'background:#f2f0f8;border-radius:50%;font-size:20px;line-height:1;color:#6b6b7b;cursor:pointer;}' +
    '.rvd-crumb{font-size:13px;color:#8a8a99;margin-bottom:12px;}' +
    '.rvd-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}' +
    '.rvd-stars{font-size:18px;letter-spacing:2px;color:#ffb400;}' +
    '.rvd-stars-off{color:#dcd7e8;}' +
    '.rvd-date{font-size:13px;color:#aaa;}' +
    '.rvd-author{font-size:13px;font-weight:600;color:#5b3fbe;margin-bottom:16px;}' +
    '.rvd-content{font-size:15px;line-height:1.75;color:#2a2a35;white-space:pre-wrap;' +
    'word-break:break-word;margin:0 0 18px;}' +
    '.rvd-gallery{display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:20px;}' +
    '.rvd-img{max-width:100%;max-height:70vh;border-radius:12px;display:block;margin:0 auto;object-fit:contain;}' +
    '.rvd-cta{display:block;text-align:center;background:#5b3fbe;color:#fff;text-decoration:none;' +
    'font-weight:700;font-size:15px;padding:14px;border-radius:12px;margin-bottom:10px;}' +
    '.rvd-list-btn{display:block;width:100%;background:#fff;border:1px solid #d7d2e6;' +
    'border-radius:12px;padding:12px;font-size:14px;font-weight:600;color:#555;cursor:pointer;}' +
    // 카드: 클릭 커서 + 다중 이미지 배지
    '.rv-card{cursor:pointer;}' +
    '.rv-card__thumb{position:relative;}' +
    '.rv-card__imgcount{position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.6);' +
    'color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:10px;}';
  const style = document.createElement('style');
  style.id = 'rvd-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
