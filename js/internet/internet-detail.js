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
    { kind: 'router', label: '공유기', removable: true },
    { kind: 'phone', label: '전화', removable: true },
  ];

  // ── 상태 ──
  var _carrierKey = null;
  var _product = null;
  var _opts = { internets: [], tvs: [], routers: [], phones: [], meta: {} };
  var _selectedInternet = null;
  var _selectedTv = null;
  var _selectedRouter = null;
  var _selectedPhone = null;
  var _toggles = { tv: false, router: false, phone: false };

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
  function priceOf(opt) {
    return InternetCalc.bundleOf(opt);
  }

  // 현재 선택 → InternetCalc 입력 객체
  function selection() {
    return {
      internet: _selectedInternet,
      tv: _selectedTv,
      router: _selectedRouter,
      phone: _selectedPhone,
      toggles: _toggles,
      meta: _opts.meta,
    };
  }
  function selectedOf(kind) {
    return kind === 'internet'
      ? _selectedInternet
      : kind === 'tv'
        ? _selectedTv
        : kind === 'router'
          ? _selectedRouter
          : _selectedPhone;
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
    _selectedPhone = InternetCalc.findOptionByName(
      _opts.phones,
      params.get('phone'),
    );

    // 토글 on/off = 해당 옵션이 실제로 복원됐는지로 결정 (URL with는 힌트일 뿐, 방어적으로 무시 가능)
    _toggles.tv = !!_selectedTv;
    _toggles.router = !!_selectedRouter;
    _toggles.phone = !!_selectedPhone;
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
      var on = c.kind === 'internet' ? true : _toggles[c.kind];
      var opt = selectedOf(c.kind);
      if (on && opt) return filledCard(c, opt);
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
    setText('idPbBase', formatPrice(calc.basePrice) + '원');
    setText('idPbBundle', formatPrice(calc.bundlePrice) + '원');
    setText('idPbFinal', formatPrice(calc.finalPrice));

    var giftEl = document.getElementById('idPbGift');
    if (giftEl)
      giftEl.textContent =
        calc.gift > 0 ? formatPrice(calc.gift) + '원' : '상담 시 안내';

    var bits = [];
    if (calc.bundleDiscount > 0)
      bits.push('유무선 결합 -' + formatPrice(calc.bundleDiscount) + '원');
    if (calc.cardDiscount > 0)
      bits.push('카드 할인 -' + formatPrice(calc.cardDiscount) + '원');
    setText('idHint', bits.length ? bits.join(' · ') + ' 적용' : '');

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
        : kind === 'router'
          ? _opts.routers
          : _opts.phones;
  }
  function labelOf(kind) {
    for (var i = 0; i < COMPONENTS.length; i++)
      if (COMPONENTS[i].kind === kind) return COMPONENTS[i].label;
    return '';
  }
  function setSelected(kind, opt) {
    if (kind === 'internet') _selectedInternet = opt;
    else if (kind === 'tv') _selectedTv = opt;
    else if (kind === 'router') _selectedRouter = opt;
    else if (kind === 'phone') _selectedPhone = opt;
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
    if (typeof DapickApplication === 'undefined') {
      console.error('[internet-detail] DapickApplication 미로드');
      alert('신청 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    var m = CARRIER_MAP[_carrierKey] || { name: _carrierKey };
    var providerName = m.name;

    var tvName = _toggles.tv && _selectedTv ? _selectedTv.name : '미사용';
    var routerName =
      _toggles.router && _selectedRouter ? _selectedRouter.name : '미사용';
    var phoneName =
      _toggles.phone && _selectedPhone ? _selectedPhone.name : '미사용';

    var selectedOptions = {
      통신사: providerName,
      인터넷상품: (_selectedInternet && _selectedInternet.name) || '',
      TV: tvName,
      공유기: routerName,
      전화: phoneName,
      결합전요금: calc.basePrice,
      휴대폰결합요금: calc.bundlePrice,
      카드할인적용가: calc.cardPrice,
      현금사은품: calc.gift,
    };

    var nameParts = [providerName, (_selectedInternet && _selectedInternet.name) || ''];
    if (_toggles.tv && _selectedTv) nameParts.push('+ ' + _selectedTv.name);
    if (_toggles.router && _selectedRouter)
      nameParts.push('+ ' + _selectedRouter.name);
    if (_toggles.phone && _selectedPhone)
      nameParts.push('+ ' + _selectedPhone.name);

    DapickApplication.apply({
      category: 'INTERNET_TV',
      productId: _product.id,
      productName: nameParts.join(' '),
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
        closeDialog();
        render();
      });
  }

  // 공용 열기: kind 옵션 전체를 카드 그리드로
  function openOptionDialog(kind) {
    _dlgKind = kind;
    var options = optsFor(kind) || [];
    setText('idDlgTitle', labelOf(kind) + ' 선택');

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
