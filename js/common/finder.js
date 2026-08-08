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

  function open() {
    if (!S || !S.def) return;
    injectStyles();
    S.answers = {};
    S.cur = -1;   // -1 = 시작 화면
    S.chip = -1;  // 켜 둔 필터 칩. -1 = 없음
    S.pick = null;  // 결과에서 고른 상품 id. 하단 신청 버튼이 이걸 싣고 간다
    el().hidden = false;
    document.body.style.overflow = 'hidden';
    paint();
  }

  function close() {
    var e = document.getElementById('dpf-ov');
    if (e) e.hidden = true;
    document.body.style.overflow = '';
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

    // 시작 화면
    if (S.cur < 0) {
      var intro = S.def.intro || {};
      ov.innerHTML =
        '<div class="dpf-box">' +
        '<div class="dpf-head">' + progressHtml() +
        '<button type="button" class="dpf-x" data-dpf-close aria-label="닫기">✕</button></div>' +
        '<h2 class="dpf-q">' + esc(intro.title || S.name || '상품 찾기') + '</h2>' +
        (intro.sub ? '<p class="dpf-qsub">' + esc(intro.sub) + '</p>' : '') +
        '<button type="button" class="dpf-go" data-dpf-next>' +
        esc(intro.buttonLabel || '시작하기') + '</button>' +
        '</div>';
      ov.querySelector('[data-dpf-next]').onclick = next;
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
  function mountEntry(slot) {
    injectStyles();
    var e = S.def.entry || {};
    var bubble = e.bubble || '';
    slot.innerHTML =
      (bubble ? '<span class="dpf-cta-bub">' + esc(bubble) + '</span>' : '') +
      '<button type="button" class="dpf-cta">' +
      '<span class="dpf-cta-ico">' + esc(e.icon || '🔎') + '</span>' +
      '<span class="dpf-cta-txt"><b>' + esc(e.title || S.name || '나만의 상품 찾기') + '</b>' +
      (e.sub ? '<em>' + esc(e.sub) + '</em>' : '') + '</span>' +
      '<span class="dpf-cta-go">' + esc(e.label || '시작하기') + ' ›</span>' +
      '</button>';
    var btn = slot.querySelector('.dpf-cta');
    if (btn) btn.addEventListener('click', open);
  }

  function paintLoading() {
    var l = S.def.loading || {};
    // 어드민에서 두 줄로 적는다. lines(배열)는 옛 정의와의 호환용이다.
    var lines = [];
    if (l.title) lines.push(l.title);
    if (l.sub) lines.push(l.sub);
    if (!lines.length) {
      lines = l.lines || ['최대 지원금 상품을 찾고 있어요', '잠시만 기다려주세요'];
    }
    // 기다리는 동안 브랜드를 보여준다. 5초를 그냥 두면 '이게 뭐지' 가 되고,
    // 로고가 있으면 '다픽이 찾아주는 중' 으로 읽힌다.
    // 관리자가 2단계에서 다른 그림을 넣으면 그것이 이긴다.
    var brand = l.imageUrl
      ? '<div class="dpf-load-img"><img src="' + esc(l.imageUrl) + '" alt=""/></div>'
      : '<div class="dpf-load-logo"><img src="/assets/logos/dapicklogo.png" alt="다픽"' +
        ' onerror="this.parentNode.style.display=\'none\'"/></div>';

    el().innerHTML =
      '<div class="dpf-box dpf-box--load">' +
      brand +
      '<div class="dpf-dots"><i></i><i></i><i></i><i></i></div>' +
      lines.map(function (t) { return '<p class="dpf-load-t">' + esc(t) + '</p>'; }).join('') +
      '</div>';
    // 기다리는 시간도 어드민에서 정한다.
    // ⚠ 길수록 '열심히 찾는 느낌' 이 나지만 그만큼 이탈도 는다. 실제 숫자를 보고 조절할 것.
    var ms = Number(l.ms);
    if (!(ms >= 0)) ms = 5000;
    setTimeout(paintResult, ms);
  }

  // 점수 순으로 줄 세운다. 칩은 여기서 거르지 않는다 — 칩을 껐을 때 되돌아와야 한다.
  function rank() {
    return S.products
      .map(function (p) {
        var sc = scoreOf(p);
        return { p: p, s: sc.score, why: sc.why };
      })
      .sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
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

  // 상품 하나에 걸린 지원금(사은품). 화면이 giftOf 를 주면 그쪽 말을 따른다.
  function giftOf(p) {
    if (!p || typeof p !== 'object') return 0;
    if (S && S.opt && typeof S.opt.giftOf === 'function') return Number(S.opt.giftOf(p)) || 0;
    if (p.gift != null) return Number(p.gift) || 0;
    if (p.giftAmount != null) return Number(p.giftAmount) || 0;
    if (p.cashback != null) return Number(p.cashback) || 0;
    return 0;
  }

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
  function rewardHtml(ranked) {
    var w = (S.def.result || {}).reward || {};
    if (!w.on) return '';

    var amount = String(w.amount || '').trim();
    if (!amount) {
      var top = 0;
      ranked.forEach(function (x) { var g = giftOf(x.p); if (g > top) top = g; });
      amount = top > 0 ? moneyKo(top) : '';
    }

    // 옛 이름(top) 도 읽는다. 5단계에서 headline 으로 옮기기 전에 저장한 것이 있다.
    var head = w.headline || w.top || '';
    if (!head && !w.sub) return '';

    return '<div class="dpf-rw">' +
      (w.badge ? '<span class="dpf-rw-tag">' + esc(w.badge) + '</span>' : '') +
      (head ? '<p class="dpf-rw-h">' + fillTokens(head, amount) + '</p>' : '') +
      (w.sub ? '<p class="dpf-rw-s">' + fillTokens(w.sub, amount) + '</p>' : '') +
      '</div>';
  }

  function paintResult() {
    var r = S.def.result || {};
    var limit = Math.min(RES_MAX, Number(r.count) || RES_MAX);
    var all = rank();

    // 칩이 켜져 있으면 그 조건에 맞는 것만 남긴다.
    var chip = (r.filters || [])[S.chip];
    var rows = chip ? all.filter(function (x) { return rulesHit(x.p, chip.rules); }) : all;

    // 아무 답에도 안 걸린 상품(0점)은 뺀다. 관리자가 지정한 것만 나오게 하기 위해서다.
    // ⚠ 전부 0점이면 빼지 않는다 — 답을 아직 안 했거나 조건이 다 어긋난 경우인데,
    //   빈 화면을 보여주면 "이 사이트엔 없다" 로 읽힌다. 아래 lead 문구가 사정을 밝힌다.
    var hit = rows.filter(function (x) { return x.s > 0; });
    var ranked = balanced(hit.length ? hit : rows, limit);

    // 고른 상품이 목록에서 사라졌으면(칩을 눌러 걸러졌다) 놓아준다.
    // 안 그러면 바닥 줄이 화면에 없는 상품 이름을 계속 들고 있는다.
    if (S.pick && !ranked.some(function (x) { return String(x.p.id) === String(S.pick); })) {
      S.pick = null;
    }
    // 아무것도 안 골랐으면 1등을 켜 둔다. 세 버튼이 곧바로 쓸모 있어야 한다.
    if (!S.pick && ranked.length) S.pick = ranked[0].p.id;

    var best = ranked.length ? ranked[0].s : 0;
    // 아무 조건도 못 맞췄으면 솔직하게 말한다. 그럴듯하게 포장하지 않는다.
    var lead = chip && !ranked.length
      ? '고르신 조건에 맞는 상품이 없습니다. 다른 항목을 눌러보세요.'
      : best === 0
        ? (r.leadEmpty || '고르신 조건에 딱 맞는 상품을 아직 찾지 못했습니다. 대신 많이 찾는 상품을 보여드립니다.')
        : (r.leadMatched || '고르신 조건에 가까운 순서로 보여드립니다.');

    var ov = el();
    ov.innerHTML =
      '<div class="dpf-box dpf-box--page">' +
      '<div class="dpf-head"><span class="dpf-step">추천 결과</span>' +
      '<button type="button" class="dpf-x" data-dpf-close aria-label="닫기">✕</button></div>' +
      rewardHtml(ranked) +
      '<h2 class="dpf-q dpf-q--big">' + esc(r.title || '이런 상품은 어떠세요?') + '</h2>' +
      '<p class="dpf-qsub">' + esc(lead) + '</p>' +
      chipsHtml() +
      (ranked.length
        ? '<div class="dpf-res dpf-res--n' + Math.min(RES_MAX, ranked.length) + '">' +
          ranked.map(cardHtml).join('') + '</div>'
        : '<p class="dpf-qsub">보여드릴 상품이 없습니다.</p>') +
      (ranked.length ? actionsHtml(ranked) : '') +
      '<div class="dpf-foot">' +
      '<button type="button" class="dpf-sub" data-dpf-again>다시 고르기</button>' +
      '<button type="button" class="dpf-sub" data-dpf-close>닫기</button>' +
      '</div></div>';

    ov.querySelector('[data-dpf-again]').onclick = open;

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

    var ab = ov.querySelector('[data-dpf-apply]');
    if (ab) ab.onclick = function () {
      var p = pickedRow(ranked);
      if (p && typeof S.opt.onApply === 'function') S.opt.onApply(p);
    };

    var sb = ov.querySelector('[data-dpf-simple]');
    if (sb) sb.onclick = function () { fireSimple(pickedRow(ranked)); };

    var kb = ov.querySelector('[data-dpf-kakao]');
    if (kb) kb.onclick = function () {
      var url = String(actionsOf().kakaoUrl || '').trim();
      // ⚠ 관리자가 적는 칸이라 javascript: 같은 주소가 들어올 수 있다. http 만 연다.
      if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener');
    };

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

  function actionsHtml(ranked) {
    var a = actionsOf();
    var kakaoUrl = String(a.kakaoUrl || '').trim();
    var applyOn = typeof S.opt.onApply === 'function';
    var simpleOn = a.simpleOn !== false;              // 기본은 켜짐
    var kakaoOn = a.kakaoOn !== false && !!kakaoUrl;  // 주소가 없으면 못 켠다
    if (!applyOn && !simpleOn && !kakaoOn) return '';

    var p = pickedRow(ranked);
    var line = p
      ? '<span class="dpf-act-on">' + esc(a.pickedLabel || '고른 상품') + ' · <b>' +
        esc(p.name || '') + '</b></span>'
      : '<span class="dpf-act-hint">' +
        esc(a.pickHint || '위에서 상품을 누르면 그 상품으로 접수됩니다') + '</span>';

    return '<div class="dpf-act">' + line + '<div class="dpf-act-btns">' +
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
      '</div></div>';
  }

  // 간편 신청을 실제로 여는 것은 화면 쪽 일이다.
  // 연결층이 onSimple 을 주면 그걸 쓰고, 없으면 사이트 공용 openSimpleApply 를 쓴다.
  // 어드민 미리보기에는 둘 다 없다 — 모양만 보는 자리라 조용히 넘어간다.
  function fireSimple(p) {
    if (typeof S.opt.onSimple === 'function') { S.opt.onSimple(p); return; }
    if (typeof window.openSimpleApply === 'function') { window.openSimpleApply(); return; }
    console.warn('[finder] 간편 신청을 열 방법이 없다 (onSimple 또는 openSimpleApply 필요)');
  }

  function cardHtml(x, i) {
    var p = x.p;
    var img = S.opt.imageOf ? S.opt.imageOf(p) : p.imageUrl;
    var href = S.opt.hrefOf ? S.opt.hrefOf(p) : '/product-detail?id=' + encodeURIComponent(p.id);

    // 순위는 3등까지만 적는다. 전부 적으면 6등이 나쁜 상품처럼 보인다.
    var rankTag = i < 3 ? '<span class="dpf-rank">' + (i + 1) + '</span>' : '';

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
    var inner = typeof S.opt.cardOf === 'function'
      ? S.opt.cardOf(p, x)
      : '<div class="dpf-name">' + esc(p.name || '') + '</div>' + feeHtml(p);

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
      '.dpf-cta{display:flex;align-items:center;gap:14px;width:100%;padding:18px 22px;' +
        'background:#fff;border:1px solid #e9e2f7;border-radius:16px;cursor:pointer;text-align:left;' +
        'box-shadow:0 2px 16px rgba(108,63,197,.07);transition:border-color .15s,transform .15s;}' +
      '.dpf-cta:hover{border-color:#6c3fc5;transform:translateY(-1px);}' +
      '.dpf-cta-ico{width:44px;height:44px;flex-shrink:0;border-radius:12px;background:#f3eeff;' +
        'display:flex;align-items:center;justify-content:center;font-size:20px;}' +
      '.dpf-cta-txt{flex:1;min-width:0;}' +
      '.dpf-cta-txt b{display:block;font-size:16px;font-weight:800;color:#221f38;}' +
      '.dpf-cta-txt em{display:block;margin-top:3px;font-size:13px;color:#6b7280;font-style:normal;}' +
      '.dpf-cta-go{flex-shrink:0;font-size:14px;font-weight:700;color:#6c3fc5;white-space:nowrap;}' +
      // 말풍선 — 버튼 위에 살짝 떠서 통통 튄다. 눈이 먼저 가는 자리다.
      '.dpf-cta-bub{display:inline-block;margin:0 0 8px 14px;padding:6px 13px;position:relative;' +
        'background:#221f38;color:#fff;font-size:12.5px;font-weight:700;border-radius:999px;' +
        'animation:dpfBub 1.8s ease-in-out infinite;}' +
      '.dpf-cta-bub:after{content:"";position:absolute;left:18px;bottom:-5px;width:0;height:0;' +
        'border-left:5px solid transparent;border-right:5px solid transparent;' +
        'border-top:6px solid #221f38;}' +
      '@keyframes dpfBub{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}' +
      '@media(prefers-reduced-motion:reduce){.dpf-cta-bub{animation:none;}}' +
      '@media(max-width:640px){.dpf-cta{padding:15px 16px;gap:11px;}' +
        '.dpf-cta-ico{width:38px;height:38px;font-size:17px;}' +
        '.dpf-cta-txt b{font-size:15px;}.dpf-cta-txt em{font-size:12px;}' +
        '.dpf-cta-go{font-size:13px;}.dpf-cta-bub{font-size:11.5px;margin-left:8px;}}' +
      '.dpf-ov{position:fixed;inset:0;z-index:9000;background:rgba(20,17,38,.55);' +
        'display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;}' +
      '.dpf-ov[hidden]{display:none;}' +
      '.dpf-box{width:100%;max-width:520px;background:#fff;border-radius:18px;padding:24px 22px 20px;' +
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
      '.dpf-opt--card{align-items:center;text-align:center;gap:6px;padding:16px 12px;}' +
      '.dpf-opt-img{display:flex;align-items:center;justify-content:center;width:100%;height:52px;}' +
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
      '.dpf-thumb{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;' +
        'background:#faf9fd;border-radius:8px;overflow:hidden;margin-bottom:9px;}' +
      '.dpf-thumb img{width:100%;height:100%;object-fit:contain;}' +
      '.dpf-noimg{font-size:12px;color:#a09dba;}' +
      '.dpf-name{font-size:13.5px;font-weight:700;color:#221f38;line-height:1.45;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.dpf-fee{margin-top:5px;font-size:13px;color:#5b3fbe;}' +
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
      '.dpf-dots{display:flex;gap:8px;justify-content:center;margin:22px 0 20px;}' +
      '.dpf-dots i{width:9px;height:9px;border-radius:50%;background:#cfc4f0;' +
        'animation:dpfDot 1.1s infinite ease-in-out;}' +
      '.dpf-dots i:nth-child(2){animation-delay:.15s;}' +
      '.dpf-dots i:nth-child(3){animation-delay:.3s;}' +
      '.dpf-dots i:nth-child(4){animation-delay:.45s;}' +
      '@keyframes dpfDot{0%,100%{background:#cfc4f0;transform:scale(1);}' +
        '50%{background:#6c3fc5;transform:scale(1.25);}}' +
      '.dpf-load-t{margin:0 0 6px;font-size:15px;font-weight:700;color:#221f38;line-height:1.6;}' +
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
      // 사진이 없는 카드는 자리를 낮춘다. 정사각 회색칸이 카드를 키워
      // 위쪽 지원금 글자보다 눈에 먼저 들어왔다. (2026-08-08)
      '.dpf-thumb--no{aspect-ratio:auto;height:62px;}' +
      // 카드 고르기 — 눌린 카드가 한눈에 보여야 바닥 버튼과 이어진다
      '.dpf-card{cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease;}' +
      '.dpf-card:hover{border-color:#d6c9f7;}' +
      '.dpf-card.is-pick{border-color:#6c3fc5;box-shadow:0 0 0 2px rgba(108,63,197,.16);}' +
      '.dpf-pick{position:absolute;top:-7px;left:-7px;width:24px;height:24px;border-radius:50%;' +
        'background:#6c3fc5;color:#fff;font-size:13px;font-weight:900;z-index:1;' +
        'display:flex;align-items:center;justify-content:center;}' +
      // 바닥 신청 줄 — 간편 신청과 카카오톡
      '.dpf-act{margin-top:18px;padding:15px 16px;border-radius:14px;background:#faf9fd;' +
        'border:1px solid #efecf8;display:flex;flex-wrap:wrap;align-items:center;gap:12px;}' +
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
      '@media(max-width:900px){.dpf-act{flex-direction:column;align-items:stretch;gap:11px;}' +
        '.dpf-act-btns{margin-left:0;}.dpf-act-b{flex:1 1 0;padding:14px 8px;font-size:13.5px;}}' +
      '@media(max-width:520px){.dpf-act-btns{flex-direction:column;}' +
        '.dpf-act-b{width:100%;font-size:14.5px;}}' +
      '@media(max-width:820px){.dpf-res,.dpf-res--n3,.dpf-res--n4{grid-template-columns:repeat(2,1fr);}' +
        '.dpf-opts--card{grid-template-columns:repeat(2,1fr);}' +
        '.dpf-opts--n1{grid-template-columns:1fr;}}' +
      '@media(max-width:520px){.dpf-box{padding:18px 16px 16px;}.dpf-q{font-size:18px;}' +
        '.dpf-rw{padding:19px 14px 17px;border-radius:14px;}' +
        '.dpf-rw-h{font-size:21px;}.dpf-rw-s{font-size:13px;}' +
        '.dpf-res,.dpf-res--n2,.dpf-res--n3,.dpf-res--n4{grid-template-columns:1fr 1fr;gap:9px;}}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── 진입 ─────────────────────────────────────────────────────────

  // 정의와 상품을 받아 상태를 세운다. 서버에서 받든 어드민이 손에 들고 있든 여기로 모인다.
  function setup(def, name, products, opt) {
    if (!Array.isArray(def && def.questions) || !def.questions.length) {
      console.warn('[finder] 정의에 질문이 없다');
      return false;
    }
    // 문항마다 실제로 그릴 선택지를 미리 만들어 둔다.
    // 그릴 때마다 계산하면 상품 수가 많을 때 화면이 끊긴다.
    def.questions.forEach(function (q) {
      q._opts = buildDynamicOptions(q, products);
    });
    S = { def: def, name: name, products: products, opt: opt || {}, answers: {}, cur: -1, chip: -1 };
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

        if (slot) mountEntry(slot);

        // 주소에 ?finder=1 이 붙어 있으면 버튼을 안 눌러도 바로 연다.
        // 다른 페이지 배너에서 '이 카테고리 찾기' 로 보낼 때 쓴다 —
        // 고객은 배너를 누르자마자 질문이 시작되는 것으로 느낀다.
        try {
          if (new URLSearchParams(location.search).get('finder') === '1') open();
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
  window.dpFinder = { init: init, preview: preview, open: open, close: close, feeOf: feeOf };
})();
