// ════════════════════════════════════════════════════
// _worker.js — Cloudflare Pages 고급 모드 Worker
// 항목별 OG/메타 서버 주입(SSR-lite) — 카톡·페북 등 JS 미실행 봇 대응.
//  · 후기: /reviews/{제목슬러그}-{id}
//  · 상세(?id=): /event-detail /card-detail /water-detail /rental-detail /popup-detail
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

    // 후기 상세: /reviews/{제목슬러그}-{id}
    const m = url.pathname.match(/^\/reviews\/.+-(\d+)\/?$/);
    if (m) return injectReview(request, env, m[1]);

    // 그 외 정적 자산
    return env.ASSETS.fetch(request);
  },
};
