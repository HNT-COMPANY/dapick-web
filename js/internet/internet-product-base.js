// ════════════════════════════════════════════════════
// internet-product-base.js v7 — 인터넷·TV 빌더 (아정당식 카드)
// ────────────────────────────────────────────────────
// 사용: InternetProductBase.init({ provider })
//   - provider.key = 'SKT' / 'KT' / ... (carrier 필터)
//
// 백엔드: GET /api/internet-tv-products (전체 활성 조회 → carrier 필터)
//
// v7 변경점 (5/29):
//   - 공유기(routerOptions) / 전화(phoneOptions) 도 TV와 동일 패턴으로 통일
//     · 토글 ON → 카드 그리드 노출 → 카드 선택 → 금액 합산
//   - 공유기·전화 섹션을 JS가 동적 주입 (HTML 6개 페이지 수정 불필요)
//   - calculate(): 인터넷 + (TV) + (공유기) + (전화) 합산
//       기본요금 = Σ normalPrice,  결합요금 = Σ bundlePrice(없으면 normalPrice)
//   - 전화 'disabled(상담안내)' 해제 → 옵션 있으면 정상 합산
//
// ── 어드민 입력 규칙 (표시용 약속) ──────────────────────
//   인터넷:  name="100Mbps"(숫자+단위 분리) · desc="등급|설명"
//   TV:      name=등급명 · channels=숫자 · desc=설명
//   공유기:  name=공유기명 · desc=설명
//   전화:    name=요금제명 · desc=설명
// ════════════════════════════════════════════════════

window.InternetProductBase = (function () {
  'use strict';

  let _provider = null;
  let _product = null;
  let _internets = [];
  let _tvs = [];
  let _routers = []; // routerOptions
  let _phones = []; // phoneOptions

  let _selectedInternet = null;
  let _selectedTv = null;
  let _selectedRouter = null;
  let _selectedPhone = null;
  let _toggles = { tv: false, router: false, phone: false };

  // ════════════════════════════════════════════════════
  // 초기화
  // ════════════════════════════════════════════════════
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
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cb);
      } else {
        cb();
      }
    };

    ready(async () => {
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

        if (_internets.length === 0) {
          showError('인터넷 상품 데이터가 없습니다.');
          return;
        }

        _selectedInternet = _internets[0];

        ensureSections(); // 공유기·전화 섹션 동적 주입
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
        ) {
          DapickApplication.resumeIfPending();
        }
      } catch (e) {
        console.error('[InternetProductBase] 상품 로드 실패:', e);
        showError('상품 정보를 불러오는 중 오류가 발생했습니다.');
      }
    });
  }

  // ── 공유기·전화 섹션을 TV 섹션 뒤에 동적 주입 ──────────
  //   HTML(6개 페이지)에 ipTvSection 만 있으므로,
  //   ipRouterSection / ipPhoneSection 을 JS 가 생성한다.
  function ensureSections() {
    const tvSection = document.getElementById('ipTvSection');
    if (!tvSection) return; // 빌더 구조가 다르면 스킵

    if (!document.getElementById('ipRouterSection')) {
      const sec = document.createElement('div');
      sec.className = 'ip-section is-hidden';
      sec.id = 'ipRouterSection';
      sec.innerHTML =
        '<div class="ip-section-label">공유기</div>' +
        '<div class="ip-card-grid" id="ipRouterGrid"></div>';
      tvSection.insertAdjacentElement('afterend', sec);
    }

    if (!document.getElementById('ipPhoneSection')) {
      const sec = document.createElement('div');
      sec.className = 'ip-section is-hidden';
      sec.id = 'ipPhoneSection';
      sec.innerHTML =
        '<div class="ip-section-label">전화</div>' +
        '<div class="ip-card-grid" id="ipPhoneGrid"></div>';
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

  // ── 가격 표기: 결합가 있으면 정상가 취소선 + 결합가 강조 ──
  function priceBlock(opt) {
    const normal = Number(opt.normalPrice || 0);
    const bundle =
      opt.bundlePrice != null && opt.bundlePrice !== ''
        ? Number(opt.bundlePrice)
        : null;
    if (bundle != null && bundle !== normal) {
      return (
        '<div class="ip-opt-price">' +
        '<span class="ip-opt-price-was">' +
        formatPrice(normal) +
        '원</span>' +
        '<span class="ip-opt-price-prefix">월</span>' +
        formatPrice(bundle) +
        '원' +
        '</div>'
      );
    }
    return (
      '<div class="ip-opt-price">' +
      '<span class="ip-opt-price-prefix">월</span>' +
      formatPrice(normal) +
      '원' +
      '</div>'
    );
  }

  // ════════════════════════════════════════════════════
  // 렌더 — 인터넷
  // ════════════════════════════════════════════════════
  function renderInternets() {
    const el = document.getElementById('ipInternetGrid');
    if (!el) return;

    el.innerHTML = _internets
      .map((opt) => {
        const isActive = opt === _selectedInternet;
        const { num, unit } = parseSpeed(opt.name);
        const { grade, sub } = parseDesc(opt.desc);
        return `
          <button class="ip-opt-card ${isActive ? 'active' : ''}"
                  data-internet="${escapeAttr(opt.name)}" type="button">
            <div class="ip-opt-headline">
              <span class="ip-opt-num">${escapeHtml(num)}</span>
              ${unit ? `<span class="ip-opt-unit">${escapeHtml(unit)}</span>` : ''}
            </div>
            ${grade ? `<div class="ip-opt-grade">${escapeHtml(grade)}</div>` : ''}
            ${sub ? `<div class="ip-opt-tier">${escapeHtml(sub)}</div>` : ''}
            ${priceBlock(opt)}
          </button>`;
      })
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 렌더 — 토글 (TV / 공유기 / 전화)
  // ════════════════════════════════════════════════════
  function renderToggles() {
    const el = document.getElementById('ipToggles');
    if (!el) return;

    const items = [];
    if (_tvs.length > 0) {
      items.push(
        `<label class="ip-toggle-item">
          <input type="checkbox" data-toggle="tv" ${_toggles.tv ? 'checked' : ''}>
          <span class="ip-toggle-label">TV와 함께</span>
        </label>`,
      );
    }
    if (_routers.length > 0) {
      items.push(
        `<label class="ip-toggle-item">
          <input type="checkbox" data-toggle="router" ${_toggles.router ? 'checked' : ''}>
          <span class="ip-toggle-label">공유기와 함께</span>
        </label>`,
      );
    }
    if (_phones.length > 0) {
      items.push(
        `<label class="ip-toggle-item">
          <input type="checkbox" data-toggle="phone" ${_toggles.phone ? 'checked' : ''}>
          <span class="ip-toggle-label">전화와 함께</span>
        </label>`,
      );
    }
    el.innerHTML = items.join('');
  }

  // ── 옵션 카드 공통 렌더 (TV/공유기/전화) ─────────────
  //   TV는 channels 를 큰 숫자로, 나머지는 name 을 헤드라인으로.
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
          <button class="ip-opt-card ${isActive ? 'active' : ''}"
                  data-${dataKey}="${escapeAttr(o.name)}" type="button">
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

  // ════════════════════════════════════════════════════
  // 이벤트
  // ════════════════════════════════════════════════════
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

    // 공유기·전화 그리드는 동적 주입이라 이벤트 위임을 ip-builder 에 건다
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

  // ════════════════════════════════════════════════════
  // 가격 계산 — 인터넷 + (TV) + (공유기) + (전화)
  //   기본요금 = Σ normalPrice
  //   결합요금 = Σ (bundlePrice || normalPrice)
  //   최종혜택가 = 결합요금
  // ════════════════════════════════════════════════════
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

  function calculate() {
    const it = _selectedInternet;
    if (!it) {
      return {
        basePrice: 0,
        bundlePrice: 0,
        finalPrice: 0,
        discount: 0,
        scenario: 'none',
      };
    }

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

    const hasExtra =
      (_toggles.tv && _selectedTv) ||
      (_toggles.router && _selectedRouter) ||
      (_toggles.phone && _selectedPhone);

    return {
      basePrice: base,
      bundlePrice: combo,
      finalPrice: combo,
      discount: Math.max(0, base - combo),
      scenario: hasExtra ? 'bundle' : 'internet_only',
    };
  }

  function updatePricebar() {
    const calc = calculate();
    setText('ipPbBase', `${formatPrice(calc.basePrice)}원`);
    setText('ipPbPhoneCombo', `${formatPrice(calc.bundlePrice)}원`);
    setText('ipPbFinal', formatPrice(calc.finalPrice));

    // 할인 힌트 (정상가 대비 결합 할인액)
    const hint = document.getElementById('ipSettopHint');
    if (hint) {
      hint.textContent =
        calc.discount > 0
          ? `정상가 대비 월 ${formatPrice(calc.discount)}원 할인 적용`
          : '';
    }

    const btn = document.getElementById('ipApplyBtn');
    if (btn) btn.disabled = !_selectedInternet;
  }

  // ════════════════════════════════════════════════════
  // 신청
  // ════════════════════════════════════════════════════
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
      기본요금: calc.basePrice,
      결합혜택가: calc.finalPrice,
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
    if (builder) {
      builder.innerHTML = `<div class="ip-error" style="padding:40px 16px;text-align:center;color:#a00;">${escapeHtml(msg)}</div>`;
    }
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

  return { init, goPage };
})();

function goPage(page) {
  InternetProductBase.goPage(page);
}
