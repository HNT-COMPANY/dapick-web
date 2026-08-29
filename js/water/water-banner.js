//
// 정수기 상단 배너 캐러셀 — 자동 5초 + 화살표/스와이프/점, 무한 순환
// 순수 JS(라이브러리 없음). internet.js 의 i-carousel 패턴 계승 + 터치 스와이프 추가.
// 배너 추가/제거는 아래 banner 배열만 수정하면 됨(N장 대응).
//
(function () {
  var track = document.getElementById('wTrack');
  if (!track) return;

  // 슬라이드 이미지 경로 (여기 배열에만 추가/제거하면 N장 확장)
  var banner = [
    '/assets/water/water-01.png',
    '/assets/water/coway-01.png',
  ];

  var DELAY = 5000;
  var idx = 0;
  var timer = null;

  // ── 슬라이드 주입 (첫 장 eager, 나머지 lazy — 1.9MB 대비 로딩 최적화) ──
  for (var i = 0; i < banner.length; i++) {
    var slide = document.createElement('div');
    slide.className = 'w-carousel__slide';
    var img = document.createElement('img');
    img.src = banner[i];
    img.alt = '다픽 정수기 배너 ' + (i + 1);
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    slide.appendChild(img);
    track.appendChild(slide);
  }

  var total = banner.length;

  // ── 인디케이터 점 ──
  var dotsWrap = document.getElementById('wDots');
  for (var j = 0; j < total; j++) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'w-carousel__dot' + (j === 0 ? ' active' : '');
    dot.setAttribute('aria-label', j + 1 + '번째 배너');
    (function (n) {
      dot.onclick = function () {
        go(n);
        reset();
      };
    })(j);
    dotsWrap.appendChild(dot);
  }
  var dots = dotsWrap.children;

  function render() {
    track.style.transform = 'translateX(-' + idx * 100 + '%)';
    for (var k = 0; k < dots.length; k++) {
      dots[k].className = 'w-carousel__dot' + (k === idx ? ' active' : '');
    }
  }
  function go(n) {
    idx = (n + total) % total; // 순환(마지막→첫, 첫→마지막)
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
    if (total > 1) timer = setInterval(next, DELAY);
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  function reset() {
    play(); // 수동 조작 직후 타이머 리셋 → 바로 안 넘어가게
  }

  // ── 화살표 (데스크탑) ──
  var nextBtn = document.getElementById('wNext');
  var prevBtn = document.getElementById('wPrev');
  if (nextBtn)
    nextBtn.onclick = function () {
      next();
      reset();
    };
  if (prevBtn)
    prevBtn.onclick = function () {
      prev();
      reset();
    };

  // ── hover 시 자동재생 정지 (데스크탑) ──
  var box = document.getElementById('wCarousel');
  if (box) {
    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', play);
  }

  // ── 터치 스와이프 (모바일 — touchstart/touchend 좌우 판정) ──
  var startX = 0;
  var dx = 0;
  var swiping = false;
  track.addEventListener(
    'touchstart',
    function (e) {
      startX = e.touches[0].clientX;
      dx = 0;
      swiping = true;
      stop();
    },
    { passive: true }
  );
  track.addEventListener(
    'touchmove',
    function (e) {
      if (swiping) dx = e.touches[0].clientX - startX;
    },
    { passive: true }
  );
  track.addEventListener('touchend', function () {
    if (!swiping) return;
    swiping = false;
    if (Math.abs(dx) > 40) {
      dx < 0 ? next() : prev(); // 왼쪽으로 밀면 다음, 오른쪽이면 이전
    }
    reset();
  });

  // ── 탭 비활성(백그라운드) 시 자동재생 정지 ──
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : play();
  });

  render();
  play();
})();
