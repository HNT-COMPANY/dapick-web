// ════════════════════════════════════════════════════════
// /product-detail?id={상품 UUID} — 관리자가 만든 카테고리(GENERIC)의 상품 상세 (2026-08-01)
//
// 왜 이 파일이 필요한가:
//   카테고리 페이지(/c/{slug})에서 상품을 눌러도 갈 곳이 없었다.
//   상품마다 html 을 만들 수 없으니(관리자가 무제한으로 만든다) 이 틀 하나가 다 받는다.
//
// ★ 화면을 그리는 일은 이 파일이 하지 않는다 (2026-08-01 변경).
//   js/products/product-view.js 가 그린다. 그 파일은 어드민 미리보기도 같이 쓴다.
//   전에는 웹과 어드민이 각자 그려서, 관리자가 미리보기에서 본 것과 실제 화면이 달랐다.
//   화면 모양을 고치려면 product-view.js 를 고친다. 여기를 고치면 미리보기와 또 갈린다.
//
//   이 파일이 맡는 것: 데이터 불러오기 / 위치 표시줄 / 신청 버튼의 동작 / 하단 상세 영역.
//
// 자유 입력 항목(specs)의 "한글 이름" 찾기:
//   상품의 specs 는 { "f_lx3a9b": "9평형" } 처럼 key 로 저장된다.
//   key 를 label 과 따로 두는 이유는 label(오타 수정 등)이 바뀌어도 값이 미아가 안 되게 하기 위함이다.
//   그래서 화면에 뿌리려면 key -> label 표를 카테고리 정의에서 만들어 넘겨야 한다.
//   합치는 순서(= 서버 규칙과 동일): 부모 카테고리 추가칸 → 타입 칸 → 자기 추가칸.
//   같은 key 가 겹치면 뒤엣것(더 구체적인 쪽)이 이긴다.
//   예) 에어컨(대분류)에 '냉방면적' 을 두면 벽걸이·스탠드 모두에 나오고,
//       '벽걸이 크기' 를 벽걸이 품목에만 두면 스탠드 상품에는 안 나온다.
//
// 신청 버튼이 둘인 이유:
//   상품 신청 = 로그인 필수, 월 요금·계좌까지 받아 정식 접수(/api/consultations).
//               월 요금이 없으면 서버가 거부하므로 그 경우 버튼을 아예 안 그린다.
//   간편 신청 = 비로그인 가능, 이름·전화·문의만. 문턱이 낮아 이탈이 적다.
// ════════════════════════════════════════════════════════

var pdProduct = null;
var pdCategory = null;   // 상품이 속한 카테고리(품목일 수 있다)
var pdParent = null;     // 그 위 대분류 (없으면 null)

function pdEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pdId() {
  return new URLSearchParams(location.search).get('id') || '';
}

// 화면을 못 그릴 때 쓰는 안내. 빈 화면을 두면 고장인지 없는 상품인지 알 수 없다.
function pdFail(message) {
  var el = document.getElementById('pd-view');
  if (el) el.innerHTML = '<p class="pd-fail">' + pdEsc(message) + '</p>';
  document.title = message + ' | 다픽';
}

// 카테고리 트리(최상위 + children)에서 id 로 찾는다. [찾은것, 부모] 를 돌려준다.
function pdFindCategory(tree, id) {
  for (var i = 0; i < tree.length; i++) {
    var top = tree[i];
    if (top.id === id) return [top, null];
    var kids = top.children || [];
    for (var j = 0; j < kids.length; j++) {
      if (kids[j].id === id) return [kids[j], top];
    }
  }
  return [null, null];
}

// 자유 항목 정의를 합쳐 목록으로 만든다. product-view 가 이 순서대로 요약표를 그린다.
// 서버(FieldSchemaNormalizer)와 같은 우선순위를 지켜야 어드민 입력 화면과 이름이 어긋나지 않는다.
//
// 순서를 유지하는 이유: 관리자가 입력 화면에서 본 칸 순서와 웹 화면의 줄 순서가 같아야
// "내가 넣은 대로 나온다" 가 성립한다. 나중에 덮어써도 처음 나온 자리를 지킨다.
function pdFieldList() {
  var map = {};
  var order = [];
  function put(list) {
    (list || []).forEach(function (f) {
      if (!f || !f.key) return;
      if (!map[f.key]) { map[f.key] = {}; order.push(f.key); }
      // 통째로 갈아끼우지 않고 항목 단위로 덮어쓴다(어드민 peBuildSchema 와 동일).
      // 통째로 바꾸면, 대분류에 이름만 있고 품목에 단위만 적힌 칸에서 이름이 사라진다.
      Object.assign(map[f.key], f);
    });
  }
  // ⚠ 이 네 줄의 순서는 어드민 product-edit.js 의 peBuildSchema() 와 반드시 같아야 한다.
  //    한 줄이라도 빠지면 그 자리의 칸이 웹에서 이름을 못 찾아 f_lx3a9b 같은 내부 기호로 뜬다.
  //    2026-08-01 에 부모의 '입력 양식 타입' 칸이 빠져 있어 실제로 그럴 뻔했다.
  if (pdParent) {
    put(pdParent.fieldTemplateFields);            // 대분류가 고른 입력 양식 타입
    put(pdParent.fieldSchema);                    // 대분류가 직접 더한 칸
  }
  if (pdCategory) {
    put(pdCategory.fieldTemplateFields);          // 품목이 고른 입력 양식 타입
    put(pdCategory.fieldSchema);                  // 품목이 직접 더한 칸 (가장 구체적 → 마지막)
  }
  return order.map(function (k) { return map[k]; });
}

(async function pdInit() {
  var id = pdId();
  if (!id) {
    pdFail('주소가 올바르지 않습니다');
    return;
  }

  try {
    pdProduct = await api.get('/api/products/' + encodeURIComponent(id));
  } catch (e) {
    pdFail('상품을 불러오지 못했습니다');
    return;
  }
  if (!pdProduct) {
    pdFail('없는 상품입니다');
    return;
  }

  // 카테고리 정의는 자유 항목 이름을 붙이는 데만 쓴다. 실패해도 상품은 보여준다.
  try {
    var cats = await api.get('/api/categories');
    var found = pdFindCategory(Array.isArray(cats) ? cats : [], pdProduct.categoryId);
    pdCategory = found[0];
    pdParent = found[1];
  } catch (e) {
    pdCategory = null;
    pdParent = null;
  }

  pdRenderCrumb();
  pdRenderView();
  pdRenderNote();
  pdRenderDesc();
  pdRenderDetailImages();
})();

function pdRenderCrumb() {
  var el = document.getElementById('pd-crumb');
  if (!el) return;
  var bits = ['<a href="/">홈</a>'];
  // 대분류만 주소(slug)를 가진다. 품목은 부모 주소에 ?sub= 로 붙는다.
  var topCat = pdParent || pdCategory;
  if (topCat && topCat.slug) {
    bits.push('<a href="/c/' + encodeURIComponent(topCat.slug) + '">' + pdEsc(topCat.name) + '</a>');
    if (pdParent && pdCategory) {
      bits.push('<a href="/c/' + encodeURIComponent(topCat.slug) + '?sub=' +
        encodeURIComponent(pdCategory.id) + '">' + pdEsc(pdCategory.name) + '</a>');
    }
  }
  el.innerHTML = bits.join('<span class="pd-crumb-sep">›</span>');
}

// ── 화면 그리기 ────────────────────────────────────────
// 공용 모듈에 상품과 항목 정의를 넘기면 HTML 이 나온다.
// showMissing 을 끄는 이유: 빈 칸에 "미입력" 을 띄우는 건 관리자에게 필요한 정보지
// 고객에게 보여줄 것이 아니다. 어드민 미리보기만 켠다.
function pdRenderView() {
  var el = document.getElementById('pd-view');
  if (!el) return;
  if (typeof DapickProductView === 'undefined') {
    pdFail('화면을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요');
    return;
  }

  DapickProductView.injectStyles();
  el.innerHTML = DapickProductView.render(pdProduct, pdFieldList(), {
    showMissing: false,
    actionsHtml: pdActionsHtml()
  });
  DapickProductView.bind(el);

  document.title = (pdProduct.name || '상품 상세') + ' | 다픽';
}

// 신청할 수 있는 상품인가. 렌탈기간 표가 있으면 그중 하나라도 요금이 있으면 된다.
function pdHasFee() {
  var plans = (pdProduct.options && pdProduct.options.rentalPlans) || [];
  if (plans.length) {
    return plans.some(function (pl) { return Number(pl && pl.monthlyFee) > 0; });
  }
  return pdProduct.monthlyFee != null && pdProduct.monthlyFee !== '' &&
    Number(pdProduct.monthlyFee) > 0;
}

// 버튼 모양만 여기서 만든다. 자리는 공용 모듈이 잡는다(요금 상자 바로 아래).
//
// 세 개를 세로로 쌓는 이유:
//   어드민 미리보기가 원래 세로 3개였고 화면마다 개수가 달랐다.
//   가로로 놓으면 폭이 좁은 화면에서 "카카오톡 문의" 가 두 줄로 접힌다.
//   상품 신청이 맨 위인 것은 이 화면의 목적이 정식 접수이기 때문이다.
function pdActionsHtml() {
  var btns = [];
  if (pdHasFee()) {
    btns.push('<button type="button" class="pd-btn pd-btn--main" onclick="pdApplyProduct()" data-track="product_apply">상품 신청</button>');
  }
  btns.push('<button type="button" class="pd-btn pd-btn--sub" onclick="pdApplySimple()" data-track="product_simple_apply">간편 신청</button>');
  btns.push('<button type="button" class="pd-btn pd-btn--kakao" onclick="pdApplyKakao()" data-track="product_kakao">카카오톡 문의</button>');
  return btns.join('');
}

// 카카오 상담 — 화면 오른쪽 아래 플로팅 버튼과 같은 주소다.
// 주소를 여기 한 번 더 적는 대신 상수로 두면 좋겠지만, 이 프로젝트는
// 화면마다 이 주소를 직접 적고 있어 그 방식에 맞춘다(index.html·banner-detail.html 동일).
function pdApplyKakao() {
  window.open('https://pf.kakao.com/_exaRjX/chat', '_blank');
}

// 왜 버튼이 하나뿐인지 고객이 알 수 있게 적는다. 그냥 없으면 고장으로 보인다.
function pdRenderNote() {
  var noteEl = document.getElementById('pd-note');
  if (!noteEl) return;
  noteEl.textContent = pdHasFee()
    ? '상품 신청은 로그인이 필요합니다. 간편 신청은 이름과 연락처만으로 접수됩니다.'
    : '이 상품은 월 요금이 정해져 있지 않아 간편 신청으로 접수됩니다. 상담원이 확인 후 연락드립니다.';
}

// 지금 고객이 고른 약정·요금. 안 고르고 눌렀으면 처음 값(가장 싼 기간)이 나온다.
//
// ★ 이 값을 쓰지 않고 pdProduct.monthlyFee 를 그대로 실으면,
//   48개월을 고른 고객의 신청서에 60개월 최저가가 들어간다. 접수 사고가 된다.
function pdSelection() {
  if (typeof DapickProductView === 'undefined' || !DapickProductView.selection) {
    return { monthlyFee: pdProduct.monthlyFee, months: pdProduct.contractMonths };
  }
  var sel = DapickProductView.selection(document.getElementById('pd-view'));
  return {
    monthlyFee: sel.monthlyFee != null ? sel.monthlyFee : pdProduct.monthlyFee,
    months: sel.months != null ? sel.months : pdProduct.contractMonths
  };
}

// 정식 신청 — application.js 의 공용 모달. 로그인 안 돼 있으면 그쪽이 로그인으로 보낸다.
function pdApplyProduct() {
  if (typeof DapickApplication === 'undefined' || !DapickApplication.apply) {
    alert('신청 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
    return;
  }
  var topCat = pdParent || pdCategory;
  var sel = pdSelection();

  // 고른 약정을 상담 내용에 남긴다. 모달 요약과 접수 데이터 양쪽에 들어간다.
  // 원본 specs 를 그대로 넘기지 않고 복사하는 이유 - 여기서 약정을 끼워 넣으면
  // 상품 데이터 자체가 오염돼 화면을 다시 그릴 때 '약정기간' 이 스펙 표에 나타난다.
  var opts = {};
  var specs = pdProduct.specs || {};
  Object.keys(specs).forEach(function (k) { opts[k] = specs[k]; });
  if (sel.months) opts['약정기간'] = sel.months + '개월';

  DapickApplication.apply({
    category: (topCat && topCat.slug) ? topCat.slug : 'generic',
    productId: pdProduct.id,
    productName: pdProduct.name,
    monthlyPrice: sel.monthlyFee,
    selectedOptions: opts,
  });
}

// 간편 신청 — simple-apply.js 모달. 어떤 상품을 보고 눌렀는지 함께 넘긴다.
function pdApplySimple() {
  var topCat = pdParent || pdCategory;
  if (typeof openSimpleApply === 'function') {
    openSimpleApply((topCat && topCat.slug) ? topCat.slug : 'generic',
                    pdProduct.name, topCat ? topCat.name : null);
    return;
  }
  location.href = '/support';
}

function pdRenderDesc() {
  var sec = document.getElementById('pd-desc');
  var body = document.getElementById('pd-desc-body');
  var d = pdProduct.description;
  if (!d || !String(d).trim()) return;
  // 관리자가 넣은 평문이다. 줄바꿈만 살리고 태그는 escape 한다.
  body.innerHTML = pdEsc(d).replace(/\n/g, '<br/>');
  sec.hidden = false;
}

function pdRenderDetailImages() {
  var sec = document.getElementById('pd-detail-imgs');
  var body = document.getElementById('pd-detail-imgs-body');
  var imgs = pdProduct.galleryImages || [];
  // 위 갤러리에 이미 다 나온 경우(대표 이미지 없고 갤러리만 있을 때)에도
  // 아래에 길게 한 번 더 보여준다 — 상세 이미지는 세로로 이어 보는 것이 익숙하다.
  if (!imgs.length) return;
  body.innerHTML = imgs.map(function (u) {
    return '<img src="' + pdEsc(u) + '" alt="" loading="lazy" class="pd-detail-img"/>';
  }).join('');
  sec.hidden = false;
}
