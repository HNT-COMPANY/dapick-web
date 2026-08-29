(function () {
  'use strict';

  //
  // 렌탈 페이지 - 2026-05-29 개편 (+ 3단 pricing 최저가 표시)
  // ──────────────────────────────────────────────────────
  // - ITEMS 하드코딩 제거 → GET /api/categories 동적 로드
  // - 카드 클릭 → rental-detail.html?id= 페이지 이동
  // - [5/29] pricing 이 3단 구조({약정:{관리주기:{조건:{monthly,...}}}})로 바뀜
  //   → monthlyOf() 를 3단 전체를 훑어 최저 monthly 를 찾도록 교체.
  //     (구 단순 {monthly} 도 호환)
  //

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

  // [5/29] 3단 pricing 최저 월요금 탐색 (구 단순구조 호환)
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
    var listTitleEl = document.getElementById('listTitle');
    if (listTitleEl) listTitleEl.textContent = item.name + ' 전체 상품';
    document.getElementById('boardView').style.display = 'none';
    document.getElementById('productView').style.display = 'block';
    window.scrollTo({ top: 0 });
    loadProducts(item.categoryId);
  }

  window.goBoard = function () {
    document.getElementById('productView').style.display = 'none';
    document.getElementById('boardView').style.display = 'block';
    window.scrollTo({ top: 0 });
  };

  function loadProducts(categoryId) {
    var grid = document.getElementById('listGrid');
    grid.innerHTML = '<div class="r-loading">상품을 불러오는 중...</div>';
    fetch(
      API_BASE + '/api/rental-products?categoryId=' + encodeURIComponent(categoryId),
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        currentProducts = res && res.data ? res.data : [];
        selected = {};
        axes = buildAxes(currentProducts);
        renderFilterBar();
        applyFilters();
      })
      .catch(function (e) {
        console.error('[rental] load products failed', e);
        grid.innerHTML =
          '<div class="r-empty">상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
      });
  }

  //
  // 필터 바 — 데이터 주도(자동 수집)
  // ────────────────────────────────────────────────────
  // 품목마다 스펙 항목이 다르므로(안마의자 vs 공기청정기) 필터 목록을 하드코딩하지 않는다.
  // 지금 화면에 올라온 상품들이 "실제로 가진 값"만 훑어서 축을 만든다.
  //   • 고정 축 : 월 요금(구간 자동) / 약정 / 관리주기 / 색상
  //   • 자유 축 : p.attributes = { "마사지방식": ["두드림","지압"], "적용평수": "20평" }
  //                → 백엔드에 attributes 가 생기는 순간 이 파일 수정 없이 필터가 늘어난다.
  // 규칙: 축 안은 OR, 축 사이는 AND (정수기 필터와 동일).
  // 값이 1종뿐인 축은 선택 의미가 없으므로 감춘다.
  //

  var axes = []; // [{key,label,values:[],get:fn}]
  var selected = {}; // { axisKey: [value,..] }
  var viewProducts = []; // 필터+정렬이 끝난, 실제로 그리는 목록

  var PRICE_ORDER = [
    '1만원 미만',
    '1만원대',
    '2만원대',
    '3만원대',
    '4만원대',
    '5만원 이상',
  ];

  function priceBucketOf(p) {
    var m = monthlyOf(p);
    if (m == null) return null;
    var man = Math.floor(m / 10000);
    if (man <= 0) return '1만원 미만';
    if (man >= 5) return '5만원 이상';
    return man + '만원대';
  }

  var FIXED_AXES = [
    { key: 'price', label: '월 요금', get: priceBucketOf },
    {
      key: 'contract',
      label: '약정',
      get: function (p) {
        return p.contractMonths ? p.contractMonths + '개월' : null;
      },
    },
    {
      key: 'care',
      label: '관리주기',
      get: function (p) {
        return p.careInterval || null;
      },
    },
    {
      key: 'color',
      label: '색상',
      get: function (p) {
        return p.colors || null;
      },
    },
  ];

  // 단일값/배열/null 을 전부 문자열 배열로 정규화
  function toValues(v) {
    if (v === null || v === undefined || v === '') return [];
    if (Array.isArray(v)) {
      var out = [];
      for (var i = 0; i < v.length; i++) {
        if (v[i] === null || v[i] === undefined || v[i] === '') continue;
        out.push(String(v[i]));
      }
      return out;
    }
    return [String(v)];
  }

  function distinctValues(list, getter) {
    var seen = [];
    for (var i = 0; i < list.length; i++) {
      var vals = toValues(getter(list[i]));
      for (var j = 0; j < vals.length; j++) {
        if (seen.indexOf(vals[j]) === -1) seen.push(vals[j]);
      }
    }
    return seen;
  }

  function buildAxes(list) {
    var out = [];
    if (!list || !list.length) return out;

    // 고정 축
    for (var i = 0; i < FIXED_AXES.length; i++) {
      var ax = FIXED_AXES[i];
      var vals = distinctValues(list, ax.get);
      if (vals.length < 2) continue;
      if (ax.key === 'price') {
        vals.sort(function (a, b) {
          return PRICE_ORDER.indexOf(a) - PRICE_ORDER.indexOf(b);
        });
      } else if (ax.key === 'contract') {
        vals.sort(function (a, b) {
          return parseInt(a, 10) - parseInt(b, 10);
        });
      } else {
        vals.sort();
      }
      out.push({ key: ax.key, label: ax.label, values: vals, get: ax.get });
    }

    // 자유 축(attributes) — 등장 순서 유지
    var attrKeys = [];
    for (var k = 0; k < list.length; k++) {
      var a = list[k].attributes;
      if (!a || typeof a !== 'object') continue;
      var keys = Object.keys(a);
      for (var m = 0; m < keys.length; m++) {
        if (attrKeys.indexOf(keys[m]) === -1) attrKeys.push(keys[m]);
      }
    }
    for (var n = 0; n < attrKeys.length; n++) {
      var name = attrKeys[n];
      var getter = (function (key) {
        return function (p) {
          return (p.attributes || {})[key];
        };
      })(name);
      var avals = distinctValues(list, getter);
      if (avals.length < 2) continue;
      out.push({
        key: 'attr:' + name,
        label: name,
        values: avals,
        get: getter,
      });
    }

    return out;
  }

  // 필터 사이드바 렌더 — 정수기와 동일한 마크업(.wf-section/.wf-options/.wf-opt)을 만든다.
  // 정수기는 체크박스가 HTML에 박혀 있지만, 렌탈은 품목마다 스펙이 달라 여기서 생성한다.
  function renderFilterBar() {
    var panel = document.getElementById('waterFilter');
    var toggle = document.getElementById('wfToggleBtn');
    var wrap = document.getElementById('wfSections');
    if (!panel || !wrap) return;

    if (!axes.length) {
      wrap.innerHTML = '';
      panel.hidden = true;
      if (toggle) toggle.hidden = true;
      // 드로어가 열린 채 사이드바가 사라지면 body 스크롤 잠금이 남는다
      panel.classList.remove('is-open');
      var ov = document.getElementById('wfOverlay');
      if (ov) ov.classList.remove('is-open');
      document.body.style.overflow = '';
      return;
    }
    panel.hidden = false;
    if (toggle) toggle.hidden = false;

    var html = '';
    for (var i = 0; i < axes.length; i++) {
      var ax = axes[i];
      var picked = selected[ax.key] || [];
      html +=
        '<div class="wf-section">' +
        '<div class="wf-section-label">' +
        esc(ax.label) +
        '</div>' +
        '<div class="wf-options">';
      for (var j = 0; j < ax.values.length; j++) {
        var v = ax.values[j];
        html +=
          '<label class="wf-opt"><input type="checkbox" data-axis="' +
          esc(ax.key) +
          '" data-value="' +
          esc(v) +
          '"' +
          (picked.indexOf(v) > -1 ? ' checked' : '') +
          '><span>' +
          esc(v) +
          '</span></label>';
      }
      html += '</div></div>';
    }
    wrap.innerHTML = html;

    var boxes = wrap.querySelectorAll('input[type="checkbox"]');
    for (var c = 0; c < boxes.length; c++) {
      boxes[c].addEventListener('change', function () {
        toggleAxisValue(
          this.getAttribute('data-axis'),
          this.getAttribute('data-value'),
          this.checked,
        );
      });
    }
  }

  // 체크박스 상태는 브라우저가 들고 있으므로 여기서 재렌더하지 않는다.
  // (innerHTML 을 다시 갈면 스크롤 위치와 포커스가 튄다)
  function toggleAxisValue(axisKey, value, on) {
    var cur = selected[axisKey] || [];
    var i = cur.indexOf(value);
    if (on) {
      if (i === -1) cur.push(value);
    } else if (i > -1) {
      cur.splice(i, 1);
    }
    if (cur.length) selected[axisKey] = cur;
    else delete selected[axisKey];
    applyFilters();
  }

  function matchesAll(p) {
    for (var i = 0; i < axes.length; i++) {
      var picked = selected[axes[i].key];
      if (!picked || !picked.length) continue;
      var have = toValues(axes[i].get(p));
      var hit = false;
      for (var j = 0; j < picked.length; j++) {
        if (have.indexOf(picked[j]) > -1) {
          hit = true;
          break;
        }
      }
      if (!hit) return false;
    }
    return true;
  }

  function sortList(list) {
    var sel = document.getElementById('rfSort');
    var mode = sel ? sel.value : 'default';
    var arr = list.slice();
    if (mode === 'priceAsc' || mode === 'priceDesc') {
      arr.sort(function (a, b) {
        var ma = monthlyOf(a);
        var mb = monthlyOf(b);
        if (ma == null && mb == null) return 0;
        if (ma == null) return 1; // '가격 문의'는 항상 뒤로
        if (mb == null) return -1;
        return mode === 'priceAsc' ? ma - mb : mb - ma;
      });
    } else if (mode === 'rating') {
      arr.sort(function (a, b) {
        return (b.averageRating || 0) - (a.averageRating || 0);
      });
    } else if (mode === 'name') {
      arr.sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
      });
    }
    return arr; // default = 서버 sortOrder 순서 그대로
  }

  function applyFilters() {
    var filtered = [];
    for (var i = 0; i < currentProducts.length; i++) {
      if (matchesAll(currentProducts[i])) filtered.push(currentProducts[i]);
    }
    viewProducts = sortList(filtered);

    var cnt = document.getElementById('rfCount');
    if (cnt) {
      cnt.textContent =
        viewProducts.length === currentProducts.length
          ? '총 ' + viewProducts.length + '개'
          : viewProducts.length + '개 / 전체 ' + currentProducts.length + '개';
    }
    renderProducts();
  }

  function resetFilters() {
    selected = {};
    var sel = document.getElementById('rfSort');
    if (sel) sel.value = 'default';
    renderFilterBar();
    applyFilters();
  }

  function renderProducts() {
    var grid = document.getElementById('listGrid');
    if (!viewProducts.length) {
      grid.innerHTML =
        '<div class="r-empty">' +
        (currentProducts.length
          ? '조건에 맞는 상품이 없습니다. 필터를 조정해보세요.'
          : '등록된 상품이 없습니다.') +
        '</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < viewProducts.length; i++) {
      var p = viewProducts[i];
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
        var p = viewProducts[parseInt(this.getAttribute('data-idx'), 10)];
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

  // 모바일 필터 드로어 — water.js 와 같은 동작(.is-open 토글).
  // 슬라이드/오버레이 CSS 는 water.css 의 @media(max-width:1024px) 가 이미 갖고 있다.
  function initFilterDrawer() {
    var btn = document.getElementById('wfToggleBtn');
    var panel = document.getElementById('waterFilter');
    var overlay = document.getElementById('wfOverlay');
    var closeBtn = document.getElementById('wfCloseBtn');
    if (!btn || !panel || !overlay) return;

    function openDrawer() {
      panel.classList.add('is-open');
      overlay.classList.add('is-open');
      btn.classList.add('is-hidden');
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      panel.classList.remove('is-open');
      overlay.classList.remove('is-open');
      btn.classList.remove('is-hidden');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    btn.addEventListener('click', openDrawer);
    overlay.addEventListener('click', closeDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        closeDrawer();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024 && panel.classList.contains('is-open')) {
        closeDrawer();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadItems();
    var sortSel = document.getElementById('rfSort');
    if (sortSel) sortSel.addEventListener('change', applyFilters);
    var resetBtn = document.getElementById('rfReset');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    initFilterDrawer();
  });
})();
