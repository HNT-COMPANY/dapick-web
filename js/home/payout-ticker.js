// ════════════════════════════════════════════════════
// payout-ticker.js — 실시간 지원금 지급 내역 (아래→위 흐름)
// GET /api/live-payouts (관리자 CRUD 값). 비어있거나 실패하면 더미 폴백.
// [날짜][금액(마스킹)][이름][전화]
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  // 폴백. [날짜, 금액(마스킹), 이름(마스킹), 전화(마스킹)]
  const FALLBACK = [
    ['07/07','400,***','김*영','010-****-**98'],
    ['07/03','60,***','이*형','010-****-**41'],
    ['07/02','300,***','이*영','010-****-**83'],
    ['07/01','547,***','강*학','010-****-**83'],
    ['07/01','446,***','김*태','010-****-**11'],
    ['07/01','320,***','김*수','010-****-**93'],
    ['07/01','310,***','김*애','010-****-**43'],
    ['07/01','265,***','송*욱','010-****-**12'],
    ['07/01','264,***','배*자','010-****-**65'],
    ['07/01','220,***','유*옥','010-****-**11'],
    ['07/01','200,***','오*진','010-****-**85'],
    ['07/01','180,***','김*후','010-****-**58'],
    ['07/01','160,***','시*진','010-****-**19'],
    ['07/01','150,***','천*화','010-****-**71'],
    ['07/01','117,***','이*미','010-****-**26'],
    ['06/30','1,18*,***','박*경','010-****-**07'],
    ['06/30','730,***','이*웅','010-****-**31'],
    ['06/30','650,***','김*샘','010-****-**01'],
    ['06/30','600,***','강*연','010-****-**16'],
    ['06/30','350,***','박*원','010-****-**18'],
    ['06/25','260,***','문*애','010-****-**82'],
    ['06/22','270,***','강*현','010-****-**00'],
    ['06/19','230,***','김*환','010-****-**78'],
    ['06/16','190,***','박*환','010-****-**90'],
  ];

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function rowHtml(r){
    return (
      '<div class="payout-row">' +
      '<span class="payout-c-date">' + esc(r[0]) + '</span>' +
      '<span class="payout-c-amt">' + esc(r[1]) + '<em>원</em></span>' +
      '<span class="payout-c-name">' + esc(r[2]) + '</span>' +
      '<span class="payout-c-phone">' + esc(r[3]) + '</span>' +
      '</div>'
    );
  }

  function render(rows){
    const track = document.getElementById('payoutTrack');
    if (!track || !rows.length) return;
    const html = rows.map(rowHtml).join('');
    track.innerHTML = html + html;
    const dur = Math.max(20, rows.length * 1.11); // 신청현황과 행당 속도 동일
    track.style.animationDuration = dur + 's';
  }

  async function load(){
    let rows = null;
    try {
      if (typeof api !== 'undefined' && api.get) {
        const data = await api.get('/api/live-payouts');
        const list = Array.isArray(data) ? data : (data && data.content) || [];
        if (list.length) rows = list.map((m) => [m.date, m.amountLabel, m.name, m.phone]);
      }
    } catch (e) { /* 실패 시 폴백 */ }
    render(rows && rows.length ? rows : FALLBACK);
  }

  function init(){ if (document.getElementById('payoutTrack')) load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
