// ════════════════════════════════════════════════════
// apply-ticker.js — 실시간 신청 현황 (아래→위 흐름)
// 회원 접수: [날짜][시간][별명(마스킹)][전화]  ·  간편 접수: [날짜][시간][이름(마스킹)][전화]
// 지금은 관리자 더미. 추후 GET /api/applications/live 로 교체 예정.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  // [날짜, 시간, 구분(회원|간편), 이름/별명(마스킹), 전화(마스킹)]
  const APPLYS = [
    ['07/16','15:41','간편','장*혁','010-****-**68'],
    ['07/16','15:33','회원','행***루','010-****-**12'],
    ['07/16','15:20','간편','김*수','010-****-**45'],
    ['07/16','15:04','회원','산*박','010-****-**90'],
    ['07/16','14:52','간편','이*희','010-****-**33'],
    ['07/16','14:38','회원','다***터','010-****-**07'],
    ['07/16','14:19','간편','박*진','010-****-**21'],
    ['07/16','13:58','회원','최*연','010-****-**76'],
    ['07/16','13:44','간편','정*원','010-****-**52'],
    ['07/16','13:29','회원','뽀***봉','010-****-**19'],
    ['07/16','13:11','간편','한*수','010-****-**40'],
    ['07/16','12:55','회원','알**이','010-****-**63'],
    ['07/16','12:37','간편','오*섭','010-****-**51'],
    ['07/16','12:20','회원','구름**','010-****-**88'],
    ['07/16','12:03','간편','윤*호','010-****-**24'],
    ['07/16','11:46','회원','바다**','010-****-**11'],
    ['07/16','11:28','간편','조*빈','010-****-**39'],
    ['07/16','11:09','회원','햇살**','010-****-**45'],
  ];

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function rowHtml(r){
    const gubun = r[2] === '회원'
      ? '<span class="apply-tag apply-tag--mem">회원</span>'
      : '<span class="apply-tag apply-tag--easy">간편</span>';
    return (
      '<div class="apply-row">' +
      '<span class="apply-c-date">' + esc(r[0]) + '</span>' +
      '<span class="apply-c-time">' + esc(r[1]) + '</span>' +
      '<span class="apply-c-gubun">' + gubun + '</span>' +
      '<span class="apply-c-name">' + esc(r[3]) + '</span>' +
      '<span class="apply-c-phone">' + esc(r[4]) + '</span>' +
      '</div>'
    );
  }

  function init(){
    const track = document.getElementById('applyTrack');
    if (!track) return;
    const html = APPLYS.map(rowHtml).join('');
    track.innerHTML = html + html; // 2배 복제 → 무한 루프
    const dur = Math.max(20, APPLYS.length * 0.95);
    track.style.animationDuration = dur + 's';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
