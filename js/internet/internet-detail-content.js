// ════════════════════════════════════════════════════
// internet-detail-content.js — 인터넷·TV 통합 페이지 '상세정보' 본문 렌더
//   · 관리자(internet-tv-edit) 리치 에디터가 저장한 Quill Delta(detailContent)를 렌더.
//   · 커스텀 blot(cardbutton/benefitaccordion/cardtable) 렌더는 카드/이벤트/FAQ 와 동일 로직(shape 일치 필수).
//   · '상세정보 더보기' 접힘 박스(흰색 페이드) — 내용이 길면 접고, 버튼으로 펼침.
//   노출: window.ItvDetailContent.render(product)  ← base.js 가 상품 로드 후 호출
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  var COLLAPSED_MAX = 340; // px — 이보다 길면 접고 '더보기' 노출

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 아코디언 본문 경량 서식: **굵게** + 줄바꿈. 관리자(rich-editor.js)와 동일 로직 유지 필수.
  function baccRichBody(s) {
    return esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  function detailOps(raw) {
    if (!raw) return null;
    try {
      var d = JSON.parse(raw);
      return Array.isArray(d) ? d : (d && d.ops) || null;
    } catch (e) {
      return null;
    }
  }

  function registerCardButtonBlot(Q) {
    if (!Q || Q.__cardBtnRegistered) return;
    var BlockEmbed = Q.import('blots/block/embed');
    class CardButtonBlot extends BlockEmbed {
      static create(value) {
        var node = super.create();
        var v = value || {};
        var style = v.style || 'primary';
        var href = v.href || '';
        var text = v.text || '버튼';
        var size = v.size || 'md';
        node.setAttribute('data-href', href);
        node.setAttribute('data-style', style);
        node.setAttribute('data-text', text);
        node.setAttribute('data-size', size);
        node.classList.add('ql-cardbtn-wrap');
        var a = document.createElement('a');
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
    var be = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var BlockEmbed = Q.import('blots/block/embed');
    class BenefitAccordionBlot extends BlockEmbed {
      static create(value) {
        var node = super.create();
        var v = value || {};
        var title = v.title || '';
        var items = Array.isArray(v.items) ? v.items : [];
        node.setAttribute('data-title', title);
        node.setAttribute('data-items', JSON.stringify(items));
        node.classList.add('bacc');
        var tableHtml = function (tbl) {
          if (!tbl || !Array.isArray(tbl.cells) || !tbl.cells.length) return '';
          var h = '<table class="bacc-table">';
          tbl.cells.forEach(function (row, ri) {
            h += '<tr>';
            (row || []).forEach(function (cell) {
              var tag = (tbl.header && ri === 0) ? 'th' : 'td';
              h += '<' + tag + '>' + be(cell || '').replace(/\n/g, '<br>') + '</' + tag + '>';
            });
            h += '</tr>';
          });
          return h + '</table>';
        };
        var html = title ? '<div class="bacc-title">' + be(title) + '</div>' : '';
        html += '<div class="bacc-list">';
        items.forEach(function (it) {
          var bodyInner = (it.body ? baccRichBody(it.body) : '') + tableHtml(it.table);
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
        var items = [];
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
    var be = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var BlockEmbed = Q.import('blots/block/embed');
    class CardTableBlot extends BlockEmbed {
      static create(value) {
        var node = super.create();
        var v = value || {};
        var cells = Array.isArray(v.cells) ? v.cells : [];
        var header = !!v.header;
        node.setAttribute('data-cells', JSON.stringify(cells));
        node.setAttribute('data-header', header ? '1' : '0');
        node.classList.add('ql-ctable-wrap');
        var html = '<table class="ql-ctable">';
        cells.forEach(function (row, ri) {
          html += '<tr>';
          (row || []).forEach(function (cell) {
            var tag = (header && ri === 0) ? 'th' : 'td';
            html += '<' + tag + '>' + be(cell || '').replace(/\n/g, '<br>') + '</' + tag + '>';
          });
          html += '</tr>';
        });
        html += '</table>';
        node.innerHTML = html;
        return node;
      }
      static value(node) {
        var cells = [];
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
    var tmp = document.createElement('div');
    var q = new Quill(tmp, { modules: { toolbar: false }, readOnly: true });
    q.setContents({ ops: ops });
    return q.root.innerHTML;
  }

  // 스코프 CSS 1회 주입 (.ipd-* — 카드 상세 .ccd-detail 규칙을 이식)
  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var css =
      '.ipd-box{max-width:760px;margin:26px auto 150px;padding:0 16px;font-family:"Noto Sans KR",sans-serif;}' +
      '.ipd-label{font-size:17px;font-weight:800;color:#1e1b2e;margin:0 0 12px;}' +
      '.ipd-content{position:relative;border-top:1px solid #eee;padding-top:20px;overflow:hidden;transition:max-height .28s ease;}' +
      '.ipd-content.ipd-collapsed{max-height:' + COLLAPSED_MAX + 'px;}' +
      '.ipd-fade{position:absolute;left:0;right:0;bottom:0;height:96px;pointer-events:none;' +
        'background:linear-gradient(to bottom,rgba(255,255,255,0) 0%,rgba(255,255,255,.85) 62%,#fff 100%);display:none;}' +
      '.ipd-content.ipd-collapsed .ipd-fade{display:block;}' +
      '.ipd-more{display:block;width:100%;margin-top:12px;background:#fff;border:1px solid #d7d2e6;border-radius:12px;' +
        'padding:13px;font-size:14px;font-weight:700;color:#5b3fbe;cursor:pointer;font-family:inherit;}' +
      '.ipd-more:hover{background:#f7f5ff;border-color:#b7a8ee;}' +
      '.ipd-empty{color:#b0aac2;padding:18px 0;font-size:14px;}' +
      // Quill 본문 기본
      '.ipd-content .ql-snow{border:none;}' +
      '.ipd-content .ql-editor{padding:0;font-size:15px;line-height:1.8;color:#2a2a35;}' +
      '.ipd-content .ql-editor img{max-width:100%;height:auto;border-radius:12px;display:block;margin:14px auto;}' +
      // 버튼 blot
      '.ipd-content .ql-cardbtn-wrap{text-align:center;margin:16px 0;}' +
      '.ipd-content .ql-cardbtn{display:inline-block;min-width:60%;text-align:center;font-weight:800;border-radius:12px;text-decoration:none;}' +
      '.ipd-content .ql-cardbtn--primary{background:#5b3fbe;color:#fff;}' +
      '.ipd-content .ql-cardbtn--yellow{background:#ffce2e;color:#1c1c22;}' +
      '.ipd-content .ql-cardbtn--outline{background:#fff;color:#5b3fbe;border:2px solid #5b3fbe;}' +
      '.ipd-content .ql-cardbtn--sm{padding:9px 18px;font-size:14px;}' +
      '.ipd-content .ql-cardbtn--md{padding:14px 24px;font-size:16px;}' +
      '.ipd-content .ql-cardbtn--lg{padding:20px 32px;font-size:19px;}' +
      // 혜택 아코디언 blot
      '.ipd-content .bacc{margin:18px 0;}' +
      '.ipd-content .bacc-title{font-size:19px;font-weight:900;color:#18172b;margin:0 0 14px;}' +
      '.ipd-content .bacc-list{display:flex;flex-direction:column;gap:12px;}' +
      '.ipd-content .bacc-row{background:#fff;border:1px solid #eee;border-radius:14px;box-shadow:0 1px 6px rgba(24,23,43,.04);overflow:hidden;}' +
      '.ipd-content .bacc-head{display:flex;align-items:center;gap:18px;padding:16px 20px;cursor:pointer;}' +
      '.ipd-content .bacc-rtitle{font-weight:800;color:#18172b;font-size:15px;flex-shrink:0;min-width:92px;}' +
      '.ipd-content .bacc-rsub{flex:1;color:#5a5a68;font-size:14px;}' +
      '.ipd-content .bacc-chev{color:#b0b0bd;transition:transform .2s;flex-shrink:0;}' +
      '.ipd-content .bacc-row.open .bacc-chev{transform:rotate(180deg);}' +
      '.ipd-content .bacc-body{display:none;padding:16px 20px 18px;color:#3a3a48;font-size:14px;line-height:1.7;border-top:1px solid #f2f2f5;}' +
      '.ipd-content .bacc-row.open .bacc-body{display:block;}' +
      '.ipd-content .bacc-table{border-collapse:collapse;width:100%;margin:10px 0 2px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.ipd-content .bacc-table th,.ipd-content .bacc-table td{border:1px solid #e5e7eb;padding:10px 14px;font-size:13.5px;text-align:left;color:#374151;line-height:1.5;}' +
      '.ipd-content .bacc-table th{background:#f8f9fb;font-weight:700;color:#111827;}' +
      // 표 blot
      '.ipd-content .ql-ctable-wrap{margin:16px 0;overflow-x:auto;}' +
      '.ipd-content .ql-ctable{border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.ipd-content .ql-ctable th,.ipd-content .ql-ctable td{border:1px solid #e5e7eb;padding:11px 14px;font-size:14px;text-align:left;color:#374151;line-height:1.5;}' +
      '.ipd-content .ql-ctable th{background:#f8f9fb;font-weight:700;color:#111827;}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 접힘/펼침 상태 갱신 — 내용이 짧으면 더보기 버튼/페이드 제거
  function syncCollapse(box) {
    var content = box.querySelector('.ipd-content');
    var more = box.querySelector('.ipd-more');
    if (!content || !more) return;
    // 실제 내용 높이 측정을 위해 잠시 펼침
    var wasCollapsed = content.classList.contains('ipd-collapsed');
    content.classList.remove('ipd-collapsed');
    var full = content.scrollHeight;
    if (wasCollapsed) content.classList.add('ipd-collapsed');
    if (full <= COLLAPSED_MAX + 24) {
      // 짧음 → 접지 않고 전체 노출, 버튼 숨김
      content.classList.remove('ipd-collapsed');
      more.style.display = 'none';
    } else {
      content.classList.add('ipd-collapsed');
      more.style.display = 'block';
      more.textContent = '상세정보 더보기 ▾';
    }
  }

  function bindToggle(box) {
    var more = box.querySelector('.ipd-more');
    var content = box.querySelector('.ipd-content');
    if (!more || !content || more.__bound) return;
    more.__bound = true;
    more.addEventListener('click', function () {
      var collapsed = content.classList.toggle('ipd-collapsed');
      more.textContent = collapsed ? '상세정보 더보기 ▾' : '접기 ▴';
      if (collapsed && box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function render(product) {
    var box = document.getElementById('ipDetailBox');
    if (!box) return;
    var ops = product && detailOps(product.detailContent);
    if (!ops || !ops.length) {
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }
    injectStyles();
    box.style.display = '';
    box.className = 'ipd-box';
    box.innerHTML =
      '<div class="ipd-label">상세정보</div>' +
      '<div class="ipd-content ipd-collapsed">' +
        '<div class="ql-snow"><div class="ql-editor ipd-ql">' + deltaToHtml(ops) + '</div></div>' +
        '<div class="ipd-fade"></div>' +
      '</div>' +
      '<button class="ipd-more" type="button">상세정보 더보기 ▾</button>';
    bindToggle(box);
    // 이미지 로드 등으로 높이가 변할 수 있어 한 프레임 뒤 + 약간 지연 후 재측정
    requestAnimationFrame(function () { syncCollapse(box); });
    setTimeout(function () { syncCollapse(box); }, 350);
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  // 혜택 아코디언 펼치기/접기 (카드/이벤트/FAQ 와 동일 위임 패턴)
  document.addEventListener('click', function (e) {
    var h = e.target.closest && e.target.closest('.ipd-content .bacc-head');
    if (h && h.parentElement) h.parentElement.classList.toggle('open');
  });

  window.ItvDetailContent = { render: render };
})();
