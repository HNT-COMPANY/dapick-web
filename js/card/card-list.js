// ════════════════════════════════════════════════════
// card-list.js — 카드 페이지 카드 목록 (선택된 카드사의 카드를 히어로로 렌더)
// window.cardListShow(cat) 를 card-partners.js가 카드사 선택 시 호출.
//   cat = { id, slug, name } → GET /api/card-categories/{slug}/cards
// 클릭 시 card-detail.html?id={id}. 혜택 아이콘: Lucide.
// ════════════════════════════════════════════════════
(function () {
  'use strict';
  const box = document.getElementById('cardList');
  if (!box) return;

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  let curCatName = '';

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
          (curCatName ? '<div class="cl-cat">' + esc(curCatName) + '</div>' : '') +
          (benefits ? '<ul class="cl-benefits">' + benefits + '</ul>' : '') +
        '</div>' +
        '<span class="cl-go">자세히 보기 ›</span>' +
      '</a>'
    );
  }

  function injectStyles() {
    const css =
      '.cardlist-section{padding:20px 0 60px;}' +
      '.cl-list{display:flex;flex-direction:column;gap:16px;max-width:820px;margin:20px auto 0;}' +
      '.cl-loading{padding:40px 0;text-align:center;color:#9a9aa5;}' +
      ".cl-card{display:flex;align-items:center;gap:22px;background:#fff;border:1px solid #eee;border-radius:18px;padding:22px;text-decoration:none;color:inherit;box-shadow:0 2px 14px rgba(24,23,43,.05);transition:box-shadow .15s,transform .15s;flex-wrap:wrap;}" +
      '.cl-card:hover{box-shadow:0 8px 26px rgba(24,23,43,.12);transform:translateY(-2px);}' +
      '.cl-img{width:170px;height:110px;flex-shrink:0;border-radius:12px;background:radial-gradient(circle at 50% 45%,#eef2f9 0 60%,#f6f8fc 61%);display:flex;align-items:center;justify-content:center;overflow:hidden;}' +
      '.cl-img img{max-width:100%;max-height:100%;object-fit:contain;}' +
      '.cl-noimg{color:#b7bccb;font-size:12px;}' +
      '.cl-body{flex:1;min-width:200px;}' +
      '.cl-badgerow{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;}' +
      '.cl-max{color:#f36f21;font-weight:800;font-size:14px;}' +
      '.cl-badge{font-size:11px;font-weight:800;color:#f36f21;background:#fff1e6;border-radius:999px;padding:3px 10px;}' +
      '.cl-title{font-size:20px;font-weight:900;color:#18172b;line-height:1.25;}' +
      '.cl-cat{font-size:13px;color:#8a8fa3;margin-top:2px;}' +
      '.cl-benefits{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:7px;}' +
      '.cl-benefits li{display:flex;align-items:center;gap:9px;font-size:14px;color:#3a3a48;}' +
      '.cl-benefits li b{color:#18172b;}' +
      '.cl-bicon{width:18px;height:18px;color:#5b3fbe;flex-shrink:0;}' +
      '.cl-bicon-empty{width:18px;flex-shrink:0;display:inline-block;}' +
      '.cl-go{flex-shrink:0;align-self:center;background:#5b3fbe;color:#fff;font-weight:800;font-size:14px;border-radius:10px;padding:12px 18px;white-space:nowrap;}' +
      '@media(max-width:640px){.cl-card{padding:16px;gap:14px;}.cl-img{width:100%;height:150px;}.cl-go{width:100%;text-align:center;}.cl-title{font-size:18px;}}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 카드사 선택 시 호출됨 (card-partners.js)
  window.cardListShow = async function (cat) {
    if (!box || !cat) return;
    curCatName = cat.name || '';
    box.setAttribute('aria-busy', 'true');
    box.innerHTML = '<div class="cl-loading">불러오는 중…</div>';
    try {
      const list = await api.get('/api/card-categories/' + encodeURIComponent(cat.slug) + '/cards', { skipAuthRefresh: true });
      const cards = Array.isArray(list) ? list : (list && list.content) || [];
      if (!cards.length) {
        box.innerHTML = '<div class="cl-loading">' + esc(curCatName) + '에 등록된 카드가 없습니다.</div>';
      } else {
        box.innerHTML = cards.map(cardRow).join('');
        if (window.lucide && lucide.createIcons) lucide.createIcons();
      }
    } catch (e) {
      box.innerHTML = '<div class="cl-loading">카드를 불러오지 못했습니다.</div>';
    } finally {
      box.removeAttribute('aria-busy');
    }
  };

  injectStyles();
})();
