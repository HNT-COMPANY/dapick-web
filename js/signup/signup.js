// signup.js — 다픽 회원가입 페이지 로직
// 3단계 플로우: 이메일 → 인증코드 → 정보 입력 → 자동 로그인 → pending 자동 복귀
// 메모리 #15: 가입 완료 후 pending 신청 자동 복귀 (DapickApplication)
//
// ※ 5/25 수정:
//   - 주소(address) 필드 추가. 다음 우편번호 API로 우편번호+기본주소 검색,
//     상세주소는 직접 입력. 제출 시 "기본주소 (상세주소)" 형태로 합쳐
//     백엔드 SignupRequest.address(@NotBlank, max 500) 한 문자열로 전송.

// ── 전역 상태 ────────────────────────────────────────────────────
let currentStep = 1;
let verifiedEmail = null;
let codeTimerInterval = null;
let codeRemainingSeconds = 300; // 5분

// ── 문자 인증 상태 ───────────────────────────────────────────────
// 2026-07-28 이벤트 대량가입(105건) 대응. 전에는 전화번호가 형식만 맞으면
// 그대로 저장돼서, 뒷자리가 연속인 가짜 번호가 무더기로 들어왔다.
// 이제 실제로 문자를 받은 번호만 가입할 수 있다.
let verifiedPhone = null;      // 인증을 마친 번호. 번호를 고치면 즉시 무효화된다.
let verifiedSmsCode = null;    // 가입 요청에 함께 보낼 코드
let smsTimerInterval = null;
let smsRemainingSeconds = 180; // 서버 보관 시간과 같은 3분

// ── 단계 이동 ────────────────────────────────────────────────────
function goToStep(step) {
  // 패널 전환
  document
    .querySelectorAll('.step-panel')
    .forEach((p) => p.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');

  // 인디케이터 업데이트 (현재 UI상 없지만 안전하게 유지)
  document.querySelectorAll('.step-item').forEach((item) => {
    const n = parseInt(item.dataset.step, 10);
    item.classList.toggle('active', n === step);
    item.classList.toggle('completed', n < step);
  });

  // Step 3 진입 시 카카오 가입 버튼 + 구분선 숨김
  const socialGroup = document.querySelector('.social-group');
  const divider = document.querySelector('.login-divider');
  const hide = step === 3;
  if (socialGroup) socialGroup.style.display = hide ? 'none' : '';
  if (divider) divider.style.display = hide ? 'none' : '';

  currentStep = step;
  hideSignupAlert();
}

// ── 인입 경로 자동 추출 ──────────────────────────────────────────
// 우선순위: UTM 광고 > 다폰 경유 > 검색엔진 > 직접 접속(DIRECT)
// 백엔드 SignupSource enum 값과 일치
//   (DIRECT, ADVERTISEMENT, DAPHONE_LANDING, NAVER_SEARCH, GOOGLE_SEARCH)
function detectSignupSource() {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || '';

  // 1. UTM 광고 캠페인 (최우선)
  if (params.get('utm_source')) {
    return 'ADVERTISEMENT';
  }

  // 2. 다폰 경유 (3-tier 퍼널 핵심 지표)
  if (referrer.includes('daphone.ai.kr')) {
    return 'DAPHONE_LANDING';
  }

  // 3. 검색엔진 분리 측정
  if (referrer.includes('naver.com')) {
    return 'NAVER_SEARCH';
  }
  if (referrer.includes('google.com') || referrer.includes('google.co.kr')) {
    return 'GOOGLE_SEARCH';
  }

  // 4. 그 외 (직접 URL 입력 또는 알 수 없음)
  return 'DIRECT';
}

// ── 다음(카카오) 우편번호 검색 ────────────────────────────────────
// daum.Postcode 스크립트는 signup.html에서 로드.
// 검색 완료 시 우편번호 + 기본주소(도로명 우선)를 채우고 상세주소로 포커스.
function openPostcode() {
  if (typeof daum === 'undefined' || !daum.Postcode) {
    showSignupAlert(
      '주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    );
    return;
  }

  new daum.Postcode({
    oncomplete: function (data) {
      // 도로명 주소 우선, 없으면 지번 주소
      const base =
        data.roadAddress && data.roadAddress.trim()
          ? data.roadAddress
          : data.jibunAddress;

      const zonecodeEl = document.getElementById('input-zonecode');
      const addr1El = document.getElementById('input-address1');
      const addr2El = document.getElementById('input-address2');

      if (zonecodeEl) zonecodeEl.value = data.zonecode || '';
      if (addr1El) {
        addr1El.value = base || '';
        addr1El.classList.remove('err');
      }

      // 상세주소 입력으로 포커스
      if (addr2El) addr2El.focus();
      hideSignupAlert();
    },
  }).open();
}

// 기본주소 + 상세주소 → 백엔드 전송용 단일 문자열
//   "서울 강남구 ... 123 (상세주소)" / 상세 없으면 "서울 강남구 ... 123"
function buildAddressString() {
  const addr1 = (document.getElementById('input-address1')?.value || '').trim();
  const addr2 = (document.getElementById('input-address2')?.value || '').trim();
  if (!addr1) return '';
  return addr2 ? `${addr1} (${addr2})` : addr1;
}

// ── Step 1: 인증코드 발송 ─────────────────────────────────────────
async function sendVerificationCode() {
  const email = composeEmail();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showSignupAlert('이메일 아이디와 주소를 모두 입력해주세요.');
    const localEl = document.getElementById('input-email-local');
    const domainEl = document.getElementById('input-email-domain');
    if (localEl && !localEl.value.trim()) localEl.classList.add('err');
    if (domainEl && !domainEl.value.trim()) domainEl.classList.add('err');
    return;
  }

  setButtonLoading(
    'btn-send-code',
    'send-code-text',
    'send-code-spinner',
    true,
  );

  try {
    await api.post('/api/auth/send-code', { email });
    showSignupAlert(
      '인증코드가 발송되었습니다. 이메일을 확인해주세요.',
      'success',
    );

    // Step 2로 이동
    if (currentStep === 1) {
      goToStep(2);
    }
    startCodeTimer();

    // 이메일 입력 잠금 (변경 방지) — 아이디/도메인/드롭다운 세 칸 모두
    ['input-email-local', 'input-email-domain', 'select-email-domain'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });

    setTimeout(() => {
      const codeInput = document.getElementById('input-code');
      if (codeInput) codeInput.focus();
    }, 300);
  } catch (e) {
    showSignupAlert(e.message || '인증코드 발송에 실패했습니다.');
  } finally {
    setButtonLoading(
      'btn-send-code',
      'send-code-text',
      'send-code-spinner',
      false,
    );
  }
}

// ── Step 2: 인증코드 확인 ─────────────────────────────────────────
async function verifyCode() {
  const email = document.getElementById('input-email').value.trim();
  const codeInput = document.getElementById('input-code');
  const code = codeInput.value.trim();

  if (!code || code.length !== 6) {
    showSignupAlert('6자리 인증코드를 입력해주세요.');
    codeInput.classList.add('err');
    return;
  }

  setButtonLoading(
    'btn-verify-code',
    'verify-code-text',
    'verify-code-spinner',
    true,
  );

  try {
    await api.post('/api/auth/verify-code', { email, code });
    stopCodeTimer();
    verifiedEmail = email;

    showSignupAlert(
      '인증이 완료되었습니다! 나머지 정보를 입력해주세요.',
      'success',
    );
    goToStep(3);

    setTimeout(() => {
      const pwInput = document.getElementById('input-password');
      if (pwInput) pwInput.focus();
    }, 300);
  } catch (e) {
    showSignupAlert(e.message || '인증코드가 올바르지 않습니다.');
    codeInput.classList.add('err');
  } finally {
    setButtonLoading(
      'btn-verify-code',
      'verify-code-text',
      'verify-code-spinner',
      false,
    );
  }
}

// ── Step 3: 회원가입 제출 ─────────────────────────────────────────
async function submitSignup() {
  const email = verifiedEmail;
  const password = document.getElementById('input-password').value;
  const passwordConfirm = document.getElementById(
    'input-password-confirm',
  ).value;
  const name = document.getElementById('input-name').value.trim();
  const nickname = document.getElementById('input-nickname').value.trim();
  const phone = document.getElementById('input-phone').value.trim();
  const address = buildAddressString();
  const agreeTerms = document.getElementById('agree-terms').checked;
  const agreePrivacy = document.getElementById('agree-privacy').checked;
  const agreeMarketing = document.getElementById('agree-marketing').checked;
  const signupSource =
    document.getElementById('input-signup-source').value || 'DIRECT';

  // ── 클라이언트 사이드 validation ─────────────────────────────
  const pwPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!pwPattern.test(password)) {
    showSignupAlert(
      '비밀번호는 8자 이상, 영문 대/소문자·숫자·특수문자를 각 1개 이상 포함해야 합니다.',
    );
    document.getElementById('input-password').classList.add('err');
    return;
  }
  if (password !== passwordConfirm) {
    showSignupAlert('비밀번호가 일치하지 않습니다.');
    document.getElementById('input-password-confirm').classList.add('err');
    return;
  }
  if (!name || name.length < 2 || name.length > 10) {
    showSignupAlert('이름은 2~10자 사이여야 합니다.');
    document.getElementById('input-name').classList.add('err');
    return;
  }
  if (!nickname || nickname.length < 2 || nickname.length > 20) {
    showSignupAlert('닉네임은 2~20자 사이여야 합니다.');
    document.getElementById('input-nickname').classList.add('err');
    return;
  }
  if (!/^010-\d{4}-\d{4}$/.test(phone)) {
    showSignupAlert('전화번호 형식이 올바르지 않습니다. (010-XXXX-XXXX)');
    document.getElementById('input-phone').classList.add('err');
    return;
  }
  // 인증한 번호와 제출 번호가 같아야 한다. 인증 후 번호를 고쳤다면 여기서 걸린다.
  if (!verifiedPhone || verifiedPhone !== phone) {
    showSignupAlert('전화번호 인증을 완료해주세요.');
    document.getElementById('input-phone').classList.add('err');
    return;
  }
  // 주소: 우편번호 검색으로 기본주소가 채워졌는지 확인 (백엔드 @NotBlank)
  if (!address) {
    showSignupAlert('주소를 입력해주세요. (주소 검색 버튼을 눌러주세요)');
    document.getElementById('input-address1').classList.add('err');
    return;
  }
  if (address.length > 500) {
    showSignupAlert('주소가 너무 깁니다. (상세주소를 줄여주세요)');
    document.getElementById('input-address2').classList.add('err');
    return;
  }
  if (!agreeTerms || !agreePrivacy) {
    showSignupAlert('필수 약관에 동의해주세요.');
    return;
  }

  // ── API 호출 ─────────────────────────────────────────────────
  setButtonLoading(
    'btn-signup-submit',
    'signup-btn-text',
    'signup-spinner',
    true,
  );

  try {
    const data = await api.post('/api/auth/signup', {
      email,
      password,
      nickname,
      name,
      phone,
      smsCode: verifiedSmsCode,
      address,
      agreeTerms,
      agreePrivacy,
      agreeMarketing,
      signupSource,
    });

    // 자동 로그인 (auth.js의 saveTokens 재사용)
    saveTokens(data.accessToken, data.refreshToken, data.role, data.nickname);

    if (typeof showToast === 'function') {
      showToast(`다픽에 오신 걸 환영해요, ${data.nickname}님!`, 'success');
    }

    // ── 메모리 #15: pending 신청 자동 복귀 ─────────────────────
    // 우선순위: 백엔드 신청 > 카카오 상담 > redirect 경로 > 홈
    setTimeout(() => {
      // 1순위: 백엔드 신청 (DapickApplication.apply 표준 흐름)
      if (
        typeof DapickApplication !== 'undefined' &&
        sessionStorage.getItem('dapick:pendingApplication')
      ) {
        DapickApplication.resumeIfPending();
        return;
      }

      // 2순위: 카카오 상담 pending (utils.js 흐름)
      if (
        typeof resumePendingKakaoConsult === 'function' &&
        sessionStorage.getItem('pending_kakao_consult')
      ) {
        resumePendingKakaoConsult();
        return;
      }

      // 3순위: 로그인 후 복귀 페이지 (auth.js의 saveReturnUrl/takeReturnUrl)
      const redirectPath = takeReturnUrl();
      if (redirectPath) {
        window.location.href = redirectPath;
        return;
      }

      // 기본: 홈으로
      window.location.href = 'index.html';
    }, 1200);
  } catch (e) {
    showSignupAlert(
      e.message || '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.',
    );
  } finally {
    setButtonLoading(
      'btn-signup-submit',
      'signup-btn-text',
      'signup-spinner',
      false,
    );
  }
}

// ── 인증 코드 타이머 ─────────────────────────────────────────────
function startCodeTimer() {
  codeRemainingSeconds = 300;
  updateTimerDisplay();
  stopCodeTimer(); // 기존 타이머 정리
  codeTimerInterval = setInterval(() => {
    codeRemainingSeconds--;
    updateTimerDisplay();
    if (codeRemainingSeconds <= 0) {
      stopCodeTimer();
      showSignupAlert('인증코드가 만료되었습니다. 재발송 버튼을 눌러주세요.');
    }
  }, 1000);
}

function stopCodeTimer() {
  if (codeTimerInterval) {
    clearInterval(codeTimerInterval);
    codeTimerInterval = null;
  }
}

function updateTimerDisplay() {
  const mm = String(Math.floor(codeRemainingSeconds / 60)).padStart(2, '0');
  const ss = String(codeRemainingSeconds % 60).padStart(2, '0');
  const el = document.getElementById('code-timer');
  if (el) el.textContent = `${mm}:${ss}`;
}

// ── 전화번호 자동 포맷 (010-XXXX-XXXX) ──────────────────────────
// ── 이메일 아이디 + 도메인 조합 ──────────────────────────────────
// 화면은 [아이디] @ [도메인] [드롭다운] 세 칸이지만,
// 실제 값은 숨은 #input-email 하나로 합쳐 둔다. 기존 코드가 그 필드를 읽는다.
function composeEmail() {
  const local = (document.getElementById('input-email-local').value || '').trim();
  const domain = (document.getElementById('input-email-domain').value || '').trim();
  const hidden = document.getElementById('input-email');
  const full = local && domain ? `${local}@${domain}` : '';
  if (hidden) hidden.value = full;
  return full;
}

/** 드롭다운에서 도메인을 고르면 도메인 칸을 채우고 잠근다. '직접입력'이면 비우고 연다. */
function onEmailDomainPicked() {
  const sel = document.getElementById('select-email-domain');
  const domainInput = document.getElementById('input-email-domain');
  if (!sel || !domainInput) return;

  if (sel.value) {
    domainInput.value = sel.value;
    domainInput.readOnly = true;
  } else {
    domainInput.value = '';
    domainInput.readOnly = false;
    domainInput.focus();
  }
  domainInput.classList.remove('err');
  composeEmail();
}

// ── 휴대폰 인증 모달 ─────────────────────────────────────────────
function openPhoneModal() {
  if (verifiedPhone) return;             // 이미 인증했으면 다시 열지 않는다
  const m = document.getElementById('phone-modal');
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const el = document.getElementById('modal-phone');
    if (el) el.focus();
  }, 150);
}

function closePhoneModal() {
  const m = document.getElementById('phone-modal');
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
  hidePhoneAlert();
}

/** 배경(어두운 영역)을 눌렀을 때만 닫는다. 상자 안 클릭으로 닫히면 안 된다. */
function onPhoneModalBackdrop(e) {
  if (e.target && e.target.id === 'phone-modal') closePhoneModal();
}

function showPhoneAlert(msg, type = 'error') {
  const el = document.getElementById('phone-modal-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert-banner show ${type}`;
}

function hidePhoneAlert() {
  const el = document.getElementById('phone-modal-alert');
  if (!el) return;
  el.textContent = '';
  el.className = 'alert-banner';
}

// ── 전화번호 문자 인증 ───────────────────────────────────────────
async function sendPhoneCode() {
  const phoneInput = document.getElementById('modal-phone');
  const phone = phoneInput.value.trim();

  if (!/^010-\d{4}-\d{4}$/.test(phone)) {
    showPhoneAlert('전화번호를 010-0000-0000 형식으로 입력해주세요.');
    phoneInput.classList.add('err');
    return;
  }

  setButtonLoading('btn-send-sms', 'send-sms-text', 'send-sms-spinner', true);
  try {
    await api.post('/api/auth/sms/send', { phone });
    document.getElementById('phone-verify-row').style.display = '';
    showPhoneAlert('인증번호를 문자로 보냈습니다.', 'success');
    startSmsTimer();
    setTimeout(() => {
      const el = document.getElementById('input-sms-code');
      if (el) el.focus();
    }, 300);
  } catch (e) {
    showPhoneAlert(e.message || '인증번호 발송에 실패했습니다.');
  } finally {
    setButtonLoading('btn-send-sms', 'send-sms-text', 'send-sms-spinner', false);
  }
}

async function verifyPhoneCode() {
  const phone = document.getElementById('modal-phone').value.trim();
  const codeInput = document.getElementById('input-sms-code');
  const code = codeInput.value.trim();

  if (!/^\d{6}$/.test(code)) {
    showPhoneAlert('문자로 받은 6자리 숫자를 입력해주세요.');
    codeInput.classList.add('err');
    return;
  }

  setButtonLoading('btn-verify-sms', 'verify-sms-text', 'verify-sms-spinner', true);
  try {
    await api.post('/api/auth/sms/verify', { phone, code });
    stopSmsTimer();
    // 서버는 확인만 하고 코드를 남겨둔다(peek). 실제 소비는 가입이 끝날 때 서버가 한다.
    verifiedPhone = phone;
    verifiedSmsCode = code;

    // 본 화면에 인증된 번호를 옮겨 적고, 다시 못 열게 잠근다.
    const mainPhone = document.getElementById('input-phone');
    if (mainPhone) {
      mainPhone.value = phone;
      mainPhone.classList.remove('err');
      mainPhone.style.cursor = 'default';
      mainPhone.onclick = null;
    }
    const mark = document.getElementById('phone-verified-mark');
    if (mark) mark.style.display = '';
    const openBtn = document.getElementById('btn-open-phone');
    if (openBtn) {
      openBtn.disabled = true;
      openBtn.textContent = '인증 완료';
    }

    closePhoneModal();
    showSignupAlert('휴대폰 인증이 완료되었습니다.', 'success');
  } catch (e) {
    showPhoneAlert(e.message || '인증번호가 올바르지 않습니다.');
    codeInput.classList.add('err');
  } finally {
    setButtonLoading('btn-verify-sms', 'verify-sms-text', 'verify-sms-spinner', false);
  }
}

/** 번호를 고치면 이미 받은 인증을 버린다. 인증한 번호와 제출 번호가 어긋나면 안 된다. */
function resetPhoneVerification() {
  if (!verifiedPhone) return;
  verifiedPhone = null;
  verifiedSmsCode = null;
  stopSmsTimer();
  const row = document.getElementById('phone-verify-row');
  if (row) row.style.display = 'none';
  const codeInput = document.getElementById('input-sms-code');
  if (codeInput) {
    codeInput.value = '';
    codeInput.disabled = false;
  }
  const vBtn = document.getElementById('btn-verify-sms');
  if (vBtn) vBtn.disabled = false;
  const sBtn = document.getElementById('btn-send-sms');
  if (sBtn) sBtn.disabled = false;

  const mainPhone = document.getElementById('input-phone');
  if (mainPhone) {
    mainPhone.value = '';
    mainPhone.style.cursor = 'pointer';
    mainPhone.onclick = openPhoneModal;
  }
  const mark = document.getElementById('phone-verified-mark');
  if (mark) mark.style.display = 'none';
  const openBtn = document.getElementById('btn-open-phone');
  if (openBtn) {
    openBtn.disabled = false;
    openBtn.textContent = '휴대폰 인증';
  }
}

function startSmsTimer() {
  stopSmsTimer();
  smsRemainingSeconds = 180;
  updateSmsTimerDisplay();
  smsTimerInterval = setInterval(() => {
    smsRemainingSeconds -= 1;
    updateSmsTimerDisplay();
    if (smsRemainingSeconds <= 0) {
      stopSmsTimer();
      showPhoneAlert('인증번호가 만료되었습니다. 다시 받아주세요.');
    }
  }, 1000);
}

function stopSmsTimer() {
  if (smsTimerInterval) {
    clearInterval(smsTimerInterval);
    smsTimerInterval = null;
  }
}

function updateSmsTimerDisplay() {
  const el = document.getElementById('sms-timer');
  if (!el) return;
  const m = String(Math.floor(Math.max(smsRemainingSeconds, 0) / 60)).padStart(2, '0');
  const s = String(Math.max(smsRemainingSeconds, 0) % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

function formatPhone(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 7) {
    v = v.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
  } else if (v.length > 3) {
    v = v.replace(/(\d{3})(\d+)/, '$1-$2');
  }
  input.value = v;
}

// ── 약관 전체 동의 토글 ─────────────────────────────────────────
function toggleAllAgreements(checkbox) {
  const all = checkbox.checked;
  document.querySelectorAll('.agree-checkbox').forEach((cb) => {
    cb.checked = all;
  });
}

// 개별 약관 체크 시 전체 선택 상태 자동 업데이트
function updateAllAgreementState() {
  const checkboxes = document.querySelectorAll('.agree-checkbox');
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  document.getElementById('agree-all').checked = allChecked;
}

// ── 알림 헬퍼 ────────────────────────────────────────────────────
function showSignupAlert(msg, type = 'error') {
  const el = document.getElementById('signup-alert');
  if (!el) return;
  el.textContent = msg;
  el.className = `alert-banner show ${type}`;

  // success는 3초 후 자동 숨김
  if (type === 'success') {
    setTimeout(() => el.classList.remove('show'), 3000);
  }
}

function hideSignupAlert() {
  const el = document.getElementById('signup-alert');
  if (el) el.classList.remove('show');
}

function setButtonLoading(btnId, textId, spinnerId, loading) {
  const btn = document.getElementById(btnId);
  const txt = document.getElementById(textId);
  const spn = document.getElementById(spinnerId);
  if (btn) btn.disabled = loading;
  if (txt) txt.style.visibility = loading ? 'hidden' : 'visible';
  if (spn) spn.style.display = loading ? 'block' : 'none';
}

// ── 소셜 로그인 (signup 페이지: 이메일 가입 유도) ──────────────
// ※ 카카오 OAuth 실동작은 login.js가 담당. signup 페이지에서는
//   login.html로 보내 동일한 카카오 흐름을 타도록 통일.
async function socialLogin(provider) {
  if (provider === 'kakao') {
    // login.html의 카카오 버튼과 동일 흐름으로 위임
    window.location.href = 'login.html';
    return;
  }
}

// ── 초기화 ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 이미 로그인 중이면 홈으로 리다이렉트
  if (isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  // 인입 경로 자동 추출 → hidden input에 세팅
  const sourceInput = document.getElementById('input-signup-source');
  if (sourceInput) {
    const detected = detectSignupSource();
    sourceInput.value = detected;
    console.log('[signup] detected signup source:', detected);
  }

  // 입력 에러 스타일 자동 제거
  document.querySelectorAll('.form-input').forEach((el) => {
    el.addEventListener('input', function () {
      this.classList.remove('err');
    });
  });

  // 전화번호 자동 포맷팅
  const phoneInput = document.getElementById('input-phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => formatPhone(phoneInput));
  }

  // 모달 안 휴대폰 번호 — 고치면 이미 받은 인증을 버린다
  const modalPhone = document.getElementById('modal-phone');
  if (modalPhone) {
    modalPhone.addEventListener('input', () => {
      formatPhone(modalPhone);
      resetPhoneVerification();
    });
  }

  // 약관 체크박스 → 전체 선택 동기화
  document.querySelectorAll('.agree-checkbox').forEach((cb) => {
    cb.addEventListener('change', updateAllAgreementState);
  });

  // Enter 키로 단계 진행
  const emailInput = document.getElementById('input-email');
  if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendVerificationCode();
    });
  }
  const codeInput = document.getElementById('input-code');
  if (codeInput) {
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') verifyCode();
    });
  }
  // 상세주소에서 Enter → 제출
  const addr2Enter = document.getElementById('input-address2');
  if (addr2Enter) {
    addr2Enter.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitSignup();
    });
  }
});
