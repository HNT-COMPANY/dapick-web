// ════════════════════════════════════════════════════════════════
// rental.js 수정 가이드 — submitApplication()을 /api/consultations로 전환
// ════════════════════════════════════════════════════════════════
//
// [교체 1] window.submitApplication 함수 전체를 아래로 교체
// [교체 2] rental.html 폼에서 생년월일(#fBirth) 필드 숨김 (HTML 한 줄)
//
// 변경 핵심:
//   - POST 대상: /api/applications → /api/consultations
//   - birthDate 제거 (백엔드에서 뺌)
//   - monthlyPrice 추가 (consultation DTO에서 @NotNull @Positive 필수 — 누락 시 400)
//   - selectedOptions에 색상/문의사항 담기 (컬럼 없이 jsonb에 보존)
//   - confirmedFirstWarning: 화면 체크만 강제, 전송 안 함
//   - 응답 파싱: applicationNumber → consultationNumber
//   - 응답 구조: ApiResponse 래퍼(res.body.data.consultationNumber)
// ════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// [교체 1] window.submitApplication — 전체 교체
// ───────────────────────────────────────────────────────────────
window.submitApplication = function () {
  var errEl = document.getElementById('rApplyErr');
  errEl.textContent = '';

  var name = document.getElementById('fName').value.trim();
  var phone = document.getElementById('fPhone').value.trim();
  var email = document.getElementById('fEmail').value.trim();
  var bank = document.getElementById('fBank').value.trim();
  var addr = document.getElementById('fAddr').value.trim();
  var memo = document.getElementById('fMemo').value.trim();
  var agreePrivacy = document.getElementById('fPrivacy').checked;
  var agreeWarning = document.getElementById('fWarning').checked;
  var agreeMarketing = document.getElementById('fMarketing').checked;
  var agreeEmailInfo = document.getElementById('fEmailInfo').checked;

  // ── 프론트 검증 (백엔드 DTO 규칙과 일치) ──
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

  if (!selectedProduct || !selectedProduct.id) {
    errEl.textContent = '상품 정보가 올바르지 않습니다. 다시 선택해주세요.';
    return;
  }

  var token = localStorage.getItem('dapick_token');
  if (!token) {
    errEl.textContent = '로그인이 필요합니다.';
    return;
  }

  // ── 월 렌탈료: consultation DTO는 monthlyPrice @NotNull @Positive ──
  var monthly = monthlyOf(selectedProduct);
  if (monthly == null || isNaN(monthly) || Number(monthly) <= 0) {
    errEl.textContent =
      '이 상품은 월 요금이 설정되어 있지 않아 온라인 신청이 어렵습니다. 카카오 상담을 이용해주세요.';
    return;
  }

  // ── selectedOptions: 색상/문의사항을 jsonb에 보존 (전용 컬럼 없이) ──
  var selectedOptions = {};
  if (selectedColor) selectedOptions.color = selectedColor;
  if (memo) selectedOptions.inquiry = memo;

  var payload = {
    productId: selectedProduct.id,
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

  var submitBtn = document.getElementById('rApplySubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = '신청 중...';

  fetch(API_BASE + '/api/consultations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  })
    .then(function (r) {
      return r.json().then(function (body) {
        return { ok: r.ok, status: r.status, body: body };
      });
    })
    .then(function (res) {
      submitBtn.disabled = false;
      submitBtn.textContent = '상담 신청하기';

      // ApiResponse 래퍼: { success, data: { consultationNumber, ... }, message }
      var data = res.body && res.body.data ? res.body.data : null;
      var num = data ? data.consultationNumber : '';

      if (res.ok && num) {
        document.getElementById('rDoneNum').textContent = num;
        document.getElementById('rApplyStepForm').style.display = 'none';
        document.getElementById('rApplyStepDone').style.display = 'block';
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
      console.error('[rental] submit failed', e);
      submitBtn.disabled = false;
      submitBtn.textContent = '상담 신청하기';
      errEl.textContent =
        '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    });
};

// ───────────────────────────────────────────────────────────────
// [교체 2] rental.html — 생년월일 필드 숨김
// ───────────────────────────────────────────────────────────────
// 아래 블록을 찾아서:
//
//   <div class="r-field">
//     <label>생년월일<span class="req">*</span></label>
//     <input type="date" id="fBirth"/>
//   </div>
//
// style="display:none"을 추가 (id는 남겨둬야 JS가 안 깨짐):
//
//   <div class="r-field" style="display:none">
//     <label>생년월일</label>
//     <input type="date" id="fBirth"/>
//   </div>
//
// ※ 수정본 submitApplication은 #fBirth를 읽지 않으므로, 칸만 숨기면 됨.
//   완전히 삭제해도 되지만, 2단계(개통 워크플로우)에서 부활 가능성 있어 숨김 권장.
