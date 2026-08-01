// ════════════════════════════════════════════════════
// simple-apply.js — 간편 신청 (비회원) 모달 + 인라인 버튼
// 렌탈·정수기·인터넷 상세 페이지에 로드. 카테고리는 경로로 자동 판별.
// 인라인 버튼(class="sapply-inline", onclick="openSimpleApply()")을 페이지 액션줄에 배치.
// 버튼 문구/스타일은 여기서 주입하는 공통 클래스로 "모두 통일".
// 폼: 이름 / 전화번호(2차 확인) / 내용 → POST /api/simple-applications.
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
    + '.sapply-ov{position:fixed;inset:0;z-index:1000;background:rgba(20,18,40,.5);display:none;align-items:center;justify-content:center;padding:16px;}'
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
    + '.sapply-done p{margin:6px 0 0;color:#6b6880;font-size:14px;}';

  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var wrap = document.createElement('div');
  wrap.innerHTML = ''
    + '<div class="sapply-ov" id="sapplyOv">'
    +   '<div class="sapply-card" role="dialog" aria-modal="true">'
    +     '<div class="sapply-head"><b>3초만에 간편 신청</b><span class="cat">' + esc(CAT.label) + '</span><button class="sapply-x" id="sapplyX" aria-label="닫기">✕</button></div>'
    +     '<div class="sapply-body" id="sapplyForm">'
    +       '<div class="sapply-f"><label>이름</label><input id="saName" maxlength="30" placeholder="성함을 입력하세요" /></div>'
    +       '<div class="sapply-f"><label>전화번호</label><input id="saPhone" inputmode="numeric" maxlength="13" placeholder="010-0000-0000" /></div>'
    +       '<div class="sapply-f"><label>내용 <span style="font-weight:400;color:#9a97ad;">(선택)</span></label><textarea id="saMemo" maxlength="500" placeholder="' + esc(PH) + '"></textarea></div>'
    +       '<div class="sapply-agree">'
    +         '<label class="sa-agree-all"><input type="checkbox" id="saAgreeAll"/><span>전체 동의</span></label>'
    +         '<label class="sa-agree"><input type="checkbox" id="saPrivacy"/><span>[필수] <a href="privacy.html" target="_blank">개인정보 처리방침</a>에 동의합니다.</span></label>'
    +         '<label class="sa-agree"><input type="checkbox" id="saWarning"/><span>[필수] 다픽은 통신판매중개자이며, 상담 신청 시 위탁사로 정보가 전달됨을 확인했습니다.</span></label>'
    +         '<label class="sa-agree"><input type="checkbox" id="saMarketing"/><span>[선택] 마케팅 정보 수신에 동의합니다.</span></label>'
    +       '</div>'
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

  // 전체동의 연동
  var agreeAllEl = document.getElementById('saAgreeAll');
  var agreeIds = ['saPrivacy','saWarning','saMarketing'];
  function agreeEls(){ return agreeIds.map(function(id){return document.getElementById(id);}).filter(Boolean); }
  if (agreeAllEl) {
    agreeAllEl.addEventListener('change', function(){ var c=agreeAllEl.checked; agreeEls().forEach(function(el){el.checked=c;}); });
    agreeEls().forEach(function(el){ el.addEventListener('change', function(){ agreeAllEl.checked = agreeEls().every(function(c){return c.checked;}); }); });
  }

  /**
   * 모달 열기.
   *
   * 인자 없이 부르면 예전과 똑같이 동작한다 — 정수기·렌탈·인터넷 상세의 인라인 버튼이 그렇게 부른다.
   * 카테고리/상품 상세는 값을 넘겨 카테고리와 상품명을 갈아끼운다.
   *
   * @param catApi      접수에 실을 카테고리 값. 서버가 20자까지만 받아 잘라 보낸다.
   * @param productName 어떤 상품을 보고 눌렀는지. 문의 내용에 미리 채운다.
   * @param catLabel    모달 우상단에 표시할 이름(예: '에어컨').
   */
  function open(catApi, productName, catLabel){
    if (catApi) CAT.api = String(catApi).slice(0, 20);
    if (catLabel) {
      CAT.label = catLabel;
      var headEl = document.querySelector('.sapply-head .cat');
      if (headEl) headEl.textContent = catLabel;
    }
    resetToForm();
    // 상품명은 '덮어쓰기'다 — 다른 상품에서 다시 열었을 때 앞 상품명이 남으면 안 된다.
    // 고객이 지우고 다시 쓸 수 있게 placeholder 가 아니라 실제 값으로 넣는다.
    if (productName) memoEl.value = productName + ' 문의합니다.';
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
    var name=(nameEl.value||'').trim();
    var digits=onlyDigits(phoneEl.value);
    if(!name){ nameEl.focus(); return alertLite('이름을 입력하세요'); }
    if(digits.length<10 || digits.length>11){ phoneEl.focus(); return alertLite('전화번호를 정확히 입력하세요'); }
    var pv=document.getElementById('saPrivacy'), wn=document.getElementById('saWarning');
    if(pv && !pv.checked){ return alertLite('개인정보 처리방침 동의는 필수입니다'); }
    if(wn && !wn.checked){ return alertLite('통신판매중개 안내 확인은 필수입니다'); }
    document.getElementById('saPhoneEcho').textContent = fmtPhone(digits);
    form.style.display='none'; foot.style.display='none'; confirmEl.classList.add('on');
  });
  document.getElementById('saNo').addEventListener('click', resetToForm);

  var submitting = false;
  document.getElementById('saYes').addEventListener('click', function(){
    if (submitting) return;
    var yesBtn = document.getElementById('saYes');
    var payload = {
      category: CAT.api,
      name: (nameEl.value || '').trim(),
      phone: fmtPhone(onlyDigits(phoneEl.value)),
      content: (memoEl.value || '').trim(),
      marketingAgreed: (function(){ var m=document.getElementById('saMarketing'); return m ? m.checked : false; })()
    };
    if (typeof api === 'undefined' || !api.post) {
      confirmEl.classList.remove('on'); done.classList.add('on');
      return;
    }
    submitting = true;
    yesBtn.textContent = '접수 중...';
    api.post('/api/simple-applications', payload, { skipAuthRefresh: true })
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

  function alertLite(msg){
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:1100;background:#18172b;color:#fff;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);';
    document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 1800);
  }
})();
