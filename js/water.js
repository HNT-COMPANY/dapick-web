// ════════════════════════════════════════════════════
// water.js — 렌더링 / 다이얼로그 / 즐겨찾기 로직
// 데이터는 js/products/ 폴더에서 관리합니다
// ════════════════════════════════════════════════════

// ── 공통 상수 ──
// EMPTY: 가격 미입력 상품에 사용 (0이면 "상담 시 안내" 자동 표시)
const EMPTY = { monthly: 0, cardDiscount: 0, maxSupport: 0 };

// 약정키 → 드롭다운 표시 텍스트
const CONTRACT_LABELS = {
  '의무36/계약60': '36개월(의무) · 60개월(계약)',
  '의무60/계약60': '60개월(의무) · 60개월(계약)',
  '의무72/계약72': '72개월(의무) · 72개월(계약)',
  '의무84/계약84': '84개월(의무) · 84개월(계약)',
};

// ── 전체 상품 조합 (products/ 파일들이 먼저 로드된 후 합침) ──
const WATER_PRODUCTS = {
  coway: COWAY,
  sk: SK,
  chungho: CHUNGHO,
  cuckoo: CUCKOO,
};

// ════════════════════════════════════════════════════
// 헬퍼 함수
// ════════════════════════════════════════════════════

// 전체 최저가
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

// 약정별 최저가
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
function switchBrand(brand) {
  currentBrand = brand;
  document
    .querySelectorAll('.brand-tab')
    .forEach((t) => t.classList.toggle('active', t.dataset.brand === brand));
  renderBrand(brand);
}

// ════════════════════════════════════════════════════
// 렌더링
// ════════════════════════════════════════════════════
function renderBrand(brand) {
  const data = WATER_PRODUCTS[brand];
  const best = data.products.filter((p) => p.best);

  document.getElementById('bestTitle').textContent = `${data.name} 인기 상품`;
  document.getElementById('bestSub').textContent =
    `다픽 고객이 가장 많이 선택한 ${data.name} 정수기 TOP ${best.length}`;
  document.getElementById('listTitle').textContent = `${data.name} 전체 상품`;

  const contractKeys = Object.keys(CONTRACT_LABELS);

  // 베스트 카드
  document.getElementById('bestGrid').innerHTML = best
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
    <div class="water-card is-best" onclick="openDialog('${p.id}','${brand}')">
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
      <div class="water-card-price-row">
        <span class="water-card-price">${minPrice ? '월 ' + minPrice.toLocaleString() + '원~' : '가격 문의'}</span>
        <span class="water-card-price-unit">${minPrice ? '최저가' : ''}</span>
      </div>
      <div class="water-card-tiers" style="grid-template-columns:repeat(4,1fr);">${tierHtml}</div>
      <div class="water-card-desc">${p.desc}</div>
    </div>`;
    })
    .join('');

  // 전체 리스트
  document.getElementById('listGrid').innerHTML = data.products
    .map((p) => {
      const minPrice = getMinPrice(p.pricing);
      return `
    <div class="water-list-item" onclick="openDialog('${p.id}','${brand}')">
      <div class="water-list-icon">
        ${
          p.image
            ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;padding:6px;">`
            : `<span>${data.emoji}</span>`
        }
      </div>
      <div class="water-list-info">
        <div class="water-list-name">${p.name}${p.new ? ' 🆕' : ''}</div>
        <div class="water-list-price">
          ${minPrice ? '월 ' + minPrice.toLocaleString() + '원~' : '가격 문의'}
          <span> · 약정·관리주기 선택 가능</span>
        </div>
      </div>
      <div class="water-list-arrow">›</div>
    </div>`;
    })
    .join('');
}

// ════════════════════════════════════════════════════
// 다이얼로그
// ════════════════════════════════════════════════════
function openDialog(productId, brand) {
  const data = WATER_PRODUCTS[brand];
  const p = data.products.find((x) => x.id === productId);
  if (!p) return;

  dialogProd = p;
  dialogBrandKey = brand;
  const prev = favorites[p.id] || {};
  dialogColor = prev.color || p.colors[0];

  document.getElementById('wDTag').textContent =
    `${data.emoji} ${data.name}${p.new ? '  🆕 NEW' : ''}`;
  document.getElementById('wDName').textContent = p.name;

  // 약정 드롭다운
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

// 관리주기 드롭다운 갱신
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

// 타사보상 드롭다운 갱신
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

// 색상 칩
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

// 가격 자동 계산
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

// 다이얼로그 닫기
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
  renderBrand(currentBrand);
}

function quickFav(e, productId, brand) {
  e.stopPropagation();
  if (favorites[productId]) {
    delete favorites[productId];
  } else {
    const p = WATER_PRODUCTS[brand].products.find((x) => x.id === productId);
    const contracts = Object.keys(p.pricing);
    const lastC = contracts[contracts.length - 1];
    const cycles = Object.keys(p.pricing[lastC]);
    const firstCy = cycles[0];
    const types = Object.keys(p.pricing[lastC][firstCy]);
    favorites[productId] = {
      contract: lastC,
      cycle: firstCy,
      type: types[0],
      color: p.colors[0],
      monthly: p.pricing[lastC][firstCy][types[0]].monthly,
    };
  }
  updateBottomBar();
  renderBrand(currentBrand);
}

function updateBottomBar() {
  const ids = Object.keys(favorites);
  if (!ids.length) {
    document.getElementById('wbbPrice').textContent = '상품을 찜해주세요';
    document.getElementById('wbbCount').textContent = '';
    return;
  }
  const total = ids.reduce((s, id) => s + (favorites[id].monthly || 0), 0);
  document.getElementById('wbbPrice').textContent =
    `월 ${total.toLocaleString()}원`;
  document.getElementById('wbbCount').textContent = `(${ids.length}개 상품)`;
}

// ════════════════════════════════════════════════════
// 카카오 상담 — 선택한 상품 정보 포함
// ════════════════════════════════════════════════════
function openKakaoWithProduct() {
  if (!dialogProd) {
    window.open('http://pf.kakao.com/_LxifxmG/chat', '_blank');
    return;
  }
  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = dialogProd.pricing[contract]?.[cycle]?.[type];
  const monthly = d?.monthly || 0;

  const msg = [
    '[정수기 렌탈 상담 신청]',
    `상품명: ${dialogProd.name}`,
    `색상: ${dialogColor}`,
    `약정: ${CONTRACT_LABELS[contract] || contract}`,
    `관리주기: ${cycle} 방문 관리`,
    `가입조건: ${type}`,
    monthly
      ? `월 렌탈료: ${monthly.toLocaleString()}원`
      : '월 렌탈료: 상담 요청',
  ].join('\n');

  window.open(
    `http://pf.kakao.com/_LxifxmG/chat?message=${encodeURIComponent(msg)}`,
    '_blank',
  );
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

// ── 초기 실행 ──
renderBrand('coway');

// ════════════════════════════════════════════════════
// 카카오 상담 — utils.js의 openKakaoConsult() 호출
// ════════════════════════════════════════════════════
function openKakaoWithProduct() {
  if (!dialogProd) {
    openKakaoConsult({});
    return;
  }

  const contract = document.getElementById('wDContract').value;
  const cycle = document.getElementById('wDCycle').value;
  const type = document.getElementById('wDType').value;
  const d = dialogProd.pricing[contract]?.[cycle]?.[type];

  openKakaoConsult({
    category: '정수기 렌탈',
    productName: dialogProd.name,
    detail: `${CONTRACT_LABELS[contract] || contract} / ${cycle} 방문 관리 / ${type}`,
    monthly: d?.monthly || 0,
    extra: `색상: ${dialogColor}`,
  });
}

// 로그인 후 자동 상담 실행 (sessionStorage 확인)
document.addEventListener('DOMContentLoaded', () => {
  const auto = sessionStorage.getItem('kakao_consult_auto');
  if (auto) {
    sessionStorage.removeItem('kakao_consult_auto');
    const info = JSON.parse(auto);
    // 잠깐 딜레이 후 자동 실행
    setTimeout(() => openKakaoConsult(info), 800);
  }
});

// ════════════════════════════════════════════════════
// 카카오 상담 — utils.js의 openKakaoConsult() 호출
// ════════════════════════════════════════════════════

// 다이얼로그에서 "카카오로 상담하기" 클릭 시 호출
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

// 로그인 후 복귀 시 pending 상담 자동 처리
document.addEventListener('DOMContentLoaded', () => {
  resumePendingKakaoConsult();
});
