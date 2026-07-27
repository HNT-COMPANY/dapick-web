// ════════════════════════════════════════════════════
// _worker.js — Cloudflare Pages 고급 모드 Worker
// 항목별 OG/메타 서버 주입(SSR-lite) — 카톡·페북 등 JS 미실행 봇 대응.
//  · 후기: /reviews/{제목슬러그}-{id}
//  · 상세(?id=): /event-detail /card-detail /water-detail /rental-detail /popup-detail
//  · 매장: /store-{slug} → store-detail.html 틀에 메타 + 본문까지 주입
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
// 매장 상세 — /store-{slug}
//
// 주소는 손으로 만들던 시절 그대로 둔다(/store-byeongyeong).
// 네이버·구글이 이미 그 주소를 알고 있어서 바꾸면 처음부터 다시다.
// 대신 그 주소가 가리키는 '내용'만 DB(stores + stores.detail_json)로 옮긴다.
//
// ⚠️ 아래 sdEsc / sdSec* 는 js/store/store-detail.js 의 같은 이름 함수와
//    '똑같은 HTML' 을 만들어야 한다. 여기가 봇(네이버 Yeti 는 JS 를 안 돌린다)과
//    첫 화면이 보는 쪽이고, 저쪽은 worker 가 없는 자리(로컬)에서 도는 쪽이다.
//    한쪽만 고치면 두 화면이 갈린다.
// ════════════════════════════════════════════════════

/* 지점명이 한글이면 백엔드가 slug 를 'store', 'store-2' 로 떨어뜨린다
   (StoreService.resolveSlug). 그러면 주소가 /store, /store-2 가 되므로
   하이픈 없는 /store 도 받아야 한다. 정적 store.html 은 없다. */
const STORE_RE = /^\/store(-[A-Za-z0-9_-]{1,60})?$/;
const STORE_TPL = '/store-detail'; // 틀. 이 주소 자체는 매장이 아니다.

function sdEsc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  return '<img src="' + sdEsc(s.mainImage) + '" alt="' + sdEsc(s.name) +
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
    const url = sdEsc(g.url);
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
      '<img src="assets/badges/precon.png" alt="" class="store-link-icon" />',
      '이동통신 사전승낙 판매점', '정식 등록 인증 확인', s.preconUrl);
  }
  if (s.preconAlttulUrl) {
    h += sdLink('store-link--precon',
      '<img src="assets/badges/precon.png" alt="" class="store-link-icon" />',
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

async function injectStore(request, env, key) {
  const url = new URL(request.url);
  const file = key.slice(1) + '.html'; // '/store-byeongyeong' → 'store-byeongyeong.html'
  try {
    let store = null;
    try {
      const list = await sdFetchStores();
      store = list.find((x) => x && x.detailUrl === file) || null;
    } catch (e) { /* 조회 실패 → 옛 정적 파일로 떨어진다 */ }

    /* 관리자에 등록된 매장이면 무조건 틀로 그린다.
       6단계 본문이 비어 있어도 그렇다 — 지점명·주소·전화·지도까지는 나온다.
       손으로 만든 옛 파일(store-byeongyeong.html)이 같은 이름으로 남아 있어도
       그건 안 본다. 관리자에 쓴 것이 곧 그 매장의 페이지다.
       옛 파일은 DB 에 없는 주소로 들어왔을 때만 쓰인다(옛 주소 살리기 용). */
    if (store) {
      const tpl = await env.ASSETS.fetch(new URL(STORE_TPL, url).toString());
      if (tpl.ok) return sdRewrite(tpl, store, `${SITE}${key}`);
    }

    // DB 에 없는 주소 → 남아 있는 정적 파일, 그것도 없으면 원래의 404
    return env.ASSETS.fetch(request);
  } catch (e) {
    try { return await env.ASSETS.fetch(request); } catch (e2) { return env.ASSETS.fetch(request); }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return env.ASSETS.fetch(request);

    // 상세(?id=) 페이지: /xxx-detail(.html)?id=N
    const key = url.pathname.replace(/\.html$/, '');
    const cfg = DETAILS[key];
    if (cfg) {
      const id = url.searchParams.get('id');
      if (id && ID_RE.test(id)) return injectDetail(request, env, key, cfg, id);
      return env.ASSETS.fetch(request);
    }

    // 매장 상세: /store-{slug}
    // 틀 자체(/store-detail)는 매장이 아니므로 그냥 정적으로 내보낸다.
    if (key !== STORE_TPL && STORE_RE.test(key)) return injectStore(request, env, key);

    // 후기 상세: /reviews/{제목슬러그}-{id}
    const m = url.pathname.match(/^\/reviews\/.+-(\d+)\/?$/);
    if (m) return injectReview(request, env, m[1]);

    // 그 외 정적 자산
    return env.ASSETS.fetch(request);
  },
};
