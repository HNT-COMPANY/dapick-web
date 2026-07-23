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
    return `<div class="cat-item${activeCls}" onclick="goPage('${c.cat}')">${c.label}</div>`;
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
        <button class="btn-login" data-track="login_signup" onclick="window.location.href='/login'">로그인/회원가입</button>
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
function setupGnbDropdownToggle() {
  document
    .querySelectorAll('.cat-item.has-dropdown .cat-label')
    .forEach((label) => {
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
    });
  // 바깥 클릭 시 닫힘
  document.addEventListener('click', () => {
    document
      .querySelectorAll('.cat-item.has-dropdown.is-open')
      .forEach((i) => i.classList.remove('is-open'));
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
