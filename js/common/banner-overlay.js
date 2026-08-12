// ════════════════════════════════════════════════════
// banner-overlay.js — 배너 이미지 위에 얹는 문구 (2026-08-12)
//
// 배너는 오래 이미지 한 장이 전부였다. 문구를 넣으려면 이미지 안에 글자를 그려 넣어야 했고,
// 그러면 한 글자 고치는 데 디자이너가 이미지를 다시 만들어야 했다.
// 화면이 좁아지면 글자도 같이 줄어 폰에서는 안 읽혔다.
// 문구를 이미지에서 떼어내 데이터로 갖는다 — banners.overlay (jsonb, V20260812001).
//
// ⚠ 이 파일은 web 과 admin 두 벌이다. 한쪽만 고치면 관리자 미리보기와 실제 화면이 갈린다.
//   같은 규칙을 쓰는 파일: finder.js · product-view.js
//
// 쓰는 곳
//   웹    site-banner.js 가 슬라이드마다 html() 을 불러 붙인다
//   어드민 banner-edit.js 가 입력할 때마다 같은 함수로 미리보기를 그린다
//
// 담기는 모양 (전부 선택 — 없으면 기본값)
//   { lines:[{ parts:[{text:'나는',size:44},{text:' 너를 좋아해',size:72,color:'#ffd400',weight:900}],
//              x:0, y:0 }, ...],
//            한 줄이 조각 여러 개다 — 조각마다 크기·색·굵기를 따로 준다
//     font:'pretendard', weight:800,
//     size:44, color:'#ffffff',      줄에 안 적으면 쓰는 기본값
//     align:'left', x:0, y:0,        align 이 큰 자리, x·y 가 px 미세조정
//     anim:'up', shade:false }
//
// ⚠ 옛 모양 두 가지를 같이 읽는다. 이미 저장된 배너가 깨지면 안 된다.
//     lines: ['첫 줄', ...]                       (오전)
//     lines: [{text:'첫 줄', size, color, x, y}]  (오후)
//   둘 다 조각 하나짜리 줄로 바꿔 읽는다.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── 글꼴 ────────────────────────────────────────────
  //
  // ⚠ 라이선스를 확인한 것만 담는다. 폰트를 서버에서 내려주는 것은 '재배포' 라
  //   허용 여부가 폰트마다 다르다. 확인 안 한 폰트를 목록에 올리면
  //   나중에 문제가 생겼을 때 그 폰트를 쓴 배너를 전부 찾아 고쳐야 한다.
  //
  // 늘리는 법
  //   1) 그 폰트의 라이선스에서 '웹폰트 임베딩' 과 '재배포' 가 허용되는지 본다
  //   2) 공식 CDN 이 있으면 css 주소를, 없으면 우리 서버에 올린 .woff2 주소를 적는다
  //   3) 아래 배열에 한 줄 넣는다. 어드민 드롭다운은 이 배열을 그대로 읽는다
  //
  // stack 에 대체 글꼴을 남기는 이유 — CDN 이 죽어도 글자는 보여야 한다.
  // ⚠ weights — 그 글꼴이 진짜로 가진 굵기다.
  //   한글 디스플레이 글꼴은 대부분 굵기가 하나뿐이다(400).
  //   목록에 없는 굵기를 고르면 브라우저가 억지로 굵게 그리거나(가짜 굵기)
  //   그냥 무시한다 — 관리자는 '굵기를 바꿨는데 안 바뀐다' 를 겪는다.
  //   그래서 어드민이 이 배열만 보여준다.
  //
  // ⚠ latin — 영문·숫자를 그 글꼴이 갖고 있는가.
  //   검은고딕은 한글과 숫자만 있고 알파벳이 없다. 'SKT 5G' 를 적으면
  //   알파벳만 대체 글꼴로 떨어져 한 줄 안에서 모양이 섞인다.
  var FONTS = [
    {
      key: 'system',
      name: '기본 (사이트 글꼴)',
      css: null,           // 이미 사이트가 싣고 있다. 더 받지 않는다
      stack: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
      weights: [400, 500, 600, 700, 800, 900],
      latin: true,
    },
    {
      key: 'pretendard',
      name: '프리텐다드 · 반듯한 고딕',
      // SIL 오픈 폰트 라이선스 — 글꼴 단독 판매만 금지, 상업 이용·재배포 허용
      css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
      stack: "'Pretendard', 'Noto Sans KR', sans-serif",
      weights: [400, 500, 600, 700, 800, 900],
      latin: true,
    },
    {
      key: 'noto',
      name: '노토 산스 · 기본 고딕',
      // SIL 오픈 폰트 라이선스. 사이트가 이미 싣고 있어 더 받지 않는다
      css: null,
      stack: "'Noto Sans KR', sans-serif",
      weights: [400, 500, 600, 700, 800, 900],
      latin: true,
    },
    // ── 아래는 구글 폰트. 전부 SIL 오픈 폰트 라이선스이고 공식 CDN 이 있다.
    //   사이트가 이미 구글 폰트를 쓰고 있어(Noto Sans KR) 새로 생기는 의존이 아니다.
    //   display=swap — 글꼴을 받는 동안 대체 글꼴로 먼저 보여준다.
    //   빼면 다 받을 때까지 글자가 아예 안 보인다.
    {
      key: 'blackhansans',
      name: '검은고딕 · 아주 굵은 제목 (영문 없음)',
      css: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap',
      stack: "'Black Han Sans', 'Noto Sans KR', sans-serif",
      weights: [400],
      latin: false,   // 한글·숫자·문장부호만 있다
    },
    {
      key: 'gasoek',
      name: '가석원 · 초굵은 임팩트',
      css: 'https://fonts.googleapis.com/css2?family=Gasoek+One&display=swap',
      stack: "'Gasoek One', 'Noto Sans KR', sans-serif",
      weights: [400],
      latin: true,
    },
    {
      key: 'dohyeon',
      name: '도현 · 굵고 친근한 고딕',
      css: 'https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap',
      stack: "'Do Hyeon', 'Noto Sans KR', sans-serif",
      weights: [400],
      latin: true,
    },
    {
      key: 'jua',
      name: '주아 · 둥글둥글 부드러운',
      css: 'https://fonts.googleapis.com/css2?family=Jua&display=swap',
      stack: "'Jua', 'Noto Sans KR', sans-serif",
      weights: [400],
      latin: true,
    },
    {
      key: 'notoserif',
      name: '노토 명조 · 차분하고 고급스러운',
      css: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&display=swap',
      stack: "'Noto Serif KR', serif",
      weights: [400, 600, 700, 900],
      latin: true,
    },
    {
      key: 'gugi',
      name: '구기 · 개성 있는 디스플레이',
      css: 'https://fonts.googleapis.com/css2?family=Gugi&display=swap',
      stack: "'Gugi', 'Noto Sans KR', sans-serif",
      weights: [400],
      latin: true,
    },
  ];

  var fontByKey = {};
  FONTS.forEach(function (f) { fontByKey[f.key] = f; });

  // 쓰는 배너가 있을 때만 받는다. 문구 없는 화면에서 글꼴을 미리 받으면
  // 아무도 안 보는 200KB 를 모든 방문자가 내려받는다.
  var loaded = {};
  function loadFont(key) {
    var f = fontByKey[key];
    if (!f || !f.css || loaded[key]) return;
    loaded[key] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = f.css;
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }

  // ── 값 다듬기 ───────────────────────────────────────
  //
  // 서버는 받은 대로 담는다(검증 안 함). 모르는 값이 와도 화면이 깨지면 안 되므로
  // 여기서 전부 아는 값으로 떨어뜨린다.
  // ⚠ 색은 사람이 적는 칸이라 그대로 style 에 넣으면 위험하다 —
  //   '#fff; background:url(...)' 같은 문자열이 규칙을 통째로 바꿔 버린다.
  //   #rgb / #rrggbb 모양만 통과시킨다.
  var ALIGN = { left: 1, center: 1, right: 1 };
  var ANIM = { up: 1, down: 1, none: 1 };
  var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  // 범위 밖이거나 숫자가 아니면 fb 로 떨어뜨린다
  function numIn(v, lo, hi, fb) {
    var n = Number(v);
    return isFinite(n) && n >= lo && n <= hi ? Math.round(n) : fb;
  }
  function hex(v, fb) {
    var c = String(v == null ? '' : v).trim();
    return HEX.test(c) ? c : fb;
  }

  // 줄 하나 = { text, size, color }.
  // size·color 는 null 이면 '기본값을 쓴다' 는 뜻이다 — 0 이나 '' 로 두면
  // '0px' · '색 없음' 과 구분이 안 된다.
  //
  // ⚠ 문자열 배열로 저장된 옛 배너를 같이 읽는다 (2026-08-12 오전에 그 모양으로 저장됐다).
  //
  // 줄 수는 관리자가 늘린다(2026-08-12).
  //
  // 처음에는 여섯에서 끊었다 — 기본 크기(44px)로 여섯 줄이면 배너 높이가 꽉 차서다.
  // 그런데 크기는 줄마다 다르게 줄 수 있다. 24px 짜리 줄만 쌓으면 열 줄도 들어간다.
  // '기본 크기로 꽉 차는 줄 수' 를 한도로 삼는 것은 관리자가 정할 일을 대신 정하는 것이다.
  //
  // 열에서 끊는 이유는 다르다 — 이보다 많으면 어드민 입력 화면이 스크롤 두 개를 넘어가
  // 무엇을 고치는 중인지 놓친다. 넘치는 글자는 잘리지 않고 접히므로 화면이 깨지지는 않는다.
  var MAX_LINES = 10;

  // 한 줄을 조각 몇 개까지 쪼갤 수 있나. 넷이면 '나는 / 너를 / 정말 / 좋아해' 다 —
  // 그보다 잘게 쪼개면 관리 화면이 감당이 안 되고, 읽는 사람도 강조를 못 알아본다.
  var MAX_PARTS = 4;

  // 조각 하나 = { text, size, color, weight }.
  // size·color·weight 가 null 이면 '줄 바깥 기본값을 쓴다' 는 뜻이다.
  //
  // ⚠ text 를 trim 하지 않는다. 조각 사이 공백이 글자의 일부다 —
  //   '나는' + ' 너를 좋아해' 에서 앞 공백을 지우면 '나는너를' 로 붙는다.
  function normPart(p, fontKey) {
    var q = p && typeof p === 'object' ? p : {};
    return {
      text: String(q.text == null ? '' : q.text),
      size: numIn(q.size, 12, 200, null),
      color: hex(q.color, null),
      weight: q.weight == null ? null : nearestWeight(fontKey, q.weight),
    };
  }

  function normLines(o, fontKey) {
    var raw = Array.isArray(o.lines) ? o.lines : [];
    return raw.slice(0, MAX_LINES).map(function (l) {
      // 1) 문자열 (오전에 저장된 모양)
      if (typeof l === 'string') {
        var t = l.trim();
        return { parts: t ? [normPart({ text: t }, fontKey)] : [], x: 0, y: 0 };
      }
      if (!l || typeof l !== 'object') return null;

      var x = numIn(l.x, -600, 600, 0);
      var y = numIn(l.y, -400, 400, 0);

      // 2) 조각으로 쪼갠 줄 (지금 모양)
      if (Array.isArray(l.parts)) {
        return {
          parts: l.parts.slice(0, MAX_PARTS)
            .map(function (p) { return normPart(p, fontKey); })
            .filter(function (p) { return p.text !== ''; }),
          x: x, y: y,
        };
      }

      // 3) 조각 없이 글자 하나뿐인 줄 (오후에 저장된 모양)
      var one = normPart(l, fontKey);
      one.text = one.text.trim();
      return { parts: one.text ? [one] : [], x: x, y: y };
    }).filter(function (l) { return l && l.parts.length; });
  }

  // 그 글꼴이 가진 굵기 중 가장 가까운 것.
  // 없는 굵기를 그대로 내보내면 브라우저가 가짜로 굵게 그려 글자가 뭉개진다.
  function nearestWeight(fontKey, want) {
    var f = fontByKey[fontKey] || fontByKey.system;
    var list = f.weights && f.weights.length ? f.weights : [400];
    var w = Number(want);
    if (!isFinite(w)) w = 800;
    return list.reduce(function (a, b) {
      return Math.abs(b - w) < Math.abs(a - w) ? b : a;
    });
  }

  function norm(ov) {
    var o = ov && typeof ov === 'object' ? ov : {};
    var font = fontByKey[o.font] ? o.font : 'system';

    return {
      // 조각의 굵기를 그 글꼴이 가진 값으로 떨어뜨려야 해서 글꼴을 넘긴다
      lines: normLines(o, font),
      font: font,
      // 44 는 배너 높이(360 안팎)에서 세 줄이 답답하지 않게 들어가는 크기다
      size: numIn(o.size, 12, 200, 44),
      weight: nearestWeight(font, o.weight),
      color: hex(o.color, '#ffffff'),
      align: ALIGN[o.align] ? o.align : 'left',
      anim: ANIM[o.anim] ? o.anim : 'up',
      // 자리 미세조정 (2026-08-12). align 이 큰 자리를 잡고 여기서 px 로 민다.
      // ⚠ 넓은 화면 기준 px 이다. 좁아지면 글자와 같은 비율(--bo-k)로 같이 줄어든다 —
      //   px 을 고정하면 폰에서 글자가 배너 밖으로 나간다.
      x: numIn(o.x, -600, 600, 0),
      y: numIn(o.y, -400, 400, 0),
      // 기본 꺼짐 (2026-08-12 바꿈). 켜 두니 어두운 배너에도 검은 띠가 겹쳐 보였다.
      // 글자 그림자(text-shadow)는 늘 있어서 웬만한 배경에서는 그대로 읽힌다.
      shade: o.shade === true,
    };
  }

  function has(ov) {
    return norm(ov).lines.length > 0;
  }

  // ── 그리기 ──────────────────────────────────────────
  //
  // 줄마다 delay 를 0.15초씩 밀어 순서대로 들어오게 한다.
  // 세 줄이 한꺼번에 튀어나오면 읽는 순서가 안 보인다.
  //
  // ⚠ pointer-events 를 꺼 둔다. 배너를 누르면 링크로 가야 하는데
  //   문구가 위에 덮여 있으면 글자 위를 눌렀을 때 아무 일도 안 일어난다.

  // 넓은 화면 기준 px 을 '화면에 맞게 줄어드는 px' 으로 바꾼다.
  // 관리자가 42px 라고 적으면 넓은 화면에서 42px, 폰에서는 그 46% 다.
  function k(px) {
    return 'calc(' + px + 'px * var(--bo-k,1))';
  }

  function html(ov) {
    var o = norm(ov);
    if (!o.lines.length) return '';
    loadFont(o.font);

    var f = fontByKey[o.font] || fontByKey.system;
    // 크기와 자리를 --bo-k 로 곱한다. 화면이 좁아지면 그 변수만 줄어들어
    // 글자도 자리도 같은 비율로 따라온다 (아래 미디어쿼리).
    var style =
      'font-family:' + f.stack + ';' +
      'font-weight:' + o.weight + ';' +
      'font-size:' + k(o.size) + ';' +
      'color:' + o.color + ';' +
      (o.x || o.y
        ? 'transform:translate(' + k(o.x) + ',' + k(o.y) + ');'
        : '');

    return '<div class="sb__ov sb__ov--' + o.align + ' sb__ov--' + o.anim +
      (o.shade ? ' is-shade' : '') + '" aria-hidden="true">' +
      '<div class="sb__ov-in" style="' + style + '">' +
      o.lines.map(function (l, i) {
        var st = 'transition-delay:' + (i * 0.15) + 's;';
        // 줄 하나만 미는 값.
        // ⚠ transform 을 안 쓴다 — 들어오는 움직임이 이미 transform 을 쓰고 있어서
        //   여기서 또 쓰면 둘 중 하나가 덮여 사라진다. margin 은 안 싸운다.
        //   그리고 margin-top 은 뜻도 맞다 — 위 줄과의 '여백' 그 자체다.
        if (l.x) st += 'margin-left:' + k(l.x) + ';';
        if (l.y) st += 'margin-top:' + k(l.y) + ';';

        // 조각마다 제 값이 있을 때만 감싼다. 없으면 글자만 그대로 이어 붙인다 —
        // 쓸데없는 span 이 줄줄이 생기면 나중에 화면을 들여다볼 때 읽기 어렵다.
        //
        // ⚠ 조각 사이에 줄바꿈이나 공백을 넣지 않는다. HTML 에서 그 사이 공백은
        //   진짜 공백으로 나가서 '나는' 과 '너를' 이 뜻하지 않게 벌어진다.
        var inner = l.parts.map(function (p) {
          var ps = '';
          if (p.size != null) ps += 'font-size:' + k(p.size) + ';';
          if (p.color) ps += 'color:' + p.color + ';';
          if (p.weight != null) ps += 'font-weight:' + p.weight + ';';
          return ps ? '<span style="' + ps + '">' + esc(p.text) + '</span>' : esc(p.text);
        }).join('');

        return '<span class="sb__ov-line" style="' + st + '">' + inner + '</span>';
      }).join('') +
      '</div></div>';
    // aria-hidden 인 이유 — 이 글자는 배너 이미지의 일부다.
    // 읽어 줘야 할 내용은 img 의 alt(altText)가 이미 갖고 있다. 두 번 읽히면 시끄럽다.
  }

  // 미리보기용 한 줄 요약 (어드민 목록에서 쓴다)
  function summary(ov) {
    var o = norm(ov);
    if (!o.lines.length) return '';
    return o.lines.map(function (l) {
      return l.parts.map(function (p) { return p.text; }).join('');
    }).join(' / ');
  }

  var styled = false;
  function injectStyles() {
    if (styled) return;
    styled = true;
    var css = [
      // 슬라이드 위에 겹친다. 슬라이드가 position:relative 여야 자리가 잡힌다 —
      // site-banner.css 의 .sb__slide 에 그 규칙이 같이 들어간다.
      // --bo-k : 넓은 화면 1, 좁아지면 줄어든다. 글자 크기와 자리 이동이 이 값을 곱한다.
      //   전에는 .sb__ov-in 에 font-size:.62em 을 걸어 줄였는데,
      //   줄마다 크기를 따로 주기 시작하면서 그 방식으로는 안 된다 —
      //   줄이 px 을 직접 가지면 부모의 em 이 안 먹는다.
      // ⚠ 좌우 여백에 vw 를 그대로 쓰지 않고 변수로 뺀다.
      //   vw 는 '보고 있는 창' 기준이라, 어드민 미리보기(축소판)에서는
      //   배너 폭이 아니라 어드민 창 폭을 따라가 실제와 여백이 달라진다.
      //   어드민은 --bo-pad 에 그 폭에서의 진짜 값을 넣어 준다.
      '.sb__ov{--bo-k:1;position:absolute;inset:0;display:flex;flex-direction:column;' +
        'justify-content:center;padding:0 var(--bo-pad,clamp(20px,5vw,72px));' +
        'pointer-events:none;z-index:2;}',
      '.sb__ov--left{align-items:flex-start;text-align:left;}',
      '.sb__ov--center{align-items:center;text-align:center;}',
      '.sb__ov--right{align-items:flex-end;text-align:right;}',
      // 글자 뒤 어두운 그라데이션. 밝은 배너에 흰 글자를 얹으면 그냥 안 보인다.
      // 정렬에 따라 어두워지는 쪽이 달라야 한다 — 오른쪽 정렬인데 왼쪽이 어두우면 소용없다.
      '.sb__ov.is-shade::before{content:"";position:absolute;inset:0;z-index:-1;' +
        'background:linear-gradient(90deg,rgba(10,8,24,.62) 0%,rgba(10,8,24,.28) 45%,transparent 72%);}',
      '.sb__ov--center.is-shade::before{background:linear-gradient(180deg,' +
        'rgba(10,8,24,.15) 0%,rgba(10,8,24,.55) 50%,rgba(10,8,24,.15) 100%);}',
      '.sb__ov--right.is-shade::before{background:linear-gradient(270deg,' +
        'rgba(10,8,24,.62) 0%,rgba(10,8,24,.28) 45%,transparent 72%);}',
      // ⚠ min-width:0 과 word-break — 긴 낱말 하나가 배너보다 길면 밖으로 삐져나간다.
      //   바깥은 overflow:hidden 이라 삐져나간 만큼 그냥 잘려서, 관리자는
      //   '글자가 사라졌다' 로 본다. 넘치면 자르지 말고 접는다.
      '.sb__ov-in{position:relative;display:flex;flex-direction:column;gap:.28em;' +
        'line-height:1.24;letter-spacing:-.02em;max-width:min(620px,62%);min-width:0;' +
        'word-break:keep-all;overflow-wrap:anywhere;' +
        'text-shadow:0 2px 18px rgba(0,0,0,.35);}',
      '.sb__ov--center .sb__ov-in{max-width:min(760px,86%);}',

      // ── 움직임 ──
      // 처음에는 숨어 있고, 슬라이드에 is-on 이 붙으면 제자리로 온다.
      // 나갈 때는 delay 없이 한꺼번에 사라진다 — 나가는 것까지 순서대로면 굼떠 보인다.
      '.sb__ov-line{display:block;opacity:0;' +
        'transition:opacity .62s cubic-bezier(.22,1,.36,1),transform .62s cubic-bezier(.22,1,.36,1);}',
      '.sb__ov--up .sb__ov-line{transform:translateY(34px);}',
      '.sb__ov--down .sb__ov-line{transform:translateY(-34px);}',
      '.sb__ov--none .sb__ov-line{transform:none;}',
      '.sb__slide.is-on .sb__ov-line{opacity:1;transform:none;}',
      // 안 켜진 슬라이드는 delay 를 지운다. 안 그러면 캐러셀이 넘어갈 때
      // 이전 슬라이드 글자가 0.3초 뒤에야 사라져 두 장이 겹쳐 보인다.
      '.sb__slide:not(.is-on) .sb__ov-line{transition-delay:0s !important;}',

      // 움직임을 불편해하는 사람에게는 안 움직인다. 운영체제 설정을 그대로 따른다.
      '@media(prefers-reduced-motion:reduce){',
      '.sb__ov-line{transition:none;opacity:1;transform:none;}',
      '}',

      // ── 좁은 화면 ──
      // 글자 크기를 화면 폭에 따라 줄인다. 관리자가 넣은 46px 를 폰에서 그대로 쓰면
      // 한 줄에 네 글자만 들어가 배너 밖으로 넘친다.
      '@media(max-width:900px){',
      '.sb__ov{--bo-k:.62;padding:0 var(--bo-pad,clamp(16px,4.5vw,32px));}',
      '.sb__ov-in{max-width:78%;gap:.24em;}',
      '.sb__ov--center .sb__ov-in{max-width:92%;}',
      '}',
      '@media(max-width:480px){',
      '.sb__ov{--bo-k:.46;}',
      // 폰은 배너가 낮고 좁다. 글자가 옆으로 붙는 자리가 없어 폭을 거의 다 준다.
      '.sb__ov-in{max-width:94%;}',
      '.sb__ov--center .sb__ov-in{max-width:96%;}',
      // 줄 사이도 좁힌다 — 폰 배너 높이에 여섯 줄이 들어가려면 여기서 줄여야 한다
      '.sb__ov-in{gap:.18em;line-height:1.2;}',
      // 폰에서는 배너가 낮아 그라데이션이 좁다. 전체를 조금 더 어둡게 깐다.
      '.sb__ov.is-shade::before{background:linear-gradient(90deg,' +
        'rgba(10,8,24,.68) 0%,rgba(10,8,24,.42) 60%,rgba(10,8,24,.18) 100%);}',
      '}',
    ].join('');
    var tag = document.createElement('style');
    tag.setAttribute('data-dp', 'banner-overlay');
    tag.appendChild(document.createTextNode(css));
    document.head.appendChild(tag);
  }

  window.DapickBannerOverlay = {
    FONTS: FONTS,
    MAX_LINES: MAX_LINES,
    MAX_PARTS: MAX_PARTS,
    fonts: function () { return FONTS.slice(); },
    fontOf: function (key) { return fontByKey[key] || fontByKey.system; },
    nearestWeight: nearestWeight,
    norm: norm,
    has: has,
    html: html,
    summary: summary,
    loadFont: loadFont,
    injectStyles: injectStyles,
  };
})();
