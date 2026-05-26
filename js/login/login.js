// ── 카카오 소셜 로그인 ────────────────────────────────────────────
async function socialLogin(provider) {
  if (provider === 'kakao') {
    try {
      const data = await api.get('/oauth2/kakao/url');
      window.location.href = data.url;
    } catch (e) {
      showToast('카카오 로그인 연결에 실패했습니다.', 'error');
    }
  } else {
    const names = { naver: '네이버', apple: 'Apple' };
    showToast(
      `${names[provider]} 로그인 준비 중입니다. 곧 오픈해요! 🙏`,
      'info',
    );
  }
}

// ── 카카오 가입 진행 중 보관 값 ──────────────────────────────────
let _csNickname = '';
let _csAgreeMarketing = false;

// ── 카카오 OAuth 콜백 처리 ───────────────────────────────────────
function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  const role = params.get('role');
  const nickname = params.get('nickname');
  const isNewUser = params.get('isNewUser') === 'true';
  const status = params.get('status');
  const error = params.get('error');

  // 에러 처리
  if (error) {
    showToast('카카오 로그인에 실패했습니다. 다시 시도해주세요.', 'error');
    window.history.replaceState({}, document.title, '/login.html');
    return;
  }

  // 로그인 성공
  if (accessToken && refreshToken) {
    // 토큰 저장 (신규/기존 공통 — 신규 유저는 PENDING_PROFILE이지만
    // complete-signup 호출에 이 accessToken이 필요하므로 저장한다)
    saveTokens(accessToken, refreshToken, role, nickname);

    // URL 파라미터 제거
    window.history.replaceState({}, document.title, '/login.html');

    if (status === 'PENDING_PROFILE') {
      // ── 신규 카카오 회원 → [1단계] 약관 동의 모달 ──
      // 동의 완료 시 [2단계] 추가정보 모달로 이어짐.
      _csNickname = nickname || '';
      openAgreementModal();
    } else {
      showToast(`다시 오셨군요, ${nickname || ''}님! 😊`, 'success');
      setTimeout(() => {
        handleAfterLogin(role);
      }, 1000);
    }
  }
}

// ── 로그인 성공 후 처리 (공통) ───────────────────────────────────
function handleAfterLogin(role) {
  // 1. 어드민이면 어드민 페이지로
  if (role === 'LV4_ADMIN') {
    window.location.href = 'https://admin.dapick.co.kr';
    return;
  }

  // 2. pending 카카오 상담 있으면 처리
  const pendingConsult = sessionStorage.getItem('pending_kakao_consult');
  if (pendingConsult) {
    const redirect =
      sessionStorage.getItem('redirect_after_login') || 'index.html';
    sessionStorage.removeItem('redirect_after_login');
    window.location.href = redirect;
    return;
  }

  // 3. 그냥 홈으로
  window.location.href = 'index.html';
}

// ════════════════════════════════════════════════════════════════
// [1단계] 약관 동의 모달
//   필수: 이용약관, 개인정보처리방침 / 선택: 마케팅
//   필수 약관(이용약관/개인정보)은 백엔드 createNewUser에서 이미 true.
//   여기선 사용자 동의를 받는 절차 + 마케팅 동의값만 백엔드로 전달.
// ════════════════════════════════════════════════════════════════
function openAgreementModal() {
  const overlay = document.getElementById('ag-modal-overlay');
  if (!overlay) {
    // 동의 모달 DOM 없으면 폴백 — 바로 추가정보 모달로
    console.error('[agreement] 모달 DOM 없음 → 추가정보 모달로 폴백');
    openCompleteSignupModal();
    return;
  }
  // 초기화
  ['ag-all', 'ag-terms', 'ag-privacy', 'ag-marketing'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  agHideAlert();
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

// 전체 동의 토글
function agToggleAll(master) {
  const checked = master.checked;
  ['ag-terms', 'ag-privacy', 'ag-marketing'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  });
  agHideAlert();
}

// 개별 체크 → 전체동의 체크 동기화
function agSyncAll() {
  const t = document.getElementById('ag-terms')?.checked;
  const p = document.getElementById('ag-privacy')?.checked;
  const m = document.getElementById('ag-marketing')?.checked;
  const all = document.getElementById('ag-all');
  if (all) all.checked = t && p && m;
  agHideAlert();
}

// 동의 완료 → 추가정보 모달로
function agSubmit() {
  const terms = document.getElementById('ag-terms')?.checked;
  const privacy = document.getElementById('ag-privacy')?.checked;
  const marketing = document.getElementById('ag-marketing')?.checked;

  if (!terms || !privacy) {
    agAlert('필수 약관(이용약관·개인정보처리방침)에 동의해주세요.');
    return;
  }

  // 마케팅 동의값 보관 (추가정보 제출 시 함께 전송)
  _csAgreeMarketing = !!marketing;

  // 동의 모달 닫고 → 추가정보 모달 오픈
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

// ════════════════════════════════════════════════════════════════
// [2단계] 카카오 추가정보 입력 모달 (PENDING_PROFILE → ACTIVE)
// 입력: 이름 / 전화번호 + SMS 인증 / 주소(다음 우편번호)
// 제출: PATCH /api/auth/complete-signup
//        { name, phone, address, smsCode, agreeMarketing }
//   인증: 콜백에서 받은 accessToken (saveTokens로 저장됨) 자동 사용
//
// SMS 인증 흐름 (확인 버튼 + 인증 강제):
//   인증번호 받기 → 코드 입력 → [확인] 버튼(/sms/verify=peek)
//     → 성공: "인증 완료" 표시 + 코드칸 잠금 + 가입완료 버튼 활성화
//   가입완료 → /complete-signup → 백엔드 consumeCode(최종 소비)
// ════════════════════════════════════════════════════════════════
let _csSmsSent = false;
let _csSmsVerified = false; // "확인" 버튼으로 인증 성공했는지
let _csSmsTimer = null;
let _csSmsRemain = 180;

function openCompleteSignupModal() {
  const overlay = document.getElementById('cs-modal-overlay');
  if (!overlay) {
    console.error('[completeSignup] 모달 DOM 없음');
    window.location.href = 'index.html';
    return;
  }
  const greet = document.getElementById('cs-greeting');
  if (greet) {
    // 닉네임 있으면 "○○님, ..." / 없으면 깔끔한 고정 문구
    greet.textContent = _csNickname
      ? `${_csNickname}님, 가입을 위해 정보를 입력해주세요`
      : '가입을 위해 정보를 입력해주세요';
  }

  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

// 전화번호 자동 포맷 (010-XXXX-XXXX)
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

// 다음 우편번호 검색
function csOpenPostcode() {
  if (typeof daum === 'undefined' || !daum.Postcode) {
    csAlert(
      '주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
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

// ── SMS 인증코드 발송 ──
async function csSendSms() {
  const phoneEl = document.getElementById('cs-phone');
  const phone = phoneEl.value.trim();
  if (!/^010-\d{4}-\d{4}$/.test(phone)) {
    csAlert('전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)');
    phoneEl.classList.add('err');
    return;
  }

  csSetBtnLoading('cs-btn-sms', true);
  try {
    // SmsController: POST /api/auth/sms/send  { phone }
    await api.post('/api/auth/sms/send', { phone });
    _csSmsSent = true;
    _csSmsVerified = false; // 재발송 시 인증 상태 리셋
    csAlert('인증번호가 발송되었습니다. 문자를 확인해주세요.', 'success');

    // 재발송 대비 UI 초기화
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
      verifyBtn.textContent = '확인';
    }
    const submitBtn = document.getElementById('cs-btn-submit');
    if (submitBtn) submitBtn.disabled = true; // 가입완료 다시 잠금

    // SMS 입력칸 노출 + 타이머
    const codeGroup = document.getElementById('cs-sms-group');
    if (codeGroup) codeGroup.style.display = '';
    csStartSmsTimer();

    setTimeout(() => {
      const c = document.getElementById('cs-smscode');
      if (c) c.focus();
    }, 200);
  } catch (e) {
    csAlert(e.message || 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    csSetBtnLoading('cs-btn-sms', false);
  }
}

// ── SMS 인증코드 확인 ("확인" 버튼 → /sms/verify = peek) ──
async function csVerifySms() {
  const phone = document.getElementById('cs-phone').value.trim();
  const code = document.getElementById('cs-smscode').value.trim();

  if (!_csSmsSent) {
    csAlert('인증번호를 먼저 받아주세요.');
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    csAlert('인증번호 6자리를 입력해주세요.');
    document.getElementById('cs-smscode').classList.add('err');
    return;
  }

  csSetBtnLoading('cs-btn-verify', true);
  try {
    // POST /api/auth/sms/verify { phone, code }  ← peek (코드 소비 안 함)
    await api.post('/api/auth/sms/verify', { phone, code });

    // 인증 성공 처리
    _csSmsVerified = true;

    // 인증완료 표시 노출
    const okEl = document.getElementById('cs-sms-verified');
    if (okEl) okEl.style.display = '';

    // 코드 입력칸 + 확인 버튼 잠금 (인증 후 변경 방지)
    const codeEl = document.getElementById('cs-smscode');
    const verifyBtn = document.getElementById('cs-btn-verify');
    if (codeEl) codeEl.readOnly = true;
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '인증완료';
    }

    // 타이머 정지
    if (_csSmsTimer) {
      clearInterval(_csSmsTimer);
      _csSmsTimer = null;
    }

    // 가입완료 버튼 활성화
    const submitBtn = document.getElementById('cs-btn-submit');
    if (submitBtn) submitBtn.disabled = false;

    csAlert('인증이 완료되었습니다.', 'success');
  } catch (e) {
    _csSmsVerified = false;
    csAlert(e.message || '인증에 실패했습니다. 인증번호를 확인해주세요.');
    document.getElementById('cs-smscode').classList.add('err');
  } finally {
    // 성공 시엔 위에서 이미 disabled=true 처리됨.
    // 실패 시에만 로딩 해제되어 다시 누를 수 있음.
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
      csAlert('인증번호가 만료되었습니다. 다시 발송해주세요.');
    }
  }, 1000);
}

function csUpdateSmsTimer() {
  const mm = String(Math.floor(_csSmsRemain / 60)).padStart(2, '0');
  const ss = String(_csSmsRemain % 60).padStart(2, '0');
  const el = document.getElementById('cs-sms-timer');
  if (el) el.textContent = `${mm}:${ss}`;
}

// ── 추가정보 제출 (complete-signup) ──
async function csSubmit() {
  const name = document.getElementById('cs-name').value.trim();
  const phone = document.getElementById('cs-phone').value.trim();
  const smsCode = document.getElementById('cs-smscode').value.trim();
  const address = csBuildAddress();

  if (!name || name.length < 2 || name.length > 10) {
    csAlert('이름은 2~10자 사이여야 합니다.');
    document.getElementById('cs-name').classList.add('err');
    return;
  }
  if (!/^010-\d{4}-\d{4}$/.test(phone)) {
    csAlert('전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)');
    document.getElementById('cs-phone').classList.add('err');
    return;
  }
  if (!_csSmsSent) {
    csAlert('휴대폰 인증을 먼저 진행해주세요.');
    return;
  }
  if (!/^\d{6}$/.test(smsCode)) {
    csAlert('인증번호 6자리를 입력해주세요.');
    document.getElementById('cs-smscode').classList.add('err');
    return;
  }
  if (!_csSmsVerified) {
    csAlert('인증번호 "확인" 버튼을 눌러 인증을 완료해주세요.');
    return;
  }
  if (!address) {
    csAlert('주소를 입력해주세요. (주소 검색 버튼을 눌러주세요)');
    document.getElementById('cs-address1').classList.add('err');
    return;
  }
  if (address.length > 500) {
    csAlert('주소가 너무 깁니다. (상세주소를 줄여주세요)');
    document.getElementById('cs-address2').classList.add('err');
    return;
  }

  csSetBtnLoading('cs-btn-submit', true);
  try {
    // PATCH /api/auth/complete-signup
    //   marketing: 동의 모달에서 보관한 값 함께 전송
    //   백엔드는 consumeCode로 인증코드 최종 소비
    await api.patch('/api/auth/complete-signup', {
      name,
      phone,
      address,
      smsCode,
      agreeMarketing: _csAgreeMarketing,
    });

    if (_csSmsTimer) clearInterval(_csSmsTimer);
    showToast('가입이 완료되었습니다! 환영해요 🎉', 'success');

    // 모달 닫고 후속 처리
    const overlay = document.getElementById('cs-modal-overlay');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';

    setTimeout(() => {
      handleAfterLogin(getRole());
    }, 900);
  } catch (e) {
    csAlert(e.message || '가입 완료에 실패했습니다. 입력 정보를 확인해주세요.');
    // 가입완료 단계에서 인증 소비 실패(만료 등) 시 다시 인증하도록 유도
    csSetBtnLoading('cs-btn-submit', false);
  }
}

// ── 모달 헬퍼 ──
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

// ── 이메일 패널 토글 ─────────────────────────────────────────────
let emailOpen = false;

function toggleEmail(e) {
  e.preventDefault();
  emailOpen = !emailOpen;
  document.getElementById('email-panel').classList.toggle('open', emailOpen);
  document.getElementById('email-toggle').textContent = emailOpen
    ? '이메일 로그인 닫기'
    : '이메일로 로그인';
  if (emailOpen) {
    setTimeout(() => document.getElementById('input-email').focus(), 350);
  }
}

// ── 이메일 로그인 제출 ────────────────────────────────────────────
async function submitEmailLogin() {
  const email = document.getElementById('input-email').value.trim();
  const pw = document.getElementById('input-pw').value;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('input-email').classList.add('err');
    showEmailAlert('올바른 이메일 형식을 입력해주세요.');
    return;
  }
  if (!pw) {
    document.getElementById('input-pw').classList.add('err');
    showEmailAlert('비밀번호를 입력해주세요.');
    return;
  }

  setEmailLoading(true);
  hideEmailAlert();

  try {
    const data = await api.post('/api/auth/login', { email, password: pw });
    saveTokens(data.accessToken, data.refreshToken, data.role, data.nickname);
    showToast('로그인 성공!', 'success');
    setTimeout(() => {
      handleAfterLogin(data.role);
    }, 700);
  } catch (e) {
    showEmailAlert(e.message || '로그인에 실패했습니다. 다시 시도해주세요.');
  } finally {
    setEmailLoading(false);
  }
}

// ── 로딩 토글 ────────────────────────────────────────────────────
function setEmailLoading(on) {
  document.getElementById('btn-email-submit').disabled = on;
  document.getElementById('email-btn-text').style.display = on
    ? 'none'
    : 'block';
  document.getElementById('email-spinner').style.display = on
    ? 'block'
    : 'none';
}

// ── 에러 알림 배너 ───────────────────────────────────────────────
function showEmailAlert(msg) {
  const el = document.getElementById('email-alert');
  el.textContent = msg;
  el.className = 'alert-banner show error';
}
function hideEmailAlert() {
  document.getElementById('email-alert').classList.remove('show');
}

// ── 초기화 ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. 카카오 콜백 파라미터 먼저 처리
  handleOAuthCallback();

  // 2. 이미 로그인된 상태면 홈으로
  //    단, 카카오 콜백(신규 모달 표시 중)이면 리다이렉트 금지
  const hasCallback = new URLSearchParams(window.location.search).get(
    'accessToken',
  );
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

  // 3. 입력 시 에러 스타일 자동 제거
  document.querySelectorAll('.form-input').forEach((el) => {
    el.addEventListener('input', function () {
      this.classList.remove('err');
      hideEmailAlert();
      csHideAlert();
    });
  });

  // 4. 모달 전화번호 자동 포맷
  const csPhone = document.getElementById('cs-phone');
  if (csPhone) {
    csPhone.addEventListener('input', () => csFormatPhone(csPhone));
  }

  // 5. 인증코드 입력 변경 시 인증 상태 리셋 (인증 후 코드 바꿔치기 방지)
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
