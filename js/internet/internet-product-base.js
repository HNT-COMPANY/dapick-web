// ════════════════════════════════════════════════════
// internet-product-base.js v4 — 인터넷·TV 빌더 (백엔드 InternetTvProduct 구조)
// ────────────────────────────────────────────────────
// 사용: InternetProductBase.init({ provider })
//   - provider.key = 'SKT' / 'KT' / 'LG_UPLUS' (carrier 필터)
//
// 백엔드: GET /api/internet-tv-products?categoryId={INTERNET_TV}
//   응답: [{ id, carrier, name, description, imageUrl,
//            internetOptions:[{name,desc,imageUrl,channels,normalPrice,bundlePrice}],
//            tvOptions:[...], routerOptions:[...], phoneOptions:[...] }]
//   → carrier === provider.key 인 상품을 사용
// ════════════════════════════════════════════════════

window.InternetProductBase = (function () {
  'use strict';

  // prod INTERNET_TV 1단계 카테고리 (고정)
  const INTERNET_TV_CATEGORY_ID = 'acbe6c19-c70b-453c-aa14-409069f86e9a';

  // 속도 라벨 매핑 (옵션 name → 속도 표시). 매칭 안 되면 옵션 name 그대로 노출
  const SPEED_MAP = {
    광랜인터넷: { speed: '100Mbps', tier: '1-2인가구' },
    기가라이트인터넷: { speed: '500Mbps', tier: '3-4인가구 기본' },
    기가인터넷: { speed: '1Gbps', tier: '고사양 게임 전용' },
    '인터넷 슬림': { speed: '100Mbps', tier: '1-2인가구' },
    '인터넷 베이직': { speed: '500Mbps', tier: '3-4인가구 기본' },
    '인터넷 에센스': { speed: '1Gbps', tier: '라이브 방송 전문' },
    '프리미엄 안심 보상 100M': { speed: '100Mbps', tier: '1-2인가구' },
    '프리미엄 안심 보상 500M': { speed: '500Mbps', tier: '3-4인가구 기본' },
    '프리미엄 안심 보상 1G': { speed: '1Gbps', tier: '고사양 게임 전용' },
  };

  let _provider = null;
  let _product = null; // carrier 매칭된 상품 1개
  let _internets = []; // internetOptions
  let _tvs = []; // tvOptions

  let _selectedInternet = null; // 선택된 internetOption 객체
  let _selectedTv = null; // 선택된 tvOption 객체
  let _toggles = { tv: false };

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
        const list = await api.get(
          `/api/internet-tv-products?categoryId=${encodeURIComponent(INTERNET_TV_CATEGORY_ID)}`,
        );

        if (!Array.isArray(list) || list.length === 0) {
          showError(
            '상품 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
          );
          return;
        }

        // carrier 필터 (SKT/KT/LG_UPLUS)
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

        if (_internets.length === 0) {
          showError('인터넷 상품 데이터가 없습니다.');
          return;
        }

        // 기본 선택 = 첫 인터넷 옵션
        _selectedInternet = _internets[0];

        renderInternets();
        renderToggles();
        renderTvOptions();
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

  // ── 옵션 name으로 속도 메타 추출 ─────────────────────────────
  function speedMeta(opt) {
    return SPEED_MAP[opt.name] || { speed: opt.name, tier: opt.desc || '' };
  }

  // ════════════════════════════════════════════════════
  // 렌더 — 인터넷 옵션 카드
  // ════════════════════════════════════════════════════
  function renderInternets() {
    const el = document.getElementById('ipInternetGrid');
    if (!el) return;

    el.innerHTML = _internets
      .map((opt) => {
        const meta = speedMeta(opt);
        const isActive = opt === _selectedInternet;
        const fee = Number(opt.normalPrice || 0);

        const m = String(meta.speed).match(/^(\d+)\s*(Mbps|Gbps)?$/i);
        const numText = m ? m[1] : meta.speed;
        const unitText =
          m && m[2] ? m[2] : String(meta.speed).includes('G') ? 'Gbps' : 'Mbps';

        return `
          <button class="ip-opt-card ${isActive ? 'active' : ''}"
                  data-internet="${escapeAttr(opt.name)}" type="button">
            <div class="ip-opt-headline">
              <span class="ip-opt-num">${escapeHtml(numText)}</span>
              <span class="ip-opt-unit">${escapeHtml(unitText)}</span>
            </div>
            <div class="ip-opt-tier">${escapeHtml(meta.tier || '')}</div>
            <div class="ip-opt-price">
              <span class="ip-opt-price-prefix">월</span>${formatPrice(fee)}원
            </div>
          </button>
        `;
      })
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 렌더 — 토글 (TV / 전화)
  // ════════════════════════════════════════════════════
  function renderToggles() {
    const el = document.getElementById('ipToggles');
    if (!el) return;

    const hasTv = _tvs.length > 0;
    const hasPhone =
      Array.isArray(_product.phoneOptions) && _product.phoneOptions.length > 0;

    el.innerHTML = `
      ${
        hasTv
          ? `
      <label class="ip-toggle-item">
        <input type="checkbox" data-toggle="tv" ${_toggles.tv ? 'checked' : ''}>
        <span class="ip-toggle-label">TV와 함께</span>
      </label>`
          : ''
      }
      ${
        hasPhone
          ? `
      <label class="ip-toggle-item ip-toggle-item--disabled" title="전화 옵션은 전문상담원 안내 시 확인하실 수 있습니다.">
        <input type="checkbox" data-toggle="phone" disabled>
        <span class="ip-toggle-label">전화와 함께 (상담 안내)</span>
      </label>`
          : ''
      }
    `;
  }

  // ════════════════════════════════════════════════════
  // 렌더 — TV 카드 (TV 토글 ON 시만)
  // ════════════════════════════════════════════════════
  function renderTvOptions() {
    const el = document.getElementById('ipTvGrid');
    if (!el) return;

    el.innerHTML = _tvs
      .map((tv) => {
        const isActive = tv === _selectedTv;
        const fee = Number(tv.normalPrice || 0);
        const ch = tv.channels
          ? ` <span class="ip-opt-ch">[${tv.channels}채널]</span>`
          : '';
        return `
      <button class="ip-opt-card ${isActive ? 'active' : ''}"
              data-tv="${escapeAttr(tv.name)}" type="button">
        <div class="ip-opt-headline">
          <span class="ip-opt-num">${escapeHtml(tv.name)}</span>${ch}
        </div>
        <div class="ip-opt-price">
          <span class="ip-opt-price-prefix">월</span>${formatPrice(fee)}원
        </div>
      </button>
    `;
      })
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 이벤트 바인딩
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

    document.getElementById('ipToggles')?.addEventListener('change', (e) => {
      const input = e.target.closest('[data-toggle]');
      if (!input || input.disabled) return;
      const key = input.dataset.toggle;

      if (key === 'tv') {
        _toggles.tv = input.checked;
        const tvSection = document.getElementById('ipTvSection');
        if (tvSection) tvSection.classList.toggle('is-hidden', !input.checked);

        if (input.checked) {
          if (!_selectedTv && _tvs.length > 0) {
            _selectedTv = _tvs[0];
            renderTvOptions();
          }
        } else {
          _selectedTv = null;
          renderTvOptions();
        }
        updatePricebar();
      }
    });

    document
      .getElementById('ipApplyBtn')
      ?.addEventListener('click', applyConsult);
  }

  // ════════════════════════════════════════════════════
  // 가격 계산
  //   기본요금        = 인터넷 normalPrice (+ TV ON 시 TV normalPrice)
  //   휴대폰결합요금  = 인터넷 bundlePrice (+ TV ON 시 TV bundlePrice)
  //   최종혜택가      = 휴대폰결합요금 (카드할인 정보 부재 — B-89 부채 유지)
  // ════════════════════════════════════════════════════
  function calculate() {
    const it = _selectedInternet;
    if (!it) {
      return {
        basePrice: 0,
        phoneComboPrice: 0,
        finalPrice: 0,
        scenario: 'none',
      };
    }

    let base = Number(it.normalPrice || 0);
    let combo = Number(it.bundlePrice || it.normalPrice || 0);

    if (_toggles.tv && _selectedTv) {
      base += Number(_selectedTv.normalPrice || 0);
      combo += Number(_selectedTv.bundlePrice || _selectedTv.normalPrice || 0);
    }

    return {
      basePrice: base,
      phoneComboPrice: combo,
      finalPrice: combo,
      scenario: _toggles.tv && _selectedTv ? 'bundle' : 'internet_only',
    };
  }

  function updatePricebar() {
    const calc = calculate();
    setText('ipPbBase', `${formatPrice(calc.basePrice)}원`);
    setText('ipPbPhoneCombo', `${formatPrice(calc.phoneComboPrice)}원`);
    setText('ipPbFinal', formatPrice(calc.finalPrice));

    const btn = document.getElementById('ipApplyBtn');
    if (btn) btn.disabled = calc.scenario === 'none';
  }

  // ════════════════════════════════════════════════════
  // 신청하기
  // ════════════════════════════════════════════════════
  function applyConsult() {
    const calc = calculate();
    if (calc.scenario === 'none') {
      alert('인터넷 상품을 선택해주세요.');
      return;
    }
    if (typeof DapickApplication === 'undefined') {
      console.error('[InternetProductBase] DapickApplication 미로드');
      alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    const selectedOptions = {
      통신사: _provider.name,
      인터넷상품: _selectedInternet?.name || '',
      TV: _toggles.tv && _selectedTv ? _selectedTv.name : '미사용',
      기본요금: calc.basePrice,
      휴대폰결합요금: calc.phoneComboPrice,
      최종혜택가: calc.finalPrice,
    };

    DapickApplication.apply({
      category: 'INTERNET_TV',
      productId: _product.id,
      productName: `${_provider.name} ${_selectedInternet?.name || ''}${_toggles.tv && _selectedTv ? ' + ' + _selectedTv.name : ''}`,
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
