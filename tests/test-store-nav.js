// 매장 '자세히 보기' 이동 규칙 회귀 검사
//   실행: cd dapick-web && node tests/test-store-nav.js      (설치 필요 없음)
//
// 이 파일이 대체하는 것: 옛 test-mobile.js 의 "detailUrl 없으면 준비중 안내" 1건.
// 그 검사는 6bb1810(상세 주소를 detailUrl -> slug 로 전환) 이후 낡은 기대값이었다.
// 지금 규칙은 하나다 — 목록에 있는 매장이면 배지와 무관하게 /store/{slug} 로 간다.
//
// jsdom 을 안 쓰는 이유: jsdom 의 window.location 은 [Unforgeable] 이라 갈아끼울 수 없고,
// href 대입은 "Not implemented: navigation" 으로 삼켜져 어디로 가려 했는지 볼 수 없다.
// goStoreDetail 이 건드리는 건 window.location 과 alert 뿐이라 vm 샌드박스로 충분하다.
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const WEB = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); } }

const src = fs.readFileSync(path.join(WEB, 'js/mobile/mobile.js'), 'utf8');

function env(stores) {
  const navs = [];
  const alerts = [];

  const sandbox = {
    console,
    alert: (m) => alerts.push(String(m)),
    // mobile.js 가 로드 시점에 쓰는 것만 채운다(keydown / DOMContentLoaded 리스너 등록).
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
  };
  sandbox.window = sandbox;   // window.x 와 맨몸 x 가 같은 것을 가리키게 한다

  const loc = {};
  Object.defineProperty(loc, 'href', {
    get: () => 'http://localhost:5500/mobile.html',
    set: (v) => navs.push(v),      // 이동을 실행하지 않고 기록만 한다
    configurable: true,
    enumerable: true,
  });
  sandbox.location = loc;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(
    src +
      '\n;window.__setStores = function (v) { STORES = v; };' +
      '\n;window.__setModalId = function (v) { currentModalStoreId = v; };' +
      '\n;window.__go = function () { return goStoreDetail(); };',
    ctx,
    { filename: 'mobile.js' }
  );

  sandbox.__setStores(stores);
  return { win: sandbox, navs, alerts };
}

const READY = { id: 'dapon-mugeo', name: '다폰 무거점', address: '울산 남구', badge: 'READY' };
const NEW_  = { id: 'dapon-hakseong', name: '다폰 학성점', address: '울산 중구', badge: 'NEW' };
const PLAIN = { id: 'dapon-byeongyeong', name: '다폰 병영점', address: '울산 중구' };

// ── 1. 일반 매장 → slug 로 이동 ──
{
  const { win, navs, alerts } = env([PLAIN]);
  win.__setModalId('dapon-byeongyeong');
  win.__go();
  ok(navs.length === 1, '일반 매장은 이동한다');
  ok(navs[0] === '/store/dapon-byeongyeong', 'slug 그대로 /store/{slug} 로 간다');
  ok(alerts.length === 0, '안내창을 띄우지 않는다');
}

// ── 2. NEW 배지도 동일 ──
{
  const { win, navs } = env([NEW_]);
  win.__setModalId('dapon-hakseong');
  win.__go();
  ok(navs[0] === '/store/dapon-hakseong', 'NEW 배지 매장도 이동한다');
}

// ── 3. 오픈 예정(READY)도 막지 않는다 ──
//    옛 테스트는 여기서 '오픈 예정' alert 을 기대했다. 그 기대값이 낡은 것이다.
//    주소·전화·지도는 실제 정보이고, 상세 페이지가 '오픈 예정' 배지를 직접 그린다.
{
  const { win, navs, alerts } = env([READY]);
  win.__setModalId('dapon-mugeo');
  win.__go();
  ok(navs.length === 1 && navs[0] === '/store/dapon-mugeo', '오픈 예정 매장도 상세로 보낸다');
  ok(alerts.length === 0, '오픈 예정이라고 막지 않는다');
}

// ── 4. 모달 id 가 없을 때 ──
{
  const { win, navs, alerts } = env([PLAIN]);
  win.__setModalId(null);
  win.__go();
  ok(navs.length === 0, 'id 가 없으면 이동하지 않는다');
  ok(alerts.length === 1 && /준비되지 않았습니다/.test(alerts[0]), '안내창을 띄운다');
}

// ── 5. 목록에 없는 id (목록 재조회 중 열려 있던 모달) ──
{
  const { win, navs, alerts } = env([PLAIN]);
  win.__setModalId('사라진-매장');
  win.__go();
  ok(navs.length === 0, '목록에 없는 매장이면 이동하지 않는다');
  ok(alerts.length === 1, '안내창을 띄운다');
}

// ── 6. slug 는 URL 인코딩된다 ──
{
  const odd = { id: 'a b/c', name: 'x', address: 'y' };
  const { win, navs } = env([odd]);
  win.__setModalId('a b/c');
  win.__go();
  ok(navs[0] === '/store/' + encodeURIComponent('a b/c'), 'slug 를 encodeURIComponent 로 감싼다');
}

// ── 7. 죽은 가지가 다시 들어오지 않게 ──
{
  ok(!/상세 페이지는 곧 오픈 예정입니다/.test(src),
    "도달 불가능하던 '상세 페이지는 곧 오픈 예정입니다' 분기가 제거된 상태다");
  // 주석에 남은 설명은 봐준다 — 실제 코드에서 쓰는지만 본다.
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  ok(!/detailUrl/.test(code), 'mobile.js 코드가 더 이상 detailUrl 을 참조하지 않는다');
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
