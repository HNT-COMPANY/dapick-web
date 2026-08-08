// ════════════════════════════════════════════════════
// internet-reviews.js — 인터넷·TV 통합 페이지 하단 '실제 후기' 티저
//   · GET /api/reviews?category=INTERNET_TV — 인터넷TV 후기만 최신 2건, 2열 세로 카드.
//   · '더보기' → /reviews?category=INTERNET_TV (후기 목록 인터넷TV 탭으로 이동).
//   · carrier 와 무관(인터넷TV 전체)하므로 페이지당 1회만 렌더.
//   의존: api.js(api.get), #ipReviews 컨테이너.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  // 3 으로 올림 (2026-08-05). 가로 3칸 그리드와 같은 수여야 마지막 줄이 안 빈다.
  //
  // ⚠ 화면이 data-count 로 덮어쓸 수 있다 (2026-08-08).
  //   인터넷 목록 화면은 후기와 자주 묻는 질문을 좌우 반씩 나눠 쓰는데,
  //   그 반칸에는 한 줄에 두 칸까지만 들어간다. 3장을 주면 2+1 로 쌓여
  //   화면이 길어진다 — 칸 수와 후기 수가 어긋나면 늘 이렇게 된다.
  var TEASER_COUNT = 3;

  function teaserCount(box) {
    var n = Number(box && box.getAttribute('data-count'));
    return (n >= 1 && n <= 12) ? n : TEASER_COUNT;
  }
  var _rendered = false;

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clampRating(v) {
    v = Math.round(Number(v) || 0);
    return v < 0 ? 0 : v > 5 ? 5 : v;
  }

  function fmtDate(raw) {
    if (!raw) return '';
    var s = String(raw);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '.' + m[2] + '.' + m[3] : '';
  }

  // 후기 상세 URL — reviews.js rvReviewUrl 과 동일 규칙(로컬 직접 / 프로덕션 slug).
  function slug(title) {
    if (!title) return 'review';
    var s = String(title).trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return s || 'review';
  }
  function reviewUrl(r) {
    var host = window.location.hostname;
    var isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local');
    if (isLocal) return '/review-detail.html?id=' + r.id;
    return '/reviews/' + slug(r.title) + '-' + r.id;
  }

  var LOGO = '/assets/logos/dapicklogo.png';

  function cardHtml(r) {
    var rating = clampRating(r.rating);
    var stars = '<span class="ivr-stars">' + '★'.repeat(rating) +
      '<span class="ivr-stars-off">' + '★'.repeat(5 - rating) + '</span></span>';
    var imgs = Array.isArray(r.imageUrls) && r.imageUrls.length ? r.imageUrls : (r.imageUrl ? [r.imageUrl] : []);
    var thumb = imgs.length
      ? '<div class="ivr-thumb"><img src="' + esc(imgs[0]) + '" alt="" loading="lazy"></div>'
      : '<div class="ivr-thumb ivr-thumb--logo"><img src="' + LOGO + '" alt="다픽" loading="lazy"></div>';
    var title = r.title ? '<p class="ivr-title">' + esc(r.title) + '</p>' : '';
    var content = r.content ? '<p class="ivr-content">' + esc(r.content) + '</p>' : '';
    return '<a class="ivr-card" href="' + esc(reviewUrl(r)) + '">' +
      thumb +
      '<div class="ivr-body">' +
        stars + title + content +
        '<div class="ivr-meta">' +
          '<span class="ivr-product">' + esc(r.productName || '인터넷·TV') + '</span>' +
          '<span class="ivr-author">' + esc(r.authorName || '익명') + '</span>' +
          '<span class="ivr-date">' + fmtDate(r.createdAt) + '</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var css =
      // 3칸이 되면서 폭을 넓혔다 (2026-08-05).
      // 760px 그대로 두면 카드 하나가 240px 밑으로 내려가 제목·본문이 다 눌린다.
      '.ivr-box{max-width:1100px;margin:8px auto 150px;padding:0 16px;font-family:"Noto Sans KR",sans-serif;}' +
      '.ivr-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 14px;}' +
      '.ivr-htitle{font-size:17px;font-weight:800;color:#1e1b2e;}' +
      '.ivr-htitle small{display:block;font-size:12px;font-weight:500;color:#8a8fa3;margin-top:3px;}' +
      '.ivr-more-link{flex-shrink:0;font-size:13px;font-weight:700;color:#5b3fbe;text-decoration:none;}' +
      '.ivr-more-link:hover{text-decoration:underline;}' +
      // 가로 3칸 (2026-08-05). 카드가 좁아지면 제목이 두 줄로 넘어가므로 단계적으로 줄인다.
      '.ivr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}' +
      '@media(max-width:900px){.ivr-grid{grid-template-columns:1fr 1fr;}}' +
      '@media(max-width:520px){.ivr-grid{grid-template-columns:1fr;}}' +
      '.ivr-card{display:flex;flex-direction:column;background:#fff;border:1px solid #eee;border-radius:16px;overflow:hidden;' +
        'box-shadow:0 1px 8px rgba(24,23,43,.05);text-decoration:none;color:inherit;transition:box-shadow .15s,transform .15s;}' +
      '.ivr-card:hover{box-shadow:0 6px 20px rgba(24,23,43,.12);transform:translateY(-2px);}' +
      '.ivr-thumb{width:100%;aspect-ratio:16/10;background:#f4f6fb;overflow:hidden;display:flex;align-items:center;justify-content:center;}' +
      '.ivr-thumb img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.ivr-thumb--logo img{width:auto;height:52px;object-fit:contain;opacity:.85;}' +
      '.ivr-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:7px;}' +
      '.ivr-stars{color:#ffb020;font-size:14px;letter-spacing:1px;}' +
      '.ivr-stars-off{color:#e3e3ea;}' +
      '.ivr-title{font-size:15px;font-weight:800;color:#18172b;margin:0;line-height:1.35;' +
        'display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.ivr-content{font-size:13.5px;color:#5a5a68;margin:0;line-height:1.6;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      '.ivr-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px;font-size:11.5px;color:#9aa0b4;}' +
      '.ivr-product{font-weight:700;color:#5b3fbe;}' +
      '.ivr-empty{color:#b0aac2;font-size:14px;padding:10px 0;}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  async function render() {
    if (_rendered) return;
    var box = document.getElementById('ipReviews');
    if (!box || typeof api === 'undefined' || !api.get) return;
    _rendered = true;
    try {
      var data = await api.get('/api/reviews?category=INTERNET_TV&page=0&size=8');
      var list = ((data && data.content) || []).filter(function (r) { return r && !r.hidden; })
        .slice(0, teaserCount(box));
      if (!list.length) { box.style.display = 'none'; return; }
      injectStyles();
      // ⚠ 통째로 갈아끼우지 않는다. 화면이 붙여 둔 다른 클래스가 날아간다.
      box.classList.add('ivr-box');
      box.style.display = '';
      box.innerHTML =
        '<div class="ivr-head">' +
          '<div class="ivr-htitle">인터넷·TV 사용자의 후기<small>다픽에 실제로 올라온 인터넷·TV 후기입니다.</small></div>' +
          '<a class="ivr-more-link" href="/reviews?category=INTERNET_TV">더보기 ›</a>' +
        '</div>' +
        '<div class="ivr-grid">' + list.map(cardHtml).join('') + '</div>';
    } catch (e) {
      // 후기 로드 실패는 페이지 핵심 기능이 아니므로 조용히 숨김
      box.style.display = 'none';
      if (window.console && console.warn) console.warn('[ItvReviews] 후기 로드 실패:', e);
    }
  }

  function ready(cb) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
    else cb();
  }
  ready(render);

  window.ItvReviews = { render: render };
})();
