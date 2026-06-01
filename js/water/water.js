// ════════════════════════════════════════════════════
// water.js — 정수기 페이지 렌더링 / 다이얼로그 / 즐겨찾기
// 데이터는 /api/water/products 에서 로드됩니다
// 5/27: 상담 신청(consultation) 연결 — openWaterApply() 추가
//        DapickApplication.apply() 공통 모달 호출 (통일)
// 5/28: 카드/리스트 클릭 → 상세 페이지(water-detail.html?id=)로 이동
//        전체 상품 = 아정당식 카드 그리드 (water-prod-card)
//        브랜드 배너 자동 삽입 (renderBrandBanner)
// ════════════════════════════════════════════════════

// ── 공통 상수 ──
const EMPTY = { monthly: 0, cardDiscount: 0, maxSupport: 0 };

const CONTRACT_LABELS = {
  '의무36/계약60': '36개월(의무) · 60개월(계약)',
  '의무60/계약60': '60개월(의무) · 60개월(계약)',
  '의무72/계약72': '72개월(의무) · 72개월(계약)',
  '의무84/계약84': '84개월(의무) · 84개월(계약)',
};

// ── 브랜드 메타 (프론트 전용 — emoji 등) ──
const BRAND_META = {
  coway: { name: '코웨이', emoji: '💧' },
  sk: { name: 'SK매직', emoji: '⚡' },
  chungho: { name: '청호나이스', emoji: '🌊' },
  cuckoo: { name: '쿠쿠', emoji: '🍃' },
};

// ── API로부터 로드된 상품 데이터 ──
let WATER_PRODUCTS = {};
let _productsPromise = null;

// ════════════════════════════════════════════════════
// API 호출 및 데이터 로딩
// ════════════════════════════════════════════════════
function loadWaterProducts() {
  if (_productsPromise) return _productsPromise;

  const url = `${DAPICK_CONFIG.API_BASE_URL}/api/water-products`;

  _productsPromise = fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      const list = Array.isArray(json) ? json : json?.data || [];
      WATER_PRODUCTS = groupByBrand(list);
      return WATER_PRODUCTS;
    })
    .catch((err) => {
      console.error('[water] 상품 로드 실패:', err);
      _productsPromise = null;
      throw err;
    });

  return _productsPromise;
}

// ── 백엔드 응답을 프론트 소비 형태로 변환 + 브랜드별 그룹핑 ──
function groupByBrand(list) {
  const groups = {};

  list.forEach((p) => {
    const brandKey = p.brand;
    if (!brandKey) return;

    if (!groups[brandKey]) {
      groups[brandKey] = {
        name: p.brandName || BRAND_META[brandKey]?.name || brandKey,
        emoji: BRAND_META[brandKey]?.emoji || '💧',
        products: [],
      };
    }

    groups[brandKey].products.push({
      id: p.id,
      name: p.name,
      desc: p.description || '',
      image: p.imageUrl || '',
      best: !!p.best,
      new: !!p.new,
      colors: Array.isArray(p.colors) && p.colors.length ? p.colors : ['기본'],
      pricing: p.pricing || {},
      sortOrder: p.sortOrder ?? 999,
      averageRating: p.averageRating ?? 0,
      reviewCount: p.reviewCount ?? 0,
    });
  });

  Object.values(groups).forEach((g) => {
    g.products.sort((a, b) => a.sortOrder - b.sortOrder);
  });

  return groups;
}

// ════════════════════════════════════════════════════
// 헬퍼 함수
// ════════════════════════════════════════════════════
function getMinPrice(pricing) {
  let min = Infinity;
  Object.values(pricing).forEach((cycles) => {
    Object.values(cycles).forEach((types) => {
      Object.values(types).forEach((d) => {
        if (d.monthly > 0 && d.monthly < min) min = d.monthly;
      });
    });
  });
  return min === Infinity ? 0 : min;
}

function getMinByContract(pricing, contractKey) {
  const cycles = pricing[contractKey];
  if (!cycles) return null;
  let min = Infinity;
  Object.values(cycles).forEach((types) => {
    Object.values(types).forEach((d) => {
      if (d.monthly > 0 && d.monthly < min) min = d.monthly;
    });
  });
  return min === Infinity ? null : min;
}

// 최저가 옵션의 {monthly, cardDiscount} 반환 (카드 표시용)
function getBestPriceInfo(pricing) {
  let best = null;
  Object.values(pricing).forEach((cycles) => {
    Object.values(cycles).forEach((types) => {
      Object.values(types).forEach((d) => {
        if (d.monthly > 0 && (!best || d.monthly < best.monthly)) {
          best = { monthly: d.monthly, cardDiscount: d.cardDiscount || 0 };
        }
      });
    });
  });
  return best;
}

// ════════════════════════════════════════════════════
// 상태
// ════════════════════════════════════════════════════
let currentBrand = 'coway';
let favorites = {};
let dialogProd = null;
let dialogBrandKey = null;
let dialogColor = '';

// ════════════════════════════════════════════════════
// 브랜드 전환
// ════════════════════════════════════════════════════
async function switchBrand(brand) {
  currentBrand = brand;
  document
    .querySelectorAll('.brand-tab')
    .forEach((t) => t.classList.toggle('active', t.dataset.brand === brand));
  await renderBrand(brand);
}

// ════════════════════════════════════════════════════
// 렌더링
// ════════════════════════════════════════════════════
async function renderBrand(brand) {
  renderLoading();

  try {
    await loadWaterProducts();
  } catch (e) {
    renderError();
    return;
  }

  const data = WATER_PRODUCTS[brand];
  if (!data || !data.products || data.products.length === 0) {
    renderEmpty(brand);
    return;
  }

  const best = data.products.filter((p) => p.best);
  const contractKeys = Object.keys(CONTRACT_LABELS);

  const bestSection = document.getElementById('bestSection');
  const bestTitleEl = document.getElementById('bestTitle');
  const bestSubEl = document.getElementById('bestSub');
  const bestBadgeEl = document.getElementById('bestBadge');
  const bestGridEl = document.getElementById('bestGrid');
  const listTitleEl = document.getElementById('listTitle');
  const listGridEl = document.getElementById('listGrid');

  if (best.length === 0) {
    if (bestSection) bestSection.style.display = 'none';
    if (bestGridEl) bestGridEl.innerHTML = '';
  } else {
    if (bestSection) bestSection.style.display = '';

    if (bestTitleEl) bestTitleEl.textContent = `${data.name} 인기 상품`;
    if (bestSubEl)
      bestSubEl.textContent = `다픽 고객이 가장 많이 선택한 ${data.name} 정수기 TOP ${best.length}`;

    if (bestBadgeEl) {
      bestBadgeEl.textContent =
        best.length > 1 ? `BEST ${best.length}` : 'BEST';
    }

    bestGridEl.innerHTML = best
      .map((p) => {
        const minPrice = getMinPrice(p.pricing);
        const tierHtml = contractKeys
          .map((key) => {
            const val = getMinByContract(p.pricing, key);
            const shortLabel = key.split('/')[0].replace('의무', '') + '개월';
            return `
        <div class="water-card-tier">
          <div class="water-card-tier-label">${shortLabel}(의무)</div>
          <div class="water-card-tier-val">${val ? val.toLocaleString() + '원~' : '-'}</div>
        </div>`;
          })
          .join('');

        return `
    <div class="water-card is-best" onclick="location.href='water-detail.html?id=${p.id}'">
      <button class="water-card-heart ${favorites[p.id] ? 'active' : ''}" onclick="quickFav(event,'${p.id}','${brand}')">♥</button>
      <div class="water-card-badges">
        <span class="wbadge wbadge-best">BEST</span>
        ${p.new ? '<span class="wbadge wbadge-new">NEW</span>' : ''}
        <span class="wbadge wbadge-brand">${data.name}</span>
      </div>
      <div class="water-card-img">
        ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<span>${data.emoji}</span>`}
      </div>
      <div class="water-card-name">${p.name}</div>
      ${ratingHtml(p.averageRating, p.reviewCount)}
      <div class="water-card-price-row">
        <span class="water-card-price">${minPrice ? '월 ' + minPrice.toLocaleString() + '원~' : '가격 문의'}</span>
        <span class="water-card-price-unit">${minPrice ? '최저가' : ''}</span>
      </div>
      <div class="water-card-tiers" style="grid-template-columns:repeat(4,1fr);">${tierHtml}</div>
      <div class="water-card-desc">${p.desc}</div>
    </div>`;
      })
      .join('');
  }

  // ── 브랜드 배너 (현재 브랜드에 맞게) ──
  renderBrandBanner(brand);

  // ── 전체 상품 — 아정당식 카드 그리드 ──
  if (listTitleEl) listTitleEl.textContent = `${data.name} 전체 상품`;

  listGridEl.innerHTML = data.products
    .map((p) => {
      const info = getBestPriceInfo(p.pricing);
      const hasPrice = !!info;
      const orig = hasPrice ? info.monthly : 0;
      const discounted = hasPrice ? Math.max(orig - info.cardDiscount, 0) : 0;
      const hasDiscount = hasPrice && info.cardDiscount > 0;

      const priceHtml = hasPrice
        ? `
        ${hasDiscount ? `<span class="wpg-orig">월 ${orig.toLocaleString()}원</span>` : ''}
        <div class="wpg-price-line">
          ${hasDiscount ? '<span class="wpg-tag">카드할인</span>' : ''}
          <span class="wpg-price">월 ${discounted.toLocaleString()}원~</span>
        </div>`
        : `<div class="wpg-price-line"><span class="wpg-price wpg-ask">가격 문의</span></div>`;

      return `
    <div class="water-prod-card" onclick="location.href='water-detail.html?id=${p.id}'">
      <div class="wpg-img">
        ${p.best ? '<span class="wpg-badge-best">인기</span>' : ''}
        ${p.new ? '<span class="wpg-badge-new">NEW</span>' : ''}
        ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<span class="wpg-emoji">${data.emoji}</span>`}
      </div>
      <div class="wpg-body">
        <div class="wpg-name">${p.name}</div>
        ${ratingHtml(p.averageRating, p.reviewCount)}
        ${priceHtml}
      </div>
    </div>`;
    })
    .join('');
}

// ── 브랜드 배너: assets/{brand}/{brand}-01.png 시도, 없으면 숨김 ──
function renderBrandBanner(brand) {
  const el = document.getElementById('brandBanner');
  if (!el) return;
  const src = `assets/${brand}/${brand}-01.png`;
  el.innerHTML = `<img src="${src}" alt="${brand} 배너" onerror="this.parentElement.style.display='none'">`;
  el.style.display = ''; // 일단 표시, 이미지 로드 실패 시 onerror 가 숨김
}

// ── 로딩/에러/빈 상태 표시 ──
function renderLoading() {
  const html = `
    <div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:var(--text-muted);">
      <div style="display:inline-block;width:28px;height:28px;border:3px solid var(--purple-pale);border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>
      <div style="font-size:13px;">상품 정보를 불러오는 중입니다...</div>
    </div>`;
  const bestSection = document.getElementById('bestSection');
  const bg = document.getElementById('bestGrid');
  const lg = document.getElementById('listGrid');

  if (bestSection) bestSection.style.display = '';
  if (bg) bg.innerHTML = html;
  if (lg) lg.innerHTML = '';
}

function renderError() {
  const html = `
    <div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:var(--text-muted);">
      <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
      <div style="font-size:14px;font-weight:700;color:var(--text-main);margin-bottom:6px;">상품 정보를 불러오지 못했습니다</div>
      <div style="font-size:12px;margin-bottom:16px;">잠시 후 다시 시도해주세요</div>
      <button onclick="renderBrand(currentBrand)" style="padding:8px 20px;border:1.5px solid var(--purple-soft);background:var(--white);color:var(--purple);border-radius:8px;font-weight:700;cursor:pointer;">다시 시도</button>
    </div>`;
  const bestSection = document.getElementById('bestSection');
  const bg = document.getElementById('bestGrid');
  const lg = document.getElementById('listGrid');

  if (bestSection) bestSection.style.display = '';
  if (bg) bg.innerHTML = html;
  if (lg) lg.innerHTML = '';
}

function renderEmpty(brand) {
  const name = BRAND_META[brand]?.name || brand;
  const html = `
    <div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:var(--text-muted);font-size:13px;">
      ${name} 브랜드 상품이 등록되어 있지 않습니다.
    </div>`;

  const bestSection = document.getElementById('bestSection');
  const bg = document.getElementById('bestGrid');
  const lg = document.getElementById('listGrid');

  if (bestSection) bestSection.style.display = 'none';
  if (bg) bg.innerHTML = '';
  if (lg) lg.innerHTML = html;
}

// ════════════════════════════════════════════════════
// 다이얼로그
// ════════════════════════════════════════════════════
function openDialog(productId, brand) {
  const data = WATER_PRODUCTS[brand];
  if (!data) return;
  const p = data.products.find((x) => x.id === productId);
  if (!p) return;

  dialogProd = p;
  dialogBrandKey = brand;
  const prev = favorites[p.id] || {};
  dialogColor = prev.color || p.colors[0];

  document.getElementById('wDTag').textContent =
    `${data.emoji} ${data.name}${p.new ? '  🆕 NEW' : ''}`;
  document.getElementById('wDName').textContent = p.name;

  const contractKeys = Object.keys(p.pricing);
  const defaultContract =
    prev.contract || contractKeys[contractKeys.length - 1];
  const contractSel = document.getElementById('wDContract');
  contractSel.innerHTML = contractKeys
    .map(
      (key) =>
        `<option value="${key}" ${key === defaultContract ? 'selected' : ''}>${CONTRACT_LABELS[key] || key}</option>`,
    )
    .join('');
  contractSel.onchange = () => {
    updateCycleOptions(p, null);
    updateTypeOptions(p, null);
    calcPrice();
  };

  updateCycleOptions(p, prev.cycle);
  updateTypeOptions(p, prev.type);
  renderColorChips(p);

  const isFav = !!favorites[p.id];
  const heartBtn = document.getElementById('wDHeart');
  heartBtn.classList.toggle('active', isFav);
  heartBtn.textContent = isFav ? '❤️' : '🤍';

  calcPrice();
  document.getElementById('wDialogOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function updateCycleOptions(p, prevCycle) {
  const contract = document.getElementById('wDContract').value;
  const cycles = Object.keys(p.pricing[contract] || {});
  const cycleSel = document.getElementById('wDCycle');
  cycleSel.innerHTML = cycles
    .map(
      (c) =>
        `<option value="${c}" ${c === (prevCycle || cycles[0]) ? 'selected' : ''}>${c} 방문 관리</option>`,
    )
    .join('');
  cycleSel.onchange = () => {
    updateTypeOptions(p, null);
    calcPrice();
  };
}

function updateTypeOptions(p, prevType) {
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const types = Object.keys((p.pricing[contract] || {})[cycle] || {});
  const typeSel = document.getElementById('wDType');
  typeSel.innerHTML = types
    .map(
      (t) =>
        `<option value="${t}" ${t === (prevType || types[0]) ? 'selected' : ''}>
      ${t === '타사보상' ? '타사보상 (현재 다른 회사 정수기 사용 중)' : t}
    </option>`,
    )
    .join('');
  typeSel.onchange = () => calcPrice();
}

function renderColorChips(p) {
  document.getElementById('wDColors').innerHTML = p.colors
    .map(
      (c) =>
        `<div class="w-chip ${dialogColor === c ? 'active' : ''}" onclick="selectColor('${c}')">${c}</div>`,
    )
    .join('');
}

function selectColor(color) {
  dialogColor = color;
  document
    .querySelectorAll('.w-chip')
    .forEach((c) => c.classList.toggle('active', c.textContent === color));
}

function calcPrice() {
  if (!dialogProd) return;
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = dialogProd.pricing[contract]?.[cycle]?.[type];
  if (!d) return;

  const contractMonths =
    parseInt((contract.split('/')[1] || '').replace(/[^0-9]/g, '')) || 60;
  const total = d.monthly * contractMonths;
  const contractLabel = CONTRACT_LABELS[contract] || contract;

  document.getElementById('wDPrice').innerHTML = d.monthly
    ? `${d.monthly.toLocaleString()}<span>원/월</span>`
    : `<span style="font-size:15px;color:var(--text-muted);">상담 시 안내</span>`;

  document.getElementById('wDTotal').textContent = d.monthly
    ? `총 ${total.toLocaleString()}원 (${contractMonths}개월)`
    : '-';

  const cardHtml = d.cardDiscount
    ? `<span style="color:#e8547a;font-weight:700;">월 ${d.cardDiscount.toLocaleString()}원</span>`
    : `<span style="color:var(--text-muted);font-size:12px;">상담 시 안내</span>`;
  const supportHtml = d.maxSupport
    ? `<span style="color:var(--purple);font-weight:700;">₩ ${d.maxSupport.toLocaleString()}</span>`
    : `<span style="color:var(--text-muted);font-size:12px;">상담 시 안내</span>`;

  document.getElementById('wDSpecs').innerHTML = `
    <div class="w-spec-item"><div class="w-spec-label">약정 조건</div><div class="w-spec-val" style="font-size:12px;">${contractLabel}</div></div>
    <div class="w-spec-item"><div class="w-spec-label">가입 조건</div><div class="w-spec-val">${type}</div></div>
    <div class="w-spec-item"><div class="w-spec-label">카드할인 시</div><div class="w-spec-val">${cardHtml}</div></div>
    <div class="w-spec-item"><div class="w-spec-label">최대 지원금</div><div class="w-spec-val">${supportHtml}</div></div>`;

  document.getElementById('wDDesc').textContent = dialogProd.desc;
}

function closeDialog() {
  document.getElementById('wDialogOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

function closeDialogOutside(e) {
  if (e.target === document.getElementById('wDialogOverlay')) closeDialog();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDialog();
});

// ════════════════════════════════════════════════════
// 즐겨찾기
// ════════════════════════════════════════════════════
function toggleFavInDialog() {
  if (!dialogProd) return;
  const id = dialogProd.id;
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  if (favorites[id]) {
    delete favorites[id];
  } else {
    favorites[id] = {
      contract,
      cycle,
      type,
      color: dialogColor,
      monthly: dialogProd.pricing[contract]?.[cycle]?.[type]?.monthly || 0,
    };
  }
  const isFav = !!favorites[id];
  document.getElementById('wDHeart').classList.toggle('active', isFav);
  document.getElementById('wDHeart').textContent = isFav ? '❤️' : '🤍';
  updateBottomBar();
  if (
    document.getElementById('bestGrid') ||
    document.getElementById('listGrid')
  ) {
    renderBrand(currentBrand);
  }
}

function quickFav(e, productId, brand) {
  e.stopPropagation();

  const data = WATER_PRODUCTS[brand];
  if (!data || !data.products) return;

  if (favorites[productId]) {
    delete favorites[productId];
  } else {
    const p = data.products.find((x) => x.id === productId);
    if (!p) return;

    const contracts = Object.keys(p.pricing);
    if (contracts.length === 0) return;

    const lastC = contracts[contracts.length - 1];
    const cycles = Object.keys(p.pricing[lastC] || {});
    if (cycles.length === 0) return;

    const firstCy = cycles[0];
    const types = Object.keys(p.pricing[lastC][firstCy] || {});
    if (types.length === 0) return;

    favorites[productId] = {
      contract: lastC,
      cycle: firstCy,
      type: types[0],
      color: (p.colors && p.colors[0]) || '기본',
      monthly: p.pricing[lastC][firstCy][types[0]]?.monthly || 0,
    };
  }
  updateBottomBar();
  renderBrand(currentBrand);
}

function updateBottomBar() {
  const ids = Object.keys(favorites);
  const priceEl = document.getElementById('wbbPrice');
  const countEl = document.getElementById('wbbCount');
  if (!priceEl || !countEl) return;
  if (!ids.length) {
    priceEl.textContent = '상품을 찜해주세요';
    countEl.textContent = '';
    return;
  }
  const total = ids.reduce((s, id) => s + (favorites[id].monthly || 0), 0);
  priceEl.textContent = `월 ${total.toLocaleString()}원`;
  countEl.textContent = `(${ids.length}개 상품)`;
}

// ════════════════════════════════════════════════════
// 카카오 상담 — utils.js의 openKakaoConsult() 호출
// ════════════════════════════════════════════════════
function openKakaoWithProduct() {
  if (!dialogProd) {
    openKakaoConsult();
    return;
  }

  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = dialogProd.pricing[contract]?.[cycle]?.[type];

  openKakaoConsult({
    category: '정수기 렌탈',
    brand: WATER_PRODUCTS[dialogBrandKey]?.name || '',
    productName: dialogProd.name,
    color: dialogColor,
    contract: CONTRACT_LABELS[contract] || contract,
    cycle: `${cycle} 방문 관리`,
    type: type,
    monthly: d?.monthly || 0,
  });
}

// ════════════════════════════════════════════════════
// 상담 신청 — DapickApplication.apply() 공통 모달 호출
// ════════════════════════════════════════════════════
function openWaterApply() {
  if (!dialogProd) return;

  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = dialogProd.pricing[contract]?.[cycle]?.[type];
  const monthly = d?.monthly || 0;

  if (!monthly || monthly <= 0) {
    alert(
      '이 옵션은 월 요금이 책정되어 있지 않아 온라인 신청이 어렵습니다.\n카카오 상담으로 연결해드릴게요.',
    );
    openKakaoWithProduct();
    return;
  }

  if (typeof DapickApplication === 'undefined' || !DapickApplication.apply) {
    console.error('[water] application.js 미로드');
    alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  DapickApplication.apply({
    category: 'WATER',
    productId: dialogProd.id,
    productName: dialogProd.name,
    brand: WATER_PRODUCTS[dialogBrandKey]?.name || '',
    selectedOptions: {
      color: dialogColor,
      contract: CONTRACT_LABELS[contract] || contract,
      cycle: `${cycle} 방문 관리`,
      type: type,
    },
    monthlyPrice: monthly,
  });
}

// ════════════════════════════════════════════════════
// 공통 유틸
// ════════════════════════════════════════════════════
function goPage(page) {
  const map = {
    phone: 'phone.html',
    internet: 'internet.html',
    card: 'card.html',
    water: 'water.html',
    rental: 'rental.html',
  };
  window.location.href = map[page] || 'index.html';
}

function openKakao() {
  window.open('http://pf.kakao.com/_LxifxmG/chat', '_blank');
}

window.addEventListener(
  'scroll',
  () => {
    const btn = document.getElementById('scroll-top');
    if (btn) btn.classList.toggle('show', window.scrollY > 300);
  },
  { passive: true },
);

// ════════════════════════════════════════════════════
// 초기 실행
// ════════════════════════════════════════════════════
loadWaterProducts().catch(() => {});

document.addEventListener('DOMContentLoaded', () => {
  if (typeof resumePendingKakaoConsult === 'function') {
    resumePendingKakaoConsult();
  }
  if (
    typeof DapickApplication !== 'undefined' &&
    DapickApplication.resumeIfPending
  ) {
    DapickApplication.resumeIfPending();
  }
});
