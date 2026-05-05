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

// ── 카카오 OAuth 콜백 처리 ───────────────────────────────────────
function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('accessToken');
  const refreshToken = params.get('refreshToken');
  const role = params.get('role');
  const nickname = params.get('nickname');
  const isNewUser = params.get('isNewUser') === 'true';
  const error = params.get('error');

  // 에러 처리
  if (error) {
    showToast('카카오 로그인에 실패했습니다. 다시 시도해주세요.', 'error');
    window.history.replaceState({}, document.title, '/login.html');
    return;
  }

  // 로그인 성공
  if (accessToken && refreshToken) {
    saveTokens(accessToken, refreshToken, role, nickname);

    if (isNewUser) {
      showToast(
        `환영해요, ${nickname || ''}님! 다픽에 가입되었어요 🎉`,
        'success',
      );
    } else {
      showToast(`다시 오셨군요, ${nickname || ''}님! 😊`, 'success');
    }

    // URL 파라미터 제거
    window.history.replaceState({}, document.title, '/login.html');

    setTimeout(() => {
      handleAfterLogin(role);
    }, 1000);
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
    // 원래 있던 페이지로 복귀 후 상담 열기
    const redirect =
      sessionStorage.getItem('redirect_after_login') || 'index.html';
    sessionStorage.removeItem('redirect_after_login');
    // pending_kakao_consult는 복귀 페이지에서 resumePendingKakaoConsult()가 처리
    window.location.href = redirect;
    return;
  }

  // 3. 그냥 홈으로
  window.location.href = 'index.html';
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
  if (
    !new URLSearchParams(window.location.search).get('accessToken') &&
    isLoggedIn()
  ) {
    window.location.href = 'index.html';
    return;
  }

  // 3. 입력 시 에러 스타일 자동 제거
  document.querySelectorAll('.form-input').forEach((el) => {
    el.addEventListener('input', function () {
      this.classList.remove('err');
      hideEmailAlert();
    });
  });
});
