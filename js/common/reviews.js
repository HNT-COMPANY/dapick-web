// ════════════════════════════════════════════════════
// reviews.js — 다픽 web 공용 리뷰 모듈
// ────────────────────────────────────────────────────
// rental-detail / water-detail 양쪽에서 재사용.
// 사용법: 상품 로드 완료 후 initReviews(productId) 호출.
//   예) initReviews(RD_PRODUCT.id)  /  initReviews(WD_PRODUCT.id)
//
// 이번 범위:
//   - 평점 요약(평균 별점 + 리뷰 수)
//   - 리뷰 목록(백엔드가 APPROVED만 내려줌, authorName 마스킹됨)
//   - 작성 폼(별점 1~5 + 내용)
//   삭제는 제외(추후 마이페이지).
//
// 의존(상세 페이지에 이미 로드됨):
//   - api.js   : api.get / api.post (토큰 자동 부착·401 갱신·ApiResponse 언래핑)
//   - auth.js  : isLoggedIn()
//   - utils.js : showToast()
//
// 백엔드 API:
//   GET  /api/products/{id}/reviews        (공개, APPROVED 최신순)
//   GET  /api/products/{id}/reviews/stats  (공개, {averageRating, reviewCount})
//   POST /api/products/{id}/reviews        (인증, {rating, content})
//     403 REVIEW_NOT_ELIGIBLE   : 그 상품 상담 DONE 이력 없음
//     409 REVIEW_ALREADY_WRITTEN: 이미 작성함
// ════════════════════════════════════════════════════
(function (global) {
  'use strict';

  // ── XSS 방어: 따옴표까지 막는 강한 버전 (gnb-user.js 수준) ──────
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── 모듈 상태 ─────────────────────────────────────────────────
  var state = {
    productId: null,
    consultationId: null, // 이 상품의 완료 상담 id (consultation 경로 작성용)
    myRating: 0, // 입력 UI에서 선택한 별점 (1~5)
    imageUrls: [], // 업로드 완료된 이미지 URL (최대 5)
    uploading: false, // 이미지 업로드 진행 중
    submitting: false,
    submitted: false, // 이번 세션에서 작성 완료(또는 이미 작성) → 폼 잠금
  };
  var stylesInjected = false;

  // ── 안전 래퍼: 의존 함수 미로드 대비 ──────────────────────────
  function loggedIn() {
    return typeof isLoggedIn === 'function'
      ? isLoggedIn()
      : !!localStorage.getItem('dapick_token');
  }
  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
    else if (type === 'error') alert(msg);
  }

  // ── 진입점 ────────────────────────────────────────────────────
  function initReviews(productId) {
    var root = document.getElementById('reviewSection');
    if (!root) {
      console.warn('[reviews] #reviewSection 엘리먼트가 없습니다.');
      return;
    }
    if (!productId) {
      console.warn('[reviews] productId가 없어 초기화를 건너뜁니다.');
      root.style.display = 'none';
      return;
    }

    state.productId = productId;
    state.consultationId = null;
    state.myRating = 0;
    state.imageUrls = [];
    state.uploading = false;
    state.submitting = false;
    state.submitted = false;

    injectStyles();
    renderShell(root);
    bindWriteArea(root);
    loadStats();
    loadList();
  }

  // ── 셸 렌더 ───────────────────────────────────────────────────
  function renderShell(root) {
    root.innerHTML =
      '<div class="dpr">' +
      '  <h2 class="dpr-title">상품 후기</h2>' +
      // 평점 요약
      '  <div class="dpr-summary" id="dprSummary">' +
      '    <div class="dpr-avg-num" id="dprAvgNum">0.0</div>' +
      '    <div class="dpr-avg-right">' +
      '      <div class="dpr-stars dpr-stars--avg" id="dprAvgStars">' +
      avgStarsHtml(0) +
      '      </div>' +
      '      <div class="dpr-count" id="dprCount">아직 등록된 후기가 없어요</div>' +
      '    </div>' +
      '  </div>' +
      // 작성 영역 (로그인 상태에 따라 폼/안내 토글)
      '  <div class="dpr-write" id="dprWrite"></div>' +
      // 목록
      '  <div class="dpr-list" id="dprList">' +
      '    <div class="dpr-empty">후기를 불러오는 중...</div>' +
      '  </div>' +
      '</div>';
  }

  // ── 평점 요약 로드 ────────────────────────────────────────────
  function loadStats() {
    api
      .get('/api/products/' + state.productId + '/reviews/stats')
      .then(function (stats) {
        if (!stats) return;
        var avg =
          typeof stats.averageRating === 'number' ? stats.averageRating : 0;
        var count =
          typeof stats.reviewCount === 'number' ? stats.reviewCount : 0;

        var numEl = document.getElementById('dprAvgNum');
        var starsEl = document.getElementById('dprAvgStars');
        var countEl = document.getElementById('dprCount');
        if (numEl) numEl.textContent = avg.toFixed(1);
        if (starsEl) starsEl.innerHTML = avgStarsHtml(avg);
        if (countEl) {
          countEl.textContent =
            count > 0
              ? '후기 ' + count.toLocaleString() + '개'
              : '아직 등록된 후기가 없어요';
        }
        // 정수기 상세: 리뷰 탭 라벨 카운트 (id=reviewTabCount 있을 때만 — 렌탈 HTML엔 없어 무영향)
        var tabCountEl = document.getElementById('reviewTabCount');
        if (tabCountEl) {
          tabCountEl.textContent = count > 0 ? ' (' + count.toLocaleString() + ')' : '';
        }
      })
      .catch(function (e) {
        console.warn('[reviews] stats 로드 실패:', e && e.message);
      });
  }

  // ── 목록 로드 ─────────────────────────────────────────────────
  function loadList() {
    var listEl = document.getElementById('dprList');
    api
      .get('/api/products/' + state.productId + '/reviews')
      .then(function (reviews) {
        if (!listEl) return;
        var arr = Array.isArray(reviews) ? reviews : [];
        if (!arr.length) {
          listEl.innerHTML =
            '<div class="dpr-empty">첫 번째 후기를 남겨주세요!</div>';
          return;
        }
        listEl.innerHTML = arr.map(reviewItemHtml).join('');
      })
      .catch(function (e) {
        console.warn('[reviews] 목록 로드 실패:', e && e.message);
        if (listEl) {
          listEl.innerHTML =
            '<div class="dpr-empty">후기를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
        }
      });
  }

  // ── 리뷰 1건 HTML (escape 필수) ───────────────────────────────
  function reviewItemHtml(r) {
    var rating = clampRating(r && r.rating);
    var name = escapeHtml((r && r.authorName) || '익명');
    var content = escapeHtml((r && r.content) || '');
    var date = formatDate(r && r.createdAt);

    return (
      '<div class="dpr-item">' +
      '  <div class="dpr-item-head">' +
      '    <span class="dpr-stars dpr-stars--sm">' +
      solidStarsHtml(rating) +
      '    </span>' +
      '    <span class="dpr-item-name">' +
      name +
      '</span>' +
      (date ? '    <span class="dpr-item-date">' + date + '</span>' : '') +
      '  </div>' +
      (content
        ? '  <div class="dpr-item-content">' + content + '</div>'
        : '') +
      '</div>'
    );
  }

  // ── 작성 영역: 로그인 상태별 토글 ─────────────────────────────
  function bindWriteArea(root) {
    var wrap = root.querySelector('#dprWrite');
    if (!wrap) return;

    // [1] 비로그인 → 안내 + 로그인 유도
    if (!loggedIn()) {
      wrap.innerHTML =
        '<div class="dpr-login-gate">' +
        '  <span>로그인 후 후기를 작성할 수 있어요.</span>' +
        '  <button type="button" class="dpr-btn dpr-btn--ghost" id="dprLoginBtn">로그인하고 작성</button>' +
        '</div>';
      var loginBtn = wrap.querySelector('#dprLoginBtn');
      if (loginBtn) loginBtn.addEventListener('click', goLoginForReview);
      return;
    }

    // [2] 로그인 → 이 상품의 완료 상담(consultationId) 확인 후 폼/안내 분기
    //     (consultation 경로 통일: 상세에서 써도 통합 후기에 category 와 함께 저장됨)
    wrap.innerHTML =
      '<div class="dpr-login-gate"><span>작성 자격 확인 중...</span></div>';
    api
      .get('/api/reviews/eligible')
      .then(function (list) {
        var arr = Array.isArray(list) ? list : [];
        var match = arr.filter(function (c) {
          return c && c.productId === state.productId;
        });
        if (!match.length) {
          wrap.innerHTML =
            '<div class="dpr-login-gate"><span>이 상품의 상담 완료 후 후기를 작성할 수 있어요.</span></div>';
          return;
        }
        // 최신 미작성 상담 사용 (eligible 은 최신순). 상담이 남아있으면 다회 작성 가능.
        state.consultationId = match[0].consultationId;
        renderWriteForm(wrap);
      })
      .catch(function () {
        wrap.innerHTML =
          '<div class="dpr-login-gate"><span>작성 자격을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.</span></div>';
      });
  }

  // ── 작성 폼 렌더 (별점 + 내용 + 이미지 최대 5매) ─────────────
  function renderWriteForm(wrap) {
    wrap.innerHTML =
      '<div class="dpr-form" id="dprForm">' +
      '  <div class="dpr-form-label">별점</div>' +
      '  <div class="dpr-stars dpr-stars--input" id="dprInputStars" role="radiogroup" aria-label="별점 선택">' +
      inputStarsHtml(0) +
      '  </div>' +
      '  <textarea class="dpr-textarea" id="dprContent" rows="3" maxlength="1000" ' +
      'placeholder="상품에 대한 솔직한 후기를 남겨주세요. (선택)"></textarea>' +
      '  <div class="dpr-form-label">사진 (최대 5장, 선택)</div>' +
      '  <div class="dpr-uploads" id="dprUploads"></div>' +
      '  <div class="dpr-upload-row">' +
      '    <label class="dpr-upload-btn" id="dprUploadLabel">사진 추가' +
      '      <input type="file" id="dprFileInput" accept="image/*" multiple hidden>' +
      '    </label>' +
      '    <span class="dpr-upload-count" id="dprUploadCount">0 / 5</span>' +
      '  </div>' +
      '  <button type="button" class="dpr-btn dpr-btn--primary" id="dprSubmit">후기 등록</button>' +
      '</div>';

    // 별점 입력 바인딩
    var starsEl = wrap.querySelector('#dprInputStars');
    if (starsEl) {
      starsEl.querySelectorAll('.dpr-star-btn').forEach(function (btn) {
        var val = parseInt(btn.getAttribute('data-val'), 10);
        btn.addEventListener('click', function () {
          state.myRating = val;
          paintInputStars(starsEl, val);
        });
        btn.addEventListener('mouseenter', function () {
          paintInputStars(starsEl, val);
        });
      });
      starsEl.addEventListener('mouseleave', function () {
        paintInputStars(starsEl, state.myRating);
      });
    }

    // 이미지 업로드 바인딩
    var fileInput = wrap.querySelector('#dprFileInput');
    if (fileInput) fileInput.addEventListener('change', onFilesSelected);

    var submitBtn = wrap.querySelector('#dprSubmit');
    if (submitBtn) submitBtn.addEventListener('click', submitReview);

    renderUploads();
  }

  // ── 이미지 선택 → 업로드 (최대 5매) ───────────────────────────
  function onFilesSelected(e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!files.length) return;

    var remaining = 5 - state.imageUrls.length;
    if (remaining <= 0) {
      toast('이미지는 최대 5장까지 첨부할 수 있어요.', 'error');
      return;
    }
    var toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      toast('이미지는 최대 5장까지 첨부할 수 있어요.', 'info');
    }

    state.uploading = true;
    updateUploadUi();

    var jobs = toUpload.map(function (f) {
      return uploadImage(f)
        .then(function (data) {
          if (data && data.url) state.imageUrls.push(data.url);
        })
        .catch(function (err) {
          toast((err && err.message) || '이미지 업로드 실패', 'error');
        });
    });

    Promise.all(jobs).then(function () {
      state.uploading = false;
      renderUploads();
      updateUploadUi();
    });
  }

  // 이미지 업로드 (multipart) — api.js 는 JSON 전용이라 fetch 직접 사용.
  function uploadImage(file) {
    var fd = new FormData();
    fd.append('file', file);
    var token = localStorage.getItem('dapick_token');
    return fetch(BASE_URL + '/api/reviews/images', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: fd,
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e2) {
            /* 비-JSON 무시 */
          }
        }
        if (!res.ok) {
          throw new Error(
            (data && data.message) || '업로드 실패 (' + res.status + ')',
          );
        }
        return (data && (data.data != null ? data.data : data)) || {};
      });
    });
  }

  // ── 업로드 썸네일 목록 렌더 ───────────────────────────────────
  function renderUploads() {
    var box = document.getElementById('dprUploads');
    if (!box) return;
    box.innerHTML = state.imageUrls
      .map(function (url, i) {
        return (
          '<div class="dpr-thumb">' +
          '<img src="' +
          escapeHtml(url) +
          '" alt="">' +
          '<button type="button" class="dpr-thumb-del" data-idx="' +
          i +
          '" aria-label="삭제">×</button>' +
          '</div>'
        );
      })
      .join('');
    box.querySelectorAll('.dpr-thumb-del').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.getAttribute('data-idx'), 10);
        state.imageUrls.splice(idx, 1);
        renderUploads();
      });
    });
    updateUploadUi();
  }

  function updateUploadUi() {
    var cnt = document.getElementById('dprUploadCount');
    if (cnt) {
      cnt.textContent =
        state.imageUrls.length + ' / 5' + (state.uploading ? ' (업로드 중...)' : '');
    }
    var label = document.getElementById('dprUploadLabel');
    if (label) {
      var disabled = state.imageUrls.length >= 5 || state.uploading;
      label.style.opacity = disabled ? '.5' : '1';
      label.style.pointerEvents = disabled ? 'none' : 'auto';
    }
  }

  // ── 비로그인 → 로그인 페이지 (복귀 경로 저장) ─────────────────
  function goLoginForReview() {
    if (typeof saveReturnUrl === 'function') saveReturnUrl(); // auth.js
    toast('로그인 후 후기를 작성할 수 있어요.', 'info');
    setTimeout(function () {
      window.location.href = '/login';
    }, 800);
  }

  // ── 제출 ──────────────────────────────────────────────────────
  function submitReview() {
    if (state.submitting || state.submitted) return;
    if (state.uploading) {
      toast('이미지 업로드가 끝난 뒤 등록해주세요.', 'info');
      return;
    }
    if (!state.consultationId) {
      toast('작성 자격 정보를 확인하지 못했습니다.', 'error');
      return;
    }

    var rating = clampRating(state.myRating);
    if (!rating) {
      toast('별점을 선택해주세요.', 'error');
      return;
    }
    var contentEl = document.getElementById('dprContent');
    var content = contentEl ? contentEl.value.trim() : '';

    state.submitting = true;
    setSubmitLoading(true);

    // consultation 경로 통일 — 상세에서 작성해도 category 와 함께 통합 후기에 저장됨
    api
      .post('/api/reviews', {
        consultationId: state.consultationId,
        rating: rating,
        content: content || null,
        imageUrls: state.imageUrls.length ? state.imageUrls.slice() : null,
      })
      .then(function (res) {
        // api.post가 401 갱신 실패 시 null 반환(이미 로그인 페이지로 이동됨)
        if (res === null) return;
        state.submitted = true;
        state.imageUrls = [];
        lockFormAsPending();
        toast(
          '후기가 등록되었습니다. 승인 후 목록에 노출됩니다. 감사합니다! 🎉',
          'success',
        );
      })
      .catch(function (e) {
        toast(submitErrorMessage(e), 'error');
      })
      .finally(function () {
        state.submitting = false;
        setSubmitLoading(false);
      });
  }

  // 서버 에러 → 사용자 메시지 매핑.
  // api.js는 status code를 따로 노출하지 않고 data.message를 그대로
  //   Error(data.message || `요청 실패 (${status})`) 형태로 throw 한다.
  // 백엔드 ErrorCode 메시지(한글)를 기준으로 매칭:
  //   REVIEW_NOT_ELIGIBLE(403):
  //     "상담 완료 이력이 있는 회원만 리뷰를 작성할 수 있습니다."
  //   REVIEW_ALREADY_WRITTEN(409): "이미 작성한 리뷰가 있습니다."
  // 정책: 서버 메시지가 이미 사용자 친화적이라 기본은 그대로 노출.
  //   단, 자격 없음(403)만 행동 유도 문구로 다듬는다.
  //   메시지가 비어 status로만 떨어지는 경우 (403)/(409) 폴백.
  function submitErrorMessage(e) {
    var m = (e && e.message) || '';

    // 자격 없음(403) → 행동 유도 문구로 다듬음
    if (/상담|회원만|ELIGIBLE/i.test(m) || /\(403\)/.test(m)) {
      return '상담 완료 후 작성 가능합니다.';
    }
    // 이미 작성(409) → 서버 메시지가 충분히 친화적이라 그대로 노출
    if (/이미|ALREADY/i.test(m)) {
      return m;
    }
    // 메시지 없이 status(409)만 온 경우 폴백
    if (/\(409\)/.test(m)) {
      return '이미 작성한 리뷰가 있습니다.';
    }
    // 그 외 → 서버 메시지 그대로 (없으면 기본 문구)
    return m || '후기 등록에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }

  function setSubmitLoading(on) {
    var btn = document.getElementById('dprSubmit');
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? '등록 중...' : '후기 등록';
  }

  function lockFormAsPending() {
    var wrap = document.getElementById('dprWrite');
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="dpr-pending">' +
      '  ✅ 후기가 접수되었습니다. 관리자 승인 후 목록에 표시됩니다.' +
      '</div>';
  }

  // ── 별점 렌더 헬퍼 ────────────────────────────────────────────
  function clampRating(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > 5) return 5;
    return n;
  }

  // 평균 별점(소수) — 채움 너비 오버레이 방식
  function avgStarsHtml(avg) {
    var pct = Math.max(0, Math.min(100, (Number(avg) / 5) * 100));
    return (
      '<span class="dpr-stars-wrap">' +
      '<span class="dpr-stars-bg">★★★★★</span>' +
      '<span class="dpr-stars-fill" style="width:' +
      pct +
      '%;">★★★★★</span>' +
      '</span>'
    );
  }

  // 정수 별점(목록 항목) — 채운 별 n개 + 빈 별
  function solidStarsHtml(rating) {
    var r = clampRating(rating);
    var s = '';
    for (var i = 1; i <= 5; i++) {
      s +=
        '<span class="dpr-star ' +
        (i <= r ? 'is-on' : '') +
        '">★</span>';
    }
    return s;
  }

  // 입력 별점 버튼
  function inputStarsHtml(selected) {
    var sel = clampRating(selected);
    var s = '';
    for (var i = 1; i <= 5; i++) {
      s +=
        '<button type="button" class="dpr-star-btn ' +
        (i <= sel ? 'is-on' : '') +
        '" data-val="' +
        i +
        '" aria-label="' +
        i +
        '점">★</button>';
    }
    return s;
  }

  function paintInputStars(container, upto) {
    var n = clampRating(upto);
    container.querySelectorAll('.dpr-star-btn').forEach(function (btn) {
      var val = parseInt(btn.getAttribute('data-val'), 10);
      btn.classList.toggle('is-on', val <= n);
    });
  }

  // ── 날짜 포맷 (YYYY.MM.DD) ────────────────────────────────────
  function formatDate(raw) {
    if (!raw) return '';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '.' + mm + '.' + dd;
  }

  // ── 스타일 주입 (별도 CSS 파일 없이 자기완결) ─────────────────
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css =
      '.dpr{max-width:920px;margin:32px auto 0;padding:0 16px;' +
      "font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.dpr-title{font-size:20px;font-weight:700;margin:0 0 16px;}' +
      // 요약
      '.dpr-summary{display:flex;align-items:center;gap:18px;' +
      'padding:18px 20px;background:#faf8ff;border:1px solid #ece5fb;' +
      'border-radius:14px;margin-bottom:18px;}' +
      '.dpr-avg-num{font-size:38px;font-weight:800;line-height:1;color:#6C3FC5;}' +
      '.dpr-avg-right{display:flex;flex-direction:column;gap:4px;}' +
      '.dpr-count{font-size:13px;color:#8a8a99;}' +
      // 별점 표시(평균) — 오버레이
      '.dpr-stars-wrap{position:relative;display:inline-block;' +
      'font-size:20px;line-height:1;letter-spacing:2px;}' +
      '.dpr-stars-bg{color:#dcd7e8;}' +
      '.dpr-stars-fill{position:absolute;top:0;left:0;overflow:hidden;' +
      'white-space:nowrap;color:#ffb400;}' +
      // 목록
      '.dpr-list{display:flex;flex-direction:column;gap:0;}' +
      '.dpr-empty{padding:28px 0;text-align:center;color:#9a9aa5;font-size:14px;}' +
      '.dpr-item{padding:16px 2px;border-top:1px solid #eee;}' +
      '.dpr-item:first-child{border-top:none;}' +
      '.dpr-item-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;}' +
      '.dpr-item-name{font-size:13px;font-weight:600;color:#444;}' +
      '.dpr-item-date{font-size:12px;color:#aaa;margin-left:auto;}' +
      '.dpr-item-content{font-size:14px;line-height:1.6;color:#333;' +
      'white-space:pre-wrap;word-break:break-word;}' +
      // 별(정수) 표시
      '.dpr-stars--sm .dpr-star{font-size:14px;}' +
      '.dpr-star{color:#dcd7e8;letter-spacing:1px;}' +
      '.dpr-star.is-on{color:#ffb400;}' +
      // 작성 영역
      '.dpr-write{margin-bottom:20px;}' +
      '.dpr-login-gate{display:flex;align-items:center;gap:12px;flex-wrap:wrap;' +
      'padding:16px 18px;background:#f6f6fa;border-radius:12px;' +
      'font-size:14px;color:#555;}' +
      '.dpr-form{padding:16px 18px;background:#f9f9fc;border-radius:12px;}' +
      '.dpr-form-label{font-size:13px;font-weight:600;color:#666;margin-bottom:6px;}' +
      '.dpr-stars--input{display:inline-flex;gap:2px;margin-bottom:12px;}' +
      '.dpr-star-btn{background:none;border:none;cursor:pointer;padding:0 2px;' +
      'font-size:28px;line-height:1;color:#dcd7e8;transition:color .12s;}' +
      '.dpr-star-btn.is-on{color:#ffb400;}' +
      '.dpr-textarea{width:100%;box-sizing:border-box;border:1px solid #e0dced;' +
      'border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;' +
      'resize:vertical;margin-bottom:12px;}' +
      '.dpr-textarea:focus{outline:none;border-color:#6C3FC5;}' +
      '.dpr-btn{border:none;border-radius:10px;cursor:pointer;font-size:14px;' +
      "font-weight:600;font-family:inherit;padding:10px 18px;}" +
      '.dpr-btn--primary{background:#6C3FC5;color:#fff;}' +
      '.dpr-btn--primary:disabled{opacity:.6;cursor:default;}' +
      '.dpr-btn--ghost{background:#fff;color:#6C3FC5;border:1px solid #6C3FC5;}' +
      '.dpr-pending{padding:16px 18px;background:#eafaf0;border:1px solid #c8ebd5;' +
      'border-radius:12px;font-size:14px;color:#1f8a4c;}' +
      // 이미지 업로드
      '.dpr-uploads{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}' +
      '.dpr-thumb{position:relative;width:64px;height:64px;border-radius:8px;' +
      'overflow:hidden;border:1px solid #e0dced;}' +
      '.dpr-thumb img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.dpr-thumb-del{position:absolute;top:2px;right:2px;width:18px;height:18px;' +
      'line-height:16px;text-align:center;border:none;border-radius:50%;' +
      'background:rgba(0,0,0,.55);color:#fff;font-size:13px;cursor:pointer;padding:0;}' +
      '.dpr-upload-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}' +
      '.dpr-upload-btn{display:inline-block;padding:8px 14px;border:1px dashed #b7a9e0;' +
      'border-radius:10px;color:#6C3FC5;font-size:13px;font-weight:600;cursor:pointer;background:#fff;}' +
      '.dpr-upload-count{font-size:12px;color:#8a8a99;}';

    var styleEl = document.createElement('style');
    styleEl.id = 'dpr-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ── 공개 API ──────────────────────────────────────────────────
  global.initReviews = initReviews;
  global.DapickReviews = { init: initReviews };
})(window);
