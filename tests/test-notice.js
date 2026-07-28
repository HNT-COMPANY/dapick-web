// 공지사항(마이페이지 탭) + rich-render 회귀 검사
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 레포 루트 기준(tests/ 의 부모). 컨테이너가 사라져도 레포에 남아 다음 세션이 그대로 돌린다.
//   실행: cd dapick-web && npm i --no-save jsdom && node tests/test-notice.js
const WEB = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); } }
function section(t) { console.log('\n── ' + t); }

const read = (p) => fs.readFileSync(p, 'utf8');

// ══════════════════════════════════════════════
section('mypage.html 정적 검사');
const html = read(path.join(WEB, 'mypage.html'));

ok(!/mp-menu__badge">준비중/.test(html), '사이드바 준비중 뱃지가 모두 사라졌다');
ok(!/mp-quick__soon/.test(html), '빠른 메뉴 준비중 라벨이 사라졌다');
ok(!/공지사항 준비중/.test(html), '공지 탭 준비중 문구 제거');
ok(!/자주 묻는 질문 준비중/.test(html), 'FAQ 탭 준비중 문구 제거');
ok(html.includes('id="mp-notice-list"'), '공지 목록 컨테이너 존재');
ok(html.includes('id="faqTabs"') && html.includes('id="faqList"'), 'FAQ 탭이 faq.js 가 찾는 두 id 를 갖는다');
ok(/quill\.min\.js/.test(html), 'Quill 스크립트 로드');
ok(/quill\.snow\.min\.css/.test(html), 'Quill CSS 로드');

// 스크립트 순서: rich-render → faq → mypage-notice → mypage
const order = ['js/common/rich-render.js', 'js/faq/faq.js', 'js/mypage/mypage-notice.js', 'js/mypage/mypage.js']
  .map((s) => html.indexOf('<script src="' + s + '">'));
ok(order.every((i) => i > 0), '새 스크립트 4개가 모두 삽입됐다');
ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], '스크립트 순서가 의도대로다');
// 비교함 메뉴/탭 자체는 남아 있어야 한다 (뱃지만 뗀 것)
ok(html.includes('data-tab="compare"'), '비교함 메뉴는 그대로 있다');
ok(html.includes('id="tab-compare"'), '비교함 탭 컨테이너 그대로');
ok(html.includes('id="mp-cmp-cats"') && html.includes('id="mp-cmp-body"'), '비교함 내부 컨테이너 훼손 없음');

// ══════════════════════════════════════════════
section('mypage.js 배선');
const mp = read(path.join(WEB, 'js/mypage/mypage.js'));
ok(/tabName === 'notice'/.test(mp), "switchTab 이 notice 탭을 처리한다");
ok(/window\.mpLoadNotice/.test(mp), 'mpLoadNotice 를 호출한다');
ok(/_pendingNoticeId/.test(mp), '딥링크 공지 id 를 읽는다');
ok(/_qs\.get\('notice'\)/.test(mp), "?notice= 파라미터를 읽는다");
// 기존 동작 보존
['loadNotifications()', 'loadRecentViews()', 'loadFavorites()', 'loadCompare()'].forEach((f) => {
  ok(mp.includes(f), '기존 탭 로더 보존: ' + f);
});

// ══════════════════════════════════════════════
section('faq.js 중복 토글 가드');
const faq = read(path.join(WEB, 'js/faq/faq.js'));
ok(/__dpBaccToggleBound/.test(faq), 'faq.js 에 아코디언 토글 가드가 들어갔다');
ok(faq.includes("api.get('/api/faqs')"), 'faq.js 원래 로직 보존');
ok(faq.includes('deltaToHtml'), 'faq.js 렌더 로직 보존');

// ══════════════════════════════════════════════
section('rich-render.js + mypage-notice.js 동작');

function mkDom(extraHead) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <div id="tab-notice"><div class="mp-nt-list" id="mp-notice-list"></div></div>
  </body></html>`, { url: 'http://localhost:5500/mypage.html', pretendToBeVisual: true, runScripts: 'outside-only' });
  return dom;
}

// 가짜 Quill — 진짜 Quill 없이 blot 등록/렌더 경로만 확인한다.
function installFakeQuill(win) {
  const registered = {};
  class FakeBlockEmbed {
    static create() { return win.document.createElement('div'); }
  }
  function FakeQuill(el, opts) {
    this.root = win.document.createElement('div');
    this.setContents = ({ ops }) => {
      // insert 문자열은 텍스트로, 커스텀 embed 는 등록된 blot.create 로 그린다.
      (ops || []).forEach((o) => {
        if (typeof o.insert === 'string') {
          const p = win.document.createElement('p');
          p.textContent = o.insert;
          this.root.appendChild(p);
        } else if (o.insert && typeof o.insert === 'object') {
          const name = Object.keys(o.insert)[0];
          const blot = registered[name];
          if (blot) this.root.appendChild(blot.create(o.insert[name]));
        }
      });
    };
  }
  FakeQuill.import = () => FakeBlockEmbed;
  FakeQuill.register = (blot) => { registered[blot.blotName] = blot; };
  win.Quill = FakeQuill;
  win.CSS = win.CSS || {};
  if (!win.CSS.escape) win.CSS.escape = (s) => String(s).replace(/["\\]/g, '\\$&');
  return () => registered;
}

const richSrc = read(path.join(WEB, 'js/common/rich-render.js'));
const noticeSrc = read(path.join(WEB, 'js/mypage/mypage-notice.js'));

// ── (1) dpRichHtml: 빈/깨진 입력 ──
{
  const dom = mkDom();
  const win = dom.window;
  installFakeQuill(win);
  win.eval(richSrc);
  ok(typeof win.dpRichHtml === 'function', 'dpRichHtml 이 노출된다');
  ok(win.dpRichHtml(null) === '', 'null → 빈 문자열');
  ok(win.dpRichHtml('') === '', '빈 문자열 → 빈 문자열');
  ok(win.dpRichHtml('{망가진 JSON') === '', '깨진 JSON 이어도 던지지 않는다');
  ok(win.dpRichHtml('{"ops":[]}') === '', 'ops 가 비면 빈 문자열');
  const h = win.dpRichHtml(JSON.stringify({ ops: [{ insert: '안녕하세요\n' }] }));
  ok(h.includes('안녕하세요'), '평문 Delta 렌더');
  // 배열 그대로 / {ops} 둘 다 받는다
  ok(win.dpRichHtml([{ insert: 'A' }]).includes('A'), 'ops 배열 형태도 처리');
}

// ── (2) 커스텀 blot 3종 등록 ──
{
  const dom = mkDom();
  const win = dom.window;
  const getReg = installFakeQuill(win);
  win.eval(richSrc);
  const out = win.dpRichHtml(JSON.stringify({
    ops: [
      { insert: { cardbutton: { text: '신청하기', href: 'https://x.test', style: 'yellow', size: 'lg' } } },
      { insert: { cardtable: { cells: [['머리', '값'], ['a', 'b']], header: true } } },
      { insert: { benefitaccordion: { title: '더 보기', items: [{ title: '항목1', subtitle: '부제', body: '**굵게**\n둘째줄' }] } } },
    ],
  }));
  const reg = getReg();
  ok(!!reg.cardbutton && !!reg.cardtable && !!reg.benefitaccordion, 'blot 3종이 등록됐다');
  ok(out.includes('ql-cardbtn--yellow') && out.includes('ql-cardbtn--lg'), '버튼 스타일·크기 반영');
  ok(out.includes('target="_blank"'), '버튼 링크는 새 탭');
  ok(out.includes('<th>머리</th>'), '표 첫 행이 헤더');
  ok(out.includes('<strong>굵게</strong>'), '아코디언 본문 **굵게** 해석');
  ok(out.includes('둘째줄'), '아코디언 본문 줄바꿈 유지');
}

// ── (3) XSS: 사용자 입력이 그대로 태그가 되지 않는다 ──
{
  const dom = mkDom();
  const win = dom.window;
  installFakeQuill(win);
  win.eval(richSrc);
  // 원문은 data-* 속성에도 실린다(라운드트립용). 속성 안의 '<' 는 따옴표에 갇혀 있어 태그가 되지 않으므로
  // 위험한 건 '보이는 영역'이다 — 그래서 실제 DOM 에 심어 보고 스크립트/이미지 노드가 생기는지 본다.
  function mount(win, htmlStr) {
    const box = win.document.createElement('div');
    box.innerHTML = htmlStr;
    win.document.body.appendChild(box);
    return box;
  }

  const out = win.dpRichHtml(JSON.stringify({
    ops: [{ insert: { cardtable: { cells: [['<img src=x onerror=alert(1)>']], header: false } } }],
  }));
  const box1 = mount(win, out);
  ok(box1.querySelectorAll('img').length === 0, '표 셀의 <img> 가 실제 노드로 살아나지 않는다');
  ok(box1.querySelector('td').textContent === '<img src=x onerror=alert(1)>', '표 셀은 글자 그대로 보인다');

  const out2 = win.dpRichHtml(JSON.stringify({
    ops: [{ insert: { benefitaccordion: { title: '<script>bad()</script>', items: [{ title: '<b>t</b>', subtitle: '', body: '' }] } } }],
  }));
  const box2 = mount(win, out2);
  ok(box2.querySelectorAll('script').length === 0, '아코디언 제목의 <script> 가 노드로 살아나지 않는다');
  ok(box2.querySelector('.bacc-title').textContent === '<script>bad()</script>', '아코디언 제목은 글자 그대로 보인다');
  ok(box2.querySelector('.bacc-rtitle').textContent === '<b>t</b>', '아코디언 항목 제목도 글자 그대로');
}

// ── (4) 아코디언 토글이 한 번만 붙는다 ──
{
  const dom = mkDom();
  const win = dom.window;
  installFakeQuill(win);
  win.eval(richSrc);
  win.eval(richSrc); // 두 번 실어도
  win.eval(`
    if (!window.__dpBaccToggleBound) { window.__dpBaccToggleBound = true;
      document.addEventListener('click', function (e) {
        const h = e.target.closest && e.target.closest('.bacc-head');
        if (h && h.parentElement) h.parentElement.classList.toggle('open');
      });
    }`); // faq.js 의 가드된 핸들러
  const row = win.document.createElement('div');
  row.className = 'bacc-row';
  row.innerHTML = '<div class="bacc-head"><span>t</span></div><div class="bacc-body">b</div>';
  win.document.body.appendChild(row);
  row.querySelector('.bacc-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok(row.classList.contains('open'), '아코디언이 한 번 클릭에 열린다 (이중 토글 없음)');
  row.querySelector('.bacc-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok(!row.classList.contains('open'), '다시 클릭하면 닫힌다');
}

// ── (5) 공지 목록 로드 & 펼침 ──
function noticeEnv(listResp, oneResp, opts) {
  opts = opts || {};
  const dom = mkDom();
  const win = dom.window;
  installFakeQuill(win);
  const calls = [];
  win.api = {
    get: (p) => {
      calls.push(p);
      if (p === '/api/notices') {
        return listResp instanceof Error ? Promise.reject(listResp) : Promise.resolve(listResp);
      }
      if (p.startsWith('/api/notices/')) {
        return oneResp instanceof Error ? Promise.reject(oneResp) : Promise.resolve(oneResp);
      }
      return Promise.reject(new Error('unexpected ' + p));
    },
  };
  win.eval(richSrc);
  win.eval(noticeSrc);
  return { win, calls, doc: win.document };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  {
    const { win, calls, doc } = noticeEnv(
      [
        { id: 1, title: '점검 안내', createdAt: '2026-07-28T09:00:00', pinned: true, imageUrl: '/uploads/notice/a.png' },
        { id: 2, title: '<b>태그</b> 제목', createdAt: '2026-07-20T09:00:00', pinned: false },
      ],
      { id: 1, title: '점검 안내', detailContent: JSON.stringify({ ops: [{ insert: '본문입니다\n' }] }) }
    );
    win.mpLoadNotice();
    await tick();
    const rowsEl = doc.querySelectorAll('.mp-nt-row');
    ok(rowsEl.length === 2, '공지 2건이 그려진다');
    ok(doc.querySelector('.mp-nt-pin'), '고정 공지는 "공지" 표시가 붙는다');
    ok(doc.body.innerHTML.includes('2026.07.28'), '작성일이 YYYY.MM.DD 로 표시된다');
    ok(!doc.body.innerHTML.includes('<b>태그</b> 제목'), '제목의 HTML 태그가 이스케이프된다');
    ok(doc.querySelector('.mp-nt-thumb'), '대표 이미지가 있으면 썸네일이 붙는다');
    ok(doc.querySelectorAll('.mp-nt-thumb').length === 1, '이미지 없는 공지는 썸네일이 없다');

    // 목록 단계에서는 본문 요청이 없다
    ok(calls.length === 1 && calls[0] === '/api/notices', '목록만 부르고 본문은 안 부른다');

    // 펼치기
    rowsEl[0].querySelector('.mp-nt-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await tick();
    ok(rowsEl[0].classList.contains('is-open'), '클릭하면 그 자리에서 펼쳐진다');
    ok(calls.includes('/api/notices/1'), '펼칠 때 본문을 가져온다');
    ok(rowsEl[0].querySelector('.mp-nt-body').textContent.includes('본문입니다'), '본문이 렌더된다');
    ok(win.location.pathname === '/mypage.html', '페이지 이동이 없다');

    // 접었다 다시 펼쳐도 재요청 없음
    const before = calls.length;
    rowsEl[0].querySelector('.mp-nt-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    rowsEl[0].querySelector('.mp-nt-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await tick();
    ok(calls.length === before, '이미 받은 본문은 다시 부르지 않는다');
  }

  // ── (6) 목록 비었을 때 ──
  {
    const { win, doc } = noticeEnv([], null);
    win.mpLoadNotice();
    await tick();
    ok(doc.getElementById('mp-notice-list').textContent.includes('등록된 공지사항이 없습니다'), '빈 목록 안내');
  }

  // ── (7) 목록 실패 ──
  {
    const { win, doc } = noticeEnv(new Error('boom'), null);
    win.mpLoadNotice();
    await tick();
    ok(doc.getElementById('mp-notice-list').textContent.includes('불러오지 못했습니다'), '목록 실패 안내');
  }

  // ── (8) 본문 실패 → 재시도 가능해야 한다 ──
  {
    const err = new Error('nope'); err.status = 404;
    const { win, doc, calls } = noticeEnv([{ id: 7, title: 'x', createdAt: '2026-07-01T00:00:00' }], err);
    win.mpLoadNotice();
    await tick();
    const row = doc.querySelector('.mp-nt-row');
    row.querySelector('.mp-nt-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await tick();
    ok(row.querySelector('.mp-nt-body').textContent.includes('불러오지 못했습니다'), '본문 실패 안내');
    ok(row.querySelector('.mp-nt-body').getAttribute('data-filled') !== '1', '실패는 캐시하지 않는다(재시도 가능)');
    const before = calls.length;
    row.querySelector('.mp-nt-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true })); // 닫기
    row.querySelector('.mp-nt-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true })); // 다시 열기
    await tick();
    ok(calls.length > before, '다시 펼치면 본문을 재요청한다');
  }

  // ── (9) 본문이 없는 공지 ──
  {
    const { win, doc } = noticeEnv([{ id: 3, title: '제목만', createdAt: '2026-07-01T00:00:00' }], { id: 3, detailContent: null });
    win.mpLoadNotice();
    await tick();
    const row = doc.querySelector('.mp-nt-row');
    row.querySelector('.mp-nt-head').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await tick();
    ok(row.querySelector('.mp-nt-body').textContent.includes('내용이 없습니다'), '본문 없는 공지 안내');
  }

  // ── (10) 딥링크: ?notice=2 → 그 글이 열린 채로 ──
  {
    const { win, doc } = noticeEnv(
      [{ id: 1, title: 'a', createdAt: '2026-07-01T00:00:00' }, { id: 2, title: 'b', createdAt: '2026-07-02T00:00:00' }],
      { id: 2, detailContent: JSON.stringify({ ops: [{ insert: '두번째\n' }] }) }
    );
    win.mpLoadNotice('2');
    await tick();
    await tick();
    const rowsEl = doc.querySelectorAll('.mp-nt-row');
    ok(!rowsEl[0].classList.contains('is-open'), '딥링크가 아닌 글은 닫혀 있다');
    ok(rowsEl[1].classList.contains('is-open'), '딥링크로 지정한 공지가 펼쳐진 채로 열린다');
    ok(rowsEl[1].querySelector('.mp-nt-body').textContent.includes('두번째'), '딥링크 글의 본문이 채워진다');
  }

  // ── (11) 두 번 호출해도 목록을 다시 부르지 않는다 ──
  {
    const { win, calls } = noticeEnv([{ id: 1, title: 'a', createdAt: '2026-07-01T00:00:00' }], null);
    win.mpLoadNotice();
    await tick();
    win.mpLoadNotice();
    await tick();
    ok(calls.filter((c) => c === '/api/notices').length === 1, '탭을 다시 눌러도 목록은 한 번만 부른다');
  }

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
