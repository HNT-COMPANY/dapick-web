// Kakao social login
async function socialLogin(provider) {
  if (provider === 'kakao') {
    try {
      const data = await api.get('/oauth2/kakao/url');
      window.location.href = data.url;
    } catch (e) {
      showToast(
        '\uCE74\uCE74\uC624 \uB85C\uADF8\uC778 \uC5F0\uACB0\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
        'error',
      );
    }
  } else {
    const names = { naver: '\uB124\uC774\uBC84', apple: 'Apple' };
    showToast(
      `${names[provider]} \uB85C\uADF8\uC778 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4. \uACE7 \uC624\uD508\uD574\uC694! \uD83D\uDE4F`,
      'info',
    );
  }
}

// kakao signup temp values
let _csNickname = '';
let _csAgreeMarketing = false;

// Pending lock flag - true while the user MUST complete signup.
// When true: modal cannot be escaped (back button blocked).
let _csPendingLock = false;

// Kakao OAuth callback handler
function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  const role = params.get('role');
  const nickname = params.get('nickname');
  const isNewUser = params.get('isNewUser') === 'true';
  const status = params.get('status');
  const error = params.get('error');

  if (error) {
    showToast(
      '\uCE74\uCE74\uC624 \uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.',
      'error',
    );
    window.history.replaceState({}, document.title, '/login.html');
    return;
  }

  if (accessToken && refreshToken) {
    // save tokens incl. status (PENDING_PROFILE user also needs accessToken)
    saveTokens(accessToken, refreshToken, role, nickname, status);
    window.history.replaceState({}, document.title, '/login.html');

    // Show signup modal when profile is incomplete (PENDING_PROFILE),
    // regardless of new/returning. Back-button re-login resumes the
    // existing PENDING account (prevents duplicate accounts).
    if (status === 'PENDING_PROFILE') {
      _csNickname = nickname || '';
      openAgreementModal();
    } else {
      showToast(
        `\uB2E4\uC2DC \uC624\uC168\uAD70\uC694, ${nickname || ''}\uB2D8! \uD83D\uDE0A`,
        'success',
      );
      setTimeout(() => {
        handleAfterLogin();
      }, 1000);
    }
  }
}

// after-login routing
// Design: everyone (LV1~LV5) stays on web after login. No forced admin
// redirect. Role no longer affects routing, so it's not a parameter.
function handleAfterLogin() {
  // 복귀 경로는 항상 본다.
  // 예전엔 pending_kakao_consult 가 있을 때만 읽어서, 후기·찜처럼
  // 상담이 아닌 로그인 유도는 저장을 해놔도 전부 홈으로 떨어졌다.
  // (카카오 상담 재개는 복귀한 페이지의 resumePendingKakaoConsult() 가 맡는다 —
  //  여기서 하던 일이 아니다)
  window.location.href = takeReturnUrl() || 'index.html';
}

// ============================================================
// PENDING LOCK - trap the user in the signup modal.
// No close button exists in the modal HTML, so we only need to
// block the browser back button while pending. Combined with the
// page guard in gnb-user.js (which bounces any other page back to
// login.html), the user cannot leave until signup completes.
// ============================================================
function engagePendingLock() {
  if (_csPendingLock) return;
  _csPendingLock = true;

  // Push a sentinel history entry so the first "back" lands here,
  // then re-push on every popstate to keep the user pinned.
  history.pushState({ csLock: true }, document.title, location.href);
  window.addEventListener('popstate', onPendingPopstate);
}

function onPendingPopstate() {
  if (!_csPendingLock) return;
  // Re-pin: undo the back navigation by pushing the sentinel again.
  history.pushState({ csLock: true }, document.title, location.href);
  csAlert(
    '\uAC00\uC785\uC744 \uC644\uB8CC\uD574\uC57C \uC11C\uBE44\uC2A4\uB97C \uC774\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
  );
}

function releasePendingLock() {
  _csPendingLock = false;
  window.removeEventListener('popstate', onPendingPopstate);
}

// 가입 취소 (A안): PENDING_PROFILE 계정 삭제 후 모달/락에서 탈출.
// 순서 중요 — API 호출 → releasePendingLock → clearTokens → 이동.
// (락을 먼저 풀지 않으면 popstate 리스너가 이동을 방해할 수 있음)
async function cancelSignup() {
  if (!confirm('가입을 취소하시겠어요? 입력한 정보는 저장되지 않습니다.')) return;
  try {
    await api.delete('/api/auth/cancel-signup'); // 기존 공통 래퍼 재사용
  } catch (e) {
    // 서버에서 이미 지워졌거나 실패해도 클라이언트는 탈출시킨다(안 그러면 또 갇힘)
    console.warn('[cancelSignup] API failed:', e.message);
  }
  releasePendingLock(); // 기존 함수 — 락 해제
  clearTokens(); // 기존 함수 — 토큰 정리(페이지 가드 무력화)
  location.href = 'index.html';
}

// ============================================================
// [Step 1] agreement modal
// ============================================================
function openAgreementModal() {
  engagePendingLock(); // lock as soon as the signup flow starts

  const overlay = document.getElementById('ag-modal-overlay');
  if (!overlay) {
    console.error(
      '[agreement] modal DOM missing -> fallback to complete-signup modal',
    );
    openCompleteSignupModal();
    return;
  }
  ['ag-all', 'ag-terms', 'ag-privacy', 'ag-marketing'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  agHideAlert();
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function agToggleAll(master) {
  const checked = master.checked;
  ['ag-terms', 'ag-privacy', 'ag-marketing'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  });
  agHideAlert();
}

function agSyncAll() {
  const t = document.getElementById('ag-terms')?.checked;
  const p = document.getElementById('ag-privacy')?.checked;
  const m = document.getElementById('ag-marketing')?.checked;
  const all = document.getElementById('ag-all');
  if (all) all.checked = t && p && m;
  agHideAlert();
}

function agSubmit() {
  const terms = document.getElementById('ag-terms')?.checked;
  const privacy = document.getElementById('ag-privacy')?.checked;
  const marketing = document.getElementById('ag-marketing')?.checked;

  if (!terms || !privacy) {
    agAlert(
      '\uD544\uC218 \uC57D\uAD00(\uC774\uC6A9\uC57D\uAD00\u00B7\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68)\uC5D0 \uB3D9\uC758\uD574\uC8FC\uC138\uC694.',
    );
    return;
  }

  _csAgreeMarketing = !!marketing;

  const overlay = document.getElementById('ag-modal-overlay');
  if (overlay) overlay.classList.remove('show');
  openCompleteSignupModal();
}

function agAlert(msg) {
  const el = document.getElementById('ag-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = 'alert-banner show error';
}
function agHideAlert() {
  const el = document.getElementById('ag-alert');
  if (el) el.classList.remove('show');
}

// ============================================================
// [Step 2] complete-signup modal (PENDING_PROFILE -> ACTIVE)
// ============================================================
let _csSmsSent = false;
let _csSmsVerified = false;
let _csSmsTimer = null;
let _csSmsRemain = 180;

function openCompleteSignupModal() {
  engagePendingLock(); // ensure lock even if this modal is entered directly

  const overlay = document.getElementById('cs-modal-overlay');
  if (!overlay) {
    console.error('[completeSignup] modal DOM missing');
    return;
  }
  const greet = document.getElementById('cs-greeting');
  if (greet) {
    greet.textContent = _csNickname
      ? `${_csNickname}\uB2D8, \uAC00\uC785\uC744 \uC704\uD574 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694`
      : '\uAC00\uC785\uC744 \uC704\uD574 \uC815\uBCF4\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694';
  }

  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

// phone auto-format (010-XXXX-XXXX)
function csFormatPhone(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 7) {
    v = v.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
  } else if (v.length > 3) {
    v = v.replace(/(\d{3})(\d+)/, '$1-$2');
  }
  input.value = v;
}

// daum postcode search
function csOpenPostcode() {
  if (typeof daum === 'undefined' || !daum.Postcode) {
    csAlert(
      '\uC8FC\uC18C \uAC80\uC0C9 \uC11C\uBE44\uC2A4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.',
    );
    return;
  }
  new daum.Postcode({
    oncomplete: function (data) {
      const base =
        data.roadAddress && data.roadAddress.trim()
          ? data.roadAddress
          : data.jibunAddress;
      const zEl = document.getElementById('cs-zonecode');
      const a1El = document.getElementById('cs-address1');
      const a2El = document.getElementById('cs-address2');
      if (zEl) zEl.value = data.zonecode || '';
      if (a1El) {
        a1El.value = base || '';
        a1El.classList.remove('err');
      }
      if (a2El) a2El.focus();
      csHideAlert();
    },
  }).open();
}

function csBuildAddress() {
  const a1 = (document.getElementById('cs-address1')?.value || '').trim();
  const a2 = (document.getElementById('cs-address2')?.value || '').trim();
  if (!a1) return '';
  return a2 ? `${a1} (${a2})` : a1;
}

// send SMS verification code
async function csSendSms() {
  const phoneEl = document.getElementById('cs-phone');
  const phone = phoneEl.value.trim();
  if (!/^010-\d{4}-\d{4}$/.test(phone)) {
    csAlert(
      '\uC804\uD654\uBC88\uD638 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. (010-XXXX-XXXX)',
    );
    phoneEl.classList.add('err');
    return;
  }

  csSetBtnLoading('cs-btn-sms', true);
  try {
    await api.post('/api/auth/sms/send', { phone });
    _csSmsSent = true;
    _csSmsVerified = false;
    csAlert(
      '\uC778\uC99D\uBC88\uD638\uAC00 \uBC1C\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uBB38\uC790\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.',
      'success',
    );

    const okEl = document.getElementById('cs-sms-verified');
    if (okEl) okEl.style.display = 'none';
    const codeEl = document.getElementById('cs-smscode');
    if (codeEl) {
      codeEl.readOnly = false;
      codeEl.value = '';
    }
    const verifyBtn = document.getElementById('cs-btn-verify');
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = '\uD655\uC778';
    }
    const submitBtn = document.getElementById('cs-btn-submit');
    if (submitBtn) submitBtn.disabled = true;

    const codeGroup = document.getElementById('cs-sms-group');
    if (codeGroup) codeGroup.style.display = '';
    csStartSmsTimer();

    setTimeout(() => {
      const c = document.getElementById('cs-smscode');
      if (c) c.focus();
    }, 200);
  } catch (e) {
    csAlert(
      e.message ||
        'SMS \uBC1C\uC1A1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.',
    );
  } finally {
    csSetBtnLoading('cs-btn-sms', false);
  }
}

// verify SMS code ("verify" button -> /sms/verify = peek, does NOT consume)
async function csVerifySms() {
  const phone = document.getElementById('cs-phone').value.trim();
  const code = document.getElementById('cs-smscode').value.trim();

  if (!_csSmsSent) {
    csAlert(
      '\uC778\uC99D\uBC88\uD638\uB97C \uBA3C\uC800 \uBC1B\uC544\uC8FC\uC138\uC694.',
    );
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    csAlert(
      '\uC778\uC99D\uBC88\uD638 6\uC790\uB9AC\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.',
    );
    document.getElementById('cs-smscode').classList.add('err');
    return;
  }

  csSetBtnLoading('cs-btn-verify', true);
  try {
    await api.post('/api/auth/sms/verify', { phone, code });

    _csSmsVerified = true;

    const okEl = document.getElementById('cs-sms-verified');
    if (okEl) okEl.style.display = '';

    const codeEl = document.getElementById('cs-smscode');
    const verifyBtn = document.getElementById('cs-btn-verify');
    if (codeEl) codeEl.readOnly = true;
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '\uC778\uC99D\uC644\uB8CC';
    }

    if (_csSmsTimer) {
      clearInterval(_csSmsTimer);
      _csSmsTimer = null;
    }

    const submitBtn = document.getElementById('cs-btn-submit');
    if (submitBtn) submitBtn.disabled = false;

    csAlert(
      '\uC778\uC99D\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
      'success',
    );
  } catch (e) {
    _csSmsVerified = false;
    csAlert(
      e.message ||
        '\uC778\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC778\uC99D\uBC88\uD638\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.',
    );
    document.getElementById('cs-smscode').classList.add('err');
  } finally {
    if (!_csSmsVerified) csSetBtnLoading('cs-btn-verify', false);
  }
}

function csStartSmsTimer() {
  _csSmsRemain = 180;
  csUpdateSmsTimer();
  if (_csSmsTimer) clearInterval(_csSmsTimer);
  _csSmsTimer = setInterval(() => {
    _csSmsRemain--;
    csUpdateSmsTimer();
    if (_csSmsRemain <= 0) {
      clearInterval(_csSmsTimer);
      _csSmsTimer = null;
      csAlert(
        '\uC778\uC99D\uBC88\uD638\uAC00 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uBC1C\uC1A1\uD574\uC8FC\uC138\uC694.',
      );
    }
  }, 1000);
}

function csUpdateSmsTimer() {
  const mm = String(Math.floor(_csSmsRemain / 60)).padStart(2, '0');
  const ss = String(_csSmsRemain % 60).padStart(2, '0');
  const el = document.getElementById('cs-sms-timer');
  if (el) el.textContent = `${mm}:${ss}`;
}

// submit complete-signup
async function csSubmit() {
  const name = document.getElementById('cs-name').value.trim();
  const phone = document.getElementById('cs-phone').value.trim();
  const smsCode = document.getElementById('cs-smscode').value.trim();
  const address = csBuildAddress();

  if (!name || name.length < 2 || name.length > 10) {
    csAlert(
      '\uC774\uB984\uC740 2~10\uC790 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4.',
    );
    document.getElementById('cs-name').classList.add('err');
    return;
  }
  if (!/^010-\d{4}-\d{4}$/.test(phone)) {
    csAlert(
      '\uC804\uD654\uBC88\uD638 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. (010-XXXX-XXXX)',
    );
    document.getElementById('cs-phone').classList.add('err');
    return;
  }
  if (!_csSmsSent) {
    csAlert(
      '\uD734\uB300\uD3F0 \uC778\uC99D\uC744 \uBA3C\uC800 \uC9C4\uD589\uD574\uC8FC\uC138\uC694.',
    );
    return;
  }
  if (!/^\d{6}$/.test(smsCode)) {
    csAlert(
      '\uC778\uC99D\uBC88\uD638 6\uC790\uB9AC\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.',
    );
    document.getElementById('cs-smscode').classList.add('err');
    return;
  }
  if (!_csSmsVerified) {
    csAlert(
      '\uC778\uC99D\uBC88\uD638 "\uD655\uC778" \uBC84\uD2BC\uC744 \uB20C\uB7EC \uC778\uC99D\uC744 \uC644\uB8CC\uD574\uC8FC\uC138\uC694.',
    );
    return;
  }
  if (!address) {
    csAlert(
      '\uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694. (\uC8FC\uC18C \uAC80\uC0C9 \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694)',
    );
    document.getElementById('cs-address1').classList.add('err');
    return;
  }
  if (address.length > 500) {
    csAlert(
      '\uC8FC\uC18C\uAC00 \uB108\uBB34 \uAE41\uB2C8\uB2E4. (\uC0C1\uC138\uC8FC\uC18C\uB97C \uC904\uC5EC\uC8FC\uC138\uC694)',
    );
    document.getElementById('cs-address2').classList.add('err');
    return;
  }

  csSetBtnLoading('cs-btn-submit', true);
  try {
    // PATCH /api/auth/complete-signup
    // backend uses consumeCode for final SMS code consumption
    await api.patch('/api/auth/complete-signup', {
      name,
      phone,
      address,
      smsCode,
      agreeMarketing: _csAgreeMarketing,
    });

    if (_csSmsTimer) clearInterval(_csSmsTimer);

    // Signup complete -> mark ACTIVE and release the pending lock,
    // so the guard / back-button block no longer apply.
    if (typeof markActive === 'function') markActive();
    releasePendingLock();

    showToast(
      '\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4! \uD658\uC601\uD574\uC694 \uD83C\uDF89',
      'success',
    );

    const overlay = document.getElementById('cs-modal-overlay');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';

    setTimeout(() => {
      handleAfterLogin();
    }, 900);
  } catch (e) {
    csAlert(
      e.message ||
        '\uAC00\uC785 \uC644\uB8CC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC785\uB825 \uC815\uBCF4\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.',
    );
    csSetBtnLoading('cs-btn-submit', false);
  }
}

// modal helpers
function csAlert(msg, type = 'error') {
  const el = document.getElementById('cs-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert-banner show ${type}`;
  if (type === 'success') setTimeout(() => el.classList.remove('show'), 3000);
}
function csHideAlert() {
  const el = document.getElementById('cs-alert');
  if (el) el.classList.remove('show');
}
function csSetBtnLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  if (btn) btn.disabled = on;
}

// email panel toggle
let emailOpen = false;

function toggleEmail(e) {
  e.preventDefault();
  emailOpen = !emailOpen;
  document.getElementById('email-panel').classList.toggle('open', emailOpen);
  document.getElementById('email-toggle').textContent = emailOpen
    ? '\uC774\uBA54\uC77C \uB85C\uADF8\uC778 \uB2EB\uAE30'
    : '\uC774\uBA54\uC77C\uB85C \uB85C\uADF8\uC778';
  if (emailOpen) {
    setTimeout(() => document.getElementById('input-email').focus(), 350);
  }
}

// ============================================================
// auth panel routing (login <-> find-id <-> reset-pw)
// 기존 패널 show/hide 패턴과 동일하게 단순 표시 전환.
// 입력 검증/실제 API 호출/단계 전환은 W4에서 채운다.
// ============================================================
function showAuthPanel(name) {
  const views = {
    default: document.getElementById('auth-default'),
    'find-id': document.getElementById('find-id-panel'),
    'reset-pw': document.getElementById('reset-pw-panel'),
  };
  if (!views.default || !views['find-id'] || !views['reset-pw']) return;

  Object.keys(views).forEach((key) => {
    views[key].hidden = key !== name;
  });

  // 패널 전환 시 이전 알림 잔상 제거
  ['email-alert', 'find-id-alert', 'reset-alert'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  });

  // 비밀번호 찾기 패널 진입 시 1단계부터 깨끗하게 시작
  if (name === 'reset-pw' && typeof resetPwToStep1 === 'function') {
    resetPwToStep1(false);
  }
}

// ============================================================
// 비밀번호 찾기 3단계 (send-code -> verify-code -> confirm)
// 모든 호출은 미로그인 상태 → {skipAuthRefresh:true} (W2 옵션) 필수.
// resetToken 은 메모리 변수로만 보관(localStorage 저장 금지 — 단기 토큰).
// ============================================================
let _resetEmail = '';
let _resetToken = '';
let _resetRemain = 300;
let _resetTimer = null;

// ※ 백엔드 PasswordPolicy.REGEX 와 동일하게 유지할 것.
//    (프론트는 UX 즉시안내용, 최종 검증은 백엔드. 하드코딩 중복이므로 동기화 필요)
const RESET_PW_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d~!@#$%^&*()_+\-=.,]{8,64}$/;
const RESET_PW_MSG = '비밀번호는 8~64자, 영문과 숫자를 포함해야 합니다.';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function showResetAlert(msg, type = 'error') {
  const el = document.getElementById('reset-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert-banner show ${type}`;
  if (type === 'success') setTimeout(() => el.classList.remove('show'), 3000);
}

function setResetBtnLoading(btnId, textId, spinnerId, on) {
  const btn = document.getElementById(btnId);
  const txt = document.getElementById(textId);
  const spn = document.getElementById(spinnerId);
  if (btn) btn.disabled = on;
  if (txt) txt.style.visibility = on ? 'hidden' : 'visible';
  if (spn) spn.style.display = on ? 'block' : 'none';
}

function showResetStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('reset-step-' + i);
    if (el) el.hidden = i !== n;
  }
}

// 1단계로 되돌리기. keepEmail=true 면 이메일은 보존(만료/초과 후 재시도 편의).
function resetPwToStep1(keepEmail) {
  _resetToken = '';
  stopResetTimer();
  ['reset-code', 'reset-newpw', 'reset-newpw2'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (!keepEmail) {
    _resetEmail = '';
    const e = document.getElementById('reset-email');
    if (e) e.value = '';
  }
  showResetStep(1);
}

// ── 코드 타이머 (5분) — signup.js 패턴 참고 ──────────────────────
function startResetTimer() {
  _resetRemain = 300;
  updateResetTimer();
  stopResetTimer();
  _resetTimer = setInterval(() => {
    _resetRemain--;
    updateResetTimer();
    if (_resetRemain <= 0) {
      stopResetTimer();
      showResetAlert('인증코드가 만료되었습니다. 재발송 버튼을 눌러주세요.');
    }
  }, 1000);
}
function stopResetTimer() {
  if (_resetTimer) {
    clearInterval(_resetTimer);
    _resetTimer = null;
  }
}
function updateResetTimer() {
  const mm = String(Math.floor(_resetRemain / 60)).padStart(2, '0');
  const ss = String(_resetRemain % 60).padStart(2, '0');
  const el = document.getElementById('reset-timer');
  if (el) el.textContent = `${mm}:${ss}`;
}

// ── [1단계] 인증코드 발송 ────────────────────────────────────────
async function handleResetSend() {
  const emailEl = document.getElementById('reset-email');
  const email = (emailEl?.value || '').trim();
  if (!EMAIL_REGEX.test(email)) {
    showResetAlert('올바른 이메일 형식을 입력해주세요.');
    if (emailEl) emailEl.classList.add('err');
    return;
  }

  setResetBtnLoading('btn-reset-send', 'reset-send-text', 'reset-send-spinner', true);
  try {
    // 계정 존재 여부 비노출: 백엔드는 항상 200 → 성공 처리 통일
    await api.post(
      '/api/auth/password/reset/send-code',
      { email },
      { skipAuthRefresh: true },
    );
    _resetEmail = email;
    showResetStep(2);
    startResetTimer();
    showResetAlert(
      "입력하신 이메일로 가입된 계정이 있다면 인증코드를 보냈습니다. 메일이 오지 않으면 스팸함을 확인하거나, 가입한 이메일이 맞는지 '아이디 찾기'로 확인해주세요.",
      'success',
    );
    setTimeout(() => document.getElementById('reset-code')?.focus(), 200);
  } catch (e) {
    showResetAlert(e.message || '인증코드 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    setResetBtnLoading('btn-reset-send', 'reset-send-text', 'reset-send-spinner', false);
  }
}

// ── [2단계] 인증코드 검증 → resetToken 발급 ──────────────────────
async function handleResetVerify() {
  const codeEl = document.getElementById('reset-code');
  const code = (codeEl?.value || '').trim();
  if (!/^\d{6}$/.test(code)) {
    showResetAlert('인증코드 6자리를 입력해주세요.');
    if (codeEl) codeEl.classList.add('err');
    return;
  }

  setResetBtnLoading('btn-reset-verify', 'reset-verify-text', 'reset-verify-spinner', true);
  try {
    const data = await api.post(
      '/api/auth/password/reset/verify-code',
      { email: _resetEmail, code },
      { skipAuthRefresh: true },
    );
    const token = data?.resetToken;
    if (!token) throw new Error('인증에 실패했습니다. 다시 시도해주세요.');

    _resetToken = token;
    stopResetTimer();
    showResetStep(3);
    showResetAlert('인증되었습니다. 새 비밀번호를 설정해주세요.', 'success');
    setTimeout(() => document.getElementById('reset-newpw')?.focus(), 200);
  } catch (e) {
    const msg = e.message || '인증에 실패했습니다.';
    // 만료(EM002)/시도초과(PR004) → 1단계로 돌려 재발송 유도(이메일은 보존)
    if (e.status === 400 && (msg.includes('만료') || msg.includes('초과') || msg.includes('횟수'))) {
      resetPwToStep1(true);
      showResetAlert(msg + ' 처음부터 다시 진행해주세요.');
    } else {
      // 코드 틀림(EM001) 등 → 2단계 유지하고 재입력
      showResetAlert(msg);
      if (codeEl) codeEl.classList.add('err');
    }
  } finally {
    setResetBtnLoading('btn-reset-verify', 'reset-verify-text', 'reset-verify-spinner', false);
  }
}

// ── [3단계] 새 비밀번호 확정 ─────────────────────────────────────
async function handleResetConfirm() {
  const pwEl = document.getElementById('reset-newpw');
  const pw2El = document.getElementById('reset-newpw2');
  const pw = pwEl?.value || '';
  const pw2 = pw2El?.value || '';

  if (!RESET_PW_REGEX.test(pw)) {
    showResetAlert(RESET_PW_MSG);
    if (pwEl) pwEl.classList.add('err');
    return;
  }
  if (pw !== pw2) {
    showResetAlert('비밀번호가 일치하지 않습니다.');
    if (pw2El) pw2El.classList.add('err');
    return;
  }
  if (!_resetToken) {
    resetPwToStep1(true);
    showResetAlert('인증이 만료되었습니다. 처음부터 다시 진행해주세요.');
    return;
  }

  setResetBtnLoading('btn-reset-confirm', 'reset-confirm-text', 'reset-confirm-spinner', true);
  try {
    await api.post(
      '/api/auth/password/reset/confirm',
      { resetToken: _resetToken, newPassword: pw },
      { skipAuthRefresh: true },
    );
    const em = _resetEmail;
    _resetToken = '';
    _resetEmail = '';
    showToast('비밀번호가 변경되었습니다. 다시 로그인해주세요.', 'success');
    showAuthPanel('default');
    // 편의: 이메일 자동 채우고 이메일 로그인 패널 열기
    const ie = document.getElementById('input-email');
    if (ie && em) ie.value = em;
    const ep = document.getElementById('email-panel');
    if (ep && !ep.classList.contains('open')) {
      ep.classList.add('open');
      emailOpen = true;
      const tg = document.getElementById('email-toggle');
      if (tg) tg.textContent = '이메일 로그인 닫기';
    }
  } catch (e) {
    // 토큰 무효/만료(401 PR001/PR002) 또는 이미 사용됨(400 PR003) → 처음부터
    if (e.status === 401 || e.status === 400) {
      resetPwToStep1(true);
      showResetAlert('인증이 만료되었습니다. 처음부터 다시 진행해주세요.');
    } else {
      showResetAlert(e.message || '비밀번호 변경에 실패했습니다.');
    }
  } finally {
    setResetBtnLoading('btn-reset-confirm', 'reset-confirm-text', 'reset-confirm-spinner', false);
  }
}

// ============================================================
// 아이디(이메일) 찾기 — 이름 + 전화 동시 일치 시 마스킹 이메일 표시.
// 공개 엔드포인트 → {skipAuthRefresh:true}. 전화는 csFormatPhone(재사용)으로
// 입력 중 자동 포맷되며, 백엔드가 숫자만 추출해 정규화한다.
// ============================================================
function showFindIdAlert(msg, type = 'error') {
  const el = document.getElementById('find-id-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert-banner show ${type}`;
}

async function handleFindId() {
  const nameEl = document.getElementById('find-name');
  const phoneEl = document.getElementById('find-phone');
  const realName = (nameEl?.value || '').trim();
  const phone = (phoneEl?.value || '').trim();

  // 이전 결과/알림 초기화
  const result = document.getElementById('find-id-result');
  if (result) {
    result.hidden = true;
    result.textContent = '';
  }
  document.getElementById('find-id-alert')?.classList.remove('show');

  if (!realName) {
    showFindIdAlert('이름을 입력해주세요.');
    nameEl?.classList.add('err');
    return;
  }
  if (!phone) {
    showFindIdAlert('휴대폰 번호를 입력해주세요.');
    phoneEl?.classList.add('err');
    return;
  }

  setResetBtnLoading('btn-find-id', 'find-id-btn-text', 'find-id-spinner', true);
  try {
    const data = await api.post(
      '/api/auth/find-id',
      { realName, phone },
      { skipAuthRefresh: true },
    );
    const masked = data?.maskedEmail;
    if (!masked) throw new Error('일치하는 계정이 없습니다.');

    if (result) {
      // 백엔드가 이미 마스킹해서 줌 → 추가 가공 없이 표시만 (textContent 안전 삽입)
      result.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'find-id-result-text';
      p.appendChild(document.createTextNode('회원님의 이메일은 '));
      const strong = document.createElement('strong');
      strong.textContent = masked;
      p.appendChild(strong);
      p.appendChild(document.createTextNode(' 입니다.'));

      const go = document.createElement('a');
      go.href = '#';
      go.className = 'find-id-go-login';
      go.textContent = '로그인하러 가기';
      go.onclick = function () {
        showAuthPanel('default');
        const ep = document.getElementById('email-panel');
        if (ep && !ep.classList.contains('open')) {
          ep.classList.add('open');
          emailOpen = true;
          const tg = document.getElementById('email-toggle');
          if (tg) tg.textContent = '이메일 로그인 닫기';
        }
        return false;
      };

      result.appendChild(p);
      result.appendChild(go);
      result.hidden = false;
    }
  } catch (e) {
    if (e.status === 404) {
      showFindIdAlert('일치하는 계정이 없습니다. 이름과 휴대폰 번호를 확인해주세요.');
    } else {
      showFindIdAlert(e.message || '아이디 찾기에 실패했습니다.');
    }
  } finally {
    setResetBtnLoading('btn-find-id', 'find-id-btn-text', 'find-id-spinner', false);
  }
}

// email login submit
async function submitEmailLogin() {
  const email = document.getElementById('input-email').value.trim();
  const pw = document.getElementById('input-pw').value;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('input-email').classList.add('err');
    showEmailAlert(
      '\uC62C\uBC14\uB978 \uC774\uBA54\uC77C \uD615\uC2DD\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.',
    );
    return;
  }
  if (!pw) {
    document.getElementById('input-pw').classList.add('err');
    showEmailAlert(
      '\uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.',
    );
    return;
  }

  setEmailLoading(true);
  hideEmailAlert();

  try {
    // skipAuthRefresh: \uB85C\uADF8\uC778 401(\uC790\uACA9\uC99D\uBA85 \uBD88\uC77C\uCE58)\uC744 silentRefresh \uAC00 \uAC00\uB85C\uCC44\uC9C0
    // \uBABB\uD558\uAC8C \uD558\uC5EC, \uC5D0\uB7EC \uBA54\uC2DC\uC9C0\uAC00 \uD654\uBA74\uC5D0 \uC815\uC0C1 \uD45C\uC2DC\uB418\uB3C4\uB85D \uD55C\uB2E4.
    const data = await api.post(
      '/api/auth/login',
      { email, password: pw },
      { skipAuthRefresh: true },
    );
    saveTokens(
      data.accessToken,
      data.refreshToken,
      data.role,
      data.nickname,
      data.status,
    );
    showToast('\uB85C\uADF8\uC778 \uC131\uACF5!', 'success');
    setTimeout(() => {
      handleAfterLogin();
    }, 700);
  } catch (e) {
    // 401(\uC790\uACA9\uC99D\uBA85 \uBD88\uC77C\uCE58) \u2192 web/admin \uACF5\uD1B5 \uACE0\uC815 \uBB38\uAD6C.
    // \uADF8 \uC678(403 \uBE44\uD65C\uC131 \uACC4\uC815 \uB4F1) \u2192 \uBC31\uC5D4\uB4DC \uBA54\uC2DC\uC9C0 \uC720\uC9C0.
    if (e.status === 401) {
      showEmailAlert(
        '\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
      );
    } else {
      showEmailAlert(
        e.message ||
          '\uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.',
      );
    }
  } finally {
    setEmailLoading(false);
  }
}

function setEmailLoading(on) {
  document.getElementById('btn-email-submit').disabled = on;
  document.getElementById('email-btn-text').style.display = on
    ? 'none'
    : 'block';
  document.getElementById('email-spinner').style.display = on
    ? 'block'
    : 'none';
}

function showEmailAlert(msg) {
  const el = document.getElementById('email-alert');
  el.textContent = msg;
  el.className = 'alert-banner show error';
}
function hideEmailAlert() {
  document.getElementById('email-alert').classList.remove('show');
}

// init
document.addEventListener('DOMContentLoaded', () => {
  // 0) 콜백 파라미터는 handleOAuthCallback() 이 replaceState 로 지운다.
  //    지우기 전에 미리 읽어두지 않으면 아래 3) 재진입 가드가
  //    '콜백이 아니다 + 이미 로그인됨' 으로 오판해서, 카카오 로그인을
  //    항상 index.html 로 튀겨버렸다(1초 뒤 예정된 handleAfterLogin 보다 빠르다).
  const hasCallback = new URLSearchParams(window.location.search).get(
    'accessToken',
  );

  // 1) Handle Kakao callback params first.
  handleOAuthCallback();

  // 2) Re-entry guard: if the user lands on login.html (refresh,
  //    direct URL, or bounced here by the page guard) and is still
  //    PENDING_PROFILE, re-open the signup modal and lock again.
  //    This covers the "site closed mid-signup" case with no callback.
  if (!hasCallback && typeof isPending === 'function' && isPending()) {
    _csNickname = localStorage.getItem('dapick_nick') || '';
    openAgreementModal();
  }

  // 3) If already logged in AND not pending, leave login.html.
  const agOpen = document
    .getElementById('ag-modal-overlay')
    ?.classList.contains('show');
  const csOpen = document
    .getElementById('cs-modal-overlay')
    ?.classList.contains('show');
  if (!hasCallback && !agOpen && !csOpen && isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  // 4) clear error style on input
  document.querySelectorAll('.form-input').forEach((el) => {
    el.addEventListener('input', function () {
      this.classList.remove('err');
      hideEmailAlert();
      csHideAlert();
    });
  });

  // 5) phone auto-format
  const csPhone = document.getElementById('cs-phone');
  if (csPhone) {
    csPhone.addEventListener('input', () => csFormatPhone(csPhone));
  }

  // 6) reset verification when code input changes
  const csCode = document.getElementById('cs-smscode');
  if (csCode) {
    csCode.addEventListener('input', () => {
      if (_csSmsVerified) {
        _csSmsVerified = false;
        const okEl = document.getElementById('cs-sms-verified');
        if (okEl) okEl.style.display = 'none';
        const submitBtn = document.getElementById('cs-btn-submit');
        if (submitBtn) submitBtn.disabled = true;
      }
    });
  }
});
