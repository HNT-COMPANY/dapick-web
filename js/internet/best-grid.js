//
// best-grid.js — 메인 베스트 요금제 동적 렌더
// GET /api/internet-tv-products?best=true → #bestGrid 카드 렌더
// 금액은 InternetCalc.calculate 단일 출처(자체 계산 금지)
// 카드 대표 금액 = internetOptions[0](첫 번째 옵션)
//
(function () {
  'use strict';

  const DEBUG = false;
  function log() {
    if (DEBUG) console.log('[best-grid]', ...arguments);
  }

  // escapeHtml — IIFE 내부 격리본 (index.html에 전역 escapeHtml 없음 → 자체 보유)
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 통신사 → 로고 class/표기 매핑
  const CARRIER_LOGO = {
    SKT: { cls: 'sk', label: 'SK' },
    SK: { cls: 'sk', label: 'SK' },
    KT: { cls: 'kt', label: 'KT' },
    LG: { cls: 'lg', label: 'U⁺' },
    LGU: { cls: 'lg', label: 'U⁺' },
    'LG U+': { cls: 'lg', label: 'U⁺' },
  };

  function rankClass(idx) {
    if (idx === 0) return 'r1';
    if (idx === 1) return 'r2';
    return 'r3';
  }

  function formatPrice(n) {
    return Number(n || 0).toLocaleString('ko-KR');
  }

  // 채널수: tvOptions[].channels 중 최대값 (없으면 null)
  function maxChannels(tvOptions) {
    if (!Array.isArray(tvOptions) || !tvOptions.length) return null;
    const nums = tvOptions
      .map((o) => Number(o.channels))
      .filter((n) => !isNaN(n) && n > 0);
    return nums.length ? Math.max(...nums) : null;
  }

  function buildCard(card, idx) {
    // 백엔드가 isBest 옵션 1개를 card.option으로 내려줌 (프론트는 추출 안 함)
    const option = card.option || null;

    // 금액: InternetCalc 단일 출처. card.option을 그대로 넘김. 토글 없음.
    // (지원금 폴백 meta는 옵션에 gift/bundleDiscount/cardDiscount 내장 → 빈 객체)
    const calc = InternetCalc.calculate({
      internet: option,
      toggles: {},
      meta: {},
    });

    const logo = CARRIER_LOGO[card.carrier] || {
      cls: '',
      label: escapeHtml(card.carrier || ''),
    };

    // 채널수: 인터넷 옵션 자체의 channels (있으면 표기)
    const ch = option && option.channels ? Number(option.channels) : null;

    const optName = option && option.name ? option.name : '';
    const topCls = idx === 0 ? ' top' : '';

    log('card', card.carrier, calc);

    return (
      '<div class="best-card' + topCls + '" onclick="goPage(\'internet\')">' +
      '<div class="best-tag">' + escapeHtml(card.tag || '') + '</div>' +
      '<div class="best-title-row">' +
        '<span class="plogo ' + logo.cls + '">' + logo.label + '</span>' +
        '<span class="best-brand">' + escapeHtml(card.name || '') + '</span>' +
      '</div>' +
      '<div class="best-name">' + escapeHtml(optName) +
        (ch ? ' <span class="best-ch">[' + ch + '채널]</span>' : '') +
      '</div>' +
      '<div class="gift-box">' +
        '<div class="gift-label">최대 지원금</div>' +
        '<div class="gift-amt">' +
          (calc.gift > 0 ? '최대 ' + formatPrice(calc.gift) + '원' : '상담 시 안내') +
        '</div>' +
      '</div>' +
      '<div class="best-before">결합 전 ' + formatPrice(calc.basePrice) + '원</div>' +
      '<div class="best-after">휴대폰 결합 후 <strong>월 ' + formatPrice(calc.finalPrice) + '원</strong></div>' +
      '</div>'
    );
  }

  async function render() {
    const grid = document.getElementById('bestGrid');
    if (!grid) {
      log('#bestGrid 없음 — skip');
      return;
    }
    try {
      const list = await api.get('/api/internet-tv-products?best=true');
      log('조회', list);
      if (!Array.isArray(list) || !list.length) {
        grid.innerHTML = '';
        return;
      }
      grid.innerHTML = list.map(buildCard).join('');
    } catch (e) {
      console.error('[best-grid] 조회 실패', e);
      // 실패 시 기존 정적 카드 유지(grid 건드리지 않음)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
