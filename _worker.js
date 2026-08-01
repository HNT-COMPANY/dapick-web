// ════════════════════════════════════════════════════
// _worker.js — Cloudflare Pages 고급 모드 Worker
// 항목별 OG/메타 서버 주입(SSR-lite) — 카톡·페북 등 JS 미실행 봇 대응.
//  · 후기: /reviews/{제목슬러그}-{id}
//  · 상세(?id=): /event-detail /card-detail /water-detail /rental-detail /popup-detail
//  · 매장: /store/{URL 식별자} → store-detail.html 틀에 메타 + 본문까지 주입 (옛 /store-{x} 는 301)
// 그 외 요청은 정적 자산 위임. ※ Pages 고급 모드: env.ASSETS 자동 제공.
// ════════════════════════════════════════════════════

const API_BASE = 'https://api.dapick.co.kr';
const SITE = 'https://dapick.co.kr';
const FALLBACK_IMG = `${SITE}/assets/logos/dapicklogo.png`;

// 상세 페이지별 설정 (경로 → API/에셋/타이틀 필드/접미사/설명 소스)
const DETAILS = {
  '/event-detail':  { api: '/api/events',          titleField: 'title', suffix: '다픽 이벤트', descFrom: 'delta' },
  '/card-detail':   { api: '/api/cards',           titleField: 'title', suffix: '다픽 카드',   descFrom: 'delta' },
  '/water-detail':  { api: '/api/water-products',  titleField: 'name',  suffix: '다픽 정수기', descFrom: 'text', descField: 'description' },
  '/rental-detail': { api: '/api/rental-products', titleField: 'name',  suffix: '다픽 렌탈',   descFrom: 'text', descField: 'description' },
  '/popup-detail':  { api: '/api/popups',          titleField: 'title', suffix: '다픽',        descFrom: 'delta' },
  // 관리자가 만든 카테고리의 상품 상세 (2026-08-01). id 는 UUID — ID_RE 가 이미 허용한다.
  '/product-detail':{ api: '/api/products',        titleField: 'name',  suffix: '다픽',        descFrom: 'text', descField: 'description' },
};
const ID_RE = /^[A-Za-z0-9-]{1,64}$/; // 숫자(Long) + UUID 모두 허용, 슬래시 등 차단

class AttrSetter {
  constructor(attr, value) { this.attr = attr; this.value = value; }
  element(el) { el.setAttribute(this.attr, this.value); }
}
class TextSetter {
  constructor(text) { this.text = text; }
  element(el) { el.setInnerContent(this.text); } // 기본 escape
}
// 매장 본문용 — 이미 escape 한 HTML 조각을 넣고 hidden 을 푼다.
// store-detail.html 의 빈 자리는 전부 hidden 으로 시작한다(값이 없으면 그대로 안 보인다).
class HtmlSetter {
  constructor(html) { this.html = html; }
  element(el) { el.setInnerContent(this.html, { html: true }); el.removeAttribute('hidden'); }
}
class Shower {
  element(el) { el.removeAttribute('hidden'); }
}

// Quill Delta(JSON) → 평문 추출 (og:description 용)
function deltaText(raw) {
  if (!raw) return '';
  try {
    const d = JSON.parse(raw);
    const ops = Array.isArray(d) ? d : (d && d.ops) || [];
    let s = '';
    for (const op of ops) { if (op && typeof op.insert === 'string') s += op.insert; }
    return s;
  } catch (e) { return ''; }
}

function ogRewrite(assetResp, meta) {
  return new HTMLRewriter()
    .on('title', new TextSetter(meta.title))
    .on('meta[name="description"]', new AttrSetter('content', meta.desc))
    .on('meta[property="og:title"]', new AttrSetter('content', meta.title))
    .on('meta[property="og:description"]', new AttrSetter('content', meta.desc))
    .on('meta[property="og:image"]', new AttrSetter('content', meta.image))
    .on('meta[property="og:url"]', new AttrSetter('content', meta.canonical))
    .on('link[rel="canonical"]', new AttrSetter('href', meta.canonical))
    .transform(assetResp);
}

// 범용 상세(?id=) OG 주입
async function injectDetail(request, env, key, cfg, id) {
  const url = new URL(request.url);
  const detailUrl = new URL(key, url).toString();
  try {
    let d = null;
    try {
      const r = await fetch(`${API_BASE}${cfg.api}/${id}`, { headers: { accept: 'application/json' } });
      if (r.ok) { const j = await r.json(); d = j && (j.data != null ? j.data : j); }
    } catch (e) { /* 조회 실패 → 기본 메타 */ }

    const assetResp = await env.ASSETS.fetch(detailUrl);
    if (!d || d.active === false || d.hidden === true || !assetResp.ok) return assetResp;

    const name = d[cfg.titleField] || cfg.suffix;
    const title = `${name} | ${cfg.suffix}`;
    const rawDesc = cfg.descFrom === 'text' ? String(d[cfg.descField] || '') : deltaText(d.detailContent);
    const desc = (rawDesc || '').replace(/\s+/g, ' ').trim().slice(0, 150) || `${cfg.suffix} 정보를 확인하세요.`;
    const image = d.imageUrl || FALLBACK_IMG;
    const canonical = `${SITE}${key}?id=${id}`;
    return ogRewrite(assetResp, { title, desc, image, canonical });
  } catch (e) {
    try { return await env.ASSETS.fetch(detailUrl); } catch (e2) { return env.ASSETS.fetch(request); }
  }
}

// 후기 상세 OG 주입 (/reviews/{slug}-{id})
async function injectReview(request, env, id) {
  const url = new URL(request.url);
  const detailUrl = new URL('/review-detail', url).toString();
  try {
    let review = null;
    try {
      const r = await fetch(`${API_BASE}/api/reviews/${id}`, { headers: { accept: 'application/json' } });
      if (r.ok) { const j = await r.json(); review = j && (j.data != null ? j.data : j); }
    } catch (e) { /* 조회 실패 */ }

    const assetResp = await env.ASSETS.fetch(detailUrl);
    if (!review || review.hidden || !assetResp.ok) return assetResp;

    const t = review.title || '다픽 후기';
    const title = `${t} | 다픽 후기`;
    const desc = String(review.content || '다픽 실사용 후기, 상담 완료 고객의 후기')
      .replace(/\s+/g, ' ').trim().slice(0, 150);
    const image = review.imageUrl || FALLBACK_IMG;
    const canonical = `${SITE}${url.pathname}`;
    return ogRewrite(assetResp, { title, desc, image, canonical });
  } catch (e) {
    try { return await env.ASSETS.fetch(detailUrl); } catch (e2) { return env.ASSETS.fetch(request); }
  }
}

// ════════════════════════════════════════════════════
// 매장 상세 — /store/{URL 식별자}
//
// 주소는 관리자 5단계 'URL 식별자'(stores.slug) 하나로 정해진다.
// 상세페이지 주소(detail_url) 는 안 쓴다 — 그건 손으로 파일 만들던 시절 값이다.
// 페이지는 매번 틀(/store-detail)로 새로 그린다. 옛 store-*.html 은 안 본다.
//
// ⚠️ 아래 sdEsc / sdSec* 는 js/store/store-detail.js 의 같은 이름 함수와
//    '똑같은 HTML' 을 만들어야 한다. 여기가 봇(네이버 Yeti 는 JS 를 안 돌린다)과
//    첫 화면이 보는 쪽이고, 저쪽은 worker 가 없는 자리(로컬)에서 도는 쪽이다.
//    한쪽만 고치면 두 화면이 갈린다.
// ════════════════════════════════════════════════════

/* /store/{slug} 만 매장이다. slug 는 백엔드 StoreService.resolveSlug 가
   보증하는 문자열(영숫자·하이픈·밑줄)이고, 한글 지점명이면 'store','store-2'
   같은 값이 되기도 한다. 어떤 값이든 여기서는 그냥 slug 로 넘긴다. */
const STORE_RE = /^\/store\/([A-Za-z0-9_-]{1,60})$/;
const STORE_TPL = '/store-detail'; // 틀. 이 주소 자체는 매장이 아니다.

/* 옛 주소 /store-byeongyeong 은 검색엔진에 이미 올라가 있다.
   더미가 든 옛 정적 파일을 그대로 보여주지 않고 새 주소로 넘긴다. */
const STORE_LEGACY_RE = /^\/store-([A-Za-z0-9_-]{1,60})$/;

/* 옛 store-*.html 은 legacy-static/ 에 자료로 남겨 뒀다(README.md 참고).
   저장소에는 있지만 웹에는 없어야 한다. 이 경로는 통째로 막는다. */
const LEGACY_DIR_RE = /^\/legacy-static\//;

function sdEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* 주소가 /store/{slug} 라 상대경로가 /store/assets/... 로 샌다.
   DB 에 'assets/store/...' 처럼 들어온 값은 앞에 / 를 붙여 뿌리 기준으로 만든다.
   http(s):// · // · data: 로 시작하면 그대로 둔다. */
function sdAsset(u) {
  const v = String(u == null ? '' : u).trim();
  if (!v) return '';
  if (/^(https?:)?\/\//.test(v) || /^data:/.test(v)) return v;
  return '/' + v.replace(/^\/+/, '');
}

function sdBadgeLabel(v) {
  if (v === 'NEW') return 'NEW';
  if (v === 'READY') return '오픈 예정';
  return '';
}

function sdSecTitleRow(s) {
  const badge = sdBadgeLabel(s.badge);
  return '<h1 class="store-page-title">' + sdEsc(s.name) + '</h1>' +
    (badge ? '<span class="store-page-badge">' + sdEsc(badge) + '</span>' : '');
}

function sdSecHero(s) {
  if (!s.mainImage) return '';
  return '<img src="' + sdEsc(sdAsset(s.mainImage)) + '" alt="' + sdEsc(s.name) +
    ' 외관" class="store-hero-img" />';
}

function sdInfoRow(key, val) {
  return '<li class="store-info-row">' +
    '<span class="store-info-key">' + sdEsc(key) + '</span>' +
    '<span class="store-info-val">' + sdEsc(val) + '</span></li>';
}

function sdSecInfo(s) {
  let h = '';
  if (s.address) h += sdInfoRow('주소', s.address);
  if (s.phone) {
    h += '<li class="store-info-row">' +
      '<span class="store-info-key">전화</span>' +
      '<a href="tel:' + sdEsc(s.phone) + '" class="store-info-val store-info-val--link">' +
      sdEsc(s.phone) + '</a></li>';
  }
  if (s.hours) h += sdInfoRow('영업시간', s.hours);
  if (s.closedDay) h += sdInfoRow('휴무', s.closedDay);
  return h;
}

function sdSecIntro(intro) {
  intro = intro || {};
  const lead = intro.lead || '';
  const strong = intro.strong || '';
  const tail = intro.tail || '';
  if (!lead && !strong && !tail) return '';
  let h = sdEsc(lead).replace(/\n/g, '<br />');
  if (strong) {
    if (h && !/<br \/>$/.test(h)) h += ' ';
    h += '<strong>' + sdEsc(strong) + '</strong>';
  }
  return h + sdEsc(tail);
}

function sdSecDesc(paragraphs) {
  const ps = paragraphs || [];
  if (!ps.length) return '';
  return ps.map((p) => '<p>' + sdEsc(p).replace(/\n/g, '<br />') + '</p>').join('');
}

function sdSecChecklist(cl) {
  cl = cl || {};
  const items = cl.items || [];
  if (!cl.icon && !cl.title && !items.length) return '';
  return '<div class="store-checklist-head">' +
      '<span class="store-checklist-icon">' + sdEsc(cl.icon || '📱') + '</span>' +
      '<span class="store-checklist-title">' + sdEsc(cl.title || '') + '</span>' +
    '</div>' +
    (items.length
      ? '<ul class="store-checklist-items">' +
          items.map((t) => '<li>' + sdEsc(t) + '</li>').join('') + '</ul>'
      : '');
}

function sdSecFeatures(features) {
  const fs = features || [];
  if (!fs.length) return '';
  return fs.map((f) =>
    '<div class="store-feature">' +
      '<span class="store-feature-icon">' + sdEsc(f.icon || '📍') + '</span>' +
      '<div class="store-feature-body">' +
        '<div class="store-feature-label">' + sdEsc(f.label || '') + '</div>' +
        '<div class="store-feature-desc">' + sdEsc(f.desc || '') + '</div>' +
      '</div>' +
    '</div>').join('');
}

function sdSecGallery(gallery, name) {
  const gs = (gallery || []).filter((g) => g && g.url);
  if (!gs.length) return '';
  return gs.map((g) => {
    const url = sdEsc(sdAsset(g.url));
    return '<a class="store-gallery-item" href="' + url + '" target="_blank" rel="noopener">' +
      '<img src="' + url + '" alt="' + sdEsc(g.alt || name) + '" loading="lazy" /></a>';
  }).join('');
}

function sdLink(cls, iconHtml, label, desc, href) {
  return '<a class="store-link ' + cls + '" href="' + sdEsc(href) +
    '" target="_blank" rel="noopener">' + iconHtml +
    '<div class="store-link-body">' +
      '<div class="store-link-label">' + sdEsc(label) + '</div>' +
      '<div class="store-link-desc">' + sdEsc(desc) + '</div>' +
    '</div>' +
    '<span class="store-link-arrow">›</span></a>';
}

function sdSecLinks(s) {
  let h = '';
  if (s.preconUrl) {
    h += sdLink('store-link--precon',
      '<img src="/assets/badges/precon.png" alt="" class="store-link-icon" />',
      '이동통신 사전승낙 판매점', '정식 등록 인증 확인', s.preconUrl);
  }
  if (s.preconAlttulUrl) {
    h += sdLink('store-link--precon',
      '<img src="/assets/badges/precon.png" alt="" class="store-link-icon" />',
      '알뜰폰 판매점 사전승낙', '정식 등록 인증 확인', s.preconAlttulUrl);
  }
  if (s.daangnUrl) {
    h += sdLink('store-link--daangn', '<span class="store-link-emoji">🥕</span>',
      '당근 채널', '동네 후기 + 당근에서 바로 문의', s.daangnUrl);
  }
  if (s.naverPlaceUrl) {
    h += sdLink('store-link--naver', '<span class="store-link-emoji">🗺️</span>',
      '네이버 플레이스', '네이버 지도에서 길찾기 + 후기', s.naverPlaceUrl);
  }
  return h;
}

function sdSecCta(s) {
  let h = '';
  if (s.address) {
    h += '<a class="store-cta-btn store-cta-btn--map" href="https://map.kakao.com/link/search/' +
      sdEsc(encodeURIComponent(s.address)) +
      '" target="_blank" rel="noopener">매장 간편 길찾기</a>';
  }
  h += '<a class="store-cta-btn store-cta-btn--kakao" href="' +
    sdEsc(s.kakaoChatUrl || 'https://pf.kakao.com/_exaRjX/chat') +
    '" target="_blank" rel="noopener">카카오 채널 상담</a>';
  return h;
}

function sdMetaDesc(s) {
  const d = s.detail || {};
  const raw = d.tagline || s.description || (d.paragraphs && d.paragraphs[0]) || '';
  const parts = [];
  if (s.name) parts.push(s.name);
  if (s.address) parts.push(s.address);
  if (raw) parts.push(raw);
  return parts.join(' - ').replace(/\s+/g, ' ').trim().slice(0, 150);
}

// 매장 목록. 페이지마다 부르므로 엣지에서 짧게 캐시한다.
// 관리자가 고친 값이 늦어도 2분 안에는 반영된다.
async function sdFetchStores() {
  const r = await fetch(`${API_BASE}/api/stores`, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 120, cacheEverything: true },
  });
  if (!r.ok) return [];
  const j = await r.json();
  const d = j && (j.data != null ? j.data : j);
  return Array.isArray(d) ? d : (d && d.content) || [];
}

// 매장 1건. URL 식별자(slug)로 바로 찾는다 — 목록을 훑지 않는다.
async function sdFetchStore(slug) {
  const r = await fetch(`${API_BASE}/api/stores/${encodeURIComponent(slug)}`, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 120, cacheEverything: true },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const d = j && (j.data != null ? j.data : j);
  return d && d.id ? d : null;
}

function sdRewrite(tplResp, s, canonical) {
  const d = s.detail || {};
  const title = `${s.name} | 다픽 인증 휴대폰 매장`;
  const desc = sdMetaDesc(s);
  const image = s.mainImage
    ? (/^https?:\/\//.test(s.mainImage) ? s.mainImage : `${SITE}/${s.mainImage.replace(/^\//, '')}`)
    : FALLBACK_IMG;

  const intro = sdSecIntro(d.intro);
  const body = sdSecDesc(d.paragraphs);
  const cl = sdSecChecklist(d.checklist);
  const feat = sdSecFeatures(d.features);
  const gal = sdSecGallery(d.gallery, s.name);
  const links = sdSecLinks(s);
  const hero = sdSecHero(s);

  let rw = new HTMLRewriter()
    // 이 페이지는 worker 가 이미 채웠다 — store-detail.js 가 다시 안 그린다.
    .on('html', new AttrSetter('data-ssr', '1'))
    // 틀은 noindex 로 시작한다. 진짜 매장 주소일 때만 index 로 연다.
    .on('meta[name="robots"]', new AttrSetter('content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'))
    .on('meta[name="googlebot"]', new AttrSetter('content', 'index, follow'))
    .on('meta[name="Yeti"]', new AttrSetter('content', 'index, follow'))
    .on('title', new TextSetter(title))
    .on('meta[name="description"]', new AttrSetter('content', desc))
    .on('meta[property="og:title"]', new AttrSetter('content', title))
    .on('meta[property="og:description"]', new AttrSetter('content', desc))
    .on('meta[property="og:image"]', new AttrSetter('content', image))
    .on('meta[property="og:url"]', new AttrSetter('content', canonical))
    .on('link[rel="canonical"]', new AttrSetter('href', canonical))
    // 좌표는 DB 에 없다. 주소만 넘기고 지도는 카카오 Geocoder 가 잡는다.
    .on('#storeDetailMap', new AttrSetter('data-address', s.address || ''))
    .on('#storeDetailMap', new AttrSetter('data-name', s.name || ''))
    .on('[data-ssr="titlerow"]', new HtmlSetter(sdSecTitleRow(s)))
    .on('[data-ssr="info"]', new HtmlSetter(sdSecInfo(s)))
    .on('[data-ssr="cta"]', new HtmlSetter(sdSecCta(s)))
    .on('[data-ssr-sec="cta"]', new Shower());

  const tagline = d.tagline || s.description || '';
  if (tagline) rw = rw.on('[data-ssr="tagline"]', new HtmlSetter(sdEsc(tagline)));
  if (hero) rw = rw.on('[data-ssr="hero"]', new HtmlSetter(hero));
  if (intro) rw = rw.on('[data-ssr="intro"]', new HtmlSetter(intro));
  if (body) rw = rw.on('[data-ssr="desc"]', new HtmlSetter(body));
  if (cl) rw = rw.on('[data-ssr="checklist"]', new HtmlSetter(cl));
  if (feat) rw = rw.on('[data-ssr="features"]', new HtmlSetter(feat));
  if (intro || body || cl || feat) rw = rw.on('[data-ssr-sec="about"]', new Shower());
  if (gal) {
    rw = rw.on('[data-ssr="gallery"]', new HtmlSetter(gal))
           .on('[data-ssr-sec="gallery"]', new Shower());
  }
  if (links) {
    rw = rw.on('[data-ssr="links"]', new HtmlSetter(links))
           .on('[data-ssr-sec="links"]', new Shower());
  }

  return rw.transform(tplResp);
}

/* /store/{slug} — 관리자에 쓴 내용으로 페이지를 새로 그린다.
   6단계 본문이 비어 있어도 그린다: 지점명·주소·전화·지도까지는 나온다.
   DB 에 없는 slug 면 틀을 noindex 상태 그대로 내보낸다(안내문이 뜬다). */
async function injectStore(request, env, slug) {
  const url = new URL(request.url);
  try {
    const store = await sdFetchStore(slug);
    const tpl = await env.ASSETS.fetch(new URL(STORE_TPL, url).toString());
    if (!tpl.ok) return tpl;
    if (!store) return new Response(tpl.body, { status: 404, headers: tpl.headers });
    return sdRewrite(tpl, store, `${SITE}/store/${slug}`);
  } catch (e) {
    return env.ASSETS.fetch(new URL(STORE_TPL, url).toString());
  }
}

/* 옛 주소 /store-{x} → 새 주소 /store/{slug} 로 301.
   옛 파일 이름은 slug 에서 'dapon-' 을 뗀 값이었다(관리자 stAutoDetailUrl).

   ⚠️ 옛 정적 파일(store-byeongyeong.html 등)은 자료로 볼 게 있어 저장소에 남겨 뒀다.
      남겨 뒀을 뿐 웹으로는 안 내보낸다. 그래서 여기서 절대
      env.ASSETS.fetch(request) 로 떨어뜨리지 않는다 — 그러면 더미가 그대로 뜬다.
      DB 에서 못 찾으면 매장 목록(/mobile)으로 보낸다. */
async function redirectLegacyStore(request, env, x) {
  try {
    const list = await sdFetchStores();
    const hit = list.find((s) => {
      const slug = s && s.id ? String(s.id) : '';
      return slug && (slug === x || slug.replace(/^dapon-/, '') === x);
    });
    if (hit) return Response.redirect(`${SITE}/store/${hit.id}`, 301);
  } catch (e) { /* 조회 실패 → 아래 목록으로 */ }
  /* 302 다: 나중에 그 slug 로 매장을 등록하면 301(영구)로 바뀌어야 한다. */
  return Response.redirect(`${SITE}/mobile`, 302);
}

/* 옛 정적 파일은 legacy-static/ 에 자료로 남겨 뒀다. 웹으로는 안 내보낸다. */
async function redirectLegacyDir(request, env) {
  return Response.redirect(`${SITE}/mobile`, 302);
}

// ════════════════════════════════════════════════════
// sitemap.xml — 매장 줄은 손으로 안 적는다
//
// 가맹점이 10곳이 되든 100곳이 되든 sitemap 을 고치러 들어올 일이 없어야 한다.
// 그래서 매장 <url> 은 파일에 안 적고 API 로 채운다.
// 잘 안 바뀌는 고정 페이지(메인·카테고리·정책)는 그대로 파일에 둔다 —
// 그건 관리자에서 만드는 게 아니라 우리가 파일로 만드는 페이지라서다.
// ════════════════════════════════════════════════════
const SITEMAP_MARK = '<!--STORES-->';

async function injectSitemap(request, env) {
  const res = await env.ASSETS.fetch(request);
  let xml;
  try {
    xml = await res.text();
  } catch (e) {
    return res;
  }
  if (xml.indexOf(SITEMAP_MARK) < 0) return new Response(xml, { headers: res.headers });

  let block = '';
  try {
    const list = await sdFetchStores();
    /* lastmod 는 안 적는다. StoreResponse 에 수정 시각이 없어서 지금 적을 수 있는 건
       거짓말뿐이고, 틀린 lastmod 는 검색엔진이 통째로 무시한다. */
    block = list
      .filter((s) => s && s.id)
      .map(
        (s) =>
          '  <url>\n' +
          '    <loc>' + SITE + '/store/' + sdEsc(String(s.id)) + '</loc>\n' +
          '    <changefreq>monthly</changefreq>\n' +
          '    <priority>0.7</priority>\n' +
          '  </url>'
      )
      .join('\n');
  } catch (e) {
    /* 조회 실패 → 매장 줄 없이 내보낸다. 없는 주소를 적어 보내는 것보다 낫다. */
  }

  return new Response(xml.replace(SITEMAP_MARK, block), {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return env.ASSETS.fetch(request);

    // 사이트맵: 매장 줄은 API 로 채운다
    if (url.pathname === '/sitemap.xml') return injectSitemap(request, env);

    // 옛 정적 파일 보관함 — 저장소에만 있고 웹에는 없다
    if (LEGACY_DIR_RE.test(url.pathname)) return redirectLegacyDir(request, env);

    // 상세(?id=) 페이지: /xxx-detail(.html)?id=N
    const key = url.pathname.replace(/\.html$/, '');
    const cfg = DETAILS[key];
    if (cfg) {
      const id = url.searchParams.get('id');
      if (id && ID_RE.test(id)) return injectDetail(request, env, key, cfg, id);
      return env.ASSETS.fetch(request);
    }

    // 매장 상세: /store/{URL 식별자}
    const sm = key.match(STORE_RE);
    if (sm) return injectStore(request, env, sm[1]);

    // 옛 주소 /store-{x} → 새 주소로 301. 틀(/store-detail)은 제외.
    if (key !== STORE_TPL) {
      const lm = key.match(STORE_LEGACY_RE);
      if (lm) return redirectLegacyStore(request, env, lm[1]);
    }

    // 카테고리 페이지: /c/{slug} → category.html
    // 정적 사이트라 관리자가 카테고리를 만들어도 파일이 생기지 않는다.
    // 공용 틀 하나를 내려주고 slug 는 category.js 가 주소에서 읽는다.
    // '/c/' 접두사를 쓰는 이유 = /water·/card·/store-xxx 같은 기존 주소와 절대 안 겹치게.
    if (/^\/c\/[a-z0-9-]+$/.test(key)) {
      return env.ASSETS.fetch(new URL('/category.html', url).toString());
    }

    // 후기 상세: /reviews/{제목슬러그}-{id}
    const m = url.pathname.match(/^\/reviews\/.+-(\d+)\/?$/);
    if (m) return injectReview(request, env, m[1]);

    // 그 외 정적 자산
    return env.ASSETS.fetch(request);
  },
};
