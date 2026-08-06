// ════════════════════════════════════════════════════════════════════
// 정수기 상세 — 하단 세로 재구성 + 자주 묻는 질문 (2026-08-04 신설)
//
// 왜 파일을 나눴나
//   water-detail.js 는 41KB 짜리고 스펙 전면 페이지 라우팅(view=spec)이 얽혀 있다.
//   거기에 손을 대면 되돌릴 때 무엇을 되돌려야 하는지 알기 어렵다.
//   그래서 "탭 동작 바꾸기 + FAQ" 만 이 파일로 떼어냈다.
//   되돌리려면 water-detail.html 에서 이 파일 <script> 한 줄과
//   섹션 마크업만 지우면 원래대로 돌아온다.
//
// 무엇을 바꾸나
//   ① setActiveDetailTab 을 덮어쓴다.
//      원래는 패널 하나만 보이고 나머지는 display:none 이었다.
//      이제는 넷 다 항상 보이고, 탭은 '그 자리로 내려가는 목차'가 된다.
//      ⚠ water-detail.js 의 exitSpecView() 도 이 함수를 부른다.
//        그래서 덮어쓴 함수는 하이라이트만 바꾸고 스크롤은 하지 않는다.
//        스크롤은 아래 탭 클릭 리스너가 따로 맡는다.
//        (여기서 스크롤까지 하면 스펙 페이지에서 뒤로가기 할 때마다 화면이 튄다)
//   ② 자주 묻는 질문 섹션. 질문이 0건이면 탭도 섹션도 숨긴다.
//   ③ 스크롤 스파이 — 지금 보고 있는 섹션의 탭에 불이 들어온다.
//
// ★ 이 파일은 water-detail.js 뒤에 로드되어야 한다(함수를 덮어쓰기 때문).
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 탭 키 → 섹션 element id. water-detail.js 의 DETAIL_PANELS(패널 id)와 다르다.
  // 저쪽은 '내용물', 이쪽은 '스크롤해서 갈 자리(제목 포함한 섹션)' 를 가리킨다.
  var SECTIONS = {
    spec: 'wdSecSpec',
    detail: 'wdSecDetail',
    reco: 'wdSecReco',      // 다픽이 추천하는 다른 상품 (2026-08-06 추가)
    review: 'wdSecReview',
    faq: 'wdSecFaq',
  };

  var faqRows = [];

  function el(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── ① 탭 = 목차 ─────────────────────────────────────────────
  // 원본을 덮어쓴다. 원본은 패널을 숨겼지만 이제 아무것도 숨기지 않는다.
  window.setActiveDetailTab = function (key) {
    var bar = el('wdTabbar');
    if (!bar) return;
    bar.querySelectorAll('.wd-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === key);
    });
  };

  // 탭 높이만큼 빼고 멈춘다. 안 그러면 sticky 탭바가 섹션 제목을 덮는다.
  function scrollToSection(key) {
    var sec = el(SECTIONS[key]);
    if (!sec || sec.hidden) return;
    var bar = el('wdTabbar');
    var offset = (bar ? bar.getBoundingClientRect().height : 0) + 12;
    var top = window.pageYOffset + sec.getBoundingClientRect().top - offset;
    window.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });
  }

  function bindTabScroll() {
    var bar = el('wdTabbar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.wd-tab');
      if (!t) return;
      scrollToSection(t.getAttribute('data-tab'));
    });
  }

  // ── ③ 스크롤 스파이 ─────────────────────────────────────────
  // 화면 위쪽 1/3 선을 넘어선 섹션 중 가장 아래 것을 '보고 있는 섹션'으로 친다.
  // IntersectionObserver 로 하면 섹션 길이 차이(상세는 길고 사양은 짧다) 때문에
  // 짧은 섹션이 계속 밀려 활성이 안 잡힌다.
  var spyTicking = false;
  function spy() {
    spyTicking = false;
    var section = document.querySelector('.wd-detail-section');
    // 스펙 전면 페이지(view=spec)에서는 이 블록이 숨는다. 그때는 건드리지 않는다.
    if (!section || section.style.display === 'none') return;

    var line = window.innerHeight / 3;
    var cur = null;
    Object.keys(SECTIONS).forEach(function (k) {
      var s = el(SECTIONS[k]);
      if (!s || s.hidden) return;
      if (s.getBoundingClientRect().top <= line) cur = k;
    });
    if (cur) window.setActiveDetailTab(cur);
  }
  function onScroll() {
    if (spyTicking) return;
    spyTicking = true;
    requestAnimationFrame(spy);
  }

  // ── ② 자주 묻는 질문 ────────────────────────────────────────
  //
  // FAQ 는 카테고리에 달린다. 정수기 상품에는 categoryId 가 없으므로
  // 카테고리 목록에서 이름으로 찾는다.
  // ⚠ id 를 코드에 박지 않는 이유 — 로컬 DB 와 운영 DB 의 UUID 가 다르다.
  //   박아 두면 로컬에서만, 또는 운영에서만 FAQ 가 안 나온다.
  //
  // ⚠ 부분일치 하나만 쓰면 안 된다 (2026-08-05).
  //   예전에는 이름에 '정수기' 가 들어가는 첫 번째 카테고리를 그냥 골랐다.
  //   관리자가 '정수기렌탈' 같은 카테고리를 하나 더 만드는 순간, 목록 정렬 순서에 따라
  //   엉뚱한 FAQ 가 붙고 아무 오류도 안 난다 — 조용히 틀린다.
  //   (2026-08-01 에 주소에 'water' 글자가 든 카테고리를 만들었더니 문의가 전부
  //    정수기로 접수된 것과 같은 계열의 함정이다.)
  //   그래서 좁은 것부터 본다: slug 정확 → 이름 정확 → 이름 부분일치(가장 짧은 이름).
  var WATER_SLUG = 'water';
  var WATER_NAME = '정수기';

  function findWaterCategoryId(list) {
    var rows = Array.isArray(list) ? list : (list && list.data) || [];
    rows = rows.filter(Boolean);

    // ① slug 정확 일치 — 가장 믿을 만하다 (V20260730002 로 생긴 칸)
    var hit = rows.filter(function (c) {
      return String(c.slug || '').toLowerCase() === WATER_SLUG;
    })[0];
    if (hit) return hit.id;

    // ② 이름 정확 일치
    hit = rows.filter(function (c) {
      return String(c.name || '').trim() === WATER_NAME;
    })[0];
    if (hit) return hit.id;

    // ③ 부분일치 폴백 — 여러 개면 이름이 가장 짧은 것(= 상위/기본 카테고리)
    var loose = rows
      .filter(function (c) {
        return String(c.name || '').indexOf(WATER_NAME) >= 0;
      })
      .sort(function (a, b) {
        return String(a.name).length - String(b.name).length;
      });
    if (loose.length > 1) {
      // 조용히 틀리지 않도록 남긴다. 이게 찍히면 카테고리 이름을 정리해야 한다.
      console.warn(
        '[water-detail-more] 이름에 "' + WATER_NAME + '" 이 든 카테고리가 ' +
          loose.length + '개다. 가장 짧은 "' + loose[0].name + '" 을 골랐다.',
        loose.map(function (c) { return c.name; }),
      );
    }
    return loose[0] ? loose[0].id : null;
  }

  function loadFaq() {
    if (typeof api === 'undefined' || !api.get) return Promise.resolve();
    return api
      .get('/api/categories')
      .then(function (cats) {
        var id = findWaterCategoryId(cats);
        if (!id) return null;
        return api.get('/api/faqs?categoryId=' + encodeURIComponent(id));
      })
      .then(function (list) {
        var rows = Array.isArray(list) ? list : (list && (list.data || list.content)) || [];
        faqRows = rows.filter(function (f) {
          return f && f.question;
        });
        renderFaq();
      })
      .catch(function (e) {
        // FAQ 때문에 상품 화면이 죽으면 안 된다. 섹션만 조용히 접는다.
        console.warn('[water-detail-more] FAQ 로드 실패', e && e.message);
      });
  }

  function faqAnswer(f) {
    if (typeof dpRichHtml === 'function' && f.detailContent) {
      var html = dpRichHtml(f.detailContent);
      if (html) return '<div class="ql-snow"><div class="ql-editor wd-faq-ql">' + html + '</div></div>';
    }
    return '<span class="wd-faq-none">답변이 준비 중입니다.</span>';
  }

  function renderFaq() {
    var sec = el('wdSecFaq');
    var tab = el('wdTabFaq');
    var body = el('wdFaqBody');
    if (!sec || !body) return;

    if (!faqRows.length) {
      sec.hidden = true;
      if (tab) tab.hidden = true;
      return;
    }

    // 클래스는 이 화면 전용이다. 홈의 faq-* 를 빌려 쓰면 그쪽 디자인이 바뀔 때
    // 여기가 같이 깨지고, 원인을 이 파일에서 찾을 수 없다.
    // 여닫기는 utils.js 의 toggleFaq — 클래스명을 안 보고 바로 다음 형제에 open 을 붙인다.
    body.innerHTML =
      '<div class="wd-faq-list">' +
      faqRows
        .map(function (f) {
          return (
            '<div class="wd-faq-item">' +
            '<div class="wd-faq-q" onclick="toggleFaq(this)">' +
            '<span>Q. ' +
            esc(f.question) +
            '</span>' +
            '<svg class="wd-faq-ico" viewBox="0 0 24 24" width="16" height="16" fill="none"' +
            ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M6 9l6 6 6-6"/></svg>' +
            '</div>' +
            '<div class="wd-faq-a"><div class="wd-faq-a-inner">' +
            faqAnswer(f) +
            '</div></div>' +
            '</div>'
          );
        })
        .join('') +
      '</div>';

    sec.hidden = false;
    if (tab) {
      tab.hidden = false;
      var c = el('wdFaqCount');
      if (c) c.textContent = ' (' + faqRows.length + ')';
    }
  }

  // ── ④ 하단 고정 바 ─────────────────────────────────────────
  //
  // 상세 정보 영역까지 내려오면 오른쪽 패널의 신청 버튼은 화면 밖으로 나간다.
  // 거기서부터 화면 아래에 같은 버튼을 붙인다. 상품명을 왼쪽에 함께 적는 이유는
  // 한참 내려온 뒤에는 지금 보고 있는 게 어느 상품인지 흐려지기 때문이다.
  // (에어컨 js/products/product-detail.js 의 pdMountBottomBar 와 같은 구조)
  //
  // ★ 화면 아래를 나눠 쓰는 것이 셋이다 — 비교 트레이 / 이 바 / 카카오 플로팅.
  //   각자 bottom:0 을 잡으면 겹친다. 앞엣것의 높이를 재서 뒤엣것을 밀어 올린다.
  //   트레이는 열고 닫히므로 그때마다 다시 잰다(dp-compare-change).

  // 버튼 알맹이는 화면 위쪽 .wd-actions 와 같은 함수를 부른다.
  // 여기서 새 함수를 만들면 접수되는 값(약정·주기·색)이 둘로 갈라진다.
  //
  // 문구는 에어컨 하단바(product-detail.js:329,335)와 같은 말을 쓴다 (2026-08-05).
  //   '신청하기' → '상품 신청', '카카오 상담' → '카카오톡 문의'
  //   두 화면이 나란히 놓이는 자리라 말이 다르면 다른 기능처럼 읽힌다.
  //
  // ⚠ 간편 신청에 sapply-inline 을 붙이지 않는다 (2026-08-05).
  //   그 클래스는 simple-apply.js 가 런타임에 <head> 로 밀어 넣는데, 우리 CSS 보다
  //   뒤에 실려서 같은 특이도면 그쪽이 이긴다. 그래서 이 버튼만
  //   padding 18px 34px / font 16px / margin-top 28px / flex 0 0 auto 로 덮여
  //   혼자 커지고 14px 내려앉고 모바일 균등분할까지 깨졌다.
  //   에어컨은 이 클래스를 안 붙인다(product-detail.js:333). 색은 .wd-bb-btn--simple 에 직접 적는다.
  function barButtonsHtml() {
    return (
      '<button type="button" class="wd-bb-btn wd-bb-btn--apply" onclick="wdApply()">상품 신청</button>' +
      '<button type="button" class="wd-bb-btn wd-bb-btn--simple"' +
      ' data-track="simple_apply_open" onclick="openSimpleApply()">' +
      '<span class="sapply-tip">3초만에 간편신청하기</span>간편 신청</button>' +
      '<button type="button" class="wd-bb-btn wd-bb-btn--kakao" onclick="wdKakao()">카카오톡 문의</button>'
    );
  }

  function syncFloats() {
    var bar = el('wdBottombar');
    var kakao = document.querySelector('.kakao-float');

    var barH = bar && !bar.hidden ? bar.offsetHeight : 0;
    if (bar) bar.style.bottom = '0px';

    // 카카오의 원래 자리는 화면 크기마다 다르다 — common.css 에서 PC 28px / 모바일 80px.
    // 여기서 28 로 고정하면 모바일에서 카카오가 원래보다 아래로 내려간다.
    var base = window.innerWidth <= 900 ? 80 : 28;
    if (kakao) kakao.style.bottom = barH + base + 'px';

    // 비교함 칩이 카카오를 따라 올라가야 한다. compare-view 가 다시 재도록 알린다.
    if (window.dpCompareView && window.dpCompareView.placeChip) window.dpCompareView.placeChip();
  }

  function mountBottomBar() {
    if (el('wdBottombar')) return;
    var sec = document.querySelector('.wd-detail-section');
    if (!sec) return;

    var nameEl = el('wdName');
    var name = nameEl ? nameEl.textContent.trim() : '';

    var bar = document.createElement('div');
    bar.className = 'wd-bottombar';
    bar.id = 'wdBottombar';
    bar.hidden = true;
    bar.innerHTML =
      '<div class="wd-bb-inner">' +
      // 맨 위로 — 화면 오른쪽은 카카오와 비교함이 쓰고 있어 이 바 안에 둔다.
      '<button type="button" class="wd-bb-top" data-top aria-label="맨 위로">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"' +
      ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' +
      '<span class="wd-bb-top-txt">맨 위로</span>' +
      '</button>' +
      '<div class="wd-bb-name" id="wdBbName">' + esc(name) + '</div>' +
      '<div class="wd-bb-btns">' + barButtonsHtml() + '</div>' +
      '</div>';
    document.body.appendChild(bar);

    var topBtn = bar.querySelector('[data-top]');
    if (topBtn) {
      topBtn.onclick = function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }

    // 상세 영역이 화면에 걸치면 켠다. 조금만 걸쳐도 켜야 한다 —
    // 다 들어와야 켜지면 긴 상세에서는 영영 안 나온다.
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          bar.hidden = !e.isIntersecting;
          syncFloats();
        });
      }).observe(sec);
    } else {
      bar.hidden = false;
    }

    syncFloats();
    window.addEventListener('resize', syncFloats);
    window.addEventListener('dp-compare-change', function () {
      setTimeout(syncFloats, 60); // 트레이가 다시 그려진 뒤에 잰다
    });
  }

  // 상품명은 water-detail.js 가 API 를 받은 뒤에 채운다.
  // 이 파일이 먼저 돌기 때문에 지금 읽으면 빈 문자열이다.
  // #wdName 이 채워지는 것을 지켜보다가 그때 바를 만든다.
  function waitForProduct() {
    var nameEl = el('wdName');
    // 상품명 칸이 아예 없어도 후기는 떠야 한다 — 바만 못 만들 뿐이다.
    if (!nameEl) { startReviews(); return; }
    if (nameEl.textContent.trim()) {
      mountBottomBar();
      startReviews();
      return;
    }
    var mo = new MutationObserver(function () {
      if (!nameEl.textContent.trim()) return;
      mo.disconnect();
      mountBottomBar();
      startReviews();
    });
    mo.observe(nameEl, { childList: true, characterData: true, subtree: true });
    // 상품을 못 받는 경우(에러 화면)에도 관찰자가 영영 남지 않게 한 번은 끊는다.
    setTimeout(function () {
      mo.disconnect();
      // 상품을 못 받아 바가 안 뜨는 경우에도 후기는 띄운다(브랜드 없이 전체 기준).
      startReviews();
    }, 15000);
  }

  // ── ⑤ 후기 (2026-08-05) ─────────────────────────────────────
  //
  // 왜 여기서 부르나
  //   water-detail.js 는 예전에 initReviews(상품id) 를 바로 불렀다. 그 경로는
  //   /api/products/{id}/reviews 인데 정수기 상품은 products 표에 없고,
  //   관리자가 넣은 정수기 후기는 product_id 가 비어 있다. 그래서 늘 0건이었다.
  //   정수기 후기는 reviews.sub_category_id(= 브랜드 자식 카테고리)로만 찾을 수 있다.
  //
  // 브랜드 이름 → 카테고리 UUID
  //   화면이 아는 것은 'coway' 같은 문자열 키뿐이고(water.js BRAND_META),
  //   API 가 원하는 것은 UUID 다. 그래서 /api/categories 에서 WATER 의 자식 중
  //   이름이 같은 것을 찾아 UUID 를 얻는다. 후기 목록 페이지(reviews.js)와 같은 방법이다.
  //   ⚠ UUID 를 코드에 박지 않는 이유는 FAQ 와 같다 — 로컬과 운영의 값이 다르다.
  //   못 찾으면 브랜드 없이 category=WATER 로 간다. 빈 화면보다 낫다.
  function brandCategoryName() {
    var key = typeof WD_BRAND_KEY !== 'undefined' ? WD_BRAND_KEY : null;
    if (!key) return null;
    var meta = (typeof BRAND_META !== 'undefined' && BRAND_META[key]) || null;
    return (meta && meta.name) || null;
  }

  function findBrandSubCategoryId(cats, brandName) {
    if (!brandName) return null;
    var rows = Array.isArray(cats) ? cats : (cats && cats.data) || [];
    var water = rows.filter(function (c) {
      return c && String(c.type || '').toUpperCase() === 'WATER';
    })[0];
    var kids = (water && water.children) || [];
    var hit = kids.filter(function (c) {
      return c && String(c.name || '').trim() === brandName;
    })[0];
    return hit ? hit.id : null;
  }

  // 이 상품의 브랜드 자식 카테고리 id. 후기 조회와 간편신청 두 곳이 함께 쓴다.
  var brandCategoryId = null;
  var reviewsStarted = false;

  function startReviews() {
    if (reviewsStarted) return;   // 관찰자와 즉시경로가 겹쳐 두 번 부르지 않게
    reviewsStarted = true;
    if (typeof initReviews !== 'function') return;

    var productId = (typeof WD_PRODUCT !== 'undefined' && WD_PRODUCT && WD_PRODUCT.id) || null;
    var brandName = brandCategoryName();

    function go(subId) {
      brandCategoryId = subId || null;
      // 추천 상품도 브랜드가 정해진 뒤라야 고를 수 있다. 같은 시점에 붙인다.
      setTimeout(mountReco, 0);
      if (!subId && brandName) {
        console.warn('[water-detail-more] 브랜드 "' + brandName +
          '" 에 맞는 하위 카테고리를 못 찾았다. 정수기 전체 후기로 간다.');
      }
      initReviews(productId, { category: 'WATER', subCategoryId: subId });
    }

    if (typeof api === 'undefined' || !api.get || !brandName) { go(null); return; }
    api
      .get('/api/categories')
      .then(function (cats) { go(findBrandSubCategoryId(cats, brandName)); })
      .catch(function (e) {
        console.warn('[water-detail-more] 카테고리 로드 실패', e && e.message);
        go(null);
      });
  }

  // ── ⑥ 간편신청에 브랜드 자동으로 싣기 (2026-08-05) ──────────
  //
  // 정수기 화면의 간편신청 버튼들은 openSimpleApply() 를 인자 없이 부른다.
  // 그러면 접수에 categoryId 도 상품명도 안 실린다. 그 뒤가 문제다 —
  // 후기 작성 링크(ReviewInviteService)는 접수의 categoryId 로 분류를 정하는데,
  // 비어 있으면 최상위 '정수기' 로만 묶여서 코웨이 상세에 후기가 안 뜬다.
  // 고객에게 브랜드를 다시 묻는 대신, 신청하는 순간 자동으로 실어 보낸다.
  //
  // ⚠ 버튼이 두 곳이다 — 위 .wd-actions 와 이 파일이 만든 하단 바.
  //   호출부마다 인자를 넣으면 한쪽만 고쳐지는 사고가 난다. 그래서 함수를 한 번만 감싼다.
  //   이미 인자를 넣어 부르는 쪽이 생기면 그 값을 그대로 존중한다(덮어쓰지 않는다).
  function wrapSimpleApply() {
    if (typeof window.openSimpleApply !== 'function') return;
    if (window.__wdSimpleApplyWrapped) return;
    window.__wdSimpleApplyWrapped = true;

    var orig = window.openSimpleApply;
    window.openSimpleApply = function (catApi, productName, catLabel, opts) {
      var o = opts || {};
      // brandCategoryId 는 카테고리 조회가 끝난 뒤 채워진다. 호출 시점에 읽는다.
      if (!o.categoryId && brandCategoryId) {
        o = { categoryId: brandCategoryId, productId: o.productId || null };
      }
      var nameEl = el('wdName');
      var name = productName || (nameEl ? nameEl.textContent.trim() : '');

      // 상품 사진도 함께 싣는다 (2026-08-06).
      // 후기 작성 링크 화면은 상품 사진을 products 표에서 가져오는데, 정수기 상품은
      // water_products 라는 다른 표에 있어 서버가 찾을 방법이 없다. 접수 때 적어 둔다.
      if (!o.productImageUrl) {
        var img =
          (typeof WD_PRODUCT !== 'undefined' && WD_PRODUCT && WD_PRODUCT.image) ||
          (function () {
            var m = document.querySelector('#wdMainImg, .wd-main-img img, .wd-gallery img');
            return m ? m.currentSrc || m.src : '';
          })();
        if (img) o.productImageUrl = img;
      }

      return orig(catApi || 'water', name, catLabel || '정수기', o);
    };
  }

  // ── ⑦ 다픽이 추천하는 다른 상품 (2026-08-06 추가) ────────────
  //
  // ★ water-detail.html 을 한 줄도 안 고친다.
  //   섹션 마크업과 탭도 여기서 만든다. 되돌리려면 이 파일의 <script> 한 줄만 지우면
  //   원래대로 돌아온다 — 이 파일의 원래 약속(파일 맨 위 주석)을 그대로 지킨다.
  //
  // ★ 카드는 공용 product-reco.js 가 그린다.
  //   에어컨 상세(product-detail)와 카드 모양이 갈리면 같은 사이트로 안 읽힌다.
  //   그 파일이 아직 안 실려 있으면 여기서 불러온다.
  //
  // ★ 요금은 안 적는다.
  //   정수기는 약정·관리주기에 따라 월 요금이 달라진다. 목록에서 아무 값이나 골라
  //   적으면 상세로 들어갔을 때 숫자가 달라져 '왜 다르지' 가 된다.
  var RECO_LIMIT = 10;

  function ensureRecoScript() {
    if (typeof window.dpProductReco !== 'undefined') return Promise.resolve(true);
    return new Promise(function (resolve) {
      var sc = document.createElement('script');
      sc.src = 'js/common/product-reco.js?v=20260806e';
      sc.onload = function () { resolve(typeof window.dpProductReco !== 'undefined'); };
      sc.onerror = function () {
        console.warn('[water-detail-more] product-reco.js 로드 실패 — 추천 섹션을 건너뛴다');
        resolve(false);
      };
      document.head.appendChild(sc);
    });
  }

  // 리뷰 섹션 '앞'에 끼운다. 순서는 에어컨 상세와 같게 맞춘다:
  //   제품사양 → 상품 상세 → 추천 상품 → 리뷰 → 자주 묻는 질문
  function ensureRecoSection() {
    var exist = el('wdSecReco');
    if (exist) return exist;

    var review = el('wdSecReview');
    if (!review || !review.parentNode) return null;

    var sec = document.createElement('section');
    sec.className = 'wd-sec';
    sec.id = 'wdSecReco';
    sec.hidden = true;   // 상품이 0건이면 끝까지 숨긴 채로 둔다
    sec.innerHTML =
      '<h2 class="wd-sec-title">다픽이 추천하는 다른 상품</h2>' +
      '<div id="wdRecoBody"></div>';
    review.parentNode.insertBefore(sec, review);

    // 목차에도 한 줄 넣는다. 리뷰 탭 앞이라야 섹션 순서와 목차 순서가 같아진다.
    var bar = el('wdTabbar');
    var reviewTab = bar && bar.querySelector('.wd-tab[data-tab="review"]');
    if (bar && reviewTab && !bar.querySelector('.wd-tab[data-tab="reco"]')) {
      var tab = document.createElement('div');
      tab.className = 'wd-tab';
      tab.id = 'wdTabReco';
      tab.setAttribute('data-tab', 'reco');
      tab.textContent = '추천 상품';
      tab.hidden = true;
      bar.insertBefore(tab, reviewTab);
    }
    return sec;
  }

  function mountReco() {
    // 브랜드를 알아야 '같은 브랜드의 다른 상품'을 고를 수 있다.
    // brandCategoryId 는 startReviews 가 카테고리를 받은 뒤 채운다.
    var sec = ensureRecoSection();
    if (!sec) return;

    var box = el('wdRecoBody');
    var myId = (typeof WD_PRODUCT !== 'undefined' && WD_PRODUCT && WD_PRODUCT.id) || null;

    ensureRecoScript().then(function (ok) {
      if (!ok) return;
      window.dpProductReco.mount(box, {
        source: '/api/water-products',
        // 같은 브랜드만. 브랜드를 못 찾았으면 정수기 전체에서 고른다 — 빈 칸보다 낫다.
        match: function (p) {
          if (!brandCategoryId) return true;
          return String(p.categoryId || '') === String(brandCategoryId);
        },
        excludeId: myId,
        limit: RECO_LIMIT,
        showFee: false,
        hrefOf: function (p) {
          return '/water-detail?id=' + encodeURIComponent(p.id);
        },
        onDone: function (n) {
          sec.hidden = !n;
          var tab = el('wdTabReco');
          if (tab) tab.hidden = !n;
        },
      });
    });
  }

  function init() {
    wrapSimpleApply();
    bindTabScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    loadFaq();
    waitForProduct();
    // 첫 진입에서 어느 탭에 불이 들어와야 하는지 한 번 계산한다.
    setTimeout(spy, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
