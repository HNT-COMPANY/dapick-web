// ════════════════════════════════════════════════════
// internet-product-base.js v6 — 인터넷·TV 빌더 (아정당식 카드)
// ────────────────────────────────────────────────────
// 사용: InternetProductBase.init({ provider })
//   - provider.key = 'SKT' / 'KT' / 'LG_UPLUS' (carrier 필터)
//
// 백엔드: GET /api/internet-tv-products   (categoryId 없이 전체 활성 조회 → carrier 필터)
//
// ── 어드민 입력 규칙 (표시용 약속) ──────────────────────
//   인터넷 옵션:
//     name = "100Mbps"        → 큰 숫자(100) + 단위(Mbps) 자동 분리
//     desc = "슬림|1-2인가구"  → "|"로 등급명 + 설명 2줄 (| 없으면 통째로 설명)
//   TV 옵션:
//     name = "베이직"          → 등급명
//     channels = 238          → 큰 숫자(238) + "채널"
//     desc = "경제적인 요금의 채널" → 설명
//
// v6 변경점: SPEED_MAP 제거. 어드민이 정한 name/desc를 그대로 존중하여 파싱.
// ════════════════════════════════════════════════════

window.InternetProductBase = (function () {
  'use strict';

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
        // categoryId 없이 전체 활성 인터넷·TV 상품 조회 → carrier로 필터
        const list = await api.get('/api/internet-tv-products');

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

  // ── name "100Mbps" → { num: '100', unit: 'Mbps' } ───────────
  //   숫자+단위 패턴이면 분리, 아니면 통째로 num에 넣고 unit 비움
  function parseSpeed(name) {
    const s = String(name ?? '').trim();
    const m = s.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/);
    if (m) {
      return { num: m[1], unit: m[2] || '' };
    }
    return { num: s, unit: '' };
  }

  // ── desc "슬림|1-2인가구" → { grade: '슬림', sub: '1-2인가구' } ─
  //   "|" 없으면 grade 비우고 전체를 sub로
  function parseDesc(desc) {
    const s = String(desc ?? '').trim();
    if (!s) return { grade: '', sub: '' };
    const idx = s.indexOf('|');
    if (idx === -1) return { grade: '', sub: s };
    return {
      grade: s.slice(0, idx).trim(),
      sub: s.slice(idx + 1).trim(),
    };
  }

  // ════════════════════════════════════════════════════
  // 렌더 — 인터넷 옵션 카드 (아정당식: 큰숫자+단위 / 등급 / 설명 / 가격)
  // ════════════════════════════════════════════════════
  function renderInternets() {
    const el = document.getElementById('ipInternetGrid');
    if (!el) return;

    el.innerHTML = _internets
      .map((opt) => {
        const isActive = opt === _selectedInternet;
        const fee = Number(opt.normalPrice || 0);
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
  // 렌더 — TV 카드 (아정당식: 큰숫자+채널 / 등급 / 설명 / 가격)
  //   TV는 channels가 큰 숫자, name이 등급명, desc가 설명
  // ════════════════════════════════════════════════════
  function renderTvOptions() {
    const el = document.getElementById('ipTvGrid');
    if (!el) return;

    el.innerHTML = _tvs
      .map((tv) => {
        const isActive = tv === _selectedTv;
        const fee = Number(tv.normalPrice || 0);
        const { sub } = parseDesc(tv.desc);
        const hasCh = tv.channels != null && tv.channels !== '';

        return `
      <button class="ip-opt-card ${isActive ? 'active' : ''}"
              data-tv="${escapeAttr(tv.name)}" type="button">
        <div class="ip-opt-headline">
          ${
            hasCh
              ? `<span class="ip-opt-num">${escapeHtml(String(tv.channels))}</span><span class="ip-opt-unit">채널</span>`
              : `<span class="ip-opt-num">${escapeHtml(tv.name)}</span>`
          }
        </div>
        ${hasCh && tv.name ? `<div class="ip-opt-grade">${escapeHtml(tv.name)}</div>` : ''}
        ${sub ? `<div class="ip-opt-tier">${escapeHtml(sub)}</div>` : ''}
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
