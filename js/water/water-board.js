// ── 브랜드 정보 (메인보드용) ──
const BRAND_INFO = {
  coway: {
    name: '코웨이',
    logo: '/assets/coway/logos/coway_logo.png',
    tag: '코웨이 정수기',
    title: '코웨이 정수기<br><em>인기 모델 전체 비교</em>',
    sub: '아이콘·노블·한뼘 시리즈 약정·관리주기 선택 후 월 렌탈료 확인',
  },
  sk: {
    name: 'SK매직',
    logo: '/assets/skmagic/logos/skmagic.png',
    tag: 'SK매직 정수기',
    title: 'SK매직 정수기<br><em>올인원 자동세척 라인업</em>',
    sub: '올인원·스파클링·올클린 시리즈 약정·관리주기 선택 후 월 렌탈료 확인',
  },
  chungho: {
    name: '청호나이스',
    logo: '/assets/chungho/logos/chungho.png',
    tag: '청호나이스 정수기',
    title: '청호나이스 정수기<br><em>합리적 가격 고성능</em>',
    sub: 'SLIM·에코·MAISON 시리즈 약정·관리주기 선택 후 월 렌탈료 확인',
  },
  cuckoo: {
    name: '쿠쿠',
    logo: '/assets/cuckoo/logos/cuckoo.png',
    tag: '쿠쿠 정수기',
    title: '쿠쿠 정수기<br><em>나노필터 자연살균</em>',
    sub: 'CP 시리즈 전체 라인업 약정·관리주기 선택 후 월 렌탈료 확인',
  },
};

// ── 메인보드 → 상품뷰 전환 ──
function selectBrand(brand) {
  const info = BRAND_INFO[brand];

  // hero(.page-hero)는 제거됨 — productHeroTag/Title/Sub set도 제거(요소 없어 null 에러 방지).
  // productViewBrand(상단 브랜드 로고+이름)는 hero 아님 → 유지.
  document.getElementById('productViewBrand').innerHTML =
    `<img src="${info.logo}" alt="${info.name}" style="height:24px;object-fit:contain;">
     <span class="product-view-brand-name">${info.name}</span>`;

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
}
