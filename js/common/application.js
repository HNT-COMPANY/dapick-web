// ════════════════════════════════════════════════════
// application.js — 다픽 신청 처리 통합 모듈 (공통 모달 버전)
// ────────────────────────────────────────────────────
// 5/27 통일: 신청자정보 모달을 이 모듈이 동적 주입 (전 카테고리 공유)
// 5/29 개선:
//   - 연락처 자동 하이픈 (010-1234-5678)
//   - 이메일 = [아이디] @ [도메인 select(gmail/naver/daum/직접입력)]
//   - 계좌 = [은행 select] + [계좌번호] → "신한은행 110-..." 합쳐 전송
//   - 주소 = 다음(카카오) 우편번호 API → zipcode + 기본/상세주소
//     (외부 스크립트 1회 동적 로드, API 키 불필요)
//
// 사용법: DapickApplication.apply({ category, productId, productName, brand, selectedOptions, monthlyPrice })
//
// 백엔드: POST /api/consultations
//   body = { productId, selectedOptions, monthlyPrice,
//            applicantName, applicantPhone, applicantEmail,
//            bankAccount, zipcode, address,
//            agreePrivacy, agreeMarketing, agreeEmailInfo }
// ════════════════════════════════════════════════════

window.DapickApplication = (function () {
  'use strict';

  var STORAGE_KEY = 'dapick:pendingApplication';
  // 토큰: 소비자 dapick_token 우선, 없으면 accessToken (키 불일치 대비)
  function getToken() {
    return (
      localStorage.getItem('dapick_token') ||
      localStorage.getItem('accessToken') ||
      ''
    );
  }
  var API_BASE =
    typeof BASE_URL !== 'undefined' && BASE_URL
      ? BASE_URL
      : typeof DAPICK_CONFIG !== 'undefined' && DAPICK_CONFIG.API_BASE_URL
        ? DAPICK_CONFIG.API_BASE_URL
        : 'https://api.dapick.co.kr';
  var KAKAO_CHAT_URL = 'https://pf.kakao.com/_exaRjX/chat';

  // 다음 우편번호 스크립트
  var POSTCODE_SRC =
    'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
  var postcodeLoading = null;

  // 은행 목록 (자유 추가 가능)
  var BANKS = [
    'KB국민',
    '신한',
    '우리',
    '하나',
    'NH농협',
    'IBK기업',
    'SC제일',
    'KDB산업',
    '카카오뱅크',
    '케이뱅크',
    '토스뱅크',
    'BNK부산',
    'BNK경남',
    'DGB대구',
    '광주',
    '전북',
    '제주',
    '새마을금고',
    '신협',
    '우체국',
    'Sh수협',
    'iM뱅크',
  ];

  // 이메일 도메인
  var EMAIL_DOMAINS = [
    'gmail.com',
    'naver.com',
    'daum.net',
    'hanmail.net',
    'nate.com',
    'kakao.com',
  ];

  var currentPayload = null;
  var modalInjected = false;

  function isLoggedIn() {
    return !!getToken();
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
  function won(n) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('ko-KR') + '원';
  }

  // ── 다음 우편번호 스크립트 로더 (1회) ──
  function loadPostcodeScript() {
    if (window.daum && window.daum.Postcode) return Promise.resolve();
    if (postcodeLoading) return postcodeLoading;
    postcodeLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = POSTCODE_SRC;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        postcodeLoading = null;
        reject(new Error('우편번호 서비스 로드 실패'));
      };
      document.head.appendChild(s);
    });
    return postcodeLoading;
  }

  // ── 연락처 자동 하이픈 ──
  function formatPhone(v) {
    var d = String(v || '')
      .replace(/[^0-9]/g, '')
      .slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  }

  // ════════════════════════════════════════════════════
  // 모달 주입 (1회)
  // ════════════════════════════════════════════════════
  function injectModal() {
    if (modalInjected) return;
    modalInjected = true;

    var style = document.createElement('style');
    style.textContent = [
      '.da-apply-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:none;align-items:flex-end;justify-content:center;}',
      '.da-apply-overlay.show{display:flex;}',
      '@media(min-width:640px){.da-apply-overlay{align-items:center;}}',
      '.da-apply-modal{background:#fff;width:100%;max-width:480px;max-height:92vh;overflow-y:auto;border-radius:20px 20px 0 0;}',
      '@media(min-width:640px){.da-apply-modal{border-radius:20px;}}',
      '.da-apply-head{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 12px;position:sticky;top:0;background:#fff;z-index:1;}',
      '.da-apply-title{font-size:18px;font-weight:700;color:#222;}',
      '.da-apply-close{border:none;background:none;font-size:20px;cursor:pointer;color:#888;}',
      '.da-apply-prod{margin:0 20px 16px;padding:12px 14px;background:#f5f4fb;border-radius:10px;font-size:13px;color:#555;line-height:1.5;}',
      '.da-apply-body{padding:0 20px 20px;}',
      '.da-field{margin-bottom:14px;}',
      '.da-field label{display:block;font-size:13px;font-weight:600;color:#444;margin-bottom:6px;}',
      '.da-field .req{color:#e8547a;margin-left:2px;}',
      '.da-field input,.da-field select,.da-field textarea{width:100%;padding:11px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;font-family:inherit;background:#fff;}',
      '.da-field textarea{resize:vertical;min-height:60px;}',
      '.da-row{display:flex;gap:8px;align-items:center;}',
      '.da-row > *{min-width:0;}',
      '.da-row .at{flex:0 0 auto;color:#888;font-weight:600;}',
      '.da-btn-sub{flex:0 0 auto;padding:11px 14px;border:1px solid #5b5bd6;background:#fff;color:#5b5bd6;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;}',
      '.da-btn-sub:hover{background:#eef0ff;}',
      '.da-readonly{background:#f7f7fa !important;color:#555;}',
      '.da-agree-all{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:12px 14px;background:#f5f4fb;border:1px solid #ddd;border-radius:8px;font-size:14px;font-weight:700;color:#222;cursor:pointer;}',
      '.da-agree-all input{margin:0;flex-shrink:0;width:auto !important;}',
      '.da-agree-divider{border:none;border-top:1px solid #eee;margin:0 0 10px;}',
      '.da-agree{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;font-size:12.5px;color:#555;line-height:1.5;cursor:pointer;}',
      '.da-agree input{margin-top:2px;flex-shrink:0;width:auto !important;}',
      '.da-agree a{color:#5b5bd6;text-decoration:underline;}',
      '.da-apply-err{color:#e8547a;font-size:13px;margin:8px 0 0;min-height:18px;}',
      '.da-apply-submit{width:100%;padding:14px;background:#5b5bd6;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;}',
      '.da-apply-submit:disabled{opacity:.6;cursor:not-allowed;}',
      '.da-done{padding:40px 24px;text-align:center;}',
      '.da-done-emoji{font-size:44px;margin-bottom:12px;}',
      '.da-done-title{font-size:19px;font-weight:700;color:#222;margin-bottom:10px;}',
      '.da-done-num{font-size:16px;font-weight:700;color:#5b5bd6;margin-bottom:14px;letter-spacing:.5px;}',
      '.da-done-sub{font-size:13px;color:#777;line-height:1.6;margin-bottom:20px;}',
      '.da-done-btn{padding:12px 40px;background:#5b5bd6;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;}',
    ].join('');
    document.head.appendChild(style);

    var bankOpts =
      '<option value="">은행 선택</option>' +
      BANKS.map(function (b) {
        return '<option value="' + esc(b) + '">' + esc(b) + '</option>';
      }).join('');

    var emailDomainOpts =
      EMAIL_DOMAINS.map(function (d) {
        return '<option value="' + esc(d) + '">' + esc(d) + '</option>';
      }).join('') + '<option value="__custom__">직접 입력</option>';

    var overlay = document.createElement('div');
    overlay.className = 'da-apply-overlay';
    overlay.id = 'daApplyOverlay';
    overlay.innerHTML = [
      '<div class="da-apply-modal">',
      '  <div id="daApplyStepForm">',
      '    <div class="da-apply-head">',
      '      <span class="da-apply-title">상담 신청</span>',
      '      <button class="da-apply-close" type="button" id="daApplyCloseBtn">✕</button>',
      '    </div>',
      '    <div class="da-apply-prod" id="daApplyProd">상품 정보</div>',
      '    <div class="da-apply-body">',
      '      <div class="da-field"><label>신청자 이름<span class="req">*</span></label><input type="text" id="daName" placeholder="홍길동" autocomplete="name"/></div>',

      '      <div class="da-field"><label>연락처<span class="req">*</span></label><input type="tel" id="daPhone" placeholder="010-1234-5678" autocomplete="tel" maxlength="13" inputmode="numeric"/></div>',

      '      <div class="da-field"><label>이메일<span class="req">*</span></label>',
      '        <div class="da-row">',
      '          <input type="text" id="daEmailId" placeholder="아이디" autocomplete="off" style="flex:1;"/>',
      '          <span class="at">@</span>',
      '          <input type="text" id="daEmailDomain" placeholder="직접 입력" autocomplete="off" style="flex:1;display:none;"/>',
      '          <select id="daEmailDomainSel" style="flex:1;">' +
        emailDomainOpts +
        '</select>',
      '        </div>',
      '      </div>',

      '      <div class="da-field"><label>지원금 입금받을 계좌<span class="req">*</span></label>',
      '        <div class="da-row">',
      '          <select id="daBankName" style="flex:0 0 130px;">' +
        bankOpts +
        '</select>',
      '          <input type="text" id="daBankNo" placeholder="계좌번호 (- 없이)" inputmode="numeric" style="flex:1;"/>',
      '        </div>',
      '      </div>',

      '      <div class="da-field"><label>주소</label>',
      '        <div class="da-row" style="margin-bottom:8px;">',
      '          <input type="text" id="daZip" class="da-readonly" placeholder="우편번호" readonly style="flex:0 0 110px;"/>',
      '          <button type="button" class="da-btn-sub" id="daAddrSearchBtn">주소 찾기</button>',
      '        </div>',
      '        <input type="text" id="daAddr1" class="da-readonly" placeholder="기본 주소" readonly style="margin-bottom:8px;"/>',
      '        <input type="text" id="daAddr2" placeholder="상세 주소 (동/호수 등)"/>',
      '      </div>',

      '      <div class="da-field"><label>문의사항</label><textarea id="daMemo" placeholder="궁금한 점이나 요청사항 (선택)"></textarea></div>',
      '      <label class="da-agree-all"><input type="checkbox" id="daAgreeAll"/><span>전체 동의</span></label>',
      '      <hr class="da-agree-divider"/>',
      '      <label class="da-agree"><input type="checkbox" id="daPrivacy"/><span>[필수] <a href="privacy.html" target="_blank">개인정보 처리방침</a>에 동의합니다.</span></label>',
      '      <label class="da-agree"><input type="checkbox" id="daWarning"/><span>[필수] 다픽은 통신판매중개자이며, 상담 신청 시 위탁사로 정보가 전달됨을 확인했습니다.</span></label>',
      '      <label class="da-agree"><input type="checkbox" id="daMarketing"/><span>[선택] 마케팅 정보 수신에 동의합니다.</span></label>',
      '      <label class="da-agree"><input type="checkbox" id="daEmailInfo"/><span>[선택] 이메일 정보 수신에 동의합니다.</span></label>',
      '      <p class="da-apply-err" id="daApplyErr"></p>',
      '      <button class="da-apply-submit" type="button" id="daApplySubmit">상담 신청하기</button>',
      '    </div>',
      '  </div>',
      '  <div id="daApplyStepDone" style="display:none;">',
      '    <div class="da-done">',
      '      <div class="da-done-emoji">🎉</div>',
      '      <div class="da-done-title">상담 신청이 접수되었어요!</div>',
      '      <div class="da-done-num" id="daDoneNum">-</div>',
      '      <div class="da-done-sub">담당 상담사가 순차적으로 연락드릴 예정입니다.<br>마이페이지에서 신청 내역을 확인할 수 있어요.</div>',
      '      <button class="da-done-btn" type="button" id="daDoneBtn">확인</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('');
    document.body.appendChild(overlay);

    // ── 이벤트 바인딩 ──
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document
      .getElementById('daApplyCloseBtn')
      .addEventListener('click', closeModal);
    document.getElementById('daDoneBtn').addEventListener('click', closeModal);
    document
      .getElementById('daApplySubmit')
      .addEventListener('click', submitForm);

    // ── 전체 동의 연동 ──
    var agreeAllEl = document.getElementById('daAgreeAll');
    var agreeChildIds = [
      'daPrivacy',
      'daWarning',
      'daMarketing',
      'daEmailInfo',
    ];
    function getChildEls() {
      return agreeChildIds
        .map(function (id) {
          return document.getElementById(id);
        })
        .filter(Boolean);
    }
    // 전체 동의 클릭 → 하위 전부 체크/해제
    agreeAllEl.addEventListener('change', function () {
      var checked = agreeAllEl.checked;
      getChildEls().forEach(function (el) {
        el.checked = checked;
      });
    });
    // 하위 하나라도 변하면 전체 동의 상태 동기화
    getChildEls().forEach(function (el) {
      el.addEventListener('change', function () {
        var all = getChildEls();
        agreeAllEl.checked = all.every(function (c) {
          return c.checked;
        });
      });
    });

    // 연락처 자동 하이픈
    var phoneEl = document.getElementById('daPhone');
    phoneEl.addEventListener('input', function () {
      var pos = phoneEl.selectionStart;
      var before = phoneEl.value;
      phoneEl.value = formatPhone(phoneEl.value);
      // 커서가 끝쪽이면 그대로 둠 (간단 처리)
      if (pos >= before.length) {
        phoneEl.setSelectionRange(phoneEl.value.length, phoneEl.value.length);
      }
    });

    // 이메일 도메인 select → 직접입력 토글
    var domainSel = document.getElementById('daEmailDomainSel');
    var domainInput = document.getElementById('daEmailDomain');
    domainSel.addEventListener('change', function () {
      if (domainSel.value === '__custom__') {
        domainSel.style.display = 'none';
        domainInput.style.display = '';
        domainInput.focus();
      }
    });
    // 직접입력 칸 비우고 blur 하면 다시 select 로 복귀
    domainInput.addEventListener('blur', function () {
      if (!domainInput.value.trim()) {
        domainInput.style.display = 'none';
        domainSel.style.display = '';
        domainSel.value = EMAIL_DOMAINS[0];
      }
    });

    // 계좌번호 숫자/하이픈만
    var bankNoEl = document.getElementById('daBankNo');
    bankNoEl.addEventListener('input', function () {
      bankNoEl.value = bankNoEl.value.replace(/[^0-9\-]/g, '');
    });

    // 주소 찾기 (다음 우편번호)
    document
      .getElementById('daAddrSearchBtn')
      .addEventListener('click', openPostcode);
  }

  // ── 다음 우편번호 팝업 ──
  function openPostcode() {
    var btn = document.getElementById('daAddrSearchBtn');
    btn.disabled = true;
    var prev = btn.textContent;
    btn.textContent = '불러오는 중...';

    loadPostcodeScript()
      .then(function () {
        btn.disabled = false;
        btn.textContent = prev;
        new window.daum.Postcode({
          oncomplete: function (data) {
            var addr =
              data.userSelectedType === 'R'
                ? data.roadAddress
                : data.jibunAddress;
            document.getElementById('daZip').value = data.zonecode || '';
            document.getElementById('daAddr1').value = addr || '';
            document.getElementById('daAddr2').focus();
          },
        }).open();
      })
      .catch(function (e) {
        btn.disabled = false;
        btn.textContent = prev;
        console.error('[DapickApplication] 우편번호 로드 실패', e);
        alert(
          '주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
        );
      });
  }

  // ── 이메일 조립 ──
  function buildEmail() {
    var id = document.getElementById('daEmailId').value.trim();
    var domainSel = document.getElementById('daEmailDomainSel');
    var domainInput = document.getElementById('daEmailDomain');
    var domain =
      domainSel.style.display === 'none'
        ? domainInput.value.trim()
        : domainSel.value;
    if (!id || !domain || domain === '__custom__') return '';
    return id + '@' + domain;
  }

  // ── 계좌 조립 ──
  function buildBank() {
    var name = document.getElementById('daBankName').value;
    var no = document.getElementById('daBankNo').value.trim();
    if (!name || !no) return '';
    return name + ' ' + no;
  }

  // ── 주소 조립 (zipcode + address 분리 반환) ──
  function buildAddress() {
    var zip = document.getElementById('daZip').value.trim();
    var a1 = document.getElementById('daAddr1').value.trim();
    var a2 = document.getElementById('daAddr2').value.trim();
    var full = [a1, a2].filter(Boolean).join(' ').trim();
    return { zipcode: zip || null, address: full || null };
  }

  // ════════════════════════════════════════════════════
  // 모달 열기/닫기
  // ════════════════════════════════════════════════════
  function openModal(payload) {
    injectModal();
    currentPayload = payload;

    document.getElementById('daApplyStepForm').style.display = 'block';
    document.getElementById('daApplyStepDone').style.display = 'none';
    document.getElementById('daApplyErr').textContent = '';

    var m = payload.monthlyPrice;
    var optBits = [];
    if (payload.selectedOptions) {
      for (var k in payload.selectedOptions) {
        if (Object.prototype.hasOwnProperty.call(payload.selectedOptions, k)) {
          var v = payload.selectedOptions[k];
          if (!v) continue;
          // 금액류(숫자/숫자문자열)는 요약에 표시하지 않음 (데이터엔 유지).
          // 월 요금은 별도로 "월 OOO원" 으로 이미 표기됨.
          if (typeof v === 'number') continue;
          if (
            typeof v === 'string' &&
            /^\d{1,3}(,\d{3})*$|^\d+$/.test(v.trim())
          )
            continue;
          optBits.push(esc(v));
        }
      }
    }
    document.getElementById('daApplyProd').innerHTML =
      '신청 상품: <b>' +
      esc(payload.productName || '-') +
      '</b>' +
      (m ? ' · 월 ' + won(m) : '') +
      (optBits.length ? ' · ' + optBits.join(' · ') : '');

    document.getElementById('daApplyOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var ov = document.getElementById('daApplyOverlay');
    if (ov) ov.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ════════════════════════════════════════════════════
  // 신청 시작
  // ════════════════════════════════════════════════════
  function apply(payload) {
    if (!payload || !payload.category || !payload.productId) {
      alert('상품 정보가 올바르지 않습니다.');
      return;
    }
    if (!isLoggedIn()) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      alert('회원가입 후 신청 가능합니다.');
      window.location.href = 'login.html';
      return;
    }
    openModal(payload);
  }

  // ════════════════════════════════════════════════════
  // 제출
  // ════════════════════════════════════════════════════
  function submitForm() {
    var errEl = document.getElementById('daApplyErr');
    errEl.textContent = '';

    var name = document.getElementById('daName').value.trim();
    var phone = document.getElementById('daPhone').value.trim();
    var email = buildEmail();
    var bank = buildBank();
    var addrObj = buildAddress();
    var memo = document.getElementById('daMemo').value.trim();
    var agreePrivacy = document.getElementById('daPrivacy').checked;
    var agreeWarning = document.getElementById('daWarning').checked;
    var agreeMarketing = document.getElementById('daMarketing').checked;
    var agreeEmailInfo = document.getElementById('daEmailInfo').checked;

    if (!name) {
      errEl.textContent = '신청자 이름을 입력해주세요.';
      return;
    }
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
      errEl.textContent = '올바른 휴대폰 번호를 입력해주세요.';
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent =
        '올바른 이메일을 입력해주세요. (아이디와 도메인 확인)';
      return;
    }
    if (!bank) {
      errEl.textContent = '은행을 선택하고 계좌번호를 입력해주세요.';
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

    var p = currentPayload;
    if (!p || !p.productId) {
      errEl.textContent = '상품 정보가 올바르지 않습니다. 다시 선택해주세요.';
      return;
    }

    var token = getToken();
    if (!token) {
      errEl.textContent = '로그인이 필요합니다.';
      return;
    }

    var monthly = p.monthlyPrice;
    if (monthly == null || isNaN(monthly) || Number(monthly) <= 0) {
      errEl.textContent =
        '이 상품은 월 요금이 설정되어 있지 않아 온라인 신청이 어렵습니다. 카카오 상담을 이용해주세요.';
      return;
    }

    var selectedOptions = {};
    if (p.selectedOptions) {
      for (var k in p.selectedOptions) {
        if (Object.prototype.hasOwnProperty.call(p.selectedOptions, k))
          selectedOptions[k] = p.selectedOptions[k];
      }
    }
    if (memo) selectedOptions.inquiry = memo;

    var body = {
      productId: p.productId,
      selectedOptions: selectedOptions,
      monthlyPrice: Number(monthly),
      applicantName: name,
      applicantPhone: phone,
      applicantEmail: email,
      bankAccount: bank,
      zipcode: addrObj.zipcode,
      address: addrObj.address,
      agreePrivacy: true,
      agreeMarketing: agreeMarketing,
      agreeEmailInfo: agreeEmailInfo,
    };

    var submitBtn = document.getElementById('daApplySubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '신청 중...';

    fetch(API_BASE + '/api/consultations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (b) {
          return { ok: r.ok, status: r.status, body: b };
        });
      })
      .then(function (res) {
        submitBtn.disabled = false;
        submitBtn.textContent = '상담 신청하기';

        var data = res.body && res.body.data ? res.body.data : null;
        var num = data ? data.consultationNumber : '';

        if (res.ok && num) {
          document.getElementById('daDoneNum').textContent = num;
          document.getElementById('daApplyStepForm').style.display = 'none';
          document.getElementById('daApplyStepDone').style.display = 'block';
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
        console.error('[DapickApplication] submit failed', e);
        submitBtn.disabled = false;
        submitBtn.textContent = '상담 신청하기';
        errEl.textContent =
          '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      });
  }

  // ════════════════════════════════════════════════════
  // 자동 복귀
  // ════════════════════════════════════════════════════
  function resumeIfPending() {
    if (!isLoggedIn()) return;
    var raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      var payload = JSON.parse(raw);
      sessionStorage.removeItem(STORAGE_KEY);
      openModal(payload);
    } catch (e) {
      console.warn('[DapickApplication] resumeIfPending 파싱 실패', e);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  return {
    apply: apply,
    resumeIfPending: resumeIfPending,
    isLoggedIn: isLoggedIn,
  };
})();
