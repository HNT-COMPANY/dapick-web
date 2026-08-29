//
// apply-ticker.js — 실시간 신청 현황 (아래→위 흐름)
// GET /api/live-applications (관리자 CRUD 값). 비어있거나 실패하면 더미 폴백.
// 회원: [날짜][시간][별명][전화] · 간편: [날짜][시간][이름][전화]
//
(function () {
  'use strict';

  // 폴백(운영 데이터 없을 때만). [날짜, 시간, 구분, 이름/별명(마스킹), 전화(마스킹)]
  const FALLBACK = [
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

  function render(rows){
    const track = document.getElementById('applyTrack');
    if (!track || !rows.length) return;
    const html = rows.map(rowHtml).join('');
    track.innerHTML = html + html; // 2배 복제 → 무한 루프
    const dur = Math.max(20, rows.length * 1.11); // 지급내역과 행당 속도 동일
    track.style.animationDuration = dur + 's';
  }

  async function load(){
    let rows = null;
    try {
      if (typeof api !== 'undefined' && api.get) {
        const data = await api.get('/api/live-applications');
        const list = Array.isArray(data) ? data : (data && data.content) || [];
        if (list.length) rows = list.map((m) => [m.date, m.time, m.typeLabel, m.name, m.phone]);
      }
    } catch (e) { /* 실패 시 폴백 */ }
    render(rows && rows.length ? rows : FALLBACK);
  }

  function init(){ if (document.getElementById('applyTrack')) load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
