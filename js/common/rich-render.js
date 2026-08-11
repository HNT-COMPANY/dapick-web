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

  // ════════════════════════════════════════════════════
  // Quill 없이 그리기 (2026-08-11 신설)
  //
  // 왜 필요한가
  //   인터넷·TV 화면 하단의 '자주 묻는 질문' 이, 관리자가 답변을 넣어 뒀는데도
  //   계속 '답변이 준비 중입니다' 로 보였다. 원인은 데이터가 아니라 이 파일이었다 —
  //   아래 dpRichHtml 이 Quill 이 없으면 '' 를 돌려주는데 internet.html 은 Quill 을
  //   안 싣는다. 오류도 안 나서 관리자 입력이 잘못된 줄 알기 쉬운, 조용히 틀리는 종류다.
  //
  //   고객 화면에 Quill(약 200KB + CSS)을 더 싣는 건 답변 몇 줄 때문에 과하다.
  //   그래서 Delta 를 직접 HTML 로 옮긴다. Quill 이 이미 있는 화면은 지금까지처럼
  //   Quill 을 쓴다 — 검증된 결과를 바꾸지 않으려는 것이다.
  //
  // ⚠ 한계(솔직히)
  //   흔한 서식(굵게·기울임·밑줄·취소선·링크·색·글자크기·목록·제목·인용·정렬·
  //   들여쓰기·이미지 + 커스텀 3종)은 덮는다. 드문 조합(중첩 인용 등)은 근사치다.
  // ════════════════════════════════════════════════════

  // 줄 전체에 걸리는 서식. 나머지는 글자에만 걸리는 서식으로 본다.
  // ★ 둘을 안 나누면 {insert:'안녕\n', attributes:{bold:true}} 같은 조각에서
  //   bold 가 줄 서식으로 오인돼 굵기가 통째로 날아간다.
  var BLOCK_KEYS = ['header', 'list', 'blockquote', 'code-block', 'align', 'indent'];

  // 색·글꼴 값에 따옴표나 세미콜론이 섞이면 style 을 깨고 나갈 수 있다. 안전한 글자만 남긴다.
  function safeCss(v) {
    return String(v == null ? '' : v).replace(/[^a-zA-Z0-9#(),.%\s_-]/g, '').slice(0, 40);
  }

  // javascript: 같은 주소를 막는다. 사람이 쓴 답변이라도 붙여넣기로 들어올 수 있다.
  function safeHref(v) {
    var s = String(v == null ? '' : v).trim();
    return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(s) ? s : '';
  }

  function inlineHtml(text, at) {
    var h = be(text);
    var a = at || {};
    if (a.code) h = '<code>' + h + '</code>';
    if (a.bold) h = '<strong>' + h + '</strong>';
    if (a.italic) h = '<em>' + h + '</em>';
    if (a.underline) h = '<u>' + h + '</u>';
    if (a.strike) h = '<s>' + h + '</s>';
    if (a.script === 'sub') h = '<sub>' + h + '</sub>';
    if (a.script === 'super') h = '<sup>' + h + '</sup>';

    var st = '';
    if (a.color) st += 'color:' + safeCss(a.color) + ';';
    if (a.background) st += 'background-color:' + safeCss(a.background) + ';';
    var cls = [];
    if (a.size) cls.push('ql-size-' + safeCss(a.size));
    if (a.font) cls.push('ql-font-' + safeCss(a.font));
    if (st || cls.length) {
      h = '<span' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') +
        (st ? ' style="' + st + '"' : '') + '>' + h + '</span>';
    }
    if (a.link) {
      var href = safeHref(a.link);
      if (href) h = '<a href="' + be(href) + '" target="_blank" rel="noopener">' + h + '</a>';
    }
    return h;
  }

  function tableHtmlOf(cells, header, cls) {
    var h = '<table class="' + cls + '">';
    (Array.isArray(cells) ? cells : []).forEach(function (row, ri) {
      h += '<tr>';
      (row || []).forEach(function (cell) {
        var tag = (header && ri === 0) ? 'th' : 'td';
        h += '<' + tag + '>' + be(cell || '').replace(/\n/g, '<br>') + '</' + tag + '>';
      });
      h += '</tr>';
    });
    return h + '</table>';
  }

  // ★ 아래 세 벌은 위 blot 의 create() 와 같은 결과를 내야 한다.
  //   한쪽만 고치면 Quill 있는 화면과 없는 화면의 모양이 갈린다.
  function embedHtml(ins) {
    if (ins.image) {
      var raw = String(ins.image);
      var src = /^data:image\//i.test(raw) ? raw : safeHref(raw);
      return src ? '<img src="' + be(src) + '">' : '';
    }
    if (ins.cardbutton) {
      var v = ins.cardbutton || {};
      var href = safeHref(v.href || '');
      var style = safeCss(v.style || '') || 'primary';
      var size = safeCss(v.size || '') || 'md';
      return '<div class="ql-cardbtn-wrap">' +
        '<a class="ql-cardbtn ql-cardbtn--' + style + ' ql-cardbtn--' + size + '"' +
        (href ? ' href="' + be(href) + '" target="_blank" rel="noopener"' : '') + '>' +
        be(v.text || '버튼') + '</a></div>';
    }
    if (ins.cardtable) {
      var t = ins.cardtable || {};
      return '<div class="ql-ctable-wrap">' + tableHtmlOf(t.cells, !!t.header, 'ql-ctable') + '</div>';
    }
    if (ins.benefitaccordion) {
      var b = ins.benefitaccordion || {};
      var items = Array.isArray(b.items) ? b.items : [];
      var html = '<div class="bacc">';
      if (b.title) html += '<div class="bacc-title">' + be(b.title) + '</div>';
      html += '<div class="bacc-list">';
      items.forEach(function (it) {
        var tbl = it.table;
        var body = (it.body ? baccRichBody(it.body) : '') +
          (tbl && Array.isArray(tbl.cells) && tbl.cells.length
            ? tableHtmlOf(tbl.cells, !!tbl.header, 'bacc-table') : '');
        html += '<div class="bacc-row"><div class="bacc-head">' +
          '<span class="bacc-rtitle">' + be(it.title || '') + '</span>' +
          '<span class="bacc-rsub">' + be(it.subtitle || '') + '</span>' +
          '<span class="bacc-chev" aria-hidden="true">⌄</span></div>' +
          (body ? '<div class="bacc-body">' + body + '</div>' : '') + '</div>';
      });
      return html + '</div></div>';
    }
    return '';
  }

  function alignIndentCls(at) {
    var cls = [];
    if (at.align) cls.push('ql-align-' + safeCss(at.align));
    if (at.indent) cls.push('ql-indent-' + (Number(at.indent) || 0));
    return cls.length ? ' class="' + cls.join(' ') + '"' : '';
  }

  function blockHtml(inner, at) {
    var a = at || {};
    if (a['code-block']) return '<pre class="ql-syntax" spellcheck="false">' + (inner || '') + '\n</pre>';
    var c = alignIndentCls(a);
    var body = inner || '<br>';   // 빈 줄도 한 칸 자리를 차지해야 원문과 줄 수가 맞는다
    if (a.blockquote) return '<blockquote' + c + '>' + body + '</blockquote>';
    if (a.header) {
      var n = Math.min(6, Math.max(1, Number(a.header) || 1));
      return '<h' + n + c + '>' + body + '</h' + n + '>';
    }
    return '<p' + c + '>' + body + '</p>';
  }

  function opsToHtml(ops) {
    var lines = [];   // {html, at}
    var cur = '';

    ops.forEach(function (op) {
      if (!op) return;
      var ins = op.insert;
      if (typeof ins === 'string') {
        var at = op.attributes || {};
        var inl = {}, blk = {};
        Object.keys(at).forEach(function (k) {
          if (BLOCK_KEYS.indexOf(k) >= 0) blk[k] = at[k]; else inl[k] = at[k];
        });
        var segs = ins.split('\n');
        segs.forEach(function (seg, i) {
          if (seg) cur += inlineHtml(seg, inl);
          if (i < segs.length - 1) { lines.push({ html: cur, at: blk }); cur = ''; }
        });
      } else if (ins && typeof ins === 'object') {
        cur += embedHtml(ins);
      }
    });
    if (cur) lines.push({ html: cur, at: {} });

    // 목록은 연속된 줄을 하나의 ol/ul 로 묶어야 한다. 줄마다 열고 닫으면 점이 따로 논다.
    var out = '', listTag = '';
    function closeList() { if (listTag) { out += '</' + listTag + '>'; listTag = ''; } }

    lines.forEach(function (ln) {
      var lt = ln.at.list;
      if (lt) {
        var tag = lt === 'ordered' ? 'ol' : 'ul';
        if (listTag !== tag) { closeList(); out += '<' + tag + '>'; listTag = tag; }
        out += '<li' + alignIndentCls(ln.at) + '>' + (ln.html || '<br>') + '</li>';
      } else {
        closeList();
        out += blockHtml(ln.html, ln.at);
      }
    });
    closeList();
    return out;
  }

  // Quill CSS 가 담당하던 것 중 최소한만 넣는다.
  // ★ 이 함수는 Quill 이 없는 화면에서만 불린다. 커스텀 3종(bacc/cardbtn/ctable)의
  //   모양은 각 화면 CSS 담당이라 여기서 안 건드린다 — 넣으면 기존 화면과 부딪힌다.
  var _fbStyled = false;
  function injectFallbackCss() {
    if (_fbStyled || typeof document === 'undefined' || !document.head) return;
    _fbStyled = true;
    var css =
      '.ql-editor p{margin:0 0 .55em;}' +
      '.ql-editor p:last-child{margin-bottom:0;}' +
      '.ql-editor h1,.ql-editor h2,.ql-editor h3,' +
      '.ql-editor h4,.ql-editor h5,.ql-editor h6{margin:.9em 0 .4em;font-weight:800;line-height:1.4;}' +
      '.ql-editor h1{font-size:1.6em;}.ql-editor h2{font-size:1.35em;}.ql-editor h3{font-size:1.15em;}' +
      '.ql-editor ol,.ql-editor ul{margin:0 0 .55em;padding-left:1.4em;}' +
      '.ql-editor li{margin:.15em 0;}' +
      '.ql-editor blockquote{margin:.5em 0;padding:.2em 0 .2em .8em;border-left:3px solid #e5e3ef;color:#5c5878;}' +
      '.ql-editor pre.ql-syntax{margin:.5em 0;padding:.7em .9em;background:#f6f5fa;border-radius:8px;' +
        'white-space:pre-wrap;word-break:break-word;font-size:.92em;}' +
      '.ql-editor img{max-width:100%;height:auto;}' +
      '.ql-align-center{text-align:center;}.ql-align-right{text-align:right;}' +
      '.ql-align-justify{text-align:justify;}' +
      '.ql-indent-1{padding-left:3em;}.ql-indent-2{padding-left:6em;}' +
      '.ql-indent-3{padding-left:9em;}.ql-indent-4{padding-left:12em;}' +
      '.ql-size-small{font-size:.82em;}.ql-size-large{font-size:1.3em;}.ql-size-huge{font-size:1.8em;}';
    var s = document.createElement('style');
    s.setAttribute('data-dp', 'rich-fallback');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /** Quill Delta → HTML. 빈 본문이면 ''. Quill 이 없으면 자체 변환으로 내려간다. */
  window.dpRichHtml = function (raw) {
    var ops = toOps(raw);
    if (!ops || !ops.length) return '';
    if (typeof Quill === 'undefined') {
      injectFallbackCss();
      return opsToHtml(ops);
    }
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
