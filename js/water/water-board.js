// ════════════════════════════════════════════════════
// water-board.js — 메인보드(브랜드 선택) ↔ 상품뷰 전환 + 브랜드 동적 렌더
// 브랜드 데이터 = 어드민 '브랜드 관리' → GET /api/brands?categoryType=WATER
//   (로더는 gnb.js 의 dpFetchWaterBrands — GNB 드롭다운과 같은 fetch 를 공유)
// - 보드 카드: 로고(등록된 경우만)/이름/설명(줄바꿈 유지), 가로 4개 그리드
// - 20개(4×5) 초과 시 페이지네이션
// - 상품뷰 브랜드 탭 · 필터 브랜드 체크박스도 같은 데이터로 렌더
// 의존: utils.js(escapeHtml/escapeAttr), gnb.js(dpFetchWaterBrands/dpBrandLogoSrc),
//       water.js(switchBrand/applyFilters — BRAND_INFO 는 여기 전역을 읽음)
// ════════════════════════════════════════════════════

// 코드 → { name, logo, desc }. water.js(switchBrand 헤더)와 공유하는 페이지 전역.
let BRAND_INFO = {};
let WATER_BRANDS = [];        // API 원본 (sortOrder 순)
const BRAND_PAGE_SIZE = 20;   // 4열 × 5줄
let brandBoardPage = 0;

// ── 초기화: 브랜드 로드 → 보드/탭/필터 렌더 → 딥링크 처리 ──
async function initBrandBoard() {
  WATER_BRANDS = await dpFetchWaterBrands(); // 실패 시 [] (gnb.js 에서 catch)
  BRAND_INFO = {};
  WATER_BRANDS.forEach((b) => {
    BRAND_INFO[b.code] = {
      name: b.name,
      logo: dpBrandLogoSrc(b.logoUrl || ''),
      desc: b.description || '',
    };
  });

  const grid = document.getElementById('brandSelectGrid');
  if (!WATER_BRANDS.length) {
    if (grid)
      grid.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px 0;">브랜드 정보를 불러오지 못했습니다. 잠시 후 새로고침 해주세요.</div>';
    return;
  }

  renderBrandBoard();
  renderBrandTabs();
  renderBrandFilterOptions();
  handleBrandDeepLink();
}

// ── 보드 카드 렌더 (+ 페이지네이션) ──
function renderBrandBoard() {
  const grid = document.getElementById('brandSelectGrid');
  if (!grid) return;

  const pages = Math.max(1, Math.ceil(WATER_BRANDS.length / BRAND_PAGE_SIZE));
  if (brandBoardPage >= pages) brandBoardPage = pages - 1;
  const slice = WATER_BRANDS.slice(
    brandBoardPage * BRAND_PAGE_SIZE,
    (brandBoardPage + 1) * BRAND_PAGE_SIZE
  );
  grid.innerHTML = slice.map(brandCardHtml).join('');

  const pager = document.getElementById('brandBoardPager');
  if (!pager) return;
  if (pages <= 1) {
    pager.style.display = 'none';
    pager.innerHTML = '';
    return;
  }
  pager.style.display = 'flex';
  pager.innerHTML =
    `<button type="button" class="bbp-btn" ${brandBoardPage <= 0 ? 'disabled' : ''} onclick="brandBoardGo(${brandBoardPage - 1})">이전</button>` +
    `<span class="bbp-info">${brandBoardPage + 1} / ${pages}</span>` +
    `<button type="button" class="bbp-btn" ${brandBoardPage >= pages - 1 ? 'disabled' : ''} onclick="brandBoardGo(${brandBoardPage + 1})">다음</button>`;
}

function brandBoardGo(p) {
  const pages = Math.max(1, Math.ceil(WATER_BRANDS.length / BRAND_PAGE_SIZE));
  if (p < 0 || p >= pages) return;
  brandBoardPage = p;
  renderBrandBoard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 카드 1장: 로고(등록된 경우만) / 브랜드명 / 설명(줄바꿈 → <br>) / 자세히 보기
function brandCardHtml(b) {
  const info = BRAND_INFO[b.code] || {};
  const logo = info.logo
    ? `<div class="brand-select-logo"><img src="${escapeAttr(info.logo)}" alt="${escapeAttr(b.name)}"></div>`
    : '';
  const desc = info.desc
    ? `<div class="brand-select-desc">${escapeHtml(info.desc).replace(/\n/g, '<br>')}</div>`
    : '';
  return `
      <div class="brand-select-card" onclick="selectBrand('${escapeAttr(b.code)}')">
        ${logo}
        <div class="brand-select-info">
          <div class="brand-select-name">${escapeHtml(b.name)}</div>
          ${desc}
        </div>
        <span class="brand-select-badge">자세히 보기</span>
      </div>`;
}

// ── 상품뷰 브랜드 탭 — 로고 있으면 로고, 없으면 이름 텍스트 ──
function renderBrandTabs() {
  const wrap = document.getElementById('brandTabs');
  if (!wrap) return;
  wrap.innerHTML = WATER_BRANDS.map((b) => {
    const info = BRAND_INFO[b.code] || {};
    const inner = info.logo
      ? `<img src="${escapeAttr(info.logo)}" alt="${escapeAttr(b.name)}" class="brand-logo-img">`
      : `<span>${escapeHtml(b.name)}</span>`;
    return `<div class="brand-tab" data-brand="${escapeAttr(b.code)}" onclick="switchBrand('${escapeAttr(b.code)}')">${inner}</div>`;
  }).join('');
}

// ── 필터 '브랜드' 체크박스 — 등록 브랜드 전체 ──
// initWaterFilter(DOMContentLoaded) 이후에 삽입되므로 change 바인딩을 여기서 직접 건다.
function renderBrandFilterOptions() {
  const wrap = document.getElementById('wfBrandOptions');
  if (!wrap) return;
  wrap.innerHTML = WATER_BRANDS.map(
    (b) =>
      `<label class="wf-opt"><input type="checkbox" data-filter="brand" data-value="${escapeAttr(b.code)}"><span>${escapeHtml(b.name)}</span></label>`
  ).join('');
  wrap.querySelectorAll('input[data-filter]').forEach((el) => {
    el.addEventListener('change', applyFilters);
  });
}

// ── 진입 시 ?brand=… 있으면 해당 브랜드 상품뷰로 (상세 뒤로가기·GNB 드롭다운 진입) ──
function handleBrandDeepLink() {
  const bp = new URLSearchParams(location.search).get('brand');
  if (bp && BRAND_INFO[bp]) selectBrand(bp);
}

// ── 메인보드 → 상품뷰 전환 ──
function selectBrand(brand) {
  const info = BRAND_INFO[brand];
  if (!info) return;

  // 상단 브랜드 헤더 — 로고는 등록된 경우만 (switchBrand 의 갱신 로직과 동일 규칙)
  document.getElementById('productViewBrand').innerHTML =
    (info.logo
      ? `<img src="${escapeAttr(info.logo)}" alt="${escapeAttr(info.name)}" style="height:24px;object-fit:contain;">`
      : '') +
    `<span class="product-view-brand-name">${escapeHtml(info.name)}</span>`;

  document
    .querySelectorAll('.brand-tab')
    .forEach((t) => t.classList.toggle('active', t.dataset.brand === brand));

  document.getElementById('boardView').style.display = 'none';
  document.getElementById('productView').style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  switchBrand(brand);
}

// ── 상품뷰 → 메인보드 전환 ──
function goBoard() {
  document.getElementById('productView').style.display = 'none';
  document.getElementById('boardView').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // URL을 brand 없는 상태로 되돌림 (브랜드선택창과 URL 일치)
  if (location.search) {
    history.pushState({}, '', 'water.html');
  }
}

// ── 브라우저 ←/→ : URL 따라 화면 동기화 ──
window.addEventListener('popstate', () => {
  const bp = new URLSearchParams(location.search).get('brand');
  if (bp && BRAND_INFO[bp]) {
    selectBrand(bp); // selectBrand 내부 pushState는 URL 일치 시 if로 걸러짐 → 중복 누적 없음
  } else {
    document.getElementById('productView').style.display = 'none';
    document.getElementById('boardView').style.display = 'block';
  }
});

// ── 진입: 브랜드 로드 → 렌더 (딥링크 처리는 initBrandBoard 안에서) ──
document.addEventListener('DOMContentLoaded', () => {
  initBrandBoard().catch((e) => console.error('[water-board] 초기화 실패:', e));
});
