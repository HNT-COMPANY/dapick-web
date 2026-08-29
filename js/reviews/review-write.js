//
// review-write.js — 간편신청 고객 후기 작성 (/r/{토큰})
//
// 자격은 URL 의 토큰 하나뿐이다. 로그인도, 회원 토큰도 쓰지 않는다.
// 그래서 api.js 를 안 쓰고 fetch 를 직접 부른다 — api.js 는 localStorage 의
// 회원 토큰을 모든 요청에 붙이고 401 에 자동 갱신을 걸어서, 이 화면에서는
// 남의 폰에 남은 만료 토큰이 원인 모를 흐름을 만든다.
//
// 서버:
//   GET  /api/review-invite/{token}          링크 열기
//   POST /api/review-invite/{token}/images   사진 한 장 (multipart)
//   POST /api/review-invite/{token}/review   후기 저장 (PENDING 으로 들어감)
//
(function () {
  'use strict';

  var API = (typeof DAPICK_CONFIG !== 'undefined' && DAPICK_CONFIG.API_BASE_URL)
    ? DAPICK_CONFIG.API_BASE_URL
    : 'https://api.dapick.co.kr';

  var MAX_PHOTOS = 5;

  // ── 상태 ────────────────────────────────────────────
  var token = readToken();
  var invite = null;        // 서버가 준 링크 정보
  var rating = 0;
  var photos = [];          // 업로드가 끝난 URL 목록
  var tags = [];            // 고른 해시태그
  var pickedCategoryId = null;
  var submitting = false;

  // ── 시작 ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', start);

  function start() {
    bindOnce();
    if (!token) {
      // 토큰이 아예 없다 = 주소를 잘못 눌렀거나 문자에서 잘려 들어왔다.
      return fail(404, '주소가 온전하지 않습니다. 문자로 받으신 링크를 그대로 눌러주세요.');
    }
    open();
  }

  /**
   * 토큰 읽기.
   * 운영은 /r/{토큰}, 로컬(Live Server)은 워커가 안 도니까 ?t={토큰} 으로 연다.
   * 두 곳 다 받아야 로컬에서 확인하고 배포할 수 있다.
   */
  function readToken() {
    var m = (location.pathname || '').match(/\/r\/([A-Za-z0-9_-]{16,64})\/?$/);
    if (m) return m[1];
    try {
      return new URLSearchParams(location.search).get('t') || '';
    } catch (e) {
      return '';
    }
  }

  // ── 서버 호출 ───────────────────────────────────────
  function req(method, path, body) {
    var opt = { method: method };
    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        opt.body = body;   // Content-Type 은 브라우저가 boundary 까지 붙여 준다. 손대면 깨진다.
      } else {
        opt.headers = { 'Content-Type': 'application/json' };
        opt.body = JSON.stringify(body);
      }
    }
    return fetch(API + path, opt).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { /* 비-JSON 무시 */ } }
        if (!res.ok) {
          var err = new Error((data && data.message) || ('요청 실패 (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        // 백엔드는 ApiResponse 로 감싸서 준다 — 알맹이는 data.data
        return (data && data.data !== undefined) ? data.data : data;
      });
    });
  }

  // ── 링크 열기 ───────────────────────────────────────
  function open() {
    req('GET', '/api/review-invite/' + encodeURIComponent(token))
      .then(function (res) {
        invite = res;
        draw();
        show('rw-form');
      })
      .catch(function (e) { fail(e.status, e.message); });
  }

  function draw() {
    text('rw-name', invite.customerName || '고객');
    text('rw-no', invite.applicationNo || '-');
    text('rw-expire', fmtDate(invite.expiresAt));

    var target = el('rw-target');
    var pick = el('rw-pick');

    if (invite.needCategoryPick) {
      // 상품도 카테고리도 안 정해진 옛 접수 — 고객이 대분류를 고른다.
      pick.hidden = false;
      drawCategoryChips(invite.categoryOptions || []);
    } else {
      target.hidden = false;
      text('rw-target-name', invite.productName || invite.categoryName || '상담 건');
      text('rw-target-cat', invite.productName && invite.categoryName ? invite.categoryName : '');
      var img = el('rw-target-img');
      if (invite.productImageUrl) {
        img.src = invite.productImageUrl;
        img.hidden = false;
      }
    }

    drawStars();
    drawTagChips(invite.hashtagOptions || []);
  }

  function drawCategoryChips(list) {
    var box = el('rw-cat-chips');
    box.innerHTML = '';
    list.forEach(function (c) {
      var b = chip(c.name);
      b.addEventListener('click', function () {
        pickedCategoryId = c.id;
        Array.prototype.forEach.call(box.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      box.appendChild(b);
    });
  }

  function drawTagChips(list) {
    var box = el('rw-tag-chips');
    box.innerHTML = '';
    list.forEach(function (name) {
      var b = chip('#' + name);
      b.addEventListener('click', function () {
        var i = tags.indexOf(name);
        if (i >= 0) { tags.splice(i, 1); b.classList.remove('on'); return; }
        if (tags.length >= 5) return toast('해시태그는 5개까지 고를 수 있습니다.');
        tags.push(name);
        b.classList.add('on');
      });
      box.appendChild(b);
    });
  }

  function drawStars() {
    var box = el('rw-stars');
    box.innerHTML = '';
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rw-star';
        b.textContent = '★';
        b.setAttribute('aria-label', n + '점');
        b.addEventListener('click', function () { rating = n; paintStars(); });
        box.appendChild(b);
      })(i);
    }
  }

  function paintStars() {
    var box = el('rw-stars');
    Array.prototype.forEach.call(box.children, function (b, i) {
      b.classList.toggle('on', i < rating);
    });
  }

  // ── 사진 ────────────────────────────────────────────
  function bindOnce() {
    var file = el('rw-file');
    if (file) file.addEventListener('change', onPick);

    var content = el('rw-content');
    if (content) {
      content.addEventListener('input', function () {
        text('rw-content-count', String(content.value.length));
      });
    }

    var submit = el('rw-submit');
    if (submit) submit.addEventListener('click', onSubmit);
  }

  function onPick(e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';   // 같은 파일을 다시 골라도 change 가 뜨게 비운다
    if (!files.length) return;

    var room = MAX_PHOTOS - photos.length;
    if (room <= 0) return toast('사진은 ' + MAX_PHOTOS + '장까지 올릴 수 있습니다.');
    if (files.length > room) {
      toast('앞의 ' + room + '장만 올립니다. (최대 ' + MAX_PHOTOS + '장)');
      files = files.slice(0, room);
    }

    setUploading(true);
    // 한 장씩 차례로 올린다. 한꺼번에 던지면 폰 회선에서 잘 끊기고,
    // 어디서 끊겼는지 알려 주기도 어렵다.
    files.reduce(function (chain, f) {
      return chain.then(function () { return upload(f); });
    }, Promise.resolve())
      .catch(function (err) { toast(err.message || '사진을 올리지 못했습니다.'); })
      .then(function () { setUploading(false); drawPhotos(); });
  }

  function upload(file) {
    var fd = new FormData();
    fd.append('file', file);
    return req('POST', '/api/review-invite/' + encodeURIComponent(token) + '/images', fd)
      .then(function (res) {
        if (res && res.url) photos.push(res.url);
        drawPhotos();
      });
  }

  function setUploading(on) {
    var label = el('rw-file-label');
    var wrap = label ? label.parentNode : null;
    if (label) label.textContent = on ? '올리는 중…' : '＋ 사진 올리기';
    if (wrap) wrap.classList.toggle('busy', on);
    var input = el('rw-file');
    if (input) input.disabled = on;
  }

  function drawPhotos() {
    var box = el('rw-photos');
    box.innerHTML = '';
    photos.forEach(function (url, idx) {
      var d = document.createElement('div');
      d.className = 'rw-photo';

      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      d.appendChild(img);

      var x = document.createElement('button');
      x.type = 'button';
      x.textContent = '✕';
      x.setAttribute('aria-label', '이 사진 빼기');
      x.addEventListener('click', function () { photos.splice(idx, 1); drawPhotos(); });
      d.appendChild(x);

      box.appendChild(d);
    });

    var label = el('rw-file-label');
    if (label && !el('rw-file').disabled) {
      label.textContent = photos.length
        ? '＋ 사진 더 올리기 (' + photos.length + '/' + MAX_PHOTOS + ')'
        : '＋ 사진 올리기';
    }
  }

  // ── 보내기 ──────────────────────────────────────────
  function onSubmit() {
    if (submitting) return;

    var title = (el('rw-title').value || '').trim();
    var content = (el('rw-content').value || '').trim();
    var nickname = (el('rw-nickname').value || '').trim();

    if (invite && invite.needCategoryPick && !pickedCategoryId) {
      return toast('신청하신 분야를 골라주세요.');
    }
    if (!rating) return toast('만족도를 골라주세요.');
    // 사진은 선택이다 (2026-08-06 변경). 서버 쪽 @NotEmpty 도 함께 풀었다 —
    // 한쪽만 풀면 서버는 받아주는데 화면에서 막혀 원인을 찾기 어렵다.
    if (!title) { el('rw-title').focus(); return toast('제목을 입력해주세요.'); }
    if (!content) { el('rw-content').focus(); return toast('내용을 입력해주세요.'); }

    var payload = {
      title: title,
      content: content,
      rating: rating,
      imageUrls: photos.length ? photos : null,
      hashtags: tags,
      nickname: nickname,
      categoryId: pickedCategoryId
    };

    submitting = true;
    var btn = el('rw-submit');
    btn.disabled = true;
    btn.textContent = '올리는 중…';

    req('POST', '/api/review-invite/' + encodeURIComponent(token) + '/review', payload)
      .then(function () { show('rw-done'); })
      .catch(function (e) {
        // 토큰이 그 사이 닫혔다면(만료·중복 제출) 폼을 붙들고 있어 봐야 다시 안 된다.
        if (e.status === 404 || e.status === 409 || e.status === 410) return fail(e.status, e.message);
        toast(e.message || '등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
      })
      .then(function () {
        submitting = false;
        btn.disabled = false;
        btn.textContent = '후기 등록하기';
      });
  }

  // ── 못 여는 링크 ────────────────────────────────────
  // 이유마다 문구와 그림을 다르게 준다. 늦게 눌러 만료된 고객에게
  // "잘못된 링크" 라고 하면 자기가 뭘 틀린 줄 안다.
  function fail(status, message) {
    var emo = '🔒';
    var title = '링크를 열 수 없습니다';
    if (status === 410) { emo = '⏳'; title = '작성 기간이 지났습니다'; }
    else if (status === 409) { emo = '✅'; title = '이미 작성해 주셨습니다'; }
    else if (status === 404) { emo = '🔍'; title = '링크를 찾을 수 없습니다'; }

    text('rw-error-emo', emo);
    text('rw-error-title', title);
    text('rw-error-msg', message || '문자로 받으신 링크를 다시 확인해주세요.');
    show('rw-error');
  }

  // ── 잔손 ────────────────────────────────────────────
  function el(id) { return document.getElementById(id); }

  function text(id, v) { var e = el(id); if (e) e.textContent = v == null ? '' : v; }

  function show(id) {
    ['rw-loading', 'rw-error', 'rw-form', 'rw-done'].forEach(function (x) {
      var e = el(x);
      if (e) e.hidden = (x !== id);
    });
    window.scrollTo(0, 0);
  }

  function chip(label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rw-chip';
    b.textContent = label;
    return b;
  }

  function fmtDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  var toastTimer = null;
  function toast(msg) {
    var t = el('rw-toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }
})();
