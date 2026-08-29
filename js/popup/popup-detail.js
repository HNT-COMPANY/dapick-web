//
// popup-detail.js — 팝업 상세페이지 (독립 페이지)
// URL: popup-detail.html?id={id}
// GET /api/popups/{id} → 헤더(제목·기간) + Quill Delta 본문(detailContent) 렌더 + 이전/다음 글.
// ※ 커스텀 blot(cardbutton/benefitaccordion/cardtable) 렌더는 카드 상세와 동일 로직 재사용.
//
(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 아코디언 본문 경량 서식: 굵게 + 줄바꿈. 관리자(card-detail-edit.js)와 동일 로직 유지 필수.
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
    const t = (card.title || '다픽 안내') + ' | 다픽';
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

  function fmtDt(dt) { return dt ? String(dt).replace('T', ' ').slice(0, 16) : ''; }
  function periodText(e) {
    if (!e.startAt && !e.endAt) return '';
    return (fmtDt(e.startAt) || '?') + ' ~ ' + (fmtDt(e.endAt) || '?');
  }

  // 이전/다음 글 한 줄 (이미지5 참고). 대상 없으면 비활성.
  function navRow(label, id, title) {
    if (id) {
      return '<a class="cev-navrow" href="event-detail.html?id=' + id + '">' +
        '<span class="cev-navlabel">' + label + '</span>' +
        '<span class="cev-navtitle">' + esc(title || '') + '</span></a>';
    }
    return '<div class="cev-navrow disabled">' +
      '<span class="cev-navlabel">' + label + '</span>' +
      '<span class="cev-navtitle none">' + label + '이 존재하지 않습니다.</span></div>';
  }

  function render(p) {
    const img = p.imageUrl
      ? '<div class="cev-hero-img"><img src="' + esc(p.imageUrl) + '" alt="' + esc(p.title || '') + '" /></div>'
      : '';
    const ops = detailOps(p.detailContent);
    const bodyHtml = ops && ops.length
      ? '<div class="ql-snow"><div class="ql-editor ccd-ql">' + deltaToHtml(ops) + '</div></div>'
      : '<p class="ccd-empty">상세 내용이 아직 등록되지 않았습니다.</p>';
    document.getElementById('cdArticle').innerHTML =
      '<div class="ccd-crumb"><a href="/">홈</a> › ' + esc(p.title || '안내') + '</div>' +
      '<div class="cev-head"><div class="cev-titlerow"><h1 class="cev-title">' + esc(p.title || '안내') + '</h1></div></div>' +
      img +
      '<div class="ccd-detail">' + bodyHtml + '</div>' +
      '<a class="ccd-list" href="/">홈으로</a>';
    document.getElementById('cdArticle').hidden = false;
    const load = document.getElementById('cdLoading');
    if (load) load.remove();
    setMeta(p);
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  function renderError(msg) {
    const load = document.getElementById('cdLoading');
    if (load) load.textContent = msg || '내용을 불러오지 못했습니다.';
  }

  function injectStyles() {
    const css =
      ".ccd-wrap{max-width:900px;margin:24px auto 60px;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.ccd-loading{padding:80px 0;text-align:center;color:#9a9aa5;}' +
      '.ccd-crumb{font-size:13px;color:#8a8a99;margin-bottom:16px;}' +
      '.ccd-crumb a{color:#8a8a99;text-decoration:none;}' +
      // ── 이벤트 헤더 ──
      '.cev-head{padding-bottom:18px;border-bottom:2px solid #18172b;}' +
      '.cev-titlerow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}' +
      '.cev-title{font-size:26px;font-weight:900;color:#18172b;line-height:1.3;margin:0;}' +
      '.cev-status{font-size:12px;font-weight:800;border-radius:999px;padding:3px 12px;flex-shrink:0;}' +
      '.cev-status.ongoing{color:#0a7d3b;background:#e6f7ee;}' +
      '.cev-status.ended{color:#8a8fa3;background:#f1f2f5;}' +
      '.cev-period{font-size:14px;color:#8a8fa3;margin-top:10px;}' +
      '.cev-hero-img{margin:22px 0;border-radius:14px;overflow:hidden;}' +
      '.cev-hero-img img{width:100%;height:auto;display:block;}' +
      // ── 이전/다음 글 (이미지5) ──
      '.cev-nav{margin-top:34px;border-top:1px solid #e5e5ee;}' +
      '.cev-navrow{display:flex;align-items:center;gap:16px;padding:15px 4px;border-bottom:1px solid #eee;text-decoration:none;}' +
      'a.cev-navrow:hover .cev-navtitle{color:#5b3fbe;}' +
      '.cev-navlabel{flex-shrink:0;width:64px;font-size:14px;font-weight:700;color:#18172b;}' +
      '.cev-navtitle{font-size:14px;color:#3a3a48;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.cev-navtitle.none{color:#b0b0bd;}' +
      '.ccd-detail{margin-top:26px;font-size:16px;line-height:1.8;}' +
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
    api.get('/api/popups/' + id)
      .then((e) => {
        if (!e) { renderError('내용을 찾을 수 없습니다.'); return; }
        render(e);
      })
      .catch(() => renderError('내용을 불러오지 못했습니다.'));
  });
})();
