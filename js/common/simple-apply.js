// ════════════════════════════════════════════════════
// simple-apply.js — 간편 신청 (비회원) 버튼 + 모달
// 렌탈 / 정수기 / 인터넷TV 페이지에 로드. 카테고리는 경로로 자동 판별.
// 폼: 이름 / 전화번호(2차 확인) / 내용 + 카테고리별 안내 문구.
// ※ 백엔드 연동 전 — 현재는 접수 확인 메시지까지. (TODO: POST /api/simple-applications)
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  var path = (location.pathname || '').toLowerCase();
  var CAT;
  if (path.indexOf('rental') >= 0) CAT = { key: 'RENTAL', label: '렌탈' };
  else if (path.indexOf('water') >= 0) CAT = { key: 'WATER', label: '정수기' };
  else if (path.indexOf('internet') >= 0) CAT = { key: 'INTERNET_TV', label: '인터넷' };
  else return; // 대상 페이지 아님

  var PH = '원하는 상품명이 있거나 간단한 글로 ' + CAT.label + ' 문의 혹은 지원금 문의로 간편하게 접수하세요';

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function onlyDigits(s){return String(s||'').replace(/[^0-9]/g,'');}
  function fmtPhone(d){ d=onlyDigits(d); if(d.length===11) return d.slice(0,3)+'-'+d.slice(3,7)+'-'+d.slice(7); if(d.length===10) return d.slice(0,3)+'-'+d.slice(3,6)+'-'+d.slice(6); return d; }

  var CSS = ''
    + '.sapply-fab{position:fixed;left:20px;bottom:24px;z-index:900;display:inline-flex;align-items:center;gap:7px;'
    + 'padding:13px 20px;border:none;border-radius:999px;background:linear-gradient(135deg,#6c3fc5,#8b5cf6);color:#fff;'
    + 'font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 8px 22px rgba(108,63,197,.35);}'
    + '.sapply-fab:hover{transform:translateY(-2px);}'
    + '.sapply-ov{position:fixed;inset:0;z-index:1000;background:rgba(20,18,40,.5);display:none;align-items:center;justify-content:center;padding:16px;}'
    + '.sapply-ov.on{display:flex;}'
    + '.sapply-card{width:100%;max-width:440px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25);}'
    + '.sapply-head{padding:20px 22px 14px;border-bottom:1px solid #eceaf8;display:flex;align-items:center;gap:8px;}'
    + '.sapply-head b{font-size:18px;font-weight:900;color:#18172b;}'
    + '.sapply-head .cat{font-size:12px;font-weight:800;color:#6c3fc5;background:#f3eeff;border-radius:999px;padding:4px 10px;}'
    + '.sapply-x{margin-left:auto;border:none;background:none;font-size:20px;color:#9a97ad;cursor:pointer;line-height:1;}'
    + '.sapply-body{padding:18px 22px 6px;}'
    + '.sapply-f{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}'
    + '.sapply-f label{font-size:13px;font-weight:700;color:#4a4a58;}'
    + '.sapply-f input,.sapply-f textarea{width:100%;box-sizing:border-box;padding:12px 13px;font-size:15px;font-family:inherit;'
    + 'border:1.5px solid #dcdce3;border-radius:11px;background:#fff;color:#18172b;}'
    + '.sapply-f input:focus,.sapply-f textarea:focus{outline:none;border-color:#8b5cf6;}'
    + '.sapply-f textarea{resize:vertical;min-height:92px;line-height:1.5;}'
    + '.sapply-foot{display:flex;gap:8px;padding:8px 22px 20px;}'
    + '.sapply-btn{flex:1;padding:13px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;border:1.5px solid #dcdce3;background:#fff;color:#4a4a58;}'
    + '.sapply-btn.pri{border:none;background:linear-gradient(135deg,#6c3fc5,#8b5cf6);color:#fff;}'
    + '.sapply-confirm{padding:22px;text-align:center;display:none;}'
    + '.sapply-confirm.on{display:block;}'
    + '.sapply-confirm .ph{font-size:22px;font-weight:900;color:#6c3fc5;letter-spacing:.5px;margin:8px 0 4px;font-variant-numeric:tabular-nums;}'
    + '.sapply-confirm p{margin:0;color:#4a4a58;font-size:15px;}'
    + '.sapply-confirm .q{margin-top:10px;font-weight:700;color:#18172b;}'
    + '.sapply-done{padding:34px 22px;text-align:center;display:none;}'
    + '.sapply-done.on{display:block;}'
    + '.sapply-done .ic{font-size:44px;}'
    + '.sapply-done b{display:block;font-size:18px;font-weight:900;color:#18172b;margin-top:8px;}'
    + '.sapply-done p{margin:6px 0 0;color:#6b6880;font-size:14px;}'
    + '@media(max-width:480px){.sapply-fab{left:14px;bottom:18px;padding:12px 16px;font-size:14px;}}';

  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var wrap = document.createElement('div');
  wrap.innerHTML = ''
    + '<button class="sapply-fab" type="button" id="sapplyOpen">⚡ 간편 신청</button>'
    + '<div class="sapply-ov" id="sapplyOv">'
    +   '<div class="sapply-card" role="dialog" aria-modal="true">'
    +     '<div class="sapply-head"><b>간편 신청</b><span class="cat">' + esc(CAT.label) + '</span><button class="sapply-x" id="sapplyX" aria-label="닫기">✕</button></div>'
    +     '<div class="sapply-body" id="sapplyForm">'
    +       '<div class="sapply-f"><label>이름</label><input id="saName" maxlength="30" placeholder="성함을 입력하세요" /></div>'
    +       '<div class="sapply-f"><label>전화번호</label><input id="saPhone" inputmode="numeric" maxlength="13" placeholder="010-0000-0000" /></div>'
    +       '<div class="sapply-f"><label>내용 <span style="font-weight:400;color:#9a97ad;">(선택)</span></label><textarea id="saMemo" maxlength="500" placeholder="' + esc(PH) + '"></textarea></div>'
    +     '</div>'
    +     '<div class="sapply-foot" id="sapplyFoot"><button class="sapply-btn" id="saClose" type="button">닫기</button><button class="sapply-btn pri" id="saNext" type="button">접수하기</button></div>'
    +     '<div class="sapply-confirm" id="sapplyConfirm"><p>입력하신 번호는</p><div class="ph" id="saPhoneEcho"></div><p class="q">정말 맞나요?</p><div class="sapply-foot" style="padding-left:0;padding-right:0;padding-bottom:0;"><button class="sapply-btn" id="saNo" type="button">아니요</button><button class="sapply-btn pri" id="saYes" type="button">네, 맞아요</button></div></div>'
    +     '<div class="sapply-done" id="sapplyDone"><div class="ic">✅</div><b>접수되었습니다</b><p>상담사가 입력하신 번호로 곧 연락드립니다.</p></div>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(wrap);

  var ov = document.getElementById('sapplyOv');
  var form = document.getElementById('sapplyForm');
  var foot = document.getElementById('sapplyFoot');
  var confirm = document.getElementById('sapplyConfirm');
  var done = document.getElementById('sapplyDone');
  var nameEl = document.getElementById('saName');
  var phoneEl = document.getElementById('saPhone');
  var memoEl = document.getElementById('saMemo');

  function open(){ resetToForm(); ov.classList.add('on'); }
  function close(){ ov.classList.remove('on'); }
  function resetToForm(){ form.style.display=''; foot.style.display=''; confirm.classList.remove('on'); done.classList.remove('on'); }

  // 전화번호 자동 하이픈
  phoneEl.addEventListener('input', function(){ var c=phoneEl.selectionStart; phoneEl.value=fmtPhone(phoneEl.value); });

  document.getElementById('sapplyOpen').addEventListener('click', open);
  document.getElementById('sapplyX').addEventListener('click', close);
  document.getElementById('saClose').addEventListener('click', close);
  ov.addEventListener('click', function(e){ if(e.target===ov) close(); });

  document.getElementById('saNext').addEventListener('click', function(){
    var name=(nameEl.value||'').trim();
    var digits=onlyDigits(phoneEl.value);
    if(!name){ nameEl.focus(); return alertLite('이름을 입력하세요'); }
    if(digits.length<10 || digits.length>11){ phoneEl.focus(); return alertLite('전화번호를 정확히 입력하세요'); }
    // 2차 확인 단계
    document.getElementById('saPhoneEcho').textContent = fmtPhone(digits);
    form.style.display='none'; foot.style.display='none'; confirm.classList.add('on');
  });
  document.getElementById('saNo').addEventListener('click', resetToForm);
  document.getElementById('saYes').addEventListener('click', function(){
    // TODO: 백엔드 연동 — POST /api/simple-applications { category, name, phone, memo }
    confirm.classList.remove('on'); done.classList.add('on');
  });

  function alertLite(msg){
    // 브라우저 alert 대신 간단 토스트
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:1100;background:#18172b;color:#fff;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);';
    document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 1800);
  }
})();
