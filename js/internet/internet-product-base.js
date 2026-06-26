// ════════════════════════════════════════════════════
// internet-product-base.js v10 — 인터넷·TV 빌더 (아정당식 카드)
// ────────────────────────────────────────────────────
// v10 변경점 (6/17):
//   - 지원금(gift/cardDiscount/bundleDiscount) 출처를 "선택된 인터넷 옵션 우선,
//     없으면 상품 discountMeta 폴백"으로 변경 (calculate). 계산식 자체는 v9 그대로.
//     → 속도 옵션마다 다른 지원금 표시 가능. 기존 상품(옵션 지원금 없음)은 폴백으로 유지.
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
  let _setTops = [];
  let _routers = [];
  let _phones = [];
  let _meta = {}; // discountMeta

  let _selectedInternet = null;
  let _selectedTv = null;
  let _selectedSetTop = null;
  let _selectedRouter = null;
  let _selectedPhone = null;
  let _toggles = { tv: false, router: false, phone: false };
  let _scrollBound = false; // 통합 페이지 carrier 전환 시 scroll 리스너 중복 등록 방지
  let _initSeq = 0; // init 세대 토큰 — carrier 전환 시 stale 콜백 폐기용
  let _builderSkeleton = null; // 최초 pristine .ip-builder 골격 (showError 파괴 후 복원용)

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
    // 최초 1회: pristine .ip-builder 골격 캡처 (어떤 렌더/showError보다 먼저)
    if (_builderSkeleton == null) {
      const b0 = document.querySelector('.ip-builder');
      if (b0) _builderSkeleton = b0.innerHTML;
    }

    _provider = config.provider; // 전역 유지(applyConsult 등 콜백 외부 참조용)
    const provider = config.provider; // 이번 init 콜백이 볼 carrier (지역 캡처)
    const mySeq = ++_initSeq; // 이번 init의 세대 번호

    if (!_scrollBound) {
      _scrollBound = true;
      window.addEventListener(
        'scroll',
        () => {
          const btn = document.getElementById('scroll-top');
          if (btn) btn.classList.toggle('show', window.scrollY > 300);
        },
        { passive: true },
      );
    }

    const ready = (cb) => {
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', cb);
      else cb();
    };

    ready(async () => {
      renderCarrierChrome();
      try {
        const list = await api.get('/api/internet-tv-products');
        if (mySeq !== _initSeq) return; // 더 새 init이 시작됨 → 이 콜백 폐기(stale)
        if (!Array.isArray(list) || list.length === 0) {
          showError(
            '상품 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
          );
          return;
        }

        _product = list.find((p) => p.carrier === provider.key) || null;
        if (!_product) {
          showError(`${provider.name} 상품이 준비 중입니다.`);
          console.warn(
            '[InternetProductBase] carrier 매칭 없음:',
            provider.key,
            list.map((p) => p.carrier),
          );
          return;
        }

        _internets = Array.isArray(_product.internetOptions)
          ? _product.internetOptions
          : [];
        _tvs = Array.isArray(_product.tvOptions) ? _product.tvOptions : [];
        _setTops = Array.isArray(_product.setTopOptions)
          ? _product.setTopOptions
          : [];
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

        // 이전 showError가 .ip-builder 골격을 파괴했으면 캡처본으로 복원 후 렌더
        const builderEl = document.querySelector('.ip-builder');
        if (
          builderEl &&
          !document.getElementById('ipInternetGrid') &&
          _builderSkeleton != null
        ) {
          builderEl.innerHTML = _builderSkeleton;
        }

        ensureSections();
        renderInternets();
        renderToggles();
        renderTvOptions();
        renderSetTopOptions();
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
        if (mySeq !== _initSeq) return; // stale 콜백은 에러도 표시하지 않음
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
    // 셋탑 섹션 — TV 종속. TV 섹션 바로 뒤(afterend)에 삽입 → [TV][셋탑][공유기][전화] 순.
    if (!document.getElementById('ipSetTopSection')) {
      const sec = document.createElement('div');
      sec.className = 'ip-section is-hidden';
      sec.id = 'ipSetTopSection';
      sec.innerHTML =
        '<div class="ip-section-label">셋탑</div><div class="ip-card-grid" id="ipSetTopGrid"></div>';
      tvSection.insertAdjacentElement('afterend', sec);
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
    return InternetCalc.extrasBundleSum({
      tv: _selectedTv,
      router: _selectedRouter,
      phone: _selectedPhone,
      toggles: _toggles,
    });
  }

  function renderInternets() {
    const el = document.getElementById('ipInternetGrid');
    if (!el) return;
    el.innerHTML = _internets
      .map((opt) => {
        const isActive = opt === _selectedInternet;
        const { num, unit } = parseSpeed(opt.name);
        const { grade, sub } = parseDesc(opt.desc);
        // 카드 가격은 인터넷 속도 결합가만 고정 표시 (옵션 합산은 하단바 월요금에서만)
        const total = bundleOf(opt);
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
    // 표시 순서: 공유기 → TV → 전화 (TV-셋탑 종속 로직은 순서와 무관하게 유지)
    if (_routers.length > 0)
      items.push(
        `<label class="ip-toggle-item"><input type="checkbox" data-toggle="router" ${_toggles.router ? 'checked' : ''}><span class="ip-toggle-label">공유기와 함께</span></label>`,
      );
    if (_tvs.length > 0)
      items.push(
        `<label class="ip-toggle-item"><input type="checkbox" data-toggle="tv" ${_toggles.tv ? 'checked' : ''}><span class="ip-toggle-label">TV와 함께</span></label>`,
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
        // 채널형(TV): 큰 채널수 헤드라인 + 이름(grade). 비채널형(공유기/셋탑): 헤드라인 없이
        // 이름을 grade 위치(TV형 위계)에 두고 설명·가격은 동일.
        const head = hasCh
          ? `<span class="ip-opt-num">${escapeHtml(String(o.channels))}</span><span class="ip-opt-unit">채널</span>`
          : '';
        return `
        <button class="ip-opt-card ${isActive ? 'active' : ''}" data-${dataKey}="${escapeAttr(o.name)}" type="button">
          ${head ? `<div class="ip-opt-headline">${head}</div>` : ''}
          ${o.name ? `<div class="ip-opt-grade">${escapeHtml(o.name)}</div>` : ''}
          ${sub ? `<div class="ip-opt-tier">${escapeHtml(sub)}</div>` : ''}
          ${priceBlock(o)}
        </button>`;
      })
      .join('');
  }

  function renderTvOptions() {
    renderOptionCards('ipTvGrid', _tvs, _selectedTv, 'tv', true);
  }
  function renderSetTopOptions() {
    renderOptionCards(
      'ipSetTopGrid',
      _setTops,
      _selectedSetTop,
      'settop',
      false,
    );
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
      // TV 선택 시 셋탑 섹션 노출 보장 + 첫 셋탑 자동선택 (TV 종속)
      if (_selectedTv) {
        toggleSection('ipSetTopSection', true);
        if (!_selectedSetTop && _setTops.length) _selectedSetTop = _setTops[0];
        renderSetTopOptions();
      }
      updatePricebar();
    });
    document.getElementById('ipSetTopGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-settop]');
      if (!btn) return;
      _selectedSetTop =
        _setTops.find((o) => o.name === btn.dataset.settop) || null;
      renderSetTopOptions();
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
        toggleSection('ipSetTopSection', input.checked);
        if (input.checked) {
          // 켤 때: TV→셋탑 묶음을 맨 아래로 (append 순서대로 TV 다음 셋탑)
          moveSectionToEnd('ipTvSection');
          moveSectionToEnd('ipSetTopSection');
          if (!_selectedTv && _tvs.length) {
            _selectedTv = _tvs[0];
            renderTvOptions();
          }
          // 셋탑은 TV 종속 — TV 켜질 때 첫 셋탑 자동선택
          if (!_selectedSetTop && _setTops.length) {
            _selectedSetTop = _setTops[0];
          }
          renderSetTopOptions();
        } else {
          _selectedTv = null;
          renderTvOptions();
          _selectedSetTop = null;
          renderSetTopOptions();
        }
      } else if (key === 'router') {
        _toggles.router = input.checked;
        toggleSection('ipRouterSection', input.checked);
        if (input.checked) {
          moveSectionToEnd('ipRouterSection');
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
          moveSectionToEnd('ipPhoneSection');
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
    document
      .getElementById('ipDetailBtn')
      ?.addEventListener('click', goDetail);
  }

  // [상세요금] → 현재 선택 상태를 URL로 만들어 상세페이지로 이동 (계산/렌더 무관, 읽기만)
  function goDetail() {
    if (!_selectedInternet) {
      alert('인터넷 상품을 선택해주세요.');
      return;
    }
    const params = new URLSearchParams();
    params.set('carrier', _provider.key);
    params.set('net', _selectedInternet.name || '');
    if (_toggles.tv && _selectedTv) params.set('tv', _selectedTv.name || '');
    if (_toggles.router && _selectedRouter)
      params.set('router', _selectedRouter.name || '');
    if (_toggles.phone && _selectedPhone)
      params.set('phone', _selectedPhone.name || '');
    const on = [];
    if (_toggles.tv && _selectedTv) on.push('tv');
    if (_toggles.router && _selectedRouter) on.push('router');
    if (_toggles.phone && _selectedPhone) on.push('phone');
    if (on.length) params.set('with', on.join(','));

    window.location.href = 'internet-detail.html?' + params.toString();
  }

  function toggleSection(id, show) {
    const sec = document.getElementById(id);
    if (sec) sec.classList.toggle('is-hidden', !show);
  }
  // 토글 ON 시 해당 섹션을 부모(.ip-builder) 맨 아래로 이동 → 누른 순서대로 쌓임
  function moveSectionToEnd(id) {
    const sec = document.getElementById(id);
    if (sec && sec.parentNode) sec.parentNode.appendChild(sec);
  }

  // ── 가격 계산/접근자: 공유 코어(InternetCalc)에 위임 (조각3-1 추출) ──
  // 시그니처는 그대로 유지 → 기존 DOM 호출부(refreshInternetPrices/renderOptionCards 등) 무영향.
  function bundleOf(opt) {
    return InternetCalc.bundleOf(opt);
  }
  function normalOf(opt) {
    return InternetCalc.normalOf(opt);
  }

  // ── 가격 계산 (v9: 카드할인 단계 추가) — 계산식은 InternetCalc로 이동, 여기선 선택 상태만 전달 ──
  function calculate() {
    return InternetCalc.calculate({
      internet: _selectedInternet,
      tv: _selectedTv,
      setTop: _selectedSetTop,
      router: _selectedRouter,
      phone: _selectedPhone,
      toggles: _toggles,
      meta: _meta,
    });
  }

  function updatePricebar() {
    refreshInternetPrices();
    const calc = calculate();
    // 결합 전 요금은 값과 무관하게 항상 "별도 문의" (금액 비노출). 내부 calc는 그대로 사용.
    setText('ipPbBase', '별도 문의');
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

    // 안내 문구는 가격 컬럼(.ip-pb-prices, flex-column) 안에 쌓는다.
    // ★그리드(.ip-pricebar-inner: 1fr 1fr auto) 자식으로 넣으면 버튼 칸을
    //   밀어내므로, hint(ipSettopHint)와 동일하게 가격 컬럼 내부에 append.
    const notesBox =
      document.querySelector('.ip-pb-prices') || (giftEl && giftEl.parentNode);

    // 카드 할인 값 없을 때 상담 안내 (gift 전용 슬롯 방식 미러 — 별도 줄, '적용' 미부착)
    let cardConsult = document.getElementById('ipPbCardConsult');
    if (!cardConsult && notesBox) {
      cardConsult = document.createElement('div');
      cardConsult.id = 'ipPbCardConsult';
      cardConsult.className = 'ip-pb-row ip-pb-card-consult';
      cardConsult.style.cssText = 'font-size:12px;color:#888;margin-top:4px;';
      notesBox.appendChild(cardConsult);
    }
    if (cardConsult) {
      const showConsult = !(calc.cardDiscount > 0);
      cardConsult.textContent = showConsult
        ? '제휴카드 별도문의'
        : '';
      cardConsult.hidden = !showConsult;
    }

    const btn = document.getElementById('ipApplyBtn');
    if (btn)
      btn.disabled =
        !_selectedInternet || (_toggles.tv && _selectedTv && !_selectedSetTop);
  }

  function refreshInternetPrices() {
    const grid = document.getElementById('ipInternetGrid');
    if (!grid) return;
    grid.querySelectorAll('[data-internet]').forEach((card) => {
      const opt = _internets.find((o) => o.name === card.dataset.internet);
      if (!opt) return;
      // 카드 가격은 인터넷 속도 결합가만 고정 표시 (옵션 합산은 하단바 월요금에서만)
      const total = bundleOf(opt);
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
    if (_toggles.tv && _selectedTv && !_selectedSetTop) {
      alert('셋탑을 선택해주세요.');
      return;
    }
    if (typeof DapickApplication === 'undefined') {
      console.error('[InternetProductBase] DapickApplication 미로드');
      alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    const tvName = _toggles.tv && _selectedTv ? _selectedTv.name : '미사용';
    const setTopName =
      _toggles.tv && _selectedTv && _selectedSetTop
        ? _selectedSetTop.name
        : '미사용';
    const routerName =
      _toggles.router && _selectedRouter ? _selectedRouter.name : '미사용';
    const phoneName =
      _toggles.phone && _selectedPhone ? _selectedPhone.name : '미사용';

    const selectedOptions = {
      통신사: _provider.name,
      인터넷상품: _selectedInternet?.name || '',
      TV: tvName,
      셋탑: setTopName,
      공유기: routerName,
      전화: phoneName,
      결합전요금: calc.basePrice,
      휴대폰결합요금: calc.bundlePrice,
      카드할인적용가: calc.cardPrice,
      현금사은품: calc.gift,
    };

    const nameParts = [_provider.name, _selectedInternet?.name || ''];
    if (_toggles.tv && _selectedTv) nameParts.push('+ ' + _selectedTv.name);
    if (_toggles.tv && _selectedTv && _selectedSetTop)
      nameParts.push('+ ' + _selectedSetTop.name);
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
    // 가격바도 carrier 전환 일관성 위해 HTML 초기값(placeholder)으로 리셋
    setText('ipPbBase', '-');
    setText('ipPbPhoneCombo', '-');
    setText('ipPbFinal', '-');
    setText('ipPbGift', '상담 시 안내');
    setText('ipSettopHint', '');
    setText('ipPbCardConsult', '');
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
