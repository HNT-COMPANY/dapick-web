// ════════════════════════════════════════════════════
// internet-product-base.js v3 — 아정당 플로우 빌더 공통 모듈
// ────────────────────────────────────────────────────
// 사용:
//   InternetProductBase.init({ provider, categoryId })
//
// 백엔드 스키마 (Product.options JSONB):
//   { internets:[{name,feeAlone,feeBundle,withRouter}],
//     tvs:[{name,fee}], settops:[{name,fee}],
//     bundles:[{label,feeAlone,feeBundle}] }
//
// UI 흐름 (아정당 패턴):
//   1) 인터넷 속도 카드 3개 (100M / 500M / 1G) 노출
//   2) 부가옵션 토글 3개 (공유기 / TV / 전화)
//   3) TV 토글 ON 시 TV 카드 섹션 노출 + 공유기 토글 자동 ON
//   4) 가격 박스 = 기본요금 / 휴대폰결합요금 / 휴대폰결합+카드할인 혜택가 / 사은품
//   5) 셋탑은 default 1종으로 가격박스 옆 텍스트 안내
//
// 백엔드 데이터 매핑:
//   - 인터넷 카드 1개 = 같은 속도의 일반 + 와이파이 페어
//   - 공유기 OFF: withRouter=false 아이템 가격
//   - 공유기 ON: withRouter=true 아이템 가격
//   - TV ON: bundles에서 (인터넷 + TV) 라벨 매칭
// ════════════════════════════════════════════════════

window.InternetProductBase = (function () {
  'use strict';

  // ── 속도 매핑 (백엔드 name → UI 속도 라벨) ──────────────────
  // KT '인터넷 프리미엄'은 의도적으로 제외 (UI 일관성 위해 3개만)
  const SPEED_MAP = {
    // SKT
    광랜인터넷: { speed: '100Mbps', tier: '1-2인가구' },
    기가라이트인터넷: { speed: '500Mbps', tier: '3-4인가구 기본' },
    기가인터넷: { speed: '1Gbps', tier: '고사양 게임 전용' },
    // KT
    '인터넷 슬림': { speed: '100Mbps', tier: '1-2인가구' },
    '인터넷 베이직': { speed: '500Mbps', tier: '3-4인가구 기본' },
    '인터넷 에센스': { speed: '1Gbps', tier: '라이브 방송 전문' },
    // LG U+
    '프리미엄 안심 보상 100M': { speed: '100Mbps', tier: '1-2인가구' },
    '프리미엄 안심 보상 500M': { speed: '500Mbps', tier: '3-4인가구 기본' },
    '프리미엄 안심 보상 1G': { speed: '1Gbps', tier: '고사양 게임 전용' },
  };

  // 속도 정렬 순서
  const SPEED_ORDER = ['100Mbps', '500Mbps', '1Gbps'];

  // ── 상태 ────────────────────────────────────────────────────
  let _provider = null;
  let _product = null;
  let _options = null;
  let _internetGroups = null; // 속도별 그룹 { '100Mbps': {normal, wifi, tier}, ... }
  let _defaultSettop = '기본 셋탑'; // bundles에서 추출

  // 사용자 선택
  let _selectedSpeed = null; // '100Mbps' / '500Mbps' / '1Gbps'
  let _selectedTv = null;
  let _toggles = {
    router: false,
    tv: false,
    phone: false, // 항상 false (비활성)
  };

  // ════════════════════════════════════════════════════
  // 초기화 — 백엔드 API 호출 후 빌더 렌더
  // ════════════════════════════════════════════════════
  async function init(config) {
    if (!config || !config.provider || !config.categoryId) {
      console.error('[InternetProductBase] init: provider, categoryId 필수');
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
          `/api/products?categoryId=${encodeURIComponent(config.categoryId)}`,
        );

        if (!Array.isArray(list) || list.length === 0) {
          showError(
            '상품 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
          );
          return;
        }

        _product = list[0];
        _options = _product.options || {};

        if (!_options.internets || !_options.tvs || !_options.bundles) {
          showError('상품 데이터 형식이 올바르지 않습니다.');
          console.error('[InternetProductBase] options 누락:', _options);
          return;
        }

        // 속도별 그룹화 + default 셋탑 추출
        _internetGroups = groupInternetsBySpeed(_options.internets);
        _defaultSettop = extractDefaultSettop(_options.bundles);

        // 기본 선택 = 가장 낮은 속도
        for (const speed of SPEED_ORDER) {
          if (_internetGroups[speed]) {
            _selectedSpeed = speed;
            break;
          }
        }

        renderInternets();
        renderToggles();
        renderTvOptions();
        renderSettopHint();
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

  // ════════════════════════════════════════════════════
  // 속도별 인터넷 그룹화
  // ════════════════════════════════════════════════════
  function groupInternetsBySpeed(internets) {
    const groups = {};
    internets.forEach((it) => {
      const meta = SPEED_MAP[it.name];
      if (!meta) return; // SPEED_MAP 미정의 항목 제외 (예: KT 프리미엄)
      const speed = meta.speed;
      if (!groups[speed]) {
        groups[speed] = {
          speed: speed,
          tier: meta.tier,
          normal: null,
          wifi: null,
        };
      }
      if (it.withRouter) {
        groups[speed].wifi = it;
      } else {
        groups[speed].normal = it;
      }
    });
    return groups;
  }

  function extractDefaultSettop(bundles) {
    if (!bundles || bundles.length === 0) return '기본 셋탑';
    // bundle.label = "인터넷 + TV + 셋탑" 형식. 마지막 + 뒤가 셋탑
    const firstLabel = bundles[0].label || '';
    const parts = firstLabel.split('+').map((s) => s.trim());
    return parts.length >= 3 ? parts[parts.length - 1] : '기본 셋탑';
  }

  // ════════════════════════════════════════════════════
  // 렌더 — 인터넷 속도 카드 (100M / 500M / 1G)
  // ════════════════════════════════════════════════════
  function renderInternets() {
    const el = document.getElementById('ipInternetGrid');
    if (!el || !_internetGroups) return;

    const cards = SPEED_ORDER.filter((speed) => _internetGroups[speed])
      .map((speed) => {
        const group = _internetGroups[speed];
        const item = _toggles.router
          ? group.wifi || group.normal
          : group.normal || group.wifi;
        const fee = item?.feeAlone || 0;
        const isActive = speed === _selectedSpeed;
        const isRecommend = speed === '500Mbps'; // 500M 추천

        const numText = speed.replace(/Mbps|Gbps/g, '');
        const unitText = speed.includes('Gbps') ? 'Gbps' : 'Mbps';

        return `
          <button class="ip-opt-card ${isActive ? 'active' : ''}"
                  data-speed="${escapeAttr(speed)}" type="button">
            ${isRecommend ? '<span class="ip-opt-recommend">추천</span>' : ''}
            <div class="ip-opt-headline">
              <span class="ip-opt-num">${escapeHtml(numText)}</span>
              <span class="ip-opt-unit">${unitText}</span>
            </div>
            <div class="ip-opt-tier">${escapeHtml(group.tier || '')}</div>
            <div class="ip-opt-price">
              <span class="ip-opt-price-prefix">월</span>${formatPrice(fee)}원
            </div>
          </button>
        `;
      })
      .join('');

    el.innerHTML = cards;
  }

  // ════════════════════════════════════════════════════
  // 렌더 — 부가 옵션 토글 3개 (공유기 / TV / 전화)
  // ════════════════════════════════════════════════════
  function renderToggles() {
    const el = document.getElementById('ipToggles');
    if (!el) return;

    el.innerHTML = `
      <label class="ip-toggle-item">
        <input type="checkbox" data-toggle="router" ${_toggles.router ? 'checked' : ''}>
        <span class="ip-toggle-label">공유기와 함께</span>
      </label>
      <label class="ip-toggle-item">
        <input type="checkbox" data-toggle="tv" ${_toggles.tv ? 'checked' : ''}>
        <span class="ip-toggle-label">TV와 함께</span>
      </label>
      <label class="ip-toggle-item ip-toggle-item--disabled" title="전화 옵션은 전문상담원 안내 시 확인하실 수 있습니다.">
        <input type="checkbox" data-toggle="phone" disabled>
        <span class="ip-toggle-label">전화와 함께 (상담 안내)</span>
      </label>
    `;
  }

  // ════════════════════════════════════════════════════
  // 렌더 — TV 카드 (TV 토글 ON 시만)
  // ════════════════════════════════════════════════════
  function renderTvOptions() {
    const el = document.getElementById('ipTvGrid');
    if (!el || !_options?.tvs) return;

    el.innerHTML = _options.tvs
      .map(
        (tv) => `
      <button class="ip-opt-card ${tv.name === _selectedTv ? 'active' : ''}"
              data-tv="${escapeAttr(tv.name)}" type="button">
        <div class="ip-opt-headline">
          <span class="ip-opt-num">${escapeHtml(tv.name)}</span>
        </div>
        <div class="ip-opt-price">
          <span class="ip-opt-price-prefix">월</span>${formatPrice(tv.fee)}원
        </div>
      </button>
    `,
      )
      .join('');
  }

  // ════════════════════════════════════════════════════
  // 셋탑 안내 텍스트 (카드 섹션 대신)
  // ════════════════════════════════════════════════════
  function renderSettopHint() {
    const el = document.getElementById('ipSettopHint');
    if (!el) return;
    el.textContent = `셋탑: ${_defaultSettop} 기본 제공 · 다른 셋탑은 상담 안내`;
  }

  // ════════════════════════════════════════════════════
  // 이벤트 바인딩
  // ════════════════════════════════════════════════════
  function bindEvents() {
    document
      .getElementById('ipInternetGrid')
      ?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-speed]');
        if (!btn) return;
        _selectedSpeed = btn.dataset.speed;
        renderInternets();
        updatePricebar();
      });

    document.getElementById('ipTvGrid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tv]');
      if (!btn) return;
      _selectedTv = btn.dataset.tv;
      renderTvOptions();
      updatePricebar();
    });

    document.getElementById('ipToggles')?.addEventListener('change', (e) => {
      const input = e.target.closest('[data-toggle]');
      if (!input || input.disabled) return;
      const key = input.dataset.toggle;
      _toggles[key] = input.checked;

      if (key === 'router') {
        renderInternets(); // 가격 갱신
      }

      if (key === 'tv') {
        const tvSection = document.getElementById('ipTvSection');
        if (tvSection) tvSection.classList.toggle('is-hidden', !input.checked);

        if (input.checked) {
          // TV ON 시 공유기 자동 ON (bundles 매트릭스는 와이파이 조합만 있음)
          if (!_toggles.router) {
            _toggles.router = true;
            renderToggles();
            renderInternets();
          }
          // TV 첫 진입 시 첫 옵션 자동 선택
          if (!_selectedTv && _options.tvs && _options.tvs.length > 0) {
            _selectedTv = _options.tvs[0].name;
            renderTvOptions();
          }
        } else {
          _selectedTv = null;
          renderTvOptions();
        }
      }

      updatePricebar();
    });

    document
      .getElementById('ipApplyBtn')
      ?.addEventListener('click', applyConsult);
  }

  // ════════════════════════════════════════════════════
  // 현재 선택된 인터넷 아이템 짚어내기
  // ════════════════════════════════════════════════════
  function getSelectedInternet() {
    if (!_selectedSpeed || !_internetGroups[_selectedSpeed]) return null;
    const group = _internetGroups[_selectedSpeed];
    return _toggles.router
      ? group.wifi || group.normal
      : group.normal || group.wifi;
  }

  // ════════════════════════════════════════════════════
  // bundles 매칭 (TV ON 시만)
  // ════════════════════════════════════════════════════
  function findMatchedBundle() {
    if (!_toggles.tv || !_selectedTv) return null;
    const internet = getSelectedInternet();
    if (!internet) return null;
    return (
      _options.bundles.find(
        (b) =>
          typeof b.label === 'string' &&
          b.label.includes(internet.name) &&
          b.label.includes(_selectedTv),
      ) || null
    );
  }

  // ════════════════════════════════════════════════════
  // 가격 계산
  // ════════════════════════════════════════════════════
  function calculate() {
    const internet = getSelectedInternet();
    const bundle = findMatchedBundle();

    if (_toggles.tv && bundle) {
      // 인터넷 + TV 결합
      return {
        basePrice: bundle.feeAlone || 0,
        phoneComboPrice: bundle.feeBundle || 0,
        finalPrice: bundle.feeBundle || 0, // 카드할인 정보 부재 — 결합가 그대로 (B-89 부채)
        internet,
        bundle,
        scenario: 'bundle',
      };
    }

    if (internet) {
      // 인터넷만
      return {
        basePrice: internet.feeAlone || 0,
        phoneComboPrice: internet.feeBundle || 0,
        finalPrice: internet.feeBundle || 0,
        internet,
        bundle: null,
        scenario: 'internet_only',
      };
    }

    return {
      basePrice: 0,
      phoneComboPrice: 0,
      finalPrice: 0,
      internet: null,
      bundle: null,
      scenario: 'none',
    };
  }

  function updatePricebar() {
    const calc = calculate();
    setText('ipPbBase', `${formatPrice(calc.basePrice)}원`);
    setText('ipPbPhoneCombo', `${formatPrice(calc.phoneComboPrice)}원`);
    setText('ipPbFinal', formatPrice(calc.finalPrice));

    const btn = document.getElementById('ipApplyBtn');
    if (btn) {
      btn.disabled = !(
        calc.scenario === 'bundle' || calc.scenario === 'internet_only'
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 신청하기 — DapickApplication.apply
  // ════════════════════════════════════════════════════
  function applyConsult() {
    const calc = calculate();
    if (calc.scenario === 'none') {
      alert('인터넷 속도를 선택해주세요.');
      return;
    }

    if (typeof DapickApplication === 'undefined') {
      console.error('[InternetProductBase] DapickApplication 미로드');
      alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    const selectedOptions = {
      통신사: _provider.name,
      인터넷속도: _selectedSpeed,
      인터넷상품: calc.internet?.name || '',
      공유기: _toggles.router ? '포함' : '미포함',
      TV: _toggles.tv ? _selectedTv || '미선택' : '미사용',
      결합상품: calc.bundle?.label || '',
      셋탑기본: _defaultSettop,
      기본요금: calc.basePrice,
      휴대폰결합요금: calc.phoneComboPrice,
      최종혜택가: calc.finalPrice,
    };

    DapickApplication.apply({
      category: 'INTERNET_TV',
      productId: _product.id,
      productName: `${_provider.name} ${_selectedSpeed}${_toggles.tv ? ' + TV' : ''}`,
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

  return {
    init,
    goPage,
  };
})();

function goPage(page) {
  InternetProductBase.goPage(page);
}
