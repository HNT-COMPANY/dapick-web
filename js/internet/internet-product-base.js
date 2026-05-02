// ════════════════════════════════════════════════════
// internet-product-base.js — 통신사별 페이지 공통 모듈
// ────────────────────────────────────────────────────
// 사용: js/internet/internet-{provider}.js 에서
//      InternetProductBase.init({ provider, product })
// 컨셉: 아정당 패턴 (인라인 옵션 + 하단 가격 박스 + 단일 신청 버튼)
// 백엔드: POST /api/consultations 호출 → consultationNumber 받아서 success 페이지
// ════════════════════════════════════════════════════

window.InternetProductBase = (function () {
  'use strict';

  // ── 상태 ────────────────────────────────────────
  let _provider = null; // { key, name, code, logo, color }
  let _product = null; // { speeds, tvOptions, routerPrice, phonePrice, phoneComboDiscount, cardDiscount, contracts }

  // 사용자 선택 상태
  let _selectedSpeed = null; // speed.code
  let _selectedTv = null; // tv.code
  let _options = {
    // 토글 5개
    router: false,
    tv: false,
    phone: false,
    phoneCombo: false,
    cardDiscount: false,
  };
  let _contractMonths = null; // 12 / 24 / 36

  // ════════════════════════════════════════════════════
  // 초기화
  // ════════════════════════════════════════════════════
  function init(config) {
    _provider = config.provider;
    _product = config.product;

    // 기본값 (추천 속도 / 추천 약정)
    const defaultSpeed =
      _product.speeds.find((s) => s.isRecommend) || _product.speeds[0];
    const defaultContract =
      _product.contracts.find((c) => c.isRecommend) || _product.contracts[0];
    _selectedSpeed = defaultSpeed.code;
    _contractMonths = defaultContract.months;

    document.addEventListener('DOMContentLoaded', () => {
      renderSpeeds();
      renderTvOptions();
      renderToggles();
      renderContracts();
      bindEvents();
      updatePricebar();

      // 신청 후 자동 복귀 (비로그인 → 로그인 → 자동 신청 진행)
      if (
        typeof DapickApplication !== 'undefined' &&
        DapickApplication.resumeIfPending
      ) {
        DapickApplication.resumeIfPending();
      }
    });

    window.addEventListener(
      'scroll',
      () => {
        const btn = document.getElementById('scroll-top');
        if (btn) btn.classList.toggle('show', window.scrollY > 300);
      },
      { passive: true },
    );
  }

  // ════════════════════════════════════════════════════
  // 1. 속도 카드 렌더
  // ════════════════════════════════════════════════════
  function renderSpeeds() {
    const el = document.getElementById('ipSpeedGrid');
    if (!el || !_product.speeds) return;

    el.innerHTML = _product.speeds
      .map(
        (s) => `
      <button class="ip-opt-card ${s.code === _selectedSpeed ? 'active' : ''}"
              data-speed="${s.code}" type="button">
        ${s.isRecommend ? '<span class="ip-opt-recommend">추천</span>' : ''}
        <div class="ip-opt-headline">
          <span class="ip-opt-num">${s.label}</span>
          <span class="ip-opt-unit">${s.unit || ''}</span>
        </div>
        <div class="ip-opt-tier">${s.tier || ''}</div>
        <div class="ip-opt-desc">${s.desc || ''}</div>
        <div class="ip-opt-price">
          <span class="ip-opt-price-prefix">월</span>${formatPrice(s.basePrice)}원
        </div>
      </button>
    `,
      )
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 2. TV 채널 카드 렌더 (TV 토글 ON 시 노출)
  // ════════════════════════════════════════════════════
  function renderTvOptions() {
    const el = document.getElementById('ipTvGrid');
    if (!el || !_product.tvOptions) return;

    el.innerHTML = _product.tvOptions
      .map(
        (t) => `
      <button class="ip-opt-card ${t.code === _selectedTv ? 'active' : ''}"
              data-tv="${t.code}" type="button">
        <div class="ip-opt-headline">
          <span class="ip-opt-num">${t.channels}</span>
          <span class="ip-opt-unit">채널</span>
        </div>
        <div class="ip-opt-tier">${t.tier || ''}</div>
        <div class="ip-opt-desc">${t.desc || ''}</div>
        <div class="ip-opt-price">
          <span class="ip-opt-price-prefix">월</span>${formatPrice(t.addPrice)}원
        </div>
      </button>
    `,
      )
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 3. 부가 옵션 토글 렌더 (5개)
  // ════════════════════════════════════════════════════
  function renderToggles() {
    const el = document.getElementById('ipToggles');
    if (!el) return;

    const items = [
      { key: 'router', label: '공유기와 함께', price: _product.routerPrice },
      { key: 'tv', label: 'TV와 함께', price: null },
      { key: 'phone', label: '전화와 함께', price: _product.phonePrice },
      { key: 'phoneCombo', label: '휴대폰 결합', price: null },
      { key: 'cardDiscount', label: '카드할인', price: null },
    ];

    el.innerHTML = items
      .map((item) => {
        const priceText = item.price
          ? ` (월 +${formatPrice(item.price)}원)`
          : '';
        return `
        <label class="ip-toggle-item">
          <input type="checkbox" data-toggle="${item.key}" ${_options[item.key] ? 'checked' : ''}>
          <span class="ip-toggle-label">${item.label}${priceText}</span>
        </label>`;
      })
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 4. 약정 칩 렌더
  // ════════════════════════════════════════════════════
  function renderContracts() {
    const el = document.getElementById('ipContracts');
    if (!el || !_product.contracts) return;

    el.innerHTML = _product.contracts
      .map(
        (c) => `
      <button class="ip-chip ${c.months === _contractMonths ? 'active' : ''}"
              data-months="${c.months}" type="button">
        ${c.months}개월
      </button>
    `,
      )
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 이벤트 바인딩
  // ════════════════════════════════════════════════════
  function bindEvents() {
    // 속도 카드
    document.getElementById('ipSpeedGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-speed]');
      if (!btn) return;
      _selectedSpeed = btn.dataset.speed;
      renderSpeeds();
      updatePricebar();
    });

    // TV 카드
    document.getElementById('ipTvGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tv]');
      if (!btn) return;
      _selectedTv = btn.dataset.tv;
      renderTvOptions();
      updatePricebar();
    });

    // 토글
    document.getElementById('ipToggles')?.addEventListener('change', (e) => {
      const input = e.target.closest('[data-toggle]');
      if (!input) return;
      const key = input.dataset.toggle;
      _options[key] = input.checked;

      // TV 토글 = TV 섹션 노출/숨김
      if (key === 'tv') {
        const tvSection = document.getElementById('ipTvSection');
        if (tvSection) tvSection.classList.toggle('is-hidden', !input.checked);

        // TV 해제 시 선택 초기화
        if (!input.checked) {
          _selectedTv = null;
          renderTvOptions();
        } else if (
          !_selectedTv &&
          _product.tvOptions &&
          _product.tvOptions.length > 0
        ) {
          // TV 첫 진입 시 추천 또는 첫 옵션 자동 선택
          const recTv =
            _product.tvOptions.find((t) => t.isRecommend) ||
            _product.tvOptions[0];
          _selectedTv = recTv.code;
          renderTvOptions();
        }
      }

      updatePricebar();
    });

    // 약정 칩
    document.getElementById('ipContracts')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-months]');
      if (!btn) return;
      _contractMonths = parseInt(btn.dataset.months, 10);
      renderContracts();
      updatePricebar();
    });

    // 신청 버튼
    document
      .getElementById('ipApplyBtn')
      ?.addEventListener('click', applyConsult);
  }

  // ════════════════════════════════════════════════════
  // 5. 가격 계산 + 하단 박스 갱신
  // ════════════════════════════════════════════════════
  function calculate() {
    const speed = _product.speeds.find((s) => s.code === _selectedSpeed);
    const tv =
      _options.tv && _selectedTv
        ? _product.tvOptions.find((t) => t.code === _selectedTv)
        : null;
    const contract =
      _product.contracts.find((c) => c.months === _contractMonths) ||
      _product.contracts[0];

    // 기본 요금 = 속도 + (TV) + (공유기) + (전화)
    let basePrice = speed ? speed.basePrice : 0;
    if (tv) basePrice += tv.addPrice;
    if (_options.router && _product.routerPrice)
      basePrice += _product.routerPrice;
    if (_options.phone && _product.phonePrice) basePrice += _product.phonePrice;

    // 약정 할인 (있으면)
    if (contract && contract.discount) {
      basePrice -= contract.discount;
    }

    // 휴대폰 결합 할인
    let phoneComboPrice = basePrice;
    if (_options.phoneCombo && _product.phoneComboDiscount) {
      phoneComboPrice -= _product.phoneComboDiscount;
    }

    // 카드할인
    let finalPrice = phoneComboPrice;
    if (_options.cardDiscount && _product.cardDiscount) {
      finalPrice -= _product.cardDiscount;
    }

    if (basePrice < 0) basePrice = 0;
    if (phoneComboPrice < 0) phoneComboPrice = 0;
    if (finalPrice < 0) finalPrice = 0;

    return {
      basePrice,
      phoneComboPrice,
      finalPrice,
      gift: contract ? contract.gift : 0,
      contract,
      speed,
      tv,
    };
  }

  function updatePricebar() {
    const calc = calculate();

    setText('ipPbBase', `${formatPrice(calc.basePrice)}원`);
    setText('ipPbPhoneCombo', `${formatPrice(calc.phoneComboPrice)}원`);
    setText('ipPbFinal', formatPrice(calc.finalPrice));
    setText('ipPbGift', `${formatGift(calc.gift)}`);

    // 휴대폰결합 행 표시 여부
    const phoneRow = document.getElementById('ipPbPhoneComboRow');
    if (phoneRow) phoneRow.style.display = _options.phoneCombo ? '' : 'none';

    // 신청 버튼 활성화 (속도 + 약정 선택 시)
    const btn = document.getElementById('ipApplyBtn');
    if (btn) btn.disabled = !(_selectedSpeed && _contractMonths);
  }

  // ════════════════════════════════════════════════════
  // 6. 신청하기 (DapickApplication.apply)
  //    - 비로그인: sessionStorage 저장 + 로그인 페이지 이동 + 자동 복귀
  //    - 로그인: POST /api/consultations → consultationNumber 받음 → success 페이지
  // ════════════════════════════════════════════════════
  function applyConsult() {
    const calc = calculate();
    if (!calc.speed || !calc.contract) {
      alert('상품 정보를 다시 확인해주세요.');
      return;
    }

    if (typeof DapickApplication === 'undefined') {
      console.error('[InternetProductBase] DapickApplication 미로드');
      alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 선택 옵션 요약
    const selectedOptions = {
      통신사: _provider.name,
      인터넷속도: `${calc.speed.label}${calc.speed.unit || ''}`,
      약정: `${calc.contract.months}개월`,
      공유기: _options.router ? '함께' : '미사용',
      TV:
        _options.tv && calc.tv
          ? `${calc.tv.channels}채널 (${calc.tv.tier || ''})`
          : '미사용',
      전화: _options.phone ? '함께' : '미사용',
      휴대폰결합: _options.phoneCombo ? '적용' : '미적용',
      카드할인: _options.cardDiscount ? '적용' : '미적용',
    };

    DapickApplication.apply({
      category: 'INTERNET_TV',
      productId: _product.productId,
      productName: `${_provider.name} ${calc.speed.label}${calc.speed.unit || ''}`,
      brand: _provider.key,
      selectedOptions,
      monthlyPrice: calc.finalPrice,
    });
  }

  // ════════════════════════════════════════════════════
  // 유틸
  // ════════════════════════════════════════════════════
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatPrice(n) {
    return Number(n || 0).toLocaleString('ko-KR');
  }

  function formatGift(amount) {
    if (!amount) return '0원';
    if (amount >= 10000) return `${Math.floor(amount / 10000)}만원 + 추가혜택`;
    return `${formatPrice(amount)}원`;
  }

  // ════════════════════════════════════════════════════
  // 페이지 이동 (NAV 카테고리 클릭에서 사용)
  // ════════════════════════════════════════════════════
  function goPage(page) {
    const map = {
      mobile: 'mobile.html',
      internet: 'internet.html',
      card: 'card.html',
      water: 'water.html',
      rental: 'rental.html',
    };
    window.location.href = map[page] || 'index.html';
  }

  // ════════════════════════════════════════════════════
  // 공개 API
  // ════════════════════════════════════════════════════
  return {
    init,
    goPage,
  };
})();

// 전역 goPage (NAV 카테고리 클릭에서 사용)
function goPage(page) {
  InternetProductBase.goPage(page);
}
