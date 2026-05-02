// signup.js — 다픽 회원가입 페이지 로직
// 3단계 플로우: 이메일 → 인증코드 → 정보 입력 → 자동 로그인

// ── 전역 상태 ────────────────────────────────────────────────────
let currentStep = 1;
let verifiedEmail = null;
let codeTimerInterval = null;
let codeRemainingSeconds = 300; // 5분

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

// ── Step 1: 인증코드 발송 ─────────────────────────────────────────
async function sendVerificationCode() {
  const emailInput = document.getElementById('input-email');
  const email = emailInput.value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showSignupAlert('올바른 이메일 형식을 입력해주세요.');
    emailInput.classList.add('err');
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

    // 이메일 input 잠금 (변경 방지)
    emailInput.disabled = true;

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
      agreeTerms,
      agreePrivacy,
      agreeMarketing,
      signupSource,
    });

    // 자동 로그인 (auth.js의 saveTokens 재사용)
    saveTokens(data.accessToken, data.refreshToken, data.role, data.nickname);

    if (typeof showToast === 'function') {
      showToast(`다픽에 오신 걸 환영해요, ${data.nickname}님! 🎉`, 'success');
    }

    // 홈으로 이동
    setTimeout(() => {
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

// ── 소셜 로그인 (login.js와 동일 - 독립성 유지) ─────────────────
async function socialLogin(provider) {
  if (provider === 'kakao') {
    try {
      const data = await api.get('/oauth2/kakao/url');
      window.location.href = data.url;
    } catch (e) {
      showSignupAlert('카카오 로그인 연결에 실패했습니다.');
    }
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
  const phoneEnter = document.getElementById('input-phone');
  if (phoneEnter) {
    phoneEnter.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitSignup();
    });
  }
});
