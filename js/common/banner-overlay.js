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
//     anim:'up', shade:false,
//     footAlign:'right', footSize:14,    줄에 slot:'foot' 을 주면 하단 주석으로 간다
//     moH:0, pcH:0 }                     배너 높이(px). 문구가 있을 때만 쓴다.
//                                        둘 다 0 이면 '이미지 원본 비율 그대로'
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
      // 형광 — 글자 둘레에 색이 번진다 (2026-08-12).
      //   glow      번지는 색. 없으면 형광 없음
      //   glowBlur  얼마나 넓게 번지나 (px). 넓은 화면 기준이라 --bo-k 가 같이 줄인다
      glow: hex(q.glow, null),
      glowBlur: numIn(q.glowBlur, 0, 120, 18),
    };
  }

  function normLines(o, fontKey) {
    var raw = Array.isArray(o.lines) ? o.lines : [];
    return raw.slice(0, MAX_LINES).map(function (l) {
      // 1) 문자열 (오전에 저장된 모양)
      if (typeof l === 'string') {
        var t = l.trim();
        return { parts: t ? [normPart({ text: t }, fontKey)] : [], x: 0, y: 0, slot: 'main' };
      }
      if (!l || typeof l !== 'object') return null;

      var x = numIn(l.x, -600, 600, 0);
      var y = numIn(l.y, -400, 400, 0);
      // 이 줄이 어디로 가는가 (2026-08-12).
      //   main — 가운데 쌓이는 본문
      //   foot — 배너 아래쪽에 작게 붙는 주석 ('※ 상품 및 계약 조건에 따라 …')
      // 배너는 세로가 좁아 본문에 주석까지 쌓으면 넘친다. 주석은 자리가 다르다.
      var slot = l.slot === 'foot' ? 'foot' : 'main';

      // 2) 조각으로 쪼갠 줄 (지금 모양)
      if (Array.isArray(l.parts)) {
        return {
          parts: l.parts.slice(0, MAX_PARTS)
            .map(function (p) { return normPart(p, fontKey); })
            .filter(function (p) { return p.text !== ''; }),
          x: x, y: y, slot: slot,
        };
      }

      // 3) 조각 없이 글자 하나뿐인 줄 (오후에 저장된 모양)
      var one = normPart(l, fontKey);
      one.text = one.text.trim();
      return { parts: one.text ? [one] : [], x: x, y: y, slot: slot };
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
      // 하단 주석 덩어리. 본문과 자리가 달라 정렬·크기를 따로 갖는다.
      // 14px 인 이유 — 주석은 눈에 안 띄어야 한다. 본문 기본(44px)을 물려주면
      //   주석이 본문만큼 커져 무엇이 제목인지 안 보인다.
      footAlign: ALIGN[o.footAlign] ? o.footAlign : 'right',
      footSize: numIn(o.footSize, 8, 60, 14),
      // ★ 2026-08-14 — moH(폰에서 배너 높이)는 더 이상 화면에 쓰지 않는다.
      //
      //   이 값의 원래 뜻은 '폰에서 배너를 이 높이로 만들고 이미지를 잘라 채워라' 였다.
      //   문구가 넘치는 것을 막으려고 넣었는데, 대신 이미지 좌우가 크게 잘렸다.
      //   지금은 폰·태블릿에서 배너가 문구만큼 알아서 늘어난다(injectStyles 의 grid).
      //   자를 이유도, 관리자가 정할 이유도 없어졌다.
      //
      // ⚠ 칸을 지우지는 않는다. 이미 저장된 배너에 값이 들어 있고,
      //   지우면 저장할 때마다 그 값이 사라졌다 살아났다 한다. 읽되 안 쓴다.
      moH: numIn(o.moH, 0, 600, 0),
      // PC 에서 배너 높이 (2026-08-12). 0 은 '이미지 원본 비율 그대로' 다.
      //
      // 왜 필요한가: 문구 상자는 이미지 전체에 겹쳐 세로 가운데에 놓인다(inset:0).
      //   그래서 이미지 세로가 다르면 같은 값을 넣어도 글자 자리가 달라 보인다.
      //   1600x420 배너는 글자가 위에서 210px, 1600x560 배너는 280px 지점이다.
      //   실제로 '같은 값인데 배치가 다르다' 는 말이 나왔다.
      //
      // 곁들여 고쳐지는 것: 캐러셀이 넘어갈 때 배너마다 높이가 다르면
      //   아래 내용이 위아래로 튄다. 높이를 맞추면 그것도 없어진다.
      //
      // ⚠ 기본이 0(강제 안 함)인 이유 — 이미 올려 둔 배너의 모양을 말없이 바꾸면 안 된다.
      //   관리자가 값을 정한 배너만 잘라 맞춘다.
      pcH: numIn(o.pcH, 0, 900, 0),
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

    var main = [];
    var foot = [];
    o.lines.forEach(function (l) { (l.slot === 'foot' ? foot : main).push(l); });

    // 주석은 본문 뒤에 이어서 들어온다. 같이 튀어나오면 눈이 어디를 봐야 할지 모른다.
    // 0.15 를 그냥 곱하면 3번째 줄에서 0.44999999999999996 이 나온다.
    // 화면은 같지만 값이 지저분하고 검사도 못 잡는다.
    var delayOf = function (i) { return (Math.round(i * 15) / 100) + 's'; };

    var lineHtml = function (l, i) {
        var st = 'transition-delay:' + delayOf(i) + ';';
        // 줄 하나만 미는 값.
        //
        // ★ 2026-08-13 — margin 에서 position:relative 로 바꿨다.
        //   margin-top 은 그 줄을 밀면서 '아래 줄까지 전부' 같이 내린다 (세로로 쌓인 상자라
        //   위 줄이 차지하는 자리가 늘어나면 나머지가 밀린다). 관리자가 2번 줄만 내리려고
        //   값을 넣었는데 3·4번 줄까지 따라 내려가서 "전체가 밀린다" 는 말이 나왔다.
        //   relative 의 top·left 는 자리를 차지한 채 겉모습만 옮긴다 — 다른 줄이 안 움직인다.
        //
        // ⚠ transform 은 여전히 못 쓴다 — 들어오는 움직임(translateY)이 이미 쓰고 있어서
        //   여기서 또 쓰면 둘 중 하나가 덮여 사라진다. top·left 는 그것과 안 싸운다.
        //
        // ★ 2026-08-14 — 하단 주석 줄은 bottom 으로 민다. top 이면 배너 밖으로 나간다.
        //   본문 상자(.sb__ov)는 배너 전체에 겹쳐 있어서 위에서부터 자리를 잡는다.
        //   하지만 주석 상자(.sb__ovfoot)는 bottom:0 으로 배너 '바닥' 에 붙어 있다.
        //   바닥에 붙은 줄을 top 으로 200px 내리면 배너 아래로 200px 나가고,
        //   배너는 overflow:hidden 이라 통째로 잘려 사라진다.
        //   실제로 운영 배너의 주석 두 줄이 이렇게 사라져 있었다 (y:200 저장됨).
        //
        //   그래서 주석에서는 y 가 '바닥에서 얼마나 띄울까' 다. 양수면 위로 올라온다.
        //   상자가 바닥 기준이니 그쪽이 뜻도 맞는다 — 아래로 더 내릴 자리는 애초에 없다.
        var up = l.slot === 'foot';
        if (l.x || l.y) st += 'position:relative;';
        if (l.x) st += 'left:' + k(l.x) + ';';
        if (l.y) st += (up ? 'bottom:' : 'top:') + k(l.y) + ';';

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
          // 형광. 두 겹으로 깐다 — 한 겹이면 옅어서 형광으로 안 보이고,
          // 세 겹부터는 글자 획이 뭉개진다.
          // ⚠ 마지막에 검은 그림자를 다시 얹는다. text-shadow 는 통째로 덮어쓰는 값이라
          //   빼면 .sb__ov-in 의 그림자가 이 조각에서만 사라져 밝은 배경에서 안 읽힌다.
          if (p.glow) {
            var b = k(p.glowBlur);
            var b2 = k(Math.round(p.glowBlur * 2));
            ps += 'text-shadow:0 0 ' + b + ' ' + p.glow + ',0 0 ' + b2 + ' ' + p.glow +
              ',0 2px 18px rgba(0,0,0,.35);';
          }
          return ps ? '<span style="' + ps + '">' + esc(p.text) + '</span>' : esc(p.text);
        }).join('');

        return '<span class="sb__ov-line" style="' + st + '">' + inner + '</span>';
    };

    var out = '';
    if (main.length) {
      out += '<div class="sb__ov sb__ov--' + o.align + ' sb__ov--' + o.anim +
        (o.shade ? ' is-shade' : '') + '" aria-hidden="true">' +
        '<div class="sb__ov-in" style="' + style + '">' +
        main.map(lineHtml).join('') +
        '</div></div>';
    }
    if (foot.length) {
      // 주석은 글꼴만 본문과 같이 가고 크기·색은 제 값을 쓴다.
      // ⚠ 굵기도 물려받지 않는다 — 본문이 900 이면 주석까지 900 이 되어 안 눌린다.
      var fs = 'font-family:' + f.stack + ';font-size:' + k(o.footSize) + ';' +
        'color:' + o.color + ';font-weight:400;';
      out += '<div class="sb__ovfoot sb__ovfoot--' + o.footAlign + ' sb__ov--' + o.anim +
        '" aria-hidden="true"><div class="sb__ov-in" style="' + fs + '">' +
        foot.map(function (l, i) { return lineHtml(l, main.length + i); }).join('') +
        '</div></div>';
    }
    return out;
    // aria-hidden 인 이유 — 이 글자는 배너 이미지의 일부다.
    // 읽어 줘야 할 내용은 img 의 alt(altText)가 이미 갖고 있다. 두 번 읽히면 시끄럽다.
  }

  // 문구가 있는 슬라이드에 붙일 클래스와 변수.
  //   is-ov      — 폰에서 세로를 늘리는 규칙이 이 클래스에만 걸린다
  //   --sb-mo-h  — 그 높이
  // ⚠ 슬라이드는 site-banner.js 가 만든다. 여기서 직접 못 붙여 값만 넘긴다.
  function slideMod(ov) {
    var o = norm(ov);
    if (!o.lines.length) return { cls: '', style: '' };
    // ⚠ pcH 가 0 이면 클래스를 안 붙인다.
    //   aspect-ratio:calc(1600 / 0) 은 무한대라 배너가 통째로 깨진다.
    //   '값이 있을 때만 켜는 클래스' 로 막는다.
    //
    // ⚠ moH 는 2026-08-14 부터 안 내보낸다. 폰·태블릿은 자르지 않고 늘리는 방식으로
    //   바뀌었다 — 클래스를 남겨 두면 옛 CSS 가 어디선가 살아 있을 때 다시 잘린다.
    return {
      cls: ' is-ov' + (o.pcH ? ' has-pch' : ''),
      style: o.pcH ? '--sb-pc-h:' + o.pcH + ';' : '',
    };
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
      // 하단 주석 (2026-08-12). 배너 세로가 좁아 본문에 주석까지 쌓으면 넘친다.
      //   ⚠ --bo-k · --bo-pad 를 본문과 똑같이 정의해야 한다. 안 하면 폰에서
      //     본문만 줄고 주석은 PC 크기로 남는다.
      '.sb__ovfoot{--bo-k:1;position:absolute;left:0;right:0;bottom:0;' +
        'display:flex;flex-direction:column;pointer-events:none;z-index:2;' +
        'padding:0 var(--bo-pad,clamp(20px,5vw,72px)) calc(18px * var(--bo-k,1));}',
      '.sb__ovfoot--left{align-items:flex-start;text-align:left;}',
      '.sb__ovfoot--center{align-items:center;text-align:center;}',
      '.sb__ovfoot--right{align-items:flex-end;text-align:right;}',
      '.sb__ovfoot .sb__ov-in{max-width:min(560px,72%);gap:.18em;line-height:1.45;' +
        'text-shadow:0 1px 10px rgba(0,0,0,.45);}',
      // PC 는 관리자가 높이를 정한 배너만 잘라 맞춘다 (2026-08-12).
      //   1600 은 배너 실폭이다. 화면이 좁아지면 폭이 줄고 높이도 비율대로 같이 준다.
      //   PC 는 배너가 커서 잘려도 덜 아쉽고, 배너끼리 높이를 맞추려면 이 방법뿐이다.
      '@media(min-width:901px){',
      '.sb__slide.is-ov.has-pch img{aspect-ratio:calc(1600 / var(--sb-pc-h,420));' +
        'height:auto;object-fit:cover;object-position:center;}',
      '}',

      // ── 폰·태블릿: 자르지 않고 늘린다 (2026-08-14) ─────────────────
      //
      // 여기서 두 번 헛발을 짚었다. 기록해 둔다.
      //   08-12 — 폰에서 문구 셋째 줄이 배너 밖으로 밀렸다.
      //           → 배너 높이를 250 으로 강제하고 이미지를 잘라 채웠다(cover).
      //   08-13 — 그랬더니 이미지 좌우가 크게 잘렸다. 1600x360(4.4:1) 배너를
      //           390x250(1.56:1) 로 만드니 좌우가 날아간다. 실제로 '최대지원금 150만원' 에서
      //           앞 글자가 사라진 채로 나갔다.
      //           → 자르기를 '관리자가 높이를 정한 배너' 로만 좁혔다.
      //           그런데 이미 저장된 배너에는 250 이 들어 있어 아무것도 안 풀렸다.
      //
      // 둘 다 '자를까 넘칠까' 안에서만 골랐던 것이 문제다. 셋째 길이 있다 —
      // **배너를 늘린다.**
      //
      // 이미지와 문구를 같은 grid 칸에 겹치면 칸 높이가 둘 중 큰 쪽이 된다.
      //   문구가 이미지보다 작으면  → 지금까지와 똑같다 (이미지 원본 비율, 글자는 그 위 가운데)
      //   문구가 이미지보다 크면    → 배너가 문구만큼 늘어나고 남는 자리는 아래 배경색
      // 이미지는 어느 쪽이든 원본 비율 그대로다. 한 픽셀도 안 잘린다.
      //
      // ⚠ moH(폰에서 배너 높이)는 이제 안 쓴다. 이미 저장된 값이 있어도 무시된다 —
      //   관리자가 배너를 하나하나 열어 값을 내리게 만들면 안 된다. 코드가 알아서 한다.
      //
      // ⚠ align-self:start — 이미지를 칸 위쪽에 붙인다. 안 주면 stretch 라
      //   늘어난 칸 높이에 맞춰 이미지가 세로로 찌그러진다.
      '@media(max-width:900px){',
      '.sb__slide.is-ov{display:grid;background:#141020;}',
      '.sb__slide.is-ov>.sb__link,.sb__slide.is-ov>img{grid-area:1/1;align-self:start;}',
      // 문구가 칸 높이를 정하려면 흐름에 들어와야 한다 (absolute 는 높이에 안 잡힌다).
      '.sb__slide.is-ov>.sb__ov{grid-area:1/1;position:relative;inset:auto;' +
        'padding-top:calc(16px * var(--bo-k,1));padding-bottom:calc(16px * var(--bo-k,1));}',
      // 하단 주석은 그대로 배너 바닥에 붙는다(absolute). 늘어난 배너의 바닥을 따라간다.
      '}',
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
      '.sb__ovfoot{--bo-k:.62;padding-left:var(--bo-pad,clamp(16px,4.5vw,32px));' +
        'padding-right:var(--bo-pad,clamp(16px,4.5vw,32px));}',
      '.sb__ovfoot .sb__ov-in{max-width:86%;}',
      '.sb__ov{--bo-k:.62;padding:0 var(--bo-pad,clamp(16px,4.5vw,32px));}',
      '.sb__ov-in{max-width:78%;gap:.24em;}',
      '.sb__ov--center .sb__ov-in{max-width:92%;}',
      '}',
      '@media(max-width:480px){',
      '.sb__ovfoot{--bo-k:.46;}',
      '.sb__ovfoot .sb__ov-in{max-width:94%;}',
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
    slideMod: slideMod,
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
