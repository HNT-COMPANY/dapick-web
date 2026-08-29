//
// mypage-notice.js — 마이페이지 '공지사항' 탭.
// 목록(GET /api/notices)은 제목만 온다. 제목을 누르면 그 자리에서 펼치고,
// 그때 본문(GET /api/notices/{id})을 한 번만 더 가져온다 — 페이지 이동 없음.
// 렌더는 js/common/rich-render.js 의 dpRichHtml (어드민 Quill Delta → HTML).
// 의존: api.js, rich-render.js, Quill 1.3.7
//
(function () {
  'use strict';

  var loaded = false;      // 목록을 한 번이라도 불렀는가
  var rows = [];
  var bodyCache = {};      // id → HTML (같은 글을 두 번 안 부른다)
  var pendingOpenId = null; // 딥링크(?notice=)로 자동 펼칠 글

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(raw) {
    if (!raw) return '';
    var m = String(raw).replace('T', ' ').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (m[1] + '.' + m[2] + '.' + m[3]) : '';
  }

  // ── 목록 ────────────────────────────────────────
  function render() {
    var list = document.getElementById('mp-notice-list');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<div class="mp-nt-empty">등록된 공지사항이 없습니다.</div>';
      return;
    }
    list.innerHTML = rows.map(function (n) {
      var pin = n.pinned ? '<span class="mp-nt-pin">공지</span>' : '';
      var thumb = n.imageUrl
        ? '<img class="mp-nt-thumb" src="' + esc(n.imageUrl) + '" alt="" />'
        : '';
      return '<div class="mp-nt-row" data-id="' + esc(n.id) + '">' +
        '<button class="mp-nt-head" type="button">' +
          thumb +
          '<span class="mp-nt-titlewrap">' +
            '<span class="mp-nt-title">' + pin + esc(n.title || '(제목 없음)') + '</span>' +
            '<span class="mp-nt-date">' + esc(fmtDate(n.createdAt)) + '</span>' +
          '</span>' +
          '<span class="mp-nt-caret" aria-hidden="true">▾</span>' +
        '</button>' +
        '<div class="mp-nt-body"></div>' +
      '</div>';
    }).join('');

    if (pendingOpenId != null) {
      // 선택자 조립(CSS.escape) 대신 직접 훑는다 — id 가 무엇이 오든 안전하고 의존도 없다.
      var want = String(pendingOpenId);
      pendingOpenId = null;
      var all = list.querySelectorAll('.mp-nt-row');
      for (var i = 0; i < all.length; i++) {
        if (all[i].getAttribute('data-id') === want) {
          toggleRow(all[i], true);
          if (typeof all[i].scrollIntoView === 'function') {
            all[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
          break;
        }
      }
    }
  }

  // ── 펼치기 ──────────────────────────────────────
  function toggleRow(row, forceOpen) {
    var open = forceOpen === true ? true : !row.classList.contains('is-open');
    row.classList.toggle('is-open', open);
    if (!open) return;

    var id = row.getAttribute('data-id');
    var body = row.querySelector('.mp-nt-body');
    if (!body || body.getAttribute('data-filled') === '1') return;

    body.innerHTML = '<div class="mp-nt-loading">불러오는 중…</div>';
    api.get('/api/notices/' + encodeURIComponent(id)).then(function (n) {
      var html = (typeof window.dpRichHtml === 'function') ? window.dpRichHtml(n && n.detailContent) : '';
      bodyCache[id] = html;
      body.innerHTML = html
        ? '<div class="ql-snow"><div class="ql-editor mp-nt-ql">' + html + '</div></div>'
        : '<div class="mp-nt-noans">내용이 없습니다.</div>';
      body.setAttribute('data-filled', '1');
    }).catch(function (e) {
      // 실패는 감추지 않는다 — 다시 눌러 재시도할 수 있게 data-filled 를 세우지 않는다.
      body.innerHTML = '<div class="mp-nt-noans">공지를 불러오지 못했습니다.' +
        (e && e.status ? ' (' + esc(String(e.status)) + ')' : '') + '</div>';
    });
  }

  document.addEventListener('click', function (e) {
    var head = e.target.closest && e.target.closest('.mp-nt-head');
    if (!head) return;
    var row = head.closest('.mp-nt-row');
    if (row) toggleRow(row);
  });

  // ── 진입점 (mypage.js switchTab 이 부른다) ───────
  window.mpLoadNotice = function (openId) {
    injectStyles();
    if (openId != null && openId !== '') pendingOpenId = openId;

    var list = document.getElementById('mp-notice-list');
    if (!list) return;
    if (loaded) { render(); return; }

    list.innerHTML = '<div class="mp-nt-empty">불러오는 중…</div>';
    api.get('/api/notices').then(function (data) {
      rows = Array.isArray(data) ? data : (data && data.content) || [];
      loaded = true;
      render();
    }).catch(function () {
      list.innerHTML = '<div class="mp-nt-empty">공지사항을 불러오지 못했습니다.</div>';
    });
  };

  // ── 스타일 ──────────────────────────────────────
  var styled = false;
  function injectStyles() {
    if (styled) return;
    styled = true;
    var css =
      '.mp-nt-list{display:flex;flex-direction:column;gap:10px;}' +
      '.mp-nt-empty{padding:40px 16px;text-align:center;color:#a7a5b8;font-size:14px;}' +
      '.mp-nt-row{border:1px solid #eeecf5;border-radius:12px;background:#fff;overflow:hidden;}' +
      '.mp-nt-head{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;background:none;border:none;cursor:pointer;text-align:left;font-family:inherit;}' +
      '.mp-nt-head:hover{background:#faf9ff;}' +
      '.mp-nt-thumb{width:72px;height:48px;border-radius:8px;object-fit:cover;background:#f4f6fb;border:1px solid #eceaf5;flex-shrink:0;}' +
      '.mp-nt-titlewrap{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}' +
      '.mp-nt-title{font-size:15px;font-weight:700;color:#221f38;line-height:1.45;}' +
      '.mp-nt-pin{display:inline-block;color:#5b3fbe;font-weight:800;margin-right:6px;}' +
      '.mp-nt-date{font-size:12px;color:#a7a5b8;}' +
      '.mp-nt-caret{color:#b0aec2;font-size:13px;flex-shrink:0;transition:transform .18s;}' +
      '.mp-nt-row.is-open .mp-nt-caret{transform:rotate(180deg);}' +
      '.mp-nt-body{display:none;padding:0 16px 16px;border-top:1px solid #f2f0f8;}' +
      '.mp-nt-row.is-open .mp-nt-body{display:block;padding-top:14px;}' +
      '.mp-nt-loading,.mp-nt-noans{padding:18px 0;color:#b0aac2;font-size:13.5px;}' +
      // 리치 본문 — faq.js 의 .faq-a-inner 규칙과 같은 모양으로 맞춘다(같은 에디터에서 나온 HTML).
      '.mp-nt-body .ql-snow{border:none;}' +
      '.mp-nt-ql{padding:0;font-size:14px;line-height:1.8;color:#3a3a48;}' +
      '.mp-nt-ql img{max-width:100%;height:auto;border-radius:10px;display:block;margin:12px auto;}' +
      '.mp-nt-ql .ql-cardbtn-wrap{text-align:center;margin:14px 0;}' +
      '.mp-nt-ql .ql-cardbtn{display:inline-block;min-width:60%;text-align:center;font-weight:800;border-radius:12px;text-decoration:none;}' +
      '.mp-nt-ql .ql-cardbtn--primary{background:#5b3fbe;color:#fff;}' +
      '.mp-nt-ql .ql-cardbtn--yellow{background:#ffce2e;color:#1c1c22;}' +
      '.mp-nt-ql .ql-cardbtn--outline{background:#fff;color:#5b3fbe;border:2px solid #5b3fbe;}' +
      '.mp-nt-ql .ql-cardbtn--sm{padding:9px 18px;font-size:14px;}' +
      '.mp-nt-ql .ql-cardbtn--md{padding:13px 22px;font-size:15px;}' +
      '.mp-nt-ql .ql-cardbtn--lg{padding:18px 30px;font-size:18px;}' +
      '.mp-nt-ql .bacc{margin:14px 0;}' +
      '.mp-nt-ql .bacc-title{font-size:17px;font-weight:900;color:#18172b;margin:0 0 10px;}' +
      '.mp-nt-ql .bacc-list{display:flex;flex-direction:column;gap:10px;}' +
      '.mp-nt-ql .bacc-row{background:#faf9fe;border:1px solid #eee;border-radius:12px;overflow:hidden;}' +
      '.mp-nt-ql .bacc-head{display:flex;align-items:center;gap:14px;padding:14px 18px;cursor:pointer;}' +
      '.mp-nt-ql .bacc-rtitle{font-weight:800;color:#18172b;font-size:14px;flex-shrink:0;min-width:80px;}' +
      '.mp-nt-ql .bacc-rsub{flex:1;color:#5a5a68;font-size:13.5px;}' +
      '.mp-nt-ql .bacc-chev{color:#b0b0bd;transition:transform .2s;flex-shrink:0;}' +
      '.mp-nt-ql .bacc-row.open .bacc-chev{transform:rotate(180deg);}' +
      '.mp-nt-ql .bacc-body{display:none;padding:14px 18px 16px;color:#3a3a48;font-size:13.5px;line-height:1.7;border-top:1px solid #f2f2f5;}' +
      '.mp-nt-ql .bacc-row.open .bacc-body{display:block;}' +
      '.mp-nt-ql .bacc-table,.mp-nt-ql .ql-ctable{border-collapse:collapse;width:100%;margin:10px 0 2px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;}' +
      '.mp-nt-ql .bacc-table th,.mp-nt-ql .bacc-table td,.mp-nt-ql .ql-ctable th,.mp-nt-ql .ql-ctable td{border:1px solid #e5e7eb;padding:9px 12px;font-size:13px;text-align:left;color:#374151;line-height:1.5;}' +
      '.mp-nt-ql .bacc-table th,.mp-nt-ql .ql-ctable th{background:#f8f9fb;font-weight:700;color:#111827;}' +
      '.mp-nt-ql .ql-ctable-wrap{margin:12px 0;overflow-x:auto;}' +
      // 마이페이지 안에서 FAQ 를 그대로 쓴다 — 홈의 max-height:200px 제한을 풀어야 답변이 안 잘린다.
      '#tab-faq .faq-a.open{max-height:none;}' +
      '#tab-faq .cfaq-tabs{margin-bottom:14px;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }
})();
