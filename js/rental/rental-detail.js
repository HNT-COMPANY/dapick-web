// ════════════════════════════════════════════════════
// rental-detail.js — 렌탈 상세 페이지
// ────────────────────────────────────────────────────
// ?id={상품UUID} 로 진입 → /api/rental-products/{id} 조회
// 우 패널: 색상 선택 + 가격/스펙 표시 (정수기와 달리 약정/주기/타사보상 옵션 없음)
//
// [5/29 신청 흐름 통합]
//   - rdApply() 의 카카오 fallback 제거
//   - rental.html 의 신청 폼 모달(#rApplyOverlay)을 이 페이지에 복제
//   - rental.js 의 submitApplication 로직을 이식 (자기완결)
//   - 토큰 키는 dapick_token → accessToken fallback (소비자 키 불일치 대비)
//
// 5/29: detailImages 세로 나열 + 펼쳐보기 토글 (정수기와 동일 패턴)
//
// ※ 의존:
//   - water-detail.css (wd-* 클래스 그대로 사용)
//   - rental.css (신청 폼 모달 .r-apply-* 스타일)
//   - common/config.js (DAPICK_CONFIG.API_BASE_URL)
//   - rental.js 불필요
// ════════════════════════════════════════════════════

let RD_PRODUCT = null;
let RD_COLOR = '';

// API_BASE — config.js 의 DAPICK_CONFIG 우선, 없으면 도메인 분기
const RD_API_BASE =
  typeof DAPICK_CONFIG !== 'undefined' && DAPICK_CONFIG.API_BASE_URL
    ? DAPICK_CONFIG.API_BASE_URL
    : typeof BASE_URL !== 'undefined' && BASE_URL
      ? BASE_URL
      : 'https://api.dapick.co.kr';

const RD_KAKAO_URL = 'https://pf.kakao.com/_exaRjX/chat';

document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    showStatus('상품 정보가 없습니다.');
    return;
  }
  loadDetail(id);
});

function showStatus(msg) {
  const el = document.getElementById('wdRoot');
  if (el) el.innerHTML = `<div class="wd-status">${msg}</div>`;
}

// 소비자 토큰: dapick_token 우선, 없으면 accessToken (키 불일치 대비)
function rdGetToken() {
  return (
    localStorage.getItem('dapick_token') ||
    localStorage.getItem('accessToken') ||
    ''
  );
}

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

  const gal = document.getElementById('wdGallery');
  gal.innerHTML = p.image
    ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">`
    : `<span class="wd-emoji">${p.emoji || '📦'}</span>`;

  renderColors();
  calc();
  renderDetailBody();
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

  document.getElementById('wdSpecContract').textContent = months
    ? `${months}개월`
    : '-';
  document.getElementById('wdSpecRegister').innerHTML = registerFee
    ? `${registerFee.toLocaleString()}원`
    : '<span style="color:#8a8a99;font-size:12px;">없음</span>';
  document.getElementById('wdSpecCare').textContent = p.careInterval || '-';
}

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

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function won(n) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Number(n).toLocaleString('ko-KR') + '원';
}

// ════════════════════════════════════════════════════
// [5/29 신청 흐름 통합] — rental.js 에서 이식한 자체 신청 폼
// ════════════════════════════════════════════════════

// "신청하기" → 카카오 fallback 제거. 바로 상담 신청 모달.
function rdApply() {
  openApplyForm();
}

window.openApplyForm = function () {
  if (!RD_PRODUCT || !RD_PRODUCT.id) {
    alert('상품 정보가 올바르지 않습니다. 다시 시도해주세요.');
    return;
  }

  // 로그인 가드 (auth.js 의 isLoggedIn 사용 가능 시)
  if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
    alert(
      '상담 신청은 로그인 후 이용할 수 있어요. 로그인 페이지로 이동합니다.',
    );
    const btn = document.querySelector('.btn-login');
    if (btn) {
      btn.click();
    } else {
      window.location.href = 'index.html';
    }
    return;
  }

  document.getElementById('rApplyStepForm').style.display = 'block';
  document.getElementById('rApplyStepDone').style.display = 'none';
  document.getElementById('rApplyErr').textContent = '';

  const m = RD_PRODUCT.pricing.monthly || 0;
  document.getElementById('rApplyProd').innerHTML =
    '신청 상품: <b>' +
    escapeHtml(RD_PRODUCT.name) +
    '</b>' +
    (m ? ' · 월 ' + won(m) : '') +
    (RD_COLOR ? ' · ' + escapeHtml(RD_COLOR) : '');

  document.getElementById('rApplyOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.closeApplyForm = function () {
  document.getElementById('rApplyOverlay').classList.remove('show');
  document.body.style.overflow = '';
};

window.closeApplyOutside = function (e) {
  if (e.target === document.getElementById('rApplyOverlay'))
    window.closeApplyForm();
};

window.submitApplication = function () {
  const errEl = document.getElementById('rApplyErr');
  errEl.textContent = '';

  const name = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const bank = document.getElementById('fBank').value.trim();
  const addr = document.getElementById('fAddr').value.trim();
  const memo = document.getElementById('fMemo').value.trim();
  const agreePrivacy = document.getElementById('fPrivacy').checked;
  const agreeWarning = document.getElementById('fWarning').checked;
  const agreeMarketing = document.getElementById('fMarketing').checked;
  const agreeEmailInfo = document.getElementById('fEmailInfo').checked;

  if (!name) {
    errEl.textContent = '신청자 이름을 입력해주세요.';
    return;
  }
  if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
    errEl.textContent = '올바른 휴대폰 번호를 입력해주세요.';
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = '올바른 이메일을 입력해주세요.';
    return;
  }
  if (!bank) {
    errEl.textContent = '지원금 입금받을 계좌를 입력해주세요.';
    return;
  }
  if (!agreePrivacy) {
    errEl.textContent = '개인정보 처리방침 동의는 필수입니다.';
    return;
  }
  if (!agreeWarning) {
    errEl.textContent = '주의사항 확인은 필수입니다.';
    return;
  }

  if (!RD_PRODUCT || !RD_PRODUCT.id) {
    errEl.textContent = '상품 정보가 올바르지 않습니다. 다시 시도해주세요.';
    return;
  }

  const token = rdGetToken();
  if (!token) {
    errEl.textContent = '로그인이 필요합니다.';
    return;
  }

  const monthly = RD_PRODUCT.pricing.monthly || 0;
  if (!monthly || isNaN(monthly) || Number(monthly) <= 0) {
    errEl.textContent =
      '이 상품은 월 요금이 설정되어 있지 않아 온라인 신청이 어렵습니다. 카카오 상담을 이용해주세요.';
    return;
  }

  const selectedOptions = {};
  if (RD_COLOR) selectedOptions.color = RD_COLOR;
  if (memo) selectedOptions.inquiry = memo;

  const payload = {
    productId: RD_PRODUCT.id,
    selectedOptions: selectedOptions,
    monthlyPrice: Number(monthly),
    applicantName: name,
    applicantPhone: phone,
    applicantEmail: email,
    bankAccount: bank,
    zipcode: null,
    address: addr || null,
    agreePrivacy: true,
    agreeMarketing: agreeMarketing,
    agreeEmailInfo: agreeEmailInfo,
  };

  const submitBtn = document.getElementById('rApplySubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = '신청 중...';

  fetch(RD_API_BASE + '/api/consultations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  })
    .then((r) =>
      r.json().then((body) => ({ ok: r.ok, status: r.status, body })),
    )
    .then((res) => {
      submitBtn.disabled = false;
      submitBtn.textContent = '상담 신청하기';

      const data = res.body && res.body.data ? res.body.data : null;
      const num = data ? data.consultationNumber : '';

      if (res.ok && num) {
        document.getElementById('rDoneNum').textContent = num;
        document.getElementById('rApplyStepForm').style.display = 'none';
        document.getElementById('rApplyStepDone').style.display = 'block';
      } else {
        let msg =
          res.body && res.body.message
            ? res.body.message
            : '신청에 실패했습니다. 잠시 후 다시 시도해주세요.';
        if (res.status === 401)
          msg = '로그인이 만료되었습니다. 다시 로그인해주세요.';
        errEl.textContent = msg;
      }
    })
    .catch((e) => {
      console.error('[rental-detail] submit failed', e);
      submitBtn.disabled = false;
      submitBtn.textContent = '상담 신청하기';
      errEl.textContent =
        '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    });
};

// 카카오 상담 (보조 버튼)
function rdKakao() {
  window.open(RD_KAKAO_URL, '_blank');
}

function rdGoBack() {
  location.href = 'rental.html';
}
