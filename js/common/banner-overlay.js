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
//   { lines:['첫 줄','둘째 줄','셋째 줄'], font:'pretendard', weight:800,
//     size:46, color:'#ffffff', align:'left', anim:'up', shade:true }
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
  var FONTS = [
    {
      key: 'system',
      name: '기본 (사이트 글꼴)',
      css: null,           // 이미 사이트가 싣고 있다. 더 받지 않는다
      stack: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    {
      key: 'pretendard',
      name: '프리텐다드',
      // SIL 오픈 폰트 라이선스 — 글꼴 단독 판매만 금지, 상업 이용·재배포 허용
      css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
      stack: "'Pretendard', 'Noto Sans KR', sans-serif",
    },
    {
      key: 'noto',
      name: '노토 산스',
      // SIL 오픈 폰트 라이선스. 사이트가 이미 싣고 있어 더 받지 않는다
      css: null,
      stack: "'Noto Sans KR', sans-serif",
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

  function norm(ov) {
    var o = ov && typeof ov === 'object' ? ov : {};
    var lines = Array.isArray(o.lines) ? o.lines : [];
    var size = Number(o.size);
    var weight = Number(o.weight);
    var color = String(o.color == null ? '' : o.color).trim();

    return {
      lines: lines.slice(0, 3).map(function (s) {
        return String(s == null ? '' : s).trim();
      }).filter(function (s) { return s !== ''; }),
      font: fontByKey[o.font] ? o.font : 'system',
      // 44 는 배너 높이(360 안팎)에서 세 줄이 답답하지 않게 들어가는 크기다
      size: isFinite(size) && size >= 12 && size <= 120 ? Math.round(size) : 44,
      weight: isFinite(weight) && weight >= 100 && weight <= 900 ? Math.round(weight / 100) * 100 : 800,
      color: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : '#ffffff',
      align: ALIGN[o.align] ? o.align : 'left',
      anim: ANIM[o.anim] ? o.anim : 'up',
      // 기본 켜짐. 밝은 배너에 흰 글자를 얹으면 안 보이는데,
      // 관리자는 어두운 배너로 만들어 보고 켜는 것을 잊는다.
      shade: o.shade !== false,
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
  function html(ov) {
    var o = norm(ov);
    if (!o.lines.length) return '';
    loadFont(o.font);

    var f = fontByKey[o.font] || fontByKey.system;
    var style =
      'font-family:' + f.stack + ';' +
      'font-weight:' + o.weight + ';' +
      'font-size:' + o.size + 'px;' +
      'color:' + o.color + ';';

    return '<div class="sb__ov sb__ov--' + o.align + ' sb__ov--' + o.anim +
      (o.shade ? ' is-shade' : '') + '" aria-hidden="true">' +
      '<div class="sb__ov-in" style="' + style + '">' +
      o.lines.map(function (t, i) {
        return '<span class="sb__ov-line" style="transition-delay:' + (i * 0.15) + 's">' +
          esc(t) + '</span>';
      }).join('') +
      '</div></div>';
    // aria-hidden 인 이유 — 이 글자는 배너 이미지의 일부다.
    // 읽어 줘야 할 내용은 img 의 alt(altText)가 이미 갖고 있다. 두 번 읽히면 시끄럽다.
  }

  // 미리보기용 한 줄 요약 (어드민 목록에서 쓴다)
  function summary(ov) {
    var o = norm(ov);
    if (!o.lines.length) return '';
    return o.lines.join(' / ');
  }

  var styled = false;
  function injectStyles() {
    if (styled) return;
    styled = true;
    var css = [
      // 슬라이드 위에 겹친다. 슬라이드가 position:relative 여야 자리가 잡힌다 —
      // site-banner.css 의 .sb__slide 에 그 규칙이 같이 들어간다.
      '.sb__ov{position:absolute;inset:0;display:flex;flex-direction:column;' +
        'justify-content:center;padding:0 clamp(20px,5vw,72px);pointer-events:none;z-index:2;}',
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
      '.sb__ov-in{position:relative;display:flex;flex-direction:column;gap:.28em;' +
        'line-height:1.24;letter-spacing:-.02em;max-width:min(620px,62%);' +
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
      '.sb__ov{padding:0 clamp(16px,4.5vw,32px);}',
      '.sb__ov-in{font-size:.62em !important;max-width:78%;gap:.24em;}',
      '.sb__ov--center .sb__ov-in{max-width:92%;}',
      '}',
      '@media(max-width:480px){',
      '.sb__ov-in{font-size:.46em !important;max-width:86%;}',
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
    fonts: function () { return FONTS.slice(); },
    norm: norm,
    has: has,
    html: html,
    summary: summary,
    loadFont: loadFont,
    injectStyles: injectStyles,
  };
})();
