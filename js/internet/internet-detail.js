// ════════════════════════════════════════════════════
// internet-detail.js — 인터넷·TV 소비자 상세페이지
// ────────────────────────────────────────────────────
// 계산은 InternetCalc 재사용(자체 계산식 금지), 신청은 DapickApplication 재사용.
// base.js/통합페이지와 독립. URL로 선택 상태를 복원해 렌더.
//
// URL 파라미터: ?carrier=SKT&net=100M&tv=...&router=...&phone=...&with=tv,phone
//   - carrier: 통신사 키 (CARRIER_MAP)
//   - net/tv/router/phone: 각 옵션의 name (없으면 미선택)
//   - with: 켜진 부가옵션 콤마 목록 (방어용 힌트; 실제 on/off는 옵션 복원 성공 여부로 결정)
//
// STEP 1: 진입→로드→복원→정적 렌더. (변경/추가/제거=STEP 2, 신청=STEP 3)
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── CARRIER_MAP 최소 복제 (1차: 렌더용 표시명/색/로고만) ──
  // ★ 백로그: base.js의 CARRIER_MAP과 권위 소스가 갈라짐 → 추후 공유 모듈로 추출 예정.
  var CARRIER_MAP = {
    SKT: { name: 'SKT', color: '#3617CE', logo: 'assets/logos/SKTLOGO.png' },
    KT: { name: 'KT', color: '#E31837', logo: 'assets/logos/KT.png' },
    'LG U+': { name: 'LG U+', color: '#E5007D', logo: 'assets/logos/LG.png' },
    'LG HelloVision': {
      name: 'LG HelloVision',
      color: '#7B2D8B',
      logo: 'assets/logos/LGhello.png',
    },
    'SK broadband': {
      name: 'SK broadband',
      color: '#0078C8',
      logo: 'assets/logos/SKTLOGO1.png',
    },
    'KT Skylife': {
      name: 'KT Skylife',
      color: '#003087',
      logo: 'assets/logos/KTSkyLife.png',
    },
  };

  // 구성요소 정의 (인터넷=필수/변경만, 나머지=부가/추가·제거 가능)
  var COMPONENTS = [
    { kind: 'internet', label: '인터넷', removable: false },
    { kind: 'tv', label: 'TV', removable: true },
    { kind: 'setTop', label: '셋탑', removable: false },
    { kind: 'tv2', label: 'TV2', removable: true },
    { kind: 'setTop2', label: '셋탑2', removable: false },
    { kind: 'router', label: '공유기', removable: true },
  ];

  // ── 상태 ──
  var _carrierKey = null;
  var _product = null;
  var _opts = { internets: [], tvs: [], setTops: [], tv2s: [], setTop2s: [], routers: [], phones: [], meta: {} };
  var _selectedInternet = null;
  var _selectedTv = null;
  var _selectedSetTop = null;
  var _selectedTv2 = null;
  var _selectedSetTop2 = null;
  var _selectedRouter = null;
  var _wifiMode = 'normal'; // 'normal' | 'package' (메인에서 URL로 전달)
  var _toggles = { tv: false, router: false, wifi7d: false };
  var _fav = null; // 찜 버튼 핸들 (조합이 바뀌면 refresh)
  var _cmp = null; // 비교함 핸들 (찜과 같은 조합 단위 → 같이 refresh)

  // ── 유틸 ──
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function formatPrice(n) {
    return Number(n || 0).toLocaleString('ko-KR');
  }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  // 설명 "윗줄|아랫줄" 분리 (통합페이지 규약과 동일)
  function splitDesc(desc) {
    var s = String(desc || '');
    var i = s.indexOf('|');
    if (i < 0) return { head: s, sub: '' };
    return { head: s.slice(0, i), sub: s.slice(i + 1) };
  }

  // 옵션별 월 결합가 (InternetCalc 재사용)
  // 와이파이 패키지 모드면 인터넷 옵션에만 가산 (calc.js와 동일 규칙). TV/셋탑/공유기엔 미적용.
  function priceOf(opt) {
    var p = InternetCalc.bundleOf(opt);
    if (
      _wifiMode === 'package' &&
      _opts.internets &&
      _opts.internets.indexOf(opt) >= 0
    ) {
      p += Number(opt.wifiPackageAdd != null ? opt.wifiPackageAdd : 0);
      if (_toggles.wifi7d)
        p += Number(opt.wifi7dAdd != null ? opt.wifi7dAdd : 0);
    }
    return p;
  }

  // 현재 선택 → InternetCalc 입력 객체
  function selection() {
    return {
      internet: _selectedInternet,
      tv: _selectedTv,
      setTop: _selectedSetTop,
      tv2: _selectedTv2,
      setTop2: _selectedSetTop2,
      router: _selectedRouter,
      wifiMode: _wifiMode,
      toggles: _toggles,
      meta: _opts.meta,
    };
  }

  // 현재 조합의 이름. 신청(productName)과 찜(optionLabel)이 같은 문자열을 쓴다.
  function comboLabel() {
    var m = CARRIER_MAP[_carrierKey] || { name: _carrierKey };
    var parts = [m.name, (_selectedInternet && _selectedInternet.name) || ''];
    if (_toggles.tv && _selectedTv) parts.push('+ ' + _selectedTv.name);
    if (_toggles.tv && _selectedTv && _selectedSetTop)
      parts.push('+ ' + _selectedSetTop.name);
    if (_toggles.tv && _selectedTv && _selectedTv2)
      parts.push('+ ' + _selectedTv2.name);
    if (_selectedTv2 && _selectedSetTop2) parts.push('+ ' + _selectedSetTop2.name);
    if (_toggles.router && _selectedRouter) parts.push('+ ' + _selectedRouter.name);
    return parts.join(' ');
  }

  // 현재 조합 → 복원용 쿼리 파라미터.
  // ★ 키 이름은 restoreSelection() 이 읽는 이름과 반드시 같아야 한다.
  //   여기서 하나라도 어긋나면 찜 목록에서 돌아왔을 때 조용히 다른 조합이 뜬다.
  function favOptions() {
    var o = { carrier: _carrierKey };
    if (_selectedInternet) o.net = _selectedInternet.name;
    if (_toggles.tv && _selectedTv) o.tv = _selectedTv.name;
    if (_toggles.tv && _selectedTv && _selectedSetTop) o.settop = _selectedSetTop.name;
    if (_toggles.tv && _selectedTv && _selectedTv2) o.tv2 = _selectedTv2.name;
    if (_selectedTv2 && _selectedSetTop2) o.settop2 = _selectedSetTop2.name;
    if (_toggles.router && _selectedRouter) o.router = _selectedRouter.name;
    if (_wifiMode === 'package') o.wifimode = 'package';
    if (_toggles.wifi7d) o.wifi7d = '1';
    return o;
  }

  function selectedOf(kind) {
    return kind === 'internet'
      ? _selectedInternet
      : kind === 'tv'
        ? _selectedTv
        : kind === 'setTop'
          ? _selectedSetTop
          : kind === 'tv2'
            ? _selectedTv2
            : kind === 'setTop2'
              ? _selectedSetTop2
              : _selectedRouter;
  }
  // 셋탑은 TV 종속 — TV 있으면 첫 셋탑 자동선택/유지, 없으면 클리어
  function syncSetTopWithTv() {
    if (_toggles.tv && _selectedTv) {
      if (!_selectedSetTop && _opts.setTops && _opts.setTops.length)
        _selectedSetTop = _opts.setTops[0];
    } else {
      _selectedSetTop = null;
    }
  }
  // 셋탑2는 TV2 종속(자동선택 O) — 단 TV1 꺼지면 TV2·셋탑2 모두 풀림
  function syncSetTop2WithTv2() {
    if (_toggles.tv && _selectedTv && _selectedTv2) {
      if (!_selectedSetTop2 && _opts.setTop2s && _opts.setTop2s.length)
        _selectedSetTop2 = _opts.setTop2s[0];
    } else {
      _selectedSetTop2 = null;
    }
  }

  // ════════════════════════════════════════════════════
  // 진입
  // ════════════════════════════════════════════════════
  function init() {
    var params = new URLSearchParams(window.location.search);
    _carrierKey = params.get('carrier');

    if (!_carrierKey) {
      showError('통신사 정보가 없습니다. 통신사 선택 페이지로 돌아가 주세요.');
      return;
    }
    injectDialog();
    bindEvents();
    renderBrand();

    api
      .get('/api/internet-tv-products')
      .then(function (list) {
        _product = InternetCalc.findByCarrier(list, _carrierKey);
        if (!_product) {
          showError(_carrierKey + ' 상품이 준비 중입니다.');
          return;
        }
        _opts = InternetCalc.extractOptions(_product);
        if (!_opts.internets.length) {
          showError('인터넷 상품 데이터가 없습니다.');
          return;
        }
        restoreSelection(params);
        render();
        initFav();
        initCompare();
        registerPicker();

        // 비로그인 신청 후 로그인 복귀 시 모달 자동 재개 (각 페이지가 직접 호출하는 패턴)
        if (
          typeof DapickApplication !== 'undefined' &&
          DapickApplication.resumeIfPending
        )
          DapickApplication.resumeIfPending();
      })
      .catch(function (e) {
        console.error('[internet-detail] 상품 로드 실패', e);
        showError('상품 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.');
      });
  }

  // 찜 버튼 1회 생성. 이후 조합이 바뀔 때마다 renderLeft() 가 refresh 한다.
  function initFav() {
    if (typeof window.dpFavInit !== 'function' || !_product) return;
    _fav = dpFavInit(document.getElementById('idFav'), _product.id, {
      variant: 'block',
      state: function () {
        return {
          options: favOptions(),
          label: comboLabel(),
          monthlyFee: InternetCalc.calculate(selection()).finalPrice,
        };
      },
    });
  }

  // 비교함 버튼 1회 생성. 찜과 똑같이 조합이 바뀔 때마다 refresh 한다.
  // ★ 인터넷·TV 는 상품 1개 = 통신사 1개라서, 조합(options)이 빠지면
  //   같은 통신사의 기가1G / 기가500M 이 한 항목으로 뭉개진다.
  function initCompare() {
    if (typeof window.dpCompareInit !== 'function' || !_product) return;
    _cmp = dpCompareInit(document.getElementById('idCompare'), _product.id, {
      variant: 'block',
      snapshot: function () {
        var m = CARRIER_MAP[_carrierKey] || {};
        return {
          category: 'INTERNET_TV',
          name: m.name || _carrierKey || '',
          model: '',
          image: logoOf(_carrierKey),
          label: comboLabel(),
          monthlyFee: InternetCalc.calculate(selection()).finalPrice,
          options: favOptions(),
        };
      },
    });
  }

  // 로고는 마이페이지(루트 기준)에서도 같은 자산을 쓰므로 절대경로로 넘긴다.
  function logoOf(key) {
    var m = CARRIER_MAP[key] || {};
    var logo = m.logo || '';
    if (logo && logo.charAt(0) !== '/' && logo.indexOf('http') !== 0) logo = '/' + logo;
    return logo;
  }

  // ── 하단 트레이 '+' 카드 → 그 자리에서 다른 인터넷 조합 고르기 ────────
  // ★ 여기서 목록을 페이지 이동 없이 받아온다. internet.html 로 보내면
  //   담아둔 걸 두고 화면을 떠나는 셈이라 비교 흐름이 끊긴다.
  // ★ 한 줄 = 통신사 × 인터넷 옵션 하나(TV·공유기 없는 인터넷 단독가).
  //   TV 조합까지 여기서 고르게 하면 목록이 수백 줄이 된다. 인터넷 단독으로
  //   담고, 세부 조합은 '자세히 보기'로 그 상세에서 다시 담는 흐름이다.
  function registerPicker() {
    if (!window.dpCompareView || typeof window.dpCompareView.registerPicker !== 'function') {
      return;
    }
    window.dpCompareView.registerPicker('INTERNET_TV', function () {
      return api.get('/api/internet-tv-products').then(function (list) {
        var rows = [];
        (Array.isArray(list) ? list : []).forEach(function (p) {
          if (!p || !p.id || !p.carrier) return;
          var m = CARRIER_MAP[p.carrier];
          if (!m) return; // 모르는 통신사는 로고·표시명이 없다 → 안 넣는다
          var opts = InternetCalc.extractOptions(p);
          (opts.internets || []).forEach(function (it) {
            if (!it || !it.name) return;
            rows.push({
              category: 'INTERNET_TV',
              id: p.id,
              name: m.name,
              model: '',
              image: logoOf(p.carrier),
              label: m.name + ' ' + it.name,
              monthlyFee: InternetCalc.calculate({
                internet: it,
                toggles: {},
                meta: opts.meta,
              }).finalPrice,
              options: { carrier: p.carrier, net: it.name },
            });
          });
        });
        return rows;
      });
    });
  }

  // URL → 선택 상태 복원 (방어: 못 찾으면 인터넷 첫 옵션 기본, 부가옵션 off)
  function restoreSelection(params) {
    _selectedInternet =
      InternetCalc.findOptionByName(_opts.internets, params.get('net')) ||
      _opts.internets[0];

    _selectedTv = InternetCalc.findOptionByName(_opts.tvs, params.get('tv'));
    _selectedRouter = InternetCalc.findOptionByName(
      _opts.routers,
      params.get('router'),
    );

    // 토글 on/off = 해당 옵션이 실제로 복원됐는지로 결정 (URL with는 힌트일 뿐, 방어적으로 무시 가능)
    _toggles.tv = !!_selectedTv;
    _toggles.router = !!_selectedRouter;

    // 와이파이 패키지 모드/7D 복원 (메인 goDetail이 실어 보낸 값)
    _wifiMode = params.get('wifimode') === 'package' ? 'package' : 'normal';
    _toggles.wifi7d = params.get('wifi7d') === '1';
    // 패키지 모드면 공유기 배타 (메인과 동일 규칙) — 복원 시에도 공유기 해제
    if (_wifiMode === 'package') {
      _toggles.router = false;
      _selectedRouter = null;
    }

    // 셋탑(TV 종속) 복원: URL settop 우선, 없으면 TV 있을 때 첫 셋탑 자동선택
    _selectedSetTop = InternetCalc.findOptionByName(
      _opts.setTops,
      params.get('settop'),
    );

    // TV2/셋탑2 복원 — TV2는 토글 아님(_selectedTv2 존재 자체가 선택 상태)
    _selectedTv2 = InternetCalc.findOptionByName(_opts.tv2s, params.get('tv2'));
    _selectedSetTop2 = InternetCalc.findOptionByName(
      _opts.setTop2s,
      params.get('settop2'),
    );
    syncSetTopWithTv();
    syncSetTop2WithTv2();
  }

  // ════════════════════════════════════════════════════
  // 렌더
  // ════════════════════════════════════════════════════
  function renderBrand() {
    var m = CARRIER_MAP[_carrierKey] || {
      name: _carrierKey,
      color: '#3617CE',
      logo: '',
    };
    document.documentElement.style.setProperty('--ip-brand-color', m.color);
    setText('idCarrierName', m.name + ' 인터넷·TV');
    var logo = document.getElementById('idHeaderLogo');
    if (logo && m.logo) {
      logo.src = m.logo;
      logo.alt = m.name;
    }
    document.title = '다픽 ' + m.name + ' 인터넷·TV 구성';
  }

  function render() {
    renderRight();
    renderLeft();
  }

  // 우: 구성요소 카드 리스트
  function renderRight() {
    var host = document.getElementById('idRightList');
    if (!host) return;
    host.innerHTML = COMPONENTS.map(function (c) {
      var on;
      if (c.kind === 'internet') on = true;
      else if (c.kind === 'setTop')
        // 셋탑은 TV 종속 — TV 선택 + 셋탑 데이터 있을 때만 노출
        on =
          _toggles.tv &&
          !!_selectedTv &&
          !!(_opts.setTops && _opts.setTops.length);
      else if (c.kind === 'tv2')
        // TV2는 TV1 종속 — TV1 켜지고 TV2 데이터 있을 때 노출(선택은 사용자)
        on = _toggles.tv && !!_selectedTv && !!(_opts.tv2s && _opts.tv2s.length);
      else if (c.kind === 'setTop2')
        // 셋탑2는 TV2 종속 — TV2 선택 시만 노출
        on = !!_selectedTv2 && !!(_opts.setTop2s && _opts.setTop2s.length);
      else on = _toggles[c.kind];
      var opt = selectedOf(c.kind);
      if (on && opt) return filledCard(c, opt);
      // TV1 종속(셋탑·TV2·셋탑2)은 조건 미충족 시 카드 자체 숨김
      if (!on && (c.kind === 'setTop' || c.kind === 'tv2' || c.kind === 'setTop2'))
        return '';
      return emptyCard(c);
    }).join('');
  }

  function filledCard(c, opt) {
    var d = splitDesc(opt.desc);
    var thumb = opt.imageUrl
      ? '<img src="' + escapeHtml(opt.imageUrl) + '" alt="' + escapeHtml(opt.name) + '"/>'
      : '<span class="id-thumb-ph">이미지</span>';
    var descHtml = d.head
      ? '<div class="id-item-desc">' +
        escapeHtml(d.head) +
        (d.sub ? ' · ' + escapeHtml(d.sub) : '') +
        '</div>'
      : '';
    // 와이파이 패키지 모드 표기 — 인터넷 카드에만 (상세엔 탭이 없어 모드 인지용)
    var wifiNote =
      c.kind === 'internet' && _wifiMode === 'package'
        ? '<div class="id-item-desc">와이파이 패키지' +
          (_toggles.wifi7d ? ' · 7D 광대역' : '') +
          '</div>'
        : '';
    var actions =
      '<button class="id-item-btn" data-action="change" data-kind="' +
      c.kind +
      '">변경</button>' +
      (c.removable
        ? '<button class="id-item-btn id-item-btn--remove" data-action="remove" data-kind="' +
          c.kind +
          '">제거</button>'
        : '');
    return (
      '<div class="id-item" data-kind="' +
      c.kind +
      '">' +
      '<div class="id-item-thumb">' +
      thumb +
      '</div>' +
      '<div class="id-item-body">' +
      '<div class="id-item-kind">' +
      escapeHtml(c.label) +
      '</div>' +
      '<div class="id-item-name">' +
      escapeHtml(opt.name) +
      '</div>' +
      descHtml +
      wifiNote +
      '<div class="id-item-price">월 ' +
      formatPrice(priceOf(opt)) +
      '원</div>' +
      '</div>' +
      '<div class="id-item-actions">' +
      actions +
      '</div>' +
      '</div>'
    );
  }

  function emptyCard(c) {
    return (
      '<div class="id-item is-empty" data-kind="' +
      c.kind +
      '">' +
      '<div class="id-item-thumb"><span class="id-thumb-ph">+</span></div>' +
      '<div class="id-item-body">' +
      '<div class="id-item-kind">' +
      escapeHtml(c.label) +
      '</div>' +
      '<div class="id-item-desc">선택 안 함</div>' +
      '</div>' +
      '<div class="id-item-actions">' +
      '<button class="id-item-btn id-item-btn--add" data-action="add" data-kind="' +
      c.kind +
      '">추가하기</button>' +
      '</div>' +
      '</div>'
    );
  }

  // 좌: 요금/할인 패널 (InternetCalc.calculate 한 곳만)
  function renderLeft() {
    var calc = InternetCalc.calculate(selection());
    // 결합 전 요금은 값과 무관하게 항상 "별도 문의" (금액 비노출). 내부 calc는 그대로 사용.
    setText('idPbBase', '별도 문의');
    setText('idPbBundle', formatPrice(calc.bundlePrice) + '원');
    setText('idPbFinal', formatPrice(calc.finalPrice));

    var giftEl = document.getElementById('idPbGift');
    if (giftEl)
      giftEl.textContent =
        calc.gift > 0 ? formatPrice(calc.gift) + '원' : '상담 시 안내';

    var bits = [];
    if (calc.tvComboDiscount > 0)
      bits.push('TV 결합 할인 -' + formatPrice(calc.tvComboDiscount) + '원');
    if (calc.bundleDiscount > 0)
      bits.push('유무선 결합 -' + formatPrice(calc.bundleDiscount) + '원');
    if (calc.cardDiscount > 0)
      bits.push('카드 할인 -' + formatPrice(calc.cardDiscount) + '원');
    setText('idHint', bits.length ? bits.join(' · ') + ' 적용' : '');

    // 카드 할인 값 없을 때 상담 안내 (gift 전용 슬롯 방식 미러 — 별도 줄, '적용' 미부착)
    var giftBox = giftEl && (giftEl.closest('.id-gift') || giftEl);
    var cardConsult = document.getElementById('idCardConsult');
    if (!cardConsult && giftBox && giftBox.parentNode) {
      cardConsult = document.createElement('div');
      cardConsult.id = 'idCardConsult';
      cardConsult.className = 'id-hint id-card-consult';
      giftBox.parentNode.insertBefore(cardConsult, giftBox.nextSibling);
    }
    if (cardConsult) {
      var showConsult = !(calc.cardDiscount > 0);
      cardConsult.textContent = showConsult
        ? '제휴카드 별도문의'
        : '';
      cardConsult.hidden = !showConsult;
    }

    // ★ 안내문구는 calculate 출력이 아니라 선택 인터넷 옵션에서 직접 읽음
    var notice =
      _selectedInternet && _selectedInternet.noticeText
        ? String(_selectedInternet.noticeText)
        : '';
    var nEl = document.getElementById('idNotice');
    if (nEl) {
      nEl.textContent = notice;
      nEl.hidden = !notice;
    }

    var btn = document.getElementById('idApplyBtn');
    if (btn) btn.disabled = !_selectedInternet;

    // 조합이 바뀌었으면 하트 상태를 다시 물어본다(같은 조합이면 요청 안 나간다).
    if (_fav) _fav.refresh();
    if (_cmp) _cmp.refresh();
  }

  function showError(msg) {
    var host = document.getElementById('idRightList');
    if (host)
      host.innerHTML =
        '<div class="id-item" style="justify-content:center;color:#a00;">' +
        escapeHtml(msg) +
        '</div>';
    var btn = document.getElementById('idApplyBtn');
    if (btn) btn.disabled = true;
  }

  // ════════════════════════════════════════════════════
  // 동작: 변경 / 추가 / 제거 + 다이얼로그
  // ════════════════════════════════════════════════════
  var _dlgKind = null;

  function optsFor(kind) {
    return kind === 'internet'
      ? _opts.internets
      : kind === 'tv'
        ? _opts.tvs
        : kind === 'setTop'
          ? _opts.setTops
          : kind === 'tv2'
            ? _opts.tv2s
            : kind === 'setTop2'
              ? _opts.setTop2s
              : _opts.routers;
  }
  function labelOf(kind) {
    for (var i = 0; i < COMPONENTS.length; i++)
      if (COMPONENTS[i].kind === kind) return COMPONENTS[i].label;
    return '';
  }
  function setSelected(kind, opt) {
    if (kind === 'internet') _selectedInternet = opt;
    else if (kind === 'tv') _selectedTv = opt;
    else if (kind === 'setTop') _selectedSetTop = opt;
    else if (kind === 'tv2') _selectedTv2 = opt;
    else if (kind === 'setTop2') _selectedSetTop2 = opt;
    else if (kind === 'router') _selectedRouter = opt;
  }

  // 우측 리스트 버튼(변경/추가/제거) + 다이얼로그 닫기/취소 이벤트 (1회 바인딩, 위임)
  function bindEvents() {
    var host = document.getElementById('idRightList');
    if (host) {
      host.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        var kind = btn.getAttribute('data-kind');
        if (action === 'change' || action === 'add') {
          openOptionDialog(kind);
        } else if (action === 'remove') {
          if (kind === 'internet') return; // 인터넷은 제거 불가(필수)
          setSelected(kind, null);
          _toggles[kind] = false;
          if (kind === 'tv') {
            // TV1 제거 → 셋탑1 + TV2 + 셋탑2 모두 연쇄 해제
            _selectedTv2 = null;
            syncSetTopWithTv();
            syncSetTop2WithTv2();
          }
          if (kind === 'tv2') syncSetTop2WithTv2(); // TV2 제거 → 셋탑2 클리어
          render();
        }
      });
    }

    // ESC = 다이얼로그 취소
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDialog();
    });

    // [신청하기] → DapickApplication 재사용
    var applyBtn = document.getElementById('idApplyBtn');
    if (applyBtn) applyBtn.addEventListener('click', applyConsult);
  }

  // 신청: 통합페이지 applyConsult와 동일 형태의 payload로 DapickApplication.apply 호출
  function applyConsult() {
    var calc = InternetCalc.calculate(selection());
    if (!_selectedInternet) {
      alert('인터넷 상품을 선택해주세요.');
      return;
    }
    if (
      _toggles.tv &&
      _selectedTv &&
      _opts.setTops &&
      _opts.setTops.length &&
      !_selectedSetTop
    ) {
      alert('셋탑을 선택해주세요.');
      return;
    }
    if (
      _selectedTv2 &&
      _opts.setTop2s &&
      _opts.setTop2s.length &&
      !_selectedSetTop2
    ) {
      alert('셋탑2를 선택해주세요.');
      return;
    }
    if (typeof DapickApplication === 'undefined') {
      console.error('[internet-detail] DapickApplication 미로드');
      alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    var m = CARRIER_MAP[_carrierKey] || { name: _carrierKey };
    var providerName = m.name;

    var tvName = _toggles.tv && _selectedTv ? _selectedTv.name : '미사용';
    var setTopName =
      _toggles.tv && _selectedTv && _selectedSetTop
        ? _selectedSetTop.name
        : '미사용';
    var routerName =
      _toggles.router && _selectedRouter ? _selectedRouter.name : '미사용';
    var tv2Name =
      _toggles.tv && _selectedTv && _selectedTv2 ? _selectedTv2.name : '미사용';
    var setTop2Name =
      _selectedTv2 && _selectedSetTop2 ? _selectedSetTop2.name : '미사용';

    var selectedOptions = {
      통신사: providerName,
      인터넷상품: (_selectedInternet && _selectedInternet.name) || '',
      TV: tvName,
      셋탑: setTopName,
      TV2: tv2Name,
      셋탑2: setTop2Name,
      공유기: routerName,
      결합전요금: calc.basePrice,
      휴대폰결합요금: calc.bundlePrice,
      카드할인적용가: calc.cardPrice,
      현금사은품: calc.gift,
    };

    DapickApplication.apply({
      category: 'INTERNET_TV',
      productId: _product.id,
      productName: comboLabel(), // 찜 라벨과 같은 문자열 (한 곳에서만 만든다)
      brand: _carrierKey,
      selectedOptions: selectedOptions,
      monthlyPrice: calc.finalPrice,
    });
  }

  // 다이얼로그 DOM 자체 주입 (1회)
  function injectDialog() {
    if (document.getElementById('idDlgOverlay')) return;
    var overlay = document.createElement('div');
    overlay.className = 'idlg-overlay';
    overlay.id = 'idDlgOverlay';
    overlay.innerHTML = [
      '<div class="idlg-box" role="dialog" aria-modal="true">',
      '  <div class="idlg-head">',
      '    <span class="idlg-title" id="idDlgTitle">선택</span>',
      '    <button class="idlg-close" id="idDlgClose" type="button" aria-label="닫기">✕</button>',
      '  </div>',
      '  <div class="idlg-sub" id="idDlgSub" style="display:none;font-size:12px;color:#9ca3af;padding:0 0 10px;"></div>',
      '  <div class="idlg-grid" id="idDlgGrid"></div>',
      '</div>',
    ].join('');
    document.body.appendChild(overlay);

    // 배경 클릭 = 취소
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeDialog();
    });
    document.getElementById('idDlgClose').addEventListener('click', closeDialog);

    // 옵션 카드 클릭 = 선택 → 교체 → render (위임)
    document
      .getElementById('idDlgGrid')
      .addEventListener('click', function (e) {
        var card = e.target.closest('[data-name]');
        if (!card || !_dlgKind) return;
        var opt = InternetCalc.findOptionByName(
          optsFor(_dlgKind),
          card.getAttribute('data-name'),
        );
        if (!opt) return;
        setSelected(_dlgKind, opt);
        if (_dlgKind !== 'internet') _toggles[_dlgKind] = true; // 추가 동작 겸용
        if (_dlgKind === 'tv') {
          syncSetTopWithTv(); // TV1 선택/변경 → 셋탑1 의존성 동기화
          syncSetTop2WithTv2(); // TV1 변경 시 TV2 종속(셋탑2)도 재동기화
        }
        if (_dlgKind === 'tv2') syncSetTop2WithTv2(); // TV2 선택/변경 → 셋탑2 동기화
        closeDialog();
        render();
      });
  }

  // 공용 열기: kind 옵션 전체를 카드 그리드로
  function openOptionDialog(kind) {
    // TV1 종속 가드 — TV1 없으면 TV2 추가 불가, TV2 없으면 셋탑2 추가 불가 (빈카드 숨김에 더한 2차 방어)
    if (kind === 'tv2' && (!_toggles.tv || !_selectedTv)) return;
    if (kind === 'setTop2' && !_selectedTv2) return;
    _dlgKind = kind;
    var options = optsFor(kind) || [];
    setText('idDlgTitle', labelOf(kind) + ' 선택');

    // 인터넷 다이얼로그 + 와이파이 패키지 모드일 때만 가격 기준 안내 (카드 가격은 priceOf로 이미 모드 반영됨)
    var subEl = document.getElementById('idDlgSub');
    if (subEl) {
      if (kind === 'internet' && _wifiMode === 'package') {
        subEl.textContent =
          '와이파이 패키지 적용 가격' +
          (_toggles.wifi7d ? ' · 7D 광대역 포함' : '');
        subEl.style.display = '';
      } else {
        subEl.textContent = '';
        subEl.style.display = 'none';
      }
    }

    var grid = document.getElementById('idDlgGrid');
    if (!options.length) {
      grid.innerHTML =
        '<div class="idlg-empty">선택 가능한 상품이 없습니다.</div>';
    } else {
      var cur = selectedOf(kind);
      grid.innerHTML = options
        .map(function (opt) {
          var active = cur && cur.name === opt.name ? ' is-active' : '';
          var d = splitDesc(opt.desc);
          var sub = d.head
            ? '<div class="idlg-card-desc">' +
              escapeHtml(d.head) +
              (d.sub ? ' · ' + escapeHtml(d.sub) : '') +
              '</div>'
            : '';
          return (
            '<button type="button" class="idlg-card' +
            active +
            '" data-name="' +
            escapeHtml(opt.name) +
            '">' +
            '<div class="idlg-card-name">' +
            escapeHtml(opt.name) +
            '</div>' +
            sub +
            '<div class="idlg-card-price">월 ' +
            formatPrice(priceOf(opt)) +
            '원</div>' +
            '</button>'
          );
        })
        .join('');
    }

    var overlay = document.getElementById('idDlgOverlay');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeDialog() {
    var overlay = document.getElementById('idDlgOverlay');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  // gnb 카테고리 이동 (base.js 전역 goPage 대체 — 상세페이지 로컬)
  window.goPage = function (page) {
    var map = {
      mobile: 'mobile.html',
      internet: 'internet.html',
      card: 'card.html',
      water: 'water.html',
      rental: 'rental.html',
    };
    window.location.href = map[page] || 'index.html';
  };

  // ── 부팅 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
