// ════════════════════════════════════════════════════
// water-detail.js — 정수기 상세 페이지
// ────────────────────────────────────────────────────
// ?id={상품UUID} 로 진입 → /api/water-products/{id} 조회
// 우 패널에서 약정·관리주기·타사보상·색상 선택 → 가격 갱신
// "신청하기" → 기존 다이얼로그(water.js openDialog)에 선택값 전달
//   ※ water.js 가 먼저 로드되어 있어야 함
//     (CONTRACT_LABELS / BRAND_META / openDialog / openKakaoConsult 재사용)
// ════════════════════════════════════════════════════

let WD_PRODUCT = null; // 조회된 상품 (water.js groupByBrand 형태로 정규화)
let WD_BRAND_KEY = null;
let WD_COLOR = '';

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
      desc: p.description || '',
      image: p.imageUrl || '',
      colors: Array.isArray(p.colors) && p.colors.length ? p.colors : ['기본'],
      pricing: p.pricing || {},
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
  document.getElementById('wdBrandTag').textContent =
    `${meta.emoji} ${meta.name}`;
  document.getElementById('wdName').textContent = p.name;
  document.getElementById('wdDesc').textContent = p.desc || '';
  document.getElementById('wdBackText').textContent =
    `‹ ${meta.name} 상품 목록`;

  const gal = document.getElementById('wdGallery');
  gal.innerHTML = p.image
    ? `<img src="${p.image}" alt="${p.name}">`
    : `<span class="wd-emoji">${meta.emoji}</span>`;

  // 약정 드롭다운
  const contractKeys = Object.keys(p.pricing);
  const cSel = document.getElementById('wdContract');
  cSel.innerHTML = contractKeys
    .map(
      (k, i) =>
        `<option value="${k}" ${i === contractKeys.length - 1 ? 'selected' : ''}>${(typeof CONTRACT_LABELS !== 'undefined' && CONTRACT_LABELS[k]) || k}</option>`,
    )
    .join('');
  cSel.onchange = () => {
    fillCycle();
    fillType();
    calc();
  };

  fillCycle();
  fillType();
  renderColors();
  calc();
}

function fillCycle() {
  const p = WD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycles = Object.keys(p.pricing[contract] || {});
  const sel = document.getElementById('wdCycle');
  sel.innerHTML = cycles
    .map(
      (c, i) =>
        `<option value="${c}" ${i === 0 ? 'selected' : ''}>${c} 방문 관리</option>`,
    )
    .join('');
  sel.onchange = () => {
    fillType();
    calc();
  };
}

function fillType() {
  const p = WD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const types = Object.keys((p.pricing[contract] || {})[cycle] || {});
  const sel = document.getElementById('wdType');
  sel.innerHTML = types
    .map(
      (t, i) =>
        `<option value="${t}" ${i === 0 ? 'selected' : ''}>${t === '타사보상' ? '타사보상 (현재 다른 회사 정수기 사용 중)' : t}</option>`,
    )
    .join('');
  sel.onchange = () => calc();
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

  document.getElementById('wdPrice').innerHTML = monthly
    ? `${monthly.toLocaleString()}<small>원/월</small>`
    : `<span style="font-size:16px;color:var(--text-muted);">상담 시 안내</span>`;
  document.getElementById('wdTotal').innerHTML = monthly
    ? `총 ${(monthly * months).toLocaleString()}원<br>(${months}개월)`
    : '-';

  document.getElementById('wdSpecType').textContent = type;
  document.getElementById('wdSpecCard').innerHTML = d.cardDiscount
    ? `<span style="color:#e8547a;">월 ${d.cardDiscount.toLocaleString()}원</span>`
    : '<span style="color:#8a8a99;font-size:12px;">상담 시 안내</span>';
  document.getElementById('wdSpecSupport').innerHTML = d.maxSupport
    ? `<span style="color:var(--purple);">₩ ${d.maxSupport.toLocaleString()}</span>`
    : '<span style="color:#8a8a99;font-size:12px;">상담 시 안내</span>';

  // 하단 상세설명
  document.getElementById('wdDetailBody').textContent =
    p.desc || '상세 설명이 등록되지 않았습니다.';
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
  location.href = 'water.html';
}
