// ════════════════════════════════════════════════════
// card-featured.js — 웹 '다픽 추천 카드' 영역 (featured=true 카드)
// GET /api/cards/featured (공개) → 히어로 카드. 없으면 섹션 숨김.
// 클릭 시 card-detail.html?id={id}. 혜택 아이콘: Lucide. cl-* 스타일 재사용(card-list.js).
// ════════════════════════════════════════════════════
(function () {
  'use strict';
  const box = document.getElementById('featuredList');
  const section = document.getElementById('featuredSection');
  if (!box || !section) return;

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  let catMap = {};

  function benefitHtml(icon, l, v, post) {
    if (!(l || v || post)) return '';
    const ic = icon
      ? '<i data-lucide="' + esc(icon) + '" class="cl-bicon"></i>'
      : '<span class="cl-bicon-empty"></span>';
    return '<li>' + ic + '<span>' + esc(l || '') +
      (v ? ' <b>' + esc(v) + '</b>' : '') +
      (post ? ' ' + esc(post) : '') + '</span></li>';
  }

  function cardRow(c) {
    const catName = catMap[c.categoryId] || '';
    const img = c.imageUrl
      ? '<img src="' + esc(c.imageUrl) + '" alt="' + esc(c.title || '') + '" loading="lazy" />'
      : '<span class="cl-noimg">카드</span>';
    const badge = c.badge ? '<span class="cl-badge">' + esc(c.badge) + '</span>' : '';
    const max = c.maxBenefit ? '<span class="cl-max">최대 ' + esc(c.maxBenefit) + '</span>' : '';
    const benefits = [
      benefitHtml(c.benefit1Icon, c.benefit1Label, c.benefit1Value, c.benefit1Post),
      benefitHtml(c.benefit2Icon, c.benefit2Label, c.benefit2Value, c.benefit2Post),
      benefitHtml(c.benefit3Icon, c.benefit3Label, c.benefit3Value, c.benefit3Post),
    ].join('');
    return (
      '<a class="cl-card" href="card-detail.html?id=' + encodeURIComponent(c.id) + '">' +
        '<div class="cl-img">' + img + '</div>' +
        '<div class="cl-body">' +
          '<div class="cl-badgerow">' + max + badge + '</div>' +
          '<div class="cl-title">' + esc(c.title || '카드') + '</div>' +
          (catName ? '<div class="cl-cat">' + esc(catName) + '</div>' : '') +
          (benefits ? '<ul class="cl-benefits">' + benefits + '</ul>' : '') +
        '</div>' +
        '<span class="cl-go">자세히 보기 ›</span>' +
      '</a>'
    );
  }

  async function load() {
    try {
      const cats = await api.get('/api/card-categories', { skipAuthRefresh: true });
      (Array.isArray(cats) ? cats : (cats && cats.content) || []).forEach((c) => { catMap[c.id] = c.name; });
    } catch (e) { /* noop */ }
    try {
      const list = await api.get('/api/cards/featured', { skipAuthRefresh: true });
      const cards = Array.isArray(list) ? list : (list && list.content) || [];
      if (!cards.length) { section.style.display = 'none'; return; }
      box.innerHTML = cards.map(cardRow).join('');
      section.style.display = '';
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    } catch (e) {
      section.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
