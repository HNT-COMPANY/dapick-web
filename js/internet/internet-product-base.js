// ════════════════════════════════════════════════════
// internet-product-base.js v9 — 인터넷·TV 빌더 (아정당식 카드)
// ────────────────────────────────────────────────────
// v9 변경점 (5/30):
//   - 가격 단계화(아정당 우측 패널 구조):
//       결합 전 요금  = Σ normalPrice
//       휴대폰 결합 요금 = Σ bundlePrice(없으면 normalPrice)
//       카드 할인시   = 결합요금 - discountMeta.cardDiscount
//       현금 사은품   = discountMeta.gift (관리자 입력) 표시
//       유무선 결합 할인 = discountMeta.bundleDiscount 표시
//   - 신청 payload 에 finalPrice(카드할인 적용가)·gift·cardDiscount 포함
// ────────────────────────────────────────────────────
// (이하 v8 주석 유지)
//   initFromUrl(): URL ?carrier= 자동 (통합 페이지)  ← 통합은 런칭 후
//   init({provider}): 레거시 6개 페이지
//   백엔드: GET /api/internet-tv-products (전체 활성 → carrier 필터)
//   discountMeta: { gift, cardDiscount, bundleDiscount }
// ════════════════════════════════════════════════════

window.InternetProductBase = (function () {
  'use strict';

  const CARRIER_MAP = {
    SKT: {
      name: 'SKT',
      logo: 'assets/logos/SKTLOGO.png',
      color: '#3617CE',
      hero: '500MB / 1Gbps · 휴대폰 결합 시 추가 할인',
    },
    KT: {
      name: 'KT',
      logo: 'assets/logos/KT.png',
      color: '#E31837',
      hero: '기가 인터넷 안정성 · 지니TV 다양한 채널',
    },
    'LG U+': {
      name: 'LG U+',
      logo: 'assets/logos/LG.png',
      color: '#E5007D',
      hero: '실속있는 가격 · 4K UHD 화질',
    },
    'LG HelloVision': {
      name: 'LG HelloVision',
      logo: 'assets/logos/LGhello.png',
      color: '#7B2D8B',
      hero: '케이블 TV 전문 · 지역 채널 + 합리적 가격',
    },
    'SK broadband': {
      name: 'SK broadband',
      logo: 'assets/logos/SKTLOGO1.png',
      color: '#0078C8',
      hero: '기가 인터넷 + BTv · 스포츠·예능 풍부',
    },
    'KT Skylife': {
      name: 'KT Skylife',
      logo: 'assets/logos/KTSkyLife.png',
      color: '#003087',
      hero: '위성 TV 전문 · HD 화질 + 다양한 채널',
    },
  };

  let _provider = null;
  let _product = null;
  let _internets = [];
  let _tvs = [];
  let _routers = [];
  let _phones = [];
  let _meta = {}; // discountMeta

  let _selectedInternet = null;
  let _selectedTv = null;
  let _selectedRouter = null;
  let _selectedPhone = null;
  let _toggles = { tv: false, router: false, phone: false };

  function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const carrier = params.get('carrier');
    if (!carrier) {
      showError('통신사 정보가 없습니다. 통신사 선택 페이지로 돌아가 주세요.');
      return;
    }
    const meta = CARRIER_MAP[carrier];
    if (!meta)
      console.warn('[InternetProductBase] CARRIER_MAP 미등록:', carrier);
    init({
      provider: {
        key: carrier,
        name: meta ? meta.name : carrier,
        color: meta ? meta.color : '#3617CE',
        logo: meta ? meta.logo : '',
        hero: meta ? meta.hero : '',
      },
    });
  }

  function renderCarrierChrome() {
    if (!_provider) return;
    if (_provider.color) {
      document.documentElement.style.setProperty(
        '--ip-brand-color',
        _provider.color,
      );
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) themeMeta.setAttribute('content', _provider.color);
    }
    const logoImg = document.querySelector('.ip-header-logo img');
    if (logoImg && _provider.logo) {
      logoImg.src = _provider.logo;
      logoImg.alt = _provider.name;
    }
    const heroH1 = document.querySelector('.ip-hero h1');
    if (heroH1)
      heroH1.innerHTML = `${escapeHtml(_provider.name)} 인터넷 사은품<br><em>최대 00만원 + 결합 할인</em>`;
    const heroP = document.querySelector('.ip-hero p');
    if (heroP && _provider.hero) heroP.textContent = _provider.hero;
    document.title = `다픽 ${_provider.name} 인터넷·TV 지원금 | 결합 사은품 비교`;
  }

  function init(config) {
    if (!config || !config.provider) {
      console.error('[InternetProductBase] init: provider 필수');
      return;
    }
    _provider = config.provider;

    window.addEventListener(
      'scroll',
      () => {
        const btn = document.getElementById('scroll-top');
        if (btn) btn.classList.toggle('show', window.scrollY > 300);
      },
      { passive: true },
    );

    const ready = (cb) => {
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', cb);
      else cb();
    };

    ready(async () => {
      renderCarrierChrome();
      try {
        const list = await api.get('/api/internet-tv-products');
        if (!Array.isArray(list) || list.length === 0) {
          showError(
            '상품 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
          );
          return;
        }

        _product = list.find((p) => p.carrier === _provider.key) || null;
        if (!_product) {
          showError(`${_provider.name} 상품이 준비 중입니다.`);
          console.warn(
            '[InternetProductBase] carrier 매칭 없음:',
            _provider.key,
            list.map((p) => p.carrier),
          );
          return;
        }

        _internets = Array.isArray(_product.internetOptions)
          ? _product.internetOptions
          : [];
        _tvs = Array.isArray(_product.tvOptions) ? _product.tvOptions : [];
        _routers = Array.isArray(_product.routerOptions)
          ? _product.routerOptions
          : [];
        _phones = Array.isArray(_product.phoneOptions)
          ? _product.phoneOptions
          : [];
        _meta = _product.discountMeta || {};

        if (_internets.length === 0) {
          showError('인터넷 상품 데이터가 없습니다.');
          return;
        }

        _selectedInternet = _internets[0];

        ensureSections();
        renderInternets();
        renderToggles();
        renderTvOptions();
        renderRouterOptions();
        renderPhoneOptions();
        bindEvents();
        updatePricebar();

        if (
          typeof DapickApplication !== 'undefined' &&
          DapickApplication.resumeIfPending
        )
          DapickApplication.resumeIfPending();
      } catch (e) {
        console.error('[InternetProductBase] 상품 로드 실패:', e);
        showError('상품 정보를 불러오는 중 오류가 발생했습니다.');
      }
    });
  }

  function ensureSections() {
    const tvSection = document.getElementById('ipTvSection');
    if (!tvSection) return;
    if (!document.getElementById('ipRouterSection')) {
      const sec = document.createElement('div');
      sec.className = 'ip-section is-hidden';
      sec.id = 'ipRouterSection';
      sec.innerHTML =
        '<div class="ip-section-label">공유기</div><div class="ip-card-grid" id="ipRouterGrid"></div>';
      tvSection.insertAdjacentElement('afterend', sec);
    }
    if (!document.getElementById('ipPhoneSection')) {
      const sec = document.createElement('div');
      sec.className = 'ip-section is-hidden';
      sec.id = 'ipPhoneSection';
      sec.innerHTML =
        '<div class="ip-section-label">전화</div><div class="ip-card-grid" id="ipPhoneGrid"></div>';
      const anchor = document.getElementById('ipRouterSection') || tvSection;
      anchor.insertAdjacentElement('afterend', sec);
    }
  }

  function parseSpeed(name) {
    const s = String(name ?? '').trim();
    const m = s.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/);
    if (m) return { num: m[1], unit: m[2] || '' };
    return { num: s, unit: '' };
  }
  function parseDesc(desc) {
    const s = String(desc ?? '').trim();
    if (!s) return { grade: '', sub: '' };
    const idx = s.indexOf('|');
    if (idx === -1) return { grade: '', sub: s };
    return { grade: s.slice(0, idx).trim(), sub: s.slice(idx + 1).trim() };
  }

  function priceBlock(opt) {
    const normal = Number(opt.normalPrice || 0);
    const bundle =
      opt.bundlePrice != null && opt.bundlePrice !== ''
        ? Number(opt.bundlePrice)
        : null;
    if (bundle != null && bundle !== normal) {
      return (
        '<div class="ip-opt-price"><span class="ip-opt-price-was">' +
        formatPrice(normal) +
        '원</span><span class="ip-opt-price-prefix">월</span>' +
        formatPrice(bundle) +
        '원</div>'
      );
    }
    return (
      '<div class="ip-opt-price"><span class="ip-opt-price-prefix">월</span>' +
      formatPrice(normal) +
      '원</div>'
    );
  }

  function extrasBundleSum() {
    let sum = 0;
    if (_toggles.tv && _selectedTv) sum += bundleOf(_selectedTv);
    if (_toggles.router && _selectedRouter) sum += bundleOf(_selectedRouter);
    if (_toggles.phone && _selectedPhone) sum += bundleOf(_selectedPhone);
    return sum;
  }

  function renderInternets() {
    const el = document.getElementById('ipInternetGrid');
    if (!el) return;
    const extras = extrasBundleSum();
    el.innerHTML = _internets
      .map((opt) => {
        const isActive = opt === _selectedInternet;
        const { num, unit } = parseSpeed(opt.name);
        const { grade, sub } = parseDesc(opt.desc);
        const total = bundleOf(opt) + extras;
        const priceHtml =
          '<div class="ip-opt-price"><span class="ip-opt-price-prefix">월</span>' +
          formatPrice(total) +
          '원</div>';
        return `
        <button class="ip-opt-card ${isActive ? 'active' : ''}" data-internet="${escapeAttr(opt.name)}" type="button">
          <div class="ip-opt-headline">
            <span class="ip-opt-num">${escapeHtml(num)}</span>
            ${unit ? `<span class="ip-opt-unit">${escapeHtml(unit)}</span>` : ''}
          </div>
          ${grade ? `<div class="ip-opt-grade">${escapeHtml(grade)}</div>` : ''}
          ${sub ? `<div class="ip-opt-tier">${escapeHtml(sub)}</div>` : ''}
          ${priceHtml}
        </button>`;
      })
      .join('');
  }

  function renderToggles() {
    const el = document.getElementById('ipToggles');
    if (!el) return;
    const items = [];
    if (_tvs.length > 0)
      items.push(
        `<label class="ip-toggle-item"><input type="checkbox" data-toggle="tv" ${_toggles.tv ? 'checked' : ''}><span class="ip-toggle-label">TV와 함께</span></label>`,
      );
    if (_routers.length > 0)
      items.push(
        `<label class="ip-toggle-item"><input type="checkbox" data-toggle="router" ${_toggles.router ? 'checked' : ''}><span class="ip-toggle-label">공유기와 함께</span></label>`,
      );
    if (_phones.length > 0)
      items.push(
        `<label class="ip-toggle-item"><input type="checkbox" data-toggle="phone" ${_toggles.phone ? 'checked' : ''}><span class="ip-toggle-label">전화와 함께</span></label>`,
      );
    el.innerHTML = items.join('');
  }

  function renderOptionCards(gridId, list, selected, dataKey, useChannels) {
    const el = document.getElementById(gridId);
    if (!el) return;
    el.innerHTML = list
      .map((o) => {
        const isActive = o === selected;
        const { sub } = parseDesc(o.desc);
        const hasCh = useChannels && o.channels != null && o.channels !== '';
        const head = hasCh
          ? `<span class="ip-opt-num">${escapeHtml(String(o.channels))}</span><span class="ip-opt-unit">채널</span>`
          : `<span class="ip-opt-num ip-opt-num--text">${escapeHtml(o.name)}</span>`;
        return `
        <button class="ip-opt-card ${isActive ? 'active' : ''}" data-${dataKey}="${escapeAttr(o.name)}" type="button">
          <div class="ip-opt-headline">${head}</div>
          ${hasCh && o.name ? `<div class="ip-opt-grade">${escapeHtml(o.name)}</div>` : ''}
          ${sub ? `<div class="ip-opt-tier">${escapeHtml(sub)}</div>` : ''}
          ${priceBlock(o)}
        </button>`;
      })
      .join('');
  }

  function renderTvOptions() {
    renderOptionCards('ipTvGrid', _tvs, _selectedTv, 'tv', true);
  }
  function renderRouterOptions() {
    renderOptionCards(
      'ipRouterGrid',
      _routers,
      _selectedRouter,
      'router',
      false,
    );
  }
  function renderPhoneOptions() {
    renderOptionCards('ipPhoneGrid', _phones, _selectedPhone, 'phone', false);
  }

  function bindEvents() {
    document
      .getElementById('ipInternetGrid')
      ?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-internet]');
        if (!btn) return;
        _selectedInternet =
          _internets.find((o) => o.name === btn.dataset.internet) ||
          _selectedInternet;
        renderInternets();
        updatePricebar();
      });
    document.getElementById('ipTvGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tv]');
      if (!btn) return;
      _selectedTv = _tvs.find((o) => o.name === btn.dataset.tv) || null;
      renderTvOptions();
      updatePricebar();
    });
    const builder = document.querySelector('.ip-builder');
    builder?.addEventListener('click', (e) => {
      const rBtn = e.target.closest('[data-router]');
      if (rBtn) {
        _selectedRouter =
          _routers.find((o) => o.name === rBtn.dataset.router) || null;
        renderRouterOptions();
        updatePricebar();
        return;
      }
      const pBtn = e.target.closest('[data-phone]');
      if (pBtn) {
        _selectedPhone =
          _phones.find((o) => o.name === pBtn.dataset.phone) || null;
        renderPhoneOptions();
        updatePricebar();
      }
    });
    document.getElementById('ipToggles')?.addEventListener('change', (e) => {
      const input = e.target.closest('[data-toggle]');
      if (!input || input.disabled) return;
      const key = input.dataset.toggle;
      if (key === 'tv') {
        _toggles.tv = input.checked;
        toggleSection('ipTvSection', input.checked);
        if (input.checked) {
          if (!_selectedTv && _tvs.length) {
            _selectedTv = _tvs[0];
            renderTvOptions();
          }
        } else {
          _selectedTv = null;
          renderTvOptions();
        }
      } else if (key === 'router') {
        _toggles.router = input.checked;
        toggleSection('ipRouterSection', input.checked);
        if (input.checked) {
          if (!_selectedRouter && _routers.length) {
            _selectedRouter = _routers[0];
            renderRouterOptions();
          }
        } else {
          _selectedRouter = null;
          renderRouterOptions();
        }
      } else if (key === 'phone') {
        _toggles.phone = input.checked;
        toggleSection('ipPhoneSection', input.checked);
        if (input.checked) {
          if (!_selectedPhone && _phones.length) {
            _selectedPhone = _phones[0];
            renderPhoneOptions();
          }
        } else {
          _selectedPhone = null;
          renderPhoneOptions();
        }
      }
      updatePricebar();
    });
    document
      .getElementById('ipApplyBtn')
      ?.addEventListener('click', applyConsult);
  }

  function toggleSection(id, show) {
    const sec = document.getElementById(id);
    if (sec) sec.classList.toggle('is-hidden', !show);
  }

  function bundleOf(opt) {
    if (!opt) return 0;
    const normal = Number(opt.normalPrice || 0);
    const bundle =
      opt.bundlePrice != null && opt.bundlePrice !== ''
        ? Number(opt.bundlePrice)
        : null;
    return bundle != null ? bundle : normal;
  }
  function normalOf(opt) {
    return opt ? Number(opt.normalPrice || 0) : 0;
  }

  // ── 가격 계산 (v9: 카드할인 단계 추가) ──────────────
  function calculate() {
    const it = _selectedInternet;
    if (!it)
      return {
        basePrice: 0,
        bundlePrice: 0,
        cardPrice: 0,
        finalPrice: 0,
        cardDiscount: 0,
        gift: 0,
        bundleDiscount: 0,
      };

    let base = normalOf(it);
    let combo = bundleOf(it);
    if (_toggles.tv && _selectedTv) {
      base += normalOf(_selectedTv);
      combo += bundleOf(_selectedTv);
    }
    if (_toggles.router && _selectedRouter) {
      base += normalOf(_selectedRouter);
      combo += bundleOf(_selectedRouter);
    }
    if (_toggles.phone && _selectedPhone) {
      base += normalOf(_selectedPhone);
      combo += bundleOf(_selectedPhone);
    }

    const cardDiscount = Number(_meta.cardDiscount || 0);
    const gift = Number(_meta.gift || 0);
    const bundleDiscount = Number(_meta.bundleDiscount || 0);
    // 최종 혜택가 = 휴대폰 결합 요금 - 유무선 결합 할인 - 카드 할인
    const cardPrice = Math.max(0, combo - bundleDiscount - cardDiscount);

    return {
      basePrice: base, // 결합 전 요금
      bundlePrice: combo, // 휴대폰 결합 요금
      cardPrice: cardPrice, // 유무선+카드 할인 적용 (최종)
      finalPrice: cardPrice, // 신청에 넘길 최종가
      cardDiscount: cardDiscount,
      gift: gift,
      bundleDiscount: bundleDiscount,
    };
  }

  function updatePricebar() {
    refreshInternetPrices();
    const calc = calculate();
    setText('ipPbBase', `${formatPrice(calc.basePrice)}원`);
    setText('ipPbPhoneCombo', `${formatPrice(calc.bundlePrice)}원`);
    setText('ipPbFinal', formatPrice(calc.finalPrice));

    // 사은품 표시 (관리자 입력값)
    const giftEl = document.getElementById('ipPbGift');
    if (giftEl) {
      giftEl.textContent =
        calc.gift > 0 ? `${formatPrice(calc.gift)}원` : '상담 시 안내';
    }

    // 할인 힌트 (유무선 + 카드 할인 내역)
    const hint = document.getElementById('ipSettopHint');
    if (hint) {
      const bits = [];
      if (calc.bundleDiscount > 0)
        bits.push(`유무선 결합 -${formatPrice(calc.bundleDiscount)}원`);
      if (calc.cardDiscount > 0)
        bits.push(`카드 할인 -${formatPrice(calc.cardDiscount)}원`);
      hint.textContent = bits.length ? bits.join(' · ') + ' 적용' : '';
    }

    const btn = document.getElementById('ipApplyBtn');
    if (btn) btn.disabled = !_selectedInternet;
  }

  function refreshInternetPrices() {
    const grid = document.getElementById('ipInternetGrid');
    if (!grid) return;
    const extras = extrasBundleSum();
    grid.querySelectorAll('[data-internet]').forEach((card) => {
      const opt = _internets.find((o) => o.name === card.dataset.internet);
      if (!opt) return;
      const total = bundleOf(opt) + extras;
      const priceEl = card.querySelector('.ip-opt-price');
      if (priceEl)
        priceEl.innerHTML =
          '<span class="ip-opt-price-prefix">월</span>' +
          formatPrice(total) +
          '원';
    });
  }

  function applyConsult() {
    const calc = calculate();
    if (!_selectedInternet) {
      alert('인터넷 상품을 선택해주세요.');
      return;
    }
    if (typeof DapickApplication === 'undefined') {
      console.error('[InternetProductBase] DapickApplication 미로드');
      alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    const tvName = _toggles.tv && _selectedTv ? _selectedTv.name : '미사용';
    const routerName =
      _toggles.router && _selectedRouter ? _selectedRouter.name : '미사용';
    const phoneName =
      _toggles.phone && _selectedPhone ? _selectedPhone.name : '미사용';

    const selectedOptions = {
      통신사: _provider.name,
      인터넷상품: _selectedInternet?.name || '',
      TV: tvName,
      공유기: routerName,
      전화: phoneName,
      결합전요금: calc.basePrice,
      휴대폰결합요금: calc.bundlePrice,
      카드할인적용가: calc.cardPrice,
      현금사은품: calc.gift,
    };

    const nameParts = [_provider.name, _selectedInternet?.name || ''];
    if (_toggles.tv && _selectedTv) nameParts.push('+ ' + _selectedTv.name);
    if (_toggles.router && _selectedRouter)
      nameParts.push('+ ' + _selectedRouter.name);
    if (_toggles.phone && _selectedPhone)
      nameParts.push('+ ' + _selectedPhone.name);

    DapickApplication.apply({
      category: 'INTERNET_TV',
      productId: _product.id,
      productName: nameParts.join(' '),
      brand: _provider.key,
      selectedOptions,
      monthlyPrice: calc.finalPrice,
    });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function formatPrice(n) {
    return Number(n || 0).toLocaleString('ko-KR');
  }
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
  function showError(msg) {
    const builder = document.querySelector('.ip-builder');
    if (builder)
      builder.innerHTML = `<div class="ip-error" style="padding:40px 16px;text-align:center;color:#a00;">${escapeHtml(msg)}</div>`;
    const btn = document.getElementById('ipApplyBtn');
    if (btn) btn.disabled = true;
  }
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

  return { init, initFromUrl, goPage };
})();

function goPage(page) {
  InternetProductBase.goPage(page);
}
