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
//     buttonEl   : document.getElementById('x'), // 선택. 없으면 open() 을 직접 부른다
//     loadProducts: function () { return Promise.resolve([...]) },  // 필수
//     hrefOf : function (p) { return '/water-detail?id=' + p.id; },
//     imageOf: function (p) { return p.imageUrl; },
//     feeOf  : function (p) { return 0; },      // 없으면 요금을 안 적는다
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
    var v = pathGet(p, rule.field);
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
        var opt = (q.options || []).filter(function (o) {
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
  //   'brand'          → p.brand
  //   'color'          → p.colors[] (배열)
  //   'field:<경로>'   → 그 칸. 배열이면 펼친다
  function buildDynamicOptions(q, products) {
    var src = q.optionSource;
    if (!src) return q.options || [];

    var field = src === 'brand' ? 'brand' : src === 'color' ? 'colors' : String(src).replace(/^field:/, '');
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
        return {
          value: v,
          label: base.label || v,
          desc: base.desc || '',
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
    if (S.cur >= steps().length - 1) { paintResult(); return; }
    S.cur += 1;
    paint();
  }

  function prev() {
    if (S.cur <= -1) return;
    S.cur -= 1;
    paint();
  }

  function progressHtml() {
    var n = steps().length;
    var i = Math.max(0, S.cur);
    return '<span class="dpf-step">' + (S.cur < 0 ? '시작' : (i + 1) + ' / ' + n) + '</span>';
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
    if (!q) { paintResult(); return; }

    var opts = q._opts || [];
    ov.innerHTML =
      '<div class="dpf-box">' +
      '<div class="dpf-head">' + progressHtml() +
      '<button type="button" class="dpf-x" data-dpf-close aria-label="닫기">✕</button></div>' +
      '<h2 class="dpf-q">' + esc(q.title || '') + '</h2>' +
      (q.sub ? '<p class="dpf-qsub">' + esc(q.sub) + '</p>' : '') +
      '<div class="dpf-opts">' +
      opts
        .map(function (o) {
          return (
            '<button type="button" class="dpf-opt' + (isPicked(q.key, o.value) ? ' is-on' : '') +
            '" data-v="' + esc(o.value) + '">' +
            '<span class="dpf-opt-l">' + esc(o.label) + '</span>' +
            (o.desc ? '<span class="dpf-opt-d">' + esc(o.desc) + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
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

  function feeHtml(p) {
    if (!S.opt.feeOf) return '';
    var n = Number(S.opt.feeOf(p));
    if (!isFinite(n) || n <= 0) return '';
    return '<div class="dpf-fee">월 <b>' + n.toLocaleString('ko-KR') + '</b>원' +
      esc(S.opt.feeSuffix || '') + '</div>';
  }

  function paintResult() {
    var r = S.def.result || {};
    var limit = Number(r.count) || 6;

    var ranked = S.products
      .map(function (p) {
        var sc = scoreOf(p);
        return { p: p, s: sc.score, why: sc.why };
      })
      .sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        return (a.p.sortOrder || 999) - (b.p.sortOrder || 999);
      })
      .slice(0, limit);

    var best = ranked.length ? ranked[0].s : 0;
    // 아무 조건도 못 맞췄으면 솔직하게 말한다. 그럴듯하게 포장하지 않는다.
    var lead = best === 0
      ? (r.leadEmpty || '고르신 조건에 딱 맞는 상품을 아직 찾지 못했습니다. 대신 많이 찾는 상품을 보여드립니다.')
      : (r.leadMatched || '고르신 조건에 가까운 순서로 보여드립니다.');

    var ov = el();
    ov.innerHTML =
      '<div class="dpf-box dpf-box--wide">' +
      '<div class="dpf-head"><span class="dpf-step">추천 결과</span>' +
      '<button type="button" class="dpf-x" data-dpf-close aria-label="닫기">✕</button></div>' +
      '<h2 class="dpf-q">' + esc(r.title || '이런 상품은 어떠세요?') + '</h2>' +
      '<p class="dpf-qsub">' + esc(lead) + '</p>' +
      (ranked.length
        ? '<div class="dpf-res">' + ranked.map(cardHtml).join('') + '</div>'
        : '<p class="dpf-qsub">보여드릴 상품이 없습니다.</p>') +
      '<div class="dpf-foot">' +
      '<button type="button" class="dpf-sub" data-dpf-again>다시 고르기</button>' +
      '<button type="button" class="dpf-sub" data-dpf-close>닫기</button>' +
      '</div></div>';

    ov.querySelector('[data-dpf-again]').onclick = open;

    ov.querySelectorAll('[data-dpf-apply]').forEach(function (b) {
      b.onclick = function () {
        var hit = ranked.filter(function (x) { return String(x.p.id) === b.dataset.id; })[0];
        if (hit && typeof S.opt.onApply === 'function') S.opt.onApply(hit.p);
      };
    });
  }

  function cardHtml(x) {
    var p = x.p;
    var img = S.opt.imageOf ? S.opt.imageOf(p) : p.imageUrl;
    var href = S.opt.hrefOf ? S.opt.hrefOf(p) : '/product-detail?id=' + encodeURIComponent(p.id);

    // '이래서 골랐어요' 는 중복을 지우고 최대 3개만. 다 적으면 카드가 설명서가 된다.
    var why = [];
    x.why.forEach(function (w) { if (w && why.indexOf(w) < 0) why.push(w); });
    why = why.slice(0, 3);

    return (
      '<div class="dpf-card">' +
      '<a class="dpf-card-l" href="' + esc(href) + '">' +
      '<div class="dpf-thumb">' +
      (img ? '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy"/>'
           : '<span class="dpf-noimg">이미지 준비중</span>') +
      '</div>' +
      '<div class="dpf-name">' + esc(p.name || '') + '</div>' +
      feeHtml(p) +
      (why.length
        ? '<div class="dpf-why">' + why.map(function (w) {
            return '<span class="dpf-why-b">✓ ' + esc(w) + '</span>';
          }).join('') + '</div>'
        : '') +
      '</a>' +
      (typeof S.opt.onApply === 'function'
        ? '<button type="button" class="dpf-apply" data-dpf-apply data-id="' + esc(p.id) + '">신청하기</button>'
        : '') +
      '</div>'
    );
  }

  // ── 스타일 ───────────────────────────────────────────────────────
  function injectStyles() {
    if (_styled) return;
    _styled = true;
    var css =
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
      '.dpf-foot{display:flex;gap:8px;justify-content:space-between;margin-top:18px;}' +
      '.dpf-sub{border:1px solid #e5e2f0;background:#fff;color:#6a6880;border-radius:10px;' +
        'padding:11px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.dpf-sub:hover{border-color:#c9bdf5;color:#5b3fbe;}' +
      '.dpf-go{width:100%;margin-top:18px;border:none;background:#6c3fc5;color:#fff;border-radius:12px;' +
        'padding:15px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.dpf-go:hover{background:#5b34ad;}' +
      '.dpf-go--sm{width:auto;margin:0;padding:11px 18px;font-size:13.5px;border-radius:10px;}' +
      // 결과 — 3열. 좁아지면 2열, 더 좁아지면 1열.
      '.dpf-res{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}' +
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
      '.dpf-apply{margin-top:9px;width:100%;border:none;background:#f4f0fd;color:#5b3fbe;' +
        'border-radius:9px;padding:9px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.dpf-apply:hover{background:#e9e0fb;}' +
      '@media(max-width:820px){.dpf-res{grid-template-columns:repeat(2,1fr);}}' +
      '@media(max-width:520px){.dpf-box{padding:18px 16px 16px;}.dpf-q{font-size:18px;}' +
        '.dpf-res{grid-template-columns:1fr 1fr;gap:9px;}}';
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
    S = { def: def, name: name, products: products, opt: opt || {}, answers: {}, cur: -1 };
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
    if (opt.buttonEl) opt.buttonEl.hidden = true;   // 정의를 받기 전에는 버튼을 숨긴다

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

        if (opt.buttonEl) {
          opt.buttonEl.hidden = false;
          opt.buttonEl.addEventListener('click', open);
        }
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

  window.dpFinder = { init: init, preview: preview, open: open, close: close };
})();
