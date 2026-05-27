// ════════════════════════════════════════════════════
// application.js — 다픽 신청 처리 통합 모듈 (공통 모달 버전)
// ────────────────────────────────────────────────────
// 5/27 통일 작업:
//   - 신청자정보 모달을 이 모듈이 동적 주입 (셋 다 같은 모달 공유)
//   - apply(payload) 호출 시 모달을 띄우고, 입력받아 POST /api/consultations
//   - rental.js의 submitApplication 검증/payload 로직을 그대로 이식
//
// 사용법 (각 페이지):
//   DapickApplication.apply({
//     category, productId, productName, brand,
//     selectedOptions, monthlyPrice
//   });
//
// 흐름:
//   [1] 비로그인 → sessionStorage 저장 → 로그인 페이지
//   [2] 로그인 → 신청자정보 모달 표시
//   [3] 제출 → POST /api/consultations → 완료 화면
//
// 백엔드 (5/27 확장 완료):
//   POST /api/consultations
//   body = { productId, selectedOptions, monthlyPrice,
//            applicantName, applicantPhone, applicantEmail,
//            bankAccount, zipcode, address,
//            agreePrivacy, agreeMarketing, agreeEmailInfo }
//   응답 = ApiResponse { data: { consultationNumber, ... } }
// ════════════════════════════════════════════════════

window.DapickApplication = (function () {
  'use strict';

  var STORAGE_KEY = 'dapick:pendingApplication';
  var TOKEN_KEY = 'dapick_token';
  var API_BASE =
    typeof BASE_URL !== 'undefined' && BASE_URL
      ? BASE_URL
      : typeof DAPICK_CONFIG !== 'undefined' && DAPICK_CONFIG.API_BASE_URL
        ? DAPICK_CONFIG.API_BASE_URL
        : 'https://api.dapick.co.kr';
  var KAKAO_CHAT_URL = 'https://pf.kakao.com/_exaRjX/chat';

  var currentPayload = null; // 현재 신청 대상
  var modalInjected = false;

  // ── 로그인 여부 ──────────────────────────────────────
  function isLoggedIn() {
    return !!localStorage.getItem(TOKEN_KEY);
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

  // ════════════════════════════════════════════════════
  // 모달 HTML/CSS 주입 (최초 1회)
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
      '.da-apply-head{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 12px;position:sticky;top:0;background:#fff;}',
      '.da-apply-title{font-size:18px;font-weight:700;color:#222;}',
      '.da-apply-close{border:none;background:none;font-size:20px;cursor:pointer;color:#888;}',
      '.da-apply-prod{margin:0 20px 16px;padding:12px 14px;background:#f5f4fb;border-radius:10px;font-size:13px;color:#555;line-height:1.5;}',
      '.da-apply-body{padding:0 20px 20px;}',
      '.da-field{margin-bottom:14px;}',
      '.da-field label{display:block;font-size:13px;font-weight:600;color:#444;margin-bottom:6px;}',
      '.da-field .req{color:#e8547a;margin-left:2px;}',
      '.da-field input,.da-field textarea{width:100%;padding:11px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;font-family:inherit;}',
      '.da-field textarea{resize:vertical;min-height:60px;}',
      '.da-agree{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;font-size:12.5px;color:#555;line-height:1.5;cursor:pointer;}',
      '.da-agree input{margin-top:2px;flex-shrink:0;}',
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
      '      <div class="da-field"><label>연락처<span class="req">*</span></label><input type="tel" id="daPhone" placeholder="010-1234-5678" autocomplete="tel"/></div>',
      '      <div class="da-field"><label>이메일<span class="req">*</span></label><input type="email" id="daEmail" placeholder="example@dapick.co.kr" autocomplete="email"/></div>',
      '      <div class="da-field"><label>지원금 입금받을 계좌<span class="req">*</span></label><input type="text" id="daBank" placeholder="은행명 + 계좌번호 (직접 입력)"/></div>',
      '      <div class="da-field"><label>주소</label><input type="text" id="daAddr" placeholder="설치 희망 주소 (선택)"/></div>',
      '      <div class="da-field"><label>문의사항</label><textarea id="daMemo" placeholder="궁금한 점이나 요청사항 (선택)"></textarea></div>',
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

    // 이벤트 바인딩
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
    document.getElementById('daApplyProd').innerHTML =
      '신청 상품: <b>' +
      esc(payload.productName || '-') +
      '</b>' +
      (m ? ' · 월 ' + won(m) : '');

    document.getElementById('daApplyOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var ov = document.getElementById('daApplyOverlay');
    if (ov) ov.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ════════════════════════════════════════════════════
  // 신청 시작 (페이지에서 호출)
  // ════════════════════════════════════════════════════
  function apply(payload) {
    if (!payload || !payload.category || !payload.productId) {
      alert('상품 정보가 올바르지 않습니다.');
      return;
    }

    // 비로그인 → 저장 후 로그인 페이지
    if (!isLoggedIn()) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      alert('회원가입 후 신청 가능합니다.');
      window.location.href = 'login.html';
      return;
    }

    // 로그인 → 모달 표시
    openModal(payload);
  }

  // ════════════════════════════════════════════════════
  // 제출 → POST /api/consultations
  // (rental.js submitApplication 로직 이식)
  // ════════════════════════════════════════════════════
  function submitForm() {
    var errEl = document.getElementById('daApplyErr');
    errEl.textContent = '';

    var name = document.getElementById('daName').value.trim();
    var phone = document.getElementById('daPhone').value.trim();
    var email = document.getElementById('daEmail').value.trim();
    var bank = document.getElementById('daBank').value.trim();
    var addr = document.getElementById('daAddr').value.trim();
    var memo = document.getElementById('daMemo').value.trim();
    var agreePrivacy = document.getElementById('daPrivacy').checked;
    var agreeWarning = document.getElementById('daWarning').checked;
    var agreeMarketing = document.getElementById('daMarketing').checked;
    var agreeEmailInfo = document.getElementById('daEmailInfo').checked;

    // 검증 (백엔드 DTO 규칙과 일치)
    if (!name) {
      errEl.textContent = '신청자 이름을 입력해주세요.';
      return;
    }
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
      errEl.textContent = '올바른 휴대폰 번호를 입력해주세요.';
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

    var p = currentPayload;
    if (!p || !p.productId) {
      errEl.textContent = '상품 정보가 올바르지 않습니다. 다시 선택해주세요.';
      return;
    }

    var token = localStorage.getItem(TOKEN_KEY);
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

    // selectedOptions: 페이지가 준 옵션 + 문의사항 병합
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
      zipcode: null,
      address: addr || null,
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
  // 자동 복귀 (로그인 후 페이지 진입 시)
  // ════════════════════════════════════════════════════
  function resumeIfPending() {
    if (!isLoggedIn()) return;
    var raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      var payload = JSON.parse(raw);
      sessionStorage.removeItem(STORAGE_KEY);
      openModal(payload); // 바로 제출하지 않고 모달 표시
    } catch (e) {
      console.warn('[DapickApplication] resumeIfPending 파싱 실패', e);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  // ════════════════════════════════════════════════════
  // 공개 API
  // ════════════════════════════════════════════════════
  return {
    apply: apply,
    resumeIfPending: resumeIfPending,
    isLoggedIn: isLoggedIn,
  };
})();
