// ════════════════════════════════════════════════════
// _worker.js — Cloudflare Pages 고급 모드 Worker
// 후기 상세 제목 URL 라우팅 + OG/메타 서버 주입(SSR-lite)
// /reviews/{제목슬러그}-{id}  →  review-detail 페이지에 후기별 title/description/og:* 주입 후 서빙
//   (카톡·페북 등 JS 미실행 봇도 후기별 미리보기가 보이도록)
// 그 외 모든 요청은 정적 자산으로 위임(clean URL/.html 처리 등 기존 동작 유지).
// ※ Pages 고급 모드: 이 파일(_worker.js)이 있으면 모든 요청을 처리. env.ASSETS 자동 제공.
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

    // 상세 페이지 자산(review-detail.html) — clean URL 문자열로 안전 요청
    const detailUrl = new URL('/review-detail', url).toString();

    try {
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
        /* 조회 실패 → 메타 주입 없이 페이지만 */
      }

      const assetResp = await env.ASSETS.fetch(detailUrl);

      // 데이터 없음/가림/비정상 응답이면 메타 주입 없이 페이지 (클라가 렌더)
      if (!review || review.hidden || !assetResp.ok) return assetResp;

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
    } catch (e) {
      // 어떤 오류든 Error 1101 대신 상세 페이지로 폴백 (클라가 id 파싱 후 렌더)
      try {
        return await env.ASSETS.fetch(detailUrl);
      } catch (e2) {
        return env.ASSETS.fetch(request);
      }
    }
  },
};
