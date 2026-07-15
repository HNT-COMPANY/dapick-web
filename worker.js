// ════════════════════════════════════════════════════
// dapick-web Worker — 후기 상세 제목 URL 라우팅 + OG/메타 서버 주입(SSR-lite)
// /reviews/{제목슬러그}-{id}  →  review-detail.html 에 후기별 title/description/og:* 주입 후 서빙
//   (카톡·페북 등 JS 미실행 봇도 후기별 미리보기가 보이도록)
// 그 외 모든 요청은 정적 자산으로 위임(clean URL/.html 리다이렉트 등 기존 동작 유지).
// ════════════════════════════════════════════════════

const API_BASE = 'https://api.dapick.co.kr';
const SITE = 'https://dapick.co.kr';

class AttrSetter {
  constructor(attr, value) {
    this.attr = attr;
    this.value = value;
  }
  element(el) {
    el.setAttribute(this.attr, this.value);
  }
}

class TextSetter {
  constructor(text) {
    this.text = text;
  }
  element(el) {
    el.setInnerContent(this.text); // 기본 text(html:false) → 자동 escape
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/reviews\/.+-(\d+)\/?$/);

    // 후기 상세 경로가 아니면 정적 자산 그대로
    if (!m || request.method !== 'GET') {
      return env.ASSETS.fetch(request);
    }
    const id = m[1];

    // 후기 데이터 조회 (공개 API)
    let review = null;
    try {
      const r = await fetch(`${API_BASE}/api/reviews/${id}`, {
        headers: { accept: 'application/json' },
      });
      if (r.ok) {
        const j = await r.json();
        review = j && (j.data != null ? j.data : j);
      }
    } catch (e) {
      /* 조회 실패 시 기본 페이지 */
    }

    // 상세 페이지 자산 로드 (clean URL → review-detail.html)
    const assetResp = await env.ASSETS.fetch(
      new Request(`${url.origin}/review-detail`, request),
    );

    // 데이터 없거나 가림 후기면 메타 주입 없이 기본 페이지 (클라가 처리)
    if (!review || review.hidden) return assetResp;

    const t = review.title || '다픽 후기';
    const title = `${t} | 다픽 후기`;
    const desc = String(review.content || '다픽 실사용 후기 — 상담 완료 고객의 후기')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150);
    const image = review.imageUrl || `${SITE}/assets/logos/dapick.png`;
    const canonical = `${SITE}${url.pathname}`;

    return new HTMLRewriter()
      .on('title', new TextSetter(title))
      .on('meta[name="description"]', new AttrSetter('content', desc))
      .on('meta[property="og:title"]', new AttrSetter('content', title))
      .on('meta[property="og:description"]', new AttrSetter('content', desc))
      .on('meta[property="og:image"]', new AttrSetter('content', image))
      .on('meta[property="og:url"]', new AttrSetter('content', canonical))
      .on('link[rel="canonical"]', new AttrSetter('href', canonical))
      .transform(assetResp);
  },
};
