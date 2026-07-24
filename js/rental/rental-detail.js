// ════════════════════════════════════════════════════
// rental-detail.js — 렌탈 상세 페이지 (3단 견적 흐름)
// ────────────────────────────────────────────────────
// ?id={상품UUID} → /api/rental-products/{id}
// 우 패널: 약정 → 관리주기 → 타사보상 3단 select + 색상 → calc()
// "신청하기" → 다이얼로그(3단 재확인) → "상담 신청하기"
//             → DapickApplication.apply() 공통 모듈 호출 (전 카테고리 통일)
//
// 5/29: 신청 폼 자체구현 제거 → 공통 application.js 사용.
//       선택된 약정/관리주기/타사보상/색상/월요금을 payload 로 전달.
//
// ※ 의존: water.css / water-detail.css / common/config.js / common/application.js
// ════════════════════════════════════════════════════

const RD_API_BASE =
  typeof DAPICK_CONFIG !== 'undefined' && DAPICK_CONFIG.API_BASE_URL
    ? DAPICK_CONFIG.API_BASE_URL
    : typeof BASE_URL !== 'undefined' && BASE_URL
      ? BASE_URL
      : 'https://api.dapick.co.kr';

const RD_KAKAO_URL = 'https://pf.kakao.com/_exaRjX/chat';

const RD_CONTRACT_LABELS = {
  '의무36/계약60': '36개월(의무) · 60개월(계약)',
  '의무60/계약60': '60개월(의무) · 60개월(계약)',
  '의무72/계약72': '72개월(의무) · 72개월(계약)',
  '의무84/계약84': '84개월(의무) · 84개월(계약)',
};

let RD_PRODUCT = null;
let RD_COLOR = '';

document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    showStatus('상품 정보가 없습니다.');
    return;
  }
  loadDetail(id);

  // 로그인 후 복귀 시 신청 모달 이어서 (공통 모듈)
  if (
    typeof DapickApplication !== 'undefined' &&
    DapickApplication.resumeIfPending
  ) {
    DapickApplication.resumeIfPending();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDialog();
});

function showStatus(msg) {
  const el = document.getElementById('wdRoot');
  if (el) el.innerHTML = `<div class="wd-status">${msg}</div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function contractLabel(key) {
  return RD_CONTRACT_LABELS[key] || key;
}

function contractMonthsOf(key) {
  const parts = String(key || '').split('/');
  const back = parseInt((parts[1] || '').replace(/[^0-9]/g, ''), 10);
  if (!isNaN(back)) return back;
  const front = parseInt((parts[0] || '').replace(/[^0-9]/g, ''), 10);
  return isNaN(front) ? 0 : front;
}

// ─── 로드 ────────────────────────────────────────────
async function loadDetail(id) {
  try {
    const url = `${RD_API_BASE}/api/rental-products/${id}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const p = json?.data ?? json;
    if (!p || !p.id) throw new Error('빈 응답');
    recordRecentView(p.id);

    RD_PRODUCT = {
      id: p.id,
      name: p.name,
      desc: p.description || '',
      image: p.imageUrl || '',
      colors: Array.isArray(p.colors) && p.colors.length ? p.colors : [],
      pricing: p.pricing || {},
      detailImages: Array.isArray(p.detailImages) ? p.detailImages : [],
      categoryName: p.categoryName || '',
      categoryId: p.categoryId || null,
      emoji: p.emoji || '📦',
    };

    RD_COLOR = RD_PRODUCT.colors[0] || '';
    renderDetail();
  } catch (e) {
    console.error('[rental-detail] 로드 실패:', e);
    showStatus('상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}

// ─── 상세 렌더 ───────────────────────────────────────
function renderDetail() {
  const p = RD_PRODUCT;

  const tagEl = document.getElementById('wdCategoryTag');
  if (tagEl) {
    tagEl.textContent = p.categoryName
      ? `${p.emoji || '📦'} ${p.categoryName}`
      : '';
  }

  document.getElementById('wdName').textContent = p.name;
  document.getElementById('wdDesc').textContent = p.desc || '';
  if (window.dpFavInit) dpFavInit(document.getElementById('wdFav'), p.id);
  document.getElementById('wdBackText').textContent = p.categoryName
    ? `‹ ${p.categoryName} 상품 목록`
    : '‹ 상품 목록';

  const gal = document.getElementById('wdGallery');
  gal.innerHTML = p.image
    ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">`
    : `<span class="wd-emoji">${p.emoji || '📦'}</span>`;

  const contractKeys = Object.keys(p.pricing);
  const cSel = document.getElementById('wdContract');

  if (!contractKeys.length) {
    ['wdContractWrap', 'wdCycleWrap', 'wdTypeWrap'].forEach((idv) => {
      const el = document.getElementById(idv);
      if (el) el.style.display = 'none';
    });
    document.getElementById('wdPrice').innerHTML =
      '<span style="font-size:16px;color:var(--text-muted);">상담 시 안내</span>';
    document.getElementById('wdTotal').innerHTML = '-';
    renderColors();
    renderDetailBody();
    return;
  }

  cSel.innerHTML = contractKeys
    .map(
      (k, i) =>
        `<option value="${k}" ${i === contractKeys.length - 1 ? 'selected' : ''}>${contractLabel(k)}</option>`,
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
  renderDetailBody();
}

function fillCycle() {
  const p = RD_PRODUCT;
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
  const p = RD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const types = Object.keys((p.pricing[contract] || {})[cycle] || {});
  const sel = document.getElementById('wdType');
  sel.innerHTML = types
    .map(
      (t, i) =>
        `<option value="${t}" ${i === 0 ? 'selected' : ''}>${t === '타사보상' ? '타사보상 (현재 다른 회사 제품 사용 중)' : t}</option>`,
    )
    .join('');
  sel.onchange = () => calc();
}

function renderColors() {
  const p = RD_PRODUCT;
  const wrap = document.getElementById('wdColorWrap');
  const colorsEl = document.getElementById('wdColors');
  if (!wrap || !colorsEl) return;

  if (!p.colors || !p.colors.length) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';

  colorsEl.innerHTML = p.colors
    .map(
      (c) =>
        `<div class="wd-chip ${RD_COLOR === c ? 'active' : ''}" data-color="${escapeHtml(c)}">${escapeHtml(c)}</div>`,
    )
    .join('');
  colorsEl.querySelectorAll('.wd-chip').forEach((chip) => {
    chip.onclick = () => {
      RD_COLOR = chip.dataset.color;
      colorsEl
        .querySelectorAll('.wd-chip')
        .forEach((c) =>
          c.classList.toggle('active', c.dataset.color === RD_COLOR),
        );
    };
  });
}

function calc() {
  const p = RD_PRODUCT;
  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const type = document.getElementById('wdType').value;
  const d = p.pricing[contract]?.[cycle]?.[type] || {};

  const months = contractMonthsOf(contract);
  const monthly = d.monthly || 0;

  document.getElementById('wdPrice').innerHTML = monthly
    ? `${monthly.toLocaleString()}<small>원/월</small>`
    : `<span style="font-size:16px;color:var(--text-muted);">상담 시 안내</span>`;
  document.getElementById('wdTotal').innerHTML =
    monthly && months
      ? `총 ${(monthly * months).toLocaleString()}원<br>(${months}개월)`
      : '-';

  document.getElementById('wdSpecType').textContent = type || '-';
  document.getElementById('wdSpecCard').innerHTML = d.cardDiscount
    ? `<span style="color:#e8547a;">월 ${d.cardDiscount.toLocaleString()}원</span>`
    : '<span style="color:#8a8a99;font-size:12px;">상담 시 안내</span>';
  document.getElementById('wdSpecSupport').innerHTML = d.maxSupport
    ? `<span style="color:var(--purple);">₩ ${d.maxSupport.toLocaleString()}</span>`
    : '<span style="color:#8a8a99;font-size:12px;">상담 시 안내</span>';
}

// ─── 하단 상세 ───────────────────────────────────────
function renderDetailBody() {
  const body = document.getElementById('wdDetailBody');
  if (!body) return;
  const p = RD_PRODUCT;

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

  body.innerHTML = `
    <div class="wd-collapse" id="wdCollapse">
      ${inner}
      <div class="wd-collapse-fade" id="wdFade"></div>
    </div>
    <button type="button" class="wd-expand-btn" id="wdExpandBtn" onclick="rdToggleDetail()">
      상품정보 펼쳐보기 ▼
    </button>
  `;

  requestAnimationFrame(() => {
    const wrap = document.getElementById('wdCollapse');
    const btn = document.getElementById('wdExpandBtn');
    const fade = document.getElementById('wdFade');
    if (!wrap || !btn) return;
    const COLLAPSED = 1000;
    if (wrap.scrollHeight <= COLLAPSED + 60) {
      wrap.style.maxHeight = 'none';
      if (fade) fade.style.display = 'none';
      btn.style.display = 'none';
    }
  });
}

function rdToggleDetail() {
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
    const sec = document.getElementById('wdDetailBody');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ════════════════════════════════════════════════════
// 다이얼로그 (3단 재확인) — 정수기 패턴
// ════════════════════════════════════════════════════
function rdApply() {
  const p = RD_PRODUCT;
  const contractKeys = Object.keys(p.pricing);

  // 3단 요금표 미등록 → 다이얼로그 생략, 바로 공통 신청 모듈 (월요금 0 → 카카오 유도됨)
  if (!contractKeys.length) {
    fireApply();
    return;
  }

  const contract = document.getElementById('wdContract').value;
  const cycle = document.getElementById('wdCycle').value;
  const type = document.getElementById('wdType').value;

  document.getElementById('wDTag').textContent = p.categoryName
    ? `${p.emoji || '📦'} ${p.categoryName}`
    : '렌탈';
  document.getElementById('wDName').textContent = p.name || '';

  const dcSel = document.getElementById('wDContract');
  dcSel.innerHTML = contractKeys
    .map(
      (k) =>
        `<option value="${k}" ${k === contract ? 'selected' : ''}>${contractLabel(k)}</option>`,
    )
    .join('');
  dcSel.onchange = () => {
    dlgFillCycle(null);
    dlgFillType(null);
    dlgCalc();
  };

  dlgFillCycle(cycle);
  dlgFillType(type);
  dlgRenderColors();
  dlgCalc();

  document.getElementById('wDialogOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function dlgFillCycle(prev) {
  const p = RD_PRODUCT;
  const contract = document.getElementById('wDContract').value;
  const cycles = Object.keys(p.pricing[contract] || {});
  const sel = document.getElementById('wDCycle');
  sel.innerHTML = cycles
    .map(
      (c) =>
        `<option value="${c}" ${c === (prev || cycles[0]) ? 'selected' : ''}>${c} 방문 관리</option>`,
    )
    .join('');
  sel.onchange = () => {
    dlgFillType(null);
    dlgCalc();
  };
}

function dlgFillType(prev) {
  const p = RD_PRODUCT;
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const types = Object.keys((p.pricing[contract] || {})[cycle] || {});
  const sel = document.getElementById('wDType');
  sel.innerHTML = types
    .map(
      (t) =>
        `<option value="${t}" ${t === (prev || types[0]) ? 'selected' : ''}>${t === '타사보상' ? '타사보상 (현재 다른 회사 제품 사용 중)' : t}</option>`,
    )
    .join('');
  sel.onchange = () => dlgCalc();
}

function dlgRenderColors() {
  const p = RD_PRODUCT;
  const group = document.getElementById('wDColorsGroup');
  const box = document.getElementById('wDColors');
  if (!p.colors || !p.colors.length) {
    if (group) group.style.display = 'none';
    return;
  }
  if (group) group.style.display = '';
  box.innerHTML = p.colors
    .map(
      (c) =>
        `<div class="w-chip ${RD_COLOR === c ? 'active' : ''}" data-color="${escapeHtml(c)}">${escapeHtml(c)}</div>`,
    )
    .join('');
  box.querySelectorAll('.w-chip').forEach((chip) => {
    chip.onclick = () => {
      RD_COLOR = chip.dataset.color;
      box
        .querySelectorAll('.w-chip')
        .forEach((c) =>
          c.classList.toggle('active', c.dataset.color === RD_COLOR),
        );
    };
  });
}

function dlgCalc() {
  const p = RD_PRODUCT;
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = p.pricing[contract]?.[cycle]?.[type] || {};

  const months = contractMonthsOf(contract);
  const monthly = d.monthly || 0;

  document.getElementById('wDPrice').innerHTML = monthly
    ? `${monthly.toLocaleString()}<span>원/월</span>`
    : `<span style="font-size:15px;color:var(--text-muted);">상담 시 안내</span>`;
  document.getElementById('wDTotal').textContent =
    monthly && months
      ? `총 ${(monthly * months).toLocaleString()}원 (${months}개월)`
      : '-';

  const cardHtml = d.cardDiscount
    ? `<span style="color:#e8547a;font-weight:700;">월 ${d.cardDiscount.toLocaleString()}원</span>`
    : `<span style="color:var(--text-muted);font-size:12px;">상담 시 안내</span>`;
  const supportHtml = d.maxSupport
    ? `<span style="color:var(--purple);font-weight:700;">₩ ${d.maxSupport.toLocaleString()}</span>`
    : `<span style="color:var(--text-muted);font-size:12px;">상담 시 안내</span>`;

  document.getElementById('wDSpecs').innerHTML = `
    <div class="w-spec-item"><div class="w-spec-label">약정 조건</div><div class="w-spec-val" style="font-size:12px;">${contractLabel(contract)}</div></div>
    <div class="w-spec-item"><div class="w-spec-label">가입 조건</div><div class="w-spec-val">${type}</div></div>
    <div class="w-spec-item"><div class="w-spec-label">카드할인 시</div><div class="w-spec-val">${cardHtml}</div></div>
    <div class="w-spec-item"><div class="w-spec-label">최대 지원금</div><div class="w-spec-val">${supportHtml}</div></div>`;

  document.getElementById('wDDesc').textContent = p.desc || '';
}

function closeDialog() {
  const ov = document.getElementById('wDialogOverlay');
  if (ov) ov.classList.remove('show');
  document.body.style.overflow = '';
}
function closeDialogOutside(e) {
  if (e.target === document.getElementById('wDialogOverlay')) closeDialog();
}

// ════════════════════════════════════════════════════
// 신청 → 공통 모듈 DapickApplication.apply() 호출
// 다이얼로그가 열려 있으면 그 값을, 아니면 우 패널 값을 사용
// ════════════════════════════════════════════════════
function currentSelection() {
  const useDialog = document
    .getElementById('wDialogOverlay')
    .classList.contains('show');
  const cId = useDialog ? 'wDContract' : 'wdContract';
  const cyId = useDialog ? 'wDCycle' : 'wdCycle';
  const tId = useDialog ? 'wDType' : 'wdType';

  const hasPricing = Object.keys(RD_PRODUCT.pricing).length > 0;
  if (!hasPricing) return { contract: '', cycle: '', type: '', monthly: 0 };

  const contract = document.getElementById(cId).value;
  const cycle = document.getElementById(cyId).value;
  const type = document.getElementById(tId).value;
  const d = RD_PRODUCT.pricing[contract]?.[cycle]?.[type] || {};
  return { contract, cycle, type, monthly: d.monthly || 0 };
}

// 다이얼로그의 "상담 신청하기" 버튼 → 호출
window.openApplyForm = function () {
  // 다이얼로그 닫고 공통 모달 띄움
  closeDialog();
  fireApply();
};

function fireApply() {
  if (!RD_PRODUCT || !RD_PRODUCT.id) {
    alert('상품 정보가 올바르지 않습니다. 다시 시도해주세요.');
    return;
  }
  if (typeof DapickApplication === 'undefined' || !DapickApplication.apply) {
    console.error('[rental-detail] application.js 미로드');
    alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  const sel = currentSelection();

  const selectedOptions = {};
  if (RD_COLOR) selectedOptions.color = RD_COLOR;
  if (sel.contract) selectedOptions.contract = contractLabel(sel.contract);
  if (sel.cycle) selectedOptions.cycle = sel.cycle + ' 방문 관리';
  if (sel.type) selectedOptions.type = sel.type;

  DapickApplication.apply({
    category: 'RENTAL',
    productId: RD_PRODUCT.id,
    productName: RD_PRODUCT.name,
    brand: RD_PRODUCT.categoryName || '',
    selectedOptions: selectedOptions,
    monthlyPrice: sel.monthly,
  });
}

// 카카오 상담
function rdKakao() {
  window.open(RD_KAKAO_URL, '_blank');
}

function rdGoBack() {
  location.href = 'rental.html';
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
