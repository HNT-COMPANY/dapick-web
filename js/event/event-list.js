// ════════════════════════════════════════════════════
// event-list.js — 이벤트 목록 (공개)
// GET /api/events → 가로형 행: 좌 이미지 / 우 제목·기간 / 진행중·종료 버튼. 클릭 시 상세.
// ════════════════════════════════════════════════════
(function () {
  'use strict';

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtDt(dt) { return dt ? String(dt).replace('T', ' ').slice(0, 16) : ''; }
  function periodText(e) {
    if (!e.startAt && !e.endAt) return '상시';
    return (fmtDt(e.startAt) || '?') + ' ~ ' + (fmtDt(e.endAt) || '?');
  }

  function rowHtml(e) {
    const img = e.imageUrl
      ? '<img src="' + esc(e.imageUrl) + '" alt="' + esc(e.title || '') + '" />'
      : '<span class="cel-noimg">이미지 없음</span>';
    const btn = e.ended
      ? '<span class="cel-btn ended">종료</span>'
      : '<span class="cel-btn ongoing">진행중</span>';
    return '<a class="cel-row" href="event-detail.html?id=' + e.id + '">' +
      '<div class="cel-img">' + img + '</div>' +
      '<div class="cel-body">' +
        '<div class="cel-title">' + esc(e.title || '') + '</div>' +
        '<div class="cel-period">' + esc(periodText(e)) + '</div>' +
      '</div>' +
      btn +
      '</a>';
  }

  function render(list) {
    const wrap = document.getElementById('evList');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = '<div class="cel-empty">진행 중인 이벤트가 없습니다.</div>';
      return;
    }
    wrap.innerHTML = list.map(rowHtml).join('');
  }

  function injectStyles() {
    const css =
      ".cel-wrap{max-width:900px;margin:24px auto 60px;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#2a2a35;}" +
      '.cel-head{font-size:26px;font-weight:900;color:#18172b;margin:8px 0 4px;}' +
      '.cel-sub{font-size:14px;color:#8a8fa3;margin-bottom:20px;}' +
      '.cel-loading{padding:70px 0;text-align:center;color:#9a9aa5;}' +
      '.cel-empty{padding:60px 0;text-align:center;color:#b0b0bd;}' +
      '.cel-list{display:flex;flex-direction:column;gap:14px;}' +
      '.cel-row{display:flex;align-items:center;gap:20px;background:#fff;border:1px solid #eee;border-radius:16px;padding:16px;text-decoration:none;color:inherit;box-shadow:0 1px 8px rgba(24,23,43,.04);transition:box-shadow .15s,transform .15s;}' +
      '.cel-row:hover{box-shadow:0 4px 18px rgba(24,23,43,.1);transform:translateY(-1px);}' +
      '.cel-img{width:200px;height:110px;flex-shrink:0;border-radius:12px;overflow:hidden;background:#f4f6fb;display:flex;align-items:center;justify-content:center;}' +
      '.cel-img img{width:100%;height:100%;object-fit:cover;}' +
      '.cel-noimg{color:#b7bccb;font-size:12px;}' +
      '.cel-body{flex:1;min-width:0;}' +
      '.cel-title{font-size:18px;font-weight:800;color:#18172b;line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}' +
      '.cel-period{font-size:13px;color:#8a8fa3;margin-top:8px;}' +
      '.cel-btn{flex-shrink:0;font-size:14px;font-weight:800;border-radius:999px;padding:9px 22px;}' +
      '.cel-btn.ongoing{color:#fff;background:#37c26a;}' +
      '.cel-btn.ended{color:#8a8fa3;background:#fff;border:1px solid #d7d7e0;}' +
      '@media(max-width:640px){.cel-row{gap:14px;padding:12px;}.cel-img{width:110px;height:74px;}.cel-title{font-size:15px;}.cel-btn{padding:7px 14px;font-size:13px;}}';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    api.get('/api/events')
      .then((list) => {
        const arr = Array.isArray(list) ? list : (list && list.content) || [];
        render(arr);
      })
      .catch(() => {
        const wrap = document.getElementById('evList');
        if (wrap) wrap.innerHTML = '<div class="cel-empty">이벤트를 불러오지 못했습니다.</div>';
      });
  });
})();
