// ════════════════════════════════════════════════════
// faq.js (web) — FAQ 공개 페이지: 카테고리 5탭 + 질문 아코디언
// GET /api/faqs → 카테고리별 그룹, 질문 클릭 시 답변(Quill Delta) 펼침.
// ※ 커스텀 blot(cardbutton/benefitaccordion/cardtable) 렌더는 카드/이벤트와 동일 로직 재사용.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

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

  // ── FAQ 카테고리 5탭 + 아코디언 (홈 faq-* 스타일/toggleFaq 재사용) ──
  const FAQ_CATS = [
    { code: 'PHONE', label: '휴대폰' },
    { code: 'INTERNET_TV', label: '인터넷TV' },
    { code: 'CARD', label: '카드' },
    { code: 'WATER', label: '정수기' },
    { code: 'RENTAL', label: '렌탈' },
  ];
  let faqData = [];
  let activeCat = 'PHONE';

  function renderTabs() {
    const bar = document.getElementById('faqTabs');
    if (!bar) return;
    bar.innerHTML = FAQ_CATS.map((c) =>
      '<button class="cfaq-tab' + (c.code === activeCat ? ' on' : '') + '" data-cat="' + c.code + '">' + esc(c.label) + '</button>'
    ).join('');
  }

  function answerHtml(f) {
    const ops = detailOps(f.detailContent);
    return ops && ops.length
      ? '<div class="ql-snow"><div class="ql-editor cfaq-ql">' + deltaToHtml(ops) + '</div></div>'
      : '<span class="cfaq-noans">답변이 준비 중입니다.</span>';
  }

  // 홈(index.html)과 동일한 faq-* 마크업 + toggleFaq(utils.js) 재사용
  function itemHtml(f) {
    return '<div class="faq-item">' +
      '<div class="faq-q" onclick="toggleFaq(this)"><span>Q. ' + esc(f.question || '') + '</span><span class="faq-icon">∨</span></div>' +
      '<div class="faq-a"><div class="faq-a-inner">' + answerHtml(f) + '</div></div>' +
      '</div>';
  }

  function renderList() {
    const wrap = document.getElementById('faqList');
    if (!wrap) return;
    const rows = faqData.filter((f) => f.category === activeCat);
    wrap.innerHTML = rows.length
      ? rows.map(itemHtml).join('')
      : '<div class="cfaq-empty2">등록된 질문이 없습니다.</div>';
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  // 탭 클릭
  document.addEventListener('click', function (e) {
    const t = e.target.closest && e.target.closest('.cfaq-tab');
    if (t && t.dataset.cat) { activeCat = t.dataset.cat; renderTabs(); renderList(); }
  });
  // 답변 내부 혜택 아코디언 펼치기(있을 때) — FAQ 토글과 별개 요소
  // ※ js/common/rich-render.js 에도 같은 위임 핸들러가 있다. 마이페이지는 둘 다 싣기 때문에
  //   깃발 없이 두면 한 번 클릭에 두 번 토글돼서 아코디언이 안 열린다. 먼저 붙은 쪽이 담당.
  if (!window.__dpBaccToggleBound) {
    window.__dpBaccToggleBound = true;
    document.addEventListener('click', function (e) {
      const h = e.target.closest && e.target.closest('.bacc-head');
      if (h && h.parentElement) h.parentElement.classList.toggle('open');
    });
  }

  function injectStyles() {
    const css =
      ".cfaq-wrap{max-width:860px;margin:24px auto 60px;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.cfaq-head{font-size:26px;font-weight:900;color:#18172b;margin:8px 0 4px;}' +
      '.cfaq-sub{font-size:14px;color:#8a8fa3;margin-bottom:18px;}' +
      '.cfaq-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;}' +
      '.cfaq-tab{border:1px solid #e0dcef;background:#fff;color:#6b6b7b;font-size:14px;font-weight:700;border-radius:999px;padding:8px 18px;cursor:pointer;font-family:inherit;}' +
      '.cfaq-tab:hover{border-color:#5b3fbe;color:#5b3fbe;}' +
      '.cfaq-tab.on{background:#5b3fbe;border-color:#5b3fbe;color:#fff;}' +
      '.cfaq-empty2{padding:50px 0;text-align:center;color:#b0b0bd;}' +
      '.cfaq-noans{color:#b0aac2;}' +
      // 리치 답변이 잘리지 않게 홈의 max-height:200px 제한 해제
      '.cfaq-wrap .faq-a.open{max-height:none;}' +
      '.faq-a-inner .ql-snow{border:none;}' +
      '.faq-a-inner .ql-editor{padding:0;font-size:14px;line-height:1.8;color:#3a3a48;}' +
      '.faq-a-inner .ql-editor img{max-width:100%;height:auto;border-radius:10px;display:block;margin:12px auto;}' +
      '.faq-a-inner .ql-cardbtn-wrap{text-align:center;margin:14px 0;}' +
      '.faq-a-inner .ql-cardbtn{display:inline-block;min-width:60%;text-align:center;font-weight:800;border-radius:12px;text-decoration:none;}' +
      '.faq-a-inner .ql-cardbtn--primary{background:#5b3fbe;color:#fff;}' +
      '.faq-a-inner .ql-cardbtn--yellow{background:#ffce2e;color:#1c1c22;}' +
      '.faq-a-inner .ql-cardbtn--outline{background:#fff;color:#5b3fbe;border:2px solid #5b3fbe;}' +
      '.faq-a-inner .ql-cardbtn--sm{padding:9px 18px;font-size:14px;}' +
      '.faq-a-inner .ql-cardbtn--md{padding:13px 22px;font-size:15px;}' +
      '.faq-a-inner .ql-cardbtn--lg{padding:18px 30px;font-size:18px;}' +
      '.faq-a-inner .bacc{margin:14px 0;}' +
      '.faq-a-inner .bacc-title{font-size:17px;font-weight:900;color:#18172b;margin:0 0 10px;}' +
      '.faq-a-inner .bacc-list{display:flex;flex-direction:column;gap:10px;}' +
      '.faq-a-inner .bacc-row{background:#faf9fe;border:1px solid #eee;border-radius:12px;overflow:hidden;}' +
      '.faq-a-inner .bacc-head{display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;}' +
      '.faq-a-inner .bacc-rtitle{font-weight:800;color:#18172b;font-size:14px;flex-shrink:0;min-width:80px;}' +
      '.faq-a-inner .bacc-rsub{flex:1;color:#5a5a68;font-size:13.5px;}' +
      '.faq-a-inner .bacc-chev{color:#b0b0bd;transition:transform .2s;flex-shrink:0;}' +
      '.faq-a-inner .bacc-row.open .bacc-chev{transform:rotate(180deg);}' +
      '.faq-a-inner .bacc-body{display:none;padding:14px 18px 16px;color:#3a3a48;font-size:13.5px;line-height:1.7;border-top:1px solid #f2f2f5;}' +
      '.faq-a-inner .bacc-row.open .bacc-body{display:block;}' +
      '.faq-a-inner .bacc-table,.faq-a-inner .ql-ctable{border-collapse:collapse;width:100%;margin:10px 0 2px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.faq-a-inner .bacc-table th,.faq-a-inner .bacc-table td,.faq-a-inner .ql-ctable th,.faq-a-inner .ql-ctable td{border:1px solid #e5e7eb;padding:9px 12px;font-size:13px;text-align:left;color:#374151;line-height:1.5;}' +
      '.faq-a-inner .bacc-table th,.faq-a-inner .ql-ctable th{background:#f8f9fb;font-weight:700;color:#111827;}' +
      '.faq-a-inner .ql-ctable-wrap{margin:12px 0;overflow-x:auto;}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    renderTabs();
    api.get('/api/faqs')
      .then((list) => { faqData = Array.isArray(list) ? list : (list && list.content) || []; renderList(); })
      .catch(() => { const w = document.getElementById('faqList'); if (w) w.innerHTML = '<div class="cfaq-empty2">FAQ를 불러오지 못했습니다.</div>'; });
  });
})();
