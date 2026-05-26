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
        handleAfterLogin(role);
      }, 1000);
    }
  }
}

// after-login routing
function handleAfterLogin(role) {
  if (role === 'LV4_ADMIN') {
    window.location.href = 'https://admin.dapick.co.kr';
    return;
  }

  const pendingConsult = sessionStorage.getItem('pending_kakao_consult');
  if (pendingConsult) {
    const redirect =
      sessionStorage.getItem('redirect_after_login') || 'index.html';
    sessionStorage.removeItem('redirect_after_login');
    window.location.href = redirect;
    return;
  }

  window.location.href = 'index.html';
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
      handleAfterLogin(getRole());
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
    const data = await api.post('/api/auth/login', { email, password: pw });
    saveTokens(
      data.accessToken,
      data.refreshToken,
      data.role,
      data.nickname,
      data.status,
    );
    showToast('\uB85C\uADF8\uC778 \uC131\uACF5!', 'success');
    setTimeout(() => {
      handleAfterLogin(data.role);
    }, 700);
  } catch (e) {
    showEmailAlert(
      e.message ||
        '\uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.',
    );
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
  // 1) Handle Kakao callback params first.
  handleOAuthCallback();

  // 2) Re-entry guard: if the user lands on login.html (refresh,
  //    direct URL, or bounced here by the page guard) and is still
  //    PENDING_PROFILE, re-open the signup modal and lock again.
  //    This covers the "site closed mid-signup" case with no callback.
  const hasCallback = new URLSearchParams(window.location.search).get(
    'accessToken',
  );
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
