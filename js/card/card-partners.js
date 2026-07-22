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

  // 자체 완결 스타일 — card.css 가 캐시/오배포로 안 실릴 때도 타일이 항상 정상 렌더되도록
  // (이 그리드는 JS 로 그려지므로 스타일도 같은 모듈에서 주입 = 크로스파일 의존 제거)
  function injectStyles() {
    if (document.getElementById('cardco-inline-style')) return;
    const css =
      // 그리드
      '#cardPartners.card-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}' +
      '@media(max-width:900px){#cardPartners.card-grid{grid-template-columns:repeat(3,1fr);gap:12px;}}' +
      '@media(max-width:640px){#cardPartners.card-grid{grid-template-columns:repeat(2,1fr);gap:10px;}}' +
      // 타일 (버튼 리셋 포함)
      '.cardco.cardco--select{-webkit-appearance:none;appearance:none;font-family:inherit;width:100%;margin:0;}' +
      '.cardco{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;' +
      'gap:12px;min-height:150px;padding:22px 16px 18px;background:#fff;border:1.5px solid #ececec;' +
      'border-radius:14px;text-align:center;text-decoration:none;cursor:pointer;box-sizing:border-box;' +
      'transition:all .22s cubic-bezier(.16,1,.3,1);}' +
      '.cardco:hover{border-color:#7c3aed;transform:translateY(-3px);box-shadow:0 10px 24px rgba(124,58,237,.14);}' +
      '.cardco__logo{width:56px;height:56px;display:flex;align-items:center;justify-content:center;overflow:hidden;}' +
      '.cardco__logo img{max-width:100%;max-height:100%;object-fit:contain;}' +
      '.cardco__ph{width:56px;height:56px;border-radius:50%;background:#f3f0fb;color:#7c3aed;' +
      'font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;}' +
      '.cardco__name{font-size:15px;font-weight:800;color:#1a1a1a;text-align:center;letter-spacing:-.3px;line-height:1.35;}' +
      '.cardco__go{margin-top:auto;font-size:12px;font-weight:700;color:#666;background:#f4f4f6;' +
      'border-radius:999px;padding:6px 16px;transition:all .22s ease;}' +
      '.cardco:hover .cardco__go{background:#7c3aed;color:#fff;}' +
      '.cardco-loading{grid-column:1/-1;text-align:center;color:#aaa;font-size:14px;padding:30px 0;}' +
      // 선택 하이라이트
      '.cardco.on{border-color:#5b3fbe !important;box-shadow:0 8px 22px rgba(91,63,190,.16);}' +
      '.cardco.on .cardco__go{background:#5b3fbe;color:#fff;}';
    const s = document.createElement('style');
    s.id = 'cardco-inline-style';
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
