(function () {
  'use strict';

  // ══════════════════════════════════════════════════════
  // 렌탈 페이지 - 2026-05-29 개편 (+ 3단 pricing 최저가 표시)
  // ──────────────────────────────────────────────────────
  // - ITEMS 하드코딩 제거 → GET /api/categories 동적 로드
  // - 카드 클릭 → rental-detail.html?id= 페이지 이동
  // - [5/29] pricing 이 3단 구조({약정:{관리주기:{조건:{monthly,...}}}})로 바뀜
  //   → monthlyOf() 를 3단 전체를 훑어 최저 monthly 를 찾도록 교체.
  //     (구 단순 {monthly} 도 호환)
  // ══════════════════════════════════════════════════════

  var API_BASE =
    typeof BASE_URL !== 'undefined' && BASE_URL
      ? BASE_URL
      : 'https://api.dapick.co.kr';
  var KAKAO_CHAT_URL = 'https://pf.kakao.com/_exaRjX/chat';
  var RENTAL_TYPE = 'RENTAL';

  var ITEMS = [];
  var currentItem = null;
  var currentProducts = [];
  var selectedProduct = null;
  var selectedColor = null;

  function won(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('ko-KR') + '원';
  }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ★ [5/29] 3단 pricing 최저 월요금 탐색 (구 단순구조 호환)
  function monthlyOf(p) {
    var pr = p.pricing || {};

    // 구 단순구조: { monthly: n } 또는 { selfCare: n }
    if (typeof pr.monthly === 'number') return pr.monthly;
    if (typeof pr.selfCare === 'number') return pr.selfCare;

    // 3단 구조: { 약정: { 관리주기: { 조건: {monthly,...} } } }
    var min = Infinity;
    Object.keys(pr).forEach(function (ck) {
      var cycles = pr[ck];
      if (!cycles || typeof cycles !== 'object') return;
      Object.keys(cycles).forEach(function (cyk) {
        var types = cycles[cyk];
        if (!types || typeof types !== 'object') return;
        Object.keys(types).forEach(function (tk) {
          var d = types[tk];
          if (
            d &&
            typeof d.monthly === 'number' &&
            d.monthly > 0 &&
            d.monthly < min
          ) {
            min = d.monthly;
          }
        });
      });
    });
    return min === Infinity ? null : min;
  }

  // ── 품목(=RENTAL 2depth 카테고리) 동적 로드 ─────────
  function loadItems() {
    var grid = document.getElementById('itemGrid');
    grid.innerHTML = '<div class="r-loading">품목을 불러오는 중...</div>';

    fetch(API_BASE + '/api/categories')
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        var data = res && res.data ? res.data : res;
        var list = Array.isArray(data) ? data : [];

        var rental = null;
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].type === RENTAL_TYPE) {
            rental = list[i];
            break;
          }
        }

        if (!rental || !rental.children || !rental.children.length) {
          ITEMS = [];
          renderItems();
          return;
        }

        ITEMS = rental.children
          .filter(function (c) {
            return c && c.isActive !== false;
          })
          .map(function (c) {
            return {
              brandId: c.id,
              categoryId: c.id,
              name: c.name,
              imageUrl: c.imageUrl || '',
              emoji: '📦',
            };
          });

        renderItems();
      })
      .catch(function (e) {
        console.error('[rental] load items failed', e);
        grid.innerHTML =
          '<div class="r-empty">품목을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
      });
  }

  function renderItems() {
    var grid = document.getElementById('itemGrid');
    if (!ITEMS.length) {
      grid.innerHTML =
        '<div class="r-empty">등록된 품목이 없습니다. 어드민에서 추가해주세요.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      var thumb = it.imageUrl
        ? '<div class="r-item-thumb"><img src="' +
          esc(it.imageUrl) +
          '" alt="' +
          esc(it.name) +
          '" onerror="this.parentNode.innerHTML=\'<span class=&quot;r-item-emoji&quot;>📦</span>\'"></div>'
        : '<div class="r-item-thumb"><span class="r-item-emoji">' +
          esc(it.emoji || '📦') +
          '</span></div>';
      html +=
        '<div class="r-item-card" data-idx="' +
        i +
        '">' +
        thumb +
        '<div class="r-item-name">' +
        esc(it.name) +
        '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
    var cards = grid.querySelectorAll('.r-item-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function () {
        selectItem(ITEMS[parseInt(this.getAttribute('data-idx'), 10)]);
      });
    }
  }

  function selectItem(item) {
    currentItem = item;
    document.getElementById('productViewBrand').textContent = item.name;
    document.getElementById('productHeroTag').textContent =
      (item.emoji || '🏠') + ' ' + item.name + ' 렌탈';
    document.getElementById('boardView').style.display = 'none';
    document.getElementById('productView').style.display = 'block';
    window.scrollTo({ top: 0 });
    loadProducts(item.brandId);
  }

  window.goBoard = function () {
    document.getElementById('productView').style.display = 'none';
    document.getElementById('boardView').style.display = 'block';
    window.scrollTo({ top: 0 });
  };

  function loadProducts(brandId) {
    var grid = document.getElementById('listGrid');
    grid.innerHTML = '<div class="r-loading">상품을 불러오는 중...</div>';
    fetch(
      API_BASE + '/api/rental-products?brandId=' + encodeURIComponent(brandId),
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        currentProducts = res && res.data ? res.data : [];
        renderProducts();
      })
      .catch(function (e) {
        console.error('[rental] load products failed', e);
        grid.innerHTML =
          '<div class="r-empty">상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
      });
  }

  function renderProducts() {
    var grid = document.getElementById('listGrid');
    if (!currentProducts.length) {
      grid.innerHTML = '<div class="r-empty">등록된 상품이 없습니다.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < currentProducts.length; i++) {
      var p = currentProducts[i];
      var m = monthlyOf(p);

      var priceHtml =
        m != null
          ? '<div class="wpg-price-line"><span class="wpg-price">월 ' +
            won(m) +
            '~</span></div>'
          : '<div class="wpg-price-line"><span class="wpg-price wpg-ask">가격 문의</span></div>';

      var imgInner = p.imageUrl
        ? '<img src="' +
          esc(p.imageUrl) +
          '" alt="' +
          esc(p.name) +
          '" loading="lazy">'
        : '<span class="wpg-emoji">' + esc(p.emoji || '📦') + '</span>';

      html +=
        '<div class="water-prod-card" data-idx="' +
        i +
        '">' +
        '<div class="wpg-img">' +
        (p.best ? '<span class="wpg-badge-best">인기</span>' : '') +
        (p.new ? '<span class="wpg-badge-new">NEW</span>' : '') +
        imgInner +
        '</div>' +
        '<div class="wpg-body">' +
        '<div class="wpg-name">' +
        esc(p.name) +
        '</div>' +
        ratingHtml(p.averageRating, p.reviewCount) +
        priceHtml +
        '</div>' +
        '</div>';
    }
    grid.innerHTML = html;

    var cards = grid.querySelectorAll('.water-prod-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function () {
        var p = currentProducts[parseInt(this.getAttribute('data-idx'), 10)];
        if (p && p.id) {
          window.location.href =
            'rental-detail.html?id=' + encodeURIComponent(p.id);
        }
      });
    }
  }

  // ── goPage 폴백 ────────
  if (typeof window.goPage !== 'function') {
    window.goPage = function (key) {
      var map = {
        mobile: 'mobile.html',
        internet: 'internet.html',
        card: 'card.html',
        water: 'water.html',
        rental: 'rental.html',
      };
      if (map[key]) window.location.href = map[key];
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadItems();
  });
})();
