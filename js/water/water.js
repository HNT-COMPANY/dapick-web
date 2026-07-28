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
const EMPTY = { monthly: 0, maxSupport: 0 };

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
        // 이름 우선순위: 상품 응답 brandName → 브랜드 API(BRAND_INFO) → 레거시 BRAND_META → 코드
        name:
          p.brandName ||
          (typeof BRAND_INFO !== 'undefined' && BRAND_INFO[brandKey]?.name) ||
          BRAND_META[brandKey]?.name ||
          brandKey,
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
      // 정수기능 뱃지용 — EnumDto {code,label} 또는 null (API: /api/water-products)
      waterFunction: p.waterFunction || null,
      modelName: p.modelName || '',
      householdSize: p.householdSize || null,
      // 목적태그 — 응답은 [{code,label}] (EnumDto List) → code 배열로 정규화 (필터 includes 매칭용)
      purposeTags: Array.isArray(p.purposeTags) ? p.purposeTags.map((t) => t.code) : [],
      // 사이드바 필터용 enum ({code,label} 그대로 — 필터 시 .code 비교)
      installType: p.installType || null,
      filterType: p.filterType || null,
      extractType: p.extractType || null,
      pipeMaterial: p.pipeMaterial || null,
      // 살균방식(sanitizing) — 응답 [{code,label}] → code 배열(필터 includes 매칭용)
      sanitizing: Array.isArray(p.sanitizing) ? p.sanitizing.map((t) => t.code) : [],
      // 월 렌탈료: 저장 priceRange(대부분 null) 대신 pricing 최저 월요금으로 구간 산출
      priceBucket: computePriceBucket(p.pricing),
      // 배지/필터용 — 특가(special)·프로모션(promoType {code,label} or null)·슬림(slimType)·타사보상(tradeIn)
      special: !!p.special,
      promoType: p.promoType || null,
      slimType: p.slimType || null,
      tradeIn: !!p.tradeIn,
    });
  });

  Object.values(groups).forEach((g) => {
    g.products.sort((a, b) => a.sortOrder - b.sortOrder);
  });

  return groups;
}

// ── 월 렌탈료 구간 판정 — pricing 최저 월요금 → priceRange enum 코드 (J1: 4구간) ──
// 1만원 미만은 RANGE_10K로 흡수(백엔드 V20260704003 UNDER_10K→RANGE_10K 병합과 일치).
// 4만원 이상은 OVER_40K(구 RANGE_40K/OVER_50K 병합).
// ★가격대 필터는 '월 렌탈료' 기준이어야 하므로 getMinPrice(순수 최저 monthly)로 산출.
//   (getBestPriceInfo는 표시용으로 제휴카드가 포함된 '실지불 최저가'를 고르게 바뀌어 버킷과 분리.)
function computePriceBucket(pricing) {
  const m = getMinPrice(pricing) || null; // 최저 monthly (없으면 0→null)
  if (m == null) return null;
  if (m < 20000) return 'RANGE_10K';
  if (m < 30000) return 'RANGE_20K';
  if (m < 40000) return 'RANGE_30K';
  return 'OVER_40K';
}

// ── 정수기능 뱃지 ──
// waterFunction(EnumDto code, 단일 조합값)을 개별 기능 칩으로 펼침.
// 정규 순서 = 냉/온/정/얼음 (백엔드 label "냉/온/정/얼음" 순서와 일치). 모든 조합은 정수(pure) 기본 포함.
const WATER_FUNC_CHIPS = {
  PURIFIED: ['pure'],
  COLD: ['cold', 'pure'],
  HOT: ['hot', 'pure'],
  COLD_HOT: ['cold', 'hot', 'pure'],
  COLD_ICE: ['cold', 'pure', 'ice'],
  COLD_HOT_ICE: ['cold', 'hot', 'pure', 'ice'],
};
const WATER_FUNC_META = {
  cold: { label: '냉수', cls: 'is-cold' },
  hot: { label: '온수', cls: 'is-hot' },
  pure: { label: '정수', cls: 'is-pure' },
  ice: { label: '얼음', cls: 'is-ice' },
};
function waterFuncBadgesHtml(wf) {
  const keys = WATER_FUNC_CHIPS[wf && wf.code];
  if (!keys || !keys.length) return '';
  const chips = keys
    .map((k) => `<span class="w-func-badge ${WATER_FUNC_META[k].cls}">${WATER_FUNC_META[k].label}</span>`)
    .join('');
  return `<div class="w-func-badges">${chips}</div>`;
}

// ── 카드 메타 배지 (표 ○ 세트 중 특가/프로모션/슬림/타사보상) ──
// BEST·정수기능은 별도(코너 배지). 값 존재 시에만 노출. 라벨은 고정 enum 라벨(이스케이프 불요).
function metaBadgesHtml(p) {
  let h = '';
  if (p.special) h += '<span class="wpg-badge wpg-badge-special">특가</span>';
  if (p.promoType) h += `<span class="wpg-badge wpg-badge-promo">${p.promoType.label || '프로모션'}</span>`;
  if (p.slimType) h += '<span class="wpg-badge wpg-badge-slim">초슬림</span>';
  if (p.tradeIn) h += '<span class="wpg-badge wpg-badge-trade">타사보상</span>';
  return h ? `<div class="wpg-meta-badges">${h}</div>` : '';
}

// ── 제품 색상 칩 ──
// 백엔드 colors = 색상명 문자열 배열(hex 없음) → 프론트 매핑으로 동그라미.
// 키 = 실측 색상명(products/*.js): 화이트/그레이/블랙/베이지/실버 + 쿠쿠 아이스 시리즈.
// 매핑 없는 색은 회색 폴백(#ccc) + title 툴팁으로 색상명 노출.
const WATER_COLOR_HEX = {
  화이트: '#ffffff',
  그레이: '#b4b4ba',
  블랙: '#2c2c30',
  베이지: '#e7dcc6',
  실버: '#c9cdd0',
  '아이스 화이트': '#eef3f7',
  '아이스 핑크': '#f4cfdb',
  '아이스 블루': '#cee2ef',
  '아이스 그레이': '#d3d9dd',
  // 보너스(향후 등장 가능성 대비)
  골드: '#e8c97a',
  로즈골드: '#e6c3b3',
  핑크: '#f5b8cb',
  블루: '#7fb0e0',
  네이비: '#33415c',
  민트: '#bfe6d8',
  그린: '#86c293',
};
function waterColorChipsHtml(colors) {
  if (!Array.isArray(colors)) return '';
  const real = colors.filter((c) => c && c !== '기본'); // placeholder('기본') 제외
  if (!real.length) return '';
  const dots = real
    .map((c) => {
      const hex = WATER_COLOR_HEX[c] || '#cccccc';
      return `<span class="wpg-color-chip" style="background:${hex}" title="${c}"></span>`;
    })
    .join('');
  return `<div class="wpg-colors">${dots}</div>`;
}

// ════════════════════════════════════════════════════
// 헬퍼 함수
// ════════════════════════════════════════════════════
function getMinPrice(pricing) {
  if (!pricing || typeof pricing !== 'object') return null; // ★getBestPriceInfo 가드 미러 — null/비객체는 결측(null). Object.values 전 차단.
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

// 표시용 최저가 옵션의 {monthly, promo, cardPrice} 반환.
// ★최저가 후보에 제휴카드 포함: 옵션별 실지불가 eff = (cardPrice>0 ? cardPrice : monthly) 가 최소인 옵션 선택.
//   → 카드 할인가가 최저-월렌탈료가 아닌 다른 약정 티어에 있어도 대표가로 노출됨(목록/BEST 공용).
//   카드 0/미입력 안전: 어드민 toNum('')=0 이라 저장상 0=미입력 → cardPrice>0 만 카드 적용(0은 미적용).
function getBestPriceInfo(pricing) {
  if (!pricing || typeof pricing !== 'object') return null; // ★null/비객체 방어 (로드/렌더/모달 일괄 안전화)
  let best = null;
  let bestEff = Infinity;
  Object.values(pricing).forEach((cycles) => {
    Object.values(cycles).forEach((types) => {
      Object.values(types).forEach((d) => {
        if (!(d.monthly > 0)) return;
        const card = d.cardPrice || 0;
        const eff = card > 0 ? card : d.monthly; // 카드 있으면 실지불가, 없으면 월렌탈료
        if (eff < bestEff) {
          bestEff = eff;
          best = { monthly: d.monthly, promo: d.promo || 0, cardPrice: card };
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
// 다이얼로그 찜 핸들(fav-button.js). 조합이 바뀔 때마다 refresh() 로 상태를 다시 맞춘다.
// ※ favorites 는 이것과 무관한 '다이얼로그 선택값 기억용' 로컬 객체다(서버 저장 아님).
let dialogFav = null;

// ════════════════════════════════════════════════════
// 브랜드 전환
// ════════════════════════════════════════════════════
async function switchBrand(brand) {
  currentBrand = brand;

  // URL에 brand 반영 (탭 전환·카드 진입·복원 모든 경로 공통). 이미 ?brand=… 면 중복 push 방지.
  if (location.search !== `?brand=${brand}`) {
    history.pushState({ brand }, '', `water.html?brand=${brand}`);
  }

  document
    .querySelectorAll('.brand-tab')
    .forEach((t) => t.classList.toggle('active', t.dataset.brand === brand));

  // 상단 브랜드 헤더(로고+이름) 갱신 — 탭 클릭 경로엔 이게 빠져 이전 브랜드에 멈췄음.
  // selectBrand(water-board.js 41–43행)와 동일 패턴 미러. BRAND_INFO는 같은 페이지 전역.
  const info = typeof BRAND_INFO !== 'undefined' ? BRAND_INFO[brand] : null;
  if (info) {
    const pvb = document.getElementById('productViewBrand');
    if (pvb)
      pvb.innerHTML =
        (info.logo
          ? `<img src="${escapeAttr(info.logo)}" alt="${escapeAttr(info.name)}" style="height:24px;object-fit:contain;">`
          : '') +
        `<span class="product-view-brand-name">${escapeHtml(info.name)}</span>`;
  }

  clearFilterInputs(); // 브랜드 바뀌면 필터 입력만 초기화 (renderBrand는 아래서 — 중복 호출 방지)
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
      .map((p, idx) => {
        const info = getBestPriceInfo(p.pricing);
        const monthly = info ? info.monthly : 0;
        const promo = info ? info.promo : 0;
        const cardPrice = info ? info.cardPrice : 0;
        const hasPromo = promo > 0;
        const hasCard = cardPrice > 0;
        const strike = hasPromo || hasCard; // 더 싼 줄이 있으면 렌탈 취소선
        const rank = String(idx + 1).padStart(2, '0');

        const rentalHtml = monthly
          ? `<div class="wbest-price-line">
               <span class="wbest-price-label">렌탈</span>
               <span class="wbest-price-val ${strike ? 'is-strike' : ''}">월 ${monthly.toLocaleString()}원~</span>
             </div>`
          : `<div class="wbest-price-line">
               <span class="wbest-price-label">렌탈</span>
               <span class="wbest-price-val">가격 문의</span>
             </div>`;
        const promoHtml = hasPromo
          ? `<div class="wbest-price-line">
               <span class="wbest-price-label">프로모션</span>
               <span class="wbest-price-val is-accent">월 ${promo.toLocaleString()}원 ~</span>
             </div>`
          : '';
        const cardHtml = hasCard
          ? `<div class="wbest-price-line">
               <span class="wbest-price-label">제휴카드</span>
               <span class="wbest-price-val is-accent">월 ${cardPrice.toLocaleString()}원 ~</span>
             </div>`
          : '';

        return `
    <div class="water-card is-best ${idx === 0 ? 'is-rank1' : ''}" onclick="location.href='water-detail.html?id=${p.id}&brand=${brand}'">
      <button class="water-card-heart ${favorites[p.id] ? 'active' : ''}" onclick="quickFav(event,'${p.id}','${brand}')">♥</button>
      <div class="wbest-rank">BEST<br><b>${rank}</b></div>
      <div class="water-card-img">
        ${waterFuncBadgesHtml(p.waterFunction)}
        ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<span>${data.emoji}</span>`}
      </div>
      <div class="wbest-name">${p.name}</div>
      ${hasPromo ? '<div class="wbest-promo-tag">[프로모션 진행중]</div>' : ''}
      <div class="wbest-prices">
        ${rentalHtml}
        ${promoHtml}
        ${cardHtml}
      </div>
      ${p.desc ? `<div class="wbest-tip"><div class="wbest-tip-head">다픽 팁</div><div class="wbest-tip-body">${p.desc}</div></div>` : ''}
    </div>`;
      })
      .join('');
  }

  // ── 브랜드 배너 (현재 브랜드에 맞게) ──
  renderBrandBanner(brand);

  // ── 전체 상품 — 아정당식 카드 그리드 ──
  if (listTitleEl) listTitleEl.textContent = `${data.name} 전체 상품`;

  // 카드 렌더는 renderProductCard로 추출 (통합 필터와 공유). 브랜드별 화면은 brand/emoji 주입해 동일 결과.
  listGridEl.innerHTML = data.products
    .map((p) => renderProductCard({ ...p, brand, emoji: data.emoji }))
    .join('');
}

// ── 카드 렌더 (renderBrand .map에서 추출 — 결과 동일). p에 brand/emoji 주입 필수.
//    브랜드별: {...p, brand, emoji: data.emoji} / 평면 풀: getAllProductsFlat가 이미 주입.
function renderProductCard(p) {
  const brand = p.brand;
  const emoji = p.emoji || '';
  const info = getBestPriceInfo(p.pricing);
  const hasPrice = !!info;
  const monthly = hasPrice ? info.monthly : 0;
  const cardPrice = hasPrice ? info.cardPrice : 0;
  const mainPrice = cardPrice > 0 ? cardPrice : monthly; // 제휴카드 있으면 그게 메인
  const showOrig = cardPrice > 0 && monthly > 0; // 제휴카드 메인일 때만 렌탈 취소선

  const priceHtml = mainPrice
    ? `
    ${showOrig ? `<span class="wpg-orig">월 ${monthly.toLocaleString()}원</span>` : ''}
    <div class="wpg-price-line">
      ${cardPrice > 0 ? '<span class="wpg-tag">제휴카드</span>' : ''}
      <span class="wpg-price">월 ${mainPrice.toLocaleString()}원~</span>
    </div>`
    : `<div class="wpg-price-line"><span class="wpg-price wpg-ask">가격 문의</span></div>`;

  return `
    <div class="water-prod-card" onclick="location.href='water-detail.html?id=${p.id}&brand=${brand}'">
      <div class="wpg-img">
        ${p.best ? '<span class="wpg-badge-best">인기</span>' : ''}
        ${p.new ? '<span class="wpg-badge-new">NEW</span>' : ''}
        ${waterFuncBadgesHtml(p.waterFunction)}
        ${p.image ? `<img src="${p.image}" alt="${p.name}">` : `<span class="wpg-emoji">${emoji}</span>`}
      </div>
      <div class="wpg-body">
        <div class="wpg-name">${p.name}</div>
        ${p.modelName ? `<div class="wpg-model">${p.modelName}</div>` : ''}
        ${metaBadgesHtml(p)}
        ${waterColorChipsHtml(p.colors)}
        ${ratingHtml(p.averageRating, p.reviewCount)}
        ${priceHtml}
      </div>
    </div>`;
}

// ── 전 브랜드 평면 풀 — 각 상품에 brand/emoji 주입 (통합 필터/카드 렌더가 소비) ──
function getAllProductsFlat() {
  return Object.entries(WATER_PRODUCTS).flatMap(([brand, g]) =>
    g.products.map((p) => ({ ...p, brand, emoji: g.emoji })),
  );
}

// ── 필터 결과 그리드 렌더 (평면 풀 상품은 brand/emoji 주입돼 있어 renderProductCard 그대로) ──
function renderFilteredGrid(products) {
  const listGridEl = document.getElementById('listGrid');
  if (!listGridEl) return;
  if (!products.length) {
    listGridEl.innerHTML = '<div class="wpg-empty">조건에 맞는 상품이 없습니다.</div>';
    return;
  }
  listGridEl.innerHTML = products.map((p) => renderProductCard(p)).join('');
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

  // 빈 브랜드로 전환해도 제목이 이전 브랜드에 멈추지 않게 갱신
  // (renderBrand는 251행에서 갱신하지만 여기로 early-return 시 스킵됨)
  const listTitleEl = document.getElementById('listTitle');
  if (listTitleEl) listTitleEl.textContent = `${name} 전체 상품`;

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
  // 이전 상품의 핸들이 남아 있으면 아래 calcPrice() 가 엉뚱한 조합을 물어본다.
  dialogFav = null;
  const prev = favorites[p.id] || {};
  dialogColor = prev.color || p.colors[0];

  const _tag = document.getElementById('wDTag');
  if (_tag) _tag.style.display = 'none';
  document.getElementById('wDName').textContent = p.name;
  const _m = document.getElementById('wDModel');
  if (_m) _m.textContent = p.modelName || p.model_name || '';
  console.log('[모델명 디버그]', {
    modelName: p.modelName,
    model_name: p.model_name,
    wDModelEl: !!_m,
    keys: Object.keys(p),
  });

  const contractKeys = Object.keys(p.pricing);
  const defaultContract =
    prev.contract || contractKeys[contractKeys.length - 1];
  const cBox = document.getElementById('wDContractBox');
  document.getElementById('wDContract').value = defaultContract;
  cBox.innerHTML = contractKeys
    .map(
      (key) =>
        `<button type="button" class="wd-box ${key === defaultContract ? 'active' : ''}" data-key="${key}">${CONTRACT_LABELS[key] || key}</button>`,
    )
    .join('');
  cBox.querySelectorAll('.wd-box').forEach((btn) => {
    btn.onclick = () => {
      cBox.querySelectorAll('.wd-box').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('wDContract').value = btn.dataset.key;
      updateCycleOptions(p, null);
      updateTypeOptions(p, null);
      calcPrice();
    };
  });

  updateCycleOptions(p, prev.cycle);
  updateTypeOptions(p, prev.type);
  renderColorChips(p);

  calcPrice();
  mountDialogFav(p.id); // 옵션이 다 정해진 뒤에 붙여야 첫 조회가 맞는 조합으로 나간다
  document.getElementById('wDialogOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

// 관리주기 라벨: '셀프형'(저장키)은 화면에 '자가관리'로 표시, 숫자형은 "방문관리" 붙임(중복 방지)
function cycleLabel(c) {
  if (!c) return '';
  if (c.includes('셀프') || c === '셀프형') return '자가관리';
  return c.includes('개월') ? `${c} 방문관리` : c;
}

// 관리주기 키를 자가관리/방문관리로 분류 ('개월' 포함=방문, 아니면 자가)
function isVisitCycle(c) {
  return typeof c === 'string' && c.includes('개월');
}
function groupCycles(cycleKeys) {
  return {
    self: cycleKeys.filter((c) => !isVisitCycle(c)), // 자가관리 (셀프형 등)
    visit: cycleKeys.filter((c) => isVisitCycle(c)), // 방문관리 (N개월)
  };
}

function updateCycleOptions(p, prevCycle) {
  const contract = document.getElementById('wDContract').value;
  const cycleKeys = Object.keys(p.pricing[contract] || {});
  const groups = groupCycles(cycleKeys);

  const modes = [];
  if (groups.self.length) modes.push({ key: 'self', label: '자가관리' });
  if (groups.visit.length) modes.push({ key: 'visit', label: '방문관리' });

  let mode = modes[0] ? modes[0].key : 'visit';
  if (prevCycle) mode = isVisitCycle(prevCycle) ? 'visit' : 'self';
  if (!modes.some((m) => m.key === mode)) mode = modes[0] ? modes[0].key : 'visit';
  document.getElementById('wDCareMode').value = mode;

  const toggleEl = document.getElementById('wDCareToggle');
  if (modes.length > 1) {
    toggleEl.style.display = '';
    toggleEl.innerHTML = modes
      .map(
        (m) =>
          `<button type="button" class="wd-care-btn ${m.key === mode ? 'active' : ''}" data-mode="${m.key}">${m.label}</button>`,
      )
      .join('');
    toggleEl.querySelectorAll('.wd-care-btn').forEach((btn) => {
      btn.onclick = () => {
        document.getElementById('wDCareMode').value = btn.dataset.mode;
        renderModalCycleBoxes(groups[btn.dataset.mode], null);
        toggleEl
          .querySelectorAll('.wd-care-btn')
          .forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
  } else {
    toggleEl.style.display = 'none';
    toggleEl.innerHTML = '';
  }

  renderModalCycleBoxes(groups[mode] || [], prevCycle);

  function renderModalCycleBoxes(keys, prefer) {
    const box = document.getElementById('wDCycleBox');
    const def = prefer && keys.includes(prefer) ? prefer : keys[0];
    document.getElementById('wDCycle').value = def || '';
    box.innerHTML = keys
      .map(
        (c) =>
          `<button type="button" class="wd-box ${c === def ? 'active' : ''}" data-key="${c}">${cycleLabel(c)}</button>`,
      )
      .join('');
    box.querySelectorAll('.wd-box').forEach((btn) => {
      btn.onclick = () => {
        box.querySelectorAll('.wd-box').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('wDCycle').value = btn.dataset.key;
        updateTypeOptions(p, null);
        calcPrice();
      };
    });
    updateTypeOptions(p, null);
    calcPrice();
  }
}

function updateTypeOptions(p, prevType) {
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const types = Object.keys((p.pricing[contract] || {})[cycle] || {});
  const box = document.getElementById('wDTypeBox');
  const def = prevType || types[0];
  document.getElementById('wDType').value = def;
  box.innerHTML = types
    .map(
      (t) =>
        `<button type="button" class="wd-box ${t === def ? 'active' : ''}" data-key="${t}">${t}</button>`,
    )
    .join('');
  box.querySelectorAll('.wd-box').forEach((btn) => {
    btn.onclick = () => {
      box.querySelectorAll('.wd-box').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('wDType').value = btn.dataset.key;
      calcPrice();
    };
  });
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
  // 색상도 조합의 일부다 — 색을 바꾸면 다른 찜이므로 상태를 다시 물어본다.
  if (dialogFav) dialogFav.refresh();
}

// ── 다이얼로그 찜(조합 모드) ──────────────────────────
// 같은 상품이라도 약정/관리주기/타사보상/색상이 다르면 다른 찜이다.
// 키는 서버가 options 로 만든다(fav-button.js 주석 참고).
function dialogFavState() {
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = dialogProd
    ? dialogProd.pricing[contract]?.[cycle]?.[type] || {}
    : {};
  const cardPrice = d.cardPrice || 0;
  const monthly = d.monthly || 0;
  const options = {};
  if (contract) options.contract = contract;
  if (cycle) options.cycle = cycle;
  if (type) options.type = type;
  if (dialogColor) options.color = dialogColor;
  const label = [
    dialogProd ? dialogProd.name : '',
    CONTRACT_LABELS[contract] || contract,
    cycleLabel(cycle),
    type,
    dialogColor,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    options: options,
    label: label,
    // 화면에 크게 찍힌 값과 같은 걸 저장한다(제휴카드가 있으면 그게 메인).
    monthlyFee: cardPrice > 0 ? cardPrice : monthly,
  };
}

function mountDialogFav(productId) {
  const mount = document.getElementById('wDFav');
  if (!mount || typeof window.dpFavInit !== 'function') return;
  dialogFav = dpFavInit(mount, productId, { state: dialogFavState });
}

function calcPrice() {
  if (!dialogProd) return;
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = dialogProd.pricing[contract]?.[cycle]?.[type];
  if (!d) return;

  const contractLabel = CONTRACT_LABELS[contract] || contract;

  const monthly = d.monthly || 0;
  const cardPrice = d.cardPrice || 0;
  const mainPrice = cardPrice > 0 ? cardPrice : monthly;
  const showOrig = cardPrice > 0 && monthly > 0;

  document.getElementById('wDPrice').innerHTML = mainPrice
    ? `${mainPrice.toLocaleString()}<span>원/월</span>`
    : `<span style="font-size:15px;color:var(--text-muted);">상담 시 안내</span>`;
  const lbl = document.getElementById('wDPriceLabel');
  if (lbl) lbl.textContent = cardPrice > 0 ? '제휴카드 월요금' : '월 렌탈료';
  const origEl = document.getElementById('wDRentalOrig');
  if (origEl)
    origEl.innerHTML = showOrig
      ? `<span class="wd-rental-orig">월 ${monthly.toLocaleString()}원</span>`
      : '';

  const supportHtml = d.maxSupport
    ? `<span style="color:var(--purple);font-weight:700;">₩ ${d.maxSupport.toLocaleString()}</span>`
    : `<span style="color:var(--text-muted);font-size:12px;">상담 시 안내</span>`;

  document.getElementById('wDSpecs').innerHTML = `
    <div class="w-spec-item"><div class="w-spec-label">가입 조건</div><div class="w-spec-val">${type}</div></div>
    <div class="w-spec-item"><div class="w-spec-label">결제 안내</div><div class="w-spec-val" style="font-size:12px;">렌탈 약정 기준</div></div>
    <div class="w-spec-item w-spec-support"><div class="w-spec-label">최대 지원금</div><div class="w-spec-val w-spec-val-big">${supportHtml}</div></div>`;

  document.getElementById('wDDesc').textContent = dialogProd.desc;

  // 조합이 바뀌었으니 찜 상태를 다시 맞춘다(같은 조합이면 요청을 안 보낸다).
  if (dialogFav) dialogFav.refresh();
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
// (제거) toggleFavInDialog — 다이얼로그 하트가 찜 버튼으로 바뀌면서 호출부가 없어졌다.
//        로컬 favorites 는 '다이얼로그 선택값 기억' 용도로만 남는다.

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
  window.open('https://pf.kakao.com/_exaRjX/chat', '_blank');
}


// ════════════════════════════════════════════════════
// 사이드바 통합 필터 엔진 (#waterFilter 전 섹션) — 전 브랜드 평면풀 대상
// 축간 AND, 축내 다중 OR. getAllProductsFlat/renderFilteredGrid(층1) 재사용.
// ════════════════════════════════════════════════════
function collectFilters() {
  const c = {}; // { brand:[], waterFunction:[], householdSize:[], purposeTags:[], installType:[], filterType:[], extractType:[], pipeMaterial:[], priceRange:[], modelName:'', name:'' }
  document
    .querySelectorAll('#waterFilter input[type="checkbox"][data-filter]:checked')
    .forEach((el) => {
      const f = el.dataset.filter;
      const v = el.dataset.value;
      (c[f] = c[f] || []).push(v);
    });
  document
    .querySelectorAll('#waterFilter input[type="text"][data-filter]')
    .forEach((el) => {
      if (el.value.trim()) c[el.dataset.filter] = el.value.trim();
    });
  return c;
}

function applyFilters() {
  const c = collectFilters();
  if (Object.keys(c).length === 0) {
    renderBrand(currentBrand); // 아무 조건 없으면 현재 브랜드 화면 (listTitle도 원복)
    return;
  }

  let list = getAllProductsFlat(); // 전 브랜드 평면풀 (층1)
  // 축간 AND, 축내 OR
  if (c.brand) list = list.filter((p) => c.brand.includes(p.brand));
  if (c.waterFunction)
    list = list.filter((p) => p.waterFunction && c.waterFunction.includes(p.waterFunction.code));
  if (c.householdSize)
    list = list.filter((p) => p.householdSize && c.householdSize.includes(p.householdSize.code));
  if (c.purposeTags)
    list = list.filter(
      (p) => Array.isArray(p.purposeTags) && c.purposeTags.some((v) => p.purposeTags.includes(v)),
    );
  if (c.installType)
    list = list.filter((p) => p.installType && c.installType.includes(p.installType.code));
  if (c.filterType)
    list = list.filter((p) => p.filterType && c.filterType.includes(p.filterType.code));
  if (c.extractType)
    list = list.filter((p) => p.extractType && c.extractType.includes(p.extractType.code));
  if (c.pipeMaterial)
    list = list.filter((p) => p.pipeMaterial && c.pipeMaterial.includes(p.pipeMaterial.code));
  if (c.priceRange)
    list = list.filter((p) => p.priceBucket && c.priceRange.includes(p.priceBucket));
  // 살균방식(sanitizing) — code 배열로 정규화. 선택값 중 하나라도 포함(OR).
  if (c.sanitizing)
    list = list.filter(
      (p) => Array.isArray(p.sanitizing) && c.sanitizing.some((v) => p.sanitizing.includes(v)),
    );
  // 타사보상 — 단일 축. 체크 시 tradeIn=true 상품만.
  if (c.tradeIn) list = list.filter((p) => p.tradeIn === true);
  if (c.modelName) list = list.filter((p) => (p.modelName || '').includes(c.modelName));
  if (c.name) list = list.filter((p) => (p.name || '').includes(c.name));

  renderFilteredGrid(list); // 층1
  updateListTitle(`검색 결과 (${list.length})`);
}

function updateListTitle(text) {
  const t = document.getElementById('listTitle');
  if (t) t.textContent = text;
}

// 사이드바 입력 바인딩 + 초기화 버튼 (DOMContentLoaded에서 1회)
function initWaterFilter() {
  const panel = document.getElementById('waterFilter');
  if (!panel) return;
  panel.querySelectorAll('input[data-filter]').forEach((el) => {
    const evt = el.type === 'text' ? 'input' : 'change';
    el.addEventListener(evt, applyFilters);
  });
  const reset = document.getElementById('wfReset');
  if (reset) reset.addEventListener('click', resetFilters);
}

// 초기화 버튼: 입력 비우고 브랜드 화면 복귀
function resetFilters() {
  clearFilterInputs();
  renderBrand(currentBrand);
}

// 입력만 비움 (renderBrand 호출 X — switchBrand가 이미 renderBrand 부르므로 무한루프 방지)
function clearFilterInputs() {
  const panel = document.getElementById('waterFilter');
  if (!panel) return;
  panel
    .querySelectorAll('input[type="checkbox"][data-filter]')
    .forEach((el) => (el.checked = false));
  panel
    .querySelectorAll('input[type="text"][data-filter]')
    .forEach((el) => (el.value = ''));
}

// ════════════════════════════════════════════════════
// 초기 실행
// ════════════════════════════════════════════════════
loadWaterProducts().catch(() => {});

document.addEventListener('DOMContentLoaded', () => {
  initWaterFilter(); // 사이드바 필터 입력 바인딩 + 초기화 버튼
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

// ════════════════════════════════════════════════════
// 모바일 필터 드로어 토글 (조각2-B)
// 정수기 전용 id(#wfToggleBtn/#waterFilter/#wfOverlay/#wfCloseBtn) → 렌탈 무영향.
// CSS(조각2-A)가 .is-open으로 슬라이드/오버레이 처리. JS는 클래스 토글만.
// ════════════════════════════════════════════════════
(function () {
  const btn = document.getElementById('wfToggleBtn');
  const panel = document.getElementById('waterFilter');
  const overlay = document.getElementById('wfOverlay');
  const closeBtn = document.getElementById('wfCloseBtn');
  if (!btn || !panel || !overlay) return;

  function openDrawer() {
    panel.classList.add('is-open');
    overlay.classList.add('is-open');
    btn.classList.add('is-hidden'); // 좌측 손잡이 숨김(드로어와 겹침 방지)
    btn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden'; // 배경 스크롤 잠금
  }
  function closeDrawer() {
    panel.classList.remove('is-open');
    overlay.classList.remove('is-open');
    btn.classList.remove('is-hidden'); // 손잡이 복원
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = ''; // ★스크롤 복원 (안 하면 닫은 뒤 페이지 스크롤 막힘)
  }

  btn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer); // 바깥 어둠 클릭 → 닫기
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer); // ✕ → 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) closeDrawer();
  });
  // 리사이즈로 데스크탑(>1024) 되면 열림/스크롤잠금 잔존 방지 (드로어 CSS 경계와 일치)
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && panel.classList.contains('is-open')) {
      closeDrawer();
    }
  });
})();
