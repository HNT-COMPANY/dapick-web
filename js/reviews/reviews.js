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

// 흑백 자물쇠 (컬러 이모지 X — SVG monochrome)
const RV_LOCK_SVG =
  '<svg class="rv-lock" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">' +
  '<path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z"/></svg>';

// ── 리뷰 카드 1건 (모든 값 escape) ────────────────────
function rvCardHtml(r) {
  // 가림(숨김) 후기: 원본 미노출, 자물쇠 + 안내문구 (클릭 불가)
  if (r && r.hidden) {
    return (
      '<article class="rv-card rv-card--hidden">' +
      '<div class="rv-card__lockrow">' +
      RV_LOCK_SVG +
      '<span>관리자에 의해 가림 처리 되었습니다.</span>' +
      '</div></article>'
    );
  }
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
  const titleHtml =
    r && r.title ? `<p class="rv-card__title">${rvEscape(r.title)}</p>` : '';
  const content =
    r && r.content
      ? `<p class="rv-card__content">${rvEscape(r.content)}</p>`
      : '';

  return `
    <article class="rv-card" data-id="${r && r.id != null ? r.id : ''}" role="button" tabindex="0">
      ${thumb}
      <div class="rv-card__body">
        ${stars}
        ${titleHtml}
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

// ── 글쓰기 버튼 → 블록 에디터 (로그인 + 완료 상담 필요) ────────────────
function rvBindWrite() {
  document.getElementById('rvWriteBtn').addEventListener('click', () => {
    if (!rvLoggedIn()) {
      rvOpenModal(
        '로그인 후 이용 가능합니다.\n로그인 페이지로 이동하시겠습니까?',
        () => {
          window.location.href = '/login';
        },
      );
      return;
    }
    rvOpenEditor();
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
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd} ${hh}:${mi}`;
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
  const title = r && r.title ? '<h2 class="rvd-title">' + rvEscape(r.title) + '</h2>' : '';
  const blocks = r && Array.isArray(r.contentBlocks) ? r.contentBlocks : [];
  let bodyHtml;
  if (blocks.length) {
    // 블록형: 텍스트/이미지 순서대로
    bodyHtml = blocks
      .map((b) => {
        if (b && b.type === 'image' && b.url)
          return '<img class="rvd-img" src="' + rvEscape(b.url) + '" alt="" loading="lazy">';
        if (b && b.type === 'text' && b.text)
          return '<p class="rvd-content">' + rvEscape(b.text) + '</p>';
        return '';
      })
      .join('');
  } else {
    // 구 데이터: 평문 + 이미지 갤러리
    const content = r && r.content ? rvEscape(r.content) : '';
    bodyHtml = (content ? '<p class="rvd-content">' + content + '</p>' : '') + gallery;
  }

  return (
    '<div class="rvd-crumb">후기 › ' +
    rvEscape(rvCatLabel(r && r.category)) +
    '</div>' +
    title +
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
    '<div class="rvd-blockbody">' +
    bodyHtml +
    '</div>' +
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
    '.rvd-title{font-size:22px;font-weight:800;color:#1e1b2e;margin:0 0 12px;line-height:1.35;}' +
    '.rvd-blockbody{margin-bottom:20px;}' +
    '.rvd-blockbody .rvd-img{margin:10px auto;}' +
    '.rv-card__title{font-size:15px;font-weight:700;color:#1e1b2e;margin:2px 0 4px;' +
    'display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}' +
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
    'color:#fff;font-size:11px;font-weight:600;padding:2px 6px;border-radius:10px;}' +
    // 가림(숨김) 후기 카드
    '.rv-card--hidden{cursor:default;}' +
    '.rv-card__lockrow{display:flex;align-items:center;gap:8px;padding:22px 20px;' +
    'color:#9a9aa5;font-size:14px;}' +
    '.rv-lock{color:#9a9aa5;flex:none;}';
  const style = document.createElement('style');
  style.id = 'rvd-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// ════════════════════════════════════════════════════
// 블록 에디터 — 제목 + 별점 + 상담선택 + 텍스트/이미지 블록(추가·재배치·삭제)
// ════════════════════════════════════════════════════
const rvEd = {
  consultationId: null,
  rating: 0,
  blocks: [], // [{type:'text',text}|{type:'image',url}]
  uploading: false,
  submitting: false,
};

function rvEnsureEditor() {
  if (document.getElementById('rvEditorModal')) return;
  injectRvEditorStyles();
  const modal = document.createElement('div');
  modal.className = 'rve-modal';
  modal.id = 'rvEditorModal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="rve-backdrop" data-rve-close></div>' +
    '<div class="rve-panel" role="dialog" aria-modal="true">' +
    '  <div class="rve-header"><span>후기 작성</span>' +
    '    <button type="button" class="rve-x" data-rve-close aria-label="닫기">×</button></div>' +
    '  <div class="rve-body">' +
    '    <label class="rve-label">어떤 상담 후기인가요?</label>' +
    '    <select class="rve-select" id="rveConsult"></select>' +
    '    <label class="rve-label">제목</label>' +
    '    <input class="rve-input" id="rveTitle" maxlength="200" placeholder="제목을 입력하세요">' +
    '    <label class="rve-label">별점</label>' +
    '    <div class="rve-stars" id="rveStars"></div>' +
    '    <label class="rve-label">내용 (텍스트·사진을 추가하고 순서를 바꿀 수 있어요)</label>' +
    '    <div class="rve-blocks" id="rveBlocks"></div>' +
    '    <div class="rve-addbar">' +
    '      <button type="button" class="rve-addbtn" id="rveAddText">＋ 텍스트</button>' +
    '      <label class="rve-addbtn" id="rveAddImgLabel">＋ 사진' +
    '        <input type="file" id="rveFile" accept="image/*" multiple hidden></label>' +
    '      <span class="rve-imgcount" id="rveImgCount">사진 0 / 5</span>' +
    '    </div>' +
    '  </div>' +
    '  <div class="rve-footer">' +
    '    <button type="button" class="rve-btn rve-btn--ghost" data-rve-close>취소</button>' +
    '    <button type="button" class="rve-btn rve-btn--primary" id="rveSubmit">등록</button>' +
    '  </div>' +
    '</div>';
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-rve-close]').forEach((el) => {
    el.addEventListener('click', rvCloseEditor);
  });
  document.getElementById('rveAddText').addEventListener('click', () => {
    rvEd.blocks.push({ type: 'text', text: '' });
    rvRenderBlocks();
  });
  document.getElementById('rveFile').addEventListener('change', rvEdFiles);
  document.getElementById('rveConsult').addEventListener('change', (e) => {
    rvEd.consultationId = e.target.value || null;
  });
  document.getElementById('rveSubmit').addEventListener('click', rvEdSubmit);
}

function rvOpenEditor() {
  rvEnsureEditor();
  api
    .get('/api/reviews/eligible')
    .then((list) => {
      const arr = Array.isArray(list) ? list : [];
      if (!arr.length) {
        rvOpenModal(
          '작성 가능한 완료 상담이 없습니다.\n상담이 완료되면 후기를 작성할 수 있어요.',
          null,
        );
        return;
      }
      rvEd.consultationId = arr[0].consultationId;
      rvEd.rating = 0;
      rvEd.blocks = [{ type: 'text', text: '' }];
      rvEd.uploading = false;
      rvEd.submitting = false;

      document.getElementById('rveConsult').innerHTML = arr
        .map(
          (c) =>
            '<option value="' +
            rvEscape(c.consultationId) +
            '">' +
            rvEscape((c.productName || '상담') + ' · ' + rvDate(c.createdAt)) +
            '</option>',
        )
        .join('');
      document.getElementById('rveTitle').value = '';
      rvRenderStars();
      rvRenderBlocks();
      document.getElementById('rvEditorModal').hidden = false;
      document.body.style.overflow = 'hidden';
    })
    .catch(() => {
      rvOpenModal(
        '작성 자격을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
        null,
      );
    });
}

function rvCloseEditor() {
  const modal = document.getElementById('rvEditorModal');
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';
}

function rvRenderStars() {
  const el = document.getElementById('rveStars');
  if (!el) return;
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s +=
      '<button type="button" class="rve-star' +
      (i <= rvEd.rating ? ' on' : '') +
      '" data-v="' +
      i +
      '">★</button>';
  }
  el.innerHTML = s;
  el.querySelectorAll('.rve-star').forEach((b) => {
    b.addEventListener('click', () => {
      rvEd.rating = parseInt(b.dataset.v, 10);
      rvRenderStars();
    });
  });
}

function rvImgCount() {
  return rvEd.blocks.filter((b) => b.type === 'image').length;
}

function rvRenderBlocks() {
  const el = document.getElementById('rveBlocks');
  if (!el) return;
  el.innerHTML = rvEd.blocks
    .map((b, i) => {
      const ctrls =
        '<div class="rve-blk-ctrl">' +
        '<button type="button" data-act="up" data-i="' + i + '" title="위로">▲</button>' +
        '<button type="button" data-act="down" data-i="' + i + '" title="아래로">▼</button>' +
        '<button type="button" data-act="del" data-i="' + i + '" title="삭제">✕</button>' +
        '</div>';
      const inner =
        b.type === 'image'
          ? '<img class="rve-blk-img" src="' + rvEscape(b.url) + '" alt="">'
          : '<textarea class="rve-blk-text" data-i="' +
            i +
            '" rows="3" placeholder="내용을 입력하세요">' +
            rvEscape(b.text || '') +
            '</textarea>';
      return '<div class="rve-blk">' + ctrls + inner + '</div>';
    })
    .join('');

  el.querySelectorAll('textarea.rve-blk-text').forEach((t) => {
    t.addEventListener('input', () => {
      const i = parseInt(t.dataset.i, 10);
      if (rvEd.blocks[i]) rvEd.blocks[i].text = t.value;
    });
  });
  el.querySelectorAll('.rve-blk-ctrl button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.i, 10);
      const act = btn.dataset.act;
      if (act === 'del') {
        rvEd.blocks.splice(i, 1);
      } else if (act === 'up' && i > 0) {
        const tmp = rvEd.blocks[i - 1];
        rvEd.blocks[i - 1] = rvEd.blocks[i];
        rvEd.blocks[i] = tmp;
      } else if (act === 'down' && i < rvEd.blocks.length - 1) {
        const tmp = rvEd.blocks[i + 1];
        rvEd.blocks[i + 1] = rvEd.blocks[i];
        rvEd.blocks[i] = tmp;
      }
      rvRenderBlocks();
    });
  });

  const cnt = document.getElementById('rveImgCount');
  if (cnt) {
    cnt.textContent =
      '사진 ' + rvImgCount() + ' / 5' + (rvEd.uploading ? ' (업로드 중...)' : '');
  }
  const lbl = document.getElementById('rveAddImgLabel');
  if (lbl) {
    const dis = rvImgCount() >= 5 || rvEd.uploading;
    lbl.style.opacity = dis ? '.5' : '1';
    lbl.style.pointerEvents = dis ? 'none' : 'auto';
  }
}

function rvEdFiles(e) {
  const files = Array.prototype.slice.call(e.target.files || []);
  e.target.value = '';
  if (!files.length) return;
  const remaining = 5 - rvImgCount();
  if (remaining <= 0) {
    alert('사진은 최대 5장까지 첨부할 수 있어요.');
    return;
  }
  const toUp = files.slice(0, remaining);
  rvEd.uploading = true;
  rvRenderBlocks();
  Promise.all(
    toUp.map((f) =>
      rvUploadImage(f)
        .then((d) => {
          if (d && d.url) rvEd.blocks.push({ type: 'image', url: d.url });
        })
        .catch((err) => alert((err && err.message) || '이미지 업로드 실패')),
    ),
  ).then(() => {
    rvEd.uploading = false;
    rvRenderBlocks();
  });
}

function rvUploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = localStorage.getItem('dapick_token');
  return fetch(BASE_URL + '/api/reviews/images', {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: fd,
  }).then((res) =>
    res.text().then((text) => {
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e2) {
          /* 비-JSON 무시 */
        }
      }
      if (!res.ok) {
        throw new Error(
          (data && data.message) || '업로드 실패 (' + res.status + ')',
        );
      }
      return (data && (data.data != null ? data.data : data)) || {};
    }),
  );
}

function rvEdSubmit() {
  if (rvEd.submitting) return;
  if (rvEd.uploading) {
    alert('이미지 업로드가 끝난 뒤 등록해주세요.');
    return;
  }
  if (!rvEd.consultationId) {
    alert('후기를 작성할 상담을 선택해주세요.');
    return;
  }
  if (!rvEd.rating) {
    alert('별점을 선택해주세요.');
    return;
  }
  const title = document.getElementById('rveTitle').value.trim();
  if (!title) {
    alert('제목을 입력해주세요.');
    return;
  }
  const blocks = rvEd.blocks
    .map((b) =>
      b.type === 'text'
        ? { type: 'text', text: (b.text || '').trim() }
        : { type: 'image', url: b.url },
    )
    .filter((b) => (b.type === 'text' ? b.text : b.url));

  rvEd.submitting = true;
  const btn = document.getElementById('rveSubmit');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '등록 중...';
  }

  api
    .post('/api/reviews', {
      consultationId: rvEd.consultationId,
      title: title,
      rating: rvEd.rating,
      contentBlocks: blocks,
    })
    .then((res) => {
      if (res === null) return;
      rvCloseEditor();
      rvOpenModal(
        '후기가 등록되었습니다. 승인 후 목록에 노출됩니다. 감사합니다!',
        null,
      );
      rvSelectCat(rvCurrentCat);
    })
    .catch((e) => {
      alert((e && e.message) || '후기 등록에 실패했습니다.');
    })
    .finally(() => {
      rvEd.submitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '등록';
      }
    });
}

function injectRvEditorStyles() {
  if (document.getElementById('rve-styles')) return;
  const css =
    '.rve-modal[hidden]{display:none;}' +
    '.rve-modal{position:fixed;inset:0;z-index:1100;display:flex;align-items:flex-start;' +
    'justify-content:center;padding:20px 12px;overflow-y:auto;}' +
    '.rve-backdrop{position:fixed;inset:0;background:rgba(20,16,40,.55);}' +
    ".rve-panel{position:relative;z-index:1;width:100%;max-width:640px;background:#fff;" +
    "border-radius:16px;overflow:hidden;font-family:'Noto Sans KR',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.25);}" +
    '.rve-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;' +
    'border-bottom:1px solid #eee;font-weight:700;font-size:16px;}' +
    '.rve-x{border:none;background:#f2f0f8;width:30px;height:30px;border-radius:50%;font-size:18px;cursor:pointer;color:#6b6b7b;}' +
    '.rve-body{padding:18px 20px;max-height:66vh;overflow-y:auto;}' +
    '.rve-label{display:block;font-size:13px;font-weight:600;color:#555;margin:14px 0 6px;}' +
    '.rve-select,.rve-input{width:100%;box-sizing:border-box;border:1px solid #e0dced;' +
    'border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;}' +
    '.rve-stars{display:flex;gap:2px;}' +
    '.rve-star{background:none;border:none;font-size:26px;line-height:1;color:#dcd7e8;cursor:pointer;padding:0 2px;}' +
    '.rve-star.on{color:#ffb400;}' +
    '.rve-blocks{display:flex;flex-direction:column;gap:10px;}' +
    '.rve-blk{position:relative;border:1px solid #ece8f6;border-radius:10px;padding:10px 10px 10px 44px;background:#faf9fe;}' +
    '.rve-blk-ctrl{position:absolute;left:6px;top:8px;display:flex;flex-direction:column;gap:2px;}' +
    '.rve-blk-ctrl button{width:26px;height:22px;border:1px solid #ded7ef;background:#fff;' +
    'border-radius:6px;font-size:11px;cursor:pointer;color:#6b6b7b;padding:0;}' +
    '.rve-blk-text{width:100%;box-sizing:border-box;border:none;background:transparent;' +
    'resize:vertical;font-size:14px;font-family:inherit;outline:none;}' +
    '.rve-blk-img{max-width:100%;border-radius:8px;display:block;}' +
    '.rve-addbar{display:flex;align-items:center;gap:8px;margin-top:12px;}' +
    '.rve-addbtn{border:1px dashed #b7a9e0;background:#fff;color:#5b3fbe;border-radius:10px;' +
    'padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;}' +
    '.rve-imgcount{font-size:12px;color:#8a8a99;margin-left:auto;}' +
    '.rve-footer{display:flex;gap:10px;padding:14px 20px;border-top:1px solid #eee;}' +
    '.rve-btn{flex:1;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}' +
    '.rve-btn--ghost{background:#f2f0f8;color:#555;}' +
    '.rve-btn--primary{background:#5b3fbe;color:#fff;}' +
    '.rve-btn--primary:disabled{opacity:.6;cursor:default;}';
  const style = document.createElement('style');
  style.id = 'rve-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
