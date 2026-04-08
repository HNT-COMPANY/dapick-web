
// ════════════════════════════════════════════════════
// 상품 데이터 — pricing: {약정년수: 월렌탈료} 만 수정
// ════════════════════════════════════════════════════
const WATER_PRODUCTS = {
  coway: {
    name: '코웨이', emoji: '💧',
    products: [
      { id:'cw1', name:'아이콘 냉온정수기',   best:true,  new:false, pricing:{3:46900,4:42900,5:39900}, cycles:['2개월','4개월'],       colors:['화이트','블랙','그레이'], desc:'1초 냉·온수 출수, IoT 연동, 스스로 관리 가능한 코웨이 대표 모델' },
      { id:'cw2', name:'노블 직수 정수기',     best:true,  new:false, pricing:{3:42900,4:38900,5:35900}, cycles:['4개월','6개월'],       colors:['화이트','실버'],          desc:'직수형 슬림 바디, 설치 간편, 합리적인 가격의 베스트셀러' },
      { id:'cw3', name:'아이콘 얼음정수기',    best:true,  new:true,  pricing:{3:57900,4:53900,5:49900}, cycles:['2개월','3개월'],       colors:['화이트','블랙'],          desc:'얼음 자동 생성 + 냉온정수, 여름철 필수 프리미엄 모델' },
      { id:'cw4', name:'마이한뼘 정수기',      best:false, new:false, pricing:{3:34900,4:31900,5:28900}, cycles:['4개월','6개월'],       colors:['화이트'],                desc:'초슬림, 원룸·사무실 최적, 공간 효율 최고' },
      { id:'cw5', name:'한뼘 플러스',          best:false, new:false, pricing:{3:38900,4:35900,5:32900}, cycles:['4개월'],              colors:['화이트','베이지'],        desc:'세련된 디자인, 직수형 필터, 한뼘 시리즈 업그레이드 버전' },
      { id:'cw6', name:'아이콘2 냉온정수기',   best:false, new:true,  pricing:{3:50900,4:46900,5:42900}, cycles:['2개월','3개월'],       colors:['화이트','블랙'],          desc:'2세대 아이콘, 더 빠른 출수속도, 향상된 필터 성능' },
    ]
  },
  sk: {
    name: 'SK매직', emoji: '⚡',
    products: [
      { id:'sk1', name:'올인원 직수 정수기',   best:true,  new:false, pricing:{3:43900,4:39900,5:36900}, cycles:['3개월','4개월'],       colors:['화이트','블랙'],          desc:'국내 최초 올인원 자동 세척, 위생 강화 특허 기술 적용' },
      { id:'sk2', name:'슈퍼 스파클링',        best:true,  new:true,  pricing:{3:59900,4:55900,5:52900}, cycles:['2개월','3개월'],       colors:['화이트'],                desc:'탄산수·냉온정수 동시 이용, 홈카페 필수 프리미엄 모델' },
      { id:'sk3', name:'올클린 냉온정수기',    best:true,  new:false, pricing:{3:45900,4:41900,5:38900}, cycles:['3개월','4개월'],       colors:['화이트','그레이'],        desc:'스테인리스 직수관, 위생 등급 최상, 가족 건강 필수' },
      { id:'sk4', name:'미니 직수 정수기',     best:false, new:false, pricing:{3:33900,4:30900,5:27900}, cycles:['4개월','6개월'],       colors:['화이트'],                desc:'초소형, 사무실·원룸·좁은 주방에 추천' },
      { id:'sk5', name:'인 싱크 빌트인',       best:false, new:false, pricing:{3:51900,4:47900,5:44900}, cycles:['3개월'],              colors:['실버'],                  desc:'빌트인 타입, 싱크대 내장 설치, 주방 인테리어 완성' },
    ]
  },
  chungho: {
    name: '청호나이스', emoji: '🌊',
    products: [
      { id:'ch1', name:'SLIM 직수 냉온정수기', best:true,  new:false, pricing:{3:40900,4:36900,5:33900}, cycles:['4개월','6개월'],       colors:['화이트','그레이'],        desc:'슬림 바디, 직수형, 4중 위생 필터, 합리적 가격 대비 고성능' },
      { id:'ch2', name:'에코 냉온정수기',      best:true,  new:false, pricing:{3:35900,4:32900,5:29900}, cycles:['4개월','6개월'],       colors:['화이트'],                desc:'에너지 절약형, 합리적 가격, 기본기 충실 실용 모델' },
      { id:'ch3', name:'얼음 냉온정수기 i30',  best:true,  new:true,  pricing:{3:55900,4:51900,5:48900}, cycles:['2개월','3개월'],       colors:['화이트','블랙'],          desc:'얼음 생성 + 냉온수, 최신 출시, 위생 자동 세척 탑재' },
      { id:'ch4', name:'벽걸이 정수기',        best:false, new:false, pricing:{3:30900,4:27900,5:24900}, cycles:['6개월'],              colors:['화이트'],                desc:'공간 절약 벽걸이형, 주방 공간 최소화, 설치 간편' },
      { id:'ch5', name:'MAISON 냉온정수기',    best:false, new:true,  pricing:{3:48900,4:44900,5:41900}, cycles:['3개월','4개월'],       colors:['화이트','베이지'],        desc:'인테리어 특화 프리미엄 디자인, 어디서나 잘 어울림' },
    ]
  },
  cuckoo: {
    name: '쿠쿠', emoji: '🍃',
    products: [
      { id:'cu1', name:'CP-SS101 냉온정수기',  best:true,  new:false, pricing:{3:41900,4:37900,5:34900}, cycles:['4개월','6개월'],       colors:['화이트','그레이'],        desc:'자연 살균, 나노 필터, 6중 정수 시스템, 쿠쿠 스테디셀러' },
      { id:'cu2', name:'CP-AT100 직수형',      best:true,  new:false, pricing:{3:37900,4:34900,5:31900}, cycles:['4개월'],              colors:['화이트'],                desc:'직수형 슬림, 공간 효율 극대화, 실용파 추천 모델' },
      { id:'cu3', name:'CP-IE301 얼음정수기',  best:true,  new:true,  pricing:{3:54900,4:50900,5:47900}, cycles:['2개월','3개월'],       colors:['화이트','블랙'],          desc:'얼음+냉온수, 위생 자동 세척, 최신 출시 프리미엄' },
      { id:'cu4', name:'CP-DS101 미니',        best:false, new:false, pricing:{3:32900,4:29900,5:26900}, cycles:['4개월','6개월'],       colors:['화이트'],                desc:'미니 사이즈, 1인 가구·원룸 추천, 부담 없는 가격' },
      { id:'cu5', name:'CP-SS301 스파클링',    best:false, new:true,  pricing:{3:58900,4:54900,5:51900}, cycles:['2개월','3개월'],       colors:['화이트'],                desc:'탄산수 생성, 프리미엄 기능 집약, 홈카페 라이프스타일' },
    ]
  }
};

// ── 상태 ──
let currentBrand = 'coway';
let favorites = {};        // { id: { contract, cycle, color, monthly } }
let dialogProd = null;
let dialogBrandKey = null;
let dialogColor = '';

// ── 브랜드 전환 ──
function switchBrand(brand) {
  currentBrand = brand;
  document.querySelectorAll('.brand-tab').forEach(t => t.classList.toggle('active', t.dataset.brand === brand));
  renderBrand(brand);
}

// ── 렌더링 ──
function renderBrand(brand) {
  const data = WATER_PRODUCTS[brand];
  const best = data.products.filter(p => p.best);

  document.getElementById('bestTitle').textContent = `${data.name} 인기 상품`;
  document.getElementById('bestSub').textContent   = `다픽 고객이 가장 많이 선택한 ${data.name} 정수기 TOP ${best.length}`;
  document.getElementById('listTitle').textContent = `${data.name} 전체 상품`;

  // 베스트 카드
  document.getElementById('bestGrid').innerHTML = best.map(p => {
    const p5 = p.pricing[5];
    return `
    <div class="water-card is-best" onclick="openDialog('${p.id}','${brand}')">
      <button class="water-card-heart ${favorites[p.id]?'active':''}" onclick="quickFav(event,'${p.id}','${brand}')">♥</button>
      <div class="water-card-badges">
        <span class="wbadge wbadge-best">BEST</span>
        ${p.new?'<span class="wbadge wbadge-new">NEW</span>':''}
        <span class="wbadge wbadge-brand">${data.name}</span>
      </div>
      <div class="water-card-name">${p.name}</div>
      <div class="water-card-price-row">
        <span class="water-card-price">월 ${p5.toLocaleString()}원</span>
        <span class="water-card-price-unit">~/ 5년 기준</span>
      </div>
      <div class="water-card-tiers">
        <div class="water-card-tier"><div class="water-card-tier-label">3년</div><div class="water-card-tier-val">${p.pricing[3].toLocaleString()}원</div></div>
        <div class="water-card-tier"><div class="water-card-tier-label">4년</div><div class="water-card-tier-val">${p.pricing[4].toLocaleString()}원</div></div>
        <div class="water-card-tier"><div class="water-card-tier-label">5년</div><div class="water-card-tier-val">${p5.toLocaleString()}원</div></div>
      </div>
      <div class="water-card-desc">${p.desc}</div>
    </div>`;
  }).join('');

  // 전체 리스트
  document.getElementById('listGrid').innerHTML = data.products.map(p => `
    <div class="water-list-item" onclick="openDialog('${p.id}','${brand}')">
      <div class="water-list-icon">${data.emoji}</div>
      <div class="water-list-info">
        <div class="water-list-name">${p.name}${p.new?' 🆕':''}</div>
        <div class="water-list-price">월 ${p.pricing[5].toLocaleString()}원~<span> · 약정 선택 가능</span></div>
      </div>
      <div class="water-list-arrow">›</div>
    </div>`
  ).join('');
}

// ── 다이얼로그 열기 ──
function openDialog(productId, brand) {
  const data = WATER_PRODUCTS[brand];
  const p    = data.products.find(x => x.id === productId);
  if (!p) return;

  dialogProd     = p;
  dialogBrandKey = brand;
  const prev     = favorites[p.id] || {};
  dialogColor    = prev.color || p.colors[0];

  // 헤더
  document.getElementById('wDTag').textContent  = `${data.emoji} ${data.name}${p.new?'  🆕 NEW':''}`;
  document.getElementById('wDName').textContent = p.name;

  // 약정
  document.getElementById('wDContract').value = prev.contract || '5';

  // 관리주기
  const cycleSel = document.getElementById('wDCycle');
  cycleSel.innerHTML = p.cycles.map(c =>
    `<option value="${c}" ${c===(prev.cycle||p.cycles[0])?'selected':''}>${c}마다 방문 관리</option>`
  ).join('');

  // 색상 칩
  renderColorChips(p);

  // 하트 상태
  const isFav = !!favorites[p.id];
  const heartBtn = document.getElementById('wDHeart');
  heartBtn.classList.toggle('active', isFav);
  heartBtn.textContent = isFav ? '❤️' : '🤍';

  calcPrice();

  document.getElementById('wDialogOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

// ── 색상 칩 렌더링 ──
function renderColorChips(p) {
  document.getElementById('wDColors').innerHTML = p.colors.map(c =>
    `<div class="w-chip ${dialogColor===c?'active':''}" onclick="selectColor('${c}')">${c}</div>`
  ).join('');
}

// ── 색상 선택 ──
function selectColor(color) {
  dialogColor = color;
  document.querySelectorAll('.w-chip').forEach(c => c.classList.toggle('active', c.textContent === color));
}

// ── 가격 자동 계산 ──
function calcPrice() {
  if (!dialogProd) return;
  const contract = parseInt(document.getElementById('wDContract').value);
  const monthly  = dialogProd.pricing[contract];
  const total    = monthly * contract * 12;
  const cycle    = document.getElementById('wDCycle').value;

  document.getElementById('wDPrice').innerHTML = `${monthly.toLocaleString()}<span>원/월</span>`;
  document.getElementById('wDTotal').textContent = `총 ${total.toLocaleString()}원`;

  document.getElementById('wDSpecs').innerHTML = `
    <div class="w-spec-item"><div class="w-spec-label">약정 기간</div><div class="w-spec-val">${contract}년</div></div>
    <div class="w-spec-item"><div class="w-spec-label">관리 주기</div><div class="w-spec-val">${cycle}마다</div></div>
    <div class="w-spec-item"><div class="w-spec-label">월 렌탈료</div><div class="w-spec-val">${monthly.toLocaleString()}원</div></div>
    <div class="w-spec-item"><div class="w-spec-label">초기 비용</div><div class="w-spec-val">0원</div></div>`;

  document.getElementById('wDDesc').textContent = dialogProd.desc;
}

// ── 즐겨찾기 (다이얼로그) ──
function toggleFavInDialog() {
  if (!dialogProd) return;
  const id = dialogProd.id;
  if (favorites[id]) {
    delete favorites[id];
  } else {
    favorites[id] = {
      contract: document.getElementById('wDContract').value,
      cycle:    document.getElementById('wDCycle').value,
      color:    dialogColor,
      monthly:  dialogProd.pricing[parseInt(document.getElementById('wDContract').value)]
    };
  }
  const isFav = !!favorites[id];
  document.getElementById('wDHeart').classList.toggle('active', isFav);
  document.getElementById('wDHeart').textContent = isFav ? '❤️' : '🤍';
  updateBottomBar();
  renderBrand(currentBrand);
}

// ── 즐겨찾기 (카드 하트) ──
function quickFav(e, productId, brand) {
  e.stopPropagation();
  if (favorites[productId]) {
    delete favorites[productId];
  } else {
    const p = WATER_PRODUCTS[brand].products.find(x => x.id === productId);
    favorites[productId] = { contract:'5', cycle:p.cycles[0], color:p.colors[0], monthly:p.pricing[5] };
  }
  updateBottomBar();
  renderBrand(currentBrand);
}

// ── 하단 바 합계 업데이트 ──
function updateBottomBar() {
  const ids = Object.keys(favorites);
  if (!ids.length) {
    document.getElementById('wbbPrice').textContent = '상품을 찜해주세요';
    document.getElementById('wbbCount').textContent = '';
    return;
  }
  const total = ids.reduce((s, id) => s + (favorites[id].monthly || 0), 0);
  document.getElementById('wbbPrice').textContent = `월 ${total.toLocaleString()}원`;
  document.getElementById('wbbCount').textContent = `(${ids.length}개 상품)`;
}

// ── 다이얼로그 닫기 ──
function closeDialog() {
  document.getElementById('wDialogOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function closeDialogOutside(e) {
  if (e.target === document.getElementById('wDialogOverlay')) closeDialog();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDialog(); });

// ── 공통 유틸 ──
function goPage(page) {
  const map = { phone:'phone.html', internet:'internet.html', card:'card.html', water:'water.html', rental:'rental.html' };
  window.location.href = map[page] || 'index.html';
}
function openKakao() { window.open('http://pf.kakao.com/_LxifxmG/chat','_blank'); }

// 스크롤 탑 버튼
window.addEventListener('scroll', () => {
  document.getElementById('scroll-top').classList.toggle('show', window.scrollY > 300);
}, { passive: true });

// ── 초기 실행 ──
renderBrand('coway');