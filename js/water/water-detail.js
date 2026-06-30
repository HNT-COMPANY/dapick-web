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
const WD_BACK_BRAND =
  new URLSearchParams(location.search).get('brand') || ''; // 뒤로가기용 브랜드

document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    showStatus('상품 정보가 없습니다.');
    return;
  }
  loadDetail(id);

  // 로그인 후 복귀 시 신청 모달 이어서
  if (
    typeof DapickApplication !== 'undefined' &&
    DapickApplication.resumeIfPending
  ) {
    DapickApplication.resumeIfPending();
  }
});

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

    WD_COLOR = WD_PRODUCT.colors[0];
    renderDetail();
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
  document.getElementById('wdBackText').textContent =
    `‹ ${meta.name} 상품 목록`;

  const gal = document.getElementById('wdGallery');
  gal.innerHTML = p.image
    ? `<img src="${p.image}" alt="${p.name}">`
    : `<span class="wd-emoji"></span>`;

  // 약정 박스 버튼 (기존 드롭다운 → 박스 4개)
  const contractKeys = Object.keys(p.pricing);
  const boxEl = document.getElementById('wdContractBox');
  const defaultKey = contractKeys[contractKeys.length - 1]; // 기존과 동일: 마지막 키 기본
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
  renderDetailBody(); // 하단 상세는 한 번만 렌더 (calc 와 분리)
}

// 관리주기 라벨: '셀프형'은 그대로, 숫자형은 "방문관리" 붙임(중복 방지)
function cycleLabel(c) {
  if (!c) return '';
  if (c.includes('셀프') || c === '셀프형') return '셀프형';
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
    const defaultKey = keys[0];
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
  const defaultKey = typeKeys[0];
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
