// login.js — 다픽 로그인 페이지 전용 스크립트
// 소셜 로그인, 이메일 패널 토글, 이메일 로그인 제출 담당

// ── 소셜 로그인 (추후 OAuth2 연결) ─────────────────────────────
function socialLogin(provider) {
  const names = { kakao: '카카오', naver: '네이버', apple: 'Apple' };
  showToast(`${names[provider]} 로그인 준비 중입니다. 곧 오픈해요! 🙏`, 'info');

  // 추후 연결 예시:
  // window.location.href = `${BASE_URL}/oauth2/authorization/${provider}`;
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

  // 패널 열릴 때 이메일 입력창 포커스
  if (emailOpen) {
    setTimeout(() => document.getElementById('input-email').focus(), 350);
  }
}

// ── 이메일 로그인 제출 ────────────────────────────────────────────
async function submitEmailLogin() {
  const email = document.getElementById('input-email').value.trim();
  const pw = document.getElementById('input-pw').value;

  // 유효성 검사
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
    // POST /api/auth/login 호출 (api.js)
    const data = await api.post('/api/auth/login', { email, password: pw });

    // 토큰 저장 (auth.js)
    saveTokens(data.accessToken, data.refreshToken, data.role, data.nickname);

    showToast('로그인 성공!', 'success');

    // 역할별 리다이렉트
    setTimeout(() => {
      window.location.href =
        data.role === 'LV4_ADMIN'
          ? 'https://admin.dapick.co.kr' // 어드민은 admin 도메인으로
          : 'index.html';
    }, 700);
  } catch (e) {
    showEmailAlert(e.message || '로그인에 실패했습니다. 다시 시도해주세요.');
  } finally {
    setEmailLoading(false);
  }
}

// ── 로딩 상태 토글 ───────────────────────────────────────────────
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
  // 이미 로그인된 상태면 홈으로 리다이렉트
  if (isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  // 입력 시 에러 스타일 자동 제거
  document.querySelectorAll('.form-input').forEach((el) => {
    el.addEventListener('input', function () {
      this.classList.remove('err');
      hideEmailAlert();
    });
  });
});
