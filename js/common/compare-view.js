// ────────────────────────────────────────────────
// compare-view.js — 비교함을 '보여주는' 쪽 전부
// 의존: compare-button.js(window.dpCompareStore), product-url.js(dpProductUrl/dpListUrl)
//
//   dpCompareView.injectStyles()
//   dpCompareView.table(cat, items)     비교표 HTML 문자열
//   dpCompareView.bind(rootEl, onChange) 표 안의 빼기/비우기 버튼 연결
//   dpCompareView.mountTray(cat)        상세 페이지 하단 3칸 트레이 띄우기
//   dpCompareView.openSheet(cat, notice) 하단 비교 시트 열기(notice - 맨 위 한 줄 안내, 선택)
//
// ★ 구조
//   담기(compare-button.js) / URL(product-url.js) / 보여주기(이 파일) 를 나눴다.
//   표를 그리는 코드는 이 파일 하나뿐이다 — 마이페이지 비교함 탭과
//   상세 하단 비교 시트가 같은 table() 을 부른다. 한쪽만 고쳐지는 사고를 막는다.
//
// ★ 카테고리 잠금
//   트레이는 mountTray(cat) 로 받은 '그 페이지의 카테고리' 서랍만 그린다.
//   인터넷·TV 상세에서는 인터넷·TV 서랍만 보이고, '+' 카드도 인터넷 목록으로
//   보낸다. 그래서 다른 카테고리가 섞일 경로 자체가 없다.
// ────────────────────────────────────────────────
(function () {
  var CAT_LABEL = {
    INTERNET_TV: '인터넷·TV',
    WATER: '정수기',
    RENTAL: '렌탈',
    // 관리자가 만든 카테고리의 상품(에어컨·안마의자 …). 2026-08-01 추가.
    // ⚠ 여기 없는 카테고리는 mountTray/openPicker 가 조용히 return 해서 트레이가 아예 안 뜬다.
    // 이름을 '상품' 으로 뭉뚱그린 이유 - 서랍이 카테고리별로 나뉘어 있지 않고 하나다.
    // 에어컨과 안마의자가 한 표에 섞이는 게 문제가 되면 그때 서랍을 카테고리 id 로 쪼갠다.
    GENERIC: '상품',
  };

  // 옵션 키 → 한글 이름. 이 표에 없는 키는 키 이름 그대로 행이 생긴다
  // (조용히 사라지는 것보다 낫다 — 새 옵션이 붙었다는 신호가 된다).
  var LABEL = {
    carrier: '통신사',
    net: '인터넷',
    tv: 'TV',
    settop: '셋톱',
    tv2: 'TV2',
    settop2: '셋톱2',
    router: '공유기',
    wifimode: '와이파이',
    wifi7d: '와이파이 7일',
    contract: '약정',
    months: '약정기간',   // 관리자가 만든 카테고리의 상품이 쓰는 키
    cycle: '관리주기',
    type: '가입조건',
    color: '색상',
  };
  // 행 순서 — 위 표의 순서대로 깔고, 모르는 키는 뒤에 붙인다.
  var ORDER = Object.keys(LABEL);

  function store() { return window.dpCompareStore || null; }
  function maxCount() { var s = store(); return s ? s.MAX : 3; }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── 스타일 ────────────────────────────────────────
  var _styled = false;
  function injectStyles() {
    if (_styled) return; _styled = true;
    var css =
      // 카테고리 칩 (마이페이지 비교함 탭)
      '.dp-cmp-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}' +
      '.dp-cmp-cat{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #e6e2f2;background:#fff;color:#6a6880;border-radius:999px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.dp-cmp-cat.is-on{background:#f1ecff;border-color:#c9bdf5;color:#4b2ecb;}' +
      '.dp-cmp-cnt{font-size:12px;color:#a09dba;}' +
      '.dp-cmp-cat.is-on .dp-cmp-cnt{color:#7b62e0;}' +
      // 430px 에서도 열이 안 눌리게 가로 스크롤. 첫 열(항목명)은 붙여둔다.
      '.dp-cmp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #eeecf5;border-radius:12px;background:#fff;}' +
      '.dp-cmp-table{border-collapse:separate;border-spacing:0;width:100%;min-width:360px;}' +
      '.dp-cmp-table th,.dp-cmp-table td{border-bottom:1px solid #f2f0f8;padding:10px 12px;text-align:center;vertical-align:middle;}' +
      '.dp-cmp-table tr:last-child th,.dp-cmp-table tr:last-child td{border-bottom:none;}' +
      '.dp-cmp-h{position:sticky;left:0;z-index:1;background:#faf9ff;color:#6a6880;font-size:12.5px;font-weight:700;text-align:left;white-space:nowrap;min-width:84px;}' +
      '.dp-cmp-col{background:#fff;min-width:132px;}' +
      '.dp-cmp-thumb{width:84px;height:60px;object-fit:contain;background:#fff;border-radius:8px;display:block;margin:0 auto 6px;}' +
      '.dp-cmp-thumb--empty{display:flex;align-items:center;justify-content:center;background:#f4f6fb;color:#b7bccb;font-size:11px;line-height:1.3;}' +
      '.dp-cmp-name{font-size:13.5px;font-weight:700;color:#221f38;line-height:1.35;}' +
      '.dp-cmp-model{font-size:11.5px;color:#8a879c;margin-top:2px;}' +
      '.dp-cmp-drop{margin-top:8px;padding:4px 10px;border:1px solid #eee;background:#fff;color:#a09dba;border-radius:999px;font-size:11.5px;cursor:pointer;font-family:inherit;}' +
      '.dp-cmp-drop:hover{color:#e8547a;border-color:#f3c9d5;}' +
      // 월 요금 행 = 이 화면의 본문. 나머지 행보다 확실히 커야 한다.
      '.dp-cmp-fee td{background:#fbfaff;padding-top:14px;padding-bottom:14px;}' +
      '.dp-cmp-fee .dp-cmp-h{background:#f5f1ff;color:#4b2ecb;font-size:13px;}' +
      '.dp-cmp-price{font-size:18px;font-weight:800;color:#221f38;}' +
      '.dp-cmp-price.is-best{color:#4b2ecb;}' +
      '.dp-cmp-best{display:block;margin-top:4px;font-size:11px;font-weight:700;color:#fff;background:#4b2ecb;border-radius:999px;padding:2px 8px;width:fit-content;margin-left:auto;margin-right:auto;}' +
      '.dp-cmp-gap{display:block;margin-top:4px;font-size:11.5px;color:#e8547a;}' +
      '.dp-cmp-ask{font-size:12.5px;color:#a09dba;}' +
      '.dp-cmp-v{font-size:13px;color:#3d3a52;}' +
      '.dp-cmp-dash{color:#c9c6d8;}' +
      // 값이 전부 같은 행은 비교에 도움이 안 된다 — 지우지 말고 흐리게만.
      '.dp-cmp-table tr.is-same td{color:#a5a2b8;}' +
      '.dp-cmp-link{font-size:12.5px;color:#4b2ecb;text-decoration:none;font-weight:700;}' +
      '.dp-cmp-link:hover{text-decoration:underline;}' +
      '.dp-cmp-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap;}' +
      '.dp-cmp-note{font-size:12px;color:#a7a5b8;line-height:1.5;}' +
      '.dp-cmp-clear{padding:7px 14px;border:1px solid #eee;background:#fff;color:#8a879c;border-radius:999px;font-size:12.5px;cursor:pointer;font-family:inherit;}' +
      '.dp-cmp-clear:hover{color:#e8547a;border-color:#f3c9d5;}' +

      // ── 하단 트레이 ───────────────────────────────
      // z-index 1200: 인터넷 옵션 다이얼로그(9998)보다 아래,
      // 목록 필터 서랍(1000)/토글(900)보다 위. 다이얼로그가 열리면 덮인다.
      '.dp-tray{position:fixed;left:0;right:0;bottom:0;z-index:1200;background:#fff;' +
      'border-top:1px solid #eae6f5;box-shadow:0 -6px 24px rgba(40,30,90,.10);' +
      'padding:10px 14px calc(10px + env(safe-area-inset-bottom));}' +
      '.dp-tray[hidden]{display:none;}' +
      '.dp-tray__inner{max-width:1100px;margin:0 auto;}' +
      '.dp-tray__head{display:flex;align-items:center;gap:8px;margin-bottom:8px;}' +
      '.dp-tray__title{font-size:13px;font-weight:800;color:#221f38;}' +
      '.dp-tray__title em{font-style:normal;color:#4b2ecb;}' +
      '.dp-tray__spacer{flex:1;}' +
      '.dp-tray__mini{padding:4px 10px;border:1px solid #eee;background:#fff;color:#8a879c;border-radius:999px;font-size:11.5px;cursor:pointer;font-family:inherit;}' +
      '.dp-tray__mini:hover{color:#4b2ecb;border-color:#c9bdf5;}' +
      '.dp-tray__close{width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;' +
      'border:1px solid #eee;background:#fff;color:#8a879c;border-radius:50%;font-size:12px;line-height:1;' +
      'cursor:pointer;font-family:inherit;}' +
      '.dp-tray__close:hover{color:#e8547a;border-color:#f3c9d5;}' +

      // ── 비교함 버튼 (2026-08-03, 트레이를 대체) ─────
      // 카카오 상담과 같은 크기·같은 열에 선다. 위치(bottom)는 placeChip 이 잡는다.
      '.dp-chip{position:fixed;right:28px;z-index:1200;display:flex;flex-direction:column;align-items:center;gap:6px;}' +
      '.dp-chip[hidden]{display:none;}' +
      '.dp-chip__btn{position:relative;width:56px;height:56px;border-radius:50%;border:none;' +
      'background:#4b2ecb;color:#fff;display:flex;align-items:center;justify-content:center;' +
      'cursor:pointer;box-shadow:0 4px 20px rgba(40,30,90,.28);transition:transform .15s;font-family:inherit;}' +
      '.dp-chip__btn:hover{transform:scale(1.06);}' +
      // 담긴 개수. 이게 없으면 눌러보기 전에는 뭐가 들었는지 알 수 없다.
      '.dp-chip__count{position:absolute;top:-3px;right:-3px;min-width:21px;height:21px;padding:0 5px;' +
      'border-radius:999px;background:#e8547a;color:#fff;font-size:12px;font-weight:800;' +
      'display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;}' +
      // 이름표. 카카오 버튼의 것과 같은 모양이라 셋이 한 세트로 읽힌다.
      '.dp-chip__label{font-size:10px;font-weight:700;color:#6a6880;background:#fff;' +
      'border:1px solid #eee;padding:3px 10px;border-radius:999px;white-space:nowrap;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.10);}' +
      // 닫기는 버튼 왼쪽 위 모서리에 겹쳐 둔다. 아래에 두면 이름표와 뒤엉킨다.
      // 개수 뱃지가 오른쪽 위에 있으므로 반대쪽으로 보낸다.
      '.dp-chip__x{position:absolute;top:-4px;left:-4px;z-index:1;' +
      'width:20px;height:20px;border-radius:50%;border:1px solid #e6e2f2;background:#fff;' +
      'color:#a09dba;font-size:10px;line-height:1;cursor:pointer;font-family:inherit;' +
      'display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.10);}' +
      '.dp-chip__x:hover{color:#e8547a;border-color:#f3c9d5;}' +
      '@media(max-width:900px){.dp-chip{right:16px;}' +
      '.dp-chip__btn{width:50px;height:50px;}}' +

      // 시트 머리의 '상품 추가' — 트레이의 빈 칸이 하던 일을 여기로 옮겼다.
      '.dp-sheet__add{padding:6px 13px;border:1px solid #c9bdf5;background:#f6f3ff;color:#4b2ecb;' +
      'border-radius:999px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-left:auto;}' +
      '.dp-sheet__add:hover{background:#ede7ff;}' +
      '.dp-sheet__hint{font-size:12.5px;color:#a7a5b8;padding:10px 2px 0;line-height:1.5;}' +
      '.dp-tray__slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;}' +
      '.dp-tray.is-fold .dp-tray__slots{display:none;}' +
      '.dp-slot{position:relative;border:1px solid #eeecf5;border-radius:12px;background:#fff;' +
      'padding:8px 8px 9px;min-height:96px;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;text-align:center;text-decoration:none;}' +
      '.dp-slot__img{width:56px;height:42px;object-fit:contain;display:block;margin-bottom:4px;}' +
      '.dp-slot__img--empty{display:flex;align-items:center;justify-content:center;background:#f4f6fb;' +
      'color:#b7bccb;font-size:10px;border-radius:6px;}' +
      '.dp-slot__name{font-size:12px;font-weight:700;color:#221f38;line-height:1.3;' +
      'display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;width:100%;}' +
      '.dp-slot__label{font-size:10.5px;color:#8a879c;margin-top:2px;line-height:1.3;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;width:100%;}' +
      '.dp-slot__fee{font-size:12.5px;font-weight:800;color:#4b2ecb;margin-top:3px;}' +
      '.dp-slot__x{position:absolute;top:3px;right:3px;width:20px;height:20px;line-height:18px;' +
      'border:1px solid #eee;background:#fff;color:#b7b4c8;border-radius:50%;font-size:12px;' +
      'cursor:pointer;font-family:inherit;padding:0;}' +
      '.dp-slot__x:hover{color:#e8547a;border-color:#f3c9d5;}' +
      // 빈 칸 = '+' 카드. 목록으로 보내는 링크다(카테고리는 그대로 잠긴다).
      '.dp-slot--add{border-style:dashed;border-color:#dcd6f0;background:#fbfaff;}' +
      '.dp-slot--add:hover{border-color:#b9a9f0;background:#f6f2ff;}' +
      '.dp-slot__plus{font-size:22px;font-weight:400;color:#b9a9f0;line-height:1;}' +
      '.dp-slot__addtxt{font-size:11.5px;color:#8a879c;margin-top:5px;}' +
      '.dp-tray__go{display:block;width:100%;padding:12px;border:0;border-radius:12px;' +
      'background:#4b2ecb;color:#fff;font-size:14.5px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.dp-tray__go:disabled{background:#eceaf5;color:#a8a5bb;cursor:default;}' +
      '@media(min-width:768px){.dp-tray__slots{gap:12px;}.dp-slot{min-height:110px;}}' +

      // ── 비교 시트 ─────────────────────────────────
      // 트레이보다 위, 인터넷 옵션 다이얼로그(9998)보다는 아래.
      '.dp-sheet-ov{position:fixed;inset:0;z-index:9500;background:rgba(24,18,50,.45);' +
      'display:flex;align-items:flex-end;justify-content:center;}' +
      '.dp-sheet-ov[hidden]{display:none;}' +
      '.dp-sheet{width:100%;max-width:900px;background:#f8f7fc;border-radius:18px 18px 0 0;' +
      'max-height:88vh;display:flex;flex-direction:column;}' +
      '.dp-sheet__head{display:flex;align-items:center;gap:8px;padding:14px 16px 10px;}' +
      '.dp-sheet__title{font-size:15px;font-weight:800;color:#221f38;flex:1;}' +
      '.dp-sheet__close{padding:6px 12px;border:1px solid #e6e2f2;background:#fff;color:#6a6880;' +
      'border-radius:999px;font-size:12.5px;cursor:pointer;font-family:inherit;}' +
      '.dp-sheet__body{padding:0 16px 18px;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
      // 담기가 막혀서 시트가 열렸을 때만 뜨는 안내. 회색 힌트(.dp-sheet__hint)와 달리
      // 색을 넣은 이유 - 사용자가 방금 누른 동작이 '실패' 했다는 신호라 눈에 띄어야 한다.
      '.dp-sheet__notice{margin:0 16px 10px;padding:10px 12px;border-radius:10px;' +
      'background:#fdf3f3;border:1px solid #f4d9d9;color:#b4453f;' +
      'font-size:12.5px;font-weight:700;line-height:1.55;}' +

      // ── 상품 고르기 시트 ──────────────────────────
      // 비교 시트(9500)보다 위, 인터넷 옵션 다이얼로그(9998)보다 아래.
      '.dp-pick-ov{position:fixed;inset:0;z-index:9600;background:rgba(24,18,50,.45);' +
      'display:flex;align-items:flex-end;justify-content:center;}' +
      '.dp-pick-ov[hidden]{display:none;}' +
      '.dp-pick{width:100%;max-width:720px;background:#fff;border-radius:18px 18px 0 0;' +
      'max-height:86vh;display:flex;flex-direction:column;}' +
      '.dp-pick__head{display:flex;align-items:center;gap:8px;padding:14px 16px 8px;}' +
      '.dp-pick__title{font-size:15px;font-weight:800;color:#221f38;flex:1;}' +
      '.dp-pick__close{padding:6px 12px;border:1px solid #e6e2f2;background:#fff;color:#6a6880;' +
      'border-radius:999px;font-size:12.5px;cursor:pointer;font-family:inherit;}' +
      '.dp-pick__search{margin:0 16px 8px;}' +
      '.dp-pick__search input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e6e2f2;' +
      'border-radius:10px;font-size:14px;font-family:inherit;color:#221f38;background:#fbfaff;}' +
      '.dp-pick__search input:focus{outline:none;border-color:#b9a9f0;background:#fff;}' +
      '.dp-pick__note{margin:0 16px 8px;font-size:12px;color:#a7a5b8;line-height:1.5;}' +
      '.dp-pick__note b{color:#4b2ecb;font-weight:700;}' +
      '.dp-pick__body{padding:0 16px 18px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;}' +
      '.dp-pick__msg{padding:28px 0;text-align:center;font-size:13.5px;color:#8a879c;}' +
      '.dp-pick__retry{margin-top:10px;padding:7px 16px;border:1px solid #e6e2f2;background:#fff;' +
      'color:#4b2ecb;border-radius:999px;font-size:12.5px;cursor:pointer;font-family:inherit;}' +
      '.dp-pick-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f2f0f8;}' +
      '.dp-pick-row:last-child{border-bottom:none;}' +
      '.dp-pick-row__img{width:52px;height:44px;object-fit:contain;flex:0 0 auto;}' +
      '.dp-pick-row__img--empty{display:flex;align-items:center;justify-content:center;background:#f4f6fb;' +
      'color:#b7bccb;font-size:10px;border-radius:6px;}' +
      '.dp-pick-row__txt{flex:1;min-width:0;}' +
      '.dp-pick-row__name{font-size:13.5px;font-weight:700;color:#221f38;line-height:1.35;}' +
      '.dp-pick-row__label{font-size:11.5px;color:#8a879c;margin-top:2px;line-height:1.35;}' +
      '.dp-pick-row__fee{font-size:13.5px;font-weight:800;color:#4b2ecb;margin-top:3px;}' +
      '.dp-pick-row__btn{flex:0 0 auto;padding:8px 14px;border:0;border-radius:10px;background:#4b2ecb;' +
      'color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.dp-pick-row__btn:disabled{background:#eceaf5;color:#a8a5bb;cursor:default;}';
    var st = document.createElement('style');
    st.id = 'dp-cmp-view-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── 비교표 ────────────────────────────────────────
  // 옵션 값 → 화면 글자. 저장된 값이 사람 말이 아닌 것만 손본다.
  function val(key, v) {
    if (v === null || v === undefined || v === '') return '';
    if (key === 'wifi7d') return v === '1' || v === true ? '적용' : '';
    if (key === 'wifimode') return v === 'package' ? '패키지' : String(v);
    return String(v);
  }

  function fees(items) {
    var vals = items.map(function (it) {
      return (it.monthlyFee === 0 || it.monthlyFee) ? Number(it.monthlyFee) : null;
    });
    var min = null;
    vals.forEach(function (v) {
      if (v != null && !isNaN(v) && v > 0 && (min === null || v < min)) min = v;
    });
    return { vals: vals, min: min };
  }

  function table(cat, items) {
    items = items || [];
    var f = fees(items);
    var many = items.length > 1; // 1개만 담았으면 '최저'/'차액' 표시가 의미 없다

    // 옵션 행 = 담긴 항목들의 options 키 합집합.
    var seen = {};
    items.forEach(function (it) {
      for (var k in it.options) {
        if (Object.prototype.hasOwnProperty.call(it.options, k)) seen[k] = true;
      }
    });
    var keys = ORDER.filter(function (k) { return seen[k]; });
    Object.keys(seen).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });

    var head = '<tr><th class="dp-cmp-h"></th>' + items.map(function (it) {
      var img = it.image
        ? '<img class="dp-cmp-thumb" src="' + esc(it.image) + '" alt="" />'
        : '<div class="dp-cmp-thumb dp-cmp-thumb--empty">이미지<br>없음</div>';
      return '<th class="dp-cmp-col">' + img +
        '<div class="dp-cmp-name">' + esc(it.name || '상품') + '</div>' +
        (it.model ? '<div class="dp-cmp-model">' + esc(it.model) + '</div>' : '') +
        '<button type="button" class="dp-cmp-drop" data-cat="' + esc(cat) +
        '" data-drop="' + esc(it.key) + '">빼기</button></th>';
    }).join('') + '</tr>';

    // ★ 월 요금 = 첫 행 고정. 이 화면의 목적이 월 요금 비교라서 위치를 안 옮긴다.
    var feeRow = '<tr class="dp-cmp-fee"><th class="dp-cmp-h">월 요금</th>' +
      items.map(function (it, i) {
        var v = f.vals[i];
        if (v == null || isNaN(v) || v <= 0) {
          return '<td class="dp-cmp-v"><span class="dp-cmp-ask">상담 시 안내</span></td>';
        }
        var best = many && f.min != null && v === f.min;
        var tail = '';
        if (best) tail = '<span class="dp-cmp-best">최저</span>';
        else if (many && f.min != null) tail = '<span class="dp-cmp-gap">+' + (v - f.min).toLocaleString() + '원</span>';
        return '<td class="dp-cmp-v"><span class="dp-cmp-price' + (best ? ' is-best' : '') + '">' +
          v.toLocaleString() + '원</span>' + tail + '</td>';
      }).join('') + '</tr>';

    var optRows = keys.map(function (k) {
      var vals = items.map(function (it) { return val(k, it.options[k]); });
      var same = many && vals.every(function (v) { return v === vals[0]; });
      return '<tr class="' + (same ? 'is-same' : '') + '">' +
        '<th class="dp-cmp-h">' + esc(LABEL[k] || k) + '</th>' +
        vals.map(function (v) {
          return '<td class="dp-cmp-v">' + (v ? esc(v) : '<span class="dp-cmp-dash">-</span>') + '</td>';
        }).join('') + '</tr>';
    }).join('');

    // 링크는 여기서 만들지 않는다 — dpProductUrl 한 곳이 URL 규칙의 주인이다.
    var linkRow = '<tr><th class="dp-cmp-h"></th>' + items.map(function (it) {
      var url = typeof window.dpProductUrl === 'function'
        ? window.dpProductUrl({ categoryType: it.category, productId: it.id, options: it.options })
        : null;
      return '<td class="dp-cmp-v">' +
        (url ? '<a class="dp-cmp-link" href="' + esc(url) + '">자세히 보기</a>' : '') +
        '</td>';
    }).join('') + '</tr>';

    return '<div class="dp-cmp-scroll"><table class="dp-cmp-table">' +
      head + feeRow + optRows + linkRow +
      '</table></div>' +
      '<div class="dp-cmp-foot">' +
      '<div class="dp-cmp-note">비교함은 이 브라우저에만 저장됩니다. 카테고리별 최대 ' +
      maxCount() + '개.</div>' +
      '<button type="button" class="dp-cmp-clear" data-clear="' + esc(cat) + '">이 카테고리 비우기</button>' +
      '</div>';
  }

  // 표 안의 빼기/비우기 버튼 연결. onChange 는 다시 그리는 쪽이 넘긴다.
  function bind(rootEl, onChange) {
    if (!rootEl) return;
    var s = store(); if (!s) return;
    rootEl.querySelectorAll('[data-drop]').forEach(function (b) {
      b.onclick = function () {
        s.remove(b.dataset.cat, b.dataset.drop);
        if (onChange) onChange();
      };
    });
    var clr = rootEl.querySelector('[data-clear]');
    if (clr) {
      clr.onclick = function () {
        s.clear(clr.dataset.clear);
        if (onChange) onChange();
      };
    }
  }

  // ── 하단 3칸 트레이 ───────────────────────────────
  var _trayCat = null;
  var _trayEl = null;
  var _fold = false;
  // 트레이를 아예 치운 상태. '접기'(_fold)와 다르다 -
  // 접기는 칸만 접고 바는 남지만, 닫기는 화면에서 통째로 내린다.
  // 담아둔 항목이 지워지는 건 아니다. 새로고침하면 다시 뜬다.
  var _trayClosed = false;
  var _trayLastCount = 0;
  // 카테고리 → 그 카테고리 상품 목록을 가져오는 함수. 상세 페이지가 등록한다.
  // ★ 왜 여기서 직접 안 부르나: 가격 모양이 카테고리마다 다르다.
  //   정수기·렌탈은 pricing[약정][주기][조건] 3단 맵, 인터넷은 옵션 배열 + 계산기.
  //   그걸 이 공용 파일이 다 알면 카테고리 하나 늘 때마다 여기를 고쳐야 한다.
  var _pickers = {};

  function ensureTray() {
    if (_trayEl && _trayEl.parentNode) return _trayEl;
    var el = document.createElement('div');
    el.className = 'dp-tray';
    el.id = 'dpCompareTray';
    el.hidden = true;
    document.body.appendChild(el);
    _trayEl = el;
    return el;
  }

  function slotFilled(it) {
    var img = it.image
      ? '<img class="dp-slot__img" src="' + esc(it.image) + '" alt="" />'
      : '<div class="dp-slot__img dp-slot__img--empty">이미지<br>없음</div>';
    var fee = (it.monthlyFee === 0 || it.monthlyFee) && Number(it.monthlyFee) > 0
      ? '<div class="dp-slot__fee">' + Number(it.monthlyFee).toLocaleString() + '원</div>'
      : '<div class="dp-slot__fee">상담</div>';
    return '<div class="dp-slot is-filled">' +
      '<button type="button" class="dp-slot__x" data-cat="' + esc(_trayCat) +
      '" data-drop="' + esc(it.key) + '" aria-label="비교함에서 빼기">×</button>' +
      img +
      '<div class="dp-slot__name">' + esc(it.name || '상품') + '</div>' +
      (it.label ? '<div class="dp-slot__label">' + esc(it.label) + '</div>' : '') +
      fee +
      '</div>';
  }

  function slotEmpty() {
    var txt = (CAT_LABEL[_trayCat] || '상품') + ' 추가';
    var inner = '<span class="dp-slot__plus">+</span><span class="dp-slot__addtxt">' + esc(txt) + '</span>';
    // ★ 고르기 함수가 등록돼 있으면 페이지를 안 떠난다.
    //   목록으로 보내면 지금 담아둔 걸 두고 나가는 셈이라 비교가 끊긴다.
    if (_pickers[_trayCat]) {
      return '<button type="button" class="dp-slot dp-slot--add" data-pick="1">' + inner + '</button>';
    }
    // 등록 전(또는 아직 안 붙인 페이지)에는 예전처럼 목록 링크로 떨어진다.
    var url = typeof window.dpListUrl === 'function' ? window.dpListUrl(_trayCat) : null;
    if (url) return '<a class="dp-slot dp-slot--add" href="' + esc(url) + '">' + inner + '</a>';
    return '<div class="dp-slot dp-slot--add">' + inner + '</div>';
  }

  // ── 화면 아래 비교함 버튼 ───────────────────────────
  //
  // ★ 2026-08-03 — 3칸 트레이(약 235px)를 작은 버튼(56px)으로 바꿨다.
  //   트레이가 화면 아래를 가로로 다 덮어서, 상품 상세의 신청 바·카카오 상담과
  //   자리를 다투고 모바일에서는 화면의 3분의 1이 깔려 있었다.
  //   담긴 개수만 뱃지로 보여주고, 누르면 원래 있던 비교 시트가 올라온다.
  //   시트에서 빼기·비우기·상품 추가가 다 되므로 기능은 줄지 않았다.
  //
  //   slotFilled/slotEmpty 는 지금 안 쓴다. 지우지 않은 이유는 트레이로 되돌릴
  //   가능성과, 시트 쪽에서 같은 모양이 필요해질 때 재사용하기 위해서다.
  function renderTray() {
    if (!_trayCat) return;
    var s = store(); if (!s) return;
    var el = ensureTray();
    var items = s.list(_trayCat);

    // 새로 담으면 닫아둔 것을 다시 연다.
    // 방금 담은 것이 어디로 갔는지 안 보이면 담긴 건지 알 수 없다.
    if (items.length > _trayLastCount) _trayClosed = false;
    _trayLastCount = items.length;

    if (!items.length || _trayClosed) {
      el.hidden = true;
      el.innerHTML = '';
      document.body.style.paddingBottom = '';
      return;
    }

    el.className = 'dp-chip';
    el.hidden = false;
    // 아이콘은 '높이가 다른 막대 둘' 이다. 테두리선만 있는 도형은 56px 원 안에서
    // 그냥 네모 두 개로 읽힌다(2026-08-03 확인). 채운 도형이 훨씬 잘 읽힌다.
    // 이름표를 붙인 이유 - 카카오 버튼 둘에는 이름표가 있는데 이것만 없어서
    // 무슨 버튼인지 알 수 없었다. 같은 열에 서는 것끼리는 모양을 맞춘다.
    el.innerHTML =
      '<button type="button" class="dp-chip__x" data-close ' +
      'title="비교함 버튼을 숨깁니다. 담아둔 상품은 그대로 있습니다." ' +
      'aria-label="비교함 숨기기">\u2715</button>' +
      '<button type="button" class="dp-chip__btn" title="' +
      esc(CAT_LABEL[_trayCat] || '') + ' 비교함 열기" aria-label="비교함 열기">' +
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">' +
      '<rect x="3.5" y="11" width="7" height="9" rx="1.5"/>' +
      '<rect x="13.5" y="5" width="7" height="15" rx="1.5"/>' +
      '</svg>' +
      '<span class="dp-chip__count">' + items.length + '</span>' +
      '</button>' +
      '<span class="dp-chip__label">비교함</span>';

    el.querySelector('.dp-chip__btn').onclick = function () { openSheet(_trayCat); };
    el.querySelector('[data-close]').onclick = function () { _trayClosed = true; renderTray(); };

    // 더 이상 본문을 밀어낼 필요가 없다. 트레이 시절에 잡아 둔 여백을 푼다.
    document.body.style.paddingBottom = '';
    placeChip();
  }

  // 카카오 상담 버튼 위에 얹는다.
  //
  // 공용 파일이 카카오를 아는 게 마뜩잖지만, 여기서 안 하면 화면마다
  // 각자 계산하게 되고 결국 어딘가는 겹친 채로 남는다. 한 곳에서 처리한다.
  // 카카오가 없는 화면(마이페이지 등)에서는 기본 위치를 쓴다.
  function placeChip() {
    var el = _trayEl;
    if (!el || el.hidden) return;

    var base = window.innerWidth <= 900 ? 80 : 28;
    var kakao = document.querySelector('.kakao-float');

    if (!kakao) { el.style.bottom = base + 'px'; return; }

    var r = kakao.getBoundingClientRect();
    if (!r.height) { el.style.bottom = base + 'px'; return; }

    // 세로 - 카카오 바로 위에 얹는다.
    el.style.bottom = Math.max(base, window.innerHeight - r.top + 12) + 'px';

    // 가로 - 카카오 '버튼의 중심' 에 이 버튼의 중심을 맞춘다.
    //
    // 둘 다 오른쪽에서 28px 로 두면 안 맞는다. 이름표 길이가 달라서
    // ('카카오 플러스' vs '비교함') 컨테이너 폭이 다르고, 컨테이너는 폭의 절반만큼
    // 안쪽으로 버튼을 놓기 때문에 그 차이만큼 버튼이 어긋난다.
    // 그래서 오른쪽 여백을 고정하지 않고, 카카오 중심을 재서 거기에 맞춘다.
    var centerX = r.left + r.width / 2;
    var w = el.offsetWidth;
    if (w) el.style.right = Math.round(window.innerWidth - centerX - w / 2) + 'px';
  }

  function mountTray(cat) {
    if (!cat || !CAT_LABEL[cat]) return;
    injectStyles();
    _trayCat = cat;
    renderTray();
  }

  // ── 상품 고르기 시트 ('+' 카드) ────────────────────
  // 목록 페이지로 보내지 않고 그 자리에서 고른다.
  var _pickEl = null;
  var _pickCat = null;
  var _pickRows = null;   // 한 번 받아오면 시트를 닫았다 열어도 다시 안 부른다
  var _pickQ = '';
  var _pickMsg = '';      // 한 줄 안내(개수 다 찼을 때 등)

  function registerPicker(cat, fn) {
    if (!cat || typeof fn !== 'function') return;
    _pickers[cat] = fn;
    // 이미 트레이가 떠 있으면 '+' 카드를 링크에서 버튼으로 바꿔 다시 그린다.
    if (_trayCat === cat) renderTray();
  }

  function closePicker() {
    if (_pickEl) _pickEl.hidden = true;
    _pickMsg = '';
  }

  function pickRowHtml(r, i, taken) {
    var img = r.image
      ? '<img class="dp-pick-row__img" src="' + esc(r.image) + '" alt="" />'
      : '<div class="dp-pick-row__img dp-pick-row__img--empty">이미지<br>없음</div>';
    var fee = (r.monthlyFee === 0 || r.monthlyFee) && Number(r.monthlyFee) > 0
      ? Number(r.monthlyFee).toLocaleString() + '원'
      : '상담 시 안내';
    return '<div class="dp-pick-row">' + img +
      '<div class="dp-pick-row__txt">' +
      '<div class="dp-pick-row__name">' + esc(r.name || '상품') + '</div>' +
      (r.label ? '<div class="dp-pick-row__label">' + esc(r.label) + '</div>' : '') +
      '<div class="dp-pick-row__fee">' + fee + '</div>' +
      '</div>' +
      '<button type="button" class="dp-pick-row__btn" data-add="' + i + '"' +
      (taken ? ' disabled' : '') + '>' + (taken ? '담김' : '담기') + '</button>' +
      '</div>';
  }

  // 목록 부분만 만든다. 검색어가 바뀔 때 이 조각만 갈아끼운다.
  function pickerBodyHtml() {
    var s = store();
    if (_pickRows === null) return '<div class="dp-pick__msg">불러오는 중…</div>';
    if (_pickRows === false) {
      return '<div class="dp-pick__msg">목록을 불러오지 못했습니다.' +
        '<br><button type="button" class="dp-pick__retry" data-retry="1">다시 시도</button></div>';
    }
    // 검색 — 이름과 조합(label) 둘 다에 걸린다. 인터넷은 조합이 곧 요금제라서.
    var q = _pickQ.trim().toLowerCase();
    var rows = _pickRows;
    var idx = [];
    rows.forEach(function (r, i) {
      if (!q) { idx.push(i); return; }
      var hay = ((r.name || '') + ' ' + (r.label || '') + ' ' + (r.model || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) idx.push(i);
    });
    if (!idx.length) return '<div class="dp-pick__msg">해당하는 상품이 없습니다.</div>';
    return idx.map(function (i) {
      var r = rows[i];
      var key = s ? s.keyOf(r.id, r.options) : '';
      var taken = !!(s && s.has(_pickCat, key));
      return pickRowHtml(r, i, taken);
    }).join('');
  }

  function pickerNoteHtml() {
    var s = store();
    var cnt = s ? s.count(_pickCat) : 0;
    if (_pickMsg) return '<b>' + esc(_pickMsg) + '</b>';
    return '비교함 ' + cnt + '/' + maxCount() +
      ' · 지금 화면과 같은 조합으로 담습니다(그 상품에 없으면 가장 싼 조합).';
  }

  // ★ 검색 중에는 이 함수만 부른다 — 입력 칸을 건드리지 않는다.
  //
  //   한글은 여러 자모가 모여 한 글자가 되는데, 조합이 끝나기 전까지 그 글자는
  //   입력 칸 안에서 '만들어지는 중' 이다. 칸을 통째로 다시 만들면 그 조합이 끊겨
  //   "박자" 를 치면 "ㅂㅏㄱㅈㅏ" 가 된다. 영어는 한 글자가 한 번에 끝나서 티가 안 난다.
  //   그래서 목록과 안내문만 갈아끼우고 입력 칸은 화면에 그대로 둔다.
  function renderPickerBody() {
    if (!_pickEl) return;
    var b = _pickEl.querySelector('.dp-pick__body');
    var n = _pickEl.querySelector('.dp-pick__note');
    if (b) b.innerHTML = pickerBodyHtml();
    if (n) n.innerHTML = pickerNoteHtml();
    bindPickerBody();
  }

  function renderPicker() {
    if (!_pickEl || !_pickCat) return;

    _pickEl.innerHTML =
      '<div class="dp-pick">' +
      '<div class="dp-pick__head">' +
      '<span class="dp-pick__title">' + esc(CAT_LABEL[_pickCat] || '') + ' 추가</span>' +
      '<button type="button" class="dp-pick__close">닫기</button>' +
      '</div>' +
      '<div class="dp-pick__search"><input type="text" placeholder="상품 이름으로 찾기" ' +
      'value="' + esc(_pickQ) + '" /></div>' +
      '<div class="dp-pick__note">' + pickerNoteHtml() + '</div>' +
      '<div class="dp-pick__body">' + pickerBodyHtml() + '</div>' +
      '</div>';

    _pickEl.querySelector('.dp-pick__close').onclick = closePicker;

    var inp = _pickEl.querySelector('.dp-pick__search input');
    inp.oninput = function () {
      _pickQ = inp.value;
      _pickMsg = '';
      renderPickerBody();   // 입력 칸은 그대로 둔다 - 포커스도 조합도 안 끊긴다
    };

    bindPickerBody();
  }

  // 목록 안의 버튼들만 다시 묶는다. 목록을 갈아끼울 때마다 부른다.
  // 담기를 눌러도 renderPicker(전체 다시 그리기)를 부르지 않는다 -
  // 검색어를 치던 중이었다면 그 순간 조합이 끊긴다.
  function bindPickerBody() {
    if (!_pickEl) return;
    var s = store();

    var rt = _pickEl.querySelector('[data-retry]');
    if (rt) rt.onclick = function () { _pickRows = null; renderPickerBody(); loadPicker(); };

    _pickEl.querySelectorAll('[data-add]').forEach(function (b) {
      b.onclick = function () {
        var r = _pickRows[Number(b.dataset.add)];
        if (!r || !s) return;
        var res = s.add(r);
        if (!res.ok) {
          _pickMsg = res.reason === 'full'
            ? '비교는 ' + maxCount() + '개까지입니다. 하나를 빼고 담아주세요.'
            : '이미 담긴 조합입니다.';
        } else {
          _pickMsg = '';
        }
        renderPickerBody();
        // 3칸이 다 차면 더 고를 게 없다 — 바로 닫아준다.
        if (res.ok && s.count(_pickCat) >= maxCount()) closePicker();
      };
    });
  }

  // 목록이 도착하면 목록 부분만 갈아끼운다.
  // 전체를 다시 그리면, 불러오는 동안 검색어를 치고 있던 사람의 입력이 끊긴다.
  function loadPicker() {
    var cat = _pickCat;
    var fn = _pickers[cat];
    if (!fn) { _pickRows = false; renderPickerBody(); return; }
    var out;
    try { out = fn(); } catch (e) { out = null; }
    Promise.resolve(out).then(function (rows) {
      if (_pickCat !== cat) return; // 그새 다른 카테고리로 갈아탔으면 버린다
      // 다른 카테고리가 섞일 길을 여기서 끊는다 — 목록이 뭘 주든 이 서랍 것만 남긴다.
      _pickRows = (Array.isArray(rows) ? rows : []).filter(function (r) {
        return r && r.category === cat && r.id !== null && r.id !== undefined;
      });
      renderPickerBody();
    }).catch(function () {
      if (_pickCat !== cat) return;
      _pickRows = false;
      renderPickerBody();
    });
  }

  function openPicker(cat) {
    if (!cat || !CAT_LABEL[cat]) return;
    injectStyles();
    if (!_pickEl || !_pickEl.parentNode) {
      _pickEl = document.createElement('div');
      _pickEl.className = 'dp-pick-ov';
      _pickEl.id = 'dpComparePicker';
      document.body.appendChild(_pickEl);
      _pickEl.addEventListener('click', function (e) {
        if (e.target === _pickEl) closePicker();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && _pickEl && !_pickEl.hidden) closePicker();
      });
    }
    var fresh = _pickCat !== cat;
    _pickCat = cat;
    _pickQ = '';
    _pickMsg = '';
    _pickEl.hidden = false;
    if (fresh || _pickRows === false) _pickRows = null;
    renderPicker();
    if (_pickRows === null) loadPicker();
  }

  // ── 비교 시트 ─────────────────────────────────────
  var _sheetEl = null;
  // 시트 맨 위 한 줄 안내. 지금은 '3개가 다 찼다' 한 가지에만 쓴다.
  // 상태로 들고 있는 이유 - 표에서 하나를 빼면 renderSheet 가 다시 돌면서
  // 스스로 지워야 하기 때문이다. 안내가 남아 있으면 이미 자리가 났는데도
  // 여전히 막힌 것처럼 읽힌다.
  var _sheetNotice = '';

  function closeSheet() {
    if (_sheetEl) _sheetEl.hidden = true;
    // 닫을 때 비운다. 안 비우면 나중에 칩으로 그냥 열었을 때 지난 경고가 되살아난다.
    _sheetNotice = '';
  }

  function renderSheet(cat) {
    var s = store(); if (!s || !_sheetEl) return;
    var items = s.list(cat);
    if (!items.length) { closeSheet(); return; }

    // 자리가 나면 안내는 제 할 일을 다 한 것이다. 표에서 하나를 빼면 여기로 다시 온다.
    if (_sheetNotice && items.length < maxCount()) _sheetNotice = '';
    var notice = _sheetNotice
      ? '<div class="dp-sheet__notice">' + esc(_sheetNotice) + '</div>'
      : '';
    // 담긴 게 하나뿐이면 표가 한 열이라 비교가 되지 않는다. 그렇다고 시트를 안 열면
    // '담았는데 아무 반응이 없다' 가 되므로, 열어주되 왜 비교가 안 되는지 적는다.
    var hint = items.length < 2
      ? '<div class="dp-sheet__hint">2개부터 나란히 비교할 수 있습니다. 위의 상품 추가로 더 담아보세요.</div>'
      : '';
    var addBtn = _pickers[cat]
      ? '<button type="button" class="dp-sheet__add">+ 상품 추가</button>'
      : '';

    _sheetEl.innerHTML =
      '<div class="dp-sheet">' +
      '<div class="dp-sheet__head">' +
      '<span class="dp-sheet__title">' + esc(CAT_LABEL[cat] || '') + ' 비교</span>' +
      addBtn +
      '<button type="button" class="dp-sheet__close">닫기</button>' +
      '</div>' +
      notice +
      '<div class="dp-sheet__body">' + table(cat, items) + hint + '</div>' +
      '</div>';
    _sheetEl.querySelector('.dp-sheet__close').onclick = closeSheet;
    var add = _sheetEl.querySelector('.dp-sheet__add');
    if (add) add.onclick = function () { openPicker(cat); };
    bind(_sheetEl, function () { renderSheet(cat); renderTray(); });
  }

  // notice - 시트 맨 위에 띄울 한 줄(선택). 담기가 막혀서 열린 경우에만 넘어온다.
  //
  // ★ 왜 notice 가 있을 때만 비교함 버튼을 되살리나 (2026-08-03)
  //   버튼을 X 로 닫아둔 사람이 담기를 시도해 막히면, 시트만 띄웠다가는
  //   시트를 닫는 순간 비교함으로 돌아갈 길이 사라진다. 그래서 그때는 닫아둔 것을 푼다.
  //   반대로 칩을 눌러 연 평범한 경우까지 손대면, 마이페이지처럼 트레이를 일부러
  //   안 띄우는 화면에 버튼이 생겨버린다. 그래서 조건을 notice 로 좁혔다.
  function openSheet(cat, notice) {
    injectStyles();
    _sheetNotice = notice || '';

    if (_sheetNotice) {
      // 상세 페이지라면 mountTray 로 이미 잡혀 있다. 혹시 비어 있으면 여기서 채운다.
      if (!_trayCat && CAT_LABEL[cat]) _trayCat = cat;
      if (_trayCat === cat) {
        _trayClosed = false;
        renderTray();
      }
    }

    if (!_sheetEl || !_sheetEl.parentNode) {
      _sheetEl = document.createElement('div');
      _sheetEl.className = 'dp-sheet-ov';
      _sheetEl.id = 'dpCompareSheet';
      document.body.appendChild(_sheetEl);
      // 바깥(어두운 곳)을 누르면 닫는다. 시트 안쪽 클릭은 안 닫는다.
      _sheetEl.addEventListener('click', function (e) {
        if (e.target === _sheetEl) closeSheet();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSheet();
      });
    }
    _sheetEl.hidden = false;
    renderSheet(cat);
  }

  // 담기/빼기가 어디서 일어나든 트레이는 따라간다(compare-button.js 가 쏜다).
  window.addEventListener('dp-compare-change', function () {
    if (_trayCat) renderTray();
  });

  // 화면 크기가 바뀌면 카카오 위치도 바뀐다. 다시 잰다.
  window.addEventListener('resize', placeChip);

  window.dpCompareView = {
    CAT_LABEL: CAT_LABEL,
    placeChip: placeChip,
    injectStyles: injectStyles,
    table: table,
    bind: bind,
    mountTray: mountTray,
    openSheet: openSheet,
    closeSheet: closeSheet,
    registerPicker: registerPicker,
    openPicker: openPicker,
    closePicker: closePicker,
  };
})();
