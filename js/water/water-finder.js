// ════════════════════════════════════════════════════════════════════
// 나만의 정수기 찾기 (2026-08-04 신설)
//
// 정수기 화면에 들어온 사람에게 질문 다섯 개를 묻고 맞는 상품을 골라준다.
//
// ★ 왜 "거르기" 가 아니라 "점수" 인가
//   조건을 전부 만족하는 것만 남기면 0건이 나오기 쉽다. 특히 지금은 상품의
//   추천 기준(가구 규모·사용 목적)이 대부분 비어 있어서 거의 항상 0건이 된다.
//   0건 화면은 고객에게 "이 사이트엔 없다" 로 읽힌다.
//   그래서 조건마다 점수를 주고 높은 순으로 보여준다. 항상 결과가 나오고,
//   무엇이 맞았는지 카드에 적어 줄 수 있어 왜 추천됐는지도 설명된다.
//
// ★ 상품 기준값이 비어 있으면
//   그 조건은 점수를 못 받을 뿐 후보에서 빠지지는 않는다. 관리자가 어드민
//   2번·6번 단계에서 값을 채우는 만큼 추천이 정확해진다. 채우기 전에도 화면은 돈다.
//
// ★ 데이터
//   water.js 의 getAllProductsFlat() 을 쓴다. 별도 API 호출 없음.
//   householdSize / purposeTags / priceBucket / waterFunction / colors 는
//   groupByBrand() 가 이미 옮겨 둔 값이다.
//
// ★ 되돌리기
//   water.html 에서 이 파일의 <script> 한 줄만 지우면 버튼도 화면도 사라진다.
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── 질문 정의 ─────────────────────────────────────────────────────
  // multi: 여러 개 고를 수 있음 / skip: 건너뛰기 허용(전부 허용)
  var STEPS = [
    {
      key: 'household',
      title: '집에 몇 분이 사시나요?',
      sub: '쓰는 사람 수에 따라 알맞은 용량이 다릅니다',
      options: [
        { v: 'SMALL', label: '1~2인', desc: '혼자 또는 둘이' },
        { v: 'MEDIUM', label: '3~4인', desc: '가장 많은 경우' },
        { v: 'LARGE', label: '5인 이상', desc: '대가족' },
      ],
    },
    {
      key: 'place',
      title: '어디에서 쓰시나요?',
      sub: '사무실과 매장은 쓰는 양이 훨씬 많습니다',
      options: [
        { v: 'HOME', label: '집', desc: '가정용' },
        { v: 'OFFICE', label: '사무실', desc: '직원들이 함께' },
        { v: 'CAFE', label: '카페 · 매장', desc: '영업용' },
      ],
    },
    {
      key: 'life',
      title: '어떤 상황이신가요?',
      sub: '해당하는 것을 모두 골라주세요',
      multi: true,
      options: [
        { v: 'BABY', label: '아기 · 유아가 있어요', desc: '온수 잠금이 중요합니다' },
        { v: 'SENIOR', label: '어르신이 계세요', desc: '조작이 쉬운 것이 좋습니다' },
        { v: 'PET', label: '반려동물과 살아요', desc: '물 사용량이 늘어납니다' },
        { v: 'SINGLE', label: '혼자 살아요', desc: '작고 저렴한 쪽이 맞습니다' },
        { v: 'NEWLYWED', label: '신혼이에요', desc: '디자인을 많이 보십니다' },
      ],
    },
    {
      key: 'price',
      title: '월 요금은 어느 정도가 좋으세요?',
      sub: '약정과 관리주기에 따라 달라질 수 있습니다',
      options: [
        { v: 'RANGE_10K', label: '2만원 미만', desc: '' },
        { v: 'RANGE_20K', label: '2만원대', desc: '' },
        { v: 'RANGE_30K', label: '3만원대', desc: '' },
        { v: 'OVER_40K', label: '4만원 이상', desc: '기능이 많은 쪽' },
      ],
    },
    {
      key: 'func',
      title: '어떤 물이 필요하세요?',
      sub: '해당하는 것을 모두 골라주세요',
      multi: true,
      options: [
        { v: 'cold', label: '냉수', desc: '' },
        { v: 'hot', label: '온수', desc: '' },
        { v: 'ice', label: '얼음', desc: '' },
      ],
    },
  ];

  // 마지막 질문(색)은 실제 상품 색을 모아 만든다 → build 시점에 채운다
  var COLOR_STEP = {
    key: 'color',
    title: '원하는 색이 있으세요?',
    sub: '없으면 건너뛰셔도 됩니다',
    multi: true,
    options: [],
  };

  // ── 점수 규칙 ─────────────────────────────────────────────────────
  // 값이 클수록 그 조건을 더 중요하게 본다. 고객이 실제로 못 바꾸는 것(인원·장소·요금)에
  // 큰 점수를, 취향(색)에 작은 점수를 준다.
  var W = { household: 3, place: 3, life: 2, price: 3, priceNear: 1, func: 2, color: 1 };

  var PRICE_ORDER = ['RANGE_10K', 'RANGE_20K', 'RANGE_30K', 'OVER_40K'];
  var FUNC_OF = {
    PURIFIED: [],
    COLD: ['cold'],
    HOT: ['hot'],
    COLD_HOT: ['cold', 'hot'],
    COLD_ICE: ['cold', 'ice'],
    COLD_HOT_ICE: ['cold', 'hot', 'ice'],
  };
  var FUNC_LABEL = { cold: '냉수', hot: '온수', ice: '얼음' };

  var answers = {};
  var cur = 0;
  var steps = STEPS.concat([COLOR_STEP]);
  var ovEl = null;

  function esc(s) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }

  // ── 채점 ──────────────────────────────────────────────────────────
  // 반환: { score, reasons:[문구] }  reasons 는 카드에 "이래서 골랐어요" 로 보여준다.
  function score(p) {
    var s = 0;
    var why = [];

    // 가구 규모
    var hh = answers.household;
    if (hh && p.householdSize && p.householdSize.code === hh) {
      s += W.household;
      why.push(p.householdSize.label + '에 맞음');
    }

    // 쓰는 곳 — 사무실·카페는 목적 태그로, 집은 사무실/카페 태그가 없는 쪽에 점수
    var place = answers.place;
    var tags = p.purposeTags || [];
    if (place === 'OFFICE' || place === 'CAFE') {
      if (tags.indexOf(place) >= 0) {
        s += W.place;
        why.push(place === 'OFFICE' ? '사무실용' : '카페·매장용');
      }
      // 가구 규모를 OFFICE 로 지정한 상품도 같이 인정한다(관리자가 둘 중 하나만 넣을 수 있다)
      else if (p.householdSize && p.householdSize.code === 'OFFICE') {
        s += W.place;
        why.push('사무실·매장용');
      }
    } else if (place === 'HOME') {
      if (tags.indexOf('OFFICE') < 0 && tags.indexOf('CAFE') < 0) s += 1;
    }

    // 생활 상황 (다중)
    (answers.life || []).forEach(function (v) {
      if (tags.indexOf(v) >= 0) {
        s += W.life;
        var m = { BABY: '아기 있는 집', SENIOR: '어르신 계신 집', PET: '반려동물가구', SINGLE: '1인 가구', NEWLYWED: '신혼' };
        why.push(m[v] + '에 추천');
      }
    });

    // 요금대 — 한 칸 차이는 절반만 인정한다. 딱 맞는 게 없을 때 아예 안 나오는 걸 막는다.
    var pr = answers.price;
    if (pr && p.priceBucket) {
      if (p.priceBucket === pr) {
        s += W.price;
        why.push('요금대가 맞음');
      } else if (Math.abs(PRICE_ORDER.indexOf(p.priceBucket) - PRICE_ORDER.indexOf(pr)) === 1) {
        s += W.priceNear;
      }
    }

    // 기능 (다중)
    var have = FUNC_OF[(p.waterFunction && p.waterFunction.code) || 'PURIFIED'] || [];
    (answers.func || []).forEach(function (v) {
      if (have.indexOf(v) >= 0) {
        s += W.func;
        why.push(FUNC_LABEL[v] + ' 됨');
      }
    });

    // 색 (다중)
    var colors = p.colors || [];
    (answers.color || []).forEach(function (v) {
      if (colors.indexOf(v) >= 0) {
        s += W.color;
        why.push(v + ' 있음');
      }
    });

    return { score: s, why: why };
  }

  // ── 화면 ──────────────────────────────────────────────────────────
  function open() {
    answers = {};
    cur = 0;
    buildColorStep();
    ovEl.hidden = false;
    document.body.style.overflow = 'hidden';
    paint();
  }

  function close() {
    ovEl.hidden = true;
    document.body.style.overflow = '';
  }

  function buildColorStep() {
    if (typeof getAllProductsFlat !== 'function') return;
    var seen = {};
    getAllProductsFlat().forEach(function (p) {
      (p.colors || []).forEach(function (c) {
        var k = String(c).trim();
        if (k && k !== '기본') seen[k] = (seen[k] || 0) + 1;
      });
    });
    COLOR_STEP.options = Object.keys(seen)
      .sort(function (a, b) { return seen[b] - seen[a]; })
      .slice(0, 8)
      .map(function (c) { return { v: c, label: c, desc: '' }; });
  }

  function isPicked(key, v) {
    var a = answers[key];
    return Array.isArray(a) ? a.indexOf(v) >= 0 : a === v;
  }

  function pick(step, v) {
    if (step.multi) {
      var a = answers[step.key] || [];
      var i = a.indexOf(v);
      if (i >= 0) a.splice(i, 1);
      else a.push(v);
      answers[step.key] = a;
      paint(); // 여러 개 고를 수 있으니 화면만 갱신하고 기다린다
    } else {
      answers[step.key] = v;
      next(); // 하나만 고르는 질문은 바로 넘어간다 — 누르고 또 누르게 하지 않는다
    }
  }

  function next() {
    if (cur >= steps.length - 1) return paintResult();
    cur += 1;
    paint();
  }

  function prev() {
    if (cur === 0) return close();
    cur -= 1;
    paint();
  }

  function paint() {
    var step = steps[cur];
    // 색 선택지가 하나도 없으면 그 질문은 건너뛴다
    if (step.key === 'color' && !step.options.length) return paintResult();

    var pct = Math.round(((cur + 1) / steps.length) * 100);
    ovEl.innerHTML =
      '<div class="wf-box">' +
      '<div class="wf-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="wf-head">' +
      '<span class="wf-step">' + (cur + 1) + ' / ' + steps.length + '</span>' +
      '<button type="button" class="wf-x" data-close aria-label="닫기">✕</button>' +
      '</div>' +
      '<h2 class="wf-q">' + esc(step.title) + '</h2>' +
      '<p class="wf-qsub">' + esc(step.sub) + '</p>' +
      '<div class="wf-opts' + (step.multi ? ' is-multi' : '') + '">' +
      step.options
        .map(function (o) {
          return (
            '<button type="button" class="wf-opt' + (isPicked(step.key, o.v) ? ' is-on' : '') +
            '" data-v="' + esc(o.v) + '">' +
            '<span class="wf-opt-label">' + esc(o.label) + '</span>' +
            (o.desc ? '<span class="wf-opt-desc">' + esc(o.desc) + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="wf-nav">' +
      '<button type="button" class="wf-btn wf-btn--ghost" data-prev>' + (cur === 0 ? '닫기' : '이전') + '</button>' +
      '<button type="button" class="wf-btn wf-btn--ghost" data-skip>건너뛰기</button>' +
      '<button type="button" class="wf-btn wf-btn--go" data-next>' +
      (cur === steps.length - 1 ? '결과 보기' : '다음') + '</button>' +
      '</div>' +
      '</div>';
    wire(step);
  }

  function wire(step) {
    ovEl.querySelectorAll('.wf-opt').forEach(function (b) {
      b.onclick = function () { pick(step, b.dataset.v); };
    });
    var q = function (sel) { return ovEl.querySelector(sel); };
    if (q('[data-close]')) q('[data-close]').onclick = close;
    if (q('[data-prev]')) q('[data-prev]').onclick = prev;
    if (q('[data-next]')) q('[data-next]').onclick = next;
    if (q('[data-skip]')) q('[data-skip]').onclick = function () {
      delete answers[step.key];
      next();
    };
  }

  function paintResult() {
    var all = (typeof getAllProductsFlat === 'function' ? getAllProductsFlat() : []).filter(
      function (p) {
        var info = typeof getBestPriceInfo === 'function' ? getBestPriceInfo(p.pricing) : null;
        return !!(info && info.monthly);
      },
    );
    var ranked = all
      .map(function (p) {
        var r = score(p);
        return { p: p, s: r.score, why: r.why };
      })
      .sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        return (a.p.sortOrder || 999) - (b.p.sortOrder || 999);
      })
      .slice(0, 6);

    var best = ranked.length ? ranked[0].s : 0;
    // 아무 조건도 못 맞췄으면 솔직하게 말한다. 그럴듯하게 포장하지 않는다.
    var lead =
      best === 0
        ? '고르신 조건에 딱 맞는 상품을 아직 찾지 못했습니다. 대신 많이 찾는 상품을 보여드립니다.'
        : '고르신 조건에 가까운 순서로 보여드립니다.';

    ovEl.innerHTML =
      '<div class="wf-box wf-box--wide">' +
      '<div class="wf-head">' +
      '<span class="wf-step">추천 결과</span>' +
      '<button type="button" class="wf-x" data-close aria-label="닫기">✕</button>' +
      '</div>' +
      '<h2 class="wf-q">이런 정수기는 어떠세요?</h2>' +
      '<p class="wf-qsub">' + esc(lead) + '</p>' +
      '<div class="wf-result">' +
      ranked
        .map(function (r) {
          var why = r.why.slice(0, 3);
          return (
            '<div class="wf-item">' +
            (typeof renderProductCard === 'function' ? renderProductCard(r.p) : '') +
            (why.length
              ? '<div class="wf-why">' +
                why.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join('') +
                '</div>'
              : '') +
            '</div>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="wf-nav">' +
      '<button type="button" class="wf-btn wf-btn--ghost" data-again>다시 고르기</button>' +
      '<button type="button" class="wf-btn wf-btn--go" data-close>닫기</button>' +
      '</div>' +
      '</div>';

    ovEl.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
    var again = ovEl.querySelector('[data-again]');
    if (again) again.onclick = open;
  }

  // ── 시작 ──────────────────────────────────────────────────────────
  function init() {
    var slot = document.getElementById('waterFinder');
    if (!slot) return;

    slot.innerHTML =
      '<button type="button" class="wf-cta" id="wfOpen">' +
      '<span class="wf-cta-ico">🔎</span>' +
      '<span class="wf-cta-txt">' +
      '<b>나만의 정수기 찾기</b>' +
      '<em>몇 가지만 답하면 맞는 정수기를 골라드려요</em>' +
      '</span>' +
      '<span class="wf-cta-go">시작하기 ›</span>' +
      '</button>';

    ovEl = document.createElement('div');
    ovEl.className = 'wf-ov';
    ovEl.id = 'wfOverlay';
    ovEl.hidden = true;
    document.body.appendChild(ovEl);
    // 바깥을 누르면 닫는다. 안쪽 클릭은 안 닫는다.
    ovEl.addEventListener('click', function (e) {
      if (e.target === ovEl) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ovEl && !ovEl.hidden) close();
    });

    document.getElementById('wfOpen').onclick = function () {
      if (typeof loadWaterProducts === 'function') {
        loadWaterProducts().then(open).catch(open);
      } else {
        open();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
