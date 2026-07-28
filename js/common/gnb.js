// ── 공통 헤더(GNB) 주입 ──────────────────────────────────
// gnb-user.js보다 먼저 실행되어야 함 (gnb-user.js가 .gnb-right를 찾으므로)
// ※ 마크업은 internet-unified.html의 기존 gnb-top을 그대로 미러링
//   (gnb-extras 바는 이 헤더에 없음 — 원본과 동일하게 유지)

// 통신사 6사 (하드코딩 — 백엔드 무수정. 페이지 파일명은 CARRIER_MAP과 일치)
const GNB_CARRIERS = [
  // carrier: unified 페이지로 넘길 정확한 코드값(CARRIER_MAP 키, 공백·대소문자 원본)
  // page: 독립 HTML 경로(롤백/직접진입용 보존 — 현재 렌더에선 미사용)
  { label: 'SKT', carrier: 'SKT', page: 'internet-skt.html' },
  // 알뜰 3사 비노출 (2026-07-03, 3사 통신사만 운영) — 재개 시 주석 해제
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
  { cat: 'rental', label: '렌탈' },
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
  if (cat === 'rental') return path.startsWith('rental');
  return false;
}

// 모바일: 드롭다운 클릭 토글 (데스크탑은 CSS hover)
// 라벨 1개 바인딩 — 동적으로 추가되는 드롭다운(정수기)도 이 함수를 재사용한다.
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

// ── 정수기 브랜드 로더 (공개 API) — GNB 드롭다운·정수기 페이지(water-board.js) 공용 ──
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

// 로고 src 보정 — /uploads/... 는 API 서버 상대경로라 API_BASE 를 붙인다. /assets/...·절대 URL 은 그대로.
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
    // div 자체의 onclick(goPage)을 제거하고 라벨로 옮긴다 — 서브링크 클릭이 버블돼 목록으로 튀는 것 방지
    item.removeAttribute('onclick');
    item.onclick = null;
    item.classList.add('has-dropdown');
    item.innerHTML = `<span class="cat-label" onclick="goPage('water')">정수기</span><div class="cat-dropdown">${subLinks}</div>`;
    const label = item.querySelector('.cat-label');
    if (label) bindGnbDropdownLabel(label);
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
  injectWaterGnbDropdown(); // 정수기 브랜드 드롭다운 (비동기 — 실패 시 일반 링크 유지)
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
