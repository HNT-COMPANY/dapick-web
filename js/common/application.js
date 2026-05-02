// ════════════════════════════════════════════════════
// application.js — 다픽 신청 처리 통합 모듈
// ────────────────────────────────────────────────────
// 흐름:
//   [1] 비로그인 → sessionStorage 저장 → 로그인 페이지 이동
//   [2] 로그인 후 자동 복귀 → POST /api/consultations
//   [3] consultationNumber 받음 → application-success.html 이동
//
// 메모리:
//   - 메모리 #6: 다픽 회원가입 필수
//   - 메모리 #13: 신청 처리 = DapickApplication.apply 단일 호출
//   - 메모리 #15: 백엔드 POST /api/consultations 박혀있음 (5/1 완성)
//                응답 = { id, consultationNumber, status, message }
//                consultationNumber 형식 = YYYYMMDD-{카테고리코드}{4자리}
// ════════════════════════════════════════════════════

window.DapickApplication = (function () {
  'use strict';

  const STORAGE_KEY = 'dapick:pendingApplication';
  const TOKEN_KEY = 'dapick_token';

  // 백엔드 박혀있음 (메모리 #15) - 5/1 완성
  const USE_BACKEND = true;

  // ════════════════════════════════════════════════════
  // 로그인 여부 체크
  // ════════════════════════════════════════════════════
  function isLoggedIn() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  // ════════════════════════════════════════════════════
  // 신청 시작 (페이지에서 [신청하기] 클릭 시 호출)
  // payload = { category, productId, productName, brand, selectedOptions, monthlyPrice }
  // ════════════════════════════════════════════════════
  async function apply(payload) {
    if (!payload || !payload.category || !payload.productId) {
      alert('상품 정보가 올바르지 않습니다.');
      return;
    }

    // 1) 비로그인 → sessionStorage 저장 + 로그인 페이지 이동
    if (!isLoggedIn()) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      alert('회원가입 후 신청 가능합니다.');
      window.location.href = 'login.html';
      return;
    }

    // 2) 로그인 → 백엔드 호출
    await submitToBackend(payload);
  }

  // ════════════════════════════════════════════════════
  // 백엔드 호출 (POST /api/consultations)
  // ════════════════════════════════════════════════════
  async function submitToBackend(payload) {
    if (!USE_BACKEND) {
      console.warn('[DapickApplication] USE_BACKEND=false, 카카오 폴백');
      window.open('https://pf.kakao.com/_exaRjX/chat', '_blank');
      return;
    }

    if (typeof api === 'undefined' || !api.post) {
      console.error('[DapickApplication] api.js 미로드');
      alert('통신 모듈을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    try {
      // 백엔드 요청 형식 (메모리 #15)
      const requestBody = {
        productId: payload.productId,
        selectedOptions: payload.selectedOptions || {},
        monthlyPrice: payload.monthlyPrice || 0,
      };

      // api.js 자동 unwrap → result = { id, consultationNumber, status, message }
      const result = await api.post('/api/consultations', requestBody);

      if (!result || !result.consultationNumber) {
        throw new Error('상담 신청 응답이 올바르지 않습니다.');
      }

      // 3) success 페이지 이동
      const params = new URLSearchParams({
        no: result.consultationNumber,
        category: payload.category,
        productName: payload.productName || '',
      });
      window.location.href = `application-success.html?${params.toString()}`;
    } catch (err) {
      console.error('[DapickApplication] 신청 실패:', err);
      alert(
        '신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.\n계속 발생 시 카카오톡 상담으로 연락주세요.',
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 자동 복귀 (로그인 후 페이지 진입 시 호출)
  // ════════════════════════════════════════════════════
  function resumeIfPending() {
    if (!isLoggedIn()) return;

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      sessionStorage.removeItem(STORAGE_KEY);

      const ok = confirm(
        `이전에 진행하던 신청을 이어서 처리하시겠습니까?\n\n상품: ${payload.productName || '-'}`,
      );
      if (ok) {
        submitToBackend(payload);
      }
    } catch (e) {
      console.warn('[DapickApplication] resumeIfPending 파싱 실패', e);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  // ════════════════════════════════════════════════════
  // 공개 API
  // ════════════════════════════════════════════════════
  return {
    apply,
    resumeIfPending,
    isLoggedIn,
  };
})();
