// ════════════════════════════════════════════════════
// card-detail.js — 카드 상세 (독립 페이지)
// URL: /card-detail?id={id} (로컬/폴백) 또는 /cards/{slug}-{id}
// GET /api/cards/{id} → 히어로(이미지·뱃지·최대혜택·제목·카드사·혜택3·바로가기·메타)
//   + Quill Delta 본문(detailContent) 렌더. 카드사명은 GET /api/card-categories 로 매핑.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  let cdCatMap = {}; // categoryId -> {name, siteUrl, logoUrl}

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 아코디언 본문 경량 서식: **굵게** + 줄바꿈. 관리자(card-detail-edit.js)와 동일 로직 유지 필수.
  function baccRichBody(s) {
    return esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  function parseId() {
    const q = new URLSearchParams(location.search).get('id');
    if (q && /^\d+$/.test(q)) return q;
    const m = location.pathname.match(/-(\d+)\/?$/);
    return m ? m[1] : null;
  }

  function detailOps(raw) {
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      return Array.isArray(d) ? d : (d && d.ops) || null;
    } catch (e) {
      return null;
    }
  }

  function registerCardButtonBlot(Q) {
    if (!Q || Q.__cardBtnRegistered) return;
    const BlockEmbed = Q.import('blots/block/embed');
    class CardButtonBlot extends BlockEmbed {
      static create(value) {
        const node = super.create();
        const v = value || {};
        const style = v.style || 'primary';
        const href = v.href || '';
        const text = v.text || '버튼';
        const size = v.size || 'md';
        node.setAttribute('data-href', href);
        node.setAttribute('data-style', style);
        node.setAttribute('data-text', text);
        node.setAttribute('data-size', size);
        node.classList.add('ql-cardbtn-wrap');
        const a = document.createElement('a');
        a.className = 'ql-cardbtn ql-cardbtn--' + style + ' ql-cardbtn--' + size;
        a.textContent = text;
        if (href) { a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
        node.appendChild(a);
        return node;
      }
      static value(node) {
        return {
          href: node.getAttribute('data-href') || '',
          style: node.getAttribute('data-style') || 'primary',
          text: node.getAttribute('data-text') || '',
          size: node.getAttribute('data-size') || 'md',
        };
      }
    }
    CardButtonBlot.blotName = 'cardbutton';
    CardButtonBlot.tagName = 'div';
    Q.register(CardButtonBlot);
    Q.__cardBtnRegistered = true;
  }

  function registerBenefitAccordionBlot(Q) {
    if (!Q || Q.__baccRegistered) return;
    const be = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const BlockEmbed = Q.import('blots/block/embed');
    class BenefitAccordionBlot extends BlockEmbed {
      static create(value) {
        const node = super.create();
        const v = value || {};
        const title = v.title || '';
        const items = Array.isArray(v.items) ? v.items : [];
        node.setAttribute('data-title', title);
        node.setAttribute('data-items', JSON.stringify(items));
        node.classList.add('bacc');
        const tableHtml = (tbl) => {
          if (!tbl || !Array.isArray(tbl.cells) || !tbl.cells.length) return '';
          let h = '<table class="bacc-table">';
          tbl.cells.forEach((row, ri) => {
            h += '<tr>';
            (row || []).forEach((cell) => {
              const tag = (tbl.header && ri === 0) ? 'th' : 'td';
              h += '<' + tag + '>' + be(cell || '').replace(/\n/g, '<br>') + '</' + tag + '>';
            });
            h += '</tr>';
          });
          return h + '</table>';
        };
        let html = title ? '<div class="bacc-title">' + be(title) + '</div>' : '';
        html += '<div class="bacc-list">';
        items.forEach((it) => {
          const bodyInner = (it.body ? baccRichBody(it.body) : '') + tableHtml(it.table);
          html += '<div class="bacc-row">' +
            '<div class="bacc-head">' +
            '<span class="bacc-rtitle">' + be(it.title || '') + '</span>' +
            '<span class="bacc-rsub">' + be(it.subtitle || '') + '</span>' +
            '<span class="bacc-chev" aria-hidden="true">⌄</span>' +
            '</div>' +
            (bodyInner ? '<div class="bacc-body">' + bodyInner + '</div>' : '') +
            '</div>';
        });
        html += '</div>';
        node.innerHTML = html;
        return node;
      }
      static value(node) {
        let items = [];
        try { items = JSON.parse(node.getAttribute('data-items') || '[]'); } catch (e) {}
        return { title: node.getAttribute('data-title') || '', items: items };
      }
    }
    BenefitAccordionBlot.blotName = 'benefitaccordion';
    BenefitAccordionBlot.tagName = 'div';
    Q.register(BenefitAccordionBlot);
    Q.__baccRegistered = true;
  }

  function registerTableBlot(Q) {
    if (!Q || Q.__tblRegistered) return;
    const be = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const BlockEmbed = Q.import('blots/block/embed');
    class CardTableBlot extends BlockEmbed {
      static create(value) {
        const node = super.create();
        const v = value || {};
        const cells = Array.isArray(v.cells) ? v.cells : [];
        const header = !!v.header;
        node.setAttribute('data-cells', JSON.stringify(cells));
        node.setAttribute('data-header', header ? '1' : '0');
        node.classList.add('ql-ctable-wrap');
        let html = '<table class="ql-ctable">';
        cells.forEach((row, ri) => {
          html += '<tr>';
          (row || []).forEach((cell) => {
            const tag = (header && ri === 0) ? 'th' : 'td';
            html += '<' + tag + '>' + be(cell || '').replace(/\n/g, '<br>') + '</' + tag + '>';
          });
          html += '</tr>';
        });
        html += '</table>';
        node.innerHTML = html;
        return node;
      }
      static value(node) {
        let cells = [];
        try { cells = JSON.parse(node.getAttribute('data-cells') || '[]'); } catch (e) {}
        return { cells: cells, header: node.getAttribute('data-header') === '1' };
      }
    }
    CardTableBlot.blotName = 'cardtable';
    CardTableBlot.tagName = 'div';
    Q.register(CardTableBlot);
    Q.__tblRegistered = true;
  }

  function deltaToHtml(ops) {
    if (typeof Quill === 'undefined' || !Array.isArray(ops)) return '';
    registerCardButtonBlot(Quill);
    registerBenefitAccordionBlot(Quill);
    registerTableBlot(Quill);
    const tmp = document.createElement('div');
    const q = new Quill(tmp, { modules: { toolbar: false }, readOnly: true });
    q.setContents({ ops: ops });
    return q.root.innerHTML;
  }

  function benefitHtml(icon, l, v, post) {
    if (!(l || v || post)) return '';
    const ic = icon
      ? '<i data-lucide="' + esc(icon) + '" class="ccd-bicon"></i>'
      : '<span class="ccd-bicon-empty"></span>';
    return (
      '<li>' + ic + '<span>' + esc(l || '') +
      (v ? ' <b>' + esc(v) + '</b>' : '') +
      (post ? ' ' + esc(post) : '') +
      '</span></li>'
    );
  }

  function setMeta(card) {
    const t = (card.title || '다픽 카드') + ' | 다픽 카드';
    document.title = t;
    const setAttr = (sel, attr, val) => {
      const el = document.querySelector(sel);
      if (el && val) el.setAttribute(attr, val);
    };
    setAttr('meta[property="og:title"]', 'content', t);
    if (card.imageUrl) setAttr('meta[property="og:image"]', 'content', card.imageUrl);
    setAttr('meta[property="og:url"]', 'content', location.origin + location.pathname);
    setAttr('link[rel="canonical"]', 'href', location.origin + location.pathname);
  }

  function render(card) {
    const cat = cdCatMap[card.categoryId] || {};
    const catName = cat.name || '';
    const ctaHref = card.detailUrl || cat.siteUrl || '#';
    const typeBadge = card.cardType === 'check'
      ? '<span class="ccd-type check">체크</span>'
      : '<span class="ccd-type credit">신용</span>';

    const img = card.imageUrl
      ? '<img src="' + esc(card.imageUrl) + '" alt="' + esc(card.title || '') + '" />'
      : '<span class="noimg">카드 이미지</span>';
    const badge = card.badge ? '<span class="ccd-badge">' + esc(card.badge) + '</span>' : '';
    const max = card.maxBenefit ? '<span class="ccd-max">최대 ' + esc(card.maxBenefit) + '</span>' : '';
    const benefits = [
      benefitHtml(card.benefit1Icon, card.benefit1Label, card.benefit1Value, card.benefit1Post),
      benefitHtml(card.benefit2Icon, card.benefit2Label, card.benefit2Value, card.benefit2Post),
      benefitHtml(card.benefit3Icon, card.benefit3Label, card.benefit3Value, card.benefit3Post),
    ].join('');
    const metas = [card.metaLeft, card.metaRight, card.metaNote]
      .filter(Boolean).map((m) => '<span>' + esc(m) + '</span>').join('');

    const ops = detailOps(card.detailContent);
    const bodyHtml = ops && ops.length
      ? '<div class="ql-snow"><div class="ql-editor ccd-ql">' + deltaToHtml(ops) + '</div></div>'
      : '<p class="ccd-empty">상세 정보가 아직 등록되지 않았습니다.</p>';

    document.getElementById('cdArticle').innerHTML =
      '<div class="ccd-crumb"><a href="/card">카드</a> › ' + esc(catName || '카드') + '</div>' +
      '<div class="ccd-hero">' +
        '<div class="ccd-img">' + img + '</div>' +
        '<div class="ccd-body">' +
          '<div class="ccd-badgerow">' + max + badge + '</div>' +
          '<div class="ccd-title">' + esc(card.title || '카드') + typeBadge + '</div>' +
          (catName ? '<div class="ccd-cat">' + esc(catName) + '</div>' : '') +
          (benefits ? '<ul class="ccd-benefits">' + benefits + '</ul>' : '') +
          '<a class="ccd-cta" href="' + esc(ctaHref) + '"' +
            (ctaHref !== '#' ? ' target="_blank" rel="noopener"' : '') + '>카드사 바로가기 ›</a>' +
          (metas ? '<div class="ccd-meta">' + metas + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ccd-detail-label">상세 정보</div>' +
      '<div class="ccd-detail">' + bodyHtml + '</div>' +
      '<a class="ccd-list" href="/card">목록으로</a>';

    document.getElementById('cdArticle').hidden = false;
    const load = document.getElementById('cdLoading');
    if (load) load.remove();
    setMeta(card);
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  function renderError(msg) {
    const load = document.getElementById('cdLoading');
    if (load) load.textContent = msg || '카드를 불러오지 못했습니다.';
  }

  function injectStyles() {
    const css =
      ".ccd-wrap{max-width:900px;margin:24px auto 60px;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.ccd-loading{padding:80px 0;text-align:center;color:#9a9aa5;}' +
      '.ccd-crumb{font-size:13px;color:#8a8a99;margin-bottom:14px;}' +
      '.ccd-crumb a{color:#8a8a99;text-decoration:none;}' +
      '.ccd-hero{background:#fff;border:1px solid #eee;border-radius:20px;padding:28px;display:flex;gap:28px;align-items:center;flex-wrap:wrap;box-shadow:0 2px 16px rgba(24,23,43,.05);}' +
      '.ccd-img{width:230px;height:150px;flex-shrink:0;border-radius:14px;background:radial-gradient(circle at 50% 45%,#eef2f9 0 60%,#f6f8fc 61%);display:flex;align-items:center;justify-content:center;overflow:hidden;}' +
      '.ccd-img img{max-width:100%;max-height:100%;object-fit:contain;}' +
      '.ccd-img .noimg{color:#b7bccb;font-size:12px;}' +
      '.ccd-body{flex:1;min-width:260px;}' +
      '.ccd-badgerow{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;}' +
      '.ccd-max{color:#f36f21;font-weight:800;font-size:15px;}' +
      '.ccd-badge{font-size:12px;font-weight:800;color:#f36f21;background:#fff1e6;border-radius:999px;padding:3px 11px;}' +
      '.ccd-title{font-size:26px;font-weight:900;color:#18172b;line-height:1.25;}' +
      '.ccd-type{font-size:11px;font-weight:800;border-radius:999px;padding:2px 9px;margin-left:8px;vertical-align:middle;}' +
      '.ccd-type.credit{color:#7c3aed;background:#f3efff;}' +
      '.ccd-type.check{color:#0891b2;background:#e0f7fb;}' +
      '.ccd-cat{font-size:14px;color:#8a8fa3;margin-top:3px;}' +
      '.ccd-benefits{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:10px;}' +
      '.ccd-benefits li{display:flex;align-items:center;gap:10px;font-size:15px;color:#3a3a48;}' +
      '.ccd-benefits li b{color:#18172b;}' +
      '.ccd-bicon{width:20px;height:20px;color:#5b3fbe;flex-shrink:0;}' +
      '.ccd-bicon-empty{width:20px;flex-shrink:0;display:inline-block;}' +
      '.ccd-cta{display:block;text-align:center;margin-top:18px;background:#ffce2e;color:#1c1c22;font-weight:900;font-size:17px;border-radius:14px;padding:16px;text-decoration:none;}' +
      '.ccd-meta{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;font-size:13px;color:#8a8fa3;}' +
      '.ccd-detail-label{font-size:18px;font-weight:800;color:#1e1b2e;margin:34px 0 0;}' +
      '.ccd-detail{border-top:1px solid #eee;margin-top:12px;padding-top:22px;font-size:16px;line-height:1.8;}' +
      '.ccd-detail .ql-snow{border:none;}' +
      '.ccd-detail .ql-editor{padding:0;font-size:16px;line-height:1.8;color:#2a2a35;}' +
      '.ccd-detail .ql-editor img{max-width:100%;height:auto;border-radius:12px;display:block;margin:14px auto;}' +
      '.ccd-empty{color:#b0aac2;padding:20px 0;}' +
      '.ccd-detail .ql-cardbtn-wrap{text-align:center;margin:16px 0;}' +
      ".ccd-detail .ql-cardbtn{display:inline-block;min-width:60%;text-align:center;font-weight:800;border-radius:12px;text-decoration:none;}" +
      '.ccd-detail .ql-cardbtn--primary{background:#5b3fbe;color:#fff;}' +
      '.ccd-detail .ql-cardbtn--yellow{background:#ffce2e;color:#1c1c22;}' +
      '.ccd-detail .ql-cardbtn--outline{background:#fff;color:#5b3fbe;border:2px solid #5b3fbe;}' +
      '.ccd-detail .ql-cardbtn--sm{padding:9px 18px;font-size:14px;}' +
      '.ccd-detail .ql-cardbtn--md{padding:14px 24px;font-size:16px;}' +
      '.ccd-detail .ql-cardbtn--lg{padding:20px 32px;font-size:19px;}' +
      '.ccd-detail .bacc{margin:18px 0;}' +
      '.ccd-detail .bacc-title{font-size:20px;font-weight:900;color:#18172b;margin:0 0 14px;}' +
      '.ccd-detail .bacc-list{display:flex;flex-direction:column;gap:12px;}' +
      '.ccd-detail .bacc-row{background:#fff;border:1px solid #eee;border-radius:14px;box-shadow:0 1px 6px rgba(24,23,43,.04);overflow:hidden;}' +
      '.ccd-detail .bacc-head{display:flex;align-items:center;gap:18px;padding:18px 22px;cursor:pointer;}' +
      '.ccd-detail .bacc-rtitle{font-weight:800;color:#18172b;font-size:15px;flex-shrink:0;min-width:92px;}' +
      '.ccd-detail .bacc-rsub{flex:1;color:#5a5a68;font-size:14px;}' +
      '.ccd-detail .bacc-chev{color:#b0b0bd;transition:transform .2s;flex-shrink:0;}' +
      '.ccd-detail .bacc-row.open .bacc-chev{transform:rotate(180deg);}' +
      '.ccd-detail .bacc-body{display:none;padding:16px 22px 18px;color:#3a3a48;font-size:14px;line-height:1.7;border-top:1px solid #f2f2f5;}' +
      '.ccd-detail .bacc-row.open .bacc-body{display:block;}' +
      '.ccd-detail .bacc-table{border-collapse:collapse;width:100%;margin:10px 0 2px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.ccd-detail .bacc-table th,.ccd-detail .bacc-table td{border:1px solid #e5e7eb;padding:10px 14px;font-size:13.5px;text-align:left;color:#374151;line-height:1.5;}' +
      '.ccd-detail .bacc-table th{background:#f8f9fb;font-weight:700;color:#111827;}' +
      '.ccd-detail .ql-ctable-wrap{margin:16px 0;overflow-x:auto;}' +
      '.ccd-detail .ql-ctable{border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.ccd-detail .ql-ctable th,.ccd-detail .ql-ctable td{border:1px solid #e5e7eb;padding:11px 14px;font-size:14px;text-align:left;color:#374151;line-height:1.5;}' +
      '.ccd-detail .ql-ctable th{background:#f8f9fb;font-weight:700;color:#111827;}' +
      '.ccd-list{display:block;text-align:center;background:#fff;border:1px solid #d7d2e6;border-radius:12px;padding:13px;font-size:14px;font-weight:600;color:#555;text-decoration:none;margin-top:28px;}' +
      '@media(max-width:768px){.ccd-hero{padding:20px;gap:18px;}.ccd-title{font-size:22px;}.ccd-img{width:100%;height:170px;}.ccd-cta{font-size:16px;}}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  document.addEventListener('click', function (e) {
    const h = e.target.closest && e.target.closest('.bacc-head');
    if (h && h.parentElement) h.parentElement.classList.toggle('open');
  });

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const id = parseId();
    if (!id) {
      renderError('잘못된 접근입니다.');
      return;
    }
    // 카드사명 매핑용 카테고리 먼저(실패해도 진행)
    api.get('/api/card-categories')
      .then((list) => {
        (Array.isArray(list) ? list : (list && list.content) || []).forEach((c) => {
          cdCatMap[c.id] = { name: c.name, siteUrl: c.siteUrl, logoUrl: c.logoUrl };
        });
      })
      .catch(() => {})
      .finally(() => {
        api.get('/api/cards/' + id)
          .then((c) => {
            if (!c) { renderError('카드를 찾을 수 없습니다.'); return; }
            render(c);
          })
          .catch(() => renderError('카드를 불러오지 못했습니다.'));
      });
  });
})();
