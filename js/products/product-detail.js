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

// 마이페이지 찜·비교함에서 눌러 들어오면 ?id=…&months=48 로 온다.
// 그 약정이 처음부터 켜져 있어야 "내가 보던 그 화면" 이 된다.
// ⚠ 키 이름 months 는 product-url.js 가 만드는 것과 짝이다. 한쪽만 바꾸면
//   링크는 열리는데 약정만 기본값으로 돌아간다 - 눈치채기 어려운 오류다.
function pdWantMonths() {
  return new URLSearchParams(location.search).get('months') || '';
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

  // FAQ 는 상세보다 먼저 받아둔다. 탭을 만들지 말지가 FAQ 개수로 정해지기 때문이다.
  // 실패해도 상세는 그대로 보여준다 - FAQ 때문에 상품 화면이 안 뜨면 안 된다.
  await pdLoadFaq();

  pdRenderCrumb();
  pdRenderView();
  pdRenderNote();
  pdRenderDetail();
  pdMountBottomBar();
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
    wantMonths: pdWantMonths(),
    actionsHtml: pdActionsHtml()
  });
  DapickProductView.bind(el);

  pdMountFav(el);
  pdMountCompare(el);
  pdRegisterPicker();

  // 약정을 바꾸면 찜·비교의 '담긴 상태'가 달라진다. 버튼에게 다시 확인하라고 알린다.
  el.addEventListener('pv2-selection-change', function () {
    if (pdFav && pdFav.refresh) pdFav.refresh();
    if (pdCmp && pdCmp.refresh) pdCmp.refresh();
  });

  document.title = (pdProduct.name || '상품 상세') + ' | 다픽';
}

// ── 찜 / 비교 ──────────────────────────────────────────
//
// 담는 단위가 '상품' 이 아니라 '조합' 이다 — 같은 에어컨이라도 36개월과 60개월은
// 월 요금이 다르니 비교표에서 별개 항목이어야 한다. 정수기·인터넷과 같은 규칙이다.
// 지금 이 화면의 조합은 약정 하나뿐이므로 options = { months: 60 } 이 된다.
//
// ⚠ options 의 키 이름(months)은 product-url.js 가 링크를 만들 때도 쓴다.
//   한쪽만 바꾸면 마이페이지에서 눌러 돌아왔을 때 약정이 기본값으로 리셋된다.
var pdFav = null;
var pdCmp = null;

function pdComboLabel() {
  var sel = pdSelection();
  var bits = [pdProduct.name || ''];
  if (pdProduct.modelName) bits.push(pdProduct.modelName);
  if (sel.months) bits.push(sel.months + '개월');
  return bits.filter(Boolean).join(' · ');
}

function pdComboOptions() {
  var sel = pdSelection();
  return sel.months ? { months: sel.months } : {};
}

function pdMountFav(root) {
  var mount = root.querySelector('.pv2-fav-slot');
  if (!mount || typeof dpFavInit !== 'function') return;
  pdFav = dpFavInit(mount, pdProduct.id, {
    state: function () {
      var sel = pdSelection();
      return {
        options: pdComboOptions(),
        label: pdComboLabel(),
        monthlyFee: sel.monthlyFee
      };
    }
  });
}

// 비교 트레이의 '+' 카드 — 목록 페이지로 내보내지 않고 그 자리에서 고르게 한다.
//
// 목록을 가져오는 일을 공용 파일이 아니라 여기서 하는 이유(정수기와 같은 판단):
//   카테고리마다 상품 API 도 가격 구조도 다르다. compare-view.js 가 그걸 전부 알면
//   카테고리를 하나 만들 때마다 공용 파일을 고쳐야 한다.
//
// 같은 카테고리 안에서만 고른다 - 에어컨 비교표에 안마의자가 끼면 표가 성립하지 않는다.
function pdRegisterPicker() {
  if (!window.dpCompareView || typeof window.dpCompareView.registerPicker !== 'function') return;
  if (!pdProduct.categoryId) return;

  window.dpCompareView.registerPicker('GENERIC', function () {
    return api
      .get('/api/products?categoryId=' + encodeURIComponent(pdProduct.categoryId))
      .then(function (list) {
        return (Array.isArray(list) ? list : [])
          .filter(function (r) { return r && r.id !== pdProduct.id; })
          .map(function (r) {
            // 상대 상품에는 지금 화면과 같은 약정이 없을 수 있다.
            // 그때는 가장 싼 줄로 떨어뜨린다 - 빈 칸을 두면 비교가 안 된다.
            var plans = (r.options && r.options.rentalPlans) || [];
            var want = pdSelection().months;
            var hit = null;
            for (var i = 0; i < plans.length; i++) {
              if (want && String(plans[i].months) === String(want)) { hit = plans[i]; break; }
            }
            if (!hit && plans.length) {
              hit = plans.slice().sort(function (a, b) {
                return (a.monthlyFee || 0) - (b.monthlyFee || 0);
              })[0];
            }
            var months = hit ? hit.months : r.contractMonths;
            var fee = hit ? hit.monthlyFee : r.monthlyFee;
            var bits = [r.name || ''];
            if (r.modelName) bits.push(r.modelName);
            if (months) bits.push(months + '개월');
            return {
              category: 'GENERIC',
              id: r.id,
              name: r.name,
              model: r.modelName,
              image: r.imageUrl,
              label: bits.filter(Boolean).join(' · '),
              monthlyFee: fee,
              options: months ? { months: months } : {}
            };
          });
      })
      .catch(function () { return []; });
  });
}

function pdMountCompare(root) {
  var mount = root.querySelector('.pv2-cmp-slot');
  if (!mount || typeof dpCompareInit !== 'function') return;
  pdCmp = dpCompareInit(mount, pdProduct.id, {
    snapshot: function () {
      var sel = pdSelection();
      return {
        // 관리자가 만든 카테고리의 상품은 전부 이 서랍에 담긴다.
        // compare-button.js 의 CATS 에 GENERIC 이 없으면 조용히 담기지 않는다.
        category: 'GENERIC',
        name: pdProduct.name,
        model: pdProduct.modelName,
        image: pdProduct.imageUrl,
        label: pdComboLabel(),
        monthlyFee: sel.monthlyFee,
        options: pdComboOptions()
      };
    }
  });
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
// withTip - 말풍선을 뺄 수 있게 열어 둔다. 지금은 위쪽 버튼과 하단 바 둘 다 붙인다.
// 하단 바는 말풍선이 버튼 위로 삐져나오므로 CSS 에서 바 위쪽 여백을 그만큼 준다.
function pdActionsHtml(withTip) {
  var tip = withTip === false ? '' : '<span class="sapply-tip">3초만에 간편신청하기</span>';
  var btns = [];
  if (pdHasFee()) {
    btns.push('<button type="button" class="pd-btn pd-btn--main" onclick="pdApplyProduct()" data-track="product_apply">상품 신청</button>');
  }
  // 간편 신청은 다른 화면(.sapply-inline)과 같은 파란 버튼 + 말풍선으로 통일한다.
  // 말풍선(.sapply-tip) 스타일은 simple-apply.js 가 주입한다 - 여기서 다시 만들면 사본이 된다.
  btns.push('<button type="button" class="pd-btn pd-btn--simple" onclick="pdApplySimple()" data-track="product_simple_apply">' +
    tip + '간편 신청</button>');
  btns.push('<button type="button" class="pd-btn pd-btn--kakao" onclick="pdApplyKakao()" data-track="product_kakao">카카오톡 문의</button>');
  return btns.join('');
}

// ── 하단 고정 바 + 맨 위로 ──────────────────────────────
//
// 상세 정보 영역까지 내려오면 위쪽 신청 버튼은 화면 밖으로 나간다.
// 거기서부터는 화면 아래에 같은 버튼을 붙여 둔다. 상품명을 왼쪽에 함께 적는 이유는
// 한참 내려온 뒤에는 지금 보고 있는 게 어느 상품인지 흐려지기 때문이다.
//
// ★ 화면 아래를 나눠 쓰는 것들이 셋이다 — 비교 트레이 / 이 바 / 카카오 플로팅.
//   각자 bottom:0 을 잡으면 서로 겹친다. 아래에서부터 트레이 → 바 → 카카오 순으로 쌓고,
//   앞엣것의 높이를 재서 뒤엣것을 밀어 올린다. 트레이는 열고 닫히므로 그때마다 다시 잰다.
function pdMountBottomBar() {
  var sec = document.getElementById('pd-detail');
  if (!sec || sec.hidden) return;   // 상세 영역이 없으면 바도 만들지 않는다

  var bar = document.createElement('div');
  bar.className = 'pd-bottombar';
  bar.id = 'pd-bottombar';
  bar.hidden = true;
  bar.innerHTML =
    '<div class="pd-bb-inner">' +
      // 맨 위로 - 화면 오른쪽은 카카오와 비교함이 쓰고 있어 여기 안에 둔다.
      '<button type="button" class="pd-bb-top" onclick="pdScrollTop()" aria-label="맨 위로">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"' +
        ' stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>' +
      '</button>' +
      '<div class="pd-bb-name">' + pdEsc(pdProduct.name || '') + '</div>' +
      '<div class="pd-bb-btns">' + pdActionsHtml() + '</div>' +
    '</div>';
  document.body.appendChild(bar);

  // 상세 영역이 화면에 걸치면 켠다.
  // 조금 걸쳐도 켜야 한다 - 다 들어와야 켜지면 긴 상세에서는 영영 안 나온다.
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        bar.hidden = !e.isIntersecting;
        pdSyncFloats();
      });
    }).observe(sec);
  } else {
    // 아주 오래된 브라우저 - 그냥 계속 보여준다. 안 보이는 것보다 낫다.
    bar.hidden = false;
  }

  pdSyncFloats();
  window.addEventListener('resize', pdSyncFloats);
  // 비교 트레이가 열리거나 닫히면 높이가 바뀐다(compare-button.js 가 쏘는 신호).
  window.addEventListener('dp-compare-change', function () {
    setTimeout(pdSyncFloats, 60);   // 트레이가 다시 그려진 뒤에 잰다
  });
}

function pdScrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 화면 오른쪽 아래를 나눠 쓰는 것들의 자리를 맞춘다.
// 아래에서부터 [하단 바] → [카카오] → [비교함 칩] 순으로 쌓인다.
// 비교함 칩은 compare-view.js 가 카카오를 기준으로 스스로 올라간다.
function pdSyncFloats() {
  var bar = document.getElementById('pd-bottombar');
  var kakao = document.querySelector('.kakao-float');

  var barH = bar && !bar.hidden ? bar.offsetHeight : 0;
  if (bar) bar.style.bottom = '0px';

  // 카카오의 원래 자리는 화면 크기마다 다르다 - common.css 에서 PC 28px / 모바일 80px.
  // 여기서 28 로 고정하면 모바일에서 카카오가 원래보다 아래로 내려간다.
  var base = window.innerWidth <= 900 ? 80 : 28;
  if (kakao) kakao.style.bottom = (barH + base) + 'px';

  // 칩이 카카오를 따라 올라가야 한다. compare-view 가 다시 재도록 알린다.
  if (window.dpCompareView && window.dpCompareView.placeChip) window.dpCompareView.placeChip();
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
    // 네 번째 인자가 핵심이다 (2026-08-03).
    // 앞의 셋은 모달에 보여 줄 값이고, 서버가 실제로 이어 붙이는 것은 여기 담긴 id 다.
    // 이게 없으면 에어컨 → 벽걸이 → 상품 → 간편신청 을 해도 서버에는 'airconditioner'
    // 라는 글자 하나만 남는다. 그러면 그 고객이 나중에 후기를 써도 이 상품 상세에는 안 붙는다 —
    // 상품 상세는 상품 id 로 후기를 찾기 때문이다.
    openSimpleApply((topCat && topCat.slug) ? topCat.slug : 'generic',
                    pdProduct.name, topCat ? topCat.name : null,
                    { categoryId: topCat ? topCat.id : null, productId: pdProduct.id });
    return;
  }
  location.href = '/support';
}

// ── 상세 정보 (설명 + 상세 이미지) ─────────────────────
//
// 둘을 한 덩어리로 묶고 처음에는 잘라서 보여준다.
// 상세 이미지가 열 장이면 화면이 수천 픽셀이 되고, 그 아래에 뭐가 더 있는지
// 아무도 모른 채 스크롤만 하게 된다. 정수기 상세(wdDetailBody)와 같은 방식이다.
//
// 내용이 접힘 높이보다 짧으면 버튼과 흐림 효과를 지운다 -
// 눌러도 아무 일 없는 버튼은 고장으로 읽힌다.
var PD_COLLAPSED_PX = 1000;

// ── 자주 묻는 질문 ─────────────────────────────────────
//
// FAQ 는 최상위 카테고리에만 달린다(어드민 FaqRequest 의 "소속 카테고리(최상위) id").
// 그래서 이 상품이 품목(하위)에 속해 있으면 그 부모의 FAQ 를 가져와야 한다.
// 품목 id 로 물어보면 언제나 0건이 나오는데, 그러면 탭이 영영 안 생긴다.
//
// 질문이 하나도 없으면 탭을 만들지 않는다. 눌러도 빈 화면만 나오는 탭은
// 고객에게 '준비 안 된 서비스' 로 읽힌다(웹 FAQ 화면과 같은 규칙).
var PD_PANELS = { detail: 'pd-detail-body', faq: 'pd-faq-body' };
var pdFaqRows = [];

async function pdLoadFaq() {
  var top = pdParent || pdCategory;
  if (!top || !top.id) return;
  try {
    var list = await api.get('/api/faqs?categoryId=' + encodeURIComponent(top.id));
    pdFaqRows = (Array.isArray(list) ? list : (list && list.content) || [])
      .filter(function (f) { return f && f.question; });
  } catch (e) {
    pdFaqRows = [];
  }
}

// 탭 줄. 질문이 없으면 아예 안 그린다 - 탭이 하나뿐이면 탭일 이유가 없다.
function pdRenderTabs() {
  var bar = document.getElementById('pd-tabbar');
  if (!bar) return;

  if (!pdFaqRows.length) {
    bar.innerHTML = '<h2 class="pd-sec-title">상세 정보</h2>';
    return;
  }

  bar.innerHTML =
    '<button type="button" class="pd-tab is-on" data-tab="detail">상세 정보</button>' +
    '<button type="button" class="pd-tab" data-tab="faq">자주 묻는 질문' +
    '<span class="pd-tab-count">' + pdFaqRows.length + '</span></button>';

  if (!bar.__bound) {
    bar.__bound = true;
    bar.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.pd-tab');
      if (t) pdSetTab(t.getAttribute('data-tab'));
    });
  }
  pdRenderFaq();
}

// 패널은 미리 그려두고 보이기/숨기기만 한다.
// 누를 때마다 다시 그리면 펼쳐둔 상세가 접히고 스크롤이 튄다.
function pdSetTab(key) {
  var bar = document.getElementById('pd-tabbar');
  if (bar) {
    bar.querySelectorAll('.pd-tab').forEach(function (t) {
      t.classList.toggle('is-on', t.getAttribute('data-tab') === key);
    });
  }
  Object.keys(PD_PANELS).forEach(function (k) {
    var el = document.getElementById(PD_PANELS[k]);
    if (el) el.hidden = k !== key;
  });
  // 탭을 바꾸면 상세 접기 버튼의 높이 판정이 어긋난다(숨은 동안 높이가 0이었다).
  if (key === 'detail') setTimeout(pdMeasureCollapse, 0);
}

function pdRenderFaq() {
  var el = document.getElementById('pd-faq-body');
  if (!el || !pdFaqRows.length) return;

  el.innerHTML = '<div class="pd-faq-list">' + pdFaqRows.map(function (f) {
    // 클래스는 이 화면 전용으로 둔다. 홈의 faq-* 를 빌려 쓰면 그쪽 디자인이
    // 바뀔 때 여기가 같이 깨지고, 원인을 이 파일에서 찾을 수 없다.
    // toggleFaq(utils.js)는 클래스명을 안 보고 바로 다음 형제에 open 을 붙이므로 그대로 쓸 수 있다.
    return '<div class="pd-faq-item">' +
      '<div class="pd-faq-q" onclick="toggleFaq(this)">' +
        '<span>Q. ' + pdEsc(f.question) + '</span>' +
        '<svg class="pd-faq-ico" viewBox="0 0 24 24" width="16" height="16" fill="none"' +
        ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 9l6 6 6-6"/></svg>' +
      '</div>' +
      '<div class="pd-faq-a"><div class="pd-faq-a-inner">' + pdFaqAnswer(f) + '</div></div>' +
      '</div>';
  }).join('') + '</div>';
}

// 답변은 어드민 편집기가 만든 서식(Quill Delta)이다.
// dpRichHtml 은 공용 변환기이고 Quill 이 페이지에 있어야 동작한다(html 에 함께 넣었다).
// 변환기가 없거나 본문이 비면 대체 문구를 보여준다 - 빈 칸이면 고장으로 읽힌다.
function pdFaqAnswer(f) {
  if (typeof dpRichHtml === 'function' && f.detailContent) {
    var html = dpRichHtml(f.detailContent);
    if (html) return '<div class="ql-snow"><div class="ql-editor pd-faq-ql">' + html + '</div></div>';
  }
  return '<span class="pd-faq-none">답변이 준비 중입니다.</span>';
}

function pdRenderDetail() {
  var sec = document.getElementById('pd-detail');
  var body = document.getElementById('pd-detail-body');
  if (!sec || !body) return;

  var inner = '';

  var d = pdProduct.description;
  if (d && String(d).trim()) {
    // 관리자가 넣은 평문이다. 줄바꿈만 살리고 태그는 escape 한다.
    inner += '<div class="pd-desc-body">' + pdEsc(d).replace(/\n/g, '<br/>') + '</div>';
  }

  var imgs = pdProduct.galleryImages || [];
  if (imgs.length) {
    inner += '<div class="pd-detail-imgs">' + imgs.map(function (u) {
      return '<img src="' + pdEsc(u) + '" alt="" loading="lazy" class="pd-detail-img"/>';
    }).join('') + '</div>';
  }

  // 상세 내용이 없어도 FAQ 가 있으면 섹션은 띄운다.
  // 둘 다 없을 때만 접는다.
  if (!inner) {
    if (!pdFaqRows.length) return;
    body.innerHTML = '<p class="pd-empty">상세 정보가 아직 등록되지 않았습니다.</p>';
    sec.hidden = false;
    pdRenderTabs();
    return;
  }

  body.innerHTML =
    '<div class="pd-collapse" id="pd-collapse">' + inner +
      '<div class="pd-collapse-fade" id="pd-collapse-fade"></div>' +
    '</div>' +
    '<button type="button" class="pd-expand-btn" id="pd-expand-btn" onclick="pdToggleDetail()">' +
      '<span>상세정보 펼쳐보기</span>' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
    '</button>';
  sec.hidden = false;
  pdRenderTabs();

  // 이미지가 아직 안 실렸으면 높이가 0에 가깝다. 그 상태로 재면 항상 "짧다" 가 나온다.
  // 그래서 지금 한 번, 이미지가 다 실린 뒤에 한 번 더 잰다.
  pdMeasureCollapse();
  var imgEls = body.querySelectorAll('img');
  var pending = 0;
  imgEls.forEach(function (im) {
    if (im.complete) return;
    pending++;
    im.addEventListener('load', pdMeasureCollapse);
    im.addEventListener('error', pdMeasureCollapse);
  });
  if (!pending) requestAnimationFrame(pdMeasureCollapse);
}

function pdMeasureCollapse() {
  var wrap = document.getElementById('pd-collapse');
  var btn = document.getElementById('pd-expand-btn');
  var fade = document.getElementById('pd-collapse-fade');
  if (!wrap || !btn) return;
  if (wrap.classList.contains('is-open')) return;   // 이미 펼쳐 봤으면 건드리지 않는다

  // 접힘 높이를 JS 에 숫자로 박아두지 않고 CSS 에서 읽는다.
  // 모바일은 화면이 좁아 같은 내용도 훨씬 길어지므로 CSS 에서 값을 줄여 두는데,
  // 여기서 1000 으로 고정해 재면 640~1060px 짜리 상세가 '짧다' 로 판정돼
  // 버튼이 사라진 채 내용만 잘린다.
  wrap.style.maxHeight = '';
  var limit = parseFloat(getComputedStyle(wrap).maxHeight);
  if (isNaN(limit)) limit = PD_COLLAPSED_PX;

  var short = wrap.scrollHeight <= limit + 60;
  wrap.style.maxHeight = short ? 'none' : '';
  btn.style.display = short ? 'none' : '';
  if (fade) fade.style.display = short ? 'none' : '';
}

function pdToggleDetail() {
  var wrap = document.getElementById('pd-collapse');
  var btn = document.getElementById('pd-expand-btn');
  var fade = document.getElementById('pd-collapse-fade');
  if (!wrap || !btn) return;

  var open = wrap.classList.toggle('is-open');
  btn.classList.toggle('is-open', open);
  btn.querySelector('span').textContent = open ? '접기' : '상세정보 펼쳐보기';
  if (fade) fade.style.display = open ? 'none' : '';

  // 접을 때는 상세 영역 맨 위로 돌려준다.
  // 안 그러면 한참 아래에 있던 화면이 갑자기 짧아져 어디를 보고 있었는지 알 수 없다.
  if (!open) {
    var sec = document.getElementById('pd-detail');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
