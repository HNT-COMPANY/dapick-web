// ════════════════════════════════════════════════════
// rental-detail.js — 렌탈 상세 페이지
// ────────────────────────────────────────────────────
// ?id={상품UUID} 로 진입 → /api/rental-products/{id} 조회
// 우 패널: 색상 선택 + 가격/스펙 표시 (정수기와 달리 약정/주기/타사보상 옵션 없음)
// "신청하기" → 기존 렌탈 신청 흐름 호출 (openRentalApply / DapickApplication / 카카오 fallback)
// 5/29: detailImages 세로 나열 + 펼쳐보기 토글 (정수기와 동일 패턴)
//
// ※ 의존:
//   - water-detail.css (wd-* 클래스 그대로 사용)
//   - common/config.js (DAPICK_CONFIG.API_BASE_URL)
//   - common/application.js (선택)
//   - rental.js 불필요 (다이얼로그 없음)
// ════════════════════════════════════════════════════

let RD_PRODUCT = null;
let RD_COLOR = '';

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
    const url = `${DAPICK_CONFIG.API_BASE_URL}/api/rental-products/${id}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const p = json?.data ?? json;
    if (!p || !p.id) throw new Error('빈 응답');

    // 메모리 모델로 정규화
    RD_PRODUCT = {
      id: p.id,
      name: p.name,
      desc: p.description || '',
      image: p.imageUrl || '',
      colors: Array.isArray(p.colors) ? p.colors : [],
      pricing: p.pricing || {}, // { monthly, registerFee }
      detailImages: Array.isArray(p.detailImages) ? p.detailImages : [],
      categoryName: p.categoryName || '',
      categoryId: p.categoryId || null,
      contractMonths: p.contractMonths || 0,
      careInterval: p.careInterval || '',
      emoji: p.emoji || '📦',
      isBest: !!p.isBest,
    };

    RD_COLOR = RD_PRODUCT.colors[0] || '';
    renderDetail();
  } catch (e) {
    console.error('[rental-detail] 로드 실패:', e);
    showStatus('상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
}

function renderDetail() {
  const p = RD_PRODUCT;

  // 카테고리(품목) 태그 — 정수기의 brand-tag 자리에
  const tagEl = document.getElementById('wdCategoryTag');
  if (tagEl) {
    tagEl.textContent = p.categoryName
      ? `${p.emoji || '📦'} ${p.categoryName}`
      : '';
  }

  document.getElementById('wdName').textContent = p.name;
  document.getElementById('wdDesc').textContent = p.desc || '';
  document.getElementById('wdBackText').textContent = p.categoryName
    ? `‹ ${p.categoryName} 상품 목록`
    : '‹ 상품 목록';

  // 좌: 이미지 (없으면 emoji)
  const gal = document.getElementById('wdGallery');
  gal.innerHTML = p.image
    ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">`
    : `<span class="wd-emoji">${p.emoji || '📦'}</span>`;

  // 우: 색상 + 가격/스펙
  renderColors();
  calc();

  // 하단 상세 (세로 이미지 + 펼쳐보기)
  renderDetailBody();
}

function renderColors() {
  const p = RD_PRODUCT;
  const wrap = document.getElementById('wdColorWrap');
  const colorsEl = document.getElementById('wdColors');
  if (!wrap || !colorsEl) return;

  // 색상 없으면 영역 숨김
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

// 가격/스펙 계산 — 렌탈은 단순: monthly × contractMonths
function calc() {
  const p = RD_PRODUCT;
  const monthly = p.pricing.monthly || 0;
  const registerFee = p.pricing.registerFee || 0;
  const months = p.contractMonths || 0;

  document.getElementById('wdPrice').innerHTML = monthly
    ? `${monthly.toLocaleString()}<small>원/월</small>`
    : `<span style="font-size:16px;color:var(--text-muted);">상담 시 안내</span>`;

  document.getElementById('wdTotal').innerHTML =
    monthly && months
      ? `총 ${(monthly * months).toLocaleString()}원<br>(${months}개월)`
      : '-';

  // 스펙 그리드
  document.getElementById('wdSpecContract').textContent = months
    ? `${months}개월`
    : '-';
  document.getElementById('wdSpecRegister').innerHTML = registerFee
    ? `${registerFee.toLocaleString()}원`
    : '<span style="color:#8a8a99;font-size:12px;">없음</span>';
  document.getElementById('wdSpecCare').textContent = p.careInterval || '-';
}

// 하단 상세: 상세이미지 세로 나열(쿠팡식) + 텍스트 설명 + 펼쳐보기 토글
// (water-detail.js renderDetailBody 와 완전 동일 패턴)
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

  // 접기 컨테이너(처음 1000px만) + 펼쳐보기 버튼
  body.innerHTML = `
    <div class="wd-collapse" id="wdCollapse">
      ${inner}
      <div class="wd-collapse-fade" id="wdFade"></div>
    </div>
    <button type="button" class="wd-expand-btn" id="wdExpandBtn" onclick="rdToggleDetail()">
      상품정보 펼쳐보기 ▼
    </button>
  `;

  // 콘텐츠가 접힘 높이보다 짧으면 버튼/그라데이션 숨김
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

// 펼쳐보기/접기 토글
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

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// "신청하기" — 3단계 fallback
//   1차: openRentalApply (rental.js 전역 함수가 있다면)
//   2차: DapickApplication.openOnboarding (공통 모듈)
//   3차: 카카오 상담 fallback
function rdApply() {
  const p = RD_PRODUCT;
  const monthly = p.pricing.monthly || 0;

  // 1차: 렌탈 전용 신청 흐름
  if (typeof openRentalApply === 'function') {
    openRentalApply({
      productId: p.id,
      productName: p.name,
      categoryId: p.categoryId,
      categoryName: p.categoryName,
      color: RD_COLOR,
      monthly: monthly,
      contractMonths: p.contractMonths,
    });
    return;
  }

  // 2차: 공통 신청 모달
  if (
    typeof DapickApplication !== 'undefined' &&
    typeof DapickApplication.openOnboarding === 'function'
  ) {
    DapickApplication.openOnboarding({
      category: 'RENTAL',
      productId: p.id,
      productName: p.name,
      meta: {
        categoryName: p.categoryName,
        color: RD_COLOR,
        monthly: monthly,
        contractMonths: p.contractMonths,
      },
    });
    return;
  }

  // 3차: 카카오 fallback
  rdKakao();
}

// 카카오 상담 (선택 컨텍스트 전달)
function rdKakao() {
  const p = RD_PRODUCT;
  const monthly = p.pricing.monthly || 0;

  if (typeof openKakaoConsult === 'function') {
    openKakaoConsult({
      category: '렌탈',
      brand: p.categoryName || '',
      productName: p.name,
      color: RD_COLOR,
      contract: p.contractMonths ? `${p.contractMonths}개월 약정` : '',
      monthly: monthly,
    });
  } else {
    window.open('https://pf.kakao.com/_exaRjX/chat', '_blank');
  }
}

function rdGoBack() {
  location.href = 'rental.html';
}
