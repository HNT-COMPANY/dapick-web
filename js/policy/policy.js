// ════════════════════════════════════════════════════
// policy.js — 다픽 정책 페이지 공통 JS
// ────────────────────────────────────────────────────
// 1. 아코디언 토글 (terms 별첨 5개)
// 2. 사이드바 스크롤스파이 (현재 보고 있는 조항 하이라이트)
// 3. 앵커 클릭 시 부드러운 스크롤
// 4. 페이지 이동 (goPage)
// ════════════════════════════════════════════════════

// ════════════════════════════════════════════════════
// 1. 아코디언 토글
// ════════════════════════════════════════════════════
function initAccordions() {
  document.querySelectorAll('[data-accordion]').forEach((el) => {
    const head = el.querySelector('.pol-accordion-head');
    if (!head) return;
    head.addEventListener('click', () => el.classList.toggle('open'));
  });
}

// ════════════════════════════════════════════════════
// 2. 사이드바 스크롤스파이
// ════════════════════════════════════════════════════
function initScrollSpy() {
  const articles = document.querySelectorAll('.pol-article[id]');
  const links = document.querySelectorAll('.pol-toc-list a');
  if (!articles.length || !links.length) return;

  const linkMap = new Map();
  links.forEach((a) => {
    const id = a.getAttribute('href')?.slice(1);
    if (id) linkMap.set(id, a);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove('active'));
        const link = linkMap.get(entry.target.id);
        if (link) link.classList.add('active');
      });
    },
    { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
  );

  articles.forEach((a) => observer.observe(a));
}

// ════════════════════════════════════════════════════
// 3. 앵커 부드러운 스크롤
// ════════════════════════════════════════════════════
function initSmoothScroll() {
  document.querySelectorAll('.pol-toc-list a').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href')?.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ════════════════════════════════════════════════════
// 4. 페이지 이동
// ════════════════════════════════════════════════════
function goPage(page) {
  const map = {
    mobile: 'mobile.html',
    internet: 'internet-unified.html',
    card: 'card.html',
    water: 'water.html',
    rental: 'rental.html',
  };
  window.location.href = map[page] || 'index.html';
}

// ════════════════════════════════════════════════════
// 초기화
// ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initAccordions();
  initScrollSpy();
  initSmoothScroll();
});
