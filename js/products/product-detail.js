// ════════════════════════════════════════════════════════
// /product-detail?id={상품 UUID} — 관리자가 만든 카테고리(GENERIC)의 상품 상세 (2026-08-01)
//
// 왜 이 파일이 필요한가:
//   카테고리 페이지(/c/{slug})에서 상품을 눌러도 갈 곳이 없었다.
//   상품마다 html 을 만들 수 없으니(관리자가 무제한으로 만든다) 이 틀 하나가 다 받는다.
//
// 자유 입력 항목(specs)의 "한글 이름" 찾기 — 이 화면의 핵심:
//   상품의 specs 는 { "f_lx3a9b": "9평형" } 처럼 key 로 저장된다.
//   key 를 label 과 따로 두는 이유는 label(오타 수정 등)이 바뀌어도 값이 미아가 안 되게 하기 위함이다.
//   그래서 화면에 뿌리려면 key -> label 표를 카테고리 정의에서 만들어야 한다.
//   합치는 순서(= 서버 규칙과 동일): 부모 카테고리 추가칸 → 타입 칸 → 자기 추가칸.
//   같은 key 가 겹치면 뒤엣것(더 구체적인 쪽)이 이긴다.
//   표에 없는 key 는 key 를 그대로 이름으로 쓴다 — 안 보여주면 관리자가 넣은 값이 사라진 것처럼 보인다.
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

function pdWon(v) {
  if (v == null || v === '') return '';
  return Number(v).toLocaleString() + '원';
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

// 자유 항목 정의를 합쳐 key -> 정의 표를 만든다.
// 서버(FieldSchemaNormalizer)와 같은 우선순위를 지켜야 어드민 입력 화면과 이름이 어긋나지 않는다.
function pdFieldMap() {
  var map = {};
  function put(list) {
    (list || []).forEach(function (f) {
      if (f && f.key) map[f.key] = f;
    });
  }
  if (pdParent) put(pdParent.fieldSchema);        // 부모 추가칸
  if (pdCategory) {
    put(pdCategory.fieldTemplateFields);          // 타입 칸
    put(pdCategory.fieldSchema);                  // 자기 추가칸 (가장 구체적 → 마지막)
  }
  return map;
}

// specs 값 하나를 사람이 읽는 문자열로.
function pdSpecValue(v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');       // multiselect
  if (typeof v === 'boolean') return v ? '있음' : '없음';
  return String(v);
}

(async function pdInit() {
  var id = pdId();
  var nameEl = document.getElementById('pd-name');
  if (!id) {
    nameEl.textContent = '주소가 올바르지 않습니다';
    return;
  }

  try {
    pdProduct = await api.get('/api/products/' + encodeURIComponent(id));
  } catch (e) {
    nameEl.textContent = '상품을 불러오지 못했습니다';
    return;
  }
  if (!pdProduct) {
    nameEl.textContent = '없는 상품입니다';
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
  pdRenderGallery();
  pdRenderSummary();
  pdRenderSpecs();
  pdRenderActions();
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

function pdRenderGallery() {
  var mainEl = document.getElementById('pd-main-img');
  var thumbEl = document.getElementById('pd-thumbs');

  // 대표 이미지 + 갤러리를 한 줄로 합친다. 중복은 제거한다.
  var imgs = [];
  if (pdProduct.imageUrl) imgs.push(pdProduct.imageUrl);
  (pdProduct.galleryImages || []).forEach(function (u) {
    if (u && imgs.indexOf(u) === -1) imgs.push(u);
  });

  if (!imgs.length) {
    mainEl.innerHTML = '<span class="pd-noimg">이미지 준비중</span>';
    thumbEl.innerHTML = '';
    return;
  }

  mainEl.innerHTML = '<img id="pd-main-img-el" src="' + pdEsc(imgs[0]) + '" alt="' + pdEsc(pdProduct.name) + '"/>';

  // 이미지가 하나뿐이면 썸네일 줄을 만들지 않는다.
  if (imgs.length < 2) { thumbEl.innerHTML = ''; return; }
  thumbEl.innerHTML = imgs.map(function (u, i) {
    return '<button type="button" class="pd-thumb' + (i === 0 ? ' is-on' : '') +
      '" onclick="pdPickImage(' + i + ')"><img src="' + pdEsc(u) + '" alt=""/></button>';
  }).join('');
  window.__pdImages = imgs;
}

function pdPickImage(i) {
  var imgs = window.__pdImages || [];
  if (!imgs[i]) return;
  var el = document.getElementById('pd-main-img-el');
  if (el) el.src = imgs[i];
  document.querySelectorAll('.pd-thumb').forEach(function (b, idx) {
    b.classList.toggle('is-on', idx === i);
  });
}

function pdRenderSummary() {
  var brandEl = document.getElementById('pd-brand');
  if (pdProduct.brandLogoUrl) {
    brandEl.innerHTML = '<img src="' + pdEsc(pdProduct.brandLogoUrl) + '" alt="' +
      pdEsc(pdProduct.brandName || '') + '" class="pd-brand-logo"/>';
  } else if (pdProduct.brandName) {
    brandEl.innerHTML = '<span class="pd-brand-name">' + pdEsc(pdProduct.brandName) + '</span>';
  }

  document.getElementById('pd-model').textContent = pdProduct.modelName || '';
  document.getElementById('pd-name').textContent = pdProduct.name || '';
  document.title = (pdProduct.name || '상품 상세') + ' | 다픽';

  var feeEl = document.getElementById('pd-fee');
  if (pdProduct.monthlyFee != null && pdProduct.monthlyFee !== '') {
    feeEl.innerHTML = '<small>월</small> <b>' + Number(pdProduct.monthlyFee).toLocaleString() + '</b>원' +
      (pdProduct.contractMonths ? '<span class="pd-months">' + pdProduct.contractMonths + '개월 약정</span>' : '');
  } else {
    feeEl.innerHTML = '<span class="pd-fee-none">가격 문의</span>';
  }
}

function pdRenderSpecs() {
  var el = document.getElementById('pd-specs');
  var specs = pdProduct.specs;
  if (!specs || typeof specs !== 'object') { el.innerHTML = ''; return; }

  var map = pdFieldMap();
  var rows = [];
  Object.keys(specs).forEach(function (k) {
    var val = pdSpecValue(specs[k]);
    if (!val) return;                       // 빈 값은 줄을 만들지 않는다
    var def = map[k];
    var label = (def && def.label) ? def.label : k;   // 정의에 없으면 key 를 그대로
    rows.push('<div class="pd-spec-row"><dt>' + pdEsc(label) + '</dt><dd>' + pdEsc(val) + '</dd></div>');
  });

  el.innerHTML = rows.join('');
}

function pdRenderActions() {
  var el = document.getElementById('pd-actions');
  var noteEl = document.getElementById('pd-note');
  var hasFee = pdProduct.monthlyFee != null && pdProduct.monthlyFee !== '' && Number(pdProduct.monthlyFee) > 0;

  var btns = [];
  if (hasFee) {
    btns.push('<button type="button" class="pd-btn pd-btn--main" onclick="pdApplyProduct()" data-track="product_apply">상품 신청하기</button>');
  }
  btns.push('<button type="button" class="pd-btn pd-btn--sub" onclick="pdApplySimple()" data-track="product_simple_apply">간편 신청</button>');
  el.innerHTML = btns.join('');

  // 왜 버튼이 하나뿐인지 고객이 알 수 있게 적는다. 그냥 없으면 고장으로 보인다.
  noteEl.textContent = hasFee
    ? '상품 신청은 로그인이 필요합니다. 간편 신청은 이름과 연락처만으로 접수됩니다.'
    : '이 상품은 월 요금이 정해져 있지 않아 간편 신청으로 접수됩니다. 상담원이 확인 후 연락드립니다.';
}

// 정식 신청 — application.js 의 공용 모달. 로그인 안 돼 있으면 그쪽이 로그인으로 보낸다.
function pdApplyProduct() {
  if (typeof DapickApplication === 'undefined' || !DapickApplication.apply) {
    alert('신청 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
    return;
  }
  var topCat = pdParent || pdCategory;
  DapickApplication.apply({
    category: (topCat && topCat.slug) ? topCat.slug : 'generic',
    productId: pdProduct.id,
    productName: pdProduct.name,
    monthlyPrice: pdProduct.monthlyFee,
    selectedOptions: pdProduct.specs || {},
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
