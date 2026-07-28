// ════════════════════════════════════════════════════
// rich-render.js — 어드민 리치 에디터(Quill Delta)를 웹에서 HTML 로 그리는 공통 모듈.
// 커스텀 blot 3종(cardbutton / benefitaccordion / cardtable) 등록 + Delta→HTML.
//
// 왜 만들었나: 같은 코드가 card-detail.js / faq.js / event-detail.js /
// internet-detail-content.js 에 이미 네 벌 있다(CARRIER_MAP 이 다섯 벌로 늘어난 것과 같은 길).
// 공지사항이 다섯 번째가 되는 걸 막으려고 여기로 뽑았다. 기존 네 곳은 건드리지 않았다 —
// 검증된 화면을 한꺼번에 갈아엎는 위험이 이득보다 크다. 손댈 일이 생길 때 한 곳씩 이 모듈로 옮긴다.
//
// 노출: window.dpRichHtml(raw) → HTML 문자열 ('' 이면 본문 없음)
// 전제: 페이지에 Quill 1.3.7 이 로드돼 있어야 한다. 없으면 '' 를 돌려준다(호출부가 대체 문구 표시).
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  function be(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 아코디언 본문 경량 서식: **굵게** + 줄바꿈.
  // 어드민(rich-editor.js baccRichBody)과 같은 규칙이어야 관리자 미리보기와 웹이 일치한다.
  function baccRichBody(s) {
    return be(s).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }

  function registerCardButtonBlot(Q) {
    if (!Q || Q.__cardBtnRegistered) return;
    var BlockEmbed = Q.import('blots/block/embed');
    var CardButtonBlot = class extends BlockEmbed {
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
    };
    CardButtonBlot.blotName = 'cardbutton';
    CardButtonBlot.tagName = 'div';
    Q.register(CardButtonBlot);
    Q.__cardBtnRegistered = true;
  }

  function registerBenefitAccordionBlot(Q) {
    if (!Q || Q.__baccRegistered) return;
    var BlockEmbed = Q.import('blots/block/embed');
    var BenefitAccordionBlot = class extends BlockEmbed {
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
    };
    BenefitAccordionBlot.blotName = 'benefitaccordion';
    BenefitAccordionBlot.tagName = 'div';
    Q.register(BenefitAccordionBlot);
    Q.__baccRegistered = true;
  }

  function registerTableBlot(Q) {
    if (!Q || Q.__tblRegistered) return;
    var BlockEmbed = Q.import('blots/block/embed');
    var CardTableBlot = class extends BlockEmbed {
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
    };
    CardTableBlot.blotName = 'cardtable';
    CardTableBlot.tagName = 'div';
    Q.register(CardTableBlot);
    Q.__tblRegistered = true;
  }

  /** detailContent 원문(문자열 JSON 또는 배열/{ops}) → ops 배열. 못 읽으면 null. */
  function toOps(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return Array.isArray(raw.ops) ? raw.ops : null;
    try {
      var d = JSON.parse(raw);
      return Array.isArray(d) ? d : (d && d.ops) || null;
    } catch (e) {
      return null;
    }
  }

  /** Quill Delta → HTML. Quill 미로드/빈 본문이면 ''. */
  window.dpRichHtml = function (raw) {
    var ops = toOps(raw);
    if (!ops || !ops.length) return '';
    if (typeof Quill === 'undefined') return '';
    registerCardButtonBlot(Quill);
    registerBenefitAccordionBlot(Quill);
    registerTableBlot(Quill);
    var tmp = document.createElement('div');
    var q = new Quill(tmp, { modules: { toolbar: false }, readOnly: true });
    q.setContents({ ops: ops });
    return q.root.innerHTML;
  };

  // 혜택 아코디언 펼치기/접기 — 문서 전체 위임.
  // ※ faq.js 에도 같은 핸들러가 있다. 둘 다 붙으면 한 번 클릭에 두 번 토글돼서 안 열린다.
  //   마이페이지는 faq.js 와 이 모듈을 같이 싣기 때문에 실제로 부딪힌다 → 깃발로 한 번만 붙인다.
  if (!window.__dpBaccToggleBound) {
    window.__dpBaccToggleBound = true;
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.ql-container')) return; // 에디터 내부는 제외
      var h = e.target.closest && e.target.closest('.bacc-head');
      if (h && h.parentElement) h.parentElement.classList.toggle('open');
    });
  }
})();
