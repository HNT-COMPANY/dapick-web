// ════════════════════════════════════════════════════════════════════
// finder.js — 상품 찾기 공용 엔진 (2026-08-06 신설)
//
// 무엇을 하나
//   관리자가 만든 질문을 순서대로 묻고, 답에 맞는 상품을 골라 보여준다.
//   '나만의 정수기 찾기' / '나만의 인터넷TV 찾기' 가 같은 코드로 돈다.
//
// 왜 공용인가
//   water-finder.js 는 질문 7개와 가중치가 파일에 박혀 있다. 인터넷TV에 붙이려면
//   복사해야 하고, 복사하는 순간 규칙이 두 벌이 된다. 카테고리가 셋이 되면 세 벌이다.
//   product-faq.js · product-reco.js 와 같은 판단이다.
//
// ★ 왜 "거르기" 가 아니라 "점수" 인가  (2026-08-04 water-finder 의 결론을 그대로 잇는다)
//   조건을 전부 만족하는 것만 남기면 0건이 나오기 쉽다. 상품의 추천 기준값이
//   대부분 비어 있기 때문이다. 0건 화면은 고객에게 "이 사이트엔 없다" 로 읽힌다.
//   그래서 조건마다 점수를 주고 높은 순으로 보여준다. 항상 결과가 나오고,
//   무엇이 맞았는지 적어 줄 수 있어 왜 추천됐는지도 설명된다.
//
// 쓰는 법
//   dpFinder.init({
//     categoryId : '최상위 카테고리 id',        // 필수
//     buttonSlot : 'waterFinder',                // 빈 칸의 id. 버튼은 엔진이 그린다
//                                                // (문구는 어드민 2단계에서 정한다. 화면에 적지 않는다)
//     loadProducts: function () { return Promise.resolve([...]) },  // 필수
//     hrefOf : function (p) { return '/water-detail?id=' + p.id; },
//     imageOf: function (p) { return p.imageUrl; },
//     feeOf  : function (p) { return 0; },      // 없으면 요금을 안 적는다
//     giftOf : function (p) { return p.gift; }, // 지원금 띠 금액. 없으면 gift/cashback 을 본다
//     feeSuffix: '~',
//     onApply: function (p) { ... },            // 결과 카드의 '신청' 버튼
//   });
//   → 그 카테고리에 파인더가 없으면 버튼을 숨기고 조용히 끝낸다.
//
// ★ definition 의 모양은 서버·어드민 편집기와 함께 정한 약속이다.
//   한쪽만 고치면 오류 없이 빈 화면이 된다. 바꿀 때는 세 곳을 같이 본다.
//   (마이그레이션 V20260806003 주석에 전체 모양이 있다)
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // 관리자가 '이 선택지면 무조건 위로' 로 지정한 상품에 주는 점수.
  // 규칙 점수(보통 1~4)보다 확실히 커야 손으로 지정한 뜻이 살아난다.
  var PIN_SCORE = 100;

  var _styled = false;
  var S = null;   // 지금 열려 있는 파인더 상태

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function arr(d) {
    return Array.isArray(d) ? d : (d && (d.data || d.content)) || [];
  }

  // 점(.)으로 안쪽까지 들어간다. 'waterFunction.code' 처럼 쓴다.
  // 중간이 비면 undefined 를 돌려준다 — 규칙이 안 맞을 뿐 오류가 아니다.
  function pathGet(o, path) {
    var cur = o;
    var parts = String(path || '').split('.');
    for (var i = 0; i < parts.length && cur != null; i++) cur = cur[parts[i]];
    return cur;
  }

  // ── 규칙 한 줄이 이 상품에 맞는가 ────────────────────────────────
  //
  // ⚠ 값 비교는 문자열로 한다. 상품 칸이 enum 객체·문자열·숫자로 제각각이라
  //   타입까지 맞추려 들면 조용히 안 맞는 경우가 생긴다(가장 찾기 어려운 종류다).
  function ruleMatch(p, rule) {
    if (!rule || !rule.field) return false;
    // __fee 는 실제 상품 칸이 아니라 '월 요금' 을 가리키는 약속된 이름이다.
    // 정수기는 pricing 이 3단 중첩이라 요금 칸이 따로 없고, 인터넷은 monthlyFee 다.
    // 카테고리마다 다른 칸 이름을 관리자가 외우지 않게 하나로 묶는다.
    var v = rule.field === '__fee' ? feeOf(p) : pathGet(p, rule.field);
    var t = rule.value;

    switch (rule.op) {
      case 'eq':
        return v != null && String(v) === String(t);
      case 'ne':
        return v != null && String(v) !== String(t);
      case 'in':
        return Array.isArray(t) && t.some(function (x) { return String(x) === String(v); });
      case 'contains':
        // 상품 칸이 배열이면 '그 값이 들어 있나', 글자면 '그 글자를 품고 있나'.
        if (Array.isArray(v)) return v.some(function (x) { return String(x) === String(t); });
        return v != null && String(v).indexOf(String(t)) >= 0;
      case 'gte':
        return v != null && Number(v) >= Number(t);
      case 'lte':
        return v != null && Number(v) <= Number(t);
      case 'between':
        // 요금대처럼 '얼마부터 얼마까지' 를 한 줄로 본다.
        // gte 와 lte 두 줄로 나누면 '하나라도 맞으면' 규칙에 걸려 범위가 아니라 둘 중 하나가 된다.
        if (!Array.isArray(t) || t.length < 2) return false;
        return v != null && Number(v) >= Number(t[0]) && Number(v) <= Number(t[1]);
      case 'exists':
        return v != null && v !== '' && !(Array.isArray(v) && !v.length);
      default:
        console.warn('[finder] 모르는 조건: ' + rule.op);
        return false;
    }
  }

  // ── 채점 ─────────────────────────────────────────────────────────
  // 반환 { score, why[] }. why 는 '이래서 골랐어요' 로 쓸 수 있게 남긴다.
  function scoreOf(p) {
    var total = 0;
    var why = [];

    (S.def.questions || []).forEach(function (q) {
      var picked = S.answers[q.key];
      if (picked == null || picked === '') return;
      var vals = Array.isArray(picked) ? picked : [picked];

      vals.forEach(function (v) {
        // ⚠ q.options 가 아니라 q._opts 를 본다.
        // options 는 관리자가 적어 둔 '원본'이고, 실제로 화면에 그려진(그리고 규칙이 붙은)
        // 선택지는 setup() 이 만든 _opts 다. 자동 선택지(브랜드·색)는 규칙이 _opts 에만 있어서
        // options 를 보면 점수가 통째로 0 이 된다. 오류가 안 나서 찾기 어렵다. (2026-08-07)
        var opt = (q._opts || q.options || []).filter(function (o) {
          return String(o.value) === String(v);
        })[0];
        if (!opt) return;

        // 관리자가 손으로 지정한 상품은 규칙을 보지 않는다. 지정이 곧 답이다.
        if (Array.isArray(opt.pin) && opt.pin.some(function (id) { return String(id) === String(p.id); })) {
          total += PIN_SCORE;
          if (opt.why) why.push(opt.why);
          return;
        }

        var hit = false;
        (opt.rules || []).forEach(function (r) {
          if (ruleMatch(p, r)) {
            total += Number(r.score) || 1;
            hit = true;
          }
        });
        if (hit && opt.why) why.push(opt.why);
      });
    });

    return { score: total, why: why };
  }

  // ── 선택지를 상품 데이터에서 만든다 ──────────────────────────────
  //
  // 왜 필요한가: 등록되지 않은 브랜드·색을 고르게 하면 결과가 0건이 된다.
  // 지금 파는 것만 보여준다. 관리자가 상품을 추가하면 선택지도 저절로 늘어난다.
  //
  // optionSource
  //   'brand'          → p.brand (없으면 p.carrier)
  //   'color'          → p.colors[] (배열)
  //   'field:<경로>'   → 그 칸. 배열이면 펼친다
  //
  // ⚠ 어드민 finder-edit-questions.js 의 fqAutoValues 와 같은 규칙이어야 한다.
  //   한쪽만 고치면 관리자가 본 선택지와 고객이 보는 선택지가 달라진다.
  function brandFieldOf(products) {
    // 정수기는 brand, 인터넷·TV 는 carrier 에 브랜드가 들어 있다.
    // 관리자에게 "브랜드인가 통신사인가" 를 묻지 않는다 — 상품을 보고 있는 쪽을 고른다.
    var hasBrand = products.some(function (p) { return p && p.brand; });
    return hasBrand ? 'brand' : 'carrier';
  }

  // '20000-29999' 처럼 생긴 값을 [최소, 최대] 로 읽는다.
  function feeRangeOf(v) {
    var m = String(v == null ? '' : v).match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2])];
  }

  // 요금대 선택지.
  // ★ 관리자가 구간을 손봐 두었으면 그것을 그대로 쓴다.
  //   같은 2만원대라도 '3~4인용' 과 '4~5인 다가구용' 이 따로 있을 수 있어서,
  //   만원 단위로 기계가 나눈 것만으로는 부족하다. (2026-08-08 관리자 요청)
  //   손본 게 없을 때만 아래 자동 제안이 돈다.
  function buildFeeOptions(q, products) {
    var custom = (q.options || []).filter(function (o) { return feeRangeOf(o && o.value); });
    if (custom.length) {
      var w2 = Number(q.weight) || 3;
      return custom.map(function (o) {
        var r = feeRangeOf(o.value);
        return {
          value: o.value,
          label: o.label || (Math.floor(r[0] / 10000) + '만원대'),
          desc: o.desc || '',
          image: o.image || '',
          why: o.why || o.label || '',
          // 관리자가 4단계에서 따로 조건을 만들었으면 그것이 이긴다.
          rules: (o.rules && o.rules.length)
            ? o.rules
            : [{ field: '__fee', op: 'between', value: [r[0], r[1]], score: w2 }],
          pin: o.pin || [],
        };
      });
    }
    var STEP = 10000;
    var buckets = {};
    products.forEach(function (p) {
      var f = feeOf(p);
      if (!(f > 0)) return;
      var k = Math.floor(f / STEP);
      buckets[k] = (buckets[k] || 0) + 1;
    });
    var keys = Object.keys(buckets).map(Number).sort(function (a, b) { return a - b; });
    if (!keys.length) return [];

    var preset = {};
    (q.options || []).forEach(function (o) { preset[String(o.value)] = o; });
    var w = Number(q.weight) || 3;

    return keys.map(function (k, i) {
      var min = k * STEP;
      var max = min + STEP - 1;
      var value = min + '-' + max;
      var base = preset[value] || {};
      // 마지막 구간은 위가 열려 있다고 적는다. '4만원대' 보다 '4만원 이상' 이 정직하다.
      var last = i === keys.length - 1;
      var label = base.label || (last
        ? Math.floor(min / STEP) + '만원 이상'
        : (min === 0 ? '1만원 미만' : Math.floor(min / STEP) + '만원대'));
      return {
        value: value,
        label: label,
        desc: base.desc || (buckets[k] + '개 상품'),
        image: base.image || '',
        why: base.why || label,
        rules: [{ field: '__fee', op: 'between',
                  value: [min, last ? 9999999 : max], score: w }],
        pin: base.pin || [],
      };
    });
  }

  function buildDynamicOptions(q, products) {
    var src = q.optionSource;
    if (!src) return q.options || [];
    if (src === 'fee') return buildFeeOptions(q, products);

    var field = src === 'brand' ? brandFieldOf(products)
      : src === 'color' ? 'colors'
      : String(src).replace(/^field:/, '');
    var isArrayField = false;
    var seen = {};

    products.forEach(function (p) {
      var v = pathGet(p, field);
      if (v == null || v === '') return;
      if (Array.isArray(v)) {
        isArrayField = true;
        v.forEach(function (x) { if (x != null && x !== '') seen[x] = (seen[x] || 0) + 1; });
      } else {
        seen[v] = (seen[v] || 0) + 1;
      }
    });

    // 관리자가 같은 value 로 라벨을 미리 적어 뒀으면 그 글자를 쓴다.
    var preset = {};
    (q.options || []).forEach(function (o) { preset[String(o.value)] = o; });

    return Object.keys(seen)
      .sort(function (a, b) { return seen[b] - seen[a]; })
      .map(function (v) {
        var base = preset[v] || {};
        // ⚠ 라벨을 안 적어두면 코드값(coway·sk)이 그대로 화면에 나온다.
        //   2026-08-06 에 실제로 그렇게 나가서 되돌렸다. 어드민에서 값마다 라벨과
        //   이미지를 미리 적어 두면 여기서 그대로 물려받는다.
        if (!base.label) {
          console.warn('[finder] 선택지 "' + v + '" 에 라벨이 없어 코드값이 그대로 나온다. 어드민에서 이름을 적어주세요.');
        }
        return {
          value: v,
          label: base.label || v,
          desc: base.desc || '',
          image: base.image || '',
          why: base.why || (base.label || v),
          pin: base.pin || [],
          rules: base.rules || [
            { field: field, op: isArrayField ? 'contains' : 'eq', value: v, score: Number(q.weight) || 3 },
          ],
        };
      });
  }

  // ── 화면 ─────────────────────────────────────────────────────────
  function el() {
    var e = document.getElementById('dpf-ov');
    if (e) return e;
    e = document.createElement('div');
    e.id = 'dpf-ov';
    e.className = 'dpf-ov';
    e.hidden = true;
    document.body.appendChild(e);
    e.addEventListener('click', function (ev) {
      if (ev.target === e || (ev.target.closest && ev.target.closest('[data-dpf-close]'))) close();
    });
    return e;
  }

  function resetRun() {
    S.answers = {};
    // 검색으로 들어왔다가 '다시 고르기' 를 누른 것이다. 이제부터는 답으로 고른 결과다.
    // 안 끄면 질문에 다 답해도 화면이 계속 "‘정수기’ 로 찾았습니다" 라고 말한다 (2026-08-10).
    S.search = null;
    S.cur = -1;   // -1 = 안내 화면
    S.chip = -1;  // 켜 둔 필터 칩. -1 = 없음
    S.pick = null;  // 결과에서 고른 상품 id. 하단 신청 버튼이 이걸 싣고 간다
    clearTimeout(S.waitT);
  }

  function show() {
    el().hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function open() {
    if (!S || !S.def) return;
    injectStyles();
    resetRun();
    show();
    paintEntryWait();
  }

  // 결과에서 '다시 고르기'.
  // ⚠ open() 을 쓰지 않는다. 두 번째부터는 앞의 기다림이 방해다 —
  //   이미 무엇을 하는 화면인지 아는 사람에게 또 3초를 세우면 그냥 닫는다.
  function restart() {
    if (!S || !S.def) return;
    injectStyles();
    resetRun();
    show();
    paint();
  }

  /**
   * 질문을 건너뛰고 결과부터 연다 — 메인 검색창이 쓴다 (2026-08-10).
   *
   * ★ 왜 질문을 건너뛰나
   *   검색창에 무언가를 적은 사람은 이미 말을 했다. 거기에 대고 다시 7문항을 물으면
   *   "물어보라며" 가 된다. 검색어가 곧 답이라고 보고 결과로 간다.
   *
   * ★ 왜 결과 화면을 따로 안 만들었나
   *   지원금 문구·배지·칩·신청 세 버튼이 전부 어드민에 있고 이 파일이 그린다.
   *   검색용으로 한 벌 더 만들면 관리자가 어드민에서 문구를 고쳐도 검색 결과만 옛말을 한다.
   *
   * ⚠ 답이 없으니 모든 상품이 0점이다. rank() 가 검색일 때만 지원금 순으로 갈라 준다.
   *   그 분기가 없으면 검색 결과가 관리자 정렬순서 그대로 나온다.
   */
  function openResult(q) {
    if (!S || !S.def) return;
    injectStyles();
    S.answers = {};
    S.cur = -1;
    S.chip = -1;
    S.pick = null;
    S.search = { q: String(q == null ? '' : q).trim() };
    el().hidden = false;
    document.body.style.overflow = 'hidden';
    paintLoading();   // 로딩 문구·기다리는 시간은 어드민 2단계 것을 그대로 쓴다
  }

  function close() {
    var e = document.getElementById('dpf-ov');
    if (e) e.hidden = true;
    document.body.style.overflow = '';
    // ⚠ 기다림 중에 닫았을 수 있다. 안 끄면 몇 초 뒤 타이머가 깨어나
    //   닫아 둔 창을 결과 화면으로 갈아엎고, 그 사이 다시 열면 질문을 건너뛴다.
    if (S) clearTimeout(S.waitT);
  }

  function steps() {
    return S.def.questions || [];
  }

  function isPicked(key, v) {
    var a = S.answers[key];
    if (Array.isArray(a)) return a.some(function (x) { return String(x) === String(v); });
    return a != null && String(a) === String(v);
  }

  function pick(q, v) {
    if (q.multi) {
      var list = Array.isArray(S.answers[q.key]) ? S.answers[q.key].slice() : [];
      var i = list.findIndex(function (x) { return String(x) === String(v); });
      if (i >= 0) list.splice(i, 1);
      else list.push(v);
      S.answers[q.key] = list;
      paint();                 // 여러 개 고르는 문항은 '다음' 을 눌러야 넘어간다
      return;
    }
    S.answers[q.key] = v;
    next();                    // 하나만 고르는 문항은 고르는 즉시 넘어간다
  }

  function next() {
    if (S.cur >= steps().length - 1) { paintLoading(); return; }
    S.cur += 1;
    paint();
  }

  function prev() {
    if (S.cur <= -1) return;
    S.cur -= 1;
    paint();
  }

  // 이미지가 붙은 선택지가 하나라도 있으면 카드 배열로 그린다.
  // 브랜드처럼 로고를 보고 고르는 문항은 세로 목록보다 카드가 훨씬 빠르다.
  // layout 을 관리자가 직접 정할 수도 있다('card' | 'list').
  function isCardLayout(q, opts) {
    if (q.layout === 'card') return true;
    if (q.layout === 'list') return false;
    return opts.some(function (o) { return o.image; });
  }

  // 관리자가 적어 둔 해시태그. #을 안 붙였으면 우리가 붙인다.
  function tagsHtml(o) {
    var list = o.hashtags || [];
    if (!list.length) return '';
    return '<span class="dpf-opt-tags">' + list.map(function (t) {
      var s = String(t || '').trim();
      if (!s) return '';
      return '<span>' + esc(s.charAt(0) === '#' ? s : '#' + s) + '</span>';
    }).join('') + '</span>';
  }

  function optionHtml(q, o) {
    var on = isPicked(q.key, o.value) ? ' is-on' : '';
    var badge = o.badge ? '<span class="dpf-opt-badge">' + esc(o.badge) + '</span>' : '';
    var body =
      '<span class="dpf-opt-l">' + esc(o.label) + '</span>' +
      (o.desc ? '<span class="dpf-opt-d">' + esc(o.desc) + '</span>' : '') +
      tagsHtml(o);

    if (o.image) {
      return (
        '<button type="button" class="dpf-opt dpf-opt--card' + on + '" data-v="' + esc(o.value) + '">' +
        badge +
        '<span class="dpf-opt-img"><img src="' + esc(o.image) + '" alt="" loading="lazy"/></span>' +
        '<span class="dpf-opt-body">' + body + '</span>' +
        '</button>'
      );
    }
    return (
      '<button type="button" class="dpf-opt' + on + '" data-v="' + esc(o.value) + '">' +
      badge + body +
      '</button>'
    );
  }

  // 진행바. 몇 개 남았는지 먼저 알려주면 중간에 덜 나간다.
  function progressHtml() {
    var n = steps().length;
    var i = Math.max(0, S.cur);
    var pct = S.cur < 0 ? 0 : Math.round(((i + 1) / n) * 100);
    var left = n - i;
    return (
      '<div class="dpf-prog">' +
      '<div class="dpf-prog-top">' +
      '<span>' + (S.cur < 0 ? n + '개의 질문에만 답하면 돼요!' : left + '개 남았어요') + '</span>' +
      '<b>' + pct + '%</b></div>' +
      '<div class="dpf-prog-bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>'
    );
  }

  // 관리자가 적어 둔 도움말. <details> 를 쓰면 여닫기를 우리가 안 만들어도 된다.
  function helpsHtml(q) {
    var list = (q && q.helps) || [];
    if (!list.length) return '';
    return '<div class="dpf-helps">' + list.map(function (h) {
      return '<details class="dpf-help"><summary>💡 ' + esc(h.q || '') + '</summary>' +
        '<p>' + esc(h.a || '') + '</p></details>';
    }).join('') + '</div>';
  }

  function paint() {
    var ov = el();

    // 안내 화면 (2026-08-10 다시 그림)
    //
    // ★ 무엇을 몇 개 묻는지 먼저 보여준다
    //   전에는 제목 한 줄과 시작 버튼뿐이었다. 몇 개인지 모르고 시작하면
    //   두 번째 질문에서 "언제 끝나지" 가 되고 거기서 나간다.
    //
    // ⚠ 목록은 관리자가 2단계에 적은 것만 쓴다 (2026-08-10 고침).
    //   처음에는 3단계 질문 제목을 자동으로 끌어다 깔았는데, 그건 관리자가 고른 것이 아니다.
    //   질문 제목은 "몇 분이 함께 쓰시나요?" 처럼 길어서 그대로 늘어놓으면
    //   이 화면이 또 하나의 벽이 된다. 관리자가 "사용 인원" 처럼 추려 적어야 한다.
    //   비워 두면 목록 자체가 안 나온다 — 없던 파인더에 저절로 생기지 않는다.
    if (S.cur < 0) {
      var intro = S.def.intro || {};

      // '확인 완료' 는 앞에서 실제로 기다렸을 때만 참말이다.
      // 관리자가 앞 기다림을 껐으면(ms=0) 이 딱지는 거짓말이라 안 붙인다.
      var waited = Number(((S.def.entry || {}).loading || {}).ms) !== 0;
      var badge = (waited && intro.badge !== '')
        ? '<span class="dpf-ibadge">' + esc(intro.badge || '확인 완료') + '</span>' : '';

      var rows = String(intro.list || '').split('\n')
        .map(function (t) { return String(t).trim(); })
        .filter(Boolean)
        .map(function (t, i) {
          return '<div class="dpf-irow"><span class="dpf-ino">' + (i + 1) + '</span>' +
            '<span class="dpf-iv">' + esc(t) + '</span></div>';
        }).join('');

      // 지름길 — 고를 것이 많으면 나간다. 지원금만 궁금한 사람에게 문을 하나 둔다.
      // 관리자가 intro.skipOn 을 false 로 두면 없앤다.
      var skip = intro.skipOn === false ? '' :
        '<button type="button" class="dpf-skip" data-dpf-skip>' +
        esc(intro.skipLabel || '지원금 많은 순으로 바로 볼게요') + '</button>';

      ov.innerHTML =
        '<div class="dpf-box dpf-box--intro">' +
        '<div class="dpf-head">' + badge +
        '<button type="button" class="dpf-x" data-dpf-close aria-label="닫기">✕</button></div>' +
        '<h2 class="dpf-ih">' + esc(intro.title || S.name || '상품 찾기') + '</h2>' +
        (intro.sub ? '<p class="dpf-isub">' + esc(intro.sub) + '</p>' : '') +
        (rows ? '<div class="dpf-ilist">' + rows + '</div>' : '') +
        '<button type="button" class="dpf-go" data-dpf-next>' +
        esc(intro.buttonLabel || '시작하기') + '</button>' + skip +
        '</div>';
      ov.querySelector('[data-dpf-next]').onclick = next;
      // 지름길은 검색으로 들어온 것과 같은 자리다 — 질문을 건너뛰고 지원금 큰 순으로.
      var sk = ov.querySelector('[data-dpf-skip]');
      if (sk) sk.onclick = function () { openResult(''); };
      return;
    }

    var q = steps()[S.cur];
    if (!q) { paintLoading(); return; }

    var opts = q._opts || [];
    ov.innerHTML =
      '<div class="dpf-box">' +
      '<div class="dpf-head">' + progressHtml() +
      '<button type="button" class="dpf-x" data-dpf-close aria-label="닫기">✕</button></div>' +
      '<div class="dpf-qhead">' +
      '<span class="dpf-qno">' + (S.cur + 1) + '</span>' +
      '<div><h2 class="dpf-q">' + esc(q.title || '') + '</h2>' +
      (q.sub ? '<p class="dpf-qsub">' + esc(q.sub) + '</p>' : '') +
      // multi 는 관리자가 따로 안 적어도 우리가 알려준다. 안 적으면 하나만 고르고 멈춘다.
      (q.multi ? '<p class="dpf-qmulti">(여러 개 선택 가능)</p>' : '') +
      '</div></div>' +
      // 카드 배치는 개수에 따라 열을 정한다.
      // 2열 고정이면 3개일 때 2+1 로 아래가 비어 한쪽으로 쏠려 보인다.
      // 3개까지는 한 줄에, 4개부터는 3개씩 아래로 쌓는다. (2026-08-08 관리자 요청)
      '<div class="dpf-opts' + (isCardLayout(q, opts) ? ' dpf-opts--card dpf-opts--n' + Math.min(3, opts.length || 1) : '') +
        (q.layout === 'row' ? ' dpf-opts--row' : '') + '">' +
      opts.map(function (o) { return optionHtml(q, o); }).join('') +
      '</div>' +
      helpsHtml(q) +
      '<div class="dpf-foot">' +
      '<button type="button" class="dpf-sub" data-dpf-prev>이전</button>' +
      (q.multi || q.skippable
        ? '<button type="button" class="dpf-go dpf-go--sm" data-dpf-next>' +
          (q.multi ? '다음' : '건너뛰기') + '</button>'
        : '') +
      '</div></div>';

    ov.querySelectorAll('.dpf-opt').forEach(function (b) {
      b.onclick = function () { pick(q, b.dataset.v); };
    });
    ov.querySelector('[data-dpf-prev]').onclick = prev;
    var nx = ov.querySelector('[data-dpf-next]');
    if (nx) nx.onclick = next;

    // 선택지가 하나도 없는 문항은 넘긴다. 빈 화면을 보여주면 고장으로 읽힌다.
    if (!opts.length) {
      console.warn('[finder] 선택지가 없는 문항을 건너뛴다: ' + q.key);
      next();
    }
  }

  // 정수기 pricing 은 약정 → 관리주기 → 조건 3단 중첩이라 값이 여러 개다.
  // 아무거나 고르면 상세로 들어갔을 때 숫자가 달라지므로 가장 싼 값을 쓰고 뒤에 '~' 를 붙인다.
  function minPricing(pr) {
    var min = 0;
    Object.keys(pr).forEach(function (a) {
      var b = pr[a];
      if (!b || typeof b !== 'object') return;
      Object.keys(b).forEach(function (c) {
        var d = b[c];
        if (!d || typeof d !== 'object') return;
        Object.keys(d).forEach(function (e) {
          var v = d[e] && Number(d[e].monthly);
          if (v > 0 && (!min || v < min)) min = v;
        });
      });
    });
    return min;
  }

  // 월 요금. 화면이 feeOf 를 넘기면 그것을 쓰고, 없으면 상품에서 스스로 찾는다.
  // ⚠ 어드민 미리보기에는 연결층(water-finder-v2.js 같은 것)이 없다.
  //   여기서 스스로 못 찾으면 미리보기에만 요금이 안 나와서, 관리자가
  //   "요금이 왜 안 뜨지" 로 시간을 버린다. 실제 고객 화면은 멀쩡한데도 그렇다.
  function feeOf(p) {
    if (!p || typeof p !== 'object') return 0;
    // ★ 조합 상품은 관리자가 적은 요금이 정답이다 (2026-08-10).
    //   연결층의 feeOf 는 상품 표를 읽는데, 조합은 상품 표에 없어서 늘 0 이 나온다.
    if (p.__combo) return Number(p.__combo.fee) || 0;
    // ⚠ 어드민 4단계가 이 함수를 밖에서 직접 부른다. 그때는 S 가 아직 없다.
    if (S && S.opt && typeof S.opt.feeOf === 'function') return Number(S.opt.feeOf(p)) || 0;
    if (p.monthlyFee != null) return Number(p.monthlyFee) || 0;
    if (p.monthlyPrice != null) return Number(p.monthlyPrice) || 0;
    if (p.pricing && typeof p.pricing === 'object') return minPricing(p.pricing);
    return Number(p.price || 0) || 0;
  }

  function feeSuffix(p) {
    if (S.opt.feeSuffix != null) return S.opt.feeSuffix;
    // 스스로 찾은 값이 '가장 싼 조합' 이면 그 사실을 숨기지 않는다.
    return (typeof S.opt.feeOf !== 'function' && p.pricing) ? '~' : '';
  }

  function feeHtml(p) {
    var n = Number(feeOf(p));
    if (!isFinite(n) || n <= 0) return '';
    return '<div class="dpf-fee">월 <b>' + n.toLocaleString('ko-KR') + '</b>원' +
      esc(feeSuffix(p)) + '</div>';
  }

  // ── 로딩 → 결과 ─────────────────────────────────────────────────
  //
  // 마지막 질문을 고른 순간 결과가 툭 나오면 "이게 다야?" 로 읽힌다.
  // 잠깐 찾는 시늉을 하는 편이 낫다. 시간은 관리자가 못 정한다 — 1.2초로 고정한다.
  // ── 진입 버튼 ─────────────────────────────────────────────────
  //
  // 화면(연결층)은 빈 칸 하나만 두고, 문구는 전부 어드민 2단계에서 온다.
  // ★ 여기 글자를 화면 파일에 적지 않는 이유 — 적는 순간 문구 하나 바꾸는 데
  //   개발자와 배포가 필요해진다. 후킹 문구는 자주 바뀌는 값이다.
  // 진입 버튼 기본 아이콘 — 얇은 선 돋보기 (2026-08-10).
  //
  // ⚠ 기본을 이모지(🔎)로 두지 않는다.
  //   기기·브라우저마다 다른 그림이 나오고, 혼자만 컬러라 화면에서 튄다.
  //   관리자가 굳이 이모지를 적으면 그건 그대로 쓴다 — 막지는 않는다.
  var ICO_SEARCH =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>';
  var ICO_CHEV =
    '<svg width="9" height="16" viewBox="0 0 9 16" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M1.5 1.5L7.5 8l-6 6.5"/></svg>';

  /**
   * 진입 버튼에 적을 금액 (2026-08-10).
   *
   * ★ 관리자가 적은 값만 쓴다. 상품에서 자동으로 뽑지 않는다.
   *   자동으로 뽑으면 상품 하나 손봤을 뿐인데 버튼의 광고 문구가 저절로 바뀐다.
   *   화면에 적히는 금액은 사람이 책임지고 적어야 하는 값이다.
   *   (결과 화면의 reward.amount 는 비우면 자동으로 채운다 — 거긴 성격이 다르다.
   *    거긴 '이번에 고른 조건에서 나온 값' 이고, 여긴 '늘 걸려 있는 간판' 이다.)
   */
  function entryAmount() {
    return String((S.def.entry || {}).amount || '').trim();
  }

  function mountEntry(slot) {
    injectStyles();
    var e = S.def.entry || {};
    var bubble = e.bubble || '';
    var amount = entryAmount();
    var title = e.title || S.name || '나만의 상품 찾기';

    // 금액을 적어 놓고 제목에 {금액} 을 안 넣으면 화면에 안 나온다.
    // 조용히 사라지면 관리자는 왜 안 나오는지 못 찾는다. 제목 위에 따로 얹고 경고를 남긴다.
    var orphan = '';
    if (amount && String(title).indexOf('{금액}') < 0) {
      orphan = '<span class="dpf-cta-amt">' + esc(amount) + '</span>';
      console.warn('[finder] 진입 버튼 금액을 적었는데 제목에 {금액} 이 없다. 제목 위에 따로 얹는다');
    }

    slot.innerHTML =
      (bubble ? '<span class="dpf-cta-bub">' + esc(bubble) + '</span>' : '') +
      '<button type="button" class="dpf-cta">' +
      '<span class="dpf-cta-ico">' + (e.icon ? esc(e.icon) : ICO_SEARCH) + '</span>' +
      '<span class="dpf-cta-txt">' + orphan +
      '<b>' + fillTokens(title, amount) + '</b>' +
      (e.sub ? '<em>' + esc(e.sub) + '</em>' : '') + '</span>' +
      '<span class="dpf-cta-go">' +
      (e.label ? '<span class="dpf-cta-lb">' + esc(e.label) + '</span>' : '') +
      ICO_CHEV + '</span>' +
      '</button>';
    var btn = slot.querySelector('.dpf-cta');
    if (btn) btn.addEventListener('click', open);
  }

  // ══════════════════════════════════════════════════════════════════
  // 따라오는 진입 버튼 (2026-08-11) — opt.sticky 를 켠 화면에만 붙는다
  //
  // 왜 만들었나
  //   인터넷·TV 화면은 배너 → 통신사 카드 → 요금 문의 → 후기 → 질문으로 길다.
  //   맨 위 진입 버튼은 한 번만 내려도 화면 밖으로 사라지고, 그 뒤로는 파인더로
  //   돌아갈 길이 아예 없다. 길이가 긴 화면일수록 파인더를 만든 값을 못 받는다.
  //
  // ★ 문구를 따로 만들지 않는다
  //   어드민 2단계의 진입 버튼 제목·금액·아이콘을 그대로 쓴다. 따로 두면 관리자가
  //   한쪽만 고쳐서 같은 화면의 두 버튼이 다른 말을 하게 된다.
  //
  // ★ 원래 버튼이 보이는 동안은 안 띄운다
  //   같은 문구가 두 번 보이면 고장으로 읽힌다. IntersectionObserver 를 쓴다 —
  //   scroll 마다 위치를 재면 긴 화면에서 스크롤이 버벅인다.
  //   ⚠ '안 보임' 만으로는 부족하다. 화면 아래로 아직 안 나온 경우도 안 보임이라,
  //     그것만 보면 페이지 맨 위에서부터 따라오는 버튼이 떠 버린다.
  //     위로 지나간 경우(top < 0)만 띄운다.
  //
  // ★ 오버레이보다 아래 층(z-index 8000)에 둔다
  //   파인더 덮개(9000)·간편신청 덮개(9500)가 화면을 다 덮으므로 따로 숨기지 않아도
  //   가려진다. 숨기는 코드를 따로 두면 닫을 때 되살리는 것을 잊기 쉽다.
  // ══════════════════════════════════════════════════════════════════
  var STK = { el: null, obs: null, on: false };

  function stickyShow(v) {
    if (!STK.el || STK.on === v) return;
    STK.on = v;
    STK.el.hidden = !v;
    // 폰에서는 화면 아래 가로바다. 마지막 줄(푸터·신청 버튼)을 덮지 않게 자리를 만든다.
    document.body.classList.toggle('dpf-stk-pad', v);
  }

  function mountSticky(slot) {
    if (STK.el || !slot) return;                              // 한 화면에 하나만
    if (typeof IntersectionObserver !== 'function') return;   // 없는 브라우저는 조용히 넘어간다

    var e = S.def.entry || {};
    var amount = entryAmount();
    var title = e.stickyTitle || e.title || S.name || '나만의 상품 찾기';
    // 어드민 2단계의 짧은 글자(label). PC 세로 리모컨은 폭이 86px 이라 긴 제목이 안 들어간다.
    // 짧은 말이 적혀 있으면 그걸 쓰고, 없으면 제목을 넣고 네 줄에서 자른다.
    var label = String(e.label == null ? '' : e.label).trim();

    var wrap = document.createElement('div');
    wrap.className = 'dpf-stk-wrap' + (label ? ' has-lb' : '');
    wrap.hidden = true;
    wrap.innerHTML =
      '<button type="button" class="dpf-stk" title="' + esc(fillTokensPlain(title, amount)) + '">' +
      '<span class="dpf-stk-ico">' + (e.icon ? esc(e.icon) : ICO_SEARCH) + '</span>' +
      '<span class="dpf-stk-tx">' + fillTokens(title, amount) + '</span>' +
      (label ? '<span class="dpf-stk-lb">' + esc(label) + '</span>' : '') +
      '<span class="dpf-stk-go">' + ICO_CHEV + '</span>' +
      '</button>';
    document.body.appendChild(wrap);
    STK.el = wrap;

    var b = wrap.querySelector('.dpf-stk');
    if (b) b.addEventListener('click', open);

    STK.obs = new IntersectionObserver(function (list) {
      list.forEach(function (x) {
        stickyShow(!x.isIntersecting && x.boundingClientRect.top < 0);
      });
    }, { threshold: 0 });
    STK.obs.observe(slot);
  }

  // 폰에서 요금 문의 입력칸에 글을 쓰는 동안은 비켜 준다.
  // 키보드가 올라오면 화면이 반으로 줄고, 그 위에 가로바까지 얹히면 입력칸이 안 보인다.
  document.addEventListener('focusin', function (ev) {
    if (!STK.el) return;
    var t = ev.target;
    var tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') STK.el.classList.add('is-away');
  });
  document.addEventListener('focusout', function () {
    if (STK.el) STK.el.classList.remove('is-away');
  });

  // 도는 고리. 점 네 개 대신 이걸 쓴다 (2026-08-10).
  // 점은 '뭔가 멈춰 있나' 로 읽히고, 도는 고리는 계속 일하고 있다는 뜻으로 읽힌다.
  var ICO_SPIN =
    '<svg viewBox="0 0 50 50" fill="none" aria-hidden="true">' +
    '<circle cx="25" cy="25" r="21" stroke="#f0e9fc" stroke-width="5"/>' +
    '<path d="M25 4a21 21 0 0 1 21 21" stroke="#6c3fc5" stroke-width="5" stroke-linecap="round"/></svg>';

  /**
   * 기다림 화면. 두 자리에서 같은 모양으로 쓴다 (2026-08-10).
   *
   *   ① 버튼을 누른 직후 (entry.loading)  — 아직 아무것도 안 물어봤다
   *   ② 답을 다 한 뒤   (loading)         — 실제로 계산이 돈다
   *
   * ★ 두 벌로 만들지 않는다. 한쪽만 고쳐지면 같은 파인더인데 화면이 두 얼굴이 된다.
   *
   * @param cfg  { title, sub, ms, imageUrl }
   * @param next 시간이 지나면 부를 것
   * @param dflt 문구를 하나도 안 적었을 때 쓸 기본값 [첫줄, 둘째줄, 기본ms]
   */
  function paintWait(cfg, next, dflt) {
    var l = cfg || {};
    var lines = [];
    if (l.title) lines.push(l.title);
    if (l.sub) lines.push(l.sub);
    // lines(배열)는 옛 정의와의 호환용이다.
    if (!lines.length) lines = l.lines || [dflt[0], dflt[1]];

    var ms = Number(l.ms);
    if (!(ms >= 0)) ms = dflt[2];

    // 관리자가 그림을 넣으면 고리 대신 그것이 나온다.
    var art = l.imageUrl
      ? '<div class="dpf-load-img"><img src="' + esc(l.imageUrl) + '" alt=""/></div>'
      : '<div class="dpf-spin">' + ICO_SPIN + '</div>';

    el().innerHTML =
      '<div class="dpf-box dpf-box--load">' + art +
      lines.map(function (t, i) {
        return '<p class="dpf-load-t' + (i ? ' dpf-load-s' : '') + '">' + esc(t) + '</p>';
      }).join('') +
      (ms >= 1000 ? '<p class="dpf-load-n">약 ' + Math.round(ms / 1000) + '초</p>' : '') +
      '</div>';

    // ⚠ 반드시 하나만 돈다. 안 그러면 뒤로 갔다 다시 왔을 때 옛 타이머가
    //   지금 보고 있는 화면을 갈아엎는다.
    clearTimeout(S.waitT);
    S.waitT = setTimeout(next, ms);
  }

  // ① 버튼을 누른 직후. 아직 아무것도 안 물어봤다.
  //
  // ★ 왜 묻기도 전에 기다리게 하나
  //   "내 것을 찾아주는 중" 이라는 느낌을 먼저 만든다. 질문부터 들이밀면 시험지가 된다.
  //   ⚠ 대신 여기서 나가는 사람이 생긴다. 아무것도 안 받았는데 기다리게 하는 자리다.
  //     그래서 초를 어드민에서 정하고, 0 으로 두면 이 화면을 통째로 건너뛴다.
  function paintEntryWait() {
    var l = (S.def.entry || {}).loading || {};
    var ms = Number(l.ms);
    if (ms === 0) { S.cur = -1; paint(); return; }   // 관리자가 껐다
    paintWait(l, function () { S.cur = -1; paint(); },
      ['내 지원금을 확인하고 있어요', '잠시만 기다려주세요', 3000]);
  }

  // ② 답을 다 한 뒤. 여기는 실제로 계산이 도는 자리라 기다림이 납득된다.
  function paintLoading() {
    paintWait(S.def.loading, paintResult,
      ['최대 지원금 상품을 찾고 있어요', '잠시만 기다려주세요', 5000]);
  }

  // 점수 순으로 줄 세운다. 칩은 여기서 거르지 않는다 — 칩을 껐을 때 되돌아와야 한다.
  //
  // ★ 검색으로 들어온 경우는 지원금 큰 순이다 (2026-08-10)
  //   메인 검색창은 질문을 하지 않는다. 답이 없으니 모든 상품이 0점이고,
  //   그대로 두면 관리자 정렬순서(sortOrder)대로 나온다 — 검색어와 아무 상관이 없다.
  //   기획서의 결과 문구가 "최대 지원금 많이 받을 수 있는 상품" 이므로 그 말에 맞춘다.
  //   ⚠ 검색이 아닌 보통 파인더의 동점 처리는 건드리지 않았다.
  //     관리자가 정한 순서를 지원금이 덮어쓰면 4단계에서 맞춰 둔 순서가 무의미해진다.
  function rank() {
    var search = !!S.search;
    return S.products
      .map(function (p) {
        var sc = scoreOf(p);
        return { p: p, s: sc.score, why: sc.why };
      })
      .sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        if (search) {
          // ★ 관리자가 적어 둔 상품이 먼저다 (2026-08-10 사장님 결정).
          //   상품 표에 우연히 큰 숫자가 들어 있는 것보다, 사람이 골라 적은 것이 앞선다.
          var ia = giftInfo(a.p), ib = giftInfo(b.p);
          if (ia.set !== ib.set) return ia.set ? -1 : 1;
          if (ib.v !== ia.v) return ib.v - ia.v;
        }
        return (a.p.sortOrder || 999) - (b.p.sortOrder || 999);
      });
  }

  // 결과를 어느 묶음으로 나눠 볼지. 정수기는 브랜드, 인터넷·TV 는 통신사다.
  // 화면이 groupOf 를 넘기면 그것을 쓴다(카테고리마다 칸 이름이 다를 수 있다).
  function groupOf(p) {
    if (typeof S.opt.groupOf === 'function') return S.opt.groupOf(p);
    return p.brand || p.carrier || '';
  }

  // 한 브랜드가 결과를 다 먹지 않게 묶음당 개수를 제한한다. 4자리면 한 브랜드에 2개까지다.
  // ⚠ 묶음을 모르는 상품(관리자가 만든 카테고리 등)은 제한하지 않는다 —
  //   전부 빈 문자열로 묶여 한 덩어리가 되면 자리가 남는다.
  function balanced(rows, limit) {
    var perGroup = Math.max(1, Math.ceil(limit / 2));
    var out = [];
    var used = {};
    rows.forEach(function (x) {
      if (out.length >= limit) return;
      var g = groupOf(x.p);
      if (!g) { out.push(x); return; }
      used[g] = used[g] || 0;
      if (used[g] >= perGroup) return;
      used[g] += 1;
      out.push(x);
    });
    // 제한 때문에 자리가 비면 남은 것으로 채운다. 고객에게 빈자리를 보이지 않는다.
    if (out.length < limit) {
      rows.forEach(function (x) {
        if (out.length >= limit || out.indexOf(x) >= 0) return;
        out.push(x);
      });
    }
    return out;
  }

  // 조건 하나라도 맞으면 걸린다. 어드민 finder-edit-rules.js 의 frMatch 와 같은 규칙이다.
  function rulesHit(p, rules) {
    return (rules || []).some(function (r) { return ruleMatch(p, r); });
  }

  // 이 상품에 붙는 배지. 관리자가 조건으로 정한다(예: 월 요금 2만원 이하면 '알뜰').
  function badgesOf(p) {
    return ((S.def.result || {}).badges || []).filter(function (b) {
      return rulesHit(p, b.rules);
    });
  }

  function chipsHtml() {
    var list = ((S.def.result || {}).filters || []).filter(function (f) { return (f.rules || []).length; });
    if (!list.length) return '';
    return '<div class="dpf-chips">' + list.map(function (f, i) {
      return '<button type="button" class="dpf-chip' + (S.chip === i ? ' is-on' : '') +
        '" data-chip="' + i + '">' + esc(f.label || '') + '</button>';
    }).join('') + '</div>';
  }

  // 결과 카드는 한 줄 4개까지만 보여준다 (2026-08-08).
  // 더 늘리면 줄바꿈이 생겨 "1등부터 4등" 이라는 그림이 깨지고,
  // 고객이 고를 것이 많아질수록 아무것도 안 고르고 나간다.
  var RES_MAX = 4;

  // 금액을 사람이 읽는 말로. 470000 → 47만원
  function moneyKo(n) {
    n = Number(n) || 0;
    if (n <= 0) return '';
    if (n < 10000) return n.toLocaleString('ko-KR') + '원';
    var man = Math.round((n / 10000) * 10) / 10;
    return man + '만원';
  }

  /**
   * 상품 하나에 걸린 지원금 (2026-08-10 다시 씀).
   *
   * ★ 관리자가 4단계에서 적은 값이 가장 세다.
   *   상품 표의 gift 는 상세 화면용이라 파인더에 그대로 쓰기엔 안 맞을 때가 있고,
   *   인터넷TV 처럼 화면에서 펼쳐 만든 줄(p-kt::500M)은 상품 표에 아예 없다.
   *   그런 줄에도 지원금을 걸 수 있어야 해서 파인더가 자기 값을 따로 들고 있는다.
   *
   * @returns { v: 금액, set: 관리자가 직접 적었나 }
   */
  function giftInfo(p) {
    if (!p || typeof p !== 'object') return { v: 0, set: false };
    var m = (S && S.def && S.def.result && S.def.result.gifts) || null;
    if (m) {
      var typed = Number(m[String(p.id)]);
      if (typed > 0) return { v: typed, set: true };
    }
    if (S && S.opt && typeof S.opt.giftOf === 'function') return { v: Number(S.opt.giftOf(p)) || 0, set: false };
    if (p.gift != null) return { v: Number(p.gift) || 0, set: false };
    if (p.giftAmount != null) return { v: Number(p.giftAmount) || 0, set: false };
    if (p.cashback != null) return { v: Number(p.cashback) || 0, set: false };
    return { v: 0, set: false };
  }

  function giftOf(p) { return giftInfo(p).v; }

  // 로그인한 고객의 이름. 없으면 '고객'.
  // ⚠ localStorage 는 시크릿 모드나 쿠키 차단에서 통째로 던진다. 감싸 둔다.
  function userName() {
    try {
      var n = window.localStorage && localStorage.getItem('dapick_nick');
      n = n && String(n).trim();
      return n || '고객';
    } catch (e) { return '고객'; }
  }

  // 관리자가 적은 글에서 {금액} · {이름} 을 실제 값으로 바꾼다.
  // ⚠ 먼저 esc 로 다 막고 나서 자리표를 바꾼다. 순서를 뒤집으면
  //   고객 이름에 태그가 들어 있을 때 그대로 화면에 실린다.
  // 같은 자리표를 글자만으로 채운다 — 마우스 툴팁(title 속성)처럼 태그를 못 넣는 자리용.
  function fillTokensPlain(s, amount) {
    return String(s == null ? '' : s)
      .replace(/\{금액\}/g, amount || '')
      .replace(/\{이름\}/g, userName());
  }

  function fillTokens(s, amount) {
    return esc(s)
      .replace(/\{금액\}/g, amount ? '<b>' + esc(amount) + '</b>' : '')
      .replace(/\{이름\}/g, '<b>' + esc(userName()) + '</b>');
  }

  // 결과 맨 위 지원금 알림. 관리자가 5단계에서 켜야 나온다.
  //
  // ★ 색을 칠한 띠가 아니라 글자로 세운다 (2026-08-08 다시 만듦)
  //   보라색 띠를 통째로 깔았더니 띠가 배경처럼 읽히고 그 아래 상품 카드가
  //   더 눈에 들어왔다. 지원금이 주인공이어야 하는데 반대가 된 것이다.
  //   흰 바탕에 큰 글자를 놓고 금액에만 색을 준다. 카드 글자(13.5px)보다
  //   두 배 이상 크면 눈이 여기부터 간다.
  //
  // ⚠ 금액 칸을 비워두면 '보여줄 상품 중 최고 사은품' 을 엔진이 적는다.
  //   손으로 적어둔 숫자는 상품이 바뀌어도 안 바뀌어서 곧 거짓말이 된다.
  function amountOf(ranked) {
    var w = (S.def.result || {}).reward || {};
    var a = String(w.amount || '').trim();
    if (a) return a;
    var top = 0;
    ranked.forEach(function (x) { var g = giftOf(x.p); if (g > top) top = g; });
    return top > 0 ? moneyKo(top) : '';
  }

  // 지원금 알림의 알맹이. 상자는 heroHtml 이 씌운다.
  function rewardInner(ranked) {
    var w = (S.def.result || {}).reward || {};
    if (!w.on) return '';

    var amount = amountOf(ranked);
    // 옛 이름(top) 도 읽는다. 5단계에서 headline 으로 옮기기 전에 저장한 것이 있다.
    var head = w.headline || w.top || '';
    if (!head && !w.sub && !w.note) return '';

    return (w.badge ? '<span class="dpf-rw-tag">' + esc(w.badge) + '</span>' : '') +
      (head ? '<p class="dpf-rw-h">' + fillTokens(head, amount) + '</p>' : '') +
      (w.sub ? '<p class="dpf-rw-s">' + fillTokens(w.sub, amount) + '</p>' : '') +
      (w.note ? '<p class="dpf-rw-n">' + fillTokens(w.note, amount) + '</p>' : '');
  }

  /**
   * 결과 화면 맨 위 한 덩어리 (2026-08-08 합침).
   *
   * ★ 지원금 알림과 신청 줄을 상자 두 개로 나누지 않는다
   *   흰 상자가 위아래로 붙어 있으면 "지원금 얘기" 와 "신청 얘기" 가 다른 일처럼 읽힌다.
   *   실제로는 한 흐름이다 — 얼마를 찾았고, 그러니 지금 신청하라는 말이다.
   *   한 상자에 넣고 가운데를 옅은 선으로만 나눈다.
   *
   *   둘 중 하나만 켜져 있어도 상자는 하나다. 둘 다 꺼져 있으면 아예 안 그린다.
   */
  // ⚠ 결과 화면 맨 위의 '지원금 알림 + 신청 줄' 을 통째로 뺐다 (2026-08-10 사장님 결정).
  //
  //   전에는 "비밀지원금 최대혜택 발견!" 같은 큰 덩어리가 상품 목록 위에 있었다.
  //   상품마다 지원금을 적기로 하면서 그 덩어리가 할 일이 없어졌다 —
  //   같은 말을 위에서 한 번 하고 카드에서 또 한다. 고객은 두 번 읽고 한 번 의심한다.
  //   신청 줄은 목록 아래 한 곳에만 둔다. 위아래 두 곳이면 무엇이 진짜인지 헷갈린다.
  //
  //   ★ rewardInner / amountOf / dpf-rw CSS 는 지우지 않고 남겨 뒀다.
  //     어드민 5단계 저장값(result.reward)이 아직 DB 에 남아 있고,
  //     되돌리라는 말이 나오면 여기 한 줄만 되살리면 된다.

  // 결과 화면 맨 위 로고. '추천 결과' 라는 딱지 대신 로고를 가운데 둔다 (2026-08-08).
  // 딱지는 관리자 말이지 고객 말이 아니다. 로고는 여기가 어디인지 알려주고 믿음을 준다.
  // 파일이 없으면 스스로 사라진다 — 깨진 그림 아이콘이 뜨는 것보다 낫다.
  function resultLogoHtml() {
    var url = String((S.def.result || {}).logoUrl || '').trim() || '/assets/logos/dapicklogo.png';
    return '<div class="dpf-rlogo"><img src="' + esc(url) + '" alt="다픽"' +
      ' onerror="this.parentNode.style.display=\'none\'"/></div>';
  }

  function paintResult() {
    var r = S.def.result || {};
    // 위 묶음 개수. 기본 3 이다 — 아래 지원금 묶음 3 과 합쳐 6 개가 된다 (2026-08-10).
    var limit = Math.min(RES_MAX, Number(r.count) || 3);
    var all = rank();

    // 칩이 켜져 있으면 그 조건에 맞는 것만 남긴다.
    var chip = (r.filters || [])[S.chip];
    var rows = chip ? all.filter(function (x) { return rulesHit(x.p, chip.rules); }) : all;

    // 아무 답에도 안 걸린 상품(0점)은 뺀다. 관리자가 지정한 것만 나오게 하기 위해서다.
    // ⚠ 전부 0점이면 빼지 않는다 — 답을 아직 안 했거나 조건이 다 어긋난 경우인데,
    //   빈 화면을 보여주면 "이 사이트엔 없다" 로 읽힌다. 아래 lead 문구가 사정을 밝힌다.
    var hit = rows.filter(function (x) { return x.s > 0; });
    var ranked = balanced(hit.length ? hit : rows, limit);

    // ── 아래 묶음 · 지원금 많이 주는 상품 (2026-08-10) ──────────────
    //
    // ★ 왜 두 묶음인가
    //   위는 '고르신 조건에 맞는 것', 아래는 '돈을 많이 주는 것' 이다. 고르는 기준이 다르다.
    //   한 줄에 섞어 놓으면 요금이 싼 것과 지원금이 큰 것이 뒤엉켜 무엇을 보고 고를지 모른다.
    //
    // ⚠ 위에 이미 나온 상품은 아래에 또 안 넣는다.
    //   같은 상품이 두 번 나오면 6개인 줄 알았는데 4개짜리 목록이 된다.
    //   그래서 아래 묶음은 '지원금 1위' 가 아니라 '위에 없는 것 중 지원금 1위' 다.
    var giftLimit = Number(r.giftCount);
    if (!(giftLimit >= 0)) giftLimit = 3;
    // ⚠ 검색·지름길로 들어왔으면 위 묶음이 이미 지원금 순이다.
    //   그 아래에 '지원금 많이 주는 상품' 을 또 붙이면 같은 기준으로 두 번 줄 세운 꼴이고,
    //   위 3개를 뺀 4~6등이 마치 지원금 1등인 것처럼 보인다.
    if (S.search) giftLimit = 0;
    var upTop = {};
    ranked.forEach(function (x) { upTop[String(x.p.id)] = 1; });
    var gifted = giftLimit === 0 ? [] : rows
      .filter(function (x) { return !upTop[String(x.p.id)] && giftOf(x.p) > 0; })
      .sort(function (a, b) {
        var ia = giftInfo(a.p), ib = giftInfo(b.p);
        if (ia.set !== ib.set) return ia.set ? -1 : 1;   // 관리자가 적어 둔 것이 먼저
        if (ib.v !== ia.v) return ib.v - ia.v;
        return (a.p.sortOrder || 999) - (b.p.sortOrder || 999);
      })
      .slice(0, giftLimit);

    // 고를 수 있는 것은 위아래를 합친 것이다. 아래 카드를 눌러도 신청 줄이 따라와야 한다.
    var shown = ranked.concat(gifted);

    // 고른 상품이 목록에서 사라졌으면 놓아준다 (칩을 눌러 걸러진 경우).
    if (S.pick && !shown.some(function (x) { return String(x.p.id) === String(S.pick); })) {
      S.pick = null;
    }
    // 아무것도 안 골랐으면 1등을 켜 둔다. 세 버튼이 곧바로 쓸모 있어야 한다.
    if (!S.pick && shown.length) S.pick = shown[0].p.id;

    var best = ranked.length ? ranked[0].s : 0;
    // 아무 조건도 못 맞췄으면 솔직하게 말한다. 그럴듯하게 포장하지 않는다.
    //
    // ⚠ 검색으로 들어왔을 때 '고르신 조건' 이라고 말하면 안 된다 — 고른 것이 없다.
    //   물어본 적 없는 조건을 들먹이면 고객은 자기가 뭘 놓쳤나 하고 되돌아간다.
    var lead = chip && !ranked.length
      ? '고르신 조건에 맞는 상품이 없습니다. 다른 항목을 눌러보세요.'
      : (S.search
        ? (S.search.q
            ? '‘' + S.search.q + '’ 로 찾았습니다. 지원금이 큰 순서로 보여드립니다.'
            : '지원금이 큰 순서로 보여드립니다.')
        : best === 0
          ? (r.leadEmpty || '고르신 조건에 딱 맞는 상품을 아직 찾지 못했습니다. 대신 많이 찾는 상품을 보여드립니다.')
          : (r.leadMatched || '고르신 조건에 가까운 순서로 보여드립니다.'));

    var ov = el();
    ov.innerHTML =
      '<div class="dpf-box dpf-box--page">' +
      '<div class="dpf-head dpf-head--res">' + resultLogoHtml() +
      '<button type="button" class="dpf-x" data-dpf-close aria-label="닫기">✕</button></div>' +
      '<h2 class="dpf-q dpf-q--big">' + esc(r.title || '이런 상품은 어떠세요?') + '</h2>' +
      '<p class="dpf-qsub">' + esc(lead) + '</p>' +
      chipsHtml() +
      (ranked.length
        ? '<div class="dpf-res dpf-res--n' + Math.min(RES_MAX, ranked.length) + '">' +
          ranked.map(function (x, i) { return cardHtml(x, i, false); }).join('') + '</div>'
        : '<p class="dpf-qsub">보여드릴 상품이 없습니다.</p>') +
      // 아래 묶음 — 지원금이 큰 상품. 없으면 제목째로 안 그린다(빈 제목은 고장으로 읽힌다).
      (gifted.length
        ? '<h2 class="dpf-q dpf-q--big dpf-q--gift">' +
          esc(r.giftTitle || '지원금 많이 주는 상품') + '</h2>' +
          (r.giftLead ? '<p class="dpf-qsub">' + esc(r.giftLead) + '</p>' : '') +
          '<div class="dpf-res dpf-res--n' + Math.min(RES_MAX, gifted.length) + '">' +
          gifted.map(function (x, i) { return cardHtml(x, i, true); }).join('') + '</div>'
        : '') +
      (shown.length ? actionsHtml(shown, 'bottom') : '') +
      '<div class="dpf-foot">' +
      '<button type="button" class="dpf-sub" data-dpf-again>다시 고르기</button>' +
      '<button type="button" class="dpf-sub" data-dpf-close>닫기</button>' +
      '</div></div>';

    ov.querySelector('[data-dpf-again]').onclick = restart;

    // 카드 몸통 = 고르기.
    // ⚠ 다시 눌러도 안 풀린다. 하나는 늘 켜져 있어야 바닥 세 버튼이 쓸모가 있다.
    ov.querySelectorAll('[data-dpf-pick]').forEach(function (c) {
      var choose = function () {
        S.pick = c.getAttribute('data-dpf-pick');
        paintResult();
      };
      c.onclick = choose;
      // 키보드로도 고를 수 있어야 한다. 카드가 버튼 역할을 하기 때문이다.
      c.onkeydown = function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(); }
      };
    });

    // ⚠ 신청 줄이 위아래 두 곳에 있다. querySelector 하나만 잡으면 아래 버튼이 죽는다.
    ov.querySelectorAll('[data-dpf-apply]').forEach(function (b) {
      b.onclick = function () {
        var p = pickedRow(shown);
        if (!p) return;
        // ★ 조합 상품은 상세 화면이 없다 (2026-08-10).
        //   그대로 onApply 로 넘기면 없는 주소로 보내 404 가 뜬다.
        //   관리자가 링크를 적어 뒀으면 그리로, 안 적었으면 간편 신청으로 받는다.
        if (p.__combo) {
          var u = String(p.__combo.linkUrl || '').trim();
          // ⚠ 관리자가 적는 칸이라 javascript: 같은 주소가 들어올 수 있다. http 와 / 만 연다.
          if (/^(https?:\/\/|\/)/i.test(u)) { window.location.href = u; return; }
          fireSimple(p);
          return;
        }
        if (typeof S.opt.onApply === 'function') S.opt.onApply(p);
      };
    });

    ov.querySelectorAll('[data-dpf-simple]').forEach(function (b) {
      b.onclick = function () { fireSimple(pickedRow(shown)); };
    });

    ov.querySelectorAll('[data-dpf-kakao]').forEach(function (b) {
      b.onclick = function () {
        var url = String(actionsOf().kakaoUrl || '').trim();
        // ⚠ 관리자가 적는 칸이라 javascript: 같은 주소가 들어올 수 있다. http 만 연다.
        if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
      };
    });

    // 같은 칩을 다시 누르면 꺼진다. 끄는 방법이 없으면 고객이 갇힌다.
    ov.querySelectorAll('[data-chip]').forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.dataset.chip);
        S.chip = (S.chip === i) ? -1 : i;
        paintResult();
      };
    });

  }

  // ── 신청 3루트 (2026-08-08) ─────────────────────────────────────
  // 결과 화면 바닥에 세 버튼이 나란히 선다. 모두 '지금 고른 상품' 을 싣고 간다.
  //   1) 신청하기      → 상세로 간다. 약정·옵션까지 고르는 정식 접수.
  //   2) 간편 신청     → 이름·전화만 받고 그 자리에서 접수.
  //   3) 카카오톡 상담 → 채널 상담방을 새 창으로 연다.
  //
  // ★ 왜 카드마다 버튼을 안 붙였나 (2026-08-08 다시 정리)
  //   상품 4개면 버튼이 12개가 된다. 고를 것이 많아지면 고객은 고민하다 나간다.
  //   카드는 '무엇을' 고르는 자리, 바닥 줄은 '어떻게' 신청할지 고르는 자리로 나눴다.
  //
  // ★ 카드 몸통을 링크가 아니라 '고르기' 로 바꿨다
  //   누르면 페이지가 넘어가 버리면 바닥 버튼까지 갈 일이 없다.
  //
  // ★ 1등을 미리 골라 둔다
  //   아무것도 안 골라 두면 세 버튼이 다 '어느 상품인지 모르는 신청' 이 된다.
  //   1등이 켜져 있으면 그대로 눌러도 되고, 다른 카드를 눌러 바꿔도 된다.
  function actionsOf() { return (S.def.result || {}).actions || {}; }

  function pickedRow(ranked) {
    if (!S.pick) return null;
    var hit = ranked.filter(function (x) { return String(x.p.id) === String(S.pick); })[0];
    return hit ? hit.p : null;
  }

  // 버튼 세 개. 위·아래 두 곳에서 같은 모양으로 쓴다.
  function actBtnsHtml(a, applyOn, simpleOn, kakaoOn) {
    return '<div class="dpf-act-btns">' +
      (applyOn
        ? '<button type="button" class="dpf-act-b dpf-act-b--a" data-dpf-apply>' +
          esc(a.applyLabel || '신청하기') + '</button>'
        : '') +
      (simpleOn
        ? '<button type="button" class="dpf-act-b dpf-act-b--s" data-dpf-simple>' +
          esc(a.simpleLabel || '3초만에 간편 신청') + '</button>'
        : '') +
      (kakaoOn
        ? '<button type="button" class="dpf-act-b dpf-act-b--k" data-dpf-kakao>' +
          esc(a.kakaoLabel || '카카오톡 상담') + '</button>'
        : '') +
      '</div>';
  }

  /**
   * 신청 줄. 결과 화면에 두 번 나온다 (2026-08-08 다시 배치).
   *
   * ★ 왜 두 번인가
   *   지원금을 보여준 바로 다음에 상품 목록이 나오면 흐름이 끊긴다.
   *   "얼마 받는대" 에서 곧장 "골라보세요" 로 넘어가 버려서, 신청까지 갈 사람도
   *   상품을 비교하다 나간다. 그래서 지원금 바로 아래에 "3초면 됩니다" 와
   *   버튼을 먼저 놓고, 그래도 고르고 싶은 사람을 위해 상품 목록을 아래에 둔다.
   *
   *   where='top'    지원금 바로 아래. 유도 문구와 버튼만. 아직 카드를 안 봤으므로
   *                  '고른 상품' 줄은 안 적는다.
   *   where='bottom' 상품 목록 아래. 고른 상품 이름과 버튼. 카드를 눌러 바꾼 사람이
   *                  화면을 위로 올리지 않아도 되게 하는 자리다.
   */
  function actionsHtml(ranked, where) {
    var a = actionsOf();
    var kakaoUrl = String(a.kakaoUrl || '').trim();
    var applyOn = typeof S.opt.onApply === 'function';
    var simpleOn = a.simpleOn !== false;              // 기본은 켜짐
    var kakaoOn = a.kakaoOn !== false && !!kakaoUrl;  // 주소가 없으면 못 켠다
    if (!applyOn && !simpleOn && !kakaoOn) return '';

    var btns = actBtnsHtml(a, applyOn, simpleOn, kakaoOn);

    if (where === 'top') {
      var amount = amountOf(ranked);
      var head = a.headline == null ? '최대 지원금을 당장 알아보는 데 3초면 됩니다' : a.headline;
      var sub = a.sub == null ? '비밀 지원금 더 찾으러 갈까요?' : a.sub;
      if (!head && !sub) return '';   // 문구를 다 비우면 위 줄은 통째로 안 그린다
      return '<div class="dpf-act dpf-act--top">' +
        '<div class="dpf-act-push">' +
        (head ? '<p class="dpf-act-h">' + fillTokens(head, amount) + '</p>' : '') +
        (sub ? '<p class="dpf-act-s">' + fillTokens(sub, amount) + '</p>' : '') +
        '</div>' + btns + '</div>';
    }

    var p = pickedRow(ranked);
    var line = p
      ? '<span class="dpf-act-on">' + esc(a.pickedLabel || '고른 상품') + ' · <b>' +
        esc(p.name || '') + '</b></span>'
      : '<span class="dpf-act-hint">' +
        esc(a.pickHint || '위에서 상품을 누르면 그 상품으로 접수됩니다') + '</span>';

    return '<div class="dpf-act">' +
      '<div class="dpf-act-row">' + line + btns + '</div></div>';
  }

  // 간편 신청을 실제로 여는 것은 화면 쪽 일이다.
  // 연결층이 onSimple 을 주면 그걸 쓰고, 없으면 사이트 공용 openSimpleApply 를 쓴다.
  // 어드민 미리보기에는 둘 다 없다 — 모양만 보는 자리라 조용히 넘어간다.
  //
  // ★ 두 번째 인자로 출처를 넘긴다 (2026-08-10)
  //   같은 결과 화면이라도 '상품 찾기로 왔나' 와 '메인 검색으로 왔나' 는 다른 문이다.
  //   어느 문이 돈이 되는지 세려면 접수에 다르게 남아야 한다.
  //   연결층이 이 값을 안 읽으면 예전처럼 finder_result 로 남는다 — 안 터진다.
  function fireSimple(p) {
    var src = S.search ? 'ai_search' : null;
    if (typeof S.opt.onSimple === 'function') { S.opt.onSimple(p, src); return; }
    if (typeof window.openSimpleApply === 'function') {
      window.openSimpleApply(null, '', null, { source: src || 'finder_result' });
      return;
    }
    console.warn('[finder] 간편 신청을 열 방법이 없다 (onSimple 또는 openSimpleApply 필요)');
  }

  // 결과 카드 사진. 어드민 4단계에서 상품마다 올린 것이 먼저다 (2026-08-08).
  // 상품 관리에 올린 사진은 상세 화면용이라 결과 카드에 맞지 않을 때가 있고,
  // 인터넷TV 대표 사진 칸은 주소를 손으로 쳐야 해서 거의 비어 있다.
  function imageOf(p) {
    var picked = ((S.def.result || {}).images || {})[String(p && p.id)];
    if (picked) return picked;
    return S.opt.imageOf ? S.opt.imageOf(p) : (p && p.imageUrl);
  }

  // 지원금 한 줄. 금액이 없으면 아예 안 그린다 — 0원이라고 적으면 없느니만 못하다.
  // giftBig=true 면 지원금을 크게, 월 요금을 작게 (아래 묶음용).
  function giftHtml(p, big) {
    var v = giftOf(p);
    if (!(v > 0)) return '';
    return '<div class="dpf-gift' + (big ? ' dpf-gift--big' : '') + '">' +
      '최대 지원금 <b>' + esc(moneyKo(v)) + '</b></div>';
  }

  /**
   * @param x    { p, s, why }
   * @param i    이 묶음 안에서 몇 번째인가
   * @param big  아래 '지원금 많이 주는 상품' 묶음인가 (2026-08-10)
   */
  function cardHtml(x, i, big) {
    var p = x.p;
    var img = imageOf(p);
    var href = p.__combo
      ? String(p.__combo.linkUrl || '')
      : (S.opt.hrefOf ? S.opt.hrefOf(p) : '/product-detail?id=' + encodeURIComponent(p.id));

    // 순위는 3등까지만 적는다. 전부 적으면 6등이 나쁜 상품처럼 보인다.
    // ⚠ 아래 지원금 묶음에는 순위를 안 붙인다. 위쪽 1등과 아래쪽 1등이 나란히 있으면
    //   무엇이 진짜 1등인지 헷갈린다.
    var rankTag = (!big && i < 3) ? '<span class="dpf-rank">' + (i + 1) + '</span>' : '';

    var badges = badgesOf(p).map(function (b) {
      return '<span class="dpf-badge dpf-badge--' + esc(b.color || 'green') + '">' + esc(b.label || '') + '</span>';
    }).join('');

    // '이래서 골랐어요' 는 중복을 지우고 최대 3개만. 다 적으면 카드가 설명서가 된다.
    var why = [];
    x.why.forEach(function (w) { if (w && why.indexOf(w) < 0) why.push(w); });
    why = why.slice(0, 3);

    // ★ 카드 속 내용은 카테고리마다 다르다(인터넷TV=사은품·옵션 / 정수기=약정·주기·색).
    //   전부 정의로 표현하려 들면 카드 하나에 매핑 규칙이 스무 개 붙는다.
    //   화면이 cardOf 를 넘기면 그쪽이 그리고, 없으면 아래 기본 카드를 쓴다.
    //   ⚠ 화면이 cardOf 를 주면 지원금 줄도 그쪽 몫이다. 우리가 덧붙이면 두 번 나온다.
    var inner = typeof S.opt.cardOf === 'function'
      ? S.opt.cardOf(p, x)
      : '<div class="dpf-name">' + esc(p.name || '') + '</div>' +
        // 조합 상품은 무엇이 묶였는지 한 줄로 알려준다. 이름만으로는 알 수 없다.
        (p.__combo && p.__combo.sub
          ? '<div class="dpf-combo">' + esc(p.__combo.sub) + '</div>' : '') +
        // 위 묶음은 월 요금이 먼저, 아래 묶음은 지원금이 먼저다. 고르는 기준이 다르다.
        (big ? giftHtml(p, true) + feeHtml(p) : feeHtml(p) + giftHtml(p, false));

    var on = String(S.pick || '') === String(p.id);

    return (
      '<div class="dpf-card' + (on ? ' is-pick' : '') + '" data-dpf-pick="' + esc(p.id) + '"' +
      ' role="button" tabindex="0" aria-pressed="' + (on ? 'true' : 'false') + '"' +
      ' title="' + esc(href) + '">' +
      rankTag +
      (on ? '<span class="dpf-pick">✓</span>' : '') +
      '<div class="dpf-card-l">' +
      '<div class="dpf-thumb' + (img ? '' : ' dpf-thumb--no') + '">' +
      (img ? '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy"/>'
           : '<span class="dpf-noimg">이미지 준비중</span>') +
      '</div>' +
      (badges ? '<div class="dpf-badges">' + badges + '</div>' : '') +
      inner +
      (why.length
        ? '<div class="dpf-why">' + why.map(function (w) {
            return '<span class="dpf-why-b">✓ ' + esc(w) + '</span>';
          }).join('') + '</div>'
        : '') +
      '</div>' +
      // ⚠ 카드 안에 신청 버튼을 두지 않는다. 신청은 바닥 줄 세 버튼이 맡는다.
      //   카드마다 버튼을 달면 상품 4개에 버튼 12개가 되어 고객이 고민만 하다 나간다.
      '</div>'
    );
  }

  // ── 스타일 ───────────────────────────────────────────────────────
  function injectStyles() {
    if (_styled) return;
    _styled = true;
    var css =
      // ── 진입 버튼 (화면마다 따로 만들지 않는다) ──
      //
      // 2026-08-10 다시 그림. 테두리를 빼고 그림자로만 띄운다.
      // 테두리 + 그림자 + 배경색을 다 쓰면 화면이 시끄러워진다. 하나만 쓴다.
      // 색은 이 파일이 원래 쓰던 다픽 보라(#6c3fc5)를 그대로 이어받는다 — 새 색을 만들지 않는다.
      '.dpf-cta{display:flex;align-items:center;gap:14px;width:100%;padding:20px;' +
        'background:#fff;border:none;border-radius:18px;cursor:pointer;text-align:left;' +
        'font-family:inherit;box-shadow:0 2px 12px rgba(40,25,80,.07);' +
        'transition:box-shadow .14s,transform .14s;}' +
      '.dpf-cta:hover{box-shadow:0 8px 24px rgba(108,63,197,.18);transform:translateY(-1px);}' +
      '.dpf-cta-ico{width:46px;height:46px;flex-shrink:0;border-radius:50%;background:#f3eeff;' +
        'color:#6c3fc5;display:flex;align-items:center;justify-content:center;font-size:20px;}' +
      '.dpf-cta-ico svg{display:block;}' +
      '.dpf-cta-txt{flex:1;min-width:0;}' +
      // 제목에 {금액} 을 안 넣었을 때 대신 얹는 줄. 넣었으면 이 줄은 아예 안 나온다.
      '.dpf-cta-amt{display:block;font-size:13px;font-weight:800;color:#6c3fc5;margin-bottom:3px;}' +
      '.dpf-cta-txt b{display:block;font-size:17px;font-weight:700;letter-spacing:-.6px;' +
        'line-height:1.44;color:#191f28;word-break:keep-all;}' +
      // fillTokens 가 {금액} 을 <b> 로 감싼다. 제목 <b> 안의 <b> 가 곧 금액이다.
      '.dpf-cta-txt b b{color:#6c3fc5;font-weight:800;}' +
      '.dpf-cta-txt em{display:block;margin-top:5px;font-size:13.5px;color:#8b8a9b;' +
        'font-style:normal;font-weight:400;}' +
      '.dpf-cta-go{flex-shrink:0;display:flex;align-items:center;gap:5px;font-size:14px;' +
        'font-weight:700;color:#6c3fc5;white-space:nowrap;}' +
      '.dpf-cta-go svg{display:block;color:#c9c5d4;}' +
      // 말풍선 — 버튼 위에 살짝 떠서 통통 튄다. 눈이 먼저 가는 자리다.
      '.dpf-cta-bub{display:inline-block;margin:0 0 8px 14px;padding:6px 13px;position:relative;' +
        'background:#221f38;color:#fff;font-size:12.5px;font-weight:700;border-radius:999px;' +
        'animation:dpfBub 1.8s ease-in-out infinite;}' +
      '.dpf-cta-bub:after{content:"";position:absolute;left:18px;bottom:-5px;width:0;height:0;' +
        'border-left:5px solid transparent;border-right:5px solid transparent;' +
        'border-top:6px solid #221f38;}' +
      '@keyframes dpfBub{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}' +
      '@media(prefers-reduced-motion:reduce){.dpf-cta-bub{animation:none;}}' +
      // 좁은 화면에서는 오른쪽 글자를 지우고 꺾쇠만 남긴다.
      // 글자를 남기면 제목이 밀려 두 줄이 세 줄이 된다.
      '@media(max-width:640px){.dpf-cta{padding:17px 16px;gap:12px;}' +
        '.dpf-cta-ico{width:42px;height:42px;font-size:18px;}' +
        '.dpf-cta-txt b{font-size:16px;}.dpf-cta-txt em{font-size:12.5px;}' +
        '.dpf-cta-lb{display:none;}.dpf-cta-bub{font-size:11.5px;margin-left:8px;}}' +

      // ── 따라오는 진입 버튼 (2026-08-11) ──────────────────────────
      //
      // PC 는 화면 왼쪽 가운데 세로 리모컨, 폰은 화면 아래 가로바.
      //
      // ★ 왜 오른쪽이 아니라 왼쪽인가 (2026-08-11 오후에 옮김)
      //   오른쪽 아래는 이미 카카오 상담 버튼 두 개가 쓰고 있다. 거기에 하나 더 얹으면
      //   세 개가 겹쳐 서로를 가린다. 왼쪽은 비어 있고, 본문이 가운데 정렬이라
      //   좁은 세로 막대는 글자를 안 덮는다.
      //
      // ★ 왜 PC 에서 가로바를 안 쓰나
      //   넓은 화면 아래를 가로로 다 막으면 광고 띠처럼 읽히고, 스크롤할 때마다
      //   본문 마지막 줄을 계속 가린다. 폰은 화면이 좁아 반대다 — 아래 가로바가
      //   엄지에 가장 가깝다.
      //
      // ★ 흰 바탕 + 보라 테두리로 세운 이유
      //   이 화면은 본문이 희고 푸터가 검다. 보라 알약은 검은 푸터 위에서 묻힌다.
      //   흰 카드에 보라 테두리면 밝은 데서도 어두운 데서도 떠 보인다.
      '.dpf-stk-wrap{position:fixed;z-index:8000;left:18px;top:50%;transform:translateY(-50%);' +
        'transition:opacity .18s;}' +
      '.dpf-stk-wrap[hidden]{display:none;}' +
      '.dpf-stk-wrap.is-away{opacity:0;pointer-events:none;}' +
      '.dpf-stk{display:flex;flex-direction:column;align-items:center;gap:8px;width:86px;' +
        'padding:14px 8px;border:1.5px solid #6c3fc5;border-radius:16px;background:#fff;' +
        'color:#3a3550;cursor:pointer;font-family:"Noto Sans KR",sans-serif;' +
        'box-shadow:0 8px 26px rgba(20,17,38,.16);animation:dpfStkIn .28s ease;}' +
      '.dpf-stk:hover{background:#f7f3ff;box-shadow:0 10px 30px rgba(108,63,197,.24);}' +
      '.dpf-stk-ico{width:38px;height:38px;flex-shrink:0;border-radius:50%;background:#6c3fc5;' +
        'color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;}' +
      '.dpf-stk-ico svg{width:20px;height:20px;display:block;}' +
      // 긴 제목은 네 줄에서 자른다. 전체 문구는 마우스를 올리면 뜬다(title 속성).
      '.dpf-stk-tx{font-size:12.5px;font-weight:800;line-height:1.35;letter-spacing:-.4px;' +
        'text-align:center;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:4;' +
        '-webkit-box-orient:vertical;overflow:hidden;}' +
      '.dpf-stk-tx b{color:#6c3fc5;font-weight:900;}' +
      // 짧은 글자를 적어 뒀으면 세로 리모컨은 그걸 쓴다. 잘릴 일이 없다.
      '.dpf-stk-lb{display:none;}' +
      '.dpf-stk-wrap.has-lb .dpf-stk-lb{display:block;font-size:13px;font-weight:800;' +
        'line-height:1.35;letter-spacing:-.4px;text-align:center;word-break:keep-all;}' +
      '.dpf-stk-wrap.has-lb .dpf-stk-tx{display:none;}' +
      '.dpf-stk-go{display:none;}' +
      '@keyframes dpfStkIn{from{opacity:0;transform:translateX(-14px);}to{opacity:1;transform:none;}}' +
      '@keyframes dpfStkUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}' +
      '@media(prefers-reduced-motion:reduce){.dpf-stk{animation:none;}}' +
      // 좁은 화면 — 화면 아래 가로바로 갈아탄다. 세로용 규칙을 전부 되돌린다.
      '@media(max-width:640px){' +
        '.dpf-stk-wrap{left:0;right:0;top:auto;bottom:0;transform:none;' +
          'padding:10px 12px calc(10px + env(safe-area-inset-bottom));' +
          'background:linear-gradient(to top,rgba(255,255,255,.97) 55%,rgba(255,255,255,0));}' +
        '.dpf-stk{flex-direction:row;width:100%;justify-content:center;gap:10px;' +
          'padding:15px 16px;border:none;border-radius:14px;background:#6c3fc5;color:#fff;' +
          'box-shadow:0 8px 24px rgba(108,63,197,.32);animation:dpfStkUp .28s ease;}' +
        '.dpf-stk:hover{background:#6c3fc5;}' +
        '.dpf-stk-ico{width:26px;height:26px;background:rgba(255,255,255,.18);}' +
        // 가로바는 폭이 넉넉하다. 짧은 말 대신 제목을 그대로 보여준다.
        '.dpf-stk-tx,.dpf-stk-wrap.has-lb .dpf-stk-tx{display:block;font-size:15px;font-weight:700;' +
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.dpf-stk-tx b{color:#fff;}' +
        '.dpf-stk-wrap.has-lb .dpf-stk-lb{display:none;}' +
        '.dpf-stk-go{display:flex;color:rgba(255,255,255,.75);}' +
      '}' +
      // 가로바가 마지막 줄을 덮지 않게 자리를 만든다. 뜰 때만 붙는다.
      // ⚠ 폰에서만이다. PC 는 세로 막대라 아래를 안 가린다.
      '@media(max-width:640px){body.dpf-stk-pad{padding-bottom:78px;}}' +

      '.dpf-ov{position:fixed;inset:0;z-index:9000;background:rgba(20,17,38,.55);' +
        'display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;}' +
      '.dpf-ov[hidden]{display:none;}' +
      '.dpf-box{width:100%;max-width:620px;background:#fff;border-radius:18px;padding:24px 22px 20px;' +
        'font-family:"Noto Sans KR",sans-serif;box-shadow:0 20px 60px rgba(20,17,38,.28);}' +
      '.dpf-box--wide{max-width:860px;}' +
      '.dpf-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}' +
      '.dpf-step{font-size:12.5px;font-weight:700;color:#5b3fbe;background:#efeafc;' +
        'border-radius:20px;padding:4px 11px;}' +
      '.dpf-x{width:32px;height:32px;border-radius:50%;border:none;background:#f4f2fa;color:#4a4762;' +
        'font-size:14px;cursor:pointer;font-family:inherit;}' +
      '.dpf-x:hover{background:#e9e5f6;}' +
      '.dpf-q{font-size:21px;font-weight:800;color:#1b1830;margin:0 0 6px;line-height:1.4;letter-spacing:-.02em;}' +
      '.dpf-qsub{font-size:13.5px;color:#8b88a3;margin:0 0 18px;line-height:1.6;}' +
      '.dpf-opts{display:flex;flex-direction:column;gap:9px;}' +
      '.dpf-opt{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;' +
        'padding:15px 16px;border:1.5px solid #e9e6f4;border-radius:12px;background:#fff;' +
        'text-align:left;cursor:pointer;font-family:inherit;transition:border-color .14s,background .14s;}' +
      '.dpf-opt:hover{border-color:#c9bdf5;background:#faf9fd;}' +
      '.dpf-opt.is-on{border-color:#6c3fc5;background:#f4f0fd;}' +
      '.dpf-opt-l{font-size:15px;font-weight:700;color:#221f38;}' +
      '.dpf-opt-d{font-size:12.5px;color:#8b88a3;}' +
      // 이미지 카드 — 브랜드 로고처럼 보고 고르는 문항용. 한 줄에 두 개.
      '.dpf-opts--card{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;}' +
      '.dpf-opts--n1{grid-template-columns:1fr;}' +
      '.dpf-opts--n2{grid-template-columns:repeat(2,1fr);}' +
      '.dpf-opts--n3{grid-template-columns:repeat(3,1fr);}' +
      // 그림을 크게 (2026-08-10). 52px 은 무엇을 그린 그림인지 알아볼 수 없는 크기였다.
      // 카드형 선택지는 로고나 그림을 보고 고르는 자리라 그림이 주인공이어야 한다.
      '.dpf-opt--card{align-items:center;text-align:center;gap:10px;padding:22px 16px;}' +
      '.dpf-opt-img{display:flex;align-items:center;justify-content:center;width:100%;height:96px;}' +
      '.dpf-opt-img img{max-width:100%;max-height:100%;object-fit:contain;}' +
      '.dpf-opt--card .dpf-opt-l{font-size:14px;}' +
      '.dpf-foot{display:flex;gap:8px;justify-content:space-between;margin-top:18px;}' +
      '.dpf-sub{border:1px solid #e5e2f0;background:#fff;color:#6a6880;border-radius:10px;' +
        'padding:11px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.dpf-sub:hover{border-color:#c9bdf5;color:#5b3fbe;}' +
      '.dpf-go{width:100%;margin-top:18px;border:none;background:#6c3fc5;color:#fff;border-radius:12px;' +
        'padding:15px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.dpf-go:hover{background:#5b34ad;}' +
      '.dpf-go--sm{width:auto;margin:0;padding:11px 18px;font-size:13.5px;border-radius:10px;}' +
      // 결과 — 상품 개수만큼만 칸을 만든다. 3개인데 4칸이면 오른쪽이 휑하다.
      '.dpf-res{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}' +
      '.dpf-res--n1{grid-template-columns:minmax(0,300px);justify-content:center;}' +
      '.dpf-res--n2{grid-template-columns:repeat(2,1fr);}' +
      '.dpf-res--n3{grid-template-columns:repeat(3,1fr);}' +
      '.dpf-res--n4{grid-template-columns:repeat(4,1fr);}' +
      '.dpf-card{display:flex;flex-direction:column;border:1px solid #eeecf5;border-radius:12px;' +
        'padding:12px;background:#fff;}' +
      '.dpf-card-l{display:block;text-decoration:none;color:inherit;flex:1 1 auto;}' +
      // ⚠ 높이를 고정한다. 비율(aspect-ratio)로 두면 사진 있는 카드는 폭만큼 정사각이 되고
      //   사진 없는 카드는 낮아져서 카드 높이가 제각각이 된다. (2026-08-08 실제로 그랬다)
      '.dpf-thumb{height:132px;flex-shrink:0;display:flex;align-items:center;justify-content:center;' +
        'background:#faf9fd;border-radius:8px;overflow:hidden;margin-bottom:9px;}' +
      '.dpf-thumb img{width:100%;height:100%;object-fit:contain;}' +
      '.dpf-noimg{font-size:12px;color:#a09dba;}' +
      '.dpf-name{font-size:13.5px;font-weight:700;color:#221f38;line-height:1.45;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.dpf-fee{margin-top:5px;font-size:13px;color:#5b3fbe;}' +
      // 지원금 줄 (2026-08-10). 위 묶음에서는 작게, 아래 묶음에서는 크게.
      // 조합 상품의 구성 한 줄 (2026-08-10)
      '.dpf-combo{margin-top:4px;font-size:12px;color:#8b8a9b;line-height:1.5;word-break:keep-all;}' +
      '.dpf-gift{margin-top:5px;font-size:12.5px;color:#8b8a9b;}' +
      '.dpf-gift b{font-weight:800;color:#6c3fc5;}' +
      '.dpf-gift--big{margin-top:6px;font-size:13px;color:#8b8a9b;}' +
      '.dpf-gift--big b{font-size:16px;letter-spacing:-.3px;}' +
      '.dpf-q--gift{margin-top:30px;}' +
      '.dpf-fee b{font-weight:800;}' +
      '.dpf-why{display:flex;flex-direction:column;gap:3px;margin-top:8px;}' +
      '.dpf-why-b{font-size:11.5px;color:#1d7a5f;background:#e9f5f0;border-radius:5px;padding:2px 6px;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      // (.dpf-apply 는 카드 안 신청 버튼 자리였다. 버튼을 바닥 줄로 옮기며 없앴다 — 2026-08-08)
      // ── 진행바 (2026-08-07) ──
      '.dpf-prog{flex:1 1 auto;margin-right:12px;}' +
      '.dpf-prog-top{display:flex;justify-content:space-between;align-items:baseline;' +
        'font-size:12.5px;color:#8b88a3;margin-bottom:6px;}' +
      '.dpf-prog-top b{color:#6c3fc5;font-size:13px;font-weight:800;}' +
      '.dpf-prog-bar{height:6px;border-radius:99px;background:#efedf7;overflow:hidden;}' +
      '.dpf-prog-bar i{display:block;height:100%;background:#6c3fc5;border-radius:99px;' +
        'transition:width .3s ease;}' +
      // 질문 머리 — 번호 배지 + 제목
      '.dpf-qhead{display:flex;gap:10px;align-items:flex-start;margin-bottom:16px;}' +
      '.dpf-qno{flex-shrink:0;width:24px;height:24px;border-radius:7px;background:#221f38;color:#fff;' +
        'font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:2px;}' +
      '.dpf-qhead .dpf-q,.dpf-qhead .dpf-qsub{margin:0;}' +
      '.dpf-qmulti{margin:5px 0 0;font-size:12.5px;color:#e5484d;font-weight:700;}' +
      // 가로 카드 — 로고 왼쪽, 글자 오른쪽
      '.dpf-opts--row{display:flex;flex-direction:column;gap:9px;}' +
      '.dpf-opts--row .dpf-opt--card{flex-direction:row;align-items:center;text-align:left;gap:14px;padding:14px 16px;}' +
      '.dpf-opts--row .dpf-opt-img{width:74px;height:38px;flex-shrink:0;}' +
      '.dpf-opts--row .dpf-opt-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}' +
      '.dpf-opt-body{display:flex;flex-direction:column;gap:2px;}' +
      '.dpf-opt-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;}' +
      '.dpf-opt-tags span{font-size:11.5px;color:#8b88a3;}' +
      '.dpf-opt-badge{position:absolute;top:8px;right:8px;font-size:10.5px;font-weight:800;color:#fff;' +
        'background:#22a06b;border-radius:5px;padding:2px 6px;}' +
      '.dpf-opt{position:relative;}' +
      // 도움말 — <details> 를 쓰면 여닫기를 우리가 안 만들어도 된다
      '.dpf-helps{display:flex;flex-direction:column;gap:8px;margin-top:16px;}' +
      '.dpf-help{background:#f7f6fb;border-radius:10px;padding:11px 13px;}' +
      '.dpf-help summary{font-size:13px;font-weight:700;color:#3f3c56;cursor:pointer;list-style:none;}' +
      '.dpf-help summary::-webkit-details-marker{display:none;}' +
      '.dpf-help p{margin:8px 0 0;font-size:12.5px;color:#6b6880;line-height:1.7;}' +
      // 로딩 화면
      '.dpf-box--load{max-width:420px;text-align:center;padding:40px 24px;}' +
      '.dpf-load-img img{width:100%;max-width:260px;border-radius:50%/40%;}' +
      // 로고는 로딩 상자 맨 위 가운데. 점보다 먼저 눈에 들어와야 한다.
      '.dpf-load-logo{margin:0 0 18px;display:flex;justify-content:center;}' +
      '.dpf-load-logo img{height:34px;width:auto;opacity:.92;}' +
      '@media(max-width:640px){.dpf-load-logo img{height:28px;}' +
        '.dpf-load-logo{margin-bottom:14px;}}' +
      // 도는 고리 (2026-08-10). 점 네 개를 대신한다.
      // ⚠ 점 CSS(.dpf-dots)는 남겨 둔다 — 옛 정의로 저장된 화면이 아직 있을 수 있다.
      '.dpf-spin{width:52px;height:52px;margin:0 auto 28px;}' +
      '.dpf-spin svg{width:52px;height:52px;display:block;animation:dpfSpin 1.05s linear infinite;}' +
      '@keyframes dpfSpin{to{transform:rotate(360deg);}}' +
      '@media(prefers-reduced-motion:reduce){.dpf-spin svg{animation-duration:3s;}}' +
      '.dpf-dots{display:flex;gap:8px;justify-content:center;margin:22px 0 20px;}' +
      '.dpf-dots i{width:9px;height:9px;border-radius:50%;background:#cfc4f0;' +
        'animation:dpfDot 1.1s infinite ease-in-out;}' +
      '.dpf-dots i:nth-child(2){animation-delay:.15s;}' +
      '.dpf-dots i:nth-child(3){animation-delay:.3s;}' +
      '.dpf-dots i:nth-child(4){animation-delay:.45s;}' +
      '@keyframes dpfDot{0%,100%{background:#cfc4f0;transform:scale(1);}' +
        '50%{background:#6c3fc5;transform:scale(1.25);}}' +
      '.dpf-load-t{margin:0;font-size:21px;font-weight:700;color:#191f28;line-height:1.45;' +
        'letter-spacing:-.85px;word-break:keep-all;}' +
      '.dpf-load-s{margin:11px 0 0;font-size:15px;font-weight:400;color:#8b8a9b;letter-spacing:0;}' +
      // 몇 초 걸리는지 적어 준다. 모르고 기다리는 것과 알고 기다리는 것은 다르다.
      '.dpf-load-n{margin:24px 0 0;font-size:13px;font-weight:600;color:#c9c5d4;}' +
      // ── 안내 화면 (2026-08-10) ──
      '.dpf-box--intro{max-width:460px;padding:20px 24px 24px;}' +
      '.dpf-ibadge{display:inline-block;background:#f3eeff;color:#6c3fc5;border-radius:8px;' +
        'padding:6px 12px;font-size:13px;font-weight:800;}' +
      '.dpf-ih{font-size:25px;font-weight:700;letter-spacing:-1px;line-height:1.42;' +
        'margin:14px 0 10px;color:#191f28;word-break:keep-all;}' +
      '.dpf-isub{font-size:15px;color:#8b8a9b;line-height:1.65;margin:0 0 24px;}' +
      '.dpf-ilist{border-top:1px solid #eeecf4;margin-bottom:8px;}' +
      '.dpf-irow{display:flex;gap:12px;align-items:center;padding:14px 2px;' +
        'border-bottom:1px solid #eeecf4;}' +
      '.dpf-ino{width:22px;height:22px;flex-shrink:0;border-radius:7px;background:#f4f4f7;' +
        'color:#8b8a9b;font-size:11.5px;font-weight:800;display:flex;align-items:center;' +
        'justify-content:center;}' +
      '.dpf-iv{font-size:15px;color:#4e5968;font-weight:500;letter-spacing:-.3px;' +
        'line-height:1.4;word-break:keep-all;}' +
      // 지름길은 눈에 덜 띄어야 한다. 이게 파란 버튼이면 아무도 질문에 안 답한다.
      '.dpf-skip{display:block;width:100%;margin-top:6px;border:none;background:none;' +
        'font-family:inherit;font-size:14.5px;font-weight:500;color:#8b8a9b;' +
        'padding:12px;cursor:pointer;}' +
      '.dpf-skip:hover{color:#6c3fc5;}' +
      '@media(max-width:640px){.dpf-ih{font-size:22px;}.dpf-load-t{font-size:19px;}}' +
      // 결과 — 전면
      '.dpf-box--page{max-width:1100px;}' +
      '.dpf-q--big{font-size:26px;line-height:1.35;}' +
      '.dpf-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;}' +
      '.dpf-chip{border:1px solid #e5e2f0;background:#fff;color:#6b6880;border-radius:99px;' +
        'padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}' +
      '.dpf-chip:hover{border-color:#c9bdf5;}' +
      '.dpf-chip.is-on{border-color:#6c3fc5;color:#6c3fc5;background:#f6f2fe;font-weight:800;}' +
      '.dpf-card{position:relative;}' +
      '.dpf-rank{position:absolute;top:-7px;right:-7px;width:24px;height:24px;border-radius:7px;' +
        'background:#e5484d;color:#fff;font-size:12px;font-weight:800;' +
        'display:flex;align-items:center;justify-content:center;z-index:1;}' +
      '.dpf-badges{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;}' +
      '.dpf-badge{font-size:10.5px;font-weight:800;color:#fff;border-radius:5px;padding:2px 6px;}' +
      '.dpf-badge--green{background:#22a06b;}' +
      '.dpf-badge--blue{background:#6c3fc5;}' +
      '.dpf-badge--orange{background:#e08600;}' +
      '.dpf-badge--red{background:#e5484d;}' +
      // 결과 맨 위 지원금 알림 — 색 띠가 아니라 큰 글자로 세운다.
      // 배경을 칠하면 띠가 배경으로 읽히고 아래 상품 카드가 더 도드라진다.
      '.dpf-rw{text-align:center;margin:0 0 22px;padding:24px 20px 22px;border-radius:18px;' +
        'background:#fff;border:1px solid #ece5fa;box-shadow:0 8px 26px rgba(108,63,197,.10);}' +
      '.dpf-rw-tag{display:inline-block;margin-bottom:11px;padding:5px 13px;border-radius:99px;' +
        'background:#f4f0fd;color:#6c3fc5;font-size:12px;font-weight:800;letter-spacing:-.2px;}' +
      '.dpf-rw-h{margin:0;font-size:29px;font-weight:900;color:#1b1830;line-height:1.35;' +
        'letter-spacing:-.8px;word-break:keep-all;}' +
      '.dpf-rw-h b{color:#e5484d;font-weight:900;}' +
      '.dpf-rw-s{margin:10px 0 0;font-size:15px;font-weight:700;color:#6b6880;line-height:1.55;' +
        'word-break:keep-all;}' +
      '.dpf-rw-s b{color:#6c3fc5;font-weight:800;}' +
      // ⚠ 점선을 넣지 않는다. 아래 신청 줄이 이미 선 하나를 갖고 있어 선이 둘이 된다.
      '.dpf-rw-n{margin:11px 0 0;font-size:18px;font-weight:800;color:#221f38;' +
        'line-height:1.5;word-break:keep-all;}' +
      '.dpf-rw-n b{color:#e5484d;font-weight:900;}' +
      // 결과 화면 머리 — 로고를 가운데, 닫기를 오른쪽 끝에
      '.dpf-head--res{position:relative;justify-content:center;margin-bottom:20px;}' +
      '.dpf-head--res .dpf-x{position:absolute;right:0;top:50%;transform:translateY(-50%);}' +
      '.dpf-rlogo{display:flex;justify-content:center;}' +
      '.dpf-rlogo img{height:30px;width:auto;opacity:.95;}' +
      '@media(max-width:520px){.dpf-rlogo img{height:24px;}}' +
      // 사진이 없어도 같은 높이를 지킨다. 회색칸만 남고 글자 자리는 그대로다.
      '.dpf-thumb--no{background:#f6f5fa;}' +
      // 카드 고르기 — 눌린 카드가 한눈에 보여야 바닥 버튼과 이어진다
      '.dpf-card{cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease;}' +
      '.dpf-card:hover{border-color:#d6c9f7;}' +
      '.dpf-card.is-pick{border-color:#6c3fc5;box-shadow:0 0 0 2px rgba(108,63,197,.16);}' +
      '.dpf-pick{position:absolute;top:-7px;left:-7px;width:24px;height:24px;border-radius:50%;' +
        'background:#6c3fc5;color:#fff;font-size:13px;font-weight:900;z-index:1;' +
        'display:flex;align-items:center;justify-content:center;}' +
      // 바닥 신청 줄 — 지원금을 한 번 더 말하고 세 버튼을 놓는다
      '.dpf-act{margin-top:20px;padding:18px;border-radius:16px;background:#faf9fd;' +
        'border:1px solid #efecf8;}' +
      '.dpf-act-push{text-align:center;margin-bottom:15px;}' +
      '.dpf-act-h{margin:0;font-size:21px;font-weight:900;color:#1b1830;line-height:1.4;' +
        'letter-spacing:-.4px;word-break:keep-all;}' +
      '.dpf-act-h b{color:#e5484d;font-weight:900;}' +
      '.dpf-act-s{margin:6px 0 0;font-size:14px;font-weight:700;color:#6c3fc5;word-break:keep-all;}' +
      '.dpf-act-s b{color:#6c3fc5;}' +
      '.dpf-act-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;}' +
      // 위쪽 신청 줄 — 지원금 알림과 한 상자 안에 들어간다.
      // ⚠ 여기에 배경·테두리·그림자를 주지 않는다. 상자는 바깥(.dpf-rw)이 이미 갖고 있고,
      //   안에 또 상자를 그리면 두 덩어리로 읽힌다. 옅은 선으로만 나눈다. (2026-08-08)
      '.dpf-act--top{margin:20px 0 0;padding:20px 0 0;background:none;border:none;' +
        'border-top:1px solid #f1ecfb;border-radius:0;box-shadow:none;}' +
      '.dpf-act--top .dpf-act-push{margin-bottom:14px;}' +
      '.dpf-act--top .dpf-act-btns{margin-left:0;justify-content:center;}' +
      '.dpf-act--top .dpf-act-b{padding:14px 24px;font-size:15px;}' +
      '.dpf-act-hint{font-size:13px;color:#8b88a3;font-weight:600;}' +
      '.dpf-act-on{font-size:13.5px;color:#6b6880;font-weight:600;}' +
      '.dpf-act-on b{color:#221f38;font-weight:800;}' +
      '.dpf-act-btns{margin-left:auto;display:flex;gap:9px;flex-wrap:wrap;}' +
      '.dpf-act-b{border:none;border-radius:11px;padding:13px 20px;font-size:14.5px;font-weight:800;' +
        'cursor:pointer;font-family:inherit;white-space:nowrap;transition:transform .12s ease;}' +
      '.dpf-act-b:hover{transform:translateY(-1px);}' +
      '.dpf-act-b--a{background:#6c3fc5;color:#fff;}' +
      '.dpf-act-b--a:hover{background:#5b34ad;}' +
      '.dpf-act-b--s{background:#2563eb;color:#fff;}' +
      '.dpf-act-b--s:hover{background:#1d4ed8;}' +
      '.dpf-act-b--k{background:#fee500;color:#181600;}' +
      '.dpf-act-b--k:hover{background:#f2da00;}' +
      // 버튼 셋이 한 줄에 안 들어가면 줄 전체를 세로로 세운다.
      '@media(max-width:900px){.dpf-act-row{flex-direction:column;align-items:stretch;gap:11px;}' +
        '.dpf-act-btns{margin-left:0;}.dpf-act-b{flex:1 1 0;padding:14px 8px;font-size:13.5px;}}' +
      '@media(max-width:520px){.dpf-act{padding:16px 14px;}' +
        '.dpf-act-h{font-size:17px;}.dpf-act-s{font-size:13px;}' +
        '.dpf-act-btns{flex-direction:column;}.dpf-act-b{width:100%;font-size:14.5px;}}' +
      // ── 좁아지면 세로로 쌓는다 (2026-08-10) ──────────────────
      //
      // ★ 폰에서 가로 2칸을 유지하면 카드가 반토막이 나서 이름이 세 줄로 접히고
      //   그림은 손톱만 해진다. 세로로 한 줄씩 쌓으면 그림도 글자도 제 크기로 나온다.
      //   토스가 폰에서 모든 목록을 세로로 두는 이유와 같다.
      '@media(max-width:820px){.dpf-res,.dpf-res--n3,.dpf-res--n4{grid-template-columns:repeat(2,1fr);}' +
        '.dpf-opts--card{grid-template-columns:repeat(2,1fr);}' +
        '.dpf-opts--n1{grid-template-columns:1fr;}}' +
      // 폰 — 선택지도 결과 카드도 한 줄에 하나. 카드는 가로로 눕힌다.
      '@media(max-width:600px){' +
        '.dpf-opts--card,.dpf-opts--n1,.dpf-opts--n2,.dpf-opts--n3{grid-template-columns:1fr;}' +
        '.dpf-opt--card{flex-direction:row;align-items:center;text-align:left;gap:14px;padding:14px 16px;}' +
        '.dpf-opt--card .dpf-opt-img{width:78px;height:60px;flex-shrink:0;}' +
        '.dpf-opt--card .dpf-opt-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}' +
        '.dpf-res,.dpf-res--n1,.dpf-res--n2,.dpf-res--n3,.dpf-res--n4{grid-template-columns:1fr;gap:10px;}' +
        '.dpf-card{flex-direction:row;align-items:center;gap:13px;padding:12px;}' +
        '.dpf-card-l{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;}' +
        '.dpf-thumb{width:84px;height:84px;flex-shrink:0;margin:0;}' +
        '.dpf-rank{top:8px;left:8px;}' +
      '}' +
      '@media(max-width:520px){.dpf-box{padding:18px 16px 16px;}.dpf-q{font-size:18px;}' +
        '.dpf-rw{padding:19px 14px 17px;border-radius:14px;}' +
        '.dpf-rw-h{font-size:21px;}.dpf-rw-s{font-size:13px;}.dpf-rw-n{font-size:15.5px;}' +
      '}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── 진입 ─────────────────────────────────────────────────────────

  // 정의와 상품을 받아 상태를 세운다. 서버에서 받든 어드민이 손에 들고 있든 여기로 모인다.
  /**
   * 조합 상품 — 관리자가 여러 상품을 묶어 하나로 만든 항목 (2026-08-10).
   *
   * ★ 왜 필요한가
   *   인터넷·TV 는 '100M + TV + 공유기' 가 한 덩어리로 팔린다. 그런데 상품 표에는
   *   그 덩어리가 없다. 화면이 통신사 1줄을 속도별로 펼쳐 만들 뿐이라 TV·공유기까지는
   *   못 만든다. 관리자가 직접 묶어 이름과 요금과 지원금을 적을 자리가 있어야 한다.
   *
   * ★ 상품인 척하게 만든다
   *   { id, name } 만 갖추면 점수·고정·사진·지원금·배지가 전부 그대로 돈다.
   *   엔진에 조합 전용 길을 따로 내면 그 길만 빠뜨리는 버그가 생긴다.
   *
   * ⚠ id 는 관리자가 만들 때 정해 둔다. 여기서 새로 만들면 저장할 때마다 값이 바뀌어
   *   4단계에서 골라 둔 것과 사진·지원금이 통째로 끊긴다.
   */
  function comboRows(def) {
    var list = (def && def.result && def.result.combos) || [];
    if (!Array.isArray(list)) return [];
    return list
      .filter(function (c) { return c && c.id && String(c.name || '').trim(); })
      .map(function (c) {
        return {
          id: String(c.id),
          name: String(c.name),
          sortOrder: Number(c.sortOrder) || 0,
          // 연결층이 읽는 이름으로도 넣어 둔다(인터넷은 monthlyFee 를 본다).
          monthlyFee: Number(c.fee) || 0,
          imageUrl: c.imageUrl || '',
          __combo: c,
        };
      });
  }

  function setup(def, name, products, opt) {
    if (!Array.isArray(def && def.questions) || !def.questions.length) {
      console.warn('[finder] 정의에 질문이 없다');
      return false;
    }
    // 관리자가 만든 조합 상품을 후보에 섞는다. 앞에 둬야 동점일 때 먼저 나온다.
    products = comboRows(def).concat(arr(products));

    // 문항마다 실제로 그릴 선택지를 미리 만들어 둔다.
    // 그릴 때마다 계산하면 상품 수가 많을 때 화면이 끊긴다.
    def.questions.forEach(function (q) {
      q._opts = buildDynamicOptions(q, products);
    });
    // waitT — 기다림 화면 타이머. 하나만 돌아야 한다(paintWait 주석 참고).
    S = { def: def, name: name, products: products, opt: opt || {},
          answers: {}, cur: -1, chip: -1, waitT: null };
    return true;
  }

  /**
   * 미리보기 (2026-08-06) — 어드민 편집기가 쓴다.
   *
   * ★ 왜 어드민이 자기 미리보기를 따로 그리지 않나
   *   product-view.js 와 같은 이유다. 전에는 웹과 어드민이 각자 그려서
   *   관리자가 미리보기에서 본 것과 실제 화면이 달랐다. 같은 파일이 그리면 어긋날 수 없다.
   *
   * ⚠ 넘긴 정의를 이 함수가 고친다(_opts 를 붙인다).
   *   편집기가 들고 있는 원본을 그대로 넘기면 저장할 때 _opts 가 함께 서버로 간다.
   *   부르는 쪽에서 복사본을 넘기거나, 저장 전에 _opts 를 지워야 한다.
   */
  function preview(def, products, opt) {
    injectStyles();
    if (!setup(def, (opt && opt.name) || '미리보기', arr(products), opt || {})) return;
    open();
  }

  /**
   * 카테고리 번호를 알아낸다.
   *
   * ★ 화면이 UUID 를 코드에 박지 않게 하려고 둔다.
   *   로컬 DB 와 운영 DB 의 UUID 가 다르다. 박아 두면 한쪽에서만 파인더가 안 뜨고
   *   오류도 안 나서 원인을 찾는 데 한참 걸린다(product-faq.js 와 같은 이유).
   *   그래서 화면은 slug 나 type 만 적고 번호는 여기서 찾는다.
   */
  function resolveCategoryId(opt) {
    if (opt.categoryId) return Promise.resolve(opt.categoryId);
    if (!opt.categorySlug && !opt.categoryType) return Promise.resolve(null);

    return api.get('/api/categories').then(function (res) {
      var rows = arr(res).filter(Boolean);
      if (opt.categorySlug) {
        var bySlug = rows.filter(function (c) {
          return String(c.slug || '').toLowerCase() === String(opt.categorySlug).toLowerCase();
        })[0];
        if (bySlug) return bySlug.id;
      }
      if (opt.categoryType) {
        // 같은 타입이 여럿일 수 있다(관리자가 만든 카테고리는 전부 GENERIC 이다).
        // 그런 경우는 slug 로 지정해야 한다 — 여기서 아무거나 고르면 조용히 틀린다.
        var byType = rows.filter(function (c) {
          return String(c.type || '') === String(opt.categoryType);
        });
        if (byType.length > 1) {
          console.warn('[finder] 타입 "' + opt.categoryType + '" 인 카테고리가 ' +
            byType.length + '개다. categorySlug 로 지정해야 한다.');
        }
        if (byType.length) return byType[0].id;
      }
      return null;
    });
  }

  function init(opt) {
    opt = opt || {};
    if (typeof api === 'undefined' || !api.get) return;
    if (typeof opt.loadProducts !== 'function') {
      console.warn('[finder] loadProducts 는 필수다');
      return;
    }
    // 정의를 받기 전에는 빈 칸으로 둔다. 파인더가 없으면 그대로 비어 있다.
    var slot = opt.buttonSlot
      ? (typeof opt.buttonSlot === 'string' ? document.getElementById(opt.buttonSlot) : opt.buttonSlot)
      : null;
    if (slot) slot.innerHTML = '';

    resolveCategoryId(opt)
      .then(function (categoryId) {
        if (!categoryId) {
          console.warn('[finder] 카테고리를 못 찾았다', opt.categoryId, opt.categorySlug, opt.categoryType);
          return null;
        }
        return api.get('/api/finders?categoryId=' + encodeURIComponent(categoryId));
      })
      .then(function (res) {
        if (!res) return null;
        var rows = arr(res);
        if (!rows.length) {
          // 이 카테고리에 파인더가 없다. 버튼을 숨긴 채로 조용히 끝낸다.
          console.info('[finder] 이 카테고리에 파인더가 없다');
          return null;
        }
        return Promise.resolve(opt.loadProducts()).then(function (products) {
          return { row: rows[0], products: arr(products) };
        });
      })
      .then(function (ready) {
        if (!ready) return;
        if (!setup(ready.row.definition || {}, ready.row.name, ready.products, opt)) return;

        if (slot) {
          mountEntry(slot);
          // 따라오는 버튼은 화면이 켜야 붙는다. 기본으로 켜면 정수기 등 다른 화면이
          // 손도 안 댔는데 모양이 바뀐다.
          if (opt.sticky) mountSticky(slot);
        }

        // 주소에 ?finder=1 이 붙어 있으면 버튼을 안 눌러도 바로 연다.
        // 다른 페이지 배너에서 '이 카테고리 찾기' 로 보낼 때 쓴다 —
        // 고객은 배너를 누르자마자 질문이 시작되는 것으로 느낀다.
        //
        // ?finder=result 는 질문을 건너뛰고 결과부터 연다 (2026-08-10 메인 검색창).
        // ?q= 에 고객이 적은 말이 실려 온다. 결과 문구에 그대로 되비춘다.
        try {
          var sp = new URLSearchParams(location.search);
          var f = sp.get('finder');
          if (f === '1') open();
          else if (f === 'result') openResult(sp.get('q'));
        } catch (x) {}
        if (typeof opt.onReady === 'function') opt.onReady(ready.row);
      })
      .catch(function (e) {
        // 파인더 때문에 상품 화면이 죽으면 안 된다. 버튼만 안 나온다.
        console.warn('[finder] 준비 실패', e && e.message);
      });
  }

  // 열려 있을 때만 Esc 를 가로챈다.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var ov = document.getElementById('dpf-ov');
    if (!ov || ov.hidden) return;
    e.stopPropagation();
    close();
  }, true);

  // feeOf 를 내보내는 이유 — 어드민 4단계 상품 목록에도 같은 월 요금을 보여줘야 한다.
  // 어드민에 계산을 복사하면 관리자가 본 요금과 고객이 보는 요금이 갈린다.
  window.dpFinder = {
    init: init, preview: preview, open: open, openResult: openResult, close: close, feeOf: feeOf,
  };
})();
