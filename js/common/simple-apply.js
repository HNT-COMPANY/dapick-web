// ════════════════════════════════════════════════════
// simple-apply.js — 간편 신청 (비회원) 모달 + 인라인 버튼 + 박아 넣는 폼
// 렌탈·정수기·인터넷 상세 페이지에 로드. 카테고리는 경로로 자동 판별.
// 인라인 버튼(class="sapply-inline", onclick="openSimpleApply()")을 페이지 액션줄에 배치.
// 버튼 문구/스타일은 여기서 주입하는 공통 클래스로 "모두 통일".
// 폼: 이름 / 전화번호(2차 확인) / 내용 → POST /api/simple-applications.
//
// ★ 화면에 박아 넣는 폼 (2026-08-08 추가)
//   dpMountSimpleApply(칸, { title, sub, catApi, catLabel })
//   모달을 안 열고 페이지 안에서 바로 받는다. 인터넷 목록 화면이 쓴다.
//
// ★ 유입 출처 (2026-08-10)
//   어느 화면 어느 버튼에서 열었는지를 접수와 함께 보낸다. 값은 GA4 이벤트 이름과 같다.
//   서버에 그 칸이 아직 없어도 조용히 버려지므로 웹이 먼저 보내도 안 터진다.
//
//   ⚠ 동의 문구와 접수 규칙을 여기 한 곳에 둔다.
//     화면마다 폼을 따로 만들면 개인정보 동의 문구가 갈린다. 그건 법적으로 위험하다.
//     문구(AGREE_HTML)와 접수(postApply)를 모달과 박아 넣는 폼이 함께 쓴다.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  var path = (location.pathname || '').toLowerCase();
  var CAT;
  // ⚠ 순서 주의 (2026-08-01): 관리자 카테고리 판별을 맨 앞에 둔다.
  //   /c/water 같은 주소는 'water' 를 포함하므로, 아래 정수기 분기가 먼저 걸리면
  //   관리자가 만든 카테고리가 정수기로 접수된다.
  if (path.indexOf('/c/') === 0 || path.indexOf('product-detail') >= 0 || path.indexOf('category.html') >= 0 || path.indexOf('banner-detail') >= 0) {
    // 관리자가 만든 카테고리(GENERIC). 실제 값은 open() 호출 시 넘어온 것으로 덮어쓴다.
    CAT = { key: 'GENERIC', api: 'generic', label: '상담' };
  }
  else if (path.indexOf('rental') >= 0) CAT = { key: 'RENTAL', api: 'rental', label: '렌탈' };
  else if (path.indexOf('water') >= 0) CAT = { key: 'WATER', api: 'water', label: '정수기' };
  else if (path.indexOf('internet') >= 0) CAT = { key: 'INTERNET_TV', api: 'internet', label: '인터넷' };
  else return; // 대상 페이지 아님

  var PH = '원하는 상품명이 있거나 간단한 글로 ' + CAT.label + ' 문의 혹은 지원금 문의로 간편하게 접수하세요';

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function onlyDigits(s){return String(s||'').replace(/[^0-9]/g,'');}
  function fmtPhone(d){ d=onlyDigits(d); if(d.length===11) return d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7); if(d.length===10) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6); return d; }

  // ── 모달과 박아 넣는 폼이 함께 쓰는 것 ──────────────────
  //
  // ⚠ 동의 문구를 여기서만 적는다. 화면마다 따로 적으면 한쪽만 고쳐져
  //   "이 화면에서는 동의했는데 저 화면에서는 안 한 것" 이 된다.
  //   p 는 id 앞에 붙는 글자다 — 모달과 박아 넣는 폼이 한 화면에 같이 있어도 안 겹친다.
  function agreeHtml(p) {
    return ''
      + '<div class="sapply-agree">'
      +   '<label class="sa-agree-all"><input type="checkbox" id="' + p + 'AgreeAll"/><span>전체 동의</span></label>'
      +   '<label class="sa-agree"><input type="checkbox" id="' + p + 'Privacy"/><span>[필수] <a href="privacy.html" target="_blank">개인정보 처리방침</a>에 동의합니다.</span></label>'
      +   '<label class="sa-agree"><input type="checkbox" id="' + p + 'Warning"/><span>[필수] 다픽은 통신판매중개자이며, 상담 신청 시 위탁사로 정보가 전달됨을 확인했습니다.</span></label>'
      +   '<label class="sa-agree"><input type="checkbox" id="' + p + 'Marketing"/><span>[선택] 마케팅 정보 수신에 동의합니다.</span></label>'
      + '</div>';
  }

  function fieldsHtml(p, ph) {
    return ''
      + '<div class="sapply-f"><label>이름</label><input id="' + p + 'Name" maxlength="30" placeholder="성함을 입력하세요" /></div>'
      + '<div class="sapply-f"><label>전화번호</label><input id="' + p + 'Phone" inputmode="numeric" maxlength="13" placeholder="010-0000-0000" /></div>'
      + '<div class="sapply-f"><label>내용 <span style="font-weight:400;color:#9a97ad;">(선택)</span></label>'
      +   '<textarea id="' + p + 'Memo" maxlength="500" placeholder="' + esc(ph) + '"></textarea></div>';
  }

  // 전체 동의 연동. 어느 폼이든 같은 규칙이다.
  function wireAgree(p) {
    var all = document.getElementById(p + 'AgreeAll');
    var ids = [p + 'Privacy', p + 'Warning', p + 'Marketing'];
    var els = function () {
      return ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    };
    if (!all) return;
    all.addEventListener('change', function () {
      var c = all.checked;
      els().forEach(function (el) { el.checked = c; });
    });
    els().forEach(function (el) {
      el.addEventListener('change', function () {
        all.checked = els().every(function (c) { return c.checked; });
      });
    });
  }

  // 필수 항목 검사. 통과하면 빈 문자열, 아니면 알릴 말을 돌려준다.
  function validate(p) {
    var name = (document.getElementById(p + 'Name').value || '').trim();
    var digits = onlyDigits(document.getElementById(p + 'Phone').value);
    if (!name) { document.getElementById(p + 'Name').focus(); return '이름을 입력하세요'; }
    if (digits.length < 10 || digits.length > 11) {
      document.getElementById(p + 'Phone').focus();
      return '전화번호를 정확히 입력하세요';
    }
    var pv = document.getElementById(p + 'Privacy');
    var wn = document.getElementById(p + 'Warning');
    if (pv && !pv.checked) return '개인정보 처리방침 동의는 필수입니다';
    if (wn && !wn.checked) return '통신판매중개 안내 확인은 필수입니다';
    return '';
  }

  // 화면이 출처를 안 알려줬을 때 쓰는 값. 경로로 짐작한다.
  // 정확한 이름은 버튼을 만든 쪽이 넘긴다 — 여기 것은 마지막 그물이다.
  function defaultSource() {
    if (path.indexOf('water') >= 0) return 'water_page';
    if (path.indexOf('internet') >= 0) return 'internet_page';
    if (path.indexOf('rental') >= 0) return 'rental_page';
    return 'web_etc';
  }

  // 접수. 서버로 보내는 규칙을 여기 한 곳에 둔다.
  function postApply(p, cat, extra) {
    var m = document.getElementById(p + 'Marketing');
    var payload = {
      category: cat.api,
      // 아래 넷이 있어야 이 접수가 어느 카테고리·어느 상품 건인지 서버에 남는다.
      categoryId: (extra && extra.categoryId) || null,
      productId: (extra && extra.productId) || null,
      productName: (extra && extra.productName) || null,
      productImageUrl: (extra && extra.productImageUrl) || null,
      name: (document.getElementById(p + 'Name').value || '').trim(),
      phone: fmtPhone(onlyDigits(document.getElementById(p + 'Phone').value)),
      content: (document.getElementById(p + 'Memo').value || '').trim(),
      marketingAgreed: m ? m.checked : false,
      // 어디서 눌렀나. 화면이 안 알려주면 경로로 대충 적는다 —
      // 빈 값보다는 '어느 화면이었다' 라도 남는 편이 낫다.
      source: (extra && extra.source) || defaultSource(),
    };
    // api.js 가 안 실린 화면에서는 접수를 못 한다. 실패로 알린다.
    if (typeof api === 'undefined' || !api.post) {
      return Promise.reject(new Error('접수 기능을 못 찾았습니다. 화면을 새로고침해 주세요.'));
    }
    return api.post('/api/simple-applications', payload, { skipAuthRefresh: true });
  }

  var CSS = ''
    // ── 인라인 간편신청 버튼 (파란 바탕·흰 글씨 '간편 신청' + 말풍선 유도 · 모든 페이지 동일) ──
    + '.sapply-inline{position:relative;overflow:visible;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;'
    + 'background:#2563eb;color:#fff;border:none;border-radius:12px;'
    + 'padding:18px 34px;font-size:16px;font-weight:800;font-family:inherit;cursor:pointer;white-space:nowrap;'
    + 'margin-top:28px;transition:background .15s ease,transform .15s ease,box-shadow .15s ease;line-height:1.1;}'
    + '.sapply-inline:hover{background:#1d4ed8;transform:translateY(-1px);box-shadow:0 8px 22px rgba(37,99,235,.30);}'
    + '.sapply-inline:active{transform:translateY(0);}'
    + '.sapply-tip{position:absolute;bottom:calc(100% + 9px);left:50%;background:#2a2f3a;color:#fff;'
    + 'font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;white-space:nowrap;pointer-events:none;'
    + 'box-shadow:0 4px 12px rgba(0,0,0,.20);animation:sapplyBob 1.6s ease-in-out infinite;}'
    + '.sapply-tip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);'
    + 'border:5px solid transparent;border-top-color:#2a2f3a;}'
    + '@keyframes sapplyBob{0%,100%{transform:translateX(-50%) translateY(0);}50%{transform:translateX(-50%) translateY(-3px);}}'
    + '.ip-pb-actions,.wd-actions{flex-wrap:wrap;align-items:flex-end;}'
    + '@media(max-width:768px){.sapply-inline{padding:16px;font-size:15px;margin-top:34px;}'
    + '.ip-pb-actions .sapply-inline,.wd-actions .sapply-inline{flex:1 1 100%;}}'
    // ── 모달 ──
    // ⚠ z-index 는 파인더 덮개(.dpf-ov = 9000)보다 위여야 한다 (2026-08-08).
    //   1000 이던 때 파인더 결과에서 간편 신청을 열면 파인더 뒤에 깔려 안 보였다.
    //   이 창은 언제 열리든 맨 앞이어야 한다 — 열렸다는 것 자체가 다른 화면을 멈춘다는 뜻이다.
    + '.sapply-ov{position:fixed;inset:0;z-index:9500;background:rgba(20,18,40,.5);display:none;align-items:center;justify-content:center;padding:16px;}'
    + '.sapply-ov.on{display:flex;}'
    + '.sapply-card{width:100%;max-width:440px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25);}'
    + '.sapply-head{padding:20px 22px 14px;border-bottom:1px solid #eceaf8;display:flex;align-items:center;gap:8px;}'
    + '.sapply-head b{font-size:18px;font-weight:900;color:#18172b;}'
    + '.sapply-head .cat{font-size:12px;font-weight:800;color:#2563eb;background:#e8f1ff;border-radius:999px;padding:4px 10px;}'
    + '.sapply-x{margin-left:auto;border:none;background:none;font-size:20px;color:#9a97ad;cursor:pointer;line-height:1;}'
    + '.sapply-body{padding:18px 22px 6px;}'
    + '.sapply-f{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}'
    + '.sapply-f label{font-size:13px;font-weight:700;color:#4a4a58;}'
    + '.sapply-f input,.sapply-f textarea{width:100%;box-sizing:border-box;padding:12px 13px;font-size:15px;font-family:inherit;'
    + 'border:1.5px solid #dcdce3;border-radius:11px;background:#fff;color:#18172b;}'
    + '.sapply-f input:focus,.sapply-f textarea:focus{outline:none;border-color:#2563eb;}'
    + '.sapply-f textarea{resize:vertical;min-height:92px;line-height:1.5;}'
    + '.sapply-foot{display:flex;gap:8px;padding:8px 22px 20px;}'
    + '.sapply-btn{flex:1;padding:13px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;border:1.5px solid #dcdce3;background:#fff;color:#4a4a58;}'
    + '.sapply-btn.pri{border:none;background:#2563eb;color:#fff;}'
    + '.sapply-confirm{padding:22px;text-align:center;display:none;}'
    + '.sapply-confirm.on{display:block;}'
    + '.sapply-confirm .ph{font-size:22px;font-weight:900;color:#2563eb;letter-spacing:.5px;margin:8px 0 4px;font-variant-numeric:tabular-nums;}'
    + '.sapply-confirm p{margin:0;color:#4a4a58;font-size:15px;}'
    + '.sapply-confirm .q{margin-top:10px;font-weight:700;color:#18172b;}'
    + '.sapply-agree{margin:2px 0 12px;border-top:1px solid #eceaf8;padding-top:12px;}'
    + '.sa-agree-all{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#18172b;cursor:pointer;margin-bottom:8px;}'
    + '.sa-agree{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:#5a5a68;cursor:pointer;margin:6px 0;line-height:1.45;}'
    + '.sapply-agree input{margin-top:1px;width:16px;height:16px;accent-color:#2563eb;flex-shrink:0;cursor:pointer;}'
    + '.sa-agree a{color:#2563eb;text-decoration:underline;}'
    + '.sapply-done{padding:34px 22px;text-align:center;display:none;}'
    + '.sapply-done.on{display:block;}'
    + '.sapply-done .ic{font-size:44px;}'
    + '.sapply-done b{display:block;font-size:18px;font-weight:900;color:#18172b;margin-top:8px;}'
    + '.sapply-done p{margin:6px 0 0;color:#6b6880;font-size:14px;}'
    // ── 화면에 박아 넣는 폼 (2026-08-08) ──
    // 왼쪽에 부르는 말, 오른쪽에 입력칸. 좁아지면 위아래로 쌓인다.
    + '.sain{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;'
    + 'gap:48px;align-items:center;padding:44px 40px;background:#fff;border:1px solid #e9ecf3;'
    + 'border-radius:20px;box-shadow:0 6px 28px rgba(24,23,43,.06);}'
    + '.sain-t{margin:0;font-size:27px;font-weight:900;color:#18172b;line-height:1.45;'
    + 'letter-spacing:-.6px;word-break:keep-all;}'
    + '.sain-s{margin:12px 0 0;font-size:15.5px;color:#6b6880;font-weight:600;line-height:1.6;'
    + 'word-break:keep-all;}'
    + '.sain-r{min-width:0;}'
    + '.sain .sapply-f{margin-bottom:14px;}'
    + '.sain .sapply-agree{margin-top:2px;}'
    + '.sain-go{width:100%;margin-top:16px;border:none;border-radius:12px;background:#2563eb;color:#fff;'
    + 'padding:17px;font-size:16px;font-weight:800;font-family:inherit;cursor:pointer;'
    + 'transition:background .15s ease,transform .15s ease;}'
    + '.sain-go:hover{background:#1d4ed8;transform:translateY(-1px);}'
    + '.sain-done{display:none;text-align:center;padding:30px 10px;}'
    + '.sain-done.on{display:block;}'
    + '.sain-done .ic{font-size:44px;}'
    + '.sain-done b{display:block;font-size:18px;font-weight:900;color:#18172b;margin-top:8px;}'
    + '.sain-done p{margin:6px 0 0;color:#6b6880;font-size:14px;}'
    + '@media(max-width:900px){.sain{grid-template-columns:1fr;gap:24px;padding:30px 22px;}'
    + '.sain-t{font-size:22px;}.sain-s{font-size:14.5px;}}';

  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var wrap = document.createElement('div');
  wrap.innerHTML = ''
    + '<div class="sapply-ov" id="sapplyOv">'
    +   '<div class="sapply-card" role="dialog" aria-modal="true">'
    +     '<div class="sapply-head"><b>3초만에 간편 신청</b><span class="cat">' + esc(CAT.label) + '</span><button class="sapply-x" id="sapplyX" aria-label="닫기">✕</button></div>'
    +     '<div class="sapply-body" id="sapplyForm">'
    +       fieldsHtml('sa', PH)
    +       agreeHtml('sa')
    +     '</div>'
    +     '<div class="sapply-foot" id="sapplyFoot"><button class="sapply-btn" id="saClose" type="button">닫기</button><button class="sapply-btn pri" id="saNext" type="button" data-track="simple_apply_next">접수하기</button></div>'
    +     '<div class="sapply-confirm" id="sapplyConfirm"><p>입력하신 번호는</p><div class="ph" id="saPhoneEcho"></div><p class="q">정말 맞나요?</p><div class="sapply-foot" style="padding-left:0;padding-right:0;padding-bottom:0;"><button class="sapply-btn" id="saNo" type="button">아니요</button><button class="sapply-btn pri" id="saYes" type="button" data-track="simple_apply_submit">네, 맞아요</button></div></div>'
    +     '<div class="sapply-done" id="sapplyDone"><div class="ic">✅</div><b>접수되었습니다</b><p>상담사가 입력하신 번호로 곧 연락드립니다.</p></div>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(wrap);

  var ov = document.getElementById('sapplyOv');
  var form = document.getElementById('sapplyForm');
  var foot = document.getElementById('sapplyFoot');
  var confirmEl = document.getElementById('sapplyConfirm');
  var done = document.getElementById('sapplyDone');
  var nameEl = document.getElementById('saName');
  var phoneEl = document.getElementById('saPhone');
  var memoEl = document.getElementById('saMemo');

  // 전체동의 연동 (박아 넣는 폼과 같은 규칙을 쓴다)
  wireAgree('sa');

  // 경로로 정해진 기본값. 인자 없이 open() 을 부르면 여기로 되돌린다.
  var DEFAULT_CAT = { api: CAT.api, label: CAT.label };

  // 이번에 연 접수가 무엇을 보고 있었는지 (2026-08-03).
  //
  // 예전에는 카테고리 '글자' 만 보냈다. 그래서 에어컨 → 벽걸이 → 상품 → 간편신청 을 해도
  // 서버에는 'airconditioner' 라는 글자 하나만 남고 어느 상품인지가 안 남았다.
  // 그러면 나중에 그 고객이 후기를 써도 그 상품 상세에는 못 띄운다 —
  // 상품 상세는 상품 id 로 후기를 찾기 때문이다.
  var pick = { categoryId: null, productId: null, productName: null, productImageUrl: null, source: null };

  /**
   * 모달 열기.
   *
   * 인자 없이 부르면 경로로 정해진 기본값으로 돌아간다 — 정수기·렌탈·인터넷 상세의 인라인 버튼이 그렇게 부른다.
   * 카테고리/상품 상세는 값을 넘겨 카테고리와 상품명을 갈아끼운다.
   *
   * @param catApi      접수에 실을 카테고리 글자. 서버가 20자까지만 받아 잘라 보낸다.
   * @param productName 어떤 상품을 보고 눌렀는지. 문의 내용에 미리 채우고 접수에도 함께 싣는다.
   * @param catLabel    모달 우상단에 표시할 이름(예: '에어컨').
   * @param opts        { categoryId, productId, productImageUrl } — 서버가 실제로 이어 붙일 값.
   *                    productImageUrl 은 상품 사진 스냅샷이다(2026-08-06). 후기 작성 링크 화면이 이걸 그린다 —
   *                    정수기처럼 상품이 products 표에 없는 카테고리는 서버가 사진을 찾을 방법이 없다.
   */
  function open(catApi, productName, catLabel, opts){
    var o = opts || {};

    // 기본값으로 되돌린 뒤 이번 인자를 얹는다.
    // 안 그러면 상품 A 에서 열었다가 인라인 버튼으로 다시 열 때 앞 상품의 카테고리가 남는다.
    CAT.api = catApi ? String(catApi).slice(0, 20) : DEFAULT_CAT.api;
    CAT.label = catLabel || DEFAULT_CAT.label;
    var headEl = document.querySelector('.sapply-head .cat');
    if (headEl) headEl.textContent = CAT.label;

    pick.categoryId = o.categoryId || null;
    pick.productId = o.productId || null;
    pick.productName = productName ? String(productName).slice(0, 100) : null;
    pick.productImageUrl = o.productImageUrl ? String(o.productImageUrl).slice(0, 500) : null;
    // 버튼마다 다른 이름이 온다. 안 주면 아래 defaultSource() 가 경로로 짐작한다.
    pick.source = o.source ? String(o.source).slice(0, 40) : null;

    resetToForm();
    // 상품명은 '덮어쓰기'다 — 다른 상품에서 다시 열었을 때 앞 상품명이 남으면 안 된다.
    // 고객이 지우고 다시 쓸 수 있게 placeholder 가 아니라 실제 값으로 넣는다.
    memoEl.value = productName ? (productName + ' 문의합니다.') : '';
    ov.classList.add('on');
  }
  function close(){ ov.classList.remove('on'); }
  function resetToForm(){ form.style.display=''; foot.style.display=''; confirmEl.classList.remove('on'); done.classList.remove('on'); }

  // 전화번호 자동 하이픈
  phoneEl.addEventListener('input', function(){ phoneEl.value=fmtPhone(phoneEl.value); });

  document.getElementById('sapplyX').addEventListener('click', close);
  document.getElementById('saClose').addEventListener('click', close);
  ov.addEventListener('click', function(e){ if(e.target===ov) close(); });

  document.getElementById('saNext').addEventListener('click', function(){
    var bad = validate('sa');
    if (bad) return alertLite(bad);
    document.getElementById('saPhoneEcho').textContent = fmtPhone(onlyDigits(phoneEl.value));
    form.style.display='none'; foot.style.display='none'; confirmEl.classList.add('on');
  });
  document.getElementById('saNo').addEventListener('click', resetToForm);

  var submitting = false;
  document.getElementById('saYes').addEventListener('click', function(){
    if (submitting) return;
    var yesBtn = document.getElementById('saYes');
    submitting = true;
    yesBtn.textContent = '접수 중...';
    // 접수 규칙은 postApply 한 곳에 있다. 박아 넣는 폼도 같은 것을 쓴다.
    postApply('sa', CAT, pick)
      .then(function(){
        confirmEl.classList.remove('on'); done.classList.add('on');
      })
      .catch(function(err){
        alertLite((err && err.message) || '접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
      })
      .finally(function(){
        submitting = false; yesBtn.textContent = '네, 맞아요';
      });
  });

  // 인라인 버튼에서 호출 (onclick="openSimpleApply()")
  window.openSimpleApply = open;

  // 주소에 ?apply=1 이 붙어 있으면 버튼을 안 눌러도 바로 연다 (2026-08-10).
  //
  // ★ 왜 필요한가
  //   배너에 '#apply:water' 를 적어 두면 어느 화면에서든 눌립니다. 그런데 이 파일은
  //   주소로 카테고리를 정하기 때문에 메인 화면 같은 곳에서는 스스로 꺼져 있다.
  //   그래서 배너가 그 카테고리 화면으로 보내고, 도착한 뒤 여기서 연다.
  //   상품 찾기(finder.js) 의 ?finder=1 과 같은 방식이다.
  function autoOpenFromUrl() {
    try {
      if (new URLSearchParams(location.search).get('apply') !== '1') return;
    } catch (e) { return; }
    open(null, '', null, { source: 'banner_lead' });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoOpenFromUrl);
  } else {
    autoOpenFromUrl();
  }

  // ── 화면에 박아 넣는 폼 (2026-08-08) ────────────────────
  //
  // 모달은 "버튼을 눌러야" 보인다. 목록 화면에서는 버튼을 안 누르고 지나가는 사람이 대부분이라
  // 입력칸을 처음부터 펼쳐 두는 편이 접수가 는다. 미소·정부24 같은 곳이 쓰는 방식이다.
  //
  //   dpMountSimpleApply(칸, { title, sub, catApi, catLabel, button })
  //
  // ⚠ 한 화면에 여러 개 붙이지 않는다. id 앞글자가 'sai' 하나뿐이라 두 개면 겹친다.
  //   같은 화면에 두 벌이 필요해지면 앞글자를 인자로 받게 고쳐야 한다.
  var _inlineDone = false;

  function mountInline(target, opts) {
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return null;
    if (_inlineDone) { console.warn('[simple-apply] 박아 넣는 폼은 한 화면에 하나만 붙인다'); return null; }
    _inlineDone = true;

    var o = opts || {};
    var cat = { api: o.catApi || CAT.api, label: o.catLabel || CAT.label };

    el.innerHTML = ''
      + '<div class="sain">'
      +   '<div class="sain-l">'
      +     '<h2 class="sain-t">' + esc(o.title || '우리집 요금제 얼마 나오는지 궁금한가요?') + '</h2>'
      +     '<p class="sain-s">' + esc(o.sub || '다픽에서 최저 요금 알려드릴게요') + '</p>'
      +   '</div>'
      +   '<div class="sain-r">'
      +     '<div class="sain-form" id="sainForm">'
      +       fieldsHtml('sai', PH)
      +       agreeHtml('sai')
      +       '<button type="button" class="sain-go" id="sainGo" data-track="simple_apply_inline">'
      +         esc(o.button || '최저 요금으로 상담받기') + '</button>'
      +     '</div>'
      +     '<div class="sain-done" id="sainDone"><div class="ic">✅</div><b>접수되었습니다</b>'
      +       '<p>상담사가 입력하신 번호로 곧 연락드립니다.</p></div>'
      +   '</div>'
      + '</div>';

    wireAgree('sai');

    var phone = document.getElementById('saiPhone');
    phone.addEventListener('input', function () { phone.value = fmtPhone(phone.value); });

    var go = document.getElementById('sainGo');
    var busy = false;
    go.addEventListener('click', function () {
      if (busy) return;
      var bad = validate('sai');
      if (bad) return alertLite(bad);
      // ⚠ 모달은 번호를 한 번 더 확인받는다. 여기서도 그 단계를 지킨다 —
      //   잘못 적힌 번호로 접수되면 상담사가 헛걸음하고 고객은 연락을 못 받는다.
      var shown = fmtPhone(onlyDigits(phone.value));
      if (!confirm('입력하신 번호는 ' + shown + ' 입니다.\n정말 맞나요?')) return;

      busy = true;
      var was = go.textContent;
      go.textContent = '접수 중...';
      postApply('sai', cat, { source: o.source || null })
        .then(function () {
          document.getElementById('sainForm').style.display = 'none';
          document.getElementById('sainDone').classList.add('on');
        })
        .catch(function (err) {
          alertLite((err && err.message) || '접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
        })
        .finally(function () { busy = false; go.textContent = was; });
    });
    return el;
  }

  window.dpMountSimpleApply = mountInline;

  // 화면이 부르지 않아도 자리만 있으면 붙는다.
  // <div data-simple-apply data-title="..." data-sub="..."></div>
  function autoMount() {
    var box = document.querySelector('[data-simple-apply]');
    if (!box) return;
    mountInline(box, {
      title: box.getAttribute('data-title') || '',
      sub: box.getAttribute('data-sub') || '',
      button: box.getAttribute('data-button') || '',
      source: box.getAttribute('data-source') || '',
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  function alertLite(msg){
    var t=document.createElement('div');
    t.textContent=msg;
    // 알림 쪽지는 모달(9500)보다 위여야 한다. 모달 위에서 뜨는 글이다.
    t.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:9600;background:#18172b;color:#fff;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);';
    document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 1800);
  }
})();
