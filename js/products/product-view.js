// ════════════════════════════════════════════════════════════════
// product-view.js — 상품 상세 화면을 그리는 공용 모듈 (2026-08-01)
//
// ⚠ 이 파일은 dapick-web 과 dapick-admin 양쪽에 같은 내용으로 둔다.
//   web  : dapick-web/js/products/product-view.js
//   admin: dapick-admin/js/products/product-view.js
//   한쪽만 고치면 "관리자 미리보기와 실제 화면이 다르다" 는 문제가 다시 생긴다.
//
// 왜 공용으로 만드는가:
//   관리자가 상품을 등록할 때 "내가 지금 만드는 게 결국 어떤 화면이 되는가" 를 알아야 한다.
//   미리보기를 따로 그리면 언젠가 실물과 어긋나고, 관리자는 그걸 확인할 방법이 없다.
//   그래서 웹 상세와 어드민 미리보기가 '같은 함수'로 같은 HTML 을 만든다.
//
// 쓰는 법:
//   DapickProductView.injectStyles()                                   → CSS 1회 주입
//   el.innerHTML = DapickProductView.render(product, fields, opts)     → HTML 문자열
//   DapickProductView.bind(el)                                         → 클릭 동작 연결 (그린 뒤 1회)
//
//   opts.showMissing  : true 면 빈 칸에 "미입력" 을 보여준다. 관리자 미리보기용.
//                       실제 웹 화면은 false — 고객에게 빈 칸을 보여줄 이유가 없다.
//   opts.narrow       : 좁은 칸에 그릴 때 켠다(어드민 미리보기). 2열을 1열로 접고 글자를 줄인다.
//                       화면 폭이 아니라 '그려지는 칸' 이 좁은 경우라서 미디어쿼리로는 안 된다 -
//                       미디어쿼리는 브라우저 창 크기를 보지 미리보기 칸 크기를 보지 않는다.
//   opts.actionsHtml  : 요금 상자 아래에 끼워 넣을 버튼 HTML. 넣지 않으면 자리가 안 생긴다.
//                       웹은 진짜 신청 버튼을, 어드민 미리보기는 눌리지 않는 흉내 버튼을 넣는다.
//                       버튼을 이 모듈이 직접 만들지 않는 이유 - 웹과 어드민이 눌렀을 때
//                       할 일이 완전히 다르다. 모양만 같으면 되고 동작은 부르는 쪽이 정한다.
//
// product 모양 = 서버 ProductResponse 와 동일하게 맞춘다.
//   { name, modelName, description, imageUrl, galleryImages,
//     monthlyFee, contractMonths, brandName, brandLogoUrl,
//     specs:  { 자유칸key: 값 },
//     options:{ rentalPlans:[{months,monthlyFee}], cardDiscount:숫자,
//               partnerCards:[...], panelNotes:[{label,value}],
//               summary:[{type,label,value,choices}],   type: text | select | image (없으면 text)
//               choiceRows:[{label,choices,value}] } }  고객이 고르는 칸만 한 벌 더
//   ⚠ options 안의 이름은 어드민 저장 코드(product-edit.js 의 peSubmit)가 정한 것이다.
//     여기서 다른 이름으로 읽으면 관리자가 넣은 값이 화면에서 조용히 사라진다.
//
// fields = 카테고리에 정의된 입력 칸 목록.
//   [{ key, label, type, unit, base, showOnCard, showInPanel, showOnSpec }]
//   여기 없는 specs key 는 key 를 그대로 이름으로 써서 보여준다 - 감추면 값이 사라진 것처럼 보인다.
//
//   ⚠ 비어 있으면 아래 DEFAULT_FIELDS 로 떨어진다 (2026-08-12).
//     입력 양식을 안 붙인 카테고리는 이 목록이 비어서 요약표가 통째로 안 나왔다.
//     어드민 미리보기는 자기 기본 칸(PE_DEFAULT_SCHEMA)이 있어서 잘 나왔고,
//     웹만 비어 있어 '관리자 화면엔 보이는데 실제 화면엔 없다' 가 됐다.
// ════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // ── 입력 양식이 없는 카테고리에서 쓰는 기본 칸 (2026-08-12) ──
  //
  // 왜 필요한가: 카테고리에 입력 양식을 안 붙이면 웹이 받는 칸 목록이 빈 배열이다.
  //   그러면 요약표가 통째로 안 나온다 — 제목·모델명·렌탈사·월 렌탈료를 다 적었는데도.
  //   어드민 미리보기는 자기 기본 칸(product-edit.js 의 PE_DEFAULT_SCHEMA)이 있어서
  //   잘 나왔고, 웹만 비어 있어 '관리자 화면엔 보이는데 실제 화면엔 없다' 가 됐다.
  //
  // ⚠ 어드민 product-edit.js 의 PE_DEFAULT_SCHEMA 와 key·label·type 이 같아야 한다.
  //   한쪽만 고치면 관리자가 본 미리보기와 고객 화면이 다시 갈린다.
  //   그쪽은 '입력 칸을 그리는 목록' 이고 이쪽은 '화면을 그리는 목록' 이라 파일이 갈렸다.
  var DEFAULT_FIELDS = [
    { key: 'imageUrl', label: '대표 이미지', type: 'image', base: true },
    // ⚠ 제목은 요약표에 안 넣는다. 화면 맨 위에 크게 이미 있다 —
    //   표에 또 넣으면 같은 글자가 두 번 나온다.
    //   입력 칸으로는 필요하므로 목록에는 남기고 표시만 끈다.
    { key: 'name', label: '제목(상품명)', type: 'text', base: true, showOnSpec: false },
    { key: 'modelName', label: '모델명', type: 'text', base: true },
    { key: 'brandId', label: '렌탈사', type: 'brand', base: true },
    { key: 'rentalPlans', label: '렌탈기간', type: 'plans', base: true },
    { key: 'monthlyFee', label: '월 렌탈료', type: 'number', base: true },
    { key: 'cardDiscount', label: '카드할인시 금액', type: 'number', base: true },
    { key: 'partnerCards', label: '제휴카드', type: 'cards', base: true },
    { key: 'galleryImages', label: '상세 이미지', type: 'images', base: true },
    { key: 'description', label: '설명', type: 'textarea', base: true },
  ];

  // ── 뱃지 종류 ──────────────────────────────────────────────
  // ⚠ 어드민 상품 등록 화면의 선택지도 이 목록을 쓴다. 여기만 고치면 양쪽에 반영된다.
  //   색을 관리자가 자유롭게 고르게 하지 않는 이유: 상품마다 색이 제각각이면 목록이 지저분해진다.
  var BADGES = [
    { key: 'fast_install',   label: '빠른설치',      color: '#2563eb' },
    { key: 'special_promo',  label: '특가 프로모션',  color: '#d0342c' },
    { key: 'install_3days',  label: '3일이내 설치',   color: '#17803d' },
    { key: 'direct',         label: '다이렉트',      color: '#6c3fc5' },
    { key: 'best',           label: 'BEST',         color: '#d0342c' },
    { key: 'new',            label: '신상품',        color: '#0f766e' },
    { key: 'lowest_price',   label: '최저가',        color: '#b45309' },
    { key: 'free_install',   label: '설치비 무료',    color: '#2563eb' },
    { key: 'gift',           label: '사은품 증정',    color: '#be185d' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function won(v) {
    if (v == null || v === '') return '';
    return Number(v).toLocaleString() + '원';
  }

  // ── 이미지 주소 보정 (2026-08-26) ─────────────────────────
  //
  // 왜: 업로드한 파일이 DB 에 '/uploads/common/xxx.png' 처럼 상대 주소로 들어 있다.
  //   그 주소는 '지금 보고 있는 사이트' 기준이라, 어드민에서는 admin.dapick.co.kr/uploads/…,
  //   고객 화면에서는 dapick.co.kr/uploads/… 를 찾는다. 파일은 api.dapick.co.kr 에 있으니
  //   양쪽 다 404 다. 값은 멀쩡히 들어오는데 그림만 안 나온다.
  //
  //   렌탈사 로고에서 이게 드러났다 — 브랜드 관리 화면은 같은 보정(bmLogoSrc)을 이미
  //   하고 있어서 거기서는 잘 보였다. 그래서 "로고 값이 안 들어온다" 로 보였던 것이다.
  //
  // ⚠ 이미 절대 주소(https://…)로 저장된 것도 많다. 그건 그대로 둔다 —
  //   앞에 뭘 붙이면 오히려 깨진다. '/uploads/' 로 시작하는 것만 손본다.
  //
  // ⚠ 서버 주소를 여기서 정하지 않는다. 웹은 DAPICK_CONFIG, 어드민은 API_BASE 로
  //   각자 이미 갖고 있다. 여기서 또 적으면 세 곳이 갈린다.
  function apiBase() {
    if (typeof DAPICK_CONFIG !== 'undefined' && DAPICK_CONFIG && DAPICK_CONFIG.API_BASE_URL) {
      return DAPICK_CONFIG.API_BASE_URL;
    }
    if (typeof API_BASE !== 'undefined' && API_BASE) return API_BASE;
    return '';
  }

  function imgSrc(url) {
    var u = String(url == null ? '' : url);
    return u.indexOf('/uploads/') === 0 ? apiBase() + u : u;
  }

  // 미리보기에서만 "○○ 없음" 을 보여준다. 실제 화면에서는 빈 자리를 조용히 접는다.
  function miss(opts, text) {
    return opts.showMissing ? '<span class="pv2-miss">' + esc(text) + '</span>' : '';
  }

  function isEmptyValue(v) {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    return String(v).trim() === '';
  }

  // 값 하나를 사람이 읽는 글자로. 단위가 정의돼 있으면 뒤에 붙인다.
  function displayValue(v, field) {
    if (isEmptyValue(v)) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (v === true) return '예';
    if (v === false) return '아니오';
    var unit = field && field.unit ? ' ' + field.unit : '';
    if (field && field.type === 'number') return Number(v).toLocaleString() + unit;
    return String(v) + unit;
  }

  // 기간 표에서 가장 싼 줄. 대표 월요금으로 쓴다.
  function cheapestPlan(plans) {
    if (!Array.isArray(plans) || !plans.length) return null;
    return plans.slice().sort(function (a, b) {
      return (a.monthlyFee || 0) - (b.monthlyFee || 0);
    })[0];
  }

  // 처음에 켜 둘 기간.
  // 찜·비교·마이페이지에서 "48개월로 보던 그 화면"으로 돌아올 수 있어야 하므로,
  // 부르는 쪽이 wantMonths 를 주면 그 줄을 켠다. 없거나 못 찾으면 가장 싼 줄.
  function pickedPlan(p, opts) {
    var plans = (p.options && p.options.rentalPlans) || [];
    if (!plans.length) return null;
    var want = opts && opts.wantMonths;
    if (want !== null && want !== undefined && want !== '') {
      for (var i = 0; i < plans.length; i++) {
        if (String(plans[i].months) === String(want)) return plans[i];
      }
    }
    return cheapestPlan(plans);
  }

  function fieldByKey(fields, key) {
    for (var i = 0; i < (fields || []).length; i++) {
      if (fields[i] && fields[i].key === key) return fields[i];
    }
    return null;
  }

  // ══ 조각들 ═══════════════════════════════════════════════

  // 렌탈사 — 로고가 있으면 로고, 없으면 이름.
  //
  // 값이 올 수 있는 곳이 둘이다:
  //   1) brandName / brandLogoUrl — 카테고리에 등록해 둔 렌탈사를 고른 경우(FK).
  //      로고를 한 번 바꾸면 그 렌탈사의 모든 상품에 즉시 반영된다.
  //   2) options.brandDirect{name,logoUrl} — 상품 등록 화면에서 직접 적은 경우.
  //      바로 쓸 수 있지만 상품마다 사본이 생겨서, 로고가 바뀌면 상품을 전부 고쳐야 한다.
  // 등록된 렌탈사가 이긴다 — 마스터가 있는데 사본을 보여주면 둘이 어긋난 채로 남는다.
  function brandOf(p) {
    var d = (p.options && p.options.brandDirect) || {};
    return {
      name: p.brandName || d.name || '',
      logoUrl: p.brandLogoUrl || d.logoUrl || ''
    };
  }

  function brandHtml(p, opts) {
    var b = brandOf(p);
    if (b.logoUrl) {
      return '<div class="pv2-brand"><img src="' + esc(imgSrc(b.logoUrl)) + '" alt="' + esc(b.name) + '"/></div>';
    }
    if (b.name) {
      return '<div class="pv2-brand"><span class="pv2-brand-name">' + esc(b.name) + '</span></div>';
    }
    return opts.showMissing ? '<div class="pv2-brand">' + miss(opts, '렌탈사 미입력') + '</div>' : '';
  }

  // 제목 줄 — 렌탈사 / 상품명 / 모델명 / 해시태그
  function headHtml(p, opts) {
    var tags = (p.options && p.options.hashtags) || [];
    var badges = (p.options && p.options.badges) || [];

    var badgeHtml = badges.length
      ? '<div class="pv2-badges">' + badges.map(function (k) {
          var b = null;
          for (var i = 0; i < BADGES.length; i++) if (BADGES[i].key === k) b = BADGES[i];
          if (!b) return '';
          return '<span class="pv2-badge" style="background:' + b.color + '">' + esc(b.label) + '</span>';
        }).join('') + '</div>'
      : '';

    var tagHtml = tags.length
      ? '<div class="pv2-tags">' + tags.map(function (t) {
          return '<span class="pv2-tag">#' + esc(t) + '</span>';
        }).join('') + '</div>'
      : '';

    return '<div class="pv2-head">' +
      badgeHtml +
      brandHtml(p, opts) +
      '<h1 class="pv2-name">' + (p.name ? esc(p.name) : miss(opts, '제목 없음')) + '</h1>' +
      '<div class="pv2-model">' + (p.modelName ? esc(p.modelName) : miss(opts, '모델명 없음')) + '</div>' +
      tagHtml +
      '</div>';
  }

  // 왼쪽 — 전시 이미지.
  //
  // ★ galleryImages 를 여기 넣지 않는다 (2026-08-01 수정).
  //   어드민에서 그 칸의 이름은 '상세 이미지' 다. 쿠팡처럼 화면 아래에 세로로
  //   길게 이어 붙이라고 올리는 이미지라, 세로가 수천 픽셀인 경우가 흔하다.
  //   그걸 정사각형 전시 자리에 넣으면 상품 사진 대신 긴 안내문이 대표로 뜨고,
  //   정작 아래 상세 영역은 비어 보인다. 실제로 그렇게 나갔다.
  //
  //   전시 이미지 = imageUrl 한 장. 상세 이미지 = galleryImages (화면 아래).
  //   전시용으로 여러 장이 필요해지면 그때 칸을 따로 만든다 -
  //   여기서 상세 이미지를 빌려 쓰면 관리자는 왜 그렇게 되는지 알 수 없다.
  function galleryHtml(p, opts) {
    if (!p.imageUrl) {
      return '<div class="pv2-gallery"><div class="pv2-mainimg">' +
        (opts.showMissing ? '<span class="pv2-miss">대표 이미지 없음</span>' : '<span class="pv2-noimg">이미지 준비중</span>') +
        '</div></div>';
    }

    return '<div class="pv2-gallery">' +
      '<div class="pv2-mainimg"><img id="pv2-mainimg-el" src="' + esc(imgSrc(p.imageUrl)) + '" alt="' + esc(p.name || '') + '"/></div>' +
      '</div>';
  }

  // 이미지 아래 — 찜하기 / 비교하기 자리.
  //
  // 버튼을 여기서 만들지 않고 빈 칸만 내주는 이유:
  //   찜은 서버(/api/favorites), 비교는 브라우저 저장소를 쓰고 로그인 처리까지 붙는다.
  //   그건 fav-button.js / compare-button.js 가 이미 하고 있고, 정수기·렌탈·인터넷이
  //   같은 파일을 쓴다. 여기서 또 만들면 네 벌째 사본이 된다.
  //   웹은 이 칸에 진짜 버튼을 꽂고, 어드민 미리보기는 눌리지 않는 흉내를 보여준다.
  //
  // 자리를 이미지 아래로 잡은 것은 정수기 상세(.wd-media-actions)와 같은 위치이기 때문이다.
  function mediaActionsHtml(opts) {
    if (opts.showMissing) {
      return '<div class="pv2-media-actions">' +
        '<span class="pv2-fake-btn">♡ 찜하기</span>' +
        '<span class="pv2-fake-btn">+ 비교하기</span>' +
        '</div>';
    }
    return '<div class="pv2-media-actions">' +
      '<div class="pv2-fav-slot"></div>' +
      '<div class="pv2-cmp-slot"></div>' +
      '</div>';
  }

  // 기간 표에 고를 게 둘 이상 있는지. 하나뿐이면 버튼을 만들지 않는다 -
  // 누를 수 없는 버튼 하나는 "왜 안 눌리지" 만 만든다.
  function hasPlanChoice(p) {
    var plans = (p.options && p.options.rentalPlans) || [];
    return plans.length > 1;
  }

  // 오른쪽 위 — 요금 상자. 월 렌탈료 / 제휴카드 할인 두 칸.
  //
  // 왼쪽 칸 라벨이 두 가지인 이유:
  //   기간을 고를 수 있는 상품은 고른 순간 그 값이 최저가가 아니다.
  //   "최저 월 렌탈료" 라고 써두고 48개월 값을 보여주면 거짓말이 된다.
  function feeBoxHtml(p, opts) {
    var plans = (p.options && p.options.rentalPlans) || [];
    var picked = pickedPlan(p, opts);
    var fee = picked ? picked.monthlyFee : p.monthlyFee;
    var discount = p.options ? p.options.cardDiscount : null;
    var label = hasPlanChoice(p) ? '월 렌탈료' : '최저 월 렌탈료';

    var left = '<div class="pv2-feecell pv2-feecell--main">' +
      '<div class="pv2-feelabel">' + label + '</div>' +
      '<div class="pv2-feeval">' + (fee != null && fee !== '' ? esc(won(fee)) : miss(opts, '미입력')) + '</div>' +
      '</div>';

    // 할인이 없으면 칸을 아예 안 만든다. 빈 칸이 있으면 "값이 빠졌나" 로 읽힌다.
    var right = (discount != null && discount !== '')
      ? '<div class="pv2-feecell pv2-feecell--discount">' +
        '<div class="pv2-feelabel">제휴카드할인</div>' +
        '<div class="pv2-feeval">' + esc(won(discount)) + '</div>' +
        '</div>'
      : '';

    return '<div class="pv2-feebox">' + left + right + '</div>';
  }

  // 약정 기간 고르기 — 누르면 위 요금 상자의 숫자가 바뀐다.
  //
  // 처음 선택은 '가장 싼 기간' 이다. 요금 상자가 이미 그 값을 보여주고 있으니
  // 다른 기간이 켜져 있으면 화면과 숫자가 어긋난다.
  //
  // 보여주는 순서는 관리자가 입력한 순서 그대로 둔다. 여기서 정렬하면
  // 관리자가 "내가 넣은 순서와 다르게 나온다" 를 겪는다. 정렬이 필요하면 입력 쪽에서 한다.
  function plansHtml(p, opts) {
    var plans = (p.options && p.options.rentalPlans) || [];
    if (!plans.length) {
      return opts.showMissing
        ? '<div class="pv2-plans"><div class="pv2-miss">렌탈기간이 아직 없습니다</div></div>'
        : '';
    }
    if (plans.length < 2) return '';

    var want = pickedPlan(p, opts);
    var marked = false;

    return '<div class="pv2-plans">' +
      '<div class="pv2-plans-label">약정 기간</div>' +
      '<div class="pv2-plans-btns">' +
      plans.map(function (pl, i) {
        // 같은 요금이 두 줄이면 앞엣것 하나만 켠다. 둘 다 켜지면 어느 값이 실릴지 알 수 없다.
        var on = !marked && want && pl.monthlyFee === want.monthlyFee && pl.months === want.months;
        if (on) marked = true;
        return '<button type="button" class="pv2-plan' + (on ? ' is-on' : '') + '"' +
          ' data-pv2-plan="' + i + '"' +
          ' data-months="' + esc(pl.months == null ? '' : pl.months) + '"' +
          ' data-fee="' + esc(pl.monthlyFee == null ? '' : pl.monthlyFee) + '">' +
          '<span class="pv2-plan-m">' + esc(pl.months == null ? '기간 미입력' : pl.months + '개월') + '</span>' +
          '<span class="pv2-plan-f">' + (pl.monthlyFee != null ? '월 ' + esc(won(pl.monthlyFee)) : '요금 미입력') + '</span>' +
          '</button>';
      }).join('') +
      '</div></div>';
  }

  // 신청 패널 안내 줄 — A/S 기간·가입가능연령처럼 "요금 옆에서 알려줘야 하는" 것들.
  //
  // 요약표와 나누는 이유:
  //   요약표는 제품 사양(냉방면적·배관길이)이고 여기는 계약 조건이다.
  //   관리자도 showInPanel / showOnSpec 두 체크박스로 따로 고르게 되어 있어
  //   화면에서 합쳐 버리면 그 선택이 아무 의미가 없어진다.
  //
  // 담기는 것 두 가지:
  //   1) 항목 정의에서 showInPanel 이 켜진 칸
  //   2) 이 상품에만 적은 자유 줄 (options.panelNotes)
  //
  // ⚠ panelNotes 라는 이름은 어드민 저장 코드(peSubmit)가 정한 것이다. 바꾸면 값이 미아가 된다.
  //    notes 도 같이 읽는 이유 - 초기에 그 이름으로 저장된 상품이 있을 수 있다.
  function notesHtml(p, fields, opts) {
    var rows = [];

    (fields || []).forEach(function (f) {
      if (!f || !f.showInPanel || f.base) return;
      var text = displayValue((p.specs || {})[f.key], f);
      if (!text && !opts.showMissing) return;
      rows.push({ label: f.label, value: text });
    });

    var free = (p.options && (p.options.panelNotes || p.options.notes)) || [];
    free.forEach(function (n) {
      if (!n) return;
      var text = (n.value == null ? '' : String(n.value)).trim();
      if (!text && !opts.showMissing) return;
      rows.push({ label: n.label || '(항목 없음)', value: text });
    });

    if (!rows.length) return '';

    return '<div class="pv2-notes">' +
      rows.map(function (r) {
        return '<div class="pv2-note">' +
          '<span class="pv2-note-key">' + esc(r.label) + '</span>' +
          '<span class="pv2-note-val">' + (r.value ? esc(r.value) : miss(opts, '내용 없음')) + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  // 오른쪽 아래 — 회색 요약정보 2열 표.
  // 타입에 정의된 칸(showOnSpec) + 이 상품에만 적은 자유 줄(options.summary) 을 이어 붙인다.
  function specHtml(p, fields, opts) {
    var rows = [];

    // 이미지·기간표·제휴카드는 값이 URL이나 배열이라 표에 한 줄로 못 적는다.
    // 거르지 않으면 요약표에 "https://…/a.png" 같은 주소가 그대로 뜬다.
    // 이 네 타입은 화면의 다른 자리(갤러리·약정 버튼·카드 영역)가 이미 맡고 있다.
    // ⚠ 어드민 peDrawSpec 의 필터와 같은 목록이다. 한쪽만 고치면 미리보기와 실물이 갈린다.
    var NOT_IN_TABLE = ['plans', 'cards', 'image', 'images'];

    (fields || []).forEach(function (f) {
      if (!f || f.showOnSpec === false) return;
      if (NOT_IN_TABLE.indexOf(f.type) !== -1) return;
      var v = f.base ? baseValue(p, f.key) : (p.specs || {})[f.key];
      var text = displayValue(v, f);
      if (!text && !opts.showMissing) return;
      rows.push({ label: f.label, value: text });
    });

    // 정의에 없는 specs 키도 버리지 않는다. 관리자가 넣은 값이 사라진 것처럼 보이면 안 된다.
    Object.keys(p.specs || {}).forEach(function (k) {
      if (fieldByKey(fields, k)) return;
      var text = displayValue(p.specs[k], null);
      if (!text) return;
      rows.push({ label: k, value: text });
    });

    // 관리자가 이 상품에만 만든 줄 (options.summary).
    // 2026-08-12 부터 줄마다 type 이 붙는다 — text / select / image.
    //   type 이 없는 옛 줄은 text 로 본다. 이미 등록된 상품이 깨지면 안 된다.
    //   select 는 고객이 고르는 값이라 표가 아니라 아래 choicesHtml 이 맡는다.
    //   image 는 주소를 글자로 찍으면 안 되므로 그림으로 그린다 (렌탈사 로고 등).
    ((p.options && p.options.summary) || []).forEach(function (r) {
      if (!r) return;
      var t = r.type || 'text';
      if (t === 'select') return;
      var text = (r.value == null ? '' : String(r.value)).trim();
      if (!text && !opts.showMissing) return;
      rows.push({ label: r.label || '(항목 없음)', value: text, image: t === 'image' });
    });

    if (!rows.length) {
      return opts.showMissing
        ? '<div class="pv2-specbox"><div class="pv2-miss">요약정보가 아직 없습니다</div></div>'
        : '';
    }

    return '<div class="pv2-specbox"><div class="pv2-specgrid">' +
      rows.map(function (r) {
        var val = r.image
          ? '<img class="pv2-specimg" src="' + esc(imgSrc(r.value)) + '" alt="' + esc(r.label) + '" />'
          : esc(r.value);
        return '<div class="pv2-speccell">' +
          '<div class="pv2-speckey">' + esc(r.label) + '</div>' +
          '<div class="pv2-specval">' + (r.value ? val : miss(opts, '미입력')) + '</div>' +
          '</div>';
      }).join('') +
      '</div></div>';
    // 한 줄에 라벨 하나 값 하나. 자리 배치는 아래 CSS(.pv2-speccell)가 맡는다.
  }

  // 고객이 고르는 칸 — 설치유형 스탠드형/벽걸이형 같은 것.
  //
  // 요약표와 나누는 이유: 요약표는 "이 상품은 이렇습니다" 고 여기는 "당신이 고르세요" 다.
  // 표 안에 드롭다운을 끼워 넣으면 고를 수 있는 줄인지 아닌지 눈으로 구분이 안 된다.
  // 자리는 약정 기간 바로 아래다 — 신청 전에 정해야 하는 값끼리 모아 둔다.
  //
  // ⚠ options.choiceRows 라는 이름은 어드민 저장 코드(peChoiceRowsOut)가 정한 것이다.
  //   옛 상품에는 이 칸이 없다 — 없으면 아무것도 안 그린다.
  function choicesHtml(p, opts) {
    var rows = ((p.options && p.options.choiceRows) || []).filter(function (r) {
      return r && r.choices && r.choices.length;
    });
    if (!rows.length) return '';

    return '<div class="pv2-choices">' +
      rows.map(function (r, i) {
        var label = r.label || '선택';
        return '<div class="pv2-choice">' +
          '<div class="pv2-choice-label">' + esc(label) + '</div>' +
          '<select class="pv2-choice-sel" data-pv2-choice="' + i + '"' +
          ' data-label="' + esc(label) + '">' +
          r.choices.map(function (c) {
            // 관리자가 기본값을 정해 뒀으면 그걸 켜 둔다. 없으면 첫 보기가 켜진다 —
            // 빈 값으로 두면 고객이 안 고르고 신청해서 무엇을 원했는지 알 수 없다.
            var on = r.value ? c === r.value : false;
            return '<option value="' + esc(c) + '"' + (on ? ' selected' : '') + '>' + esc(c) + '</option>';
          }).join('') +
          '</select>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  // base 칸은 specs 가 아니라 상품의 진짜 항목에서 값을 찾는다.
  function baseValue(p, key) {
    if (key === 'brandId') return brandOf(p).name;   // 직접 입력한 이름도 요약표에 나와야 한다
    if (key === 'monthlyFee') return p.monthlyFee;
    return p[key];
  }

  // ══ 조립 ═════════════════════════════════════════════════

  // 화면 구성 (2026-08-01 개편):
  //
  //   [뱃지 · 렌탈사 · 상품명 · 모델명 · 해시태그]
  //   [ 이미지 ]  [ 요약정보 → 요금 → 약정 → 신청 버튼 → 안내 줄 ]
  //
  // ★ 2026-08-12 — 요약표를 오른쪽 패널 안으로 되돌렸다. 08-01 판단을 뒤집는다.
  //   그때는 "오른쪽 좁은 칸에 두면 짧은 값이 두 줄로 접히고 표가 세로로 길어진다" 였다.
  //   실제 화면을 놓고 보니 그 걱정은 표를 4열로 깔았기 때문에 생긴 것이었다 —
  //   한 칸이 폭의 4분의 1이라 "4K UHD (3,840 x 2,160)" 이 접혔다.
  //   라벨 왼쪽 값 오른쪽 두 칸으로 세우면 한 줄에 다 들어간다.
  //
  //   그리고 이 값들은 고객이 상품을 고를 때 읽는 것이다. 화면 아래로 내려 두면
  //   해상도를 확인하려고 신청 영역을 지나쳐 내려갔다가 다시 올라와야 한다.
  //   요금 위에 두면 위에서 아래로 한 번에 읽힌다 — 사양을 보고 값을 보고 신청한다.
  //
  // 약정 버튼을 요금 바로 아래에 두는 이유 - 눌렀을 때 바뀌는 숫자가 바로 위에 있어야
  // "이 버튼이 저 숫자를 바꾼다" 가 눈에 보인다. 멀리 떨어뜨리면 바뀐 줄도 모른다.
  function render(product, fields, options) {
    var p = product || {};
    var opts = options || {};
    if (!p.options) p.options = {};

    // 카테고리에 입력 양식이 없으면 기본 칸으로 그린다.
    // ⚠ 값이 없는 칸은 showMissing:false 라 어차피 안 그려진다 —
    //   기본 칸을 깔아도 빈 줄이 늘어나지 않는다.
    var fs = (fields && fields.length) ? fields : DEFAULT_FIELDS;

    // 처음 선택값을 루트에 적어둔다. 신청 버튼을 만드는 쪽이 이걸 읽어
    // "고객이 지금 보고 있는 요금" 을 그대로 접수한다.
    // 이게 없으면 48개월을 고른 고객의 신청서에 60개월 최저가가 실린다.
    var init = pickedPlan(p, opts);
    var initFee = init ? init.monthlyFee : p.monthlyFee;
    var initMonths = init ? init.months : p.contractMonths;

    return '<div class="pv2-root' + (opts.narrow ? ' pv2-root--narrow' : '') + '"' +
      ' data-selected-fee="' + esc(initFee == null ? '' : initFee) + '"' +
      ' data-selected-months="' + esc(initMonths == null ? '' : initMonths) + '">' +
      // ★ 2026-08-26 — 제목 블록을 오른쪽 칸 맨 위로 옮겼다.
      //   전에는 화면 전체 폭 위에 혼자 있었다. 그러면 제목은 왼쪽 끝에 붙고
      //   값(요약표·요금)은 오른쪽에 있어, 눈이 좌우로 한 번 건너뛰어야 했다.
      //   지금은 오른쪽 칸에서 [뱃지·렌탈사·제목·모델명] → 요약표 → 요금 → 약정 순으로
      //   위에서 아래로 한 줄기로 읽힌다. 요약표의 모델명 바로 위에 제목이 붙는다.
      //
      // 1열로 접히면 이미지가 먼저 나오고 그 아래 제목이 온다. 그대로 둔다 —
      //   폰에서는 사진을 먼저 보고 이름을 읽는 것이 자연스럽고, 커머스 화면이 대개 그렇다.
      '<div class="pv2-body">' +
        '<div class="pv2-left">' + galleryHtml(p, opts) + mediaActionsHtml(opts) + '</div>' +
        '<div class="pv2-right">' +
          headHtml(p, opts) +
          specHtml(p, fs, opts) +
          feeBoxHtml(p, opts) +
          plansHtml(p, opts) +
          choicesHtml(p, opts) +
          (opts.actionsHtml ? '<div class="pv2-actions">' + opts.actionsHtml + '</div>' : '') +
          notesHtml(p, fs, opts) +
        '</div>' +
      '</div>' +
      '</div>';
  }

  // data-selected-* 는 render 가 만든 .pv2-root 에 붙어 있다.
  // 부르는 쪽이 담는 칸(#pd-view)을 넘길 수도 있고 .pv2-root 를 바로 넘길 수도 있어 둘 다 받는다.
  function rootOf(el) {
    if (!el) return null;
    if (el.classList && el.classList.contains('pv2-root')) return el;
    return el.querySelector('.pv2-root') || el;
  }

  // 썸네일 클릭 — 그린 뒤 한 번 불러 연결한다.
  //
  // 지금은 전시 이미지가 한 장뿐이라 썸네일이 그려지지 않는다(2026-08-01).
  // 이 코드를 지우지 않고 두는 이유 - 전시 이미지를 여러 장 받는 칸이 생기면
  // 바로 다시 쓰인다. 선택자가 안 잡히면 아무 일도 하지 않으므로 해가 없다.
  function bindGallery(rootEl) {
    if (!rootEl) return;
    rootEl.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-pv2-img]');
      if (!btn) return;
      var img = btn.querySelector('img');
      var main = rootEl.querySelector('#pv2-mainimg-el');
      if (img && main) main.src = img.src;
      rootEl.querySelectorAll('[data-pv2-img]').forEach(function (b) {
        b.classList.toggle('is-on', b === btn);
      });
    });
  }

  // 약정 버튼 클릭 — 요금 상자 숫자를 바꾸고 선택값을 루트에 적는다.
  function bindPlans(hostEl) {
    if (!hostEl) return;
    hostEl.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-pv2-plan]');
      if (!btn) return;

      var root = rootOf(hostEl);
      var feeText = btn.getAttribute('data-fee');
      var val = hostEl.querySelector('.pv2-feecell--main .pv2-feeval');
      if (val) val.textContent = feeText === '' ? '' : won(feeText);

      hostEl.querySelectorAll('[data-pv2-plan]').forEach(function (b) {
        b.classList.toggle('is-on', b === btn);
      });

      if (root) {
        root.setAttribute('data-selected-fee', feeText || '');
        root.setAttribute('data-selected-months', btn.getAttribute('data-months') || '');
      }

      // 찜·비교는 '상품' 이 아니라 '조합' 단위다(정수기와 같은 규칙).
      // 약정을 바꾸면 담긴 상태가 달라지므로 버튼을 다시 물어봐야 한다.
      // 알리지 않으면 60개월을 찜한 뒤 36개월로 바꿔도 하트가 켜진 채로 남는다.
      hostEl.dispatchEvent(new CustomEvent('pv2-selection-change', {
        bubbles: true,
        detail: selection(hostEl)
      }));
    });
  }

  // 그린 뒤 한 번 부른다.
  //
  // ⚠ 담는 칸(hostEl)에 리스너를 붙이므로, 다시 그려도 리스너는 살아 있다.
  //   어드민 미리보기처럼 입력할 때마다 다시 그리는 화면에서 매번 bind 를 부르면
  //   리스너가 쌓여 클릭 한 번에 수십 번 실행된다. 그래서 한 번만 붙인다.
  function bind(hostEl) {
    if (!hostEl || hostEl.__pv2Bound) return;
    hostEl.__pv2Bound = true;
    bindGallery(hostEl);
    bindPlans(hostEl);
  }

  // 지금 고객이 보고 있는 요금·약정. 신청 접수에 이 값을 실어야 한다.
  //
  // choices 는 관리자가 만든 "고르는 칸" 의 현재 값이다 ({설치유형:'벽걸이형'}).
  // 신청서에 안 실으면 상담원이 고객에게 다시 물어야 한다.
  function selection(hostEl) {
    var root = rootOf(hostEl);
    if (!root) return { monthlyFee: null, months: null, choices: {} };
    var f = root.getAttribute('data-selected-fee');
    var m = root.getAttribute('data-selected-months');
    var choices = {};
    root.querySelectorAll('[data-pv2-choice]').forEach(function (sel) {
      var label = sel.getAttribute('data-label') || '';
      if (label) choices[label] = sel.value;
    });
    return {
      monthlyFee: f === null || f === '' ? null : Number(f),
      months: m === null || m === '' ? null : Number(m),
      choices: choices
    };
  }

  var styled = false;
  function injectStyles() {
    if (styled) return;
    styled = true;
    var css = [
      '.pv2-root{font-family:inherit;color:#18172b;}',
      /* 제목 */
      // 2026-08-26 — 오른쪽 칸 맨 위로 옮겼다. 전체 폭일 때 쓰던 아래 여백(22px)은
      //   요약표와 너무 벌어져서 16 으로 줄이고, 아래에 옅은 줄을 넣어 값과 구분한다.
      '.pv2-head{padding:0 0 16px;margin-bottom:16px;border-bottom:1px solid #f1f0f6;}',
      '.pv2-badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}',
      '.pv2-badge{font-size:11px;font-weight:800;color:#fff;border-radius:4px;padding:3px 7px;line-height:1.3;}',
      '.pv2-brand{margin-bottom:9px;}',
      '.pv2-brand img{height:22px;width:auto;max-width:150px;object-fit:contain;display:block;}',
      '.pv2-brand-name{font-size:14px;font-weight:700;color:#6b6880;}',
      // 오른쪽 칸은 전체 폭보다 좁다. 27px 그대로면 긴 제목이 네 줄까지 접힌다.
      '.pv2-name{font-size:23px;font-weight:800;line-height:1.35;margin:0;letter-spacing:-.5px;}',
      '.pv2-model{font-size:16px;color:#b0aec2;margin-top:4px;font-weight:500;}',
      '.pv2-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;}',
      '.pv2-tag{font-size:12px;color:#6b6880;background:#f4f4f7;border-radius:5px;padding:5px 9px;line-height:1.3;}',
      /* 본문 2열 */
      '.pv2-body{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:40px;align-items:start;}',
      /* 이미지 */
      '.pv2-gallery{display:flex;gap:14px;align-items:flex-start;}',
      '.pv2-thumbs{display:flex;flex-direction:column;gap:8px;flex-shrink:0;}',
      '.pv2-thumb{width:62px;height:62px;border:1px solid #eceaf5;border-radius:8px;background:#fff;padding:4px;cursor:pointer;overflow:hidden;}',
      '.pv2-thumb img{width:100%;height:100%;object-fit:contain;}',
      '.pv2-thumb.is-on{border-color:#18172b;}',
      '.pv2-mainimg{flex:1;aspect-ratio:1/1;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:10px;}',
      '.pv2-mainimg img{width:100%;height:100%;object-fit:contain;}',
      '.pv2-noimg{color:#c9ccd6;font-size:14px;}',
      /* 찜 / 비교 자리 — 버튼 자체 모양은 fav-button.js · compare-button.js 가 정한다 */
      '.pv2-media-actions{display:flex;gap:8px;margin-top:16px;justify-content:center;flex-wrap:wrap;}',
      '.pv2-media-actions:empty{display:none;}',
      '.pv2-fake-btn{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #e2ddf0;background:#fff;color:#b5b2c4;border-radius:12px;padding:9px 16px;font-size:14px;font-weight:700;}',
      /* 요금 상자 */
      '.pv2-feebox{display:flex;border:1px solid #eceaf5;border-radius:12px;background:#fff;overflow:hidden;}',
      '.pv2-feecell{flex:1;padding:20px 16px;text-align:center;}',
      '.pv2-feecell + .pv2-feecell{border-left:1px solid #f0eff5;}',
      '.pv2-feelabel{font-size:13px;color:#8a8fa3;font-weight:500;}',
      '.pv2-feeval{font-size:24px;font-weight:800;margin-top:6px;letter-spacing:-.5px;color:#18172b;}',
      '.pv2-feecell--discount .pv2-feeval{color:#e8590c;}',
      /* 약정 기간 고르기 */
      '.pv2-plans{margin-top:14px;}',
      '.pv2-plans-label{font-size:13px;color:#8a8fa3;font-weight:600;margin-bottom:8px;}',
      /* 세로 쌓기 — 기간이 3~5줄이면 가로로는 글자가 눌리고, 줄마다 요금을 나란히 읽기도 어렵다 */
      '.pv2-plans-btns{display:flex;flex-direction:column;gap:8px;}',
      '.pv2-plan{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #e4e2ee;border-radius:9px;background:#fff;padding:13px 15px;cursor:pointer;text-align:left;line-height:1.3;transition:border-color .12s,background .12s;}',
      '.pv2-plan:hover{border-color:#c8c4dc;}',
      '.pv2-plan-m{font-size:14px;font-weight:700;color:#4a4860;}',
      '.pv2-plan-f{font-size:14px;font-weight:700;color:#9a97ad;}',
      '.pv2-plan.is-on{border-color:#18172b;background:#18172b;}',
      '.pv2-plan.is-on .pv2-plan-m{color:#fff;}',
      '.pv2-plan.is-on .pv2-plan-f{color:#fff;}',
      /* 신청 버튼 자리 — 세로 3개(상품 신청 / 간편 신청 / 카카오톡 문의)로 통일 */
      '.pv2-actions{display:flex;flex-direction:column;gap:8px;margin-top:14px;}',
      '.pv2-actions > *{width:100%;}',
      /* 신청 안내 줄 */
      '.pv2-notes{margin-top:14px;border:1px solid #eceaf5;border-radius:12px;overflow:hidden;}',
      '.pv2-note{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;font-size:13.5px;}',
      '.pv2-note + .pv2-note{border-top:1px solid #f4f3f8;}',
      '.pv2-note-key{flex:0 0 92px;color:#9a97ad;font-weight:500;}',
      // ★ 2026-08-26 — white-space:pre-line 추가.
      //   어드민 입력이 textarea 이고 "내용 (여러 줄 가능)" 이라고 안내까지 하는데,
      //   화면에서는 줄바꿈이 통째로 무시돼 한 줄로 이어 붙었다.
      //   pre-line 은 관리자가 친 엔터만 살리고 연속 공백은 하나로 합친다 —
      //   pre 나 pre-wrap 을 쓰면 붙여넣기에 딸려온 공백까지 그대로 나가 들쭉날쭉해진다.
      '.pv2-note-val{flex:1;color:#2a2a35;font-weight:600;word-break:break-word;' +
        'line-height:1.5;white-space:pre-line;}',
      /* 요약정보 */
      /* 2열 밖으로 나와 폭 전체를 쓴다. 그만큼 칸을 4개로 늘려 표가 세로로 안 늘어지게 한다.
         auto-fit 을 안 쓰는 이유 - 폭이 넓으면 7~8열까지 벌어져 어느 줄이 짝인지 안 보인다. */
      // 요약정보 — 라벨 왼쪽, 값 오른쪽. 한 줄에 한 항목 (2026-08-12).
      // 회색 상자를 벗겼다. 요금·신청과 같은 패널 안에 들어오면서 상자가 겹쳐 보였다.
      '.pv2-specbox{margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid #eceaf3;}',
      '.pv2-specgrid{display:block;}',
      // 라벨 폭을 고정한다. 값이 왼쪽 끝을 맞춰 서야 눈이 아래로 훑을 수 있다.
      '.pv2-speccell{display:grid;grid-template-columns:104px minmax(0,1fr);gap:12px;' +
        'align-items:start;padding:7px 0;}',
      '.pv2-speckey{font-size:13.5px;color:#8b8898;font-weight:500;line-height:1.5;}',
      // 요약표 값도 줄바꿈을 살린다 (2026-08-26). 양식의 여러 줄 칸(textarea)이
      // 이 표로 들어올 수 있어서, 안내 줄만 고치면 같은 값이 자리마다 다르게 보인다.
      '.pv2-specval{font-size:13.5px;color:#2a2a35;font-weight:600;word-break:break-word;' +
        'line-height:1.5;white-space:pre-line;}',
      // 이미지 줄(렌탈사 로고 등). 값 자리에 그대로 넣으므로 높이를 묶어 둔다 —
      // 안 묶으면 큰 로고 한 장이 표 전체를 밀어낸다.
      '.pv2-specimg{max-height:26px;max-width:100%;width:auto;object-fit:contain;display:block;}',
      /* 고르는 칸 — 관리자가 만든 드롭다운 (설치유형 등). 약정 기간 바로 아래. */
      '.pv2-choices{display:flex;flex-direction:column;gap:10px;margin-bottom:18px;}',
      '.pv2-choice-label{font-size:12.5px;font-weight:700;color:#8b8898;margin-bottom:6px;}',
      '.pv2-choice-sel{width:100%;height:46px;padding:0 14px;border:1.5px solid #e6e3f0;' +
        'border-radius:12px;background:#fff;font-size:14.5px;font-weight:600;color:#221f38;' +
        'font-family:inherit;cursor:pointer;appearance:none;' +
        "background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b8898' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\");" +
        'background-repeat:no-repeat;background-position:right 14px center;}',
      '.pv2-choice-sel:focus{outline:none;border-color:#6c3fc5;}',
      /* 미리보기 전용 */
      '.pv2-miss{color:#c9ccd6;font-weight:400;font-size:13px;}',
      /* 좁은 칸(어드민 미리보기) — 모바일 규칙과 같은 모양을 창 크기와 무관하게 적용한다 */
      '.pv2-root--narrow .pv2-body{grid-template-columns:1fr;gap:20px;}',
      '.pv2-root--narrow .pv2-head{padding-bottom:16px;}',
      '.pv2-root--narrow .pv2-name{font-size:19px;}',
      '.pv2-root--narrow .pv2-model{font-size:13px;}',
      '.pv2-root--narrow .pv2-gallery{flex-direction:column-reverse;}',
      '.pv2-root--narrow .pv2-thumbs{flex-direction:row;flex-wrap:wrap;}',
      '.pv2-root--narrow .pv2-thumb{width:52px;height:52px;}',
      '.pv2-root--narrow .pv2-feecell{padding:16px 10px;}',
      '.pv2-root--narrow .pv2-feeval{font-size:19px;}',
      '.pv2-root--narrow .pv2-plan{padding:11px 13px;}',
      '.pv2-root--narrow .pv2-plan-m,.pv2-root--narrow .pv2-plan-f{font-size:13px;}',
      '.pv2-root--narrow .pv2-brand img{height:18px;}',
      '.pv2-root--narrow .pv2-note{padding:10px 12px;font-size:12.5px;}',
      '.pv2-root--narrow .pv2-note-key{flex:0 0 88px;}',  /* 72px 이면 "가입가능연령" 이 두 줄로 접힌다 */
      '.pv2-root--narrow .pv2-specbox{margin-bottom:16px;padding-bottom:14px;}',
      '.pv2-root--narrow .pv2-speccell{grid-template-columns:88px minmax(0,1fr);gap:10px;padding:5px 0;}',
      '.pv2-root--narrow .pv2-speckey{font-size:12.5px;}',
      '.pv2-root--narrow .pv2-specval{font-size:12.5px;}',
      '.pv2-root--narrow .pv2-choice-sel{height:42px;font-size:13.5px;}',
      /* 모바일 */
      '@media(max-width:900px){',
      '.pv2-body{grid-template-columns:1fr;gap:24px;}',
      '.pv2-name{font-size:21px;}',
      '.pv2-model{font-size:14px;}',
      '.pv2-gallery{flex-direction:column-reverse;}',
      '.pv2-thumbs{flex-direction:row;flex-wrap:wrap;}',
      '.pv2-feeval{font-size:20px;}',
      '.pv2-plan{padding:11px 13px;}',
      '.pv2-plan-m,.pv2-plan-f{font-size:13px;}',
      '.pv2-note-key{flex:0 0 80px;}',
      '.pv2-specbox{margin-bottom:16px;padding-bottom:14px;}',
      // 폰은 라벨 폭을 더 줄인다. 104px 를 그대로 두면 값이 들어갈 자리가 안 남는다.
      '.pv2-speccell{grid-template-columns:92px minmax(0,1fr);gap:10px;padding:6px 0;}',
      '}'
    ].join('');
    var el = document.createElement('style');
    el.setAttribute('data-pv2', '1');
    el.textContent = css;
    document.head.appendChild(el);
  }

  global.DapickProductView = {
    render: render,
    injectStyles: injectStyles,
    bind: bind,               // 썸네일 + 약정 버튼을 한 번에 연결 (권장)
    bindGallery: bindGallery, // 썸네일만
    bindPlans: bindPlans,     // 약정 버튼만
    selection: selection,     // 지금 선택된 요금·약정
    BADGES: BADGES
  };
})(window);
