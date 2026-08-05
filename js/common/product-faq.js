// ════════════════════════════════════════════════════════════════════
// product-faq.js — 카테고리 상세 화면의 '자주 묻는 질문' 공용 모듈 (2026-08-05 신설)
//
// 왜 만들었나
//   08-04 에 정수기 상세(water-detail-more.js)에만 FAQ 를 붙였다. 인터넷·카드에도
//   같은 게 필요해졌는데, 거기서 복사하면 같은 코드가 세 벌이 된다.
//   rich-render.js 를 만든 이유(Delta→HTML 이 네 벌이었다)와 같은 상황이라
//   이번에는 처음부터 공용으로 뺀다.
//
// 쓰는 법 — 화면에 빈 칸 하나와 <script> 한 줄이면 끝이다.
//   <div class="dpfaq" data-faq-slug="internet" data-faq-name="인터넷"></div>
//   <script src="js/common/product-faq.js"></script>
//
//   data-faq-slug  카테고리 slug (V20260730002 로 생긴 칸). 가장 믿을 만하다.
//   data-faq-name  이름. slug 로 못 찾았을 때 쓴다.
//   data-faq-title 제목 글자 (기본 '자주 묻는 질문')
//   data-faq-count 이 id 를 가진 요소에 '(3)' 같은 개수를 넣어준다 (선택)
//
//   새 카테고리가 생겨도 이 파일은 안 고친다. 그 화면에 칸 하나만 두면 된다.
//
// ★ 왜 카테고리 id 를 코드에 안 박나
//   로컬 DB 와 운영 DB 의 UUID 가 다르다. 박아 두면 한쪽에서만 FAQ 가 안 나오고,
//   오류도 안 나서 원인을 찾는 데 한참 걸린다.
//
// ★ 질문이 0건이면 칸을 통째로 숨긴다
//   빈 제목만 남으면 고장으로 읽힌다.
//
// 의존(있으면 쓰고 없으면 알아서 내려간다)
//   api.js        필수 — 없으면 아무것도 안 한다
//   rich-render.js 선택 — 있으면 서식 있는 답변을 그대로 그린다. 없으면 평문으로.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SEL = '[data-faq-slug],[data-faq-name]';
  var _catsPromise = null;   // /api/categories 는 화면당 한 번만 부른다
  var _styled = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── 카테고리 찾기 ────────────────────────────────────────────────
  //
  // ⚠ 이름 부분일치 하나만 쓰면 안 된다.
  //   관리자가 '인터넷결합' 같은 카테고리를 하나 더 만드는 순간, 목록 정렬 순서에 따라
  //   엉뚱한 FAQ 가 붙고 아무 오류도 안 난다 — 조용히 틀린다.
  //   (2026-08-01 에 주소에 'water' 글자가 든 카테고리를 만들었더니 문의가 전부
  //    정수기로 접수된 것과 같은 계열의 함정이다.)
  //   그래서 좁은 것부터 본다: slug 정확 → 이름 정확 → 이름 부분일치(가장 짧은 이름).
  function findCategoryId(cats, slug, name) {
    var rows = (Array.isArray(cats) ? cats : (cats && cats.data) || []).filter(Boolean);

    if (slug) {
      var bySlug = rows.filter(function (c) {
        return String(c.slug || '').toLowerCase() === String(slug).toLowerCase();
      })[0];
      if (bySlug) return bySlug.id;
    }
    if (!name) return null;

    var exact = rows.filter(function (c) {
      return String(c.name || '').trim() === String(name).trim();
    })[0];
    if (exact) return exact.id;

    var loose = rows
      .filter(function (c) {
        return String(c.name || '').indexOf(name) >= 0;
      })
      .sort(function (a, b) {
        return String(a.name).length - String(b.name).length;
      });

    if (loose.length > 1) {
      // 조용히 틀리지 않도록 남긴다. 이게 찍히면 카테고리 이름을 정리해야 한다.
      console.warn(
        '[product-faq] 이름에 "' + name + '" 이 든 카테고리가 ' + loose.length +
          '개다. 가장 짧은 "' + loose[0].name + '" 을 골랐다.',
        loose.map(function (c) { return c.name; }),
      );
    }
    return loose[0] ? loose[0].id : null;
  }

  function loadCategories() {
    if (_catsPromise) return _catsPromise;
    _catsPromise = api.get('/api/categories');
    return _catsPromise;
  }

  // ── 그리기 ───────────────────────────────────────────────────────
  function answerHtml(f) {
    if (typeof dpRichHtml === 'function' && f.detailContent) {
      var html = dpRichHtml(f.detailContent);
      if (html) return '<div class="ql-snow"><div class="ql-editor dpfaq-ql">' + html + '</div></div>';
    }
    // rich-render.js 가 없거나 본문이 비었을 때. answer 같은 평문 칸이 있으면 살려 쓴다.
    var plain = f.answer || f.content || '';
    if (plain) return '<div class="dpfaq-plain">' + esc(plain) + '</div>';
    return '<span class="dpfaq-none">답변이 준비 중입니다.</span>';
  }

  function itemHtml(f) {
    return (
      '<div class="dpfaq-item">' +
      '<button type="button" class="dpfaq-q">' +
      '<span>Q. ' + esc(f.question) + '</span>' +
      '<svg class="dpfaq-ico" viewBox="0 0 24 24" width="16" height="16" fill="none"' +
      ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 9l6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="dpfaq-a"><div class="dpfaq-a-inner">' + answerHtml(f) + '</div></div>' +
      '</div>'
    );
  }

  function render(box, rows) {
    if (!rows.length) {
      box.hidden = true;
      return;
    }
    injectStyles();
    box.hidden = false;
    box.classList.add('dpfaq-box');
    box.innerHTML =
      '<h2 class="dpfaq-title">' + esc(box.getAttribute('data-faq-title') || '자주 묻는 질문') + '</h2>' +
      '<div class="dpfaq-list">' + rows.map(itemHtml).join('') + '</div>';

    // 여닫기는 위임으로 붙인다. 전역 toggleFaq 를 쓰면 그 함수가 없는 화면에서 조용히 죽는다.
    box.addEventListener('click', function (e) {
      var q = e.target.closest && e.target.closest('.dpfaq-q');
      if (!q || !box.contains(q)) return;
      q.parentNode.classList.toggle('is-open');
    });

    var countId = box.getAttribute('data-faq-count');
    if (countId) {
      var el = document.getElementById(countId);
      if (el) el.textContent = ' (' + rows.length + ')';
    }
  }

  // ── 스타일 ───────────────────────────────────────────────────────
  // 화면마다 CSS 파일을 고치게 하면 새 카테고리를 붙일 때마다 두 곳을 손대야 한다.
  // internet-reviews.js 와 같은 방식으로 이 파일이 직접 넣는다.
  function injectStyles() {
    if (_styled) return;
    _styled = true;
    var css =
      '.dpfaq-box{max-width:1100px;margin:8px auto 40px;padding:0 16px;font-family:"Noto Sans KR",sans-serif;}' +
      '.dpfaq-box[hidden]{display:none;}' +
      '.dpfaq-title{font-size:17px;font-weight:800;color:#1e1b2e;margin:0 0 14px;}' +
      '.dpfaq-list{border-top:1px solid #eeecf5;}' +
      '.dpfaq-item{border-bottom:1px solid #eeecf5;}' +
      // button 으로 만든 이유 - 키보드 탭으로 접근되고 엔터로 열린다.
      '.dpfaq-q{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;' +
        'padding:16px 4px;border:none;background:none;text-align:left;cursor:pointer;' +
        'font-family:inherit;font-size:14.5px;font-weight:700;color:#221f38;line-height:1.5;}' +
      '.dpfaq-q:hover{color:#5b3fbe;}' +
      '.dpfaq-ico{flex-shrink:0;color:#a09dba;transition:transform .18s;}' +
      '.dpfaq-item.is-open .dpfaq-ico{transform:rotate(180deg);}' +
      // 높이 애니메이션 대신 grid 로 접는다 - 내용 높이를 미리 재지 않아도 된다.
      '.dpfaq-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .22s ease;}' +
      '.dpfaq-item.is-open .dpfaq-a{grid-template-rows:1fr;}' +
      '.dpfaq-a-inner{overflow:hidden;}' +
      '.dpfaq-item.is-open .dpfaq-a-inner{padding:0 4px 18px;}' +
      '.dpfaq-plain{font-size:14px;line-height:1.7;color:#4a4762;white-space:pre-wrap;word-break:break-word;}' +
      '.dpfaq-none{font-size:14px;color:#a09dba;}' +
      '.dpfaq-ql{padding:0;font-size:14px;line-height:1.7;color:#4a4762;}' +
      '.dpfaq-ql img{max-width:100%;height:auto;border-radius:10px;}' +
      '@media(max-width:600px){.dpfaq-q{font-size:13.5px;padding:14px 2px;}}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── 진입 ─────────────────────────────────────────────────────────
  function mount(box) {
    if (box.dataset.faqMounted) return;
    box.dataset.faqMounted = '1';
    box.hidden = true;   // 받아오기 전에는 빈 칸이 보이지 않게

    var slug = box.getAttribute('data-faq-slug');
    var name = box.getAttribute('data-faq-name');

    loadCategories()
      .then(function (cats) {
        var id = findCategoryId(cats, slug, name);
        if (!id) {
          console.warn('[product-faq] 카테고리를 못 찾았다. slug=' + slug + ', name=' + name);
          return null;
        }
        return api.get('/api/faqs?categoryId=' + encodeURIComponent(id));
      })
      .then(function (list) {
        var rows = (Array.isArray(list) ? list : (list && (list.data || list.content)) || [])
          .filter(function (f) { return f && f.question; });
        render(box, rows);
      })
      .catch(function (e) {
        // FAQ 때문에 상품 화면이 죽으면 안 된다. 칸만 조용히 접는다.
        console.warn('[product-faq] 로드 실패', e && e.message);
        box.hidden = true;
      });
  }

  function init() {
    if (typeof api === 'undefined' || !api.get) return;
    document.querySelectorAll(SEL).forEach(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 화면이 나중에 칸을 만들어 붙이는 경우(탭 전환 등)를 위해 열어 둔다.
  window.dpProductFaq = { mount: mount, init: init };
})();
