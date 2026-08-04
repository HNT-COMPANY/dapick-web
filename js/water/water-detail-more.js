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
  function findWaterCategoryId(list) {
    var rows = Array.isArray(list) ? list : (list && list.data) || [];
    var hit = rows.filter(function (c) {
      return c && String(c.name || '').indexOf('정수기') >= 0;
    })[0];
    return hit ? hit.id : null;
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

  function init() {
    bindTabScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    loadFaq();
    // 첫 진입에서 어느 탭에 불이 들어와야 하는지 한 번 계산한다.
    setTimeout(spy, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
