// ════════════════════════════════════════════════════
// banner-detail.js — 배너 상세페이지 (linkUrl 없이 상세를 만든 배너의 클릭 진입지)
// GET /api/banners/{id} → detailContent(Quill Delta) 렌더.
// 렌더러(커스텀 blot + delta→HTML)는 카드 상세(card-detail.js)와 동일 shape 유지 필수.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function baccRichBody(s) {
    return esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  }
  function parseId() {
    var q = new URLSearchParams(location.search).get('id');
    if (q && /^\d+$/.test(q)) return q;
    var m = location.pathname.match(/-(\d+)\/?$/);
    return m ? m[1] : null;
  }
  function detailOps(raw) {
    if (!raw) return null;
    try { var d = JSON.parse(raw); return Array.isArray(d) ? d : (d && d.ops) || null; }
    catch (e) { return null; }
  }

  function registerCardButtonBlot(Q) {
    if (!Q || Q.__cardBtnRegistered) return;
    var BlockEmbed = Q.import('blots/block/embed');
    class CardButtonBlot extends BlockEmbed {
      static create(value) {
        var node = super.create(); var v = value || {};
        var style = v.style || 'primary', href = v.href || '', text = v.text || '버튼', size = v.size || 'md';
        node.setAttribute('data-href', href); node.setAttribute('data-style', style);
        node.setAttribute('data-text', text); node.setAttribute('data-size', size);
        node.classList.add('ql-cardbtn-wrap');
        var a = document.createElement('a');
        a.className = 'ql-cardbtn ql-cardbtn--' + style + ' ql-cardbtn--' + size;
        a.textContent = text;
        if (href) { a.setAttribute('href', href); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
        node.appendChild(a); return node;
      }
      static value(node) {
        return { href: node.getAttribute('data-href') || '', style: node.getAttribute('data-style') || 'primary',
          text: node.getAttribute('data-text') || '', size: node.getAttribute('data-size') || 'md' };
      }
    }
    CardButtonBlot.blotName = 'cardbutton'; CardButtonBlot.tagName = 'div';
    Q.register(CardButtonBlot); Q.__cardBtnRegistered = true;
  }

  function registerBenefitAccordionBlot(Q) {
    if (!Q || Q.__baccRegistered) return;
    var be = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var BlockEmbed = Q.import('blots/block/embed');
    class BenefitAccordionBlot extends BlockEmbed {
      static create(value) {
        var node = super.create(); var v = value || {};
        var title = v.title || ''; var items = Array.isArray(v.items) ? v.items : [];
        node.setAttribute('data-title', title); node.setAttribute('data-items', JSON.stringify(items));
        node.classList.add('bacc');
        var tableHtml = function (tbl) {
          if (!tbl || !Array.isArray(tbl.cells) || !tbl.cells.length) return '';
          var h = '<table class="bacc-table">';
          tbl.cells.forEach(function (row, ri) {
            h += '<tr>';
            (row || []).forEach(function (cell) { var tag = (tbl.header && ri === 0) ? 'th' : 'td'; h += '<' + tag + '>' + be(cell || '').replace(/\n/g, '<br>') + '</' + tag + '>'; });
            h += '</tr>';
          });
          return h + '</table>';
        };
        var html = title ? '<div class="bacc-title">' + be(title) + '</div>' : '';
        html += '<div class="bacc-list">';
        items.forEach(function (it) {
          var bodyInner = (it.body ? baccRichBody(it.body) : '') + tableHtml(it.table);
          html += '<div class="bacc-row"><div class="bacc-head">' +
            '<span class="bacc-rtitle">' + be(it.title || '') + '</span>' +
            '<span class="bacc-rsub">' + be(it.subtitle || '') + '</span>' +
            '<span class="bacc-chev" aria-hidden="true">⌄</span></div>' +
            (bodyInner ? '<div class="bacc-body">' + bodyInner + '</div>' : '') + '</div>';
        });
        html += '</div>'; node.innerHTML = html; return node;
      }
      static value(node) {
        var items = []; try { items = JSON.parse(node.getAttribute('data-items') || '[]'); } catch (e) {}
        return { title: node.getAttribute('data-title') || '', items: items };
      }
    }
    BenefitAccordionBlot.blotName = 'benefitaccordion'; BenefitAccordionBlot.tagName = 'div';
    Q.register(BenefitAccordionBlot); Q.__baccRegistered = true;
  }

  function registerTableBlot(Q) {
    if (!Q || Q.__tblRegistered) return;
    var be = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var BlockEmbed = Q.import('blots/block/embed');
    class CardTableBlot extends BlockEmbed {
      static create(value) {
        var node = super.create(); var v = value || {};
        var cells = Array.isArray(v.cells) ? v.cells : []; var header = !!v.header;
        node.setAttribute('data-cells', JSON.stringify(cells)); node.setAttribute('data-header', header ? '1' : '0');
        node.classList.add('ql-ctable-wrap');
        var html = '<table class="ql-ctable">';
        cells.forEach(function (row, ri) {
          html += '<tr>';
          (row || []).forEach(function (cell) { var tag = (header && ri === 0) ? 'th' : 'td'; html += '<' + tag + '>' + be(cell || '').replace(/\n/g, '<br>') + '</' + tag + '>'; });
          html += '</tr>';
        });
        html += '</table>'; node.innerHTML = html; return node;
      }
      static value(node) {
        var cells = []; try { cells = JSON.parse(node.getAttribute('data-cells') || '[]'); } catch (e) {}
        return { cells: cells, header: node.getAttribute('data-header') === '1' };
      }
    }
    CardTableBlot.blotName = 'cardtable'; CardTableBlot.tagName = 'div';
    Q.register(CardTableBlot); Q.__tblRegistered = true;
  }

  function deltaToHtml(ops) {
    if (typeof Quill === 'undefined' || !Array.isArray(ops)) return '';
    registerCardButtonBlot(Quill); registerBenefitAccordionBlot(Quill); registerTableBlot(Quill);
    var tmp = document.createElement('div');
    var q = new Quill(tmp, { modules: { toolbar: false }, readOnly: true });
    q.setContents({ ops: ops });
    return q.root.innerHTML;
  }

  // 접수용 카테고리 값. 서버(normalizeCategory)가 rental/water/internet 은 정규화하고
  // 나머지는 소문자 그대로 받는다. 카테고리가 비어 있으면 'etc' 로 들어간다.
  var bdCategory = 'etc';
  var bdTitle = '';

  function render(b) {
    bdCategory = b.category ? String(b.category).toLowerCase().slice(0, 20) : 'etc';
    bdTitle = b.altText || '';

    var ops = detailOps(b.detailContent);
    var bodyHtml = ops && ops.length
      ? '<div class="ql-snow"><div class="ql-editor bd-ql">' + deltaToHtml(ops) + '</div></div>'
      : '<p class="bd-empty">상세 정보가 아직 등록되지 않았습니다.</p>';

    // 배너 이미지 — 고객이 방금 누른 그 이미지다. 안 보여주면 다른 곳에 온 것처럼 느껴진다.
    var heroHtml = b.imageUrl
      ? '<div class="bd-hero"><img src="' + esc(b.imageUrl) + '" alt="' + esc(bdTitle) + '" /></div>'
      : '';

    // 제목 — altText 는 원래 접근성용 대체 텍스트지만, 배너에 따로 제목 칸이 없다.
    // 관리자가 실제로 배너 이름을 적어 넣는 칸이라 제목으로 쓴다.
    var titleHtml = bdTitle ? '<h1 class="bd-title">' + esc(bdTitle) + '</h1>' : '';

    if (bdTitle) document.title = bdTitle + ' | 다픽';

    document.getElementById('bdArticle').innerHTML =
      heroHtml +
      titleHtml +
      '<div class="bd-detail">' + bodyHtml + '</div>' +
      bdActionsHtml() +
      '<a class="bd-list" href="javascript:history.length>1?history.back():location.assign(\'/\')">← 이전으로</a>';
    document.getElementById('bdArticle').hidden = false;
    var load = document.getElementById('bdLoading'); if (load) load.remove();

    // 글이 그려진 뒤에 간편 신청 폼을 보인다 (2026-08-10).
    // 불러오기에 실패하면 이 줄까지 안 오므로 빈 화면에 폼만 남지 않는다.
    var apply = document.getElementById('bdApply');
    if (apply) apply.hidden = false;
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  // 본문 끝 접수 버튼 두 개 (2026-08-01).
  // 간편 신청 = 사이트 안에서 바로 접수. 카카오 상담 = 대화로 넘어가고 싶은 고객용.
  function bdActionsHtml() {
    return '<div class="bd-actions">' +
      '<button type="button" class="bd-btn bd-btn--main" onclick="bdOpenSimple()" data-track="banner_simple_apply">간편 신청</button>' +
      '<a class="bd-btn bd-btn--kakao" href="https://pf.kakao.com/_exaRjX/chat" target="_blank" rel="noopener" data-track="banner_kakao">카카오 상담</a>' +
      '</div>';
  }

  // simple-apply.js 가 못 붙은 경우(스크립트 로드 실패 등)에도 고객이 막히지 않게 고객센터로 보낸다.
  window.bdOpenSimple = function () {
    if (typeof openSimpleApply === 'function') {
      openSimpleApply(bdCategory, bdTitle || null, null);
      return;
    }
    location.href = '/support';
  };

  function renderError(msg) {
    var load = document.getElementById('bdLoading'); if (load) load.textContent = msg || '배너를 불러오지 못했습니다.';
  }

  function injectStyles() {
    var css =
      ".bd-wrap{max-width:900px;margin:24px auto 60px;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.bd-loading{padding:80px 0;text-align:center;color:#9a9aa5;}' +
      '.bd-detail{font-size:16px;line-height:1.8;}' +
      '.bd-detail .ql-snow{border:none;}' +
      '.bd-detail .ql-editor{padding:0;font-size:16px;line-height:1.8;color:#2a2a35;}' +
      '.bd-detail .ql-editor img{max-width:100%;height:auto;border-radius:12px;display:block;margin:14px auto;}' +
      '.bd-empty{color:#b0aac2;padding:40px 0;text-align:center;}' +
      '.bd-detail .ql-cardbtn-wrap{text-align:center;margin:16px 0;}' +
      '.bd-detail .ql-cardbtn{display:inline-block;min-width:60%;text-align:center;font-weight:800;border-radius:12px;text-decoration:none;}' +
      '.bd-detail .ql-cardbtn--primary{background:#5b3fbe;color:#fff;}' +
      '.bd-detail .ql-cardbtn--yellow{background:#ffce2e;color:#1c1c22;}' +
      '.bd-detail .ql-cardbtn--outline{background:#fff;color:#5b3fbe;border:2px solid #5b3fbe;}' +
      '.bd-detail .ql-cardbtn--sm{padding:9px 18px;font-size:14px;}' +
      '.bd-detail .ql-cardbtn--md{padding:14px 24px;font-size:16px;}' +
      '.bd-detail .ql-cardbtn--lg{padding:20px 32px;font-size:19px;}' +
      '.bd-detail .bacc{margin:18px 0;}' +
      '.bd-detail .bacc-title{font-size:20px;font-weight:900;color:#18172b;margin:0 0 14px;}' +
      '.bd-detail .bacc-list{display:flex;flex-direction:column;gap:12px;}' +
      '.bd-detail .bacc-row{background:#fff;border:1px solid #eee;border-radius:14px;box-shadow:0 1px 6px rgba(24,23,43,.04);overflow:hidden;}' +
      '.bd-detail .bacc-head{display:flex;align-items:center;gap:18px;padding:18px 22px;cursor:pointer;}' +
      '.bd-detail .bacc-rtitle{font-weight:800;color:#18172b;font-size:15px;flex-shrink:0;min-width:92px;}' +
      '.bd-detail .bacc-rsub{flex:1;color:#5a5a68;font-size:14px;}' +
      '.bd-detail .bacc-chev{color:#b0b0bd;transition:transform .2s;flex-shrink:0;}' +
      '.bd-detail .bacc-row.open .bacc-chev{transform:rotate(180deg);}' +
      '.bd-detail .bacc-body{display:none;padding:16px 22px 18px;color:#3a3a48;font-size:14px;line-height:1.7;border-top:1px solid #f2f2f5;}' +
      '.bd-detail .bacc-row.open .bacc-body{display:block;}' +
      '.bd-detail .bacc-table{border-collapse:collapse;width:100%;margin:10px 0 2px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.bd-detail .bacc-table th,.bd-detail .bacc-table td{border:1px solid #e5e7eb;padding:10px 14px;font-size:13.5px;text-align:left;color:#374151;line-height:1.5;}' +
      '.bd-detail .bacc-table th{background:#f8f9fb;font-weight:700;color:#111827;}' +
      '.bd-detail .ql-ctable-wrap{margin:16px 0;overflow-x:auto;}' +
      '.bd-detail .ql-ctable{border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.bd-detail .ql-ctable th,.bd-detail .ql-ctable td{border:1px solid #e5e7eb;padding:11px 14px;font-size:14px;text-align:left;color:#374151;line-height:1.5;}' +
      '.bd-detail .ql-ctable th{background:#f8f9fb;font-weight:700;color:#111827;}' +
      '.bd-list{display:block;text-align:center;background:#fff;border:1px solid #d7d2e6;border-radius:12px;padding:13px;font-size:14px;font-weight:600;color:#555;text-decoration:none;margin-top:28px;}' +
      // ── 2026-08-01: 배너 이미지·제목·접수 버튼 ──
      '.bd-hero{margin:0 0 22px;border-radius:14px;overflow:hidden;background:#f7f7fb;}' +
      '.bd-hero img{width:100%;height:auto;display:block;}' +
      '.bd-title{font-size:24px;font-weight:800;color:#18172b;line-height:1.4;margin:0 0 20px;padding-bottom:18px;border-bottom:1px solid #f0eff5;}' +
      '.bd-actions{display:flex;gap:10px;margin-top:36px;}' +
      '.bd-btn{flex:1;padding:17px;border-radius:12px;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;transition:background .15s;}' +
      '.bd-btn--main{border:none;background:#5b3fbe;color:#fff;}' +
      '.bd-btn--main:hover{background:#4a32a0;}' +
      '.bd-btn--kakao{border:none;background:#ffce2e;color:#1c1c22;}' +
      '.bd-btn--kakao:hover{background:#f0be1a;}' +
      '@media(max-width:768px){.bd-title{font-size:20px;}.bd-btn{padding:15px;font-size:15px;}}';
    var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  }

  // 아코디언 펼치기 (카드 상세와 동일)
  document.addEventListener('click', function (e) {
    var h = e.target.closest && e.target.closest('.bacc-head');
    if (h && h.parentElement) h.parentElement.classList.toggle('open');
  });

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    var id = parseId();
    if (!id) { renderError('잘못된 접근입니다.'); return; }
    api.get('/api/banners/' + id)
      .then(function (b) { if (!b) { renderError('배너를 찾을 수 없습니다.'); return; } render(b); })
      .catch(function () { renderError('배너를 불러오지 못했습니다.'); });
  });
})();
