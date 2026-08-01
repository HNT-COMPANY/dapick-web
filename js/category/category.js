// ════════════════════════════════════════════════════════
// /c/{slug} — 관리자가 만든 카테고리 페이지 (2026-07-30)
//
// 정적 사이트라 카테고리마다 파일을 만들 수 없다.
// _worker.js 가 /c/{slug} 요청에 이 틀(category.html)을 내려주고,
// slug 는 여기서 주소에서 읽어 API 로 카테고리를 찾는다.
//
// 흐름: 카테고리 조회 → 서브카테고리 바 → 상품 그리드
// 서브 선택은 ?sub={하위 id} 로 들어온다 (GNB 드롭다운이 이 주소를 만든다).
// ════════════════════════════════════════════════════════

let cgCategory = null;
let cgSubs = [];
let cgActiveSub = 'all';
let cgRows = [];
let cgSort = 'default';

function cgEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cgSlug() {
  const m = location.pathname.match(/^\/c\/([a-z0-9-]+)/);
  if (m) return m[1];
  // 로컬(Live Server)은 _worker.js 가 안 도니까 category.html?slug=xxx 로 연다
  return new URLSearchParams(location.search).get('slug') || '';
}

function cgFee(v) {
  if (v == null || v === '') return '<div class="cg-fee cg-fee--none">가격 문의</div>';
  return `<div class="cg-fee"><small>월</small>${Number(v).toLocaleString()}원</div>`;
}

// 모델명은 자유 옵션(specs)에 '모델명' 으로 넣은 값을 쓴다.
// 없으면 빈 줄로 둔다 — 카드 높이가 들쭉날쭉해지지 않게 min-height 로 자리를 잡아 뒀다.
function cgModel(p) {
  const s = p.specs;
  if (!s || typeof s !== 'object') return '';
  return s['모델명'] || s['모델'] || s.model || s.modelName || '';
}

(async function cgInit() {
  const slug = cgSlug();
  const grid = document.getElementById('cg-grid');
  if (!slug) {
    grid.innerHTML = '<div class="cg-empty">주소가 올바르지 않습니다.</div>';
    return;
  }

  try {
    const cats = await api.get('/api/categories');
    cgCategory = (Array.isArray(cats) ? cats : []).find((c) => c.slug === slug) || null;
  } catch (e) {
    grid.innerHTML = '<div class="cg-empty">카테고리를 불러오지 못했습니다.</div>';
    return;
  }
  if (!cgCategory) {
    document.getElementById('cg-title').textContent = '없는 카테고리입니다';
    grid.innerHTML = '<div class="cg-empty">주소를 확인해주세요.</div>';
    return;
  }

  cgSubs = (cgCategory.children || []).filter((c) => c.isActive !== false);

  document.title = `${cgCategory.name} | 다픽`;
  document.getElementById('cg-title').textContent = cgCategory.name;
  document.getElementById('cg-desc').textContent = cgSubs.length
    ? '품목을 골라 상품을 확인하세요'
    : '';

  // GNB 드롭다운에서 넘어온 품목 선택
  const wantSub = new URLSearchParams(location.search).get('sub');
  if (wantSub && cgSubs.some((s) => s.id === wantSub)) cgActiveSub = wantSub;

  // 배너 — 이 카테고리로 등록된 배너가 있으면 뜬다(없으면 site-banner.js 가 영역을 숨긴다)
  const sb = document.getElementById('cg-banner');
  if (sb && typeof dpInitBanner === 'function') {
    sb.setAttribute('data-banner-category-id', cgCategory.id);
    dpInitBanner(sb);
  }

  cgRenderSubs();
  cgLoad();
})();

function cgRenderSubs() {
  const el = document.getElementById('cg-subs');
  if (!el) return;
  if (!cgSubs.length) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  const tabs = [{ id: 'all', name: '전체' }].concat(
    cgSubs.map((c) => ({ id: c.id, name: c.name })),
  );
  el.innerHTML = tabs
    .map(
      (t) =>
        `<button type="button" class="cg-sub${t.id === cgActiveSub ? ' is-on' : ''}" onclick="cgSelectSub('${cgEsc(t.id)}')">${cgEsc(t.name)}</button>`,
    )
    .join('');
}

function cgSelectSub(id) {
  cgActiveSub = id;
  cgRenderSubs();
  // 주소에도 남긴다 — 새로고침·공유해도 같은 품목이 열린다
  const u = new URL(location.href);
  if (id === 'all') u.searchParams.delete('sub');
  else u.searchParams.set('sub', id);
  history.replaceState(null, '', u);
  cgLoad();
}

async function cgLoad() {
  const grid = document.getElementById('cg-grid');
  grid.innerHTML = '<div class="cg-empty">불러오는 중…</div>';

  try {
    if (cgActiveSub === 'all') {
      // '전체' = 카테고리 자체에 달린 상품 + 모든 품목의 상품.
      // 서버가 categoryId 하나만 받아서 여러 번 부른다. 품목 수가 적어 감당된다 —
      // 수십 개로 늘면 서버에 '하위 포함' 옵션을 넣는 편이 낫다.
      const ids = [cgCategory.id].concat(cgSubs.map((s) => s.id));
      const lists = await Promise.all(
        ids.map((id) =>
          api.get('/api/products?categoryId=' + encodeURIComponent(id)).catch(() => []),
        ),
      );
      cgRows = lists.flat().filter(Boolean);
    } else {
      cgRows = (await api.get('/api/products?categoryId=' + encodeURIComponent(cgActiveSub))) || [];
    }
  } catch (e) {
    grid.innerHTML = '<div class="cg-empty">상품을 불러오지 못했습니다.</div>';
    return;
  }
  cgRender();
}

function cgSetSort(s) {
  cgSort = s;
  cgRender();
}

function cgRender() {
  const grid = document.getElementById('cg-grid');
  const rows = cgRows.slice();

  if (cgSort === 'low') rows.sort((a, b) => (a.monthlyFee ?? 1e15) - (b.monthlyFee ?? 1e15));
  else if (cgSort === 'high') rows.sort((a, b) => (b.monthlyFee ?? -1) - (a.monthlyFee ?? -1));
  else rows.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  document.getElementById('cg-count').innerHTML = `전체 <em>${rows.length}</em>`;
  document.querySelectorAll('.cg-sort').forEach((b) => {
    b.classList.toggle('is-on', b.dataset.sort === cgSort);
  });

  if (!rows.length) {
    grid.innerHTML = '<div class="cg-empty">등록된 상품이 없습니다.</div>';
    return;
  }

  grid.innerHTML = rows
    .map((p) => {
      const img = p.imageUrl
        ? `<img src="${cgEsc(p.imageUrl)}" alt="${cgEsc(p.name)}" loading="lazy" />`
        : '<span class="cg-noimg">이미지 준비중</span>';
      return `
      <div class="cg-card" onclick="cgOpen('${cgEsc(p.id)}')">
        <div class="cg-thumb">${img}</div>
        <div class="cg-model">${cgEsc(cgModel(p))}</div>
        <div class="cg-name">${cgEsc(p.name)}</div>
        ${cgFee(p.monthlyFee)}
      </div>`;
    })
    .join('');
}

// 상품 상세로 보낸다 (2026-08-01, product-detail.html 신설).
// 주소 방식은 card-detail·water-detail 과 같은 ?id= 형태로 맞췄다.
function cgOpen(id) {
  const p = cgRows.find((x) => x.id === id);
  if (!p) return;
  location.href = '/product-detail?id=' + encodeURIComponent(p.id);
}
