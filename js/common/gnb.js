// ── 공통 헤더(GNB) 주입 ──────────────────────────────────
// gnb-user.js보다 먼저 실행되어야 함 (gnb-user.js가 .gnb-right를 찾으므로)
// ※ 마크업은 internet-unified.html의 기존 gnb-top을 그대로 미러링
//   (gnb-extras 바는 이 헤더에 없음 - 원본과 동일하게 유지)

// 통신사 6사 (하드코딩 - 백엔드 무수정. 페이지 파일명은 CARRIER_MAP과 일치)
const GNB_CARRIERS = [
  // carrier: unified 페이지로 넘길 정확한 코드값(CARRIER_MAP 키, 공백·대소문자 원본)
  // page: 독립 HTML 경로(롤백/직접진입용 보존 - 현재 렌더에선 미사용)
  { label: 'SKT', carrier: 'SKT', page: 'internet-skt.html' },
  // 알뜰 3사 비노출 (2026-07-03, 3사 통신사만 운영) - 재개 시 주석 해제
  // { label: 'SK브로드밴드', carrier: 'SK broadband', page: 'internet-sk-broadband.html' },
  { label: 'KT', carrier: 'KT', page: 'internet-kt.html' },
  // { label: 'KT스카이라이프', carrier: 'KT Skylife', page: 'internet-kt-skylife.html' },
  { label: 'LG U+', carrier: 'LG U+', page: 'internet-lg.html' },
  // { label: 'LG헬로비전', carrier: 'LG HelloVision', page: 'internet-lg-hello.html' },
];

const GNB_CATS = [
  { cat: 'mobile', label: '휴대폰' },
  { cat: 'internet', label: '인터넷', dropdown: GNB_CARRIERS },
  { cat: 'card', label: '카드' },
  { cat: 'water', label: '정수기' },
  // 렌탈 제거 (2026-07-30) - 카테고리를 is_active=false 로 내렸다(V20260730005).
  // 파일(rental.html)과 rental_products 데이터는 그대로 남아 있어 직접 주소로는 열린다.
  // 되살리려면 이 한 줄과 아래 gnbIsActiveCat 분기를 되돌리면 된다.
];

function buildGnbHtml() {
  const path = location.pathname.split('/').pop() || 'index.html';

  const catItems = GNB_CATS.map((c) => {
    // 현재 페이지가 이 카테고리에 속하면 active
    const isActive = gnbIsActiveCat(c.cat, path);
    const activeCls = isActive ? ' is-active' : '';

    if (c.dropdown) {
      const subLinks = c.dropdown
        .map(
          (s) =>
            `<a class="cat-sub-item" href="/internet-unified?carrier=${encodeURIComponent(s.carrier)}">${s.label}</a>`
        )
        .join('');
      return `
        <div class="cat-item has-dropdown${activeCls}" data-cat="${c.cat}">
          <span class="cat-label" onclick="goPage('${c.cat}')">${c.label}</span>
          <div class="cat-dropdown">${subLinks}</div>
        </div>`;
    }
    return `<div class="cat-item${activeCls}" data-cat="${c.cat}" onclick="goPage('${c.cat}')">${c.label}</div>`;
  }).join('');

  // ↓ internet-unified.html 원본 gnb-top 그대로 (로고 경로/클래스, gnb-right onclick 포함)
  // 모바일 햄버거 메뉴용 카테고리 링크(카테고리 바가 좁을 때 대체 진입)
  const mobileCatLinks = GNB_CATS.map(
    (c) => `<a class="gnb-mobile-link" href="javascript:void(0)" onclick="goPage('${c.cat}')">${c.label}</a>`
  ).join('');

  return `
    <div class="gnb-top">
      <a href="/" class="logo-wrap">
        <img src="/assets/logos/dapick.png" alt="다픽 아이콘" class="logo-wrap__img" />
      </a>
      <nav class="gnb-extras">
        <a href="/support">고객센터</a>
        <a href="events.html" class="has-new">이벤트</a>
        <a href="/reviews">후기</a>
        <a href="faq.html">자주묻는질문</a>
      </nav>
      <div class="gnb-right">
        <button class="btn-login" data-track="login_signup" onclick="if(typeof saveReturnUrl==='function')saveReturnUrl();window.location.href='/login'">로그인/회원가입</button>
      </div>
      <div class="gnb-more">
        <button class="gnb-more-btn" type="button" aria-label="바로가기 더보기" aria-expanded="false" onclick="toggleGnbMore(this)">
          <span></span><span></span><span></span>
        </button>
        <div class="gnb-more-card" id="gnbMoreCard" hidden>
          <a href="/support">고객센터</a>
          <a href="events.html" class="has-new">이벤트</a>
          <a href="/reviews">후기</a>
          <a href="faq.html">자주묻는질문</a>
        </div>
      </div>
      <button class="gnb-burger" type="button" aria-label="메뉴" aria-expanded="false" onclick="toggleGnbMobileMenu(this)">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="cat-bar">
      <div class="cat-inner">${catItems}</div>
    </div>
    <div class="gnb-mobile" id="gnbMobile" hidden>
      <div class="gnb-mobile-sec">
        <div class="gnb-mobile-label">카테고리</div>
        ${mobileCatLinks}
      </div>
      <div class="gnb-mobile-sec">
        <div class="gnb-mobile-label">메뉴</div>
        <a class="gnb-mobile-link" href="/support">고객센터</a>
        <a class="gnb-mobile-link" href="events.html">이벤트</a>
        <a class="gnb-mobile-link" href="/reviews">후기</a>
        <a class="gnb-mobile-link" href="faq.html">자주묻는질문</a>
      </div>
    </div>`;
}

// 현재 URL이 어느 카테고리인지 판정 (active 표시용)
function gnbIsActiveCat(cat, path) {
  if (cat === 'internet') return path.startsWith('internet');
  if (cat === 'mobile') return path.startsWith('mobile');
  if (cat === 'card') return path.startsWith('card');
  if (cat === 'water') return path.startsWith('water');
  return false;
}

// 모바일: 드롭다운 클릭 토글 (데스크탑은 CSS hover)
// 라벨 1개 바인딩 - 동적으로 추가되는 드롭다운(정수기)도 이 함수를 재사용한다.
// setupGnbDropdownToggle 을 다시 부르면 기존 라벨에 리스너가 중복 붙어 토글이 2번 돌므로 금지.
function bindGnbDropdownLabel(label) {
  label.addEventListener('click', (e) => {
    // 모바일(터치/좁은 화면)에서만 토글, 데스크탑은 hover라 이동 우선
    if (
      window.matchMedia('(hover: none)').matches ||
      window.innerWidth <= 768
    ) {
      e.stopPropagation();
      const item = label.closest('.cat-item');
      const wasOpen = item.classList.contains('is-open');
      document
        .querySelectorAll('.cat-item.has-dropdown')
        .forEach((i) => i.classList.remove('is-open'));
      if (!wasOpen) item.classList.add('is-open');
    }
  });
}

function setupGnbDropdownToggle() {
  document
    .querySelectorAll('.cat-item.has-dropdown .cat-label')
    .forEach(bindGnbDropdownLabel);
  // 바깥 클릭 시 닫힘
  document.addEventListener('click', () => {
    document
      .querySelectorAll('.cat-item.has-dropdown.is-open')
      .forEach((i) => i.classList.remove('is-open'));
  });
}

// ── 정수기 브랜드 로더 (공개 API) - GNB 드롭다운·정수기 페이지(water-board.js) 공용 ──
// 어드민 '브랜드 관리' 등록/숨김/정렬이 그대로 반영된다. 페이지당 1회 fetch(프로미스 캐시).
let _dpWaterBrandsPromise = null;
function dpFetchWaterBrands() {
  if (_dpWaterBrandsPromise) return _dpWaterBrandsPromise;
  if (typeof DAPICK_CONFIG === 'undefined') return Promise.resolve([]);
  _dpWaterBrandsPromise = fetch(
    `${DAPICK_CONFIG.API_BASE_URL}/api/brands?categoryType=WATER`,
    { headers: { 'Content-Type': 'application/json' } }
  )
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => (Array.isArray(json) ? json : json?.data || []))
    .catch((err) => {
      console.error('[gnb] 정수기 브랜드 로드 실패:', err);
      _dpWaterBrandsPromise = null; // 다음 호출에서 재시도
      return [];
    });
  return _dpWaterBrandsPromise;
}

// 로고 src 보정 - /uploads/... 는 API 서버 상대경로라 API_BASE 를 붙인다. /assets/...·절대 URL 은 그대로.
function dpBrandLogoSrc(url) {
  if (!url) return '';
  if (url.indexOf('/uploads/') === 0 && typeof DAPICK_CONFIG !== 'undefined') {
    return DAPICK_CONFIG.API_BASE_URL + url;
  }
  return url;
}

function dpGnbEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 정수기 카테고리를 브랜드 드롭다운으로 전환 (인터넷 드롭다운과 같은 마크업/CSS 재사용)
// 브랜드 0개·API 실패 시 기존 일반 링크 그대로 유지 (안전 폴백)
function injectWaterGnbDropdown() {
  const item = document.querySelector('.cat-bar .cat-item[data-cat="water"]');
  if (!item || item.classList.contains('has-dropdown')) return;
  dpFetchWaterBrands().then((brands) => {
    if (!brands.length) return;
    const subLinks = brands
      .map(
        (b) =>
          `<a class="cat-sub-item" href="water.html?brand=${encodeURIComponent(b.code)}">${dpGnbEsc(b.name)}</a>`
      )
      .join('');
    // div 자체의 onclick(goPage)을 제거하고 라벨로 옮긴다 - 서브링크 클릭이 버블돼 목록으로 튀는 것 방지
    item.removeAttribute('onclick');
    item.onclick = null;
    item.classList.add('has-dropdown');
    item.innerHTML = `<span class="cat-label" onclick="goPage('water')">정수기</span><div class="cat-dropdown">${subLinks}</div>`;
    const label = item.querySelector('.cat-label');
    if (label) bindGnbDropdownLabel(label);
  });
}

//
// GNB 카테고리 아이콘 세트 (2026-07-30)
// 단색 스트로크 아이콘 - 어드민 사이드바(admin-nav.js)와 같은 결.
// fill:none + stroke:currentColor 이라 글자색을 그대로 따라간다(hover 시 보라).
//
// 이 배열은 dapick-admin/js/category.js(CAT_ICON_SET) 와 dapick-web/js/common/gnb.js(DP_CAT_ICON_SET)
//   두 곳에 같은 내용으로 들어간다. 저장소가 분리돼 있어 공유가 안 된다.
//   아이콘을 추가·삭제하면 반드시 양쪽을 함께 고칠 것.
//   (어드민에만 추가하면 관리자는 고를 수 있는데 웹에서는 안 그려진다)
//
const DP_CAT_ICON_SET = [
  { key: 'smartphone', label: '휴대폰', p: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>' },
  { key: 'tv', label: 'TV', p: '<rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>' },
  { key: 'monitor', label: '모니터', p: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
  { key: 'wifi', label: '인터넷', p: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>' },
  { key: 'droplet', label: '정수기', p: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>' },
  { key: 'credit-card', label: '카드', p: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>' },
  { key: 'snowflake', label: '냉난방', p: '<line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>' },
  { key: 'thermometer', label: '온도', p: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4 4 0 1 0 5 0z"/>' },
  { key: 'washer', label: '세탁기', p: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="5"/><line x1="8" y1="6" x2="8.01" y2="6"/>' },
  { key: 'bed', label: '침대·가구', p: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><line x1="2" y1="16" x2="22" y2="16"/><path d="M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>' },
  { key: 'home', label: '집·생활', p: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { key: 'coffee', label: '주방·커피', p: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>' },
  { key: 'zap', label: '전기', p: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { key: 'shield', label: '보험·보안', p: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  { key: 'heart', label: '건강', p: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
  { key: 'bank', label: '금융', p: '<line x1="3" y1="21" x2="21" y2="21"/><line x1="5" y1="21" x2="5" y2="10"/><line x1="19" y1="21" x2="19" y2="10"/><polyline points="2 10 12 3 22 10"/>' },
  { key: 'wallet', label: '지갑', p: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/>' },
  { key: 'trending-up', label: '투자', p: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
  { key: 'car', label: '자동차', p: '<path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v5h-3v-2H6v2H3z"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/>' },
  { key: 'truck', label: '이사·배송', p: '<rect x="1" y="5" width="14" height="11" rx="1"/><polygon points="15 9 19 9 22 12 22 16 15 16 15 9"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/>' },
  { key: 'plane', label: '여행', p: '<path d="M2 12l20-8-8 20-2-8-8-4z"/>' },
  { key: 'package', label: '상품', p: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>' },
  { key: 'gift', label: '사은품', p: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>' },
  { key: 'tag', label: '할인', p: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>' },
  { key: 'cart', label: '쇼핑', p: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
  { key: 'users', label: '제휴·단체', p: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { key: 'file-text', label: '서류', p: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
  { key: 'star', label: '추천', p: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  { key: 'grid', label: '기타', p: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
];

// 키 → SVG 마크업. 없는 키면 빈 문자열(아이콘 없이 글자만 뜬다).
function dpCatIconSvg(key, size) {
  const found = DP_CAT_ICON_SET.find((i) => i.key === key);
  if (!found) return '';
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${found.p}</svg>`
  );
}

// ── 카테고리 로더 (공개 API) - 관리자가 만든 카테고리를 GNB 에 붙이기 위한 것 ──
// 페이지당 1회 fetch(프로미스 캐시). 실패해도 하드코딩 4개는 이미 그려져 있어 GNB 가 비지 않는다.
let _dpCategoriesPromise = null;
function dpFetchCategories() {
  if (_dpCategoriesPromise) return _dpCategoriesPromise;
  if (typeof DAPICK_CONFIG === 'undefined') return Promise.resolve([]);
  _dpCategoriesPromise = fetch(`${DAPICK_CONFIG.API_BASE_URL}/api/categories`, {
    headers: { 'Content-Type': 'application/json' },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => (Array.isArray(json) ? json : json?.data || []))
    .catch((err) => {
      console.error('[gnb] 카테고리 로드 실패:', err);
      _dpCategoriesPromise = null; // 다음 호출에서 재시도
      return [];
    });
  return _dpCategoriesPromise;
}

// 카테고리 하나를 GNB 항목 HTML 로 만든다.
// 아이콘은 이미지 > 이모지 > 없음 순. .cat-icon / .cat-icon-img CSS 는 이미 있다.
function buildDynamicCatHtml(c) {
  const href = `/c/${encodeURIComponent(c.slug)}`;
  // 아이콘은 웹 상단 메뉴에 안 그린다 (2026-07-31).
  // 기존 4개(휴대폰·인터넷·카드·정수기)가 글자만 쓰는데 새 카테고리만 아이콘이 붙어
  // 줄 높이와 정렬이 어긋났다. 아이콘은 어드민 사이드바 전용이다.
  // 값은 그대로 저장·전달되므로 나중에 웹에도 쓰려면 이 한 줄만 되돌리면 된다.
  const icon = '';
  // 2026-08-07 까지 하위는 '숨김만 거르고' 순서를 안 세웠다.
  //   그래서 어드민에서 순서를 바꿔 저장해도 이 드롭다운만 옛 순서로 남았다.
  //   같은 숫자가 둘이면 이름순으로 갈라 준다 — 어드민(cmSorted)과 같은 규칙이어야
  //   관리자가 보는 화면과 고객이 보는 화면이 어긋나지 않는다.
  const kids = (c.children || [])
    .filter((s) => s.isActive !== false)
    .sort(
      (a, b) =>
        (a.sortOrder || 0) - (b.sortOrder || 0) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'ko'),
    );
  const path = location.pathname;
  const activeCls = path === href || path.startsWith(href + '/') ? ' is-active' : '';

  if (kids.length) {
    const subs = kids
      .map(
        (s) =>
          `<a class="cat-sub-item" href="${href}?sub=${encodeURIComponent(s.id)}">${dpGnbEsc(s.name)}</a>`,
      )
      .join('');
    return `
      <div class="cat-item has-dropdown${activeCls}" data-cat="c-${dpGnbEsc(c.slug)}">
        <span class="cat-label" onclick="location.href='${href}'">${icon}${dpGnbEsc(c.name)}</span>
        <div class="cat-dropdown">${subs}</div>
      </div>`;
  }
  return `
    <div class="cat-item${activeCls}" data-cat="c-${dpGnbEsc(c.slug)}" onclick="location.href='${href}'">${icon}${dpGnbEsc(c.name)}</div>`;
}

// 관리자가 만든 카테고리(GENERIC)를 정수기 뒤에 이어 붙인다.
//
// 기존 4개(휴대폰·인터넷·카드·정수기)를 API 이름으로 갈아끼우지 않는 이유:
// 라벨과 이동 경로가 페이지마다 굳어 있어서(goPage 의 하드코딩 맵) DB 이름을 그대로 쓰면
// GNB 글자가 예고 없이 바뀌고 링크가 어긋난다. 검증된 4개는 그대로 두고 새 것만 붙인다.
// 위 GNB_CATS 가 이미 고정으로 그리는 타입. 이 넷만 빼고 나머지는 전부 붙인다.
// 'GENERIC 인 것만' 으로 좁히면 type 이 비었거나 값이 늘었을 때
// 관리자가 만든 카테고리가 아무 말 없이 사라진다.
const DP_LEGACY_GNB_TYPES = ['PHONE', 'INTERNET_TV', 'CARD', 'WATER'];

function injectDynamicGnbCats() {
  const inner = document.querySelector('.cat-bar .cat-inner');
  if (!inner) return;
  dpFetchCategories().then((cats) => {
    const all = cats || [];
    const extras = all
      .filter(
        (c) =>
          c &&
          !c.parentId &&
          c.showInGnb !== false &&
          c.isActive !== false &&
          DP_LEGACY_GNB_TYPES.indexOf(c.type) === -1,
      )
      .sort(
        (a, b) =>
          (a.sortOrder || 0) - (b.sortOrder || 0) ||
          String(a.name || '').localeCompare(String(b.name || ''), 'ko'),
      );

    // 안 뜰 때 어디서 걸렸는지 바로 보이게 남긴다
    (typeof dpInfo === 'function' ? dpInfo : function () {})(
      `[gnb] 카테고리 ${all.length}건 중 추가 대상 ${extras.length}건`,
      all.map(
        (c) =>
          `${c.name} | type=${c.type} | slug=${c.slug} | gnb=${c.showInGnb} | 하위=${(c.children || []).length}건 [${(c.children || []).map((s) => s.name).join(', ')}]`,
      ),
    );

    extras.forEach((c) => {
        // 주소가 없으면 갈 곳이 없다. 조용히 넘기지 않고 이유를 남긴다.
        if (!c.slug) {
          console.warn(`[gnb] "${c.name}" 은 웹 주소(slug)가 없어 GNB 에 못 붙입니다`);
          return;
        }
        // 같은 카테고리를 두 번 붙이지 않는다(스크립트가 두 번 실행되는 경우 방어)
        if (inner.querySelector(`.cat-item[data-cat="c-${CSS.escape(c.slug)}"]`)) return;
        const holder = document.createElement('div');
        holder.innerHTML = buildDynamicCatHtml(c).trim();
        const item = holder.firstElementChild;
        if (!item) return;
        inner.appendChild(item);
        // 방금 붙인 것만 바인딩한다 - setupGnbDropdownToggle 을 다시 부르면
        // 기존 라벨에 리스너가 중복 붙어 모바일에서 토글이 두 번 돈다.
        const label = item.querySelector('.cat-label');
        if (label) bindGnbDropdownLabel(label);
      });

    // 붙이고 나서 줄 수를 다시 센다. 이게 없으면 관리자가 만든 카테고리가 늘어나
    // 세 줄이 돼도 그대로 세 줄로 남는다.
    dpFitCatBar();
  });
}

// ── 카테고리 줄 맞춤 (2026-08-11) ────────────────────────────────
//
// 넓은 화면은 격자라 몇 줄이 되든 열이 맞는다. 다만 세 줄이 되면 헤더가 화면
// 위쪽을 통째로 먹는다. 그때는 줄바꿈을 접고 한 줄 + 옆으로 밀기로 갈아탄다.
//
// 줄 수는 CSS 로 셀 수 없다. 항목들의 위쪽 좌표가 몇 종류인지로 센다.
// 줄바꿈이 켜진 화면에서만 갈아탄다. 터치 기기는 원래부터 한 줄 + 가로 스크롤이라
//   갈아탈 것이 없다.
//   display 값(grid/flex)으로 판정하지 않는다. 배치 방식은 바뀔 수 있고,
//     실제로 2026-08-11 에 격자 → flex 로 한 번 바뀌었다. 그때 grid 로 굳어 있던
//     검사 때문에 세 줄이 돼도 영영 안 갈아탔다. 물어야 할 것은 '줄바꿈이 켜졌나' 다.
function dpFitCatBar() {
  const bar = document.querySelector('.cat-bar');
  const inner = bar && bar.querySelector('.cat-inner');
  if (!inner) return;

  inner.classList.remove('is-scroll');

  const items = inner.querySelectorAll('.cat-item');
  if (items.length) {
    const tops = {};
    items.forEach((el) => { tops[Math.round(el.offsetTop)] = 1; });
    let wraps = false;
    try {
      const fw = window.getComputedStyle(inner).flexWrap;
      wraps = fw === 'wrap' || fw === 'wrap-reverse';
    } catch (e) {}
    if (wraps && Object.keys(tops).length >= 3) inner.classList.add('is-scroll');
  }

  dpMarkCatOverflow(bar, inner);
}

// 옆으로 밀 것이 남아 있으면 오른쪽 끝에 신호를 켠다.
// 2px 여유 — 브라우저가 소수점으로 재서 같은 폭인데도 1px 씩 차이가 난다.
function dpMarkCatOverflow(bar, inner) {
  const rest = inner.scrollWidth - inner.clientWidth - inner.scrollLeft;
  bar.classList.toggle('is-overflow', rest > 2);
}

function dpBindCatBar() {
  const bar = document.querySelector('.cat-bar');
  const inner = bar && bar.querySelector('.cat-inner');
  if (!inner || inner.dataset.dpFitBound) return;
  inner.dataset.dpFitBound = '1';

  // 끝까지 밀면 신호를 끈다. 더 볼 게 없는데 화살표가 남으면 있는 줄 알고 또 민다.
  inner.addEventListener('scroll', () => dpMarkCatOverflow(bar, inner), { passive: true });

  // 폴드를 펴고 접을 때마다 줄 수가 달라진다. 창 크기가 바뀌면 다시 센다.
  let t = null;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(dpFitCatBar, 120);
  });
}

// 모바일 햄버거 메뉴 토글 (≤768px 에서 노출)
function toggleGnbMobileMenu(btn) {
  const menu = document.getElementById('gnbMobile');
  if (!menu) return;
  const willOpen = menu.hasAttribute('hidden');
  if (willOpen) menu.removeAttribute('hidden');
  else menu.setAttribute('hidden', '');
  if (btn) btn.setAttribute('aria-expanded', String(willOpen));
}

// 모바일 더보기(⋯): 유틸 링크(고객센터·이벤트·후기·자주묻는질문) 카드 토글
function toggleGnbMore(btn) {
  const card = document.getElementById('gnbMoreCard');
  if (!card) return;
  const willOpen = card.hasAttribute('hidden');
  if (willOpen) card.removeAttribute('hidden');
  else card.setAttribute('hidden', '');
  if (btn) btn.setAttribute('aria-expanded', String(willOpen));
}

// 헤더 주입 실행 (gnb-user.js보다 먼저)
(function injectGnb() {
  const nav = document.querySelector('nav.gnb');
  if (!nav) return; // login/signup 등 nav.gnb 없으면 스킵
  nav.innerHTML = buildGnbHtml();
  setupGnbDropdownToggle();
  injectWaterGnbDropdown(); // 정수기 브랜드 드롭다운 (비동기 - 실패 시 일반 링크 유지)
  injectDynamicGnbCats(); // 관리자가 만든 카테고리 이어붙이기 (비동기 - 실패 시 기본 4개만)
  dpBindCatBar();         // 카테고리 줄 맞춤 — 창 크기 변화와 밀기 신호를 잡는다
  dpFitCatBar();          // 기본 4개만으로도 한 번 센다 (API 가 실패해도 신호는 맞다)
  document.addEventListener('click', (e) => {
    const more = document.querySelector('.gnb-more');
    const card = document.getElementById('gnbMoreCard');
    if (card && !card.hasAttribute('hidden') && more && !more.contains(e.target)) {
      card.setAttribute('hidden', '');
      const b = more.querySelector('.gnb-more-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    }
  });
})();
