// ════════════════════════════════════════════════════
// water-detail.js — 정수기 상세 페이지
// ────────────────────────────────────────────────────
// ?id={상품UUID} 로 진입 → /api/water-products/{id} 조회
// 우 패널에서 약정·관리주기·타사보상·색상 선택 → 가격 갱신
// "신청하기" → 기존 다이얼로그(water.js openDialog)에 선택값 전달
// 5/28: 하단 상세에 detailImages(쿠팡식 세로 나열) + 펼쳐보기 토글
//   ※ water.js 가 먼저 로드되어 있어야 함
//     (CONTRACT_LABELS / BRAND_META / openDialog / openKakaoConsult 재사용)
// ════════════════════════════════════════════════════

let WD_PRODUCT = null; // 조회된 상품 (water.js groupByBrand 형태로 정규화)
let WD_BRAND_KEY = null;
let WD_COLOR = '';
let WD_FAV = null; // 우 패널 찜 핸들(조합 모드) — 조합이 바뀌면 refresh()
let WD_CMP = null; // 비교함 핸들 — 찜과 같은 '조합' 단위라 같이 refresh 한다
const WD_BACK_BRAND =
  new URLSearchParams(location.search).get('brand') || ''; // 뒤로가기용 브랜드

// ── 찜 목록에서 돌아왔을 때 그 조합 그대로 열기 ─────────
// ★ 키 이름은 wdFavState().options 가 내보내는 이름과 반드시 같아야 한다.
//   (contract / cycle / type / color) 한쪽만 바꾸면 조용히 다른 조합이 뜬다.
// 한 번만 쓰고 renderDetail() 끝에서 비운다 — 안 그러면 사용자가 약정을
// 바꿔도 주기가 계속 이 값으로 되돌아간다.
let WD_WANT = (function () {
  const q = new URLSearchParams(location.search);
  const o = {};
  ['contract', 'cycle', 'type', 'color'].forEach((k) => {
    const v = q.get(k);
    if (v) o[k] = v;
  });
  return o;
})();

// 원하는 값이 실제 선택지에 있을 때만 채택. 없으면 기존 기본값 그대로.
function wdPick(keys, want, fallback) {
  return want && Array.isArray(keys) && keys.indexOf(want) >= 0 ? want : fallback;
}

document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    showStatus('상품 정보가 없습니다.');
    return;
  }
  loadDetail(id);

  // 후기 모듈 초기화 (id = 상품 UUID = WD_PRODUCT.id). 신규 API 호출은 reviews.js 내부.
  if (typeof initReviews === 'function') initReviews(id);
  // 상세/제품사양/리뷰 탭 전환 (data-tab ↔ 패널 id 맵 기반 범용 토글, N탭 대응)
  initDetailTabs();
  // 스펙 상세 뷰 뒤로/앞으로 대응 (1회 등록)
  window.addEventListener('popstate', onSpecPopState);

  // 로그인 후 복귀 시 신청 모달 이어서
  if (
    typeof DapickApplication !== 'undefined' &&
    DapickApplication.resumeIfPending
  ) {
    DapickApplication.resumeIfPending();
  }
});

// 탭 전환 — 패널은 미리 렌더, 보이기/숨기기만. data-tab 값 → 패널 element id 맵.
const DETAIL_PANELS = {
  detail: 'wdDetailBody',
  spec: 'wdSpecBody',
  review: 'reviewSection',
};
function setActiveDetailTab(key) {
  const tabbar = document.querySelector('.wd-detail-tabbar');
  if (!tabbar) return;
  tabbar
    .querySelectorAll('.wd-tab')
    .forEach((t) => t.classList.toggle('active', t.getAttribute('data-tab') === key));
  Object.keys(DETAIL_PANELS).forEach((k) => {
    const el = document.getElementById(DETAIL_PANELS[k]);
    if (el) el.style.display = k === key ? '' : 'none';
  });
}
function initDetailTabs() {
  const tabbar = document.querySelector('.wd-detail-tabbar');
  if (!tabbar) return;
  tabbar.addEventListener('click', (e) => {
    const tab = e.target.closest('.wd-tab');
    if (!tab) return;
    const key = tab.getAttribute('data-tab');
    setActiveDetailTab(key);
    // R1-5: 제품사양 외 탭으로 전환 시 view=spec 상태면 URL 정리 + 패널을 요약으로 리셋
    if (key !== 'spec' && hasSpecView()) {
      const url = new URL(location.href);
      url.searchParams.delete('view');
      history.replaceState({}, '', url);
      renderSpecBody();
    }
  });
}

// ── 스펙 상세 뷰 URL 라우팅 (history API) ──
function hasSpecView() {
  return new URLSearchParams(location.search).get('view') === 'spec';
}
// "스펙 전체보기" — pushState(&view=spec) 후 상세 뷰 진입
function openSpecDetail() {
  const url = new URL(location.href);
  url.searchParams.set('view', 'spec');
  history.pushState({ view: 'spec' }, '', url);
  enterSpecView();
}
// 초기 로드: view=spec URL(새로고침·공유 링크) → 요약 베이스 엔트리 확보 후 스펙 탭+상세 뷰 직진입
function initSpecRouting() {
  if (!hasSpecView()) return;
  const summaryUrl = new URL(location.href);
  summaryUrl.searchParams.delete('view');
  history.replaceState({}, '', summaryUrl); // 요약 엔트리 (← 요약으로 back 가능하게)
  setActiveDetailTab('spec');
  openSpecDetail(); // pushState(view=spec) + enterSpecView (전면 스펙 페이지)
}
// 뒤로/앞으로: view 파라미터 유무로 상세/요약 분기
function onSpecPopState() {
  if (!WD_PRODUCT) return; // 로드 전 방어
  if (hasSpecView()) {
    enterSpecView();
  } else {
    exitSpecView();
  }
}

// ── 전면 스펙 페이지 (view=spec 시 상세 화면을 통째로 가리고 #wdSpecPage 표시) ──
// 숨김 대상 = #wdRoot 최상위 블록(래퍼 단위): 뒤로가기 버튼 / 상단 옵션영역 / 탭+상세 섹션.
const SPEC_HIDDEN_BLOCKS = ['.wd-back', '.wd-top', '.wd-detail-section'];

function setSpecBaseVisible(show) {
  const root = document.getElementById('wdRoot');
  if (!root) return;
  SPEC_HIDDEN_BLOCKS.forEach((sel) => {
    const el = root.querySelector(sel);
    if (el) el.style.display = show ? '' : 'none';
  });
}

// #wdSpecPage 1회 생성 (HTML 수정 최소화 — JS로 .wd-wrap 안에 주입).
function ensureSpecPage() {
  if (document.getElementById('wdSpecPage')) return;
  const root = document.getElementById('wdRoot');
  if (!root) return;
  const page = document.createElement('div');
  page.id = 'wdSpecPage';
  page.className = 'wd-specpage';
  page.style.display = 'none';
  root.appendChild(page);
}

function enterSpecView() {
  if (!WD_PRODUCT) return;
  ensureSpecPage();
  setSpecBaseVisible(false); // 기존 상세 블록 숨김
  const page = document.getElementById('wdSpecPage');
  if (page) page.style.display = '';
  renderSpecPage();
  window.scrollTo(0, 0);
}

function exitSpecView() {
  const page = document.getElementById('wdSpecPage');
  if (page) page.style.display = 'none';
  setSpecBaseVisible(true); // 상세 블록 복원 (가격바·탭 정상)
  setActiveDetailTab('spec'); // 복귀 시 '제품사양' 탭 활성 유지
  renderSpecBody(); // 요약 패널 원복
}

// 전면 스펙 페이지 렌더 — 세로 단일 컬럼: 돌아가기 / 이미지 / 상품명·모델명 / 스펙 섹션들.
function renderSpecPage() {
  const page = document.getElementById('wdSpecPage');
  if (!page) return;
  const p = WD_PRODUCT;

  let html =
    '<button type="button" class="wd-specpage-back" onclick="backToSpecSummary()">← 상품으로 돌아가기</button>';
  html += '<div class="wd-specpage-inner">';
  if (p.image) {
    html += `<div class="wd-specpage-hero"><img class="wd-specpage-img" src="${p.image}" alt="${escapeHtml(p.name || '')}"></div>`;
  }
  html += `<div class="wd-specpage-name">${escapeHtml(p.name || '')}</div>`;
  if (p.modelName) {
    html += `<div class="wd-specpage-model">${escapeHtml(p.modelName)}</div>`;
  }
  // 기존 섹션 렌더 함수 재사용 (마크업 재발명 금지) — 표는 기존 .wd-spec2-* 그대로.
  html += `<div class="wd-spec2">${specSectionsInnerHtml(p)}</div>`;
  html += '</div>';
  page.innerHTML = html;
}

function showStatus(msg) {
  const el = document.getElementById('wdRoot');
  if (el) el.innerHTML = `<div class="wd-status">${msg}</div>`;
}

async function loadDetail(id) {
  try {
    const url = `${DAPICK_CONFIG.API_BASE_URL}/api/water-products/${id}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const p = json?.data ?? json;
    if (!p || !p.id) throw new Error('빈 응답');
    recordRecentView(p.id);

    WD_BRAND_KEY = p.brand;
    // water.js 의 카드 소비 형태로 정규화 (openDialog 호환)
    WD_PRODUCT = {
      id: p.id,
      name: p.name,
      modelName: p.modelName || p.model_name || '',
      desc: p.description || '',
      image: p.imageUrl || '',
      colors: Array.isArray(p.colors) && p.colors.length ? p.colors : ['기본'],
      pricing: p.pricing || {},
      detailImages: Array.isArray(p.detailImages) ? p.detailImages : [],
      best: !!p.best,
      new: !!p.new,
      // ── 제품사양 탭용 스펙 승계 (표는 값 있는 행만 노출) ──
      // enum 필드는 {code,label} 그대로 / 다중선택은 [{code,label}] 배열 / 나머지는 원시값
      extractType: p.extractType || null,
      waterFunction: p.waterFunction || null,
      installType: p.installType || null,
      filterType: p.filterType || null,
      sanitizing: Array.isArray(p.sanitizing) ? p.sanitizing : [],
      pipeMaterial: p.pipeMaterial || null,
      slimType: p.slimType || null,
      householdSize: p.householdSize || null,
      features: Array.isArray(p.features) ? p.features : [], // O/X 유도용
      width: p.width || '',
      depth: p.depth || '', // 2단계: 제품 크기 W×D×H
      height: p.height || '',
      weight: p.weight || '',
      power: p.power || '',
      energyGrade: p.energyGrade != null ? p.energyGrade : null,
      filterCount: p.filterCount != null ? p.filterCount : null,
      careInterval: p.careInterval || '',
      controlFeatures: p.controlFeatures || '',
      extraFeatures: p.extraFeatures || '',
      specSections: Array.isArray(p.specSections) ? p.specSections : [], // 2단계: 추가 스펙 섹션
    };

    // water.js 전역 WATER_PRODUCTS 에 주입 → openDialog(id, brand) 가 찾을 수 있게
    if (typeof WATER_PRODUCTS !== 'undefined') {
      const meta =
        (typeof BRAND_META !== 'undefined' && BRAND_META[WD_BRAND_KEY]) || {};
      WATER_PRODUCTS[WD_BRAND_KEY] = WATER_PRODUCTS[WD_BRAND_KEY] || {
        name: meta.name || WD_BRAND_KEY,
        emoji: meta.emoji || '💧',
        products: [],
      };
      // 중복 방지 후 추가
      const arr = WATER_PRODUCTS[WD_BRAND_KEY].products;
      if (!arr.find((x) => x.id === WD_PRODUCT.id)) arr.push(WD_PRODUCT);
    }

    WD_COLOR = wdPick(WD_PRODUCT.colors, WD_WANT.color, WD_PRODUCT.colors[0]);
    renderDetail();
    initSpecRouting(); // view=spec 직진입/새로고침 대응 (renderDetail 후 = 패널 렌더 완료 시점)
  } catch (e) {
    console.error('[water-detail] 로드 실패:', e);
    showStatus('상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}

function renderDetail() {
  const p = WD_PRODUCT;
  const meta = (typeof BRAND_META !== 'undefined' &&
    BRAND_META[WD_BRAND_KEY]) || { name: WD_BRAND_KEY, emoji: '💧' };

  // 헤더/이미지/이름/설명
  // (브랜드칩 제거 — 요소를 숨김)
  const _bt = document.getElementById('wdBrandTag');
  if (_bt) _bt.style.display = 'none';
  document.getElementById('wdName').textContent = p.name;
  const _modelEl = document.getElementById('wdModel');
  if (_modelEl) _modelEl.textContent = p.modelName || '';
  document.getElementById('wdDesc').textContent = p.desc || '';
  WD_FAV = null; // 아래 calc() 까지 끝난 뒤에 붙인다(첫 조회가 맞는 조합으로 나가야 한다)
  document.getElementById('wdBackText').textContent =
    `‹ ${meta.name} 상품 목록`;

  const gal = document.getElementById('wdGallery');
  gal.innerHTML = p.image
    ? `<img src="${p.image}" alt="${p.name}">`
    : `<span class="wd-emoji"></span>`;

  // 약정 박스 버튼 (기존 드롭다운 → 박스 4개)
  const contractKeys = Object.keys(p.pricing);
  const boxEl = document.getElementById('wdContractBox');
  // 기본은 예전과 동일(마지막 키). 찜에서 온 조합이 있으면 그쪽을 쓴다.
  const defaultKey = wdPick(
    contractKeys,
    WD_WANT.contract,
    contractKeys[contractKeys.length - 1],
  );
  document.getElementById('wdContract').value = defaultKey;
  boxEl.innerHTML = contractKeys
    .map(
      (k) =>
        `<button type="button" class="wd-box ${k === defaultKey ? 'active' : ''}" data-key="${k}">${(typeof CONTRACT_LABELS !== 'undefined' && CONTRACT_LABELS[k]) || k}</button>`,
    )
    .join('');
  boxEl.querySelectorAll('.wd-box').forEach((btn) => {
    btn.onclick = () => {
      boxEl.querySelectorAll('.wd-box').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('wdContract').value = btn.dataset.key;
      fillCycle();
      fillType();
      calc();
    };
  });

  fillCycle();
  fillType();
  renderColors();
  calc();
  mountFav(p.id);
  mountCompare(p.id);
  wdRegisterPicker();
  renderDetailBody(); // 하단 상세는 한 번만 렌더 (calc 와 분리)
  renderSpecBody(); // 제품사양 탭도 한 번만 렌더
  WD_WANT = {}; // 복원 1회로 끝. 이후 클릭은 사용자 선택이 이긴다.
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

function fillCycle(preferMode) {
  const p = WD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycleKeys = Object.keys(p.pricing[contract] || {});
  const groups = groupCycles(cycleKeys);

  const modes = [];
  if (groups.self.length) modes.push({ key: 'self', label: '자가관리' });
  if (groups.visit.length) modes.push({ key: 'visit', label: '방문관리' });

  // 찜 복원: 원하는 주기가 자가/방문 중 어디에 있는지로 탭을 먼저 정한다.
  if (!preferMode && WD_WANT.cycle && cycleKeys.indexOf(WD_WANT.cycle) >= 0) {
    preferMode = isVisitCycle(WD_WANT.cycle) ? 'visit' : 'self';
  }

  const toggleEl = document.getElementById('wdCareToggle');
  let mode =
    preferMode && modes.some((m) => m.key === preferMode)
      ? preferMode
      : modes[0]
        ? modes[0].key
        : 'visit';
  document.getElementById('wdCareMode').value = mode;

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
        document.getElementById('wdCareMode').value = btn.dataset.mode;
        renderCycleBoxes(groups[btn.dataset.mode]);
        toggleEl
          .querySelectorAll('.wd-care-btn')
          .forEach((b) => b.classList.toggle('active', b === btn));
      };
    });
  } else {
    toggleEl.style.display = 'none';
    toggleEl.innerHTML = '';
  }

  renderCycleBoxes(groups[mode] || []);

  function renderCycleBoxes(keys) {
    const boxEl = document.getElementById('wdCycleBox');
    const defaultKey = wdPick(keys, WD_WANT.cycle, keys[0]);
    document.getElementById('wdCycle').value = defaultKey || '';
    boxEl.innerHTML = keys
      .map(
        (c) =>
          `<button type="button" class="wd-box ${c === defaultKey ? 'active' : ''}" data-key="${c}">${cycleLabel(c)}</button>`,
      )
      .join('');
    boxEl.querySelectorAll('.wd-box').forEach((btn) => {
      btn.onclick = () => {
        boxEl.querySelectorAll('.wd-box').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('wdCycle').value = btn.dataset.key;
        fillType();
        calc();
      };
    });
    fillType();
    calc(); // 모드 전환 시에도 가격 갱신
  }
}

function fillType() {
  const p = WD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const typeKeys = Object.keys(p.pricing[contract]?.[cycle] || {});
  const boxEl = document.getElementById('wdTypeBox');
  const defaultKey = wdPick(typeKeys, WD_WANT.type, typeKeys[0]);
  document.getElementById('wdType').value = defaultKey;
  boxEl.innerHTML = typeKeys
    .map(
      (t) =>
        `<button type="button" class="wd-box ${t === defaultKey ? 'active' : ''}" data-key="${t}">${t}</button>`,
    )
    .join('');
  boxEl.querySelectorAll('.wd-box').forEach((btn) => {
    btn.onclick = () => {
      boxEl.querySelectorAll('.wd-box').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('wdType').value = btn.dataset.key;
      calc();
    };
  });
}

// ── 우 패널 찜(조합 모드) ────────────────────────────
// 다이얼로그(water.js dialogFavState)와 같은 키를 만들어야 한다.
// 키가 어긋나면 '신청하기'를 눌렀을 때 같은 조합인데 찜이 풀린 것처럼 보인다.
function wdFavState() {
  const p = WD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const type = document.getElementById('wdType').value;
  const d = p ? p.pricing[contract]?.[cycle]?.[type] || {} : {};
  const cardPrice = d.cardPrice || 0;
  const monthly = d.monthly || 0;
  const options = {};
  if (contract) options.contract = contract;
  if (cycle) options.cycle = cycle;
  if (type) options.type = type;
  if (WD_COLOR) options.color = WD_COLOR;
  const label = [
    p ? p.name : '',
    (typeof CONTRACT_LABELS !== 'undefined' && CONTRACT_LABELS[contract]) ||
      contract,
    cycleLabel(cycle),
    type,
    WD_COLOR,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    options: options,
    label: label,
    monthlyFee: cardPrice > 0 ? cardPrice : monthly,
  };
}

function mountFav(productId) {
  const mount = document.getElementById('wdFav');
  if (!mount || typeof window.dpFavInit !== 'function') return;
  WD_FAV = dpFavInit(mount, productId, { state: wdFavState });
}

// ── 이미지 아래 비교하기 ──────────────────────────────
// ★ 비교함도 '조합' 단위다. 같은 정수기라도 3년/6년은 다른 항목으로 담긴다.
//   options 를 안 실으면 비교표에 약정·주기 행이 통째로 비고, 담기 키도
//   겹쳐서 3년을 담은 뒤 6년을 담으면 '이미 담김'으로 보인다.
function wdCompareSnapshot() {
  const p = WD_PRODUCT;
  const st = wdFavState();
  return {
    category: 'WATER',
    name: p ? p.name : '',
    model: p ? p.modelName || '' : '',
    image: p ? p.image || '' : '',
    label: st.label,
    monthlyFee: st.monthlyFee,
    options: st.options,
  };
}

function mountCompare(productId) {
  const mount = document.getElementById('wdCompare');
  if (!mount || typeof window.dpCompareInit !== 'function') return;
  WD_CMP = dpCompareInit(mount, productId, { snapshot: wdCompareSnapshot });
}

// ── 하단 트레이 '+' 카드 → 그 자리에서 다른 정수기 고르기 ────────────
// 목록 페이지로 보내면 담아둔 게 있는 채로 화면을 떠나게 된다. 그래서
// 목록을 받아와 시트에 뿌리고, 고른 걸 바로 비교함에 넣는다.
// ★ 가져오는 일은 여기(정수기 페이지)가 한다. compare-view.js 가 하면
//   공용 파일이 카테고리마다 다른 가격 구조를 전부 알아야 한다.
function wdComboFee(d) {
  const card = (d && d.cardPrice) || 0;
  const monthly = (d && d.monthly) || 0;
  return card > 0 ? card : monthly;
}

// ★ 어떤 조합으로 담을 것인가 — 이 기능의 핵심은 '월 요금 비교'다.
//   지금 화면이 3년·자가관리인데 상대를 6년·방문관리로 담으면 숫자가
//   나란히 놓여도 비교가 아니다. 그래서 같은 조합을 먼저 찾고,
//   그 상품에 그 조합이 없을 때만 가장 싼 조합으로 떨어진다.
//   어느 쪽이 됐든 고른 조합을 목록 줄에 그대로 적어 감추지 않는다.
function wdPickCombo(pricing, want) {
  if (!pricing) return null;
  const w = want || {};
  const hit =
    pricing[w.contract] && pricing[w.contract][w.cycle]
      ? pricing[w.contract][w.cycle][w.type]
      : null;
  if (hit) {
    return {
      contract: w.contract,
      cycle: w.cycle,
      type: w.type,
      fee: wdComboFee(hit),
    };
  }
  let best = null;
  Object.keys(pricing).forEach((contract) => {
    const byCycle = pricing[contract] || {};
    Object.keys(byCycle).forEach((cycle) => {
      const byType = byCycle[cycle] || {};
      Object.keys(byType).forEach((type) => {
        const fee = wdComboFee(byType[type]);
        if (fee <= 0) return;
        if (!best || fee < best.fee) best = { contract, cycle, type, fee };
      });
    });
  });
  return best;
}

function wdPickRow(p, want) {
  if (!p || !p.id) return null;
  const combo = wdPickCombo(p.pricing, want);
  if (!combo) return null;
  const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : [];
  const color = colors.indexOf(want.color) >= 0 ? want.color : colors[0] || '';
  const options = {};
  if (combo.contract) options.contract = combo.contract;
  if (combo.cycle) options.cycle = combo.cycle;
  if (combo.type) options.type = combo.type;
  if (color) options.color = color;
  const label = [
    p.name,
    (typeof CONTRACT_LABELS !== 'undefined' && CONTRACT_LABELS[combo.contract]) ||
      combo.contract,
    cycleLabel(combo.cycle),
    combo.type,
    color,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    category: 'WATER',
    id: p.id,
    name: p.name || '',
    model: p.modelName || p.model_name || '',
    image: p.imageUrl || p.image || '',
    label: label,
    monthlyFee: combo.fee,
    options: options,
  };
}

function wdRegisterPicker() {
  if (!window.dpCompareView || typeof window.dpCompareView.registerPicker !== 'function') {
    return;
  }
  window.dpCompareView.registerPicker('WATER', async () => {
    const res = await fetch(`${DAPICK_CONFIG.API_BASE_URL}/api/water-products`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const list = Array.isArray(json) ? json : json?.data || [];
    // 기준 조합은 '지금 화면' 이다 — 사용자가 보고 있는 조건이 비교의 기준선.
    const want = {
      contract: document.getElementById('wdContract')?.value || '',
      cycle: document.getElementById('wdCycle')?.value || '',
      type: document.getElementById('wdType')?.value || '',
      color: WD_COLOR || '',
    };
    return list.map((p) => wdPickRow(p, want)).filter(Boolean);
  });
}

// 조합이 바뀌면 찜·비교 버튼이 같이 따라와야 한다.
// 한쪽만 갱신하면 다른 버튼이 이전 조합 상태로 남는다.
function wdRefreshButtons() {
  if (WD_FAV) WD_FAV.refresh();
  if (WD_CMP) WD_CMP.refresh();
}

function renderColors() {
  const p = WD_PRODUCT;
  document.getElementById('wdColors').innerHTML = p.colors
    .map(
      (c) =>
        `<div class="wd-chip ${WD_COLOR === c ? 'active' : ''}" data-color="${c}">${c}</div>`,
    )
    .join('');
  document.querySelectorAll('#wdColors .wd-chip').forEach((chip) => {
    chip.onclick = () => {
      WD_COLOR = chip.dataset.color;
      document
        .querySelectorAll('#wdColors .wd-chip')
        .forEach((c) =>
          c.classList.toggle('active', c.dataset.color === WD_COLOR),
        );
      // 색상은 가격을 안 바꿔서 calc() 를 안 탄다 → 여기서 직접 갱신.
      wdRefreshButtons();
    };
  });
}

function calc() {
  const p = WD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const type = document.getElementById('wdType').value;
  const d = p.pricing[contract]?.[cycle]?.[type] || {};

  const months =
    parseInt((contract.split('/')[1] || '').replace(/[^0-9]/g, '')) || 60;
  const monthly = d.monthly || 0;
  const cardPrice = d.cardPrice || 0;
  const mainPrice = cardPrice > 0 ? cardPrice : monthly; // 제휴카드 있으면 그게 메인
  const showRental = cardPrice > 0 && monthly > 0; // 둘 다 있을 때만 렌탈 우측 표기

  document.getElementById('wdPrice').innerHTML = mainPrice
    ? `${mainPrice.toLocaleString()}<small>원/월</small>`
    : `<span style="font-size:16px;color:var(--text-muted);">상담 시 안내</span>`;
  // 우측: 제휴카드가 메인일 때만 기존 렌탈가(취소선) 표시. 총요금/개월은 제거.
  document.getElementById('wdTotal').innerHTML = showRental
    ? `<span class="wd-rental-orig">월 ${monthly.toLocaleString()}원</span>`
    : '';

  const lblEl = document.querySelector('.wd-pb-label');
  if (lblEl) lblEl.textContent = cardPrice > 0 ? '제휴카드 월요금' : '월 렌탈료';

  document.getElementById('wdSpecType').textContent = type;
  document.getElementById('wdSpecSupport').innerHTML = d.maxSupport
    ? `<span style="color:var(--purple);">₩ ${d.maxSupport.toLocaleString()}</span>`
    : '<span style="color:#8a8a99;font-size:12px;">상담 시 안내</span>';

  wdRefreshButtons();
}

// ── 제품사양 표 ──────────────────────────────────────────────
// enum {code,label} → label / 다중선택 [{label}] → ' · ' join / 원시값은 그대로.
// get(p)가 '' 반환하면 그 행은 표에서 스킵(값 있는 행만 노출 → 표 길이 자동 가변).
function specEnumLabel(e) {
  return e && e.label ? e.label : '';
}
function specEnumList(arr) {
  return Array.isArray(arr)
    ? arr.map((x) => x && x.label).filter(Boolean).join(' · ')
    : '';
}
function specSizeText(p) {
  // 제품 크기 W × D × H (있는 값만 조합).
  const parts = [];
  if (p.width) parts.push(`W ${p.width}`);
  if (p.depth) parts.push(`D ${p.depth}`);
  if (p.height) parts.push(`H ${p.height}`);
  return parts.join(' × ');
}

// 단위 부착 — 이중부착 방지: 값에 이미 문자(단위)가 있으면 그대로, 순수 숫자면 단위 붙임.
// 어드민 신규저장은 숫자만("180")이라 mm/kg/W 부착. 레거시 "180mm"류는 이미 단위 포함 → 그대로.
function withUnit(v, unit) {
  const s = String(v == null ? '' : v).trim();
  if (s === '') return '';
  return /[a-zA-Z가-힣]/.test(s) ? s : s + unit;
}

// '스펙' 섹션 전용 2열 그리드 — 셀 배열({label,value} 또는 {empty:true})을 그대로 렌더.
// 빈 셀은 라벨 없는 백지 셀(그리드 stretch로 행 높이 매칭)로 좌/우 정렬을 유지한다.
function specColumnGrid(cells) {
  if (!cells.some((c) => !c.empty)) return '';
  return (
    '<div class="wd-spec2-grid">' +
    cells
      .map((c) =>
        c.empty
          ? '<div class="wd-spec2-cell"></div>'
          : `<div class="wd-spec2-cell"><span class="wd-spec2-label">${escapeHtml(c.label)}</span><span class="wd-spec2-val">${escapeHtml(c.value)}</span></div>`,
      )
      .join('') +
    '</div>'
  );
}

// 표 행 순서 = 레퍼런스 미러
const SPEC_ROWS = [
  { label: '정수 방식', get: (p) => specEnumLabel(p.extractType) },
  { label: '출수 기능', get: (p) => specEnumLabel(p.waterFunction) },
  { label: '설치 형태', get: (p) => specEnumLabel(p.installType) },
  { label: '필터 방식', get: (p) => specEnumLabel(p.filterType) },
  { label: '살균 방식', get: (p) => specEnumList(p.sanitizing) },
  { label: '직수관 재질', get: (p) => specEnumLabel(p.pipeMaterial) },
  { label: '제품 크기', get: (p) => specSizeText(p) },
  { label: '제품 무게', get: (p) => p.weight || '' },
  { label: '소비 전력', get: (p) => p.power || '' },
  { label: '에너지 등급', get: (p) => (p.energyGrade != null ? `${p.energyGrade}등급` : '') },
  { label: '필터 개수', get: (p) => (p.filterCount != null ? `${p.filterCount}개` : '') },
  { label: '필터 교체', get: (p) => p.careInterval || '' },
  { label: '조작 기능', get: (p) => p.controlFeatures || '' },
  { label: '부가 기능', get: (p) => p.extraFeatures || '' },
];

// 제품사양 탭: 값 있는 행만 표로 (renderDetailBody 미러: 누적→빈 가드→innerHTML)
function renderSpecBody() {
  const body = document.getElementById('wdSpecBody');
  if (!body) return;
  const p = WD_PRODUCT;

  // 6칸 요약 박스 — 표 순: 정수타입/정수기능/제품유형/필터방식/살균방식/에너지효율 (3열 행우선).
  // 살균방식 = sanitizing(어드민 살균방식 드롭다운 저장필드), 정수타입 = extractType. 값 없으면 '-'.
  const cells = [
    { label: '정수타입', value: specEnumLabel(p.extractType) },
    { label: '정수기능', value: specEnumLabel(p.waterFunction) },
    { label: '제품유형', value: specEnumLabel(p.installType) },
    { label: '필터방식', value: specEnumLabel(p.filterType) },
    { label: '살균방식', value: specEnumList(p.sanitizing) },
    { label: '에너지효율', value: p.energyGrade != null ? `${p.energyGrade}등급` : '' },
  ];
  const cellsHtml = cells
    .map((c) => {
      const v = String(c.value || '').trim() || '-';
      // 값 없음('-')이면 is-empty(회색) — 실값만 보라 강조. CSS 로는 텍스트('-') 판별 불가라 클래스로 훅.
      const valCls = v === '-' ? 'wd-spec-sum-val is-empty' : 'wd-spec-sum-val';
      return `<div class="wd-spec-sum-cell"><span class="wd-spec-sum-label">${escapeHtml(c.label)}</span><span class="${valCls}">${escapeHtml(v)}</span></div>`;
    })
    .join('');

  body.innerHTML =
    `<div class="wd-spec-sum">${cellsHtml}</div>` +
    '<button type="button" class="wd-spec-more-btn" onclick="openSpecDetail()">스펙 전체보기 &gt;</button>';
}

// 최저 월 렌탈료 텍스트 — water.js getMinPrice 재사용(새 계산식 없음). 없으면 ''.
function specMinRentalText(p) {
  if (typeof getMinPrice !== 'function' || !p.pricing) return '';
  const min = getMinPrice(p.pricing);
  return min > 0 ? `월 ${min.toLocaleString()}원` : '';
}

// ── 제품사양 상세 뷰 (요약 ⇄ 상세 innerHTML 교체, 탭/URL 불변) ──
// 구성(이미지1): 기본정보 / 상품색상 / 스펙(단위부착) / 필터옵션 → + specSections 최하단. O/X표 제거됨.
function specPushPair(arr, label, value) {
  const v = String(value == null ? '' : value).trim();
  if (v !== '') arr.push({ label: label, value: v });
}
function specSection2(title, innerHtml) {
  if (!innerHtml) return '';
  return `<div class="wd-spec2-block"><h3 class="wd-spec2-title">${escapeHtml(title)}</h3>${innerHtml}</div>`;
}
function specPairsGrid(pairs) {
  if (!pairs.length) return '';
  return (
    '<div class="wd-spec2-grid">' +
    pairs
      .map(
        (pr) =>
          `<div class="wd-spec2-cell"><span class="wd-spec2-label">${escapeHtml(pr.label)}</span><span class="wd-spec2-val">${escapeHtml(pr.value)}</span></div>`,
      )
      .join('') +
    '</div>'
  );
}
// 스펙 섹션 innerHTML 조립 (기본정보/상품색상/스펙/필터옵션/specSections) — 전면 스펙 페이지 공용 순수 함수.
// .wd-spec2 래퍼·백버튼은 호출부(renderSpecPage)가 담당. 섹션 마크업은 기존 함수 재사용.
function specSectionsInnerHtml(p) {
  const sections = Array.isArray(p.specSections) ? p.specSections : [];
  let html = '';

  // 1. 기본정보 — 상품명/모델명 + specSections title="기본사양" 행 이어붙임
  const basic = [];
  specPushPair(basic, '상품명', p.name);
  specPushPair(basic, '모델명', p.modelName);
  sections
    .filter((s) => (s.title || '').trim() === '기본사양')
    .forEach((s) =>
      (s.rows || []).forEach((r) => specPushPair(basic, r.label, r.value)),
    );
  html += specSection2('기본정보', specPairsGrid(basic));

  // 2. 상품색상
  const colorPairs = [];
  specPushPair(colorPairs, '색상', (p.colors || []).filter((c) => c && c !== '기본').join(', '));
  html += specSection2('상품색상', specPairsGrid(colorPairs));

  // 3. 스펙 — 좌열 W/D/H/소비전력, 우열 무게/에너지효율 (단위부착 mm/kg/W, 이중부착 방지).
  //    ★이 섹션 전용 조립: specPushPair 스킵(밀림) 대신 열 단위로 present 값만 모아 zip →
  //    한 열이 짧으면 그 행의 반대 칸을 빈 셀로 채워 좌/우 정렬 유지 (다른 섹션 스킵 규칙 불변).
  const specLeft = [
    { label: '가로(W)', value: withUnit(p.width, 'mm') },
    { label: '세로(깊이)(D)', value: withUnit(p.depth, 'mm') },
    { label: '높이(H)', value: withUnit(p.height, 'mm') },
    { label: '소비전력', value: withUnit(p.power, 'W') },
  ].filter((it) => it.value !== '');
  const specRight = [
    { label: '제품 무게', value: withUnit(p.weight, 'kg') },
    { label: '에너지효율', value: p.energyGrade != null ? `${p.energyGrade}등급` : '' },
  ].filter((it) => it.value !== '');
  const specCells = [];
  const specRows = Math.max(specLeft.length, specRight.length);
  for (let i = 0; i < specRows; i++) {
    specCells.push(specLeft[i] || { empty: true });
    specCells.push(specRight[i] || { empty: true });
  }
  html += specSection2('스펙', specColumnGrid(specCells));

  // 4. 필터옵션 — 표 순: 정수기능/제품유형/필터방식/살균방식/정수타입/가격대
  const filt = [];
  specPushPair(filt, '정수기능', specEnumLabel(p.waterFunction));
  specPushPair(filt, '제품유형', specEnumLabel(p.installType));
  specPushPair(filt, '필터방식', specEnumLabel(p.filterType));
  specPushPair(filt, '살균방식', specEnumList(p.sanitizing));
  specPushPair(filt, '정수타입', specEnumLabel(p.extractType));
  specPushPair(filt, '가격대', specEnumLabel(p.priceRange));
  html += specSection2('필터옵션', specPairsGrid(filt));

  // 5. 추가 스펙 섹션(기본사양 제외) — 최하단 유지
  const rest = sections
    .filter((s) => (s.title || '').trim() !== '기본사양')
    .map((s) => ({ title: (s.title || '').trim() || '기타', rows: (s.rows || []).slice() }));
  rest.forEach((s) => {
    const pairs = [];
    s.rows.forEach((r) => specPushPair(pairs, r.label, r.value));
    html += specSection2(s.title, specPairsGrid(pairs));
  });

  return html;
}

// R1-2: 뒤로가기로 통일 (pushState 중복 방지). popstate 가 renderSpecBody + URL 정리 담당.
function backToSpecSummary() {
  history.back();
}
function scrollSpecTop() {
  const bar = document.querySelector('.wd-detail-tabbar');
  if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 하단 상세: 상세이미지 세로 나열(쿠팡식) + 텍스트 설명 + 펼쳐보기 토글
function renderDetailBody() {
  const body = document.getElementById('wdDetailBody');
  if (!body) return;
  const p = WD_PRODUCT;

  let inner = '';
  if (p.detailImages && p.detailImages.length) {
    inner += '<div class="wd-detail-images">';
    for (let i = 0; i < p.detailImages.length; i++) {
      inner += `<img src="${p.detailImages[i]}" alt="상세 이미지 ${i + 1}" loading="lazy" />`;
    }
    inner += '</div>';
  }
  if (p.desc) {
    inner += `<div class="wd-detail-text">${escapeHtml(p.desc)}</div>`;
  }

  if (!inner) {
    body.innerHTML =
      '<div style="color:#8a8a99;text-align:center;padding:40px;">상세 정보가 등록되지 않았습니다.</div>';
    return;
  }

  // 접기 컨테이너(처음 1000px만) + 펼쳐보기 버튼
  body.innerHTML = `
    <div class="wd-collapse" id="wdCollapse">
      ${inner}
      <div class="wd-collapse-fade" id="wdFade"></div>
    </div>
    <button type="button" class="wd-expand-btn" id="wdExpandBtn" onclick="wdToggleDetail()">
      상품정보 펼쳐보기 ▼
    </button>
  `;

  // 콘텐츠가 접힘 높이보다 짧으면 버튼/그라데이션 숨김
  requestAnimationFrame(() => {
    const wrap = document.getElementById('wdCollapse');
    const btn = document.getElementById('wdExpandBtn');
    const fade = document.getElementById('wdFade');
    if (!wrap || !btn) return;
    const COLLAPSED = 1000; // 처음 보이는 높이(px)
    if (wrap.scrollHeight <= COLLAPSED + 60) {
      // 짧으면 그냥 다 보여주고 버튼 제거
      wrap.style.maxHeight = 'none';
      if (fade) fade.style.display = 'none';
      btn.style.display = 'none';
    }
  });
}

// 펼쳐보기/접기 토글
function wdToggleDetail() {
  const wrap = document.getElementById('wdCollapse');
  const btn = document.getElementById('wdExpandBtn');
  const fade = document.getElementById('wdFade');
  if (!wrap || !btn) return;
  const expanded = wrap.classList.toggle('expanded');
  if (expanded) {
    btn.textContent = '접기 ▲';
    if (fade) fade.style.display = 'none';
  } else {
    btn.textContent = '상품정보 펼쳐보기 ▼';
    if (fade) fade.style.display = 'block';
    // 접을 때 상세 섹션 상단으로 스크롤
    const sec = document.getElementById('wdDetailBody');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "신청하기" → 기존 다이얼로그를 선택값 그대로 열기
function wdApply() {
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const type = document.getElementById('wdType').value;

  // water.js openDialog 재사용 (전역 favorites 에 선택값 미리 넣어 다이얼로그가 복원하게)
  if (typeof favorites !== 'undefined') {
    favorites[WD_PRODUCT.id] = {
      contract,
      cycle,
      type,
      color: WD_COLOR,
      monthly: WD_PRODUCT.pricing[contract]?.[cycle]?.[type]?.monthly || 0,
    };
  }
  if (typeof openDialog === 'function') {
    openDialog(WD_PRODUCT.id, WD_BRAND_KEY);
  } else {
    console.error('[water-detail] openDialog 미로드');
  }
}

// 카카오 상담
function wdKakao() {
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const type = document.getElementById('wdType').value;
  const d = WD_PRODUCT.pricing[contract]?.[cycle]?.[type] || {};
  const meta =
    (typeof BRAND_META !== 'undefined' && BRAND_META[WD_BRAND_KEY]) || {};
  if (typeof openKakaoConsult === 'function') {
    openKakaoConsult({
      category: '정수기 렌탈',
      brand: meta.name || '',
      productName: WD_PRODUCT.name,
      color: WD_COLOR,
      contract:
        (typeof CONTRACT_LABELS !== 'undefined' && CONTRACT_LABELS[contract]) ||
        contract,
      cycle: `${cycle} 방문 관리`,
      type,
      monthly: d.monthly || 0,
    });
  } else {
    window.open('https://pf.kakao.com/_exaRjX/chat', '_blank');
  }
}

function wdGoBack() {
  const back = WD_BACK_BRAND || WD_BRAND_KEY || '';
  location.href = back ? `water.html?brand=${back}` : 'water.html';
}


// ── 최근 본 상품 기록(로그인 시, fire-and-forget) ──
function recordRecentView(productId) {
  try {
    var loggedIn = (typeof isLoggedIn === 'function') ? isLoggedIn()
      : (typeof getToken === 'function' ? !!getToken() : !!localStorage.getItem('dapick_token'));
    if (!loggedIn || !productId) return;
    if (typeof api !== 'undefined' && api && api.post) {
      api.post('/api/recent-views/' + productId, {}, { skipAuthRefresh: true }).catch(function () {});
    }
  } catch (e) {}
}
