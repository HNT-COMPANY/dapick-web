(function () {
  'use strict';

  // ── 설정 ─────────────────────────────────────────────
  var API_BASE =
    typeof BASE_URL !== 'undefined' && BASE_URL
      ? BASE_URL
      : 'https://api.dapick.co.kr';
  var RENTAL_CATEGORY_ID = '1922524f-6eb4-4129-acd7-5982d77e80cc';
  var KAKAO_CHAT_URL = 'https://pf.kakao.com/_exaRjX/chat';

  // brand 공개 조회 API가 아직 없어, 품목은 코드로 관리.
  // brand 공개 API 정비 후 fetchItems()를 API 호출로 교체하면 동적 전환됨.
  var ITEMS = [
    {
      brandId: '283c3f71-8daa-4383-a8b0-726652703c9a',
      name: '공기청정기',
      emoji: '🌬️',
      logoUrl: '', // 관리자가 brands.logo_url 채우면 이미지로 표시
    },
    // 품목 추가 시 여기에 { brandId, name, emoji, logoUrl } 추가
  ];

  // ── 상태 ─────────────────────────────────────────────
  var currentItem = null; // 선택된 품목
  var currentProducts = []; // 현재 품목의 상품 목록
  var selectedProduct = null; // 다이얼로그/신청 대상 상품
  var selectedColor = null;

  // ── 유틸 ─────────────────────────────────────────────
  function won(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('ko-KR') + '원';
  }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function monthlyOf(p) {
    var pr = p.pricing || {};
    return pr.monthly != null
      ? pr.monthly
      : pr.selfCare != null
        ? pr.selfCare
        : null;
  }

  // ── 품목 그리드 렌더 ────────────────────────────────
  function renderItems() {
    var grid = document.getElementById('itemGrid');
    if (!ITEMS.length) {
      grid.innerHTML = '<div class="r-empty">준비된 품목이 없습니다.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i];
      var thumb = it.logoUrl
        ? '<div class="r-item-thumb"><img src="' +
          esc(it.logoUrl) +
          '" alt="' +
          esc(it.name) +
          '"></div>'
        : '<div class="r-item-thumb"><span class="r-item-emoji">' +
          esc(it.emoji || '📦') +
          '</span></div>';
      html +=
        '<div class="r-item-card" data-idx="' +
        i +
        '">' +
        thumb +
        '<div class="r-item-name">' +
        esc(it.name) +
        '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
    var cards = grid.querySelectorAll('.r-item-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function () {
        selectItem(ITEMS[parseInt(this.getAttribute('data-idx'), 10)]);
      });
    }
  }

  // ── 품목 선택 → 상품 뷰 ─────────────────────────────
  function selectItem(item) {
    currentItem = item;
    document.getElementById('productViewBrand').textContent = item.name;
    document.getElementById('productHeroTag').textContent =
      (item.emoji || '🏠') + ' ' + item.name + ' 렌탈';
    document.getElementById('boardView').style.display = 'none';
    document.getElementById('productView').style.display = 'block';
    window.scrollTo({ top: 0 });
    loadProducts(item.brandId);
  }

  window.goBoard = function () {
    document.getElementById('productView').style.display = 'none';
    document.getElementById('boardView').style.display = 'block';
    window.scrollTo({ top: 0 });
  };

  // ── 상품 목록 로드 ──────────────────────────────────
  function loadProducts(brandId) {
    var grid = document.getElementById('listGrid');
    grid.innerHTML = '<div class="r-loading">상품을 불러오는 중...</div>';
    fetch(
      API_BASE + '/api/rental-products?brandId=' + encodeURIComponent(brandId),
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        currentProducts = res && res.data ? res.data : [];
        renderProducts();
      })
      .catch(function (e) {
        console.error('[rental] load products failed', e);
        grid.innerHTML =
          '<div class="r-empty">상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
      });
  }

  function renderProducts() {
    var grid = document.getElementById('listGrid');
    if (!currentProducts.length) {
      grid.innerHTML = '<div class="r-empty">등록된 상품이 없습니다.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < currentProducts.length; i++) {
      var p = currentProducts[i];
      var m = monthlyOf(p);
      var priceLine =
        m != null
          ? '<div class="wl-price">월 <b>' + won(m) + '</b></div>'
          : '<div class="wl-price">상담 시 안내</div>';
      var img = p.imageUrl
        ? '<div class="wl-thumb"><img src="' +
          esc(p.imageUrl) +
          '" alt="' +
          esc(p.name) +
          '" loading="lazy"></div>'
        : '<div class="wl-thumb"><span style="font-size:40px;">' +
          esc(p.emoji || '📦') +
          '</span></div>';
      html +=
        '<div class="water-list-card" data-idx="' +
        i +
        '">' +
        img +
        '<div class="wl-body">' +
        '<div class="wl-name">' +
        esc(p.name) +
        '</div>' +
        (p.contractMonths
          ? '<div class="wl-meta">약정 ' + esc(p.contractMonths) + '개월</div>'
          : '') +
        priceLine +
        '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
    var cards = grid.querySelectorAll('.water-list-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function () {
        openDialog(
          currentProducts[parseInt(this.getAttribute('data-idx'), 10)],
        );
      });
    }
  }

  // ── 상품 다이얼로그 ─────────────────────────────────
  function openDialog(p) {
    selectedProduct = p;
    selectedColor = null;
    document.getElementById('wDTag').textContent = currentItem
      ? currentItem.name
      : '렌탈';
    document.getElementById('wDName').textContent = p.name || '';
    var m = monthlyOf(p);
    document.getElementById('wDPrice').innerHTML =
      (m != null ? won(m) : '상담 안내') + '<span>/월</span>';
    document.getElementById('wDContractText').textContent = p.contractMonths
      ? p.contractMonths + '개월'
      : '-';

    // 색상
    var colorsGroup = document.getElementById('wDColorsGroup');
    var colorsBox = document.getElementById('wDColors');
    var colors = p.colors || [];
    if (colors.length) {
      var ch = '';
      for (var i = 0; i < colors.length; i++) {
        ch +=
          '<button class="w-color-chip" data-color="' +
          esc(colors[i]) +
          '">' +
          esc(colors[i]) +
          '</button>';
      }
      colorsBox.innerHTML = ch;
      colorsGroup.style.display = '';
      var chips = colorsBox.querySelectorAll('.w-color-chip');
      for (var k = 0; k < chips.length; k++) {
        chips[k].addEventListener('click', function () {
          for (var x = 0; x < chips.length; x++)
            chips[x].classList.remove('active');
          this.classList.add('active');
          selectedColor = this.getAttribute('data-color');
        });
      }
    } else {
      colorsBox.innerHTML = '';
      colorsGroup.style.display = 'none';
    }

    // 관리주기
    var careGroup = document.getElementById('wDCareGroup');
    if (p.careInterval) {
      document.getElementById('wDCare').textContent = p.careInterval;
      careGroup.style.display = '';
    } else {
      careGroup.style.display = 'none';
    }

    document.getElementById('wDDesc').textContent = p.description || '';
    document.getElementById('wDialogOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  window.closeDialog = function () {
    document.getElementById('wDialogOverlay').classList.remove('show');
    document.body.style.overflow = '';
  };
  window.closeDialogOutside = function (e) {
    if (e.target === document.getElementById('wDialogOverlay'))
      window.closeDialog();
  };
  window.openKakaoChat = function () {
    window.open(KAKAO_CHAT_URL, '_blank');
  };

  // ── 신청 폼 ─────────────────────────────────────────
  window.openApplyForm = function () {
    if (!selectedProduct) return;

    // 로그인 필수
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      alert(
        '상담 신청은 로그인 후 이용할 수 있어요. 로그인 페이지로 이동합니다.',
      );
      var btn = document.querySelector('.btn-login');
      if (btn) {
        btn.click();
      } else {
        window.location.href = 'index.html';
      }
      return;
    }

    document.getElementById('rApplyStepForm').style.display = 'block';
    document.getElementById('rApplyStepDone').style.display = 'none';
    document.getElementById('rApplyErr').textContent = '';

    var m = monthlyOf(selectedProduct);
    document.getElementById('rApplyProd').innerHTML =
      '신청 상품: <b>' +
      esc(selectedProduct.name) +
      '</b>' +
      (m != null ? ' · 월 ' + won(m) : '') +
      (selectedColor ? ' · ' + esc(selectedColor) : '');

    document.getElementById('rApplyOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  window.closeApplyForm = function () {
    document.getElementById('rApplyOverlay').classList.remove('show');
    document.body.style.overflow = '';
  };
  window.closeApplyOutside = function (e) {
    if (e.target === document.getElementById('rApplyOverlay'))
      window.closeApplyForm();
  };

  // ── 신청 제출 → POST /api/applications ──────────────
  window.submitApplication = function () {
    var errEl = document.getElementById('rApplyErr');
    errEl.textContent = '';

    var name = document.getElementById('fName').value.trim();
    var phone = document.getElementById('fPhone').value.trim();
    var birth = document.getElementById('fBirth').value;
    var email = document.getElementById('fEmail').value.trim();
    var bank = document.getElementById('fBank').value.trim();
    var addr = document.getElementById('fAddr').value.trim();
    var memo = document.getElementById('fMemo').value.trim();
    var agreePrivacy = document.getElementById('fPrivacy').checked;
    var agreeWarning = document.getElementById('fWarning').checked;
    var agreeMarketing = document.getElementById('fMarketing').checked;
    var agreeEmailInfo = document.getElementById('fEmailInfo').checked;

    // 프론트 검증 (백엔드 DTO 규칙과 일치)
    if (!name) {
      errEl.textContent = '신청자 이름을 입력해주세요.';
      return;
    }
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
      errEl.textContent = '올바른 휴대폰 번호를 입력해주세요.';
      return;
    }
    if (!birth) {
      errEl.textContent = '생년월일을 입력해주세요.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = '올바른 이메일을 입력해주세요.';
      return;
    }
    if (!bank) {
      errEl.textContent = '지원금 입금받을 계좌를 입력해주세요.';
      return;
    }
    if (!agreePrivacy) {
      errEl.textContent = '개인정보 처리방침 동의는 필수입니다.';
      return;
    }
    if (!agreeWarning) {
      errEl.textContent = '주의사항 확인은 필수입니다.';
      return;
    }

    var token = localStorage.getItem('dapick_token');
    if (!token) {
      errEl.textContent = '로그인이 필요합니다.';
      return;
    }

    var payload = {
      productId: selectedProduct.id,
      applicantName: name,
      applicantPhone: phone,
      birthDate: birth,
      applicantEmail: email,
      bankAccount: bank,
      address: addr || null,
      memo: memo || null,
      agreePrivacy: true,
      agreeMarketing: agreeMarketing,
      agreeEmailInfo: agreeEmailInfo,
      confirmedFirstWarning: true,
    };

    var submitBtn = document.getElementById('rApplySubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '신청 중...';

    fetch(API_BASE + '/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          return { ok: r.ok, status: r.status, body: body };
        });
      })
      .then(function (res) {
        submitBtn.disabled = false;
        submitBtn.textContent = '상담 신청하기';
        if (res.ok && res.body && res.body.success) {
          var num = res.body.data ? res.body.data.applicationNumber || '' : '';
          document.getElementById('rDoneNum').textContent = num || '접수 완료';
          document.getElementById('rApplyStepForm').style.display = 'none';
          document.getElementById('rApplyStepDone').style.display = 'block';
        } else {
          var msg =
            res.body && res.body.message
              ? res.body.message
              : '신청에 실패했습니다. 잠시 후 다시 시도해주세요.';
          if (res.status === 401)
            msg = '로그인이 만료되었습니다. 다시 로그인해주세요.';
          errEl.textContent = msg;
        }
      })
      .catch(function (e) {
        console.error('[rental] submit failed', e);
        submitBtn.disabled = false;
        submitBtn.textContent = '상담 신청하기';
        errEl.textContent =
          '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      });
  };

  // ── goPage 폴백 (utils.js에 있으면 그걸 사용) ────────
  if (typeof window.goPage !== 'function') {
    window.goPage = function (key) {
      var map = {
        mobile: 'mobile.html',
        internet: 'internet.html',
        card: 'card.html',
        water: 'water.html',
        rental: 'rental.html',
      };
      if (map[key]) window.location.href = map[key];
    };
  }

  // ── 초기화 ──────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    renderItems();
  });
})();
