//
// reviews.js — 실제 후기 통합 탭 (조각2-③)
// 카테고리별 GET /api/reviews 조회 + 글쓰기 진입 안내.
// ※ 실제 작성은 마이페이지 신청내역(완료 상담 자격검사) 경유 — 여기선 조회 + 안내만.
// 전역 충돌 방지 위해 헬퍼는 rv* 접두어.
//

// ── 카테고리 탭 (2026-08-06 전면 교체) ────────────────────────────
//
// 예전에는 여기에 네 줄이 박혀 있었다. 관리자가 카테고리를 만들어도 탭이 안 생겼다.
// 이제 /api/categories 에서 받아 그린다 — 이 파일은 카테고리가 늘어도 안 고친다.
//
// 왜 type(enum)이 아니라 id 로 다루나
//   관리자가 만드는 최상위 카테고리는 서버에서 전부 GENERIC 한 값을 공유한다.
//   type 을 열쇠로 쓰면 새 카테고리 둘이 서로를 덮어써서, 탭은 두 개인데
//   내용이 같은 상태가 된다. 오류가 안 나서 원인 찾기가 오래 걸리는 종류다.
//   그래서 탭 · 조회 · 라벨을 전부 카테고리 id 로 맞춘다.
//   (백엔드도 같은 날 reviews.category_id 를 신설했다 — V20260806002)

// 받아오기 전이나 실패했을 때만 쓰는 최소 탭.
// 이건 '기본값'이지 정의가 아니다. 여기에 새 카테고리를 추가하지 말 것 —
//   추가해야 할 것 같으면 그건 /api/categories 가 안 내려주고 있다는 뜻이다.
const RV_FALLBACK_TABS = [
  { id: 'ALL', label: '전체' },
];

const RV_ALL_TAB = { id: 'ALL', label: '전체' };

// 새 카테고리의 '신청하러 가기' 는 /c/{slug} 로 보낸다(_worker.js 가 category.html 로 넘긴다).
// 전용 화면이 있는 것만 여기 적는다. 없는 타입은 자동으로 /c/{slug} 를 탄다.
const RV_CTA_BY_TYPE = {
  WATER: '/water',
  RENTAL: '/rental',
  INTERNET_TV: '/internet',
  CARD: '/card',
  PHONE: '/mobile',
};

const RV_PAGE_SIZE = 24; // 3열 × 8줄

// 이미지 미첨부 시 카드 썸네일 기본값 (다픽 로고)
const RV_LOGO = '/assets/logos/dapicklogo.png';

// 해시태그 화이트리스트(고정 5종, '#'은 표시할 때 부착) — 백엔드 화이트리스트와 일치.
const RV_HASHTAGS = ['다픽', '만족', '박리다매', '친절한요금', '친절한상담'];

// 인터넷TV 하위탭(통신사) — carrier 값은 InternetTvProduct.carrier 와 정확히 일치해야 함(gnb.js 동일).
const RV_CARRIER_SUBTABS = [
  { label: '전체', carrier: null },
  { label: 'SKT', carrier: 'SKT' },
  { label: 'KT', carrier: 'KT' },
  { label: 'LG U+', carrier: 'LG U+' },
];

// 화면에 그릴 탭 목록. 서버에서 받은 뒤 채워진다.
let rvCategories = RV_FALLBACK_TABS.slice();
// 'ALL' 또는 카테고리 id
let rvCurrentCat = 'ALL';
let rvCurrentCarrier = null; // 인터넷 하위탭 선택 통신사
let rvCurrentSubCat = null; // 정수기/렌탈 하위탭 선택 자식 카테고리 id
let rvPage = 0;
let rvLoading = false;
let rvModalConfirm = null;
const rvById = {}; // id → 리뷰 원본 (상세 모달용)

// 카테고리 id → 카테고리 객체(children 포함). /api/categories 1회 조회 캐시.
// 정수기/렌탈의 "브랜드"(코웨이 등)는 brands 테이블이 아니라 자식 카테고리이므로 children 을 하위탭으로 쓴다.
let rvCatById = {};
// (구) type → 카테고리. 옛 주소 ?category=WATER 와 categoryId 가 없는 옛 후기를 읽을 때만 쓴다.
// GENERIC 은 여러 카테고리가 공유하므로 여기서 마지막 하나만 남는다. 새 코드는 쓰지 말 것.
let rvCatByType = {};
let rvCatsLoaded = false;

document.addEventListener('DOMContentLoaded', async () => {
  rvBindWrite();
  rvBindModal();
  rvSetupDetail(); // 상세 모달 + 카드 클릭 위임
  // 탭을 서버에서 받아 그리므로 이게 먼저다. 실패해도 '전체' 탭 하나로는 동작한다.
  await rvLoadCategories();
  rvCurrentCat = rvInitialCat();
  rvRenderTabs();
  rvSelectCat(rvCurrentCat);
  rvLoadTop(); // 최고 후기(좋아요순) 상단 노출
});

// 딥링크로 들어온 초기 탭.
// 주소는 셋 다 받는다 — 배포된 화면과 사람들이 저장해 둔 링크를 깨지 않기 위해서다.
//   ?categoryId={uuid}   새 주소
//   ?cat={slug}          사람이 읽을 수 있는 주소
//   ?category=WATER      구 주소. internet-unified 의 '더보기' 가 아직 이걸 쓴다
function rvInitialCat() {
  const q = new URLSearchParams(location.search);

  const byId = q.get('categoryId');
  if (byId && rvCatById[byId]) return byId;

  const slug = q.get('cat');
  if (slug) {
    const hit = rvCategories.filter(
      (c) => c.slug && String(c.slug).toLowerCase() === String(slug).toLowerCase(),
    )[0];
    if (hit) return hit.id;
  }

  const type = q.get('category');
  if (type && rvCatByType[type]) return rvCatByType[type].id;

  return 'ALL';
}

// ── 최고 후기는? (좋아요 있는 후기만, 가로 드래그 캐러셀 — 목록에도 그대로 남음) ──
async function rvLoadTop() {
  const wrap = document.getElementById('rvTop');
  const list = document.getElementById('rvTopList');
  if (!wrap || !list) return;
  try {
    const data = await api.get(
      '/api/reviews?page=0&size=20&sort=likeCount,desc',
    );
    // 좋아요 1개 이상만 (좋아요 기준 — 전부 올릴 필요 없음)
    const items = ((data && data.content) || []).filter(
      (r) => r && !r.hidden && (Number(r.likeCount) || 0) > 0,
    );
    if (!items.length) {
      wrap.hidden = true;
      return;
    }
    items.forEach((it) => {
      if (it && it.id != null) rvById[it.id] = it;
    });
    list.innerHTML = items.map(rvCardHtml).join('');
    wrap.hidden = false;
    rvSetupTopControls();
  } catch (e) {
    wrap.hidden = true;
  }
}

// 가로 캐러셀 컨트롤: 마우스 드래그 + 터치(네이티브) + 이전/다음 버튼 + 화살표 표시 갱신
function rvSetupTopControls() {
  const vp = document.getElementById('rvTopViewport');
  if (!vp) return;
  const prev = document.querySelector('.rv-top-prev');
  const next = document.querySelector('.rv-top-next');

  const stepPx = () => {
    const card = vp.querySelector('.rv-card');
    return (card ? card.getBoundingClientRect().width : 320) + 14;
  };
  const updateArrows = () => {
    const max = vp.scrollWidth - vp.clientWidth - 2;
    const overflow = max > 2;
    if (prev) prev.hidden = !overflow || vp.scrollLeft <= 2;
    if (next) next.hidden = !overflow || vp.scrollLeft >= max;
  };

  if (!vp.dataset.bound) {
    vp.dataset.bound = '1';
    if (next)
      next.addEventListener('click', () =>
        vp.scrollBy({ left: stepPx() * 1.5, behavior: 'smooth' }),
      );
    if (prev)
      prev.addEventListener('click', () =>
        vp.scrollBy({ left: -stepPx() * 1.5, behavior: 'smooth' }),
      );

    // 마우스 드래그 스크롤 (터치는 overflow-x 로 네이티브 동작)
    let down = false,
      startX = 0,
      startScroll = 0,
      moved = false;
    vp.addEventListener('mousedown', (e) => {
      down = true;
      moved = false;
      startX = e.pageX;
      startScroll = vp.scrollLeft;
      vp.classList.add('is-drag');
    });
    window.addEventListener('mousemove', (e) => {
      if (!down) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 4) moved = true;
      vp.scrollLeft = startScroll - dx;
    });
    window.addEventListener('mouseup', () => {
      down = false;
      vp.classList.remove('is-drag');
    });

    // 카드 클릭 → 상세 (드래그면 이동 취소)
    vp.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const card = e.target.closest('.rv-card');
      if (card && card.dataset.id)
        window.location.href = rvReviewUrl(card.dataset.id);
    });

    vp.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
  }
  setTimeout(updateArrows, 60);
}

// 카테고리 목록 1회 로드 → 탭 목록 + id/type 맵
// 실패해도 던지지 않는다. 카테고리를 못 받아도 '전체' 후기는 보여야 한다.
async function rvLoadCategories() {
  if (rvCatsLoaded) return;
  rvCatsLoaded = true;
  try {
    const res = await api.get('/api/categories');
    const rows = (Array.isArray(res) ? res : (res && (res.data || res.content)) || [])
      .filter((c) => c && c.id && c.isActive !== false);

    rows.forEach((c) => {
      rvCatById[c.id] = c;
      // 같은 type 이 여럿이면(=GENERIC) 첫 번째만 남긴다. 어차피 구 주소 해석용이다.
      if (c.type && !rvCatByType[c.type]) rvCatByType[c.type] = c;
    });

    if (rows.length) {
      rvCategories = [RV_ALL_TAB].concat(
        rows.map((c) => ({ id: c.id, label: c.name, type: c.type, slug: c.slug })),
      );
    }
  } catch (e) {
    // 탭은 '전체' 하나만 남고 목록은 정상 동작한다. 화면이 통째로 비지 않게 하는 게 목적이다.
    console.warn('[reviews] 카테고리 로드 실패 — 전체 탭만 표시한다', e && e.message);
  }
}

// 특정 카테고리의 자식 카테고리 목록 (활성만, sortOrder 순 — 서버가 정렬해 내려줌)
function rvSubCategories(catId) {
  const c = rvCatById[catId];
  const children = c && Array.isArray(c.children) ? c.children : [];
  return children.filter((ch) => ch && ch.id && ch.isActive !== false);
}

// ── 카테고리 탭 (가로 버튼) ───────────────────────────
function rvRenderTabs() {
  const el = document.getElementById('rvTabs');
  el.innerHTML = rvCategories
    .map(
      (c) =>
        `<button type="button" class="rv-tab${c.id === rvCurrentCat ? ' is-active' : ''}" data-cat="${rvEscape(c.id)}">${rvEscape(c.label)}</button>`,
    )
    .join('');
  el.querySelectorAll('.rv-tab').forEach((btn) => {
    btn.addEventListener('click', () => rvSelectCat(btn.dataset.cat));
  });
}

function rvSelectCat(cat) {
  rvCurrentCat = cat;
  rvCurrentCarrier = null;
  rvCurrentSubCat = null;
  rvPage = 0;
  document.querySelectorAll('#rvTabs .rv-tab').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.cat === cat);
  });
  rvRenderSubtabs(cat);
  rvLoadReviews(true);
}

// ── 카테고리 하위탭 (통신사/자식 카테고리) ───────────────────────
// 인터넷TV → 전체/SKT/KT/LG U+ (carrier). 정수기/렌탈 → 전체 + 자식 카테고리(코웨이 등).
function rvRenderSubtabs(catId) {
  const el = document.getElementById('rvSubtabs');
  if (!el) return;

  if (catId === 'ALL') {
    el.innerHTML = ''; // 전체는 하위탭 없음
    return;
  }

  // 통신사 하위탭은 인터넷TV 에만 있다. carrier 는 상품 칸이라 다른 카테고리에는 없다.
  const cat = rvCatById[catId];
  if (cat && cat.type === 'INTERNET_TV') {
    el.innerHTML = RV_CARRIER_SUBTABS.map(
      (s, i) =>
        `<button type="button" class="rv-subtab${i === 0 ? ' is-active' : ''}" data-kind="carrier" data-val="${
          s.carrier == null ? '' : rvEscape(s.carrier)
        }">${rvEscape(s.label)}</button>`,
    ).join('');
  } else {
    // 그 외: 전체 + 자식 카테고리(있을 때만). 자식이 생기면 자동으로 하위탭이 붙는다.
    const subs = rvSubCategories(catId);
    el.innerHTML =
      '<button type="button" class="rv-subtab is-active" data-kind="subcat" data-val="">전체</button>' +
      subs
        .map(
          (s) =>
            `<button type="button" class="rv-subtab" data-kind="subcat" data-val="${rvEscape(
              s.id,
            )}">${rvEscape(s.name)}</button>`,
        )
        .join('');
  }

  el.querySelectorAll('.rv-subtab').forEach((btn) => {
    btn.addEventListener('click', () => rvSelectSubtab(btn));
  });
}

function rvSelectSubtab(btn) {
  const el = document.getElementById('rvSubtabs');
  if (el) {
    el.querySelectorAll('.rv-subtab').forEach((b) =>
      b.classList.remove('is-active'),
    );
  }
  btn.classList.add('is-active');
  const val = btn.dataset.val || null;
  if (btn.dataset.kind === 'carrier') {
    rvCurrentCarrier = val;
    rvCurrentSubCat = null;
  } else {
    rvCurrentSubCat = val;
    rvCurrentCarrier = null;
  }
  rvPage = 0;
  rvLoadReviews(true);
}

// ── 목록 조회 (reset=true: 새 카테고리, false: 더보기 append) ──
async function rvLoadReviews(reset) {
  if (rvLoading) return;
  rvLoading = true;

  const list = document.getElementById('rvList');
  if (reset) list.innerHTML = '<div class="rv-empty">불러오는 중...</div>';

  try {
    const data = await api.get(rvBuildQuery());
    const items = (data && data.content) || [];
    const totalPages = (data && data.totalPages) || 0;

    if (reset) list.innerHTML = '';
    if (reset && items.length === 0) {
      list.innerHTML =
        '<div class="rv-empty">아직 등록된 후기가 없습니다.</div>';
      rvRenderPagination(0);
      return;
    }
    items.forEach((it) => {
      if (it && it.id != null) rvById[it.id] = it;
    });
    list.insertAdjacentHTML('beforeend', items.map(rvCardHtml).join(''));
    rvRenderPagination(totalPages);
  } catch (e) {
    if (reset) {
      list.innerHTML =
        '<div class="rv-empty">후기를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    }
    rvRenderPagination(0);
  } finally {
    rvLoading = false;
  }
}

// 목록 조회 쿼리 조립 — 하위탭 우선순위: carrier(인터넷) > subCategoryId(정수기/렌탈 자식) > category(전체)
function rvBuildQuery() {
  const base = `page=${rvPage}&size=${RV_PAGE_SIZE}`;
  if (rvCurrentCarrier) {
    return `/api/reviews?carrier=${encodeURIComponent(rvCurrentCarrier)}&${base}`;
  }
  if (rvCurrentSubCat) {
    return `/api/reviews?subCategoryId=${encodeURIComponent(rvCurrentSubCat)}&${base}`;
  }
  if (rvCurrentCat && rvCurrentCat !== 'ALL') {
    // categoryId 로 부른다. ?category=(enum)은 GENERIC 을 구분 못 해 새 카테고리에서 섞인다.
    return `/api/reviews?categoryId=${encodeURIComponent(rvCurrentCat)}&${base}`;
  }
  return `/api/reviews?${base}`; // 전체 (카테고리 필터 없음)
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
  // 이미지 없으면 다픽 로고를 자동 부착(--logo: contain 렌더). 있으면 첫 장 + 다중 배지.
  const thumb = imgs.length
    ? `<div class="rv-card__thumb"><img src="${rvEscape(imgs[0])}" alt="" loading="lazy">${
        imgs.length > 1
          ? `<span class="rv-card__imgcount">+${imgs.length - 1}</span>`
          : ''
      }</div>`
    : `<div class="rv-card__thumb rv-card__thumb--logo"><img src="${RV_LOGO}" alt="다픽" loading="lazy"></div>`;
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
        ${rvHashtagsHtml(r)}
        <div class="rv-card__meta">
          <span class="rv-card__product">${rvEscape((r && r.productName) || '-')}</span>
          <span class="rv-card__author">${rvEscape((r && r.authorName) || '익명')}</span>
          <span class="rv-card__date">${rvDate(r && r.createdAt)}</span>
        </div>
        ${rvCountersHtml(r)}
      </div>
    </article>`;
}

// 해시태그 뱃지 ('#' 부착) — 없으면 빈 문자열
function rvHashtagsHtml(r) {
  const tags = r && Array.isArray(r.hashtags) ? r.hashtags : [];
  if (!tags.length) return '';
  return (
    '<div class="rv-card__tags">' +
    tags
      .map((t) => '<span class="rv-tag">#' + rvEscape(t) + '</span>')
      .join('') +
    '</div>'
  );
}

// 카운터(조회수/좋아요/댓글) 아이콘 행 — 흑백 SVG
const RV_ICON_VIEW =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const RV_ICON_LIKE =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
const RV_ICON_COMMENT =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

function rvCountersHtml(r) {
  const view = (r && r.viewCount) || 0;
  const like = (r && r.likeCount) || 0;
  const comment = (r && r.commentCount) || 0;
  return (
    '<div class="rv-card__counters">' +
    '<span class="rv-counter">' +
    RV_ICON_VIEW +
    rvNum(view) +
    '</span>' +
    '<span class="rv-counter">' +
    RV_ICON_LIKE +
    rvNum(like) +
    '</span>' +
    '<span class="rv-counter">' +
    RV_ICON_COMMENT +
    rvNum(comment) +
    '</span>' +
    '</div>'
  );
}

// 카운트 표시 (1000+ → 1.2k)
function rvNum(n) {
  n = Number(n) || 0;
  return n >= 1000
    ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    : String(n);
}

// ── 페이지네이션 ───────────────────────────────────────
function rvRenderPagination(totalPages) {
  const el = document.getElementById('rvMore');
  if (!el) return;
  const total = Number(totalPages) || 0;
  if (total <= 0) {
    el.innerHTML = '';
    return;
  }
  const cur = rvPage + 1; // 1-based 표시
  const WINDOW = 10;
  const start = Math.floor((cur - 1) / WINDOW) * WINDOW + 1;
  const end = Math.min(start + WINDOW - 1, total);
  let html = '<nav class="rv-pg" aria-label="페이지">';
  if (start > 1) {
    html +=
      '<button type="button" class="rv-pg-btn rv-pg-nav" data-page="' +
      (start - 2) +
      '" aria-label="이전">\u2039</button>';
  }
  for (let p = start; p <= end; p++) {
    html +=
      '<button type="button" class="rv-pg-btn' +
      (p === cur ? ' is-active' : '') +
      '" data-page="' +
      (p - 1) +
      '">' +
      p +
      '</button>';
  }
  if (cur < total) {
    html +=
      '<button type="button" class="rv-pg-btn rv-pg-nav" data-page="' +
      cur +
      '" aria-label="다음">\u203a</button>';
    html +=
      '<button type="button" class="rv-pg-btn rv-pg-nav" data-page="' +
      (total - 1) +
      '" aria-label="마지막">\u00bb</button>';
  }
  html += '</nav>';
  el.innerHTML = html;
  el.querySelectorAll('.rv-pg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const p = Number(b.dataset.page);
      if (isNaN(p) || p === rvPage) return;
      rvPage = p;
      rvLoadReviews(true);
      const listEl = document.querySelector('.rv-list');
      if (listEl) {
        window.scrollTo({
          top: listEl.getBoundingClientRect().top + window.scrollY - 90,
          behavior: 'smooth',
        });
      }
    });
  });
}

// ── 글쓰기 버튼 → 블록 에디터 (로그인 + 완료 상담 필요) ────────────────
function rvBindWrite() {
  document.getElementById('rvWriteBtn').addEventListener('click', () => {
    if (!rvLoggedIn()) {
      rvOpenModal(
        '로그인 후 이용 가능합니다.\n로그인 페이지로 이동하시겠습니까?',
        () => {
          // 로그인 후 후기 목록으로 돌아오게 한다 (auth.js)
          if (typeof saveReturnUrl === 'function') saveReturnUrl();
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

//
// 상세 모달 — 카드 클릭 시 전체 글 + 이미지 전부 (아정당식)
// (조회수/좋아요/댓글/태그는 백엔드 데이터 없어 이번 범위 제외)
//
// 후기 상세 URL (제목 슬러그 + id) — 예: /reviews/다픽-후기-42 (Worker 가 라우팅+OG 주입)
function rvSlug(title) {
  if (!title) return 'review';
  const s = String(title)
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'review';
}
function rvReviewUrl(id) {
  const r = rvById[id];
  const host = window.location.hostname;
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.endsWith('.local');
  // 로컬(Worker 없음)은 직접 페이지, 프로덕션은 제목 URL(Worker 라우팅 + OG)
  if (isLocal) return '/review-detail.html?id=' + id;
  return '/reviews/' + rvSlug(r && r.title) + '-' + id;
}

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
      if (card && card.dataset.id)
        window.location.href = rvReviewUrl(card.dataset.id);
    });
    listEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.rv-card');
        if (card && card.dataset.id) {
          e.preventDefault();
          window.location.href = rvReviewUrl(card.dataset.id);
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

// 후기 1건이 어느 카테고리인지 찾는다.
// categoryId 가 정본이고, 없으면(백필이 못 채운 옛 후기) type 으로 되짚는다.
function rvCatOf(r) {
  if (!r) return null;
  if (r.categoryId && rvCatById[r.categoryId]) return rvCatById[r.categoryId];
  if (r.category && rvCatByType[r.category]) return rvCatByType[r.category];
  return null;
}

function rvCatLabel(r) {
  const c = rvCatOf(r);
  return c ? c.name : '후기';
}

// '나도 신청하기' 가 갈 곳.
// 전용 화면이 있으면 그리로, 없으면 /c/{slug} (_worker.js 가 category.html 로 넘긴다).
// 전용 화면이 없는 새 카테고리를 /internet 으로 보내면 엉뚱한 상품을 보게 된다.
function rvCtaHref(r) {
  const c = rvCatOf(r);
  if (c) {
    if (c.type && RV_CTA_BY_TYPE[c.type]) return RV_CTA_BY_TYPE[c.type];
    if (c.slug) return '/c/' + encodeURIComponent(c.slug);
  }
  return '/';
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
  const title =
    r && r.title ? '<h2 class="rvd-title">' + rvEscape(r.title) + '</h2>' : '';
  const blocks = r && Array.isArray(r.contentBlocks) ? r.contentBlocks : [];
  let bodyHtml;
  if (blocks.length) {
    // Quill Delta → 읽기전용 Quill 로 안전 렌더(서식·이미지 순서 보존)
    bodyHtml =
      '<div class="ql-snow"><div class="ql-editor rvd-ql">' +
      rvDeltaToHtml(blocks) +
      '</div></div>';
  } else {
    // 구 데이터: 평문 + 이미지 갤러리
    const content = r && r.content ? rvEscape(r.content) : '';
    bodyHtml =
      (content ? '<p class="rvd-content">' + content + '</p>' : '') + gallery;
  }

  return (
    '<div class="rvd-crumb">후기 › ' +
    rvEscape(rvCatLabel(r)) +
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
    rvCtaHref(r) +
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
    '.rv-lock{color:#9a9aa5;flex:none;}' +
    // 상세: Quill Delta 렌더 콘텐츠
    '.rvd-blockbody .ql-snow{border:none;}' +
    '.rvd-blockbody .ql-editor{padding:0;font-size:15px;line-height:1.75;color:#2a2a35;}' +
    '.rvd-blockbody .ql-editor img{max-width:100%;height:auto;border-radius:10px;display:block;margin:12px auto;}' +
    // 카테고리 하위탭(통신사/브랜드)
    '.rv-subtabs{display:flex;flex-wrap:wrap;gap:8px;margin:-4px 0 18px;}' +
    '.rv-subtab{border:1px solid #e0dced;background:#fff;color:#555;border-radius:999px;' +
    'padding:6px 14px;font-size:13px;cursor:pointer;font-family:inherit;line-height:1.2;}' +
    '.rv-subtab.is-active{background:#5b3fbe;border-color:#5b3fbe;color:#fff;font-weight:700;}' +
    // 이미지 없는 카드: 로고 썸네일(contain)
    '.rv-card__thumb--logo{display:flex;align-items:center;justify-content:center;background:#f5f3fb;}' +
    '.rv-card__thumb--logo img{width:62%;height:62%;object-fit:contain;}' +
    // 해시태그 뱃지
    '.rv-card__tags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px;}' +
    '.rv-tag{font-size:12px;color:#5b3fbe;background:#f1edfb;border-radius:6px;padding:2px 8px;font-weight:600;}' +
    // 카운터(조회수/좋아요/댓글)
    '.rv-card__counters{display:flex;gap:14px;margin-top:8px;color:#9a9aa5;font-size:12px;}' +
    '.rv-counter{display:inline-flex;align-items:center;gap:4px;}' +
    '.rv-counter svg{color:#b0aac2;}';
  const style = document.createElement('style');
  style.id = 'rvd-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

//
// 블록 에디터 — 제목 + 별점 + 상담선택 + 텍스트/이미지 블록(추가·재배치·삭제)
//
const rvEd = {
  consultationId: null,
  rating: 0,
  blocks: [], // [{type:'text',text}|{type:'image',url}]
  hashtags: [], // 선택된 해시태그 라벨('#' 제외)
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
    '    <label class="rve-label">해시태그 <span class="rve-optional">(선택)</span></label>' +
    '    <div class="rve-tags" id="rveTags"></div>' +
    '    <label class="rve-label">내용</label>' +
    '    <div class="rve-quill" id="rveEditor"></div>' +
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
  document.getElementById('rveConsult').addEventListener('change', (e) => {
    rvEd.consultationId = e.target.value || null;
  });
  document.getElementById('rveSubmit').addEventListener('click', rvEdSubmit);
}

// Quill 인스턴스 (에디터/상세 렌더 공용 아님 — 에디터 전용)
let rvQuill = null;

// Quill 초기화 (모달 최초 오픈 시 1회). 티스토리식 툴바 + 이미지 업로드 핸들러 + placeholder.
function rvInitQuill() {
  if (rvQuill || typeof Quill === 'undefined') return;
  rvQuill = new Quill('#rveEditor', {
    theme: 'snow',
    placeholder:
      '욕설, 비방, 허위사실, 개인정보가 포함된 후기는 관리자에 의해 숨김 처리될 수 있습니다. 서로를 배려하는 후기를 작성해 주세요.',
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }],
          [{ align: [] }],
          ['blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
        handlers: { image: rvQuillImageHandler },
      },
    },
  });
}

// 본문 이미지 수 (Delta 의 image embed 개수)
function rvCountQuillImages() {
  if (!rvQuill) return 0;
  const ops = (rvQuill.getContents() && rvQuill.getContents().ops) || [];
  return ops.filter(
    (o) => o.insert && typeof o.insert === 'object' && o.insert.image,
  ).length;
}

// Quill 이미지 버튼 → 파일 선택 → /api/reviews/images 업로드 → 커서 위치 삽입 (최대 5장)
function rvQuillImageHandler() {
  if (rvCountQuillImages() >= 5) {
    alert('사진은 최대 5장까지 첨부할 수 있어요.');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    rvUploadImage(file)
      .then((d) => {
        if (d && d.url && rvQuill) {
          const range = rvQuill.getSelection(true);
          const idx = range ? range.index : rvQuill.getLength();
          rvQuill.insertEmbed(idx, 'image', d.url, 'user');
          rvQuill.setSelection(idx + 1, 0, 'user');
        }
      })
      .catch((err) => alert((err && err.message) || '이미지 업로드 실패'));
  };
  input.click();
}

// Delta(ops) → 읽기전용 Quill 로 안전 렌더한 HTML (상세용)
function rvDeltaToHtml(ops) {
  if (typeof Quill === 'undefined' || !Array.isArray(ops)) return '';
  const tmp = document.createElement('div');
  const q = new Quill(tmp, { modules: { toolbar: false }, readOnly: true });
  q.setContents({ ops: ops });
  return q.root.innerHTML;
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
      rvEd.hashtags = [];
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
      rvRenderHashtags();
      rvInitQuill();
      if (rvQuill) rvQuill.setText(''); // 본문 초기화
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

// 해시태그 선택 칩(고정 5종) — 토글. 선택은 rvEd.hashtags 에 라벨 저장.
function rvRenderHashtags() {
  const el = document.getElementById('rveTags');
  if (!el) return;
  el.innerHTML = RV_HASHTAGS.map(
    (t) =>
      '<button type="button" class="rve-tag' +
      (rvEd.hashtags.indexOf(t) >= 0 ? ' on' : '') +
      '" data-t="' +
      rvEscape(t) +
      '">#' +
      rvEscape(t) +
      '</button>',
  ).join('');
  el.querySelectorAll('.rve-tag').forEach((b) => {
    b.addEventListener('click', () => {
      const t = b.dataset.t;
      const i = rvEd.hashtags.indexOf(t);
      if (i >= 0) rvEd.hashtags.splice(i, 1);
      else rvEd.hashtags.push(t);
      rvRenderHashtags();
    });
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

  const delta = rvQuill ? rvQuill.getContents() : null;
  const ops = (delta && delta.ops) || [];
  const plain = rvQuill ? rvQuill.getText().trim() : '';
  if (!plain && rvCountQuillImages() === 0) {
    alert('내용을 입력해주세요.');
    return;
  }

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
      contentBlocks: ops, // Quill Delta ops → 백엔드가 이미지/텍스트 파생 저장
      hashtags: rvEd.hashtags, // 화이트리스트는 백엔드가 재검증
    })
    .then((res) => {
      if (res === null) return;
      rvCloseEditor();
      rvOpenModal('후기가 등록되었습니다. 감사합니다!', null);
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
    '.rve-panel{position:relative;z-index:1;width:100%;max-width:640px;background:#fff;' +
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
    '.rve-optional{color:#b3b0c2;font-weight:400;font-size:12px;}' +
    '.rve-tags{display:flex;flex-wrap:wrap;gap:8px;}' +
    '.rve-tag{border:1px solid #e0dced;background:#fff;color:#6b6b7b;border-radius:999px;' +
    'padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;}' +
    '.rve-tag.on{background:#f1edfb;border-color:#5b3fbe;color:#5b3fbe;font-weight:700;}' +
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
    '.rve-btn--primary:disabled{opacity:.6;cursor:default;}' +
    // Quill 에디터
    '.rve-quill .ql-toolbar{border-radius:10px 10px 0 0;border-color:#e0dced;}' +
    '.rve-quill .ql-container{border-radius:0 0 10px 10px;border-color:#e0dced;' +
    'min-height:220px;font-size:15px;font-family:inherit;}' +
    '.rve-quill .ql-editor{min-height:220px;line-height:1.7;}' +
    '.rve-quill .ql-editor.ql-blank::before{color:#b3b0c2;font-style:normal;font-size:13px;}' +
    '.rve-quill .ql-editor img{max-width:100%;height:auto;border-radius:8px;}';
  const style = document.createElement('style');
  style.id = 'rve-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
