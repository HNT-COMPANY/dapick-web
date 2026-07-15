// ════════════════════════════════════════════════════
// review-detail.js — 후기 상세 (독립 페이지, 모달 아님)
// URL: /reviews/{제목슬러그}-{id} (Worker) 또는 /review-detail?id={id} (로컬/폴백)
// GET /api/reviews/{id} → 제목/브레드크럼/작성자/시각 + Quill Delta 본문 렌더.
// OG/타이틀은 Worker 가 서버에서 주입하지만, 브라우저용으로 클라도 보정.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  const CAT_LABEL = {
    WATER: '정수기',
    RENTAL: '가전렌탈',
    INTERNET_TV: '인터넷·TV',
  };
  const CTA_HREF = { WATER: '/water', RENTAL: '/rental', INTERNET_TV: '/internet' };

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    );
  }

  function parseId() {
    const q = new URLSearchParams(location.search).get('id');
    if (q && /^\d+$/.test(q)) return q;
    const m = location.pathname.match(/-(\d+)\/?$/); // /reviews/{slug}-{id}
    return m ? m[1] : null;
  }

  function fmtDateTime(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(
      d.getHours(),
    )}:${p(d.getMinutes())}`;
  }

  function starsHtml(rating) {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return (
      '<span class="rd-stars">' +
      '★'.repeat(n) +
      '<span class="rd-stars-off">' +
      '★'.repeat(5 - n) +
      '</span></span>'
    );
  }

  function deltaToHtml(ops) {
    if (typeof Quill === 'undefined' || !Array.isArray(ops)) return '';
    const tmp = document.createElement('div');
    const q = new Quill(tmp, { modules: { toolbar: false }, readOnly: true });
    q.setContents({ ops: ops });
    return q.root.innerHTML;
  }

  function setMeta(review) {
    const title = (review.title || '다픽 후기') + ' | 다픽 후기';
    document.title = title;
    const desc = (review.content || '다픽 실사용 후기')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150);
    const setAttr = (sel, attr, val) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };
    setAttr('meta[name="description"]', 'content', desc);
    setAttr('meta[property="og:title"]', 'content', title);
    setAttr('meta[property="og:description"]', 'content', desc);
    if (review.imageUrl) setAttr('meta[property="og:image"]', 'content', review.imageUrl);
    setAttr('meta[property="og:url"]', 'content', location.origin + location.pathname);
    setAttr('link[rel="canonical"]', 'href', location.origin + location.pathname);
  }

  function render(review) {
    const cat = CAT_LABEL[review.category] || '후기';
    const bodyHtml =
      Array.isArray(review.contentBlocks) && review.contentBlocks.length
        ? '<div class="ql-snow"><div class="ql-editor rd-ql">' +
          deltaToHtml(review.contentBlocks) +
          '</div></div>'
        : '<p class="rd-content">' + esc(review.content || '') + '</p>';
    const ctaHref = CTA_HREF[review.category] || '/internet';

    document.getElementById('rdArticle').innerHTML =
      '<div class="rd-crumb"><a href="/reviews">후기</a> › ' +
      esc(cat) +
      '</div>' +
      '<h1 class="rd-title">' +
      esc(review.title || '후기') +
      '</h1>' +
      '<div class="rd-meta">' +
      '<span class="rd-author">' +
      esc(review.authorName || '익명') +
      '</span>' +
      (review.productName
        ? '<span class="rd-dot">·</span><span>' + esc(review.productName) + '</span>'
        : '') +
      '<span class="rd-date">' +
      fmtDateTime(review.createdAt) +
      '</span></div>' +
      '<div class="rd-ratingrow">' +
      starsHtml(review.rating) +
      '</div>' +
      '<div class="rd-body">' +
      bodyHtml +
      '</div>' +
      '<a class="rd-list" href="/reviews">목록으로</a>';

    document.getElementById('rdArticle').hidden = false;
    const load = document.getElementById('rdLoading');
    if (load) load.remove();
    setMeta(review);
  }

  function renderError(msg) {
    const load = document.getElementById('rdLoading');
    if (load) load.textContent = msg || '후기를 불러오지 못했습니다.';
  }

  function injectStyles() {
    const css =
      ".rd-wrap{max-width:820px;margin:24px auto 60px;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.rd-loading{padding:80px 0;text-align:center;color:#9a9aa5;}' +
      '.rd-crumb{font-size:13px;color:#8a8a99;margin-bottom:12px;}' +
      '.rd-crumb a{color:#8a8a99;text-decoration:none;}' +
      '.rd-title{font-size:26px;font-weight:800;line-height:1.35;margin:0 0 14px;color:#1e1b2e;}' +
      '.rd-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:#8a8a99;margin-bottom:6px;}' +
      '.rd-author{font-weight:700;color:#5b3fbe;}' +
      '.rd-date{margin-left:auto;}' +
      '.rd-ratingrow{margin-bottom:18px;}' +
      '.rd-stars{font-size:18px;letter-spacing:2px;color:#ffb400;}' +
      '.rd-stars-off{color:#dcd7e8;}' +
      '.rd-body{border-top:1px solid #eee;padding-top:22px;margin-bottom:28px;font-size:16px;line-height:1.8;}' +
      '.rd-content{white-space:pre-wrap;word-break:break-word;}' +
      '.rd-body .ql-snow{border:none;}' +
      '.rd-body .ql-editor{padding:0;font-size:16px;line-height:1.8;color:#2a2a35;}' +
      '.rd-body .ql-editor img{max-width:100%;height:auto;border-radius:12px;display:block;margin:14px auto;}' +
      '.rd-cta{display:block;text-align:center;background:#5b3fbe;color:#fff;text-decoration:none;' +
      'font-weight:700;font-size:16px;padding:15px;border-radius:12px;margin-bottom:10px;}' +
      '.rd-list{display:block;text-align:center;background:#fff;border:1px solid #d7d2e6;' +
      'border-radius:12px;padding:13px;font-size:14px;font-weight:600;color:#555;text-decoration:none;}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const id = parseId();
    if (!id) {
      renderError('잘못된 접근입니다.');
      return;
    }
    api
      .get('/api/reviews/' + id)
      .then((r) => {
        if (!r) {
          renderError('후기를 찾을 수 없습니다.');
          return;
        }
        if (r.hidden) {
          renderError('관리자에 의해 가림 처리되었습니다.');
          return;
        }
        render(r);
      })
      .catch(() => renderError('후기를 불러오지 못했습니다.'));
  });
})();
