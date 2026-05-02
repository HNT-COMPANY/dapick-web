// ════════════════════════════════════════════════════
// internet.js — 다픽 인터넷/TV 메인보드
// ────────────────────────────────────────────────────
// 컨셉: 통신사 선택만 (메인보드)
//       카드 클릭 시 통신사별 별도 페이지로 이동 (a href)
// 통신사별 페이지: internet-skt.html / internet-kt.html / ...
// ════════════════════════════════════════════════════

// ── 페이지 이동 ──────────────────────────────────────
function goPage(page) {
  const map = {
    mobile: 'mobile.html',
    internet: 'internet.html',
    card: 'card.html',
    water: 'water.html',
    rental: 'rental.html',
  };
  window.location.href = map[page] || 'index.html';
}

// ── scroll-top 토글 ────────────────────────────────
window.addEventListener(
  'scroll',
  () => {
    const btn = document.getElementById('scroll-top');
    if (btn) btn.classList.toggle('show', window.scrollY > 300);
  },
  { passive: true },
);
