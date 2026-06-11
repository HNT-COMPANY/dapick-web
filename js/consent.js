// ════════════════════════════════════════════════════
// consent.js — 동의서 전체 HTML 계약서/서명 로직
//   진입: /consent?token=xxx  (쿼리스트링 방식)
//   GET  /api/consent/{token}        진입 정보 조회
//   POST /api/consent/{token}/sign   서명 제출
//   둘 다 공개 엔드포인트 → { skipAuthRefresh: true }
//
//   화면: 동의서 본문(제1~6조)은 HTML, 갑/을 계약 표는 <table>.
//        을(계약자) 성명/연락처 input·서명박스에 직접 입력·서명.
// ════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── DOM 참조 ──────────────────────────────────────
  const el = {
    loading: document.getElementById('state-loading'),
    invalid: document.getElementById('state-invalid'),
    invalidTitle: document.getElementById('invalid-title'),
    invalidDesc: document.getElementById('invalid-desc'),
    signed: document.getElementById('state-signed'),
    done: document.getElementById('state-done'),
    form: document.getElementById('state-form'),

    consultationNo: document.getElementById('consultation-no'),
    name: document.getElementById('signerName'),
    phone: document.getElementById('signerPhone'),

    gapDate: document.getElementById('gap-date'),
    eulDate: document.getElementById('eul-date'),

    signCell: document.getElementById('sign-cell'),
    signCellPlaceholder: document.getElementById('sign-cell-placeholder'),
    signCellImg: document.getElementById('sign-cell-img'),

    formError: document.getElementById('form-error'),
    btnSubmit: document.getElementById('btn-submit'),

    // 서명 모달
    overlay: document.getElementById('sign-overlay'),
    canvas: document.getElementById('sign-canvas'),
    signHint: document.getElementById('sign-hint'),
    signClear: document.getElementById('sign-clear'),
    signCancel: document.getElementById('sign-cancel'),
    signConfirm: document.getElementById('sign-confirm'),
  };

  // 확정된 서명 dataURL (data:image/png;base64,... prefix 포함)
  let signatureDataUrl = null;

  // ── 단일 화면 노출 ────────────────────────────────
  function show(node) {
    [el.loading, el.invalid, el.signed, el.done, el.form].forEach((n) => {
      n.classList.add('is-hidden');
    });
    node.classList.remove('is-hidden');
  }

  function showInvalid(title, desc) {
    el.invalidTitle.textContent = title;
    if (desc) el.invalidDesc.textContent = desc;
    show(el.invalid);
  }

  // ── 오늘 날짜 (KST, YYYY-MM-DD) ───────────────────
  function todayKST() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  // ── 토큰 추출 ─────────────────────────────────────
  const token = new URLSearchParams(window.location.search).get('token');

  // ════════════════════════════════════════════════
  //  서명 캔버스 (모달)
  // ════════════════════════════════════════════════
  let ctx = null;
  let drawing = false;
  let hasStroke = false;

  function setupCanvas() {
    const canvas = el.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14223a';
  }

  function pointFromEvent(e) {
    const rect = el.canvas.getBoundingClientRect();
    const src = e.touches && e.touches.length ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function startDraw(e) {
    drawing = true;
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    if (!hasStroke) {
      hasStroke = true;
      el.signHint.classList.add('is-hidden');
    }
  }

  function moveDraw(e) {
    if (!drawing) return;
    const p = pointFromEvent(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function endDraw() { drawing = false; }

  function clearCanvas() {
    if (ctx) ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    hasStroke = false;
    el.signHint.classList.remove('is-hidden');
  }

  function openSignOverlay() {
    el.overlay.classList.remove('is-hidden');
    setupCanvas();   // 보인 뒤 크기 확정
    clearCanvas();
  }

  function closeSignOverlay() {
    el.overlay.classList.add('is-hidden');
  }

  function confirmSignature() {
    if (!hasStroke) {
      el.signHint.classList.remove('is-hidden');
      return; // 빈 서명 확정 불가
    }
    signatureDataUrl = el.canvas.toDataURL('image/png'); // prefix 포함
    el.signCellImg.src = signatureDataUrl;
    el.signCellImg.classList.remove('is-hidden');
    el.signCellPlaceholder.classList.add('is-hidden');
    closeSignOverlay();
  }

  function bindSignEvents() {
    el.signCell.addEventListener('click', openSignOverlay);

    el.canvas.addEventListener('mousedown', startDraw);
    el.canvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);

    el.canvas.addEventListener('touchstart', function (e) {
      e.preventDefault(); startDraw(e);
    }, { passive: false });
    el.canvas.addEventListener('touchmove', function (e) {
      e.preventDefault(); moveDraw(e);
    }, { passive: false });
    el.canvas.addEventListener('touchend', function (e) {
      e.preventDefault(); endDraw();
    }, { passive: false });
    el.canvas.addEventListener('touchcancel', endDraw);

    el.signClear.addEventListener('click', clearCanvas);
    el.signCancel.addEventListener('click', closeSignOverlay);
    el.signConfirm.addEventListener('click', confirmSignature);
  }

  // ════════════════════════════════════════════════
  //  제출
  // ════════════════════════════════════════════════
  function setSubmitting(on) {
    el.btnSubmit.disabled = on;
    el.btnSubmit.textContent = on ? '제출 중…' : '동의 후 제출';
  }

  function showFormError(msg) {
    el.formError.textContent = msg;
    el.formError.classList.remove('is-hidden');
  }
  function clearFormError() {
    el.formError.textContent = '';
    el.formError.classList.add('is-hidden');
  }

  async function submit() {
    clearFormError();

    const signerName = el.name.value.trim();
    const signerPhone = el.phone.value.trim();

    if (!signerName) { showFormError('성명을 입력해 주세요.'); return; }
    if (!signerPhone) { showFormError('연락처를 입력해 주세요.'); return; }
    if (!signatureDataUrl) { showFormError('서명을 해주세요.'); return; }

    const body = { signerName, signerPhone, signatureImage: signatureDataUrl };

    setSubmitting(true);
    try {
      await api.post('/api/consent/' + token + '/sign', body, {
        skipAuthRefresh: true,
      });

      // 성공 → 갑/을 서명일 (자동입력) 자리에 오늘 날짜 표시 (실제 PDF 합성은 백엔드)
      const today = todayKST();
      el.gapDate.textContent = today;
      el.eulDate.textContent = today;
      el.gapDate.classList.add('is-filled');
      el.eulDate.classList.add('is-filled');

      setTimeout(function () { show(el.done); }, 800);
    } catch (err) {
      if (err && err.status === 409) {
        show(el.signed);
        return;
      }
      showFormError('제출 중 문제가 발생했습니다. 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }

  // ════════════════════════════════════════════════
  //  진입 흐름
  // ════════════════════════════════════════════════
  function isExpired(tokenExpiresAt) {
    if (!tokenExpiresAt) return false;
    const exp = new Date(tokenExpiresAt);
    if (isNaN(exp.getTime())) return false;
    return exp.getTime() <= Date.now();
  }

  async function init() {
    if (!token) {
      showInvalid('유효하지 않은 접근입니다', '올바른 링크로 다시 접속해 주세요.');
      return;
    }

    let data;
    try {
      data = await api.get('/api/consent/' + token, { skipAuthRefresh: true });
    } catch (err) {
      showInvalid('만료되었거나 유효하지 않은 링크입니다', '링크를 다시 확인해 주세요.');
      return;
    }

    if (!data) {
      showInvalid('만료되었거나 유효하지 않은 링크입니다', '링크를 다시 확인해 주세요.');
      return;
    }

    if (data.status === 'SIGNED') {
      show(el.signed);
      return;
    }

    if (isExpired(data.tokenExpiresAt)) {
      showInvalid('만료되었거나 유효하지 않은 링크입니다', '유효 기간이 지난 링크입니다.');
      return;
    }

    // 정상(SENT)
    // 성명/연락처 안내문은 고정 placeholder("고객성함"/"고객연락처") 사용.
    // 프리필(signerNamePrefill 등)은 화면에 더미값으로 박지 않음 — 고객이 직접 입력.
    el.consultationNo.textContent = data.consultationNumber || '-';

    show(el.form);

    bindSignEvents();
    el.btnSubmit.addEventListener('click', submit);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
