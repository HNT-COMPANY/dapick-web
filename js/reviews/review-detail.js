// ════════════════════════════════════════════════════
// review-detail.js — 후기 상세 (독립 페이지, 모달 아님)
// URL: /reviews/{제목슬러그}-{id} (Worker) 또는 /review-detail?id={id} (로컬/폴백)
// GET /api/reviews/{id} → 제목/브레드크럼/작성자/시각 + Quill Delta 본문 렌더.
// OG/타이틀은 Worker 가 서버에서 주입하지만, 브라우저용으로 클라도 보정.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  const CAT_LABEL = {
    WATER: '정수기',
    RENTAL: '가전렌탈',
    INTERNET_TV: '인터넷·TV',
  };
  const CTA_HREF = { WATER: '/water', RENTAL: '/rental', INTERNET_TV: '/internet' };

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
    );
  }

  function parseId() {
    const q = new URLSearchParams(location.search).get('id');
    if (q && /^\d+$/.test(q)) return q;
    const m = location.pathname.match(/-(\d+)\/?$/); // /reviews/{slug}-{id}
    return m ? m[1] : null;
  }

  function fmtDateTime(raw) {
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(
      d.getHours(),
    )}:${p(d.getMinutes())}`;
  }

  function starsHtml(rating) {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return (
      '<span class="rd-stars">' +
      '★'.repeat(n) +
      '<span class="rd-stars-off">' +
      '★'.repeat(5 - n) +
      '</span></span>'
    );
  }

  function deltaToHtml(ops) {
    if (typeof Quill === 'undefined' || !Array.isArray(ops)) return '';
    const tmp = document.createElement('div');
    const q = new Quill(tmp, { modules: { toolbar: false }, readOnly: true });
    q.setContents({ ops: ops });
    return q.root.innerHTML;
  }

  function setMeta(review) {
    const title = (review.title || '다픽 후기') + ' | 다픽 후기';
    document.title = title;
    const desc = (review.content || '다픽 실사용 후기')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150);
    const setAttr = (sel, attr, val) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };
    setAttr('meta[name="description"]', 'content', desc);
    setAttr('meta[property="og:title"]', 'content', title);
    setAttr('meta[property="og:description"]', 'content', desc);
    if (review.imageUrl) setAttr('meta[property="og:image"]', 'content', review.imageUrl);
    setAttr('meta[property="og:url"]', 'content', location.origin + location.pathname);
    setAttr('link[rel="canonical"]', 'href', location.origin + location.pathname);
  }

  // 아이콘 (흑백 SVG)
  const RD_ICON_LIKE =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
  const RD_ICON_VIEW =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';

  let rdReview = null;

  function render(review) {
    rdReview = review;
    const cat = CAT_LABEL[review.category] || '후기';
    let bodyHtml;
    if (Array.isArray(review.contentBlocks) && review.contentBlocks.length) {
      // Quill Delta 본문(실사용자 작성)
      bodyHtml =
        '<div class="ql-snow"><div class="ql-editor rd-ql">' +
        deltaToHtml(review.contentBlocks) +
        '</div></div>';
    } else {
      // 평문 본문(+ 이미지 갤러리) — 관리자 더미/구 데이터
      const imgs = Array.isArray(review.imageUrls) ? review.imageUrls : [];
      const gallery = imgs.length
        ? '<div class="rd-gallery">' +
          imgs
            .map((u) => '<img class="rd-gimg" src="' + esc(u) + '" alt="" loading="lazy">')
            .join('') +
          '</div>'
        : '';
      bodyHtml =
        (review.content ? '<p class="rd-content">' + esc(review.content) + '</p>' : '') +
        gallery;
    }

    const tags = Array.isArray(review.hashtags) ? review.hashtags : [];
    const tagsHtml = tags.length
      ? '<div class="rd-tags">' +
        tags.map((t) => '<span class="rd-tag">#' + esc(t) + '</span>').join('') +
        '</div>'
      : '';

    document.getElementById('rdArticle').innerHTML =
      '<div class="rd-crumb"><a href="/reviews">후기</a> › ' +
      esc(cat) +
      '</div>' +
      '<h1 class="rd-title">' +
      esc(review.title || '후기') +
      '</h1>' +
      '<div class="rd-meta">' +
      '<span class="rd-author">' +
      esc(review.authorName || '익명') +
      '</span>' +
      (review.productName
        ? '<span class="rd-dot">·</span><span>' + esc(review.productName) + '</span>'
        : '') +
      '<span class="rd-date">' +
      fmtDateTime(review.createdAt) +
      '</span></div>' +
      '<div class="rd-ratingrow">' +
      starsHtml(review.rating) +
      '</div>' +
      tagsHtml +
      '<div class="rd-body">' +
      bodyHtml +
      '</div>' +
      '<div class="rd-stats">' +
      '<button type="button" class="rd-like" id="rdLikeBtn" aria-label="좋아요">' +
      RD_ICON_LIKE +
      '<span id="rdLikeCount">' +
      ((review.likeCount) || 0) +
      '</span></button>' +
      '<span class="rd-view">' +
      RD_ICON_VIEW +
      '<span id="rdViewCount">' +
      ((review.viewCount) || 0) +
      '</span></span>' +
      '</div>' +
      '<a class="rd-list" href="/reviews">목록으로</a>' +
      '<section class="rd-comments" id="rdComments"></section>' +
      '<section class="rd-recent" id="rdRecent"></section>';

    document.getElementById('rdArticle').hidden = false;
    const load = document.getElementById('rdLoading');
    if (load) load.remove();
    setMeta(review);

    bindLike(review.id);
    incrementView(review.id);
    loadComments(review.id);
    loadRecent(review.id);
  }

  // ── 조회수 +1 (세션당 후기별 1회) ──────────────────────
  function incrementView(id) {
    try {
      const key = 'rd_viewed_' + id;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (e) {
      /* sessionStorage 불가 시 그냥 1회 시도 */
    }
    api
      .post('/api/reviews/' + id + '/view', {})
      .then((r) => {
        if (r && r.viewCount != null) {
          const el = document.getElementById('rdViewCount');
          if (el) el.textContent = r.viewCount;
        }
      })
      .catch(() => {});
  }

  // ── 좋아요 (식별 없음, localStorage 로 중복 클릭만 방지) ──
  function bindLike(id) {
    const btn = document.getElementById('rdLikeBtn');
    if (!btn) return;
    const key = 'rd_liked_' + id;
    let liked = false;
    try {
      liked = !!localStorage.getItem(key);
    } catch (e) {}
    if (liked) btn.classList.add('on');
    btn.addEventListener('click', () => {
      if (!rdLoggedIn()) {
        rdLoginPrompt(); // 좋아요 회원제 — 비로그인은 로그인 안내
        return;
      }
      if (btn.classList.contains('on')) return; // 이미 누름
      btn.classList.add('on');
      try {
        localStorage.setItem(key, '1');
      } catch (e) {}
      api
        .post('/api/reviews/' + id + '/like', {})
        .then((r) => {
          if (r && r.likeCount != null) {
            const el = document.getElementById('rdLikeCount');
            if (el) el.textContent = r.likeCount;
          }
        })
        .catch(() => {
          btn.classList.remove('on');
          try {
            localStorage.removeItem(key);
          } catch (e) {}
        });
    });
  }

  function renderError(msg) {
    const load = document.getElementById('rdLoading');
    if (load) load.textContent = msg || '후기를 불러오지 못했습니다.';
  }

  // ── 로그인 여부 (auth.js isLoggedIn 있으면 사용) ──────────
  function rdLoggedIn() {
    return typeof isLoggedIn === 'function'
      ? isLoggedIn()
      : !!localStorage.getItem('dapick_token');
  }

  // 로그인 안내 박스 (좋아요 회원제) — 로그인 하시겠습니까? [취소] [이동하기]
  function rdLoginPrompt() {
    let m = document.getElementById('rdLoginModal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'rdLoginModal';
      m.className = 'rd-lmodal';
      m.innerHTML =
        '<div class="rd-lmodal-back"></div>' +
        '<div class="rd-lmodal-box">' +
        '<p class="rd-lmodal-msg">로그인이 필요합니다.<br>로그인 하시겠습니까?</p>' +
        '<div class="rd-lmodal-btns">' +
        '<button type="button" class="rd-lmodal-cancel">취소</button>' +
        '<button type="button" class="rd-lmodal-go">이동하기</button>' +
        '</div></div>';
      document.body.appendChild(m);
      const close = () => {
        m.style.display = 'none';
      };
      m.querySelector('.rd-lmodal-back').addEventListener('click', close);
      m.querySelector('.rd-lmodal-cancel').addEventListener('click', close);
      m.querySelector('.rd-lmodal-go').addEventListener('click', () => {
        window.location.href = '/login';
      });
    }
    m.style.display = 'flex';
  }

  // ════════════════════════════════════════════════════
  // 댓글 (로그인 후 작성 — 별명 + 내용)
  // ════════════════════════════════════════════════════
  function loadComments(id) {
    api
      .get('/api/reviews/' + id + '/comments')
      .then((list) => renderComments(id, Array.isArray(list) ? list : []))
      .catch(() => renderComments(id, []));
  }

  function commentItemHtml(c) {
    return (
      '<div class="rd-cmt">' +
      '<div class="rd-cmt-head">' +
      '<span class="rd-cmt-author">' +
      esc(c.authorName || '익명') +
      '</span>' +
      '<span class="rd-cmt-date">' +
      fmtDateTime(c.createdAt) +
      '</span>' +
      (c.mine
        ? '<button type="button" class="rd-cmt-del" data-id="' + c.id + '">삭제</button>'
        : '') +
      '</div>' +
      '<p class="rd-cmt-body">' +
      esc(c.content || '') +
      '</p></div>'
    );
  }

  function renderComments(id, list) {
    const wrap = document.getElementById('rdComments');
    if (!wrap) return;
    const listHtml = list.length
      ? list.map(commentItemHtml).join('')
      : '<p class="rd-cmt-empty">첫 댓글을 남겨보세요.</p>';

    const formHtml = rdLoggedIn()
      ? '<div class="rd-cmt-form">' +
        '<textarea class="rd-cmt-input" id="rdCmtInput" maxlength="1000" placeholder="따뜻한 댓글을 남겨주세요."></textarea>' +
        '<button type="button" class="rd-cmt-submit" id="rdCmtSubmit">등록</button>' +
        '</div>'
      : '<div class="rd-cmt-login">댓글은 로그인 후 작성할 수 있습니다. ' +
        '<a href="/login">로그인하기</a></div>';

    wrap.innerHTML =
      '<h2 class="rd-sec-title">댓글 <span class="rd-sec-count">' +
      list.length +
      '</span></h2>' +
      '<div class="rd-cmt-list">' +
      listHtml +
      '</div>' +
      formHtml;

    const submit = document.getElementById('rdCmtSubmit');
    if (submit) {
      submit.addEventListener('click', () => postComment(id));
    }
    // 본인 댓글 삭제 버튼 바인딩
    wrap.querySelectorAll('.rd-cmt-del').forEach((btn) => {
      btn.addEventListener('click', () => deleteComment(id, btn.dataset.id));
    });
  }

  function deleteComment(reviewId, commentId) {
    if (!commentId) return;
    if (!confirm('댓글을 삭제할까요?')) return;
    api
      .delete('/api/reviews/comments/' + commentId)
      .then((r) => {
        if (r === null) return; // 미로그인/권한없음 등
        loadComments(reviewId); // 재조회로 목록·카운트 갱신
      })
      .catch((e) => alert((e && e.message) || '댓글 삭제에 실패했습니다.'));
  }

  function postComment(id) {
    const input = document.getElementById('rdCmtInput');
    if (!input) return;
    const content = input.value.trim();
    if (!content) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }
    const btn = document.getElementById('rdCmtSubmit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '등록 중...';
    }
    api
      .post('/api/reviews/' + id + '/comments', { content: content })
      .then((r) => {
        if (r === null) return; // 미로그인(401) → api 가 null 반환/리다이렉트
        loadComments(id); // 재조회로 목록 + 카운트 갱신
      })
      .catch((e) => {
        alert((e && e.message) || '댓글 등록에 실패했습니다.');
      })
      .finally(() => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '등록';
        }
      });
  }

  // ════════════════════════════════════════════════════
  // 비슷한 후기 — 관련도 없이 "최근 올라온 순" (현재 글 제외)
  // ════════════════════════════════════════════════════
  function slugify(title) {
    if (!title) return 'review';
    const s = String(title)
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return s || 'review';
  }

  function recentUrl(r) {
    const host = location.hostname;
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.endsWith('.local');
    if (isLocal) return '/review-detail.html?id=' + r.id;
    return '/reviews/' + slugify(r.title) + '-' + r.id;
  }

  function recentItemHtml(r) {
    const thumb =
      Array.isArray(r.imageUrls) && r.imageUrls.length
        ? r.imageUrls[0]
        : r.imageUrl || '/assets/logos/dapicklogo.png';
    const isLogo = !(Array.isArray(r.imageUrls) && r.imageUrls.length) && !r.imageUrl;
    return (
      '<a class="rd-rc" href="' +
      recentUrl(r) +
      '">' +
      '<span class="rd-rc-thumb' +
      (isLogo ? ' rd-rc-thumb--logo' : '') +
      '"><img src="' +
      esc(thumb) +
      '" alt="" loading="lazy"></span>' +
      '<span class="rd-rc-title">' +
      esc(r.title || '후기') +
      '</span></a>'
    );
  }

  function loadRecent(excludeId) {
    api
      .get('/api/reviews?page=0&size=7')
      .then((data) => {
        const items = ((data && data.content) || []).filter(
          (r) => r && !r.hidden && String(r.id) !== String(excludeId),
        );
        const wrap = document.getElementById('rdRecent');
        if (!wrap || !items.length) return;
        wrap.innerHTML =
          '<h2 class="rd-sec-title">다른 후기</h2>' +
          '<div class="rd-rc-list">' +
          items.slice(0, 6).map(recentItemHtml).join('') +
          '</div>';
      })
      .catch(() => {});
  }

  function injectStyles() {
    const css =
      ".rd-wrap{max-width:820px;margin:24px auto 60px;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.rd-loading{padding:80px 0;text-align:center;color:#9a9aa5;}' +
      '.rd-crumb{font-size:13px;color:#8a8a99;margin-bottom:12px;}' +
      '.rd-crumb a{color:#8a8a99;text-decoration:none;}' +
      '.rd-title{font-size:26px;font-weight:800;line-height:1.35;margin:0 0 14px;color:#1e1b2e;}' +
      '.rd-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:#8a8a99;margin-bottom:6px;}' +
      '.rd-author{font-weight:700;color:#5b3fbe;}' +
      '.rd-date{margin-left:auto;}' +
      '.rd-ratingrow{margin-bottom:18px;}' +
      '.rd-stars{font-size:18px;letter-spacing:2px;color:#ffb400;}' +
      '.rd-stars-off{color:#dcd7e8;}' +
      '.rd-body{border-top:1px solid #eee;padding-top:22px;margin-bottom:28px;font-size:16px;line-height:1.8;}' +
      '.rd-content{white-space:pre-wrap;word-break:break-word;}' +
      '.rd-gallery{display:flex;flex-direction:column;gap:12px;margin-top:14px;}' +
      '.rd-gimg{max-width:100%;border-radius:12px;display:block;margin:0 auto;}' +
      '.rd-body .ql-snow{border:none;}' +
      '.rd-body .ql-editor{padding:0;font-size:16px;line-height:1.8;color:#2a2a35;}' +
      '.rd-body .ql-editor img{max-width:100%;height:auto;border-radius:12px;display:block;margin:14px auto;}' +
      '.rd-cta{display:block;text-align:center;background:#5b3fbe;color:#fff;text-decoration:none;' +
      'font-weight:700;font-size:16px;padding:15px;border-radius:12px;margin-bottom:10px;}' +
      '.rd-list{display:block;text-align:center;background:#fff;border:1px solid #d7d2e6;' +
      'border-radius:12px;padding:13px;font-size:14px;font-weight:600;color:#555;text-decoration:none;}' +
      // 해시태그
      '.rd-tags{display:flex;flex-wrap:wrap;gap:6px;margin:-6px 0 18px;}' +
      '.rd-tag{font-size:13px;color:#5b3fbe;background:#f1edfb;border-radius:6px;padding:3px 10px;font-weight:600;}' +
      // 좋아요/조회수
      '.rd-stats{display:flex;align-items:center;gap:16px;margin:0 0 20px;}' +
      '.rd-like{display:inline-flex;align-items:center;gap:6px;border:1px solid #e0dced;background:#fff;' +
      'color:#8a8a99;border-radius:999px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}' +
      '.rd-like.on{background:#f1edfb;border-color:#5b3fbe;color:#5b3fbe;}' +
      '.rd-view{display:inline-flex;align-items:center;gap:6px;color:#a0a0ad;font-size:13px;}' +
      // 섹션 제목
      '.rd-sec-title{font-size:17px;font-weight:800;color:#1e1b2e;margin:28px 0 14px;padding-top:24px;border-top:1px solid #eee;}' +
      '.rd-sec-count{color:#5b3fbe;}' +
      // 댓글
      '.rd-cmt-list{display:flex;flex-direction:column;gap:14px;margin-bottom:18px;}' +
      '.rd-cmt{background:#faf9fe;border:1px solid #efecf8;border-radius:12px;padding:12px 14px;}' +
      '.rd-cmt-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;}' +
      '.rd-cmt-author{font-weight:700;font-size:13px;color:#5b3fbe;}' +
      '.rd-cmt-date{font-size:12px;color:#a8a8b5;margin-left:auto;}' +
      '.rd-cmt-del{border:none;background:none;color:#b0aac2;font-size:12px;cursor:pointer;' +
      'padding:0 0 0 8px;font-family:inherit;text-decoration:underline;}' +
      '.rd-cmt-del:hover{color:#e4595b;}' +
      '.rd-cmt-body{font-size:14px;line-height:1.6;color:#33333f;white-space:pre-wrap;word-break:break-word;margin:0;}' +
      '.rd-cmt-empty{font-size:14px;color:#9a9aa5;padding:8px 0 16px;}' +
      '.rd-cmt-form{display:flex;gap:8px;align-items:flex-start;}' +
      '.rd-cmt-input{flex:1;box-sizing:border-box;border:1px solid #e0dced;border-radius:10px;' +
      'padding:10px 12px;font-size:14px;font-family:inherit;min-height:44px;resize:vertical;}' +
      '.rd-cmt-submit{border:none;background:#5b3fbe;color:#fff;border-radius:10px;padding:0 18px;' +
      'height:44px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;flex:none;}' +
      '.rd-cmt-submit:disabled{opacity:.6;cursor:default;}' +
      '.rd-cmt-login{font-size:14px;color:#8a8a99;background:#faf9fe;border:1px solid #efecf8;' +
      'border-radius:10px;padding:14px;text-align:center;}' +
      '.rd-cmt-login a{color:#5b3fbe;font-weight:700;text-decoration:none;}' +
      // 로그인 안내 박스(좋아요 회원제)
      '.rd-lmodal{display:none;position:fixed;inset:0;z-index:2000;align-items:center;justify-content:center;}' +
      '.rd-lmodal-back{position:absolute;inset:0;background:rgba(20,16,40,.5);}' +
      '.rd-lmodal-box{position:relative;z-index:1;width:calc(100% - 48px);max-width:320px;' +
      'background:#fff;border-radius:14px;padding:26px 22px 18px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);}' +
      '.rd-lmodal-msg{font-size:15px;line-height:1.6;color:#1e1b2e;margin:0 0 20px;font-weight:600;}' +
      '.rd-lmodal-btns{display:flex;gap:10px;}' +
      '.rd-lmodal-cancel,.rd-lmodal-go{flex:1;height:44px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;border:none;}' +
      '.rd-lmodal-cancel{background:#f2f0f8;color:#555;}' +
      '.rd-lmodal-go{background:#5b3fbe;color:#fff;}' +
      // 비슷한 후기
      '.rd-rc-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;}' +
      '.rd-rc{text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:8px;}' +
      '.rd-rc-thumb{display:block;width:100%;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:#f3f0fa;}' +
      '.rd-rc-thumb img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.rd-rc-thumb--logo{display:flex;align-items:center;justify-content:center;background:#f5f3fb;}' +
      '.rd-rc-thumb--logo img{width:60%;height:60%;object-fit:contain;}' +
      '.rd-rc-title{font-size:14px;font-weight:600;color:#2a2a35;line-height:1.4;' +
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}' +
      // 반응형 (모바일/태블릿)
      '@media (max-width:768px){' +
      '.rd-wrap{margin:16px auto 48px;padding:0 14px;}' +
      '.rd-title{font-size:21px;}' +
      '.rd-body{font-size:15px;padding-top:18px;}' +
      '.rd-rc-list{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;}' +
      '.rd-cmt-input{font-size:16px;}' + // iOS 확대 방지(16px)
      '}' +
      '@media (max-width:400px){' +
      '.rd-title{font-size:19px;}' +
      '.rd-rc-list{grid-template-columns:1fr 1fr;}' +
      '.rd-cmt-submit{padding:0 12px;}' +
      '}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const id = parseId();
    if (!id) {
      renderError('잘못된 접근입니다.');
      return;
    }
    api
      .get('/api/reviews/' + id)
      .then((r) => {
        if (!r) {
          renderError('후기를 찾을 수 없습니다.');
          return;
        }
        if (r.hidden) {
          renderError('관리자에 의해 가림 처리되었습니다.');
          return;
        }
        render(r);
      })
      .catch(() => renderError('후기를 불러오지 못했습니다.'));
  });
})();
