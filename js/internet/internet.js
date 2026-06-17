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
    internet: 'internet-unified.html',
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

// ── 인터넷 혜택 배너 캐러셀 (자동/hover정지/화살표/점) ──
(function () {
  var track = document.getElementById('iTrack');
  if (!track) return;

  var total = track.children.length;
  var dotsWrap = document.getElementById('iDots');
  var idx = 0,
    timer = null,
    DELAY = 5000;

  for (var i = 0; i < total; i++) {
    var d = document.createElement('button');
    d.className = 'i-carousel__dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', i + 1 + '번째 배너');
    (function (n) {
      d.onclick = function () {
        go(n);
        reset();
      };
    })(i);
    dotsWrap.appendChild(d);
  }
  var dots = dotsWrap.children;

  function render() {
    track.style.transform = 'translateX(-' + idx * 100 + '%)';
    for (var i = 0; i < dots.length; i++)
      dots[i].className = 'i-carousel__dot' + (i === idx ? ' active' : '');
  }
  function go(n) {
    idx = (n + total) % total;
    render();
  }
  function next() {
    go(idx + 1);
  }
  function prev() {
    go(idx - 1);
  }
  function play() {
    stop();
    timer = setInterval(next, DELAY);
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  function reset() {
    play();
  }

  document.getElementById('iNext').onclick = function () {
    next();
    reset();
  };
  document.getElementById('iPrev').onclick = function () {
    prev();
    reset();
  };

  var box = document.getElementById('iCarousel');
  box.addEventListener('mouseenter', stop);
  box.addEventListener('mouseleave', play);

  render();
  play();
})();
