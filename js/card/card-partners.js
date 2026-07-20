// ════════════════════════════════════════════════════
// card-partners.js — '함께하는 카드사' 그리드 (카드사 = 선택자)
// GET /api/card-categories (공개) → 로고 + 카드사명 타일.
// 타일 클릭 → 그 카드사 선택(하이라이트) + window.cardListShow(cat)로 '추천 카드' 영역 교체.
// (외부 사이트 이동은 카드 상세페이지의 '카드사 바로가기'에서 처리 — 여기선 선택만.)
// 의존: api.js(api.get), card-list.js(window.cardListShow)
// ════════════════════════════════════════════════════
(function () {
  const box = document.getElementById('cardPartners');
  if (!box) return;

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  let cats = [];

  function tile(c, idx) {
    const logo = c.logoUrl
      ? `<img src="${esc(c.logoUrl)}" alt="${esc(c.name)}" loading="lazy" />`
      : `<span class="cardco__ph">${esc((c.name || '?').slice(0, 2))}</span>`;
    return (
      `<button type="button" class="cardco cardco--select" data-idx="${idx}" data-slug="${esc(c.slug || '')}">` +
      `<div class="cardco__logo">${logo}</div>` +
      `<div class="cardco__name">${esc(c.name || '')}</div>` +
      `<span class="cardco__go">카드 보기</span>` +
      `</button>`
    );
  }

  function cpSelect(idx) {
    const cat = cats[idx];
    if (!cat) return;
    box.querySelectorAll('.cardco').forEach((el) =>
      el.classList.toggle('on', Number(el.dataset.idx) === idx));
    if (typeof window.cardListShow === 'function') window.cardListShow(cat);
  }

  function injectStyles() {
    const css =
      // 앵커 → 버튼 전환에 따른 리셋
      '.cardco.cardco--select{font-family:inherit;width:100%;text-align:center;background:#fff;}' +
      // 선택 하이라이트
      '.cardco.on{border-color:#5b3fbe !important;box-shadow:0 8px 22px rgba(91,63,190,.16);}' +
      '.cardco.on .cardco__go{background:#5b3fbe;color:#fff;}';
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  async function load() {
    injectStyles();
    try {
      const list = await api.get('/api/card-categories', { skipAuthRefresh: true });
      cats = Array.isArray(list) ? list : (list && list.content) || [];
      if (!cats.length) {
        box.innerHTML = `<div class="cardco-loading">등록된 카드사가 없습니다.</div>`;
        return;
      }
      box.innerHTML = cats.map(tile).join('');
      box.querySelectorAll('.cardco').forEach((el) => {
        el.addEventListener('click', () => cpSelect(Number(el.dataset.idx)));
      });
    } catch (e) {
      box.innerHTML = `<div class="cardco-loading">카드사를 불러오지 못했습니다.</div>`;
    } finally {
      box.removeAttribute('aria-busy');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
