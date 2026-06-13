// ════════════════════════════════════════════════════
// support.js — 고객센터 (진입/문의/불편 3페이지 공용)
// 1) 로그인 게이트: mypage.js IIFE 패턴 복제 (dapick_token 없으면 login.html)
// 2) 폼 제출: POST /api/support-tickets (type 고정, userId는 서버가 토큰에서 추출)
//    토큰·401 silent refresh 는 common/api.js 가 처리
// ════════════════════════════════════════════════════

(function () {
  // ── 로그인 게이트 ──────────────────────────────────
  if (!localStorage.getItem('dapick_token')) {
    window.location.href = '/login.html';
    return;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('support-form');
    if (form) initForm(form);
  });

  function initForm(form) {
    const type = form.dataset.type; // INQUIRY | COMPLAINT
    const errEl = document.getElementById('sup-err');
    const submitBtn = document.getElementById('sup-submit');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errEl.textContent = '';

      const applicantName = form.applicantName.value.trim();
      const applicantPhone = form.applicantPhone.value.trim();
      const applicantEmail = form.applicantEmail.value.trim();
      const content = form.content.value.trim();

      if (!applicantName) return setError(errEl, '이름을 입력해주세요.');
      if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(applicantPhone))
        return setError(errEl, '올바른 휴대폰 번호를 입력해주세요.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail))
        return setError(errEl, '올바른 이메일을 입력해주세요.');
      if (!content) return setError(errEl, '내용을 입력해주세요.');

      submitBtn.disabled = true;
      submitBtn.textContent = '접수 중...';

      try {
        const res = await api.post('/api/support-tickets', {
          type: type,
          applicantName: applicantName,
          applicantPhone: applicantPhone,
          applicantEmail: applicantEmail,
          content: content,
        });
        if (!res) return; // 토큰 만료·refresh 실패 시 api.js 가 login.html 로 이동
        showDone(res);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = '접수하기';
        if (err.status === 401) {
          alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
          window.location.href = '/login.html';
          return;
        }
        setError(errEl, err.message || '접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    });
  }

  function setError(errEl, msg) {
    errEl.textContent = msg;
    return false;
  }

  function showDone(res) {
    const formWrap = document.getElementById('sup-form-wrap');
    const doneWrap = document.getElementById('sup-done');
    if (formWrap) formWrap.style.display = 'none';
    if (doneWrap) {
      document.getElementById('sup-done-num').textContent =
        res.ticketNumber || '-';
      document.getElementById('sup-done-msg').textContent =
        res.message || '접수되었습니다.';
      doneWrap.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
})();
