// ════════════════════════════════════════════════════
// internet-unified.js — 인터넷 통합 페이지 carrier 전환
// ────────────────────────────────────────────────────
// 동작:
//   1) 로드 시 URL ?carrier= 읽음 (없거나 미등록이면 기본 'SKT')
//   2) URL 을 해당 carrier 로 맞춘 뒤 InternetProductBase.initFromUrl() 호출
//      → base.js 의 기존 initFromUrl + CARRIER_MAP 으로 빌더 렌더 (새 렌더 로직 X)
//   3) 카드 클릭 시: data-carrier 로 활성 carrier 변경
//      → history.replaceState 로 ?carrier= 갱신(새로고침 X)
//      → initFromUrl 재호출로 빌더 재렌더, 활성 카드 .is-active 토글
//   ※ 브랜드 컬러/로고/hero 는 CARRIER_MAP 기준 (renderCarrierChrome 가 처리)
// 의존: internet-product-base.js (InternetProductBase 전역)
// ────────────────────────────────────────────────────
// TODO(2단계): 상품 리스트 캐시 후 carrier만 재필터
//   현재는 carrier 전환마다 initFromUrl→init 이 /api/internet-tv-products 를
//   전체 재요청한다. 2단계에서 최초 1회 응답을 캐시하고 carrier만 재필터하도록 최적화.
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  var DEFAULT_CARRIER = 'SKT';
  var _switching = false; // 전환 진행 중 연타/교차 클릭 가드(보조). 근본 차단은 base 세대 토큰.
  // CARRIER_MAP 과 동일한 정확 문자열 (공백·대소문자 포함)
  var VALID_CARRIERS = [
    'SKT',
    'KT',
    'LG U+',
    'LG HelloVision',
    'SK broadband',
    'KT Skylife',
  ];

  function currentCarrier() {
    var c = new URLSearchParams(window.location.search).get('carrier');
    return VALID_CARRIERS.indexOf(c) !== -1 ? c : DEFAULT_CARRIER;
  }

  function setActiveCard(carrier) {
    document.querySelectorAll('.i-provider-select-card').forEach(function (card) {
      card.classList.toggle('is-active', card.dataset.carrier === carrier);
    });
  }

  function syncUrl(carrier) {
    var url = new URL(window.location.href);
    url.searchParams.set('carrier', carrier);
    history.replaceState(null, '', url.toString());
  }

  // URL 을 carrier 로 맞춘 뒤 base 의 initFromUrl 로 빌더 렌더
  function applyCarrier(carrier) {
    _switching = true;
    syncUrl(carrier);
    setActiveCard(carrier);
    if (
      typeof InternetProductBase === 'undefined' ||
      typeof InternetProductBase.initFromUrl !== 'function'
    ) {
      console.error('[internet-unified] InternetProductBase.initFromUrl 미로드');
      _switching = false;
      return;
    }
    InternetProductBase.initFromUrl(); // base 가 URL ?carrier= 를 읽어 렌더
    // 동일 틱 연타 차단용 해제(다음 틱). in-flight 정합성은 base 세대 토큰이 보장.
    setTimeout(function () {
      _switching = false;
    }, 0);
  }

  function ready(cb) {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', cb);
    else cb();
  }

  ready(function () {
    // 1) 초기 carrier 로 빌더 렌더 (URL 없으면 기본 SKT 로 채움)
    applyCarrier(currentCarrier());

    // 2) 카드 클릭 → 같은 페이지에서 carrier 전환
    document.querySelectorAll('.i-provider-select-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (_switching) return; // 전환 진행 중이면 연타 무시(보조)
        var next = card.dataset.carrier;
        if (!next) return;
        if (next === currentCarrier()) {
          setActiveCard(next); // 같은 carrier 재클릭 시 렌더 생략
          return;
        }
        applyCarrier(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  });
})();
